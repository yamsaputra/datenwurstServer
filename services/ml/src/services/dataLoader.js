import pool from '../db.js';
import { encodeFeatures, computeStats } from '../model/featureEncoder.js';
import { LOOKBACK, HORIZON } from '../model/buildModel.js';
import { findValidWindows } from './validWindows.js';

const WINDOW_LENGTH = LOOKBACK + HORIZON;

/**
 * Fetches occupancy_intervals rows (optionally bounded by [from, to)), with
 * lag features, ordered by interval_start. This is the shared raw material
 * for both training-window construction and hold-out evaluation --
 * windowing/encoding happens in buildWindows() below, never duplicated
 * between the two call sites.
 */
export async function loadRows(from, to) {
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`oi.interval_start >= $${params.length}`); }
  if (to)   { params.push(to);   conditions.push(`oi.interval_start < $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT
      oi.interval_start, oi.interval_end, oi.occupancy, oi.day_of_week,
      oi.is_holiday, oi.period_type, oi.is_open,
      oi.is_finalized, oi.data_status, oi.sensor_config_id, oi.weather_backfilled,
      oi.weather_temp, oi.weather_precip, oi.weather_code,
      LAG(oi.occupancy, 1)   OVER (ORDER BY oi.interval_start) AS lag1,
      LAG(oi.occupancy, 2)   OVER (ORDER BY oi.interval_start) AS lag2,
      LAG(oi.occupancy, 48)  OVER (ORDER BY oi.interval_start) AS lag48,
      LAG(oi.occupancy, 336) OVER (ORDER BY oi.interval_start) AS lag336
    FROM occupancy_intervals oi
    ${where}
    ORDER BY oi.interval_start
  `, params);
  return rows;
}

/**
 * Builds (X, y) arrays from every valid contiguous window found in `rows`
 * (see validWindows.js: gap-aware, never a positional slice over however
 * the SQL result happened to be ordered -- the confirmed bug this replaces
 * produced 79 "windows" from 102 rows with zero truly gap-free ones).
 *
 * @param {Array} rows ordered ascending by interval_start
 * @param {object} stats from computeStats() -- pass TRAINING-only stats even
 *   when building holdout windows, so normalization never leaks holdout
 *   statistics into what the model effectively "sees".
 */
export function buildWindows(rows, stats) {
  const validWindows = findValidWindows(rows, WINDOW_LENGTH);
  const X = [], y = [];
  for (const window of validWindows) {
    X.push(window.slice(0, LOOKBACK).map(r => encodeFeatures(r, stats)));
    y.push(window.slice(LOOKBACK, WINDOW_LENGTH).map(r => r.occupancy));
  }
  return { X, y, validWindowCount: validWindows.length };
}

// Latest intervals with lag features, oldest-first — the prediction seed window.
export async function loadRecentHistory(limit = 16) {
  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT
        oi.interval_start, oi.day_of_week, oi.occupancy, oi.is_open, oi.sensor_config_id,
        oi.is_holiday, oi.period_type, oi.weather_temp, oi.weather_precip, oi.weather_code,
        LAG(oi.occupancy, 1)   OVER (ORDER BY oi.interval_start) AS lag1,
        LAG(oi.occupancy, 2)   OVER (ORDER BY oi.interval_start) AS lag2,
        LAG(oi.occupancy, 48)  OVER (ORDER BY oi.interval_start) AS lag48,
        LAG(oi.occupancy, 336) OVER (ORDER BY oi.interval_start) AS lag336
      FROM occupancy_intervals oi
      ORDER BY oi.interval_start DESC
      LIMIT $1
    ) recent
    ORDER BY interval_start
  `, [limit]);
  return rows;
}

export { computeStats };
