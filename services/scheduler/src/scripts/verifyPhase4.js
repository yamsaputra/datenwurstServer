// Verifies the Phase 4 weather pipeline invariants.
// Usage: docker compose exec scheduler node src/scripts/verifyPhase4.js

import pg from 'pg';
import assert from 'node:assert/strict';
import { nowIso } from '../lib/logger.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`[verify-phase4][${nowIso()}] ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`[verify-phase4][${nowIso()}] FAIL  ${name}: ${err.message}`);
  }
}

async function main() {
  console.log(`[verify-phase4][${nowIso()}] Phase 4 verification\n`);

  await check('every weather_cache row has a valid source', async () => {
    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE source NOT IN ('forecast', 'historical')) AS bad FROM weather_cache`
    );
    assert.equal(Number(rows[0].bad), 0);
  });

  await check('no forecast-source weather row ever satisfies a historical join', async () => {
    const { rows } = await pool.query(`
      SELECT count(*) AS n FROM occupancy_intervals oi
      JOIN weather_cache wc ON wc.forecast_for = (oi.interval_start AT TIME ZONE 'Europe/Berlin')::date
      WHERE wc.source = 'forecast' AND oi.weather_backfilled = TRUE
    `);
    assert.equal(Number(rows[0].n), 0);
  });

  await check('every weather_backfilled=true row has non-null weather_temp/precip/code', async () => {
    const { rows } = await pool.query(`
      SELECT count(*) AS n FROM occupancy_intervals
      WHERE weather_backfilled = TRUE
        AND (weather_temp IS NULL OR weather_precip IS NULL OR weather_code IS NULL)
    `);
    assert.equal(Number(rows[0].n), 0);
  });

  const { rows: sourceCounts } = await pool.query(`
    SELECT source, count(*) AS n, min(forecast_for) AS min_date, max(forecast_for) AS max_date
    FROM weather_cache GROUP BY source
  `);
  const { rows: backfillCounts } = await pool.query(`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE weather_temp IS NOT NULL) AS with_temp,
      count(*) FILTER (WHERE weather_backfilled) AS backfilled
    FROM occupancy_intervals WHERE is_finalized = TRUE
  `);
  console.log(`\n[verify-phase4][${nowIso()}] weather_cache by source (informational):`, sourceCounts);
  console.log(`[verify-phase4][${nowIso()}] occupancy_intervals backfill status (informational):`, backfillCounts[0]);

  console.log(failures === 0 ? `\n[verify-phase4][${nowIso()}] All checks passed.` : `\n[verify-phase4][${nowIso()}] ${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(`[verify-phase4][${nowIso()}] verifyPhase4.js crashed:`, err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
