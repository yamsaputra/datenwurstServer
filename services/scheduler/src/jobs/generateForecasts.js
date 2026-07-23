import { httpPost } from '../lib/httpClient.js';
import { nowIso } from '../lib/logger.js';

const ML_URL    = process.env.ML_SERVICE_URL || 'http://ml:3002';
const ML_SECRET = process.env.ML_SECRET || '';

export default async function generateForecasts() {
  try {
    // Empty body — the ML service seeds the prediction from its own DB history
    const res  = await httpPost(`${ML_URL}/predict`, {}, { 'X-ML-Secret': ML_SECRET });
    const data = await res.json();
    console.log(`[forecasts][${nowIso()}] Generated ${data.count ?? 0} predictions (model v${data.model_version})`);
  } catch (err) {
    console.error(`[forecasts][${nowIso()}] Failed:`, err.message);
  }
}
