import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import pool from '../db.js';
import { buildModel, FEATURES } from './buildModel.js';
import { loadRows, buildWindows, computeStats } from '../services/dataLoader.js';
import { splitByDayBoundary, InsufficientHoldoutError } from '../services/holdoutSplit.js';
import { computeBaselines } from '../services/baselines.js';
import { buildSeasonalProfileFromRows } from '../services/seasonalBaseline.js';
import { createEarlyStopping } from '../services/earlyStopping.js';
import { getConfigValue, setConfigValue } from '../services/config.js';
import { nowIso } from '../lib/logger.js';

const MODEL_STORE = process.env.MODEL_STORE_PATH || '/app/models';
const MAX_LAG_STEPS = 336; // must match the largest lag feature (lag336)
const MAX_EPOCHS = 200;
const BATCH_SIZE = 32;

let isTraining = false;
export function getIsTraining() { return isTraining; }

async function writeModelVersionRow(f) {
  const { rows } = await pool.query(`
    INSERT INTO model_versions
      (train_from, train_to, epochs, loss_final, mae_final, model_path, is_active,
       status, valid_windows, holdout_mae, baseline_mae, skip_reason, feature_count, sensor_config_ids)
    VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `, [
    f.trainFrom, f.trainTo, f.epochs ?? null, f.lossFinal ?? null, f.maeFinal ?? null,
    f.modelPath ?? 'pending', f.status, f.validWindows ?? null, f.holdoutMae ?? null,
    f.baselineMae ?? null, f.skipReason ?? null, f.featureCount ?? null, f.sensorConfigIds ?? null,
  ]);
  return rows[0].id;
}

// seasonal-mean baseline evaluated on the SAME hold-out as the LSTM (fit
// from training rows only) -- this is the promotion gate, per the
// correctness-overhaul plan's Phase 5.4/6.5: "seasonal mean -- this is the
// promotion gate", not persistence/lag336/median, which are stored purely
// for reference alongside it.
function seasonalBaselineMae(trainingRows, holdoutRows) {
  const profile = buildSeasonalProfileFromRows(trainingRows);
  const berlinParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  });
  const errors = [];
  for (const r of holdoutRows) {
    if (r.occupancy === null || r.occupancy === undefined) continue;
    const p = Object.fromEntries(berlinParts.formatToParts(new Date(r.interval_start)).map(x => [x.type, x.value]));
    const predicted = profile.forSlot(r.day_of_week, Number(p.hour), Number(p.minute));
    errors.push(Math.abs(r.occupancy - predicted));
  }
  return errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null;
}

