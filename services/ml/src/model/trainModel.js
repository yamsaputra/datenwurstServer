import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import pool from '../db.js';
import { buildModel } from './buildModel.js';
import { loadTrainingData } from '../services/dataLoader.js';

const MODEL_STORE = process.env.MODEL_STORE_PATH || '/app/models';

let isTraining = false;

export function getIsTraining() { return isTraining; }

export async function trainAndSave(from, to) {
  if (isTraining) throw Object.assign(new Error('Training already in progress'), { status: 409 });
  isTraining = true;

  try {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toDate   = to   ? new Date(to)   : new Date();

    console.log(`[ml] Loading training data ${fromDate.toISOString()} → ${toDate.toISOString()}`);
    const data = await loadTrainingData(fromDate, toDate);
    if (!data) throw Object.assign(new Error('Not enough data to train (need at least 24 rows)'), { status: 400 });

    const { X, y, stats } = data;
    console.log(`[ml] Training on ${X.length} windows`);

    const xTensor = tf.tensor3d(X);
    const yTensor = tf.tensor2d(y);

    const model = buildModel();
    const history = await model.fit(xTensor, yTensor, {
      epochs:          50,
      batchSize:       32,
      validationSplit: 0.1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if ((epoch + 1) % 10 === 0)
            console.log(`  epoch ${epoch + 1}/50 — loss: ${logs.loss?.toFixed(4)}  mae: ${logs.mae?.toFixed(4)}`);
        },
      },
    });

    tf.dispose([xTensor, yTensor]);

    const lastEpoch = history.history;
    const loss_final = lastEpoch.loss?.at(-1) ?? null;
    const mae_final  = lastEpoch.mae?.at(-1)  ?? null;

    // Insert version row to get ID
    const { rows } = await pool.query(`
      INSERT INTO model_versions (train_from, train_to, epochs, loss_final, mae_final, model_path, is_active)
      VALUES ($1, $2, $3, $4, $5, 'pending', FALSE)
      RETURNING id
    `, [fromDate, toDate, 50, loss_final, mae_final]);
    const versionId = rows[0].id;

    const modelPath = path.join(MODEL_STORE, `v${versionId}`);
    await model.save(`file://${modelPath}`);

    // Deactivate previous active model, activate new one
    await pool.query('UPDATE model_versions SET is_active = FALSE WHERE is_active = TRUE');
    await pool.query(`
      UPDATE model_versions SET model_path = $1, is_active = TRUE WHERE id = $2
    `, [modelPath, versionId]);

    model.dispose();

    console.log(`[ml] Model v${versionId} saved to ${modelPath}`);
    return { version_id: versionId, loss_final, mae_final, model_path: modelPath };
  } finally {
    isTraining = false;
  }
}
