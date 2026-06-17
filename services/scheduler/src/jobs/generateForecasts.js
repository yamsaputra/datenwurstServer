import db from '../lib/db.js';
import { httpPost } from '../lib/httpClient.js';

const ML_URL    = process.env.ML_SERVICE_URL || 'http://ml:3002';
const ML_SECRET = process.env.ML_SECRET || '';

export default async function generateForecasts() {
  try {
    const { rows } = await db.query(`
      SELECT
        oi.interval_start, oi.day_of_week, oi.occupancy, oi.is_open,
        oi.is_holiday, oi.is_semester, oi.weather_temp, oi.weather_precip, oi.weather_code,
        LAG(oi.occupancy, 1)   OVER (ORDER BY oi.interval_start) AS lag1,
        LAG(oi.occupancy, 2)   OVER (ORDER BY oi.interval_start) AS lag2,
        LAG(oi.occupancy, 48)  OVER (ORDER BY oi.interval_start) AS lag48,
        LAG(oi.occupancy, 336) OVER (ORDER BY oi.interval_start) AS lag336
      FROM occupancy_intervals oi
      WHERE oi.interval_start >= NOW() - INTERVAL '1 week'
      ORDER BY oi.interval_start DESC
      LIMIT 16
    `);

    if (rows.length < 8) {
      console.log('[forecasts] Not enough history to generate forecasts');
      return;
    }

    const history = [...rows].reverse();
    const res = await httpPost(
      `${ML_URL}/predict`,
      { history, forecastHorizon: 336 },
      { 'X-ML-Secret': ML_SECRET }
    );
    const data = await res.json();
    console.log(`[forecasts] Generated ${data.predictions?.length ?? 0} predictions`);
  } catch (err) {
    console.error('[forecasts] Failed:', err.message);
  }
}
