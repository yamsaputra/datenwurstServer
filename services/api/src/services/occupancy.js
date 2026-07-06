import pool from '../db.js';

// The building is empty at local midnight, so occupancy always counts from the
// start of the current day in library-local time.
const TZ = 'Europe/Berlin';

export async function getCurrentOccupancy() {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(entries) - SUM(exits), 0)::INTEGER AS occupancy
    FROM raw_events
    WHERE event_time >= date_trunc('day', NOW() AT TIME ZONE $1) AT TIME ZONE $1
  `, [TZ]);
  const raw = rows[0].occupancy;
  return Math.max(0, raw);
}

export async function upsertInterval(eventTime, entries, exits) {
  const start = floorToHalfHour(new Date(eventTime));
  const end   = new Date(start.getTime() + 30 * 60 * 1000);

  await pool.query(`
    INSERT INTO occupancy_intervals (interval_start, interval_end, entries, exits, day_of_week)
    VALUES ($1, $2, $3, $4, EXTRACT(ISODOW FROM $1::timestamptz AT TIME ZONE $5)::int - 1)
    ON CONFLICT (interval_start) DO UPDATE SET
      entries = occupancy_intervals.entries + EXCLUDED.entries,
      exits   = occupancy_intervals.exits   + EXCLUDED.exits
  `, [start, end, entries, exits, TZ]);

  // Recompute the running occupancy of the event's local day (≤48 rows), so
  // late or out-of-order events keep the whole day consistent.
  await pool.query(`
    UPDATE occupancy_intervals oi
    SET occupancy = GREATEST(0, sub.running)
    FROM (
      SELECT interval_start,
             SUM(entries - exits) OVER (ORDER BY interval_start) AS running
      FROM occupancy_intervals
      WHERE (interval_start AT TIME ZONE $2)::date = ($1::timestamptz AT TIME ZONE $2)::date
    ) sub
    WHERE oi.interval_start = sub.interval_start
  `, [start, TZ]);

  return getCurrentOccupancy();
}

function floorToHalfHour(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30);
  return d;
}
