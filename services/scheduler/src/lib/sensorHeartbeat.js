// Distinguishes "library quiet" from "sensor down" without a real device
// heartbeat (the Jetson firmware will not be changed before remount -- see
// the correctness-overhaul plan's open question 6). Heuristic, not a fact:
// a slot is treated as "sensor down" if no raw_events row arrived from the
// active sensor within a symmetric 2-hour window around it, evaluated only
// during configured opening hours -- during closed hours, quiet-vs-down is
// unknowable and irrelevant, since occupancy is 0 either way regardless of
// sensor state.
//
// Retrofitting a real heartbeat later means the Jetson posts on a fixed
// interval regardless of counts (including all-zero payloads); until then,
// this heuristic will misclassify some genuinely-quiet stretches as
// outages, and vice versa near the edges of a real outage.
export async function wasSensorUp(pool, intervalStart, sensorConfigId) {
  const HALF_WINDOW_MS = 2 * 60 * 60 * 1000;
  const windowStart = new Date(intervalStart.getTime() - HALF_WINDOW_MS);
  const windowEnd   = new Date(intervalStart.getTime() + HALF_WINDOW_MS);

  const { rows } = await pool.query(`
    SELECT 1 FROM raw_events
    WHERE sensor_config_id = $1 AND event_time >= $2 AND event_time < $3
    LIMIT 1
  `, [sensorConfigId, windowStart, windowEnd]);

  return rows.length > 0;
}