export async function trainAndSave(from, to) {
  if (isTraining) throw Object.assign(new Error('Training already in progress'), { status: 409 });
  isTraining = true;

  try {
    const rows = await loadRows(from, to);
    const fallbackFrom = rows[0]?.interval_start ?? new Date();
    const fallbackTo = rows.at(-1)?.interval_start ?? new Date();

    let split;
    try {
      split = splitByDayBoundary(rows, { maxLagSteps: MAX_LAG_STEPS });
    } catch (err) {
      if (err instanceof InsufficientHoldoutError) {
        const versionId = await writeModelVersionRow({
          trainFrom: fallbackFrom, trainTo: fallbackTo, status: 'skipped',
          validWindows: 0, skipReason: err.message, featureCount: FEATURES,
        });
        console.log(`[ml][${nowIso()}] Training skipped (v${versionId}): ${err.message}`);
        return { status: 'skipped', version_id: versionId, skip_reason: err.message };
      }
      throw err;
    }

    const { trainingRows, holdoutRows, holdoutDays } = split;
    const sensorConfigIds = [...new Set(trainingRows.map(r => r.sensor_config_id))];
    const trainFrom = trainingRows[0]?.interval_start ?? fallbackFrom;
    const trainTo = trainingRows.at(-1)?.interval_start ?? fallbackTo;

    const stats = computeStats(trainingRows);
    const { X, y, validWindowCount } = buildWindows(trainingRows, stats);
    const { X: holdoutX, y: holdoutY } = buildWindows(holdoutRows, stats);

    const minWindows = Number((await getConfigValue('ml.min_training_windows')) ?? 2000);
    if (validWindowCount < minWindows) {
      const skipReason = `Only ${validWindowCount} valid contiguous training window(s) available, need at least ${minWindows}.`;
      const versionId = await writeModelVersionRow({
        trainFrom, trainTo, status: 'skipped', validWindows: validWindowCount,
        skipReason, featureCount: FEATURES, sensorConfigIds,
      });
      console.log(`[ml][${nowIso()}] Training skipped (v${versionId}): ${skipReason}`);
      return { status: 'skipped', version_id: versionId, skip_reason: skipReason, valid_windows: validWindowCount };
    }
    if (!holdoutX.length) {
      const skipReason = `Hold-out spans ${holdoutDays.length} day(s) but produced 0 valid contiguous windows (gaps in the hold-out period).`;
      const versionId = await writeModelVersionRow({
        trainFrom, trainTo, status: 'skipped', validWindows: validWindowCount,
        skipReason, featureCount: FEATURES, sensorConfigIds,
      });
      console.log(`[ml][${nowIso()}] Training skipped (v${versionId}): ${skipReason}`);
      return { status: 'skipped', version_id: versionId, skip_reason: skipReason, valid_windows: validWindowCount };
    }

    console.log(`[ml][${nowIso()}] Training on ${X.length} windows (hold-out: ${holdoutX.length} windows across ${holdoutDays.length} days)`);

    const baselines = computeBaselines(holdoutRows, trainingRows);
    const baselineMae = seasonalBaselineMae(trainingRows, holdoutRows);
    console.log(`[ml][${nowIso()}] Hold-out baselines -- persistence: ${baselines.persistenceMae?.toFixed(3)}, ` +
      `same-slot-last-week: ${baselines.sameSlotLastWeekMae?.toFixed(3) ?? 'n/a'}, ` +
      `constant median: ${baselines.constantMedianMae?.toFixed(3)}, seasonal mean (gate): ${baselineMae?.toFixed(3)}`);

    const xTensor = tf.tensor3d(X);
    const yTensor = tf.tensor2d(y);
    const holdoutXTensor = tf.tensor3d(holdoutX);
    const holdoutYTensor = tf.tensor2d(holdoutY);

    const model = buildModel();
    const earlyStopping = createEarlyStopping(model, { monitor: 'val_mae', patience: 10, minDelta: 0.05 });

    const history = await model.fit(xTensor, yTensor, {
      epochs: MAX_EPOCHS,
      batchSize: BATCH_SIZE,
      validationData: [holdoutXTensor, holdoutYTensor],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if ((epoch + 1) % 10 === 0 || epoch === 0) {
            console.log(`[ml][${nowIso()}]   epoch ${epoch + 1} -- loss: ${logs.loss?.toFixed(4)}  mae: ${logs.mae?.toFixed(4)}  val_mae: ${logs.val_mae?.toFixed(4)}`);
          }
          return earlyStopping.callbacks.onEpochEnd(epoch, logs);
        },
      },
    });

    earlyStopping.restoreBest();
    const stoppingEpoch = earlyStopping.getStoppedEpoch() ?? (history.history.loss.length - 1);
    const holdoutMae = earlyStopping.getBestValue();

    tf.dispose([xTensor, yTensor, holdoutXTensor, holdoutYTensor]);

    const lossFinal = history.history.loss?.at(-1) ?? null;
    const maeFinal = history.history.mae?.at(-1) ?? null;

    // Promotion gate: the whole reason this exists. Evidence: six
    // consecutive models were promoted unconditionally, none of which beat
    // a constant predictor.
    const promoted = baselineMae !== null && holdoutMae !== null && holdoutMae < baselineMae;
    const status = promoted ? 'active' : 'rejected';

    const versionId = await writeModelVersionRow({
      trainFrom, trainTo, epochs: stoppingEpoch + 1, lossFinal, maeFinal, status,
      validWindows: validWindowCount, holdoutMae, baselineMae,
      featureCount: FEATURES, sensorConfigIds,
    });

    let modelPath = null;
    if (promoted) {
      modelPath = path.join(MODEL_STORE, `v${versionId}`);
      await model.save(`file://${modelPath}`);
      await pool.query('UPDATE model_versions SET is_active = FALSE WHERE is_active = TRUE');
      await pool.query('UPDATE model_versions SET model_path = $1, is_active = TRUE WHERE id = $2', [modelPath, versionId]);
      console.log(`[ml][${nowIso()}] Model v${versionId} PROMOTED (holdout_mae=${holdoutMae.toFixed(3)} < baseline_mae=${baselineMae.toFixed(3)}), saved to ${modelPath}`);
    } else {
      console.log(`[ml][${nowIso()}] Model v${versionId} REJECTED (holdout_mae=${holdoutMae?.toFixed(3) ?? 'n/a'} did not beat baseline_mae=${baselineMae?.toFixed(3) ?? 'n/a'}) -- serving continues from baseline/previous active model`);
    }

    model.dispose();

    return {
      status, version_id: versionId, loss_final: lossFinal, mae_final: maeFinal,
      holdout_mae: holdoutMae, baseline_mae: baselineMae, model_path: modelPath,
      valid_windows: validWindowCount,
    };
  } finally {
    isTraining = false;
    // Any attempt (skipped/rejected/active alike) means the data that was
    // "ready" has now been consumed by a real training run -- clear the
    // notification flag so checkTrainingReadiness.js can notify again once
    // enough *new* data accumulates, rather than staying silent forever
    // after the first notification.
    try {
      await setConfigValue('ml.readiness_notified', false);
    } catch (err) {
      console.error(`[ml][${nowIso()}] Failed to reset ml.readiness_notified:`, err.message);
    }
  }
}
