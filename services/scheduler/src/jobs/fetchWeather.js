import db from '../lib/db.js';
import { httpGet } from '../lib/httpClient.js';

const OPEN_METEO = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com';

export default async function fetchWeather() {
  try {
    const { rows } = await db.query("SELECT value FROM config WHERE key = 'library_lat'");
    const latRow   = rows[0]?.value;
    const { rows: lonRows } = await db.query("SELECT value FROM config WHERE key = 'library_lon'");
    const lonRow   = lonRows[0]?.value;
    const lat = latRow   ? JSON.parse(latRow)   : 48.1372;
    const lon = lonRow   ? JSON.parse(lonRow)   : 11.5755;

    const url = `${OPEN_METEO}/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,precipitation,weathercode&forecast_days=8&timezone=Europe%2FBerlin`;

    const res  = await httpGet(url);
    const data = await res.json();

    const times  = data.hourly.time;
    const byDate = new Map();
    for (let i = 0; i < times.length; i++) {
      const date = times[i].slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push({
        time:        times[i],
        temperature: data.hourly.temperature_2m[i],
        precip:      data.hourly.precipitation[i],
        code:        data.hourly.weathercode[i],
      });
    }

    for (const [date, hours] of byDate) {
      await db.query(`
        INSERT INTO weather_cache (forecast_for, raw_json)
        VALUES ($1, $2)
        ON CONFLICT (forecast_for) DO UPDATE SET raw_json = EXCLUDED.raw_json, fetched_at = NOW()
      `, [date, JSON.stringify(hours)]);
    }

    console.log(`[weather] Cached ${byDate.size} days of forecast`);
  } catch (err) {
    console.error('[weather] Failed:', err.message);
  }
}
