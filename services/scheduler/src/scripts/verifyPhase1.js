// Verifies the Phase 1 schema migrations landed correctly. Structural
// invariants only (columns/constraints/seed rows exist and hold valid
// values) rather than exact historical row counts from the original
// 2026-07-22 evidence export -- counts like "19 weather_cache rows" drift
// upward every day the fetchWeather cron keeps running, so hardcoding them
// here would make this script fail on every run after the first.
//
// Usage: docker compose exec scheduler node src/scripts/verifyPhase1.js

import pg from 'pg';
import assert from 'node:assert/strict';
import { nowIso } from '../lib/logger.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`[verify-phase1][${nowIso()}] ok    ${name}`);
  } catch (err) {
    failures++;
    console.error(`[verify-phase1][${nowIso()}] FAIL  ${name}: ${err.message}`);
  }
}

async function main() {
  console.log(`[verify-phase1][${nowIso()}] Phase 1 verification\n`);

  await check('occupancy_intervals has is_finalized/data_status/period_type/clamped/weather_backfilled/sensor_config_id columns', async () => {
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'occupancy_intervals'
    `);
    const cols = new Set(rows.map(r => r.column_name));
    for (const col of ['is_finalized', 'data_status', 'period_type', 'clamped', 'weather_backfilled', 'sensor_config_id']) {
      assert.ok(cols.has(col), `missing column ${col}`);
    }
  });

  await check('is_open defaults to FALSE', async () => {
    const { rows } = await pool.query(`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'occupancy_intervals' AND column_name = 'is_open'
    `);
    assert.match(rows[0].column_default ?? '', /false/i);
  });

  await check('entries/exits/occupancy are nullable (required for data_status=no_data rows)', async () => {
    const { rows } = await pool.query(`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'occupancy_intervals' AND column_name IN ('entries', 'exits', 'occupancy')
    `);
    for (const r of rows) assert.equal(r.is_nullable, 'YES', `${r.column_name} is still NOT NULL`);
  });

  await check('no occupancy_intervals row violates data_status/period_type CHECK constraints', async () => {
    const { rows } = await pool.query(`
      SELECT count(*) FILTER (WHERE data_status NOT IN ('observed', 'no_data')) AS bad_status,
             count(*) FILTER (WHERE period_type IS NOT NULL AND period_type NOT IN ('lecture', 'exam', 'break')) AS bad_period
      FROM occupancy_intervals
    `);
    assert.equal(Number(rows[0].bad_status), 0);
    assert.equal(Number(rows[0].bad_period), 0);
  });

  await check('2025-11-15 orphan row is gone', async () => {
    const { rows } = await pool.query(
      `SELECT 1 FROM occupancy_intervals WHERE interval_start = '2025-11-15T10:00:00Z'`
    );
    assert.equal(rows.length, 0);
  });

  await check('2026-07-04 10:00-16:00 local outage window is fully present and marked no_data', async () => {
    const { rows } = await pool.query(`
      SELECT count(*) AS n,
             count(*) FILTER (WHERE data_status = 'no_data' AND occupancy IS NULL) AS correct
      FROM occupancy_intervals
      WHERE (interval_start AT TIME ZONE 'Europe/Berlin')::date = '2026-07-04'
        AND (interval_start AT TIME ZONE 'Europe/Berlin')::time >= '10:00'
        AND (interval_start AT TIME ZONE 'Europe/Berlin')::time <  '16:00'
    `);
    assert.equal(Number(rows[0].n), 12, 'expected 12 half-hour slots in the 10:00-16:00 window');
    assert.equal(Number(rows[0].correct), 12);
  });

  await check('sensor_configs row 1 (pilot) exists and is not active', async () => {
    const { rows } = await pool.query(`SELECT is_active FROM sensor_configs WHERE id = 1`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_active, false);
  });

  await check('every occupancy_intervals/raw_events row has a valid sensor_config_id', async () => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*) FROM occupancy_intervals oi
           WHERE NOT EXISTS (SELECT 1 FROM sensor_configs sc WHERE sc.id = oi.sensor_config_id)) AS oi_bad,
        (SELECT count(*) FROM raw_events re
           WHERE NOT EXISTS (SELECT 1 FROM sensor_configs sc WHERE sc.id = re.sensor_config_id)) AS re_bad
    `);
    assert.equal(Number(rows[0].oi_bad), 0);
    assert.equal(Number(rows[0].re_bad), 0);
  });

  await check('calendar_periods has all 7 seeded periods, calendar_lecture_free has all 5 ranges', async () => {
    const { rows: periods } = await pool.query('SELECT count(*) AS n FROM calendar_periods');
    const { rows: free }    = await pool.query('SELECT count(*) AS n FROM calendar_lecture_free');
    assert.equal(Number(periods[0].n), 7);
    assert.equal(Number(free[0].n), 5);
  });

  await check('every weather_cache row has source forecast or historical', async () => {
    const { rows } = await pool.query(`
      SELECT count(*) FILTER (WHERE source NOT IN ('forecast', 'historical')) AS bad FROM weather_cache
    `);
    assert.equal(Number(rows[0].bad), 0);
  });

  await check('model_versions has the __baseline__ sentinel row', async () => {
    const { rows } = await pool.query(`SELECT status FROM model_versions WHERE model_path = '__baseline__'`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'baseline');
  });

  await check('config has corrected coordinates and the new ml.*/capacity_label keys', async () => {
    const { rows } = await pool.query(`SELECT key, value FROM config WHERE key IN
      ('library_lat', 'library_lon', 'ml.min_training_windows', 'ml.min_baseline_days', 'capacity_label')`);
    const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
    assert.equal(Number(byKey.library_lat), 52.41);
    assert.equal(Number(byKey.library_lon), 12.55);
    assert.equal(Number(byKey['ml.min_training_windows']), 2000);
    assert.equal(Number(byKey['ml.min_baseline_days']), 14);
    assert.equal(byKey.capacity_label, 'Lernbereich');
  });

  // Informational only -- these numbers are expected to grow over time.
  const { rows: counts } = await pool.query(`
    SELECT
      (SELECT count(*) FROM occupancy_intervals) AS occupancy_intervals,
      (SELECT count(*) FROM raw_events) AS raw_events,
      (SELECT count(*) FILTER (WHERE source = 'forecast') FROM weather_cache) AS weather_forecast,
      (SELECT count(*) FILTER (WHERE source = 'historical') FROM weather_cache) AS weather_historical
  `);
  console.log(`\n[verify-phase1][${nowIso()}] Current counts (informational, not asserted):`, counts[0]);

  console.log(failures === 0 ? `\n[verify-phase1][${nowIso()}] All checks passed.` : `\n[verify-phase1][${nowIso()}] ${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(`[verify-phase1][${nowIso()}] verifyPhase1.js crashed:`, err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
