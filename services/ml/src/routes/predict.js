import { Router } from 'express';
import * as tf from '@tensorflow/tfjs-node';
import mlAuth from '../middleware/mlAuth.js';
import { getActiveModel, getActiveVersionId } from '../model/loadModel.js';
import { encodeFeatures, computeStats } from '../model/featureEncoder.js';
import { writePredictions } from '../services/predictionWriter.js';
import { loadRecentHistory } from '../services/dataLoader.js';
import { LOOKBACK, HORIZON } from '../model/buildModel.js';

const router = Router();

// day_of_week in the DB is Berlin-local ISO weekday minus one (0=Mon…6=Sun)
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const berlinWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' });
const berlinDayOfWeek = (date) => WEEKDAY_INDEX[berlinWeekday.format(date)];

router.post('/', mlAuth, async (req, res, next) => {
  try {
    const model = await getActiveModel();
    if (!model) return res.status(503).json({ error: 'No trained model available' });

    let { history, forecastHorizon = 336 } = req.body || {};
    if (!Array.isArray(history) || history.length === 0) {
      history = await loadRecentHistory(LOOKBACK * 2);
    }
    if (history.length < LOOKBACK) {
      return res.status(400).json({ error: `Need at least ${LOOKBACK} history rows` });
    }

    const stats = computeStats(history);
    const predictions = [];

    // Autoregressive generation: predict HORIZON steps, feed them back as
    // input, repeat. Each step advances exactly one 30-min interval, so
    // targets are consecutive and unique.
    const buffer = [...history.slice(-LOOKBACK)];

    while (predictions.length < forecastHorizon) {
      const window  = buffer.slice(-LOOKBACK).map(r => encodeFeatures(r, stats));
      const xTensor = tf.tensor3d([window]);
      const yTensor = model.predict(xTensor);
      const output  = await yTensor.array();
      tf.dispose([xTensor, yTensor]);

      const take = Math.min(HORIZON, forecastHorizon - predictions.length);
      for (let h = 0; h < take; h++) {
        const prev   = buffer[buffer.length - 1];
        const target = new Date(new Date(prev.interval_start).getTime() + 30 * 60 * 1000);
        const predicted_occ = Math.max(0, Math.round(output[0][h]));

        predictions.push({ target_interval: target.toISOString(), predicted_occ });

        buffer.push({
          ...prev,
          interval_start: target.toISOString(),
          day_of_week: berlinDayOfWeek(target),
          occupancy: predicted_occ,
          lag1: prev.occupancy,
          lag2: buffer.length >= 2 ? buffer[buffer.length - 2].occupancy : 0,
          lag48:  null,
          lag336: null,
        });
        if (buffer.length > LOOKBACK) buffer.shift();
      }
    }

    const versionId = getActiveVersionId();
    if (versionId) await writePredictions(predictions, versionId);

    res.json({ count: predictions.length, model_version: versionId, predictions });
  } catch (err) { next(err); }
});

export default router;
