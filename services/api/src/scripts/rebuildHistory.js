// Rebuilds the corrupt occupancy_intervals.occupancy column.
//
// Historically, occupancy was written as a rolling-24h total evaluated at
// ingest time instead of a per-day running sum, so every stored value is
// wrong. The per-interval entries/exits sums are correct, so occupancy can be
// recomputed from them: running SUM(entries - exits) per library-local day,
// clamped at 0 (the building is empty at midnight).
//
// Usage: docker compose exec api node src/scripts/rebuildHistory.js
// Recommended before running:
//   docker compose exec db pg_dump -U library_app library_occupancy > backup.sql

import pg from 'pg';

const TZ = 'Europe/Berlin';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('BEGIN');

  const occ = await client.query(`
    UPDATE occupancy_intervals oi
    SET occupancy = GREATEST(0, sub.running)
    FROM (
      SELECT interval_start,
             SUM(entries - exits) OVER (
               PARTITION BY (interval_start AT TIME ZONE $1)::date
               ORDER BY interval_start
             ) AS running
      FROM occupancy_intervals
    ) sub
    WHERE oi.interval_start = sub.interval_start
      AND oi.occupancy IS DISTINCT FROM GREATEST(0, sub.running)
  `, [TZ]);
  console.log(`occupancy recomputed for ${occ.rowCount} interval(s)`);

  const dow = await client.query(`
    UPDATE occupancy_intervals
    SET day_of_week = EXTRACT(ISODOW FROM interval_start AT TIME ZONE $1)::int - 1
    WHERE day_of_week IS DISTINCT FROM EXTRACT(ISODOW FROM interval_start AT TIME ZONE $1)::int - 1
  `, [TZ]);
  console.log(`day_of_week corrected for ${dow.rowCount} interval(s)`);

  const nan = await client.query(`
    DELETE FROM forecasts WHERE predicted_occ = 'NaN'::numeric
  `);
  console.log(`removed ${nan.rowCount} NaN forecast(s)`);

  await client.query('COMMIT');
  console.log('History rebuilt. Retrain the model afterwards so forecasts use the corrected data.');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Rebuild failed, all changes rolled back:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
