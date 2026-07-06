import pool from '../db.js';
import { encodeFeatures, computeStats } from '../model/featureEncoder.js';
import { LOOKBACK, HORIZON } from '../model/buildModel.js';

export async function loadTrainingData(from, to) {
  const { rows } = await pool.query(`
    SELECT
      oi.interval_start, oi.interval_end, oi.occupancy, oi.day_of_week,
      oi.is_holiday, oi.is_semester, oi.is_open,
      oi.weather_temp, oi.weather_precip, oi.weather_code,
      LAG(oi.occupancy, 1)   OVER (ORDER BY oi.interval_start) AS lag1,
      LAG(oi.occupancy, 2)   OVER (ORDER BY oi.interval_start) AS lag2,
      LAG(oi.occupancy, 48)  OVER (ORDER BY oi.interval_start) AS lag48,
      LAG(oi.occupancy, 336) OVER (ORDER BY oi.interval_start) AS lag336
    FROM occupancy_intervals oi
    WHERE oi.interval_start >= $1 AND oi.interval_start < $2
    ORDER BY oi.interval_start
  `, [from, to]);

  if (rows.length < LOOKBACK + HORIZON) return null;

  const stats = computeStats(rows);
  const X = [], y = [];

  for (let i = 0; i + LOOKBACK + HORIZON <= rows.length; i++) {
    const window = rows.slice(i, i + LOOKBACK).map(r => encodeFeatures(r, stats));
    const targets = rows.slice(i + LOOKBACK, i + LOOKBACK + HORIZON).map(r => r.occupancy);
    X.push(window);
    y.push(targets);
  }

  return { X, y, stats, rowCount: rows.length };
}

// Latest intervals with lag features, oldest-first — the prediction seed window.
export async function loadRecentHistory(limit = 16) {
  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT
        oi.interval_start, oi.day_of_week, oi.occupancy, oi.is_open,
        oi.is_holiday, oi.is_semester, oi.weather_temp, oi.weather_precip, oi.weather_code,
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
