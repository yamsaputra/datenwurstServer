import pool from '../db.js';

export async function getForecastsHours(slots = 16) {
  const { rows } = await pool.query(`
    SELECT f.target_interval, f.predicted_occ
    FROM forecasts f
    INNER JOIN model_versions mv ON mv.id = f.model_version AND mv.is_active = TRUE
    WHERE f.target_interval >= NOW()
    ORDER BY f.target_interval
    LIMIT $1
  `, [slots]);
  return rows;
}

export async function getForecastsWeek() {
  const { rows } = await pool.query(`
    SELECT f.target_interval, f.predicted_occ
    FROM forecasts f
    INNER JOIN model_versions mv ON mv.id = f.model_version AND mv.is_active = TRUE
    WHERE f.target_interval >= NOW()
      AND f.target_interval < NOW() + INTERVAL '7 days'
    ORDER BY f.target_interval
  `);
  return rows;
}

export async function getHistory(from, to) {
  const { rows } = await pool.query(`
    SELECT interval_start, interval_end, entries, exits, occupancy, is_open,
           weather_temp, weather_code, is_holiday, is_semester, day_of_week
    FROM occupancy_intervals
    WHERE interval_start >= $1 AND interval_start <= $2
    ORDER BY interval_start
  `, [from, to]);
  return rows;
}
