import db from '../lib/db.js';

export default async function cleanup() {
  try {
    const { rowCount } = await db.query(
      "DELETE FROM raw_events WHERE event_time < NOW() - INTERVAL '6 months'"
    );
    const { rowCount: wc } = await db.query(
      "DELETE FROM weather_cache WHERE forecast_for < NOW()::DATE - 10"
    );
    console.log(`[cleanup] Deleted ${rowCount} old events, ${wc} old weather rows`);
  } catch (err) {
    console.error('[cleanup] Failed:', err.message);
  }
}
