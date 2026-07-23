import db from '../lib/db.js';
import { httpGet } from '../lib/httpClient.js';
import { findHourlyReading } from '../lib/weatherMapping.js';
import { nowIso } from '../lib/logger.js';

// Historical Forecast API, not the Archive/ERA5 API: chosen because training
// must see the same distribution the model receives at inference time. ERA5
// reanalysis is corrected against observations that arrive *after* the fact,
// while live forecasts are not -- training on ERA5 would teach the model
// relationships against a variable it never actually sees in production.
// Verified live against the real endpoint before writing this (2026-07-23):
// same response shape as the regular Forecast API, hourly.time as
// Berlin-local wall-clock strings with no UTC offset.
const HISTORICAL_URL = process.env.OPEN_METEO_HISTORICAL_URL || 'https://historical-forecast-api.open-meteo.com';

/**
 * Fetches and stores historical weather for [fromDateYMD, toDateYMD]
 * inclusive, tagged source='historical'. Returns the set of dates that came
 * back fully populated (every hour non-null) -- callers use this to decide
 * which occupancy_intervals rows can be marked weather_backfilled=true.
 * Dates with any missing/null hour are not stored at all and are left for a
 * later retry, per the recency-gap handling in Phase 4.5: never substitute
 * a forecast value, never impute.
 */
export async function fetchHistoricalRange(fromDateYMD, toDateYMD) {
  const { rows: latRows } = await db.query("SELECT value FROM config WHERE key = 'library_lat'");
  const { rows: lonRows } = await db.query("SELECT value FROM config WHERE key = 'library_lon'");
  const lat = latRows[0]?.value ?? 52.41;
  const lon = lonRows[0]?.value ?? 12.55;

  const url = `${HISTORICAL_URL}/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation,weathercode&start_date=${fromDateYMD}&end_date=${toDateYMD}&timezone=Europe%2FBerlin`;

  const res = await httpGet(url);
  const data = await res.json();

  const times = data.hourly.time;
  const byDate = new Map();
  for (let i = 0; i < times.length; i++) {
    const date = times[i].slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({
      time: times[i],
      temperature: data.hourly.temperature_2m[i],
      precip: data.hourly.precipitation[i],
      code: data.hourly.weathercode[i],
    });
  }

  const completeDates = [];
  for (const [date, hours] of byDate) {
    const isComplete = hours.length >= 24 &&
      hours.every(h => h.temperature !== null && h.precip !== null && h.code !== null);
    if (!isComplete) continue;

    await db.query(`
      INSERT INTO weather_cache (forecast_for, raw_json, source)
      VALUES ($1, $2, 'historical')
      ON CONFLICT (forecast_for, source) DO UPDATE SET raw_json = EXCLUDED.raw_json, fetched_at = NOW()
    `, [date, JSON.stringify(hours)]);
    completeDates.push(date);
  }

  return completeDates;
}

/**
 * Retries backfilling weather_temp/weather_precip/weather_code onto any
 * finalized occupancy_intervals row still marked weather_backfilled=false,
 * for whichever of its calendar dates now has a settled historical
 * weather_cache entry. Scoped to only the distinct dates that actually need
 * it, not a blind full-table scan every day.
 */
async function retryPendingBackfill() {
  const { rows: pendingDates } = await db.query(`
    SELECT DISTINCT (interval_start AT TIME ZONE 'Europe/Berlin')::date AS date
    FROM occupancy_intervals
    WHERE is_finalized = TRUE AND weather_backfilled = FALSE
    ORDER BY 1
  `);

  let updatedRows = 0, settledDates = 0;
  for (const { date } of pendingDates) {
    const dateYMD = date.toISOString().slice(0, 10);
    const { rows: cacheRows } = await db.query(
      `SELECT raw_json FROM weather_cache WHERE forecast_for = $1 AND source = 'historical'`,
      [dateYMD]
    );
    if (!cacheRows.length) continue; // archive still hasn't settled for this date

    settledDates++;
    const hourly = cacheRows[0].raw_json;
    const { rows: intervals } = await db.query(`
      SELECT interval_start FROM occupancy_intervals
      WHERE (interval_start AT TIME ZONE 'Europe/Berlin')::date = $1 AND weather_backfilled = FALSE
    `, [dateYMD]);

    for (const row of intervals) {
      const reading = findHourlyReading(hourly, row.interval_start);
      if (!reading) continue;
      await db.query(`
        UPDATE occupancy_intervals
        SET weather_temp = $1, weather_precip = $2, weather_code = $3, weather_backfilled = TRUE
        WHERE interval_start = $4
      `, [reading.temperature, reading.precip, reading.code, row.interval_start]);
      updatedRows++;
    }
  }
  return { updatedRows, settledDates, pendingDates: pendingDates.length };
}

export default async function fetchWeatherHistorical() {
  try {
    // Daily catch-up: yesterday and today, in case yesterday's archive
    // wasn't fully settled the last time this ran.
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const from = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const completeDates = await fetchHistoricalRange(from, to);
    console.log(`[weather-historical][${nowIso()}] Stored ${completeDates.length} fully-populated day(s): ${completeDates.join(', ') || '(none yet)'}`);

    const retry = await retryPendingBackfill();
    console.log(`[weather-historical][${nowIso()}] Backfill retry: ${retry.updatedRows} interval(s) updated across ${retry.settledDates}/${retry.pendingDates} pending date(s)`);
  } catch (err) {
    console.error(`[weather-historical][${nowIso()}] Failed:`, err.message);
  }
}
