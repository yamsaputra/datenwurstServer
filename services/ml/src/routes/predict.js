import { Router } from 'express';
import * as tf from '@tensorflow/tfjs-node';
import mlAuth from '../middleware/mlAuth.js';
import { getActiveModel, getActiveVersionId } from '../model/loadModel.js';
import { encodeFeatures, computeStats } from '../model/featureEncoder.js';
import { writePredictions } from '../services/predictionWriter.js';
import { LOOKBACK, HORIZON } from '../model/buildModel.js';

const router = Router();

router.post('/', mlAuth, async (req, res, next) => {
  try {
    const model = await getActiveModel();
    if (!model) return res.status(503).json({ error: 'No trained model available' });

    const { history, forecastHorizon = 336 } = req.body || {};
    if (!Array.isArray(history) || history.length < LOOKBACK) {
      return res.status(400).json({ error: `Need at least ${LOOKBACK} history rows` });
    }

    const stats = computeStats(history);
    const predictions = [];

    // Autoregressive generation
    const buffer = [...history.slice(-LOOKBACK)];

    for (let step = 0; step < forecastHorizon; step++) {
      const window  = buffer.slice(-LOOKBACK).map(r => encodeFeatures(r, stats));
      const xTensor = tf.tensor3d([window]);
      const yTensor = model.predict(xTensor);
      const output  = await yTensor.array();
      tf.dispose([xTensor, yTensor]);

      for (let h = 0; h < Math.min(HORIZON, forecastHorizon - step); h++) {
        const lastInterval = new Date(buffer[buffer.length - 1].interval_start);
        const target = new Date(lastInterval.getTime() + (h + 1) * 30 * 60 * 1000);
        const predicted_occ = Math.max(0, Math.round(output[0][h]));

        predictions.push({ target_interval: target.toISOString(), predicted_occ });

        if (h === 0) {
          const newRow = {
            ...buffer[buffer.length - 1],
            interval_start: target.toISOString(),
            occupancy: predicted_occ,
            lag1: buffer[buffer.length - 1].occupancy,
            lag2: buffer.length >= 2 ? buffer[buffer.length - 2].occupancy : 0,
            lag48:  null,
            lag336: null,
          };
          buffer.push(newRow);
          if (buffer.length > LOOKBACK + HORIZON) buffer.shift();
        }
      }
      step += HORIZON - 1;
    }

    const versionId = getActiveVersionId();
    if (versionId) await writePredictions(predictions, versionId);

    res.json({ predictions, model_version: versionId });
  } catch (err) { next(err); }
});

export default router;
