import pool from '../db.js';

export async function getCurrentOccupancy() {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(entries) - SUM(exits), 0)::INTEGER AS occupancy
    FROM raw_events
    WHERE event_time >= NOW() - INTERVAL '24 hours'
  `);
  const raw = rows[0].occupancy;
  return Math.max(0, raw);
}

export async function upsertInterval(eventTime, entries, exits) {
  const start = floorToHalfHour(new Date(eventTime));
  const end   = new Date(start.getTime() + 30 * 60 * 1000);
  const dow   = (start.getUTCDay() + 6) % 7; // 0=Mon…6=Sun

  await pool.query(`
    INSERT INTO occupancy_intervals (interval_start, interval_end, entries, exits, day_of_week)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (interval_start) DO UPDATE SET
      entries = occupancy_intervals.entries + EXCLUDED.entries,
      exits   = occupancy_intervals.exits   + EXCLUDED.exits
  `, [start, end, entries, exits, dow]);

  const occ = await getCurrentOccupancy();
  await pool.query(
    'UPDATE occupancy_intervals SET occupancy = $1 WHERE interval_start = $2',
    [occ, start]
  );

  return occ;
}

function floorToHalfHour(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30);
  return d;
}
