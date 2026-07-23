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

export async function upsertInterval(eventTime, entries, exits, sensorConfigId) {
  const start = floorToHalfHour(new Date(eventTime));
  const end   = new Date(start.getTime() + 30 * 60 * 1000);

  // COALESCE guards against a slot that a prior finalization pass marked
  // data_status='no_data' with entries/exits=NULL (sensor believed down) --
  // without it, NULL + EXCLUDED.entries is NULL in SQL, silently discarding
  // a genuine late-arriving event instead of healing the slot. Receiving a
  // real event is proof the slot is 'observed', regardless of what an
  // earlier heuristic guessed.
  await pool.query(`
    INSERT INTO occupancy_intervals (interval_start, interval_end, entries, exits, day_of_week, sensor_config_id, data_status)
    VALUES ($1, $2, $3, $4, EXTRACT(ISODOW FROM $1::timestamptz AT TIME ZONE $5)::int - 1, $6, 'observed')
    ON CONFLICT (interval_start) DO UPDATE SET
      entries     = COALESCE(occupancy_intervals.entries, 0) + EXCLUDED.entries,
      exits       = COALESCE(occupancy_intervals.exits, 0)   + EXCLUDED.exits,
      data_status = 'observed'
  `, [start, end, entries, exits, TZ, sensorConfigId]);

  // Recompute the running occupancy of the event's local day (<=48 rows), so
  // late or out-of-order events keep the whole day consistent. Only touches
  // rows that already have real entries/exits -- a genuinely unknown
  // (data_status='no_data', entries IS NULL) slot elsewhere in the same day
  // keeps its NULL occupancy rather than being silently overwritten with a
  // carried-forward number. This only matters for the rare case of a late
  // event landing in an already-finalized day that also contains a no_data
  // gap; aggregateIntervals.js's own two-pass recompute is authoritative for
  // everything else and re-derives occupancy correctly on its next run.
  await pool.query(`
    UPDATE occupancy_intervals oi
    SET occupancy = GREATEST(0, sub.running)
    FROM (
      SELECT interval_start,
             SUM(entries - exits) OVER (ORDER BY interval_start) AS running
      FROM occupancy_intervals
      WHERE (interval_start AT TIME ZONE $2)::date = ($1::timestamptz AT TIME ZONE $2)::date
        AND entries IS NOT NULL AND exits IS NOT NULL
    ) sub
    WHERE oi.interval_start = sub.interval_start
      AND oi.entries IS NOT NULL AND oi.exits IS NOT NULL
  `, [start, TZ]);

  return getCurrentOccupancy();
}

function floorToHalfHour(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30);
  return d;
}
