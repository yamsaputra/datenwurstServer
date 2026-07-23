import { httpPost } from '../lib/httpClient.js';
import generateForecasts from './generateForecasts.js';
import { nowIso } from '../lib/logger.js';

const ML_URL    = process.env.ML_SERVICE_URL || 'http://ml:3002';
const ML_SECRET = process.env.ML_SECRET || '';

export default async function monthlyRetrain() {
  try {
    console.log(`[retrain][${nowIso()}] Starting monthly model retraining...`);
    // This is only an upper bound on how far back to query -- trainModel.js
    // itself gates on valid contiguous windows, not elapsed time, and writes
    // the real queried range to train_from/train_to. Every prior model
    // registry row claimed exactly 365 days regardless of actual coverage;
    // that hardcoding lived in trainModel.js, not here, and is now fixed.
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const to   = new Date().toISOString();

    const res  = await httpPost(`${ML_URL}/retrain`, { from, to }, { 'X-ML-Secret': ML_SECRET });
    const data = await res.json();

    switch (data.status) {
      case 'active':
        console.log(`[retrain][${nowIso()}] Model v${data.version_id} PROMOTED -- holdout_mae ${data.holdout_mae?.toFixed(3)} < baseline_mae ${data.baseline_mae?.toFixed(3)}`);
        break;
      case 'rejected':
        console.log(`[retrain][${nowIso()}] Model v${data.version_id} REJECTED -- holdout_mae ${data.holdout_mae?.toFixed(3) ?? 'n/a'} did not beat baseline_mae ${data.baseline_mae?.toFixed(3) ?? 'n/a'}. Serving continues unchanged.`);
        break;
      case 'skipped':
        console.log(`[retrain][${nowIso()}] Skipped (v${data.version_id}): ${data.skip_reason}`);
        break;
      default:
        console.log(`[retrain][${nowIso()}] Completed with unexpected status "${data.status}":`, data);
    }

    // Only worth regenerating right away if something might actually have
    // changed -- a skipped or rejected run leaves serving exactly as it was.
    if (data.status === 'active') await generateForecasts();
  } catch (err) {
    console.error(`[retrain][${nowIso()}] Failed:`, err.message);
  }
}
