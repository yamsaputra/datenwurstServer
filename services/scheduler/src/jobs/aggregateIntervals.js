import db from '../lib/db.js';
import { isHoliday } from '../lib/holidays.js';

export default async function aggregateIntervals() {
  try {
    // Close all intervals that ended before now
    const { rows: open } = await db.query(`
      SELECT id, interval_start, interval_end, occupancy
      FROM occupancy_intervals
      WHERE is_open = TRUE AND interval_end < NOW()
      ORDER BY interval_start
    `);

    if (!open.length) return;

    const { rows: config } = await db.query(
      "SELECT value FROM config WHERE key = 'semester_breaks'"
    );
    const semesterBreaks = JSON.parse(config[0]?.value || '[]');
    const { rows: weatherRows } = await db.query(
      'SELECT forecast_for, raw_json FROM weather_cache WHERE forecast_for >= NOW()::DATE - 1'
    );
    const weatherMap = new Map(weatherRows.map(r => [r.forecast_for.toISOString().slice(0, 10), r.raw_json]));

    for (const interval of open) {
      const date    = interval.interval_start.toISOString().slice(0, 10);
      const hour    = interval.interval_start.getUTCHours();
      const holiday = await isHoliday(interval.interval_start);
      const inBreak = isInSemesterBreak(interval.interval_start, semesterBreaks);

      const hourlyWeather = weatherMap.get(date);
      const weatherHour   = Array.isArray(hourlyWeather)
        ? hourlyWeather.find(h => new Date(h.time).getUTCHours() === hour)
        : null;

      await db.query(`
        UPDATE occupancy_intervals SET
          is_open      = FALSE,
          is_holiday   = $1,
          is_semester  = $2,
          weather_temp   = $3,
          weather_precip = $4,
          weather_code   = $5
        WHERE id = $6
      `, [
        holiday,
        !inBreak,
        weatherHour?.temperature ?? null,
        weatherHour?.precip      ?? null,
        weatherHour?.code        ?? null,
        interval.id,
      ]);
    }

    console.log(`[aggregate] Closed ${open.length} intervals`);
  } catch (err) {
    console.error('[aggregate] Failed:', err.message);
  }
}

function isInSemesterBreak(date, breaks) {
  const d = new Date(date);
  return breaks.some(b => d >= new Date(b.from) && d <= new Date(b.to));
}
