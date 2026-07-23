// Backfills weather_temp/weather_precip/weather_code/weather_backfilled onto
// occupancy_intervals rows in a date range, from the historical Open-Meteo
// archive. Idempotent (only ever touches rows with weather_backfilled=false,
// via IS DISTINCT FROM-style guards), rate-limit aware (one historical fetch
// per calendar day in the range, reusing whatever's already cached), and
// never substitutes a forecast value or imputes -- days the archive hasn't
// settled yet are logged as skipped and left for a later run.
//
// Usage:
//   docker compose exec scheduler node src/scripts/backfillWeather.js \
//     --from 2026-08-01 --to 2026-08-31 [--dry-run]

import pg from 'pg';
import { fetchHistoricalRange } from '../jobs/fetchWeatherHistorical.js';
import { findHourlyReading } from '../lib/weatherMapping.js';
import { nowIso } from '../lib/logger.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = (next === undefined || next.startsWith('--')) ? true : next;
    if (out[key] !== true) i++;
  }
  return out;
}

function* dateRange(fromYMD, toYMD) {
  let d = new Date(`${fromYMD}T00:00:00Z`);
  const end = new Date(`${toYMD}T00:00:00Z`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.from || !args.to) {
  console.error(`[backfill-weather][${nowIso()}] Usage: node backfillWeather.js --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]`);
  process.exitCode = 1;
  process.exit();
}
const dryRun = args['dry-run'] === true;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  let updated = 0, skippedNoArchive = 0, skippedAlreadyDone = 0;

  for (const dateYMD of dateRange(args.from, args.to)) {
    const { rows: existing } = await pool.query(
      `SELECT raw_json FROM weather_cache WHERE forecast_for = $1 AND source = 'historical'`,
      [dateYMD]
    );

    let hourly = existing[0]?.raw_json ?? null;
    if (!hourly) {
      const completeDates = await fetchHistoricalRange(dateYMD, dateYMD);
      if (completeDates.includes(dateYMD)) {
        const { rows } = await pool.query(
          `SELECT raw_json FROM weather_cache WHERE forecast_for = $1 AND source = 'historical'`,
          [dateYMD]
        );
        hourly = rows[0]?.raw_json ?? null;
      }
    }

    if (!hourly) {
      console.log(`[backfill-weather][${nowIso()}] skip   ${dateYMD} -- archive not yet settled for this date`);
      skippedNoArchive++;
      continue;
    }

    const { rows: intervals } = await pool.query(`
      SELECT interval_start FROM occupancy_intervals
      WHERE (interval_start AT TIME ZONE 'Europe/Berlin')::date = $1
        AND weather_backfilled = FALSE
    `, [dateYMD]);

    if (!intervals.length) {
      skippedAlreadyDone++;
      continue;
    }

    for (const row of intervals) {
      const reading = findHourlyReading(hourly, row.interval_start);
      if (!reading) continue;
      if (dryRun) { updated++; continue; }
      await pool.query(`
        UPDATE occupancy_intervals
        SET weather_temp = $1, weather_precip = $2, weather_code = $3, weather_backfilled = TRUE
        WHERE interval_start = $4
      `, [reading.temperature, reading.precip, reading.code, row.interval_start]);
      updated++;
    }
    console.log(`[backfill-weather][${nowIso()}] done   ${dateYMD} -- ${intervals.length} interval(s) ${dryRun ? 'would be' : ''} updated`);
  }

  console.log(`\n[backfill-weather][${nowIso()}] ${dryRun ? '[dry-run] ' : ''}Total: ${updated} interval(s) updated, ${skippedNoArchive} date(s) skipped (archive not settled), ${skippedAlreadyDone} date(s) already fully backfilled.`);
} catch (err) {
  console.error(`[backfill-weather][${nowIso()}] backfillWeather.js failed:`, err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
