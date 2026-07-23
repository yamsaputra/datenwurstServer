import db from '../lib/db.js';
import { httpGet } from '../lib/httpClient.js';
import { nowIso } from '../lib/logger.js';

const OPEN_METEO = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com';

export default async function fetchWeather() {
  try {
    // pg already auto-deserializes JSONB into a real JS value -- no
    // JSON.parse needed (a second instance of the exact anti-pattern that
    // silently broke aggregateIntervals.js: JSON.parse on an already-parsed
    // value only "worked" here by accident, since a number's string form
    // happens to still be valid JSON, unlike an array's).
    const { rows } = await db.query("SELECT value FROM config WHERE key = 'library_lat'");
    const { rows: lonRows } = await db.query("SELECT value FROM config WHERE key = 'library_lon'");
    // Fallback coordinates are TH Brandenburg (~52.41N, 12.55E), not the
    // Munich default (48.1372/11.5755) the config table was originally
    // seeded with -- these are only ever used if the config rows are
    // somehow missing entirely.
    const lat = rows[0]?.value    ?? 52.41;
    const lon = lonRows[0]?.value ?? 12.55;

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
        INSERT INTO weather_cache (forecast_for, raw_json, source)
        VALUES ($1, $2, 'forecast')
        ON CONFLICT (forecast_for, source) DO UPDATE SET raw_json = EXCLUDED.raw_json, fetched_at = NOW()
      `, [date, JSON.stringify(hours)]);
    }

    console.log(`[weather][${nowIso()}] Cached ${byDate.size} days of forecast`);
  } catch (err) {
    console.error(`[weather][${nowIso()}] Failed:`, err.message);
  }
}
