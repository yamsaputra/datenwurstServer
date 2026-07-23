import pool from '../db.js';

// Prefers a fresh LSTM row per target_interval, falling back to the
// freshest baseline row for that same slot when no LSTM row is fresh enough
// (Phase 6.3's staleness window) or none exists. Replaces the old
// `mv.is_active = TRUE` join, which had no staleness check at all -- a
// forecast run from 13 days ago with a still-active model would have been
// served without complaint. "Newest wins" is enforced here, not via a
// uniqueness constraint on target_interval (1,342 duplicate values existed
// across 34 runs before this -- history across runs is worth keeping).
export async function getForecastsHours(slots = 24) {
  const { rows } = await pool.query(`
    SELECT target_interval, predicted_occ, source FROM (
      SELECT DISTINCT ON (target_interval) target_interval, predicted_occ, source, generated_at
      FROM forecasts
      WHERE target_interval >= NOW() AND generated_at >= NOW() - INTERVAL '2 hours'
      ORDER BY target_interval, (source = 'lstm') DESC, generated_at DESC
    ) latest
    ORDER BY target_interval
    LIMIT $1
  `, [slots]);
  return rows;
}

// Always the seasonal baseline, explicitly -- never the LSTM. Phase 6.4:
// the autoregressive loop's days 2-7 are confirmed fixed-point-converged
// noise (byte-identical across 5 complete runs and 4 model versions), so
// the week view is sourced entirely from "typical for this time", labeled
// as such by the frontend, never presented as a model prediction.
export async function getForecastsWeek() {
  const { rows } = await pool.query(`
    SELECT target_interval, predicted_occ, source FROM (
      SELECT DISTINCT ON (target_interval) target_interval, predicted_occ, source, generated_at
      FROM forecasts
      WHERE source = 'baseline' AND target_interval >= NOW() AND target_interval < NOW() + INTERVAL '7 days'
      ORDER BY target_interval, generated_at DESC
    ) latest
    ORDER BY target_interval
  `);
  return rows;
}

export async function getHistory(from, to) {
  const { rows } = await pool.query(`
    SELECT interval_start, interval_end, entries, exits, occupancy, is_open,
           weather_temp, weather_code, is_holiday, day_of_week,
           (period_type <> 'break') AS is_semester
    FROM occupancy_intervals
    WHERE interval_start >= $1 AND interval_start <= $2
    ORDER BY interval_start
  `, [from, to]);
  return rows;
}
