import { httpPost } from '../lib/httpClient.js';

const ML_URL    = process.env.ML_SERVICE_URL || 'http://ml:3002';
const ML_SECRET = process.env.ML_SECRET || '';

export default async function monthlyRetrain() {
  try {
    console.log('[retrain] Starting monthly model retraining...');
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const to   = new Date().toISOString();

    const res  = await httpPost(`${ML_URL}/retrain`, { from, to }, { 'X-ML-Secret': ML_SECRET });
    const data = await res.json();
    console.log(`[retrain] Completed — model v${data.version_id}, MAE: ${data.mae_final}`);
  } catch (err) {
    console.error('[retrain] Failed:', err.message);
  }
}
