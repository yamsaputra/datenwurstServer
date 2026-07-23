import { Router } from 'express';
import * as tf from '@tensorflow/tfjs-node';
import mlAuth from '../middleware/mlAuth.js';
import { getActiveModel, getActiveVersionId } from '../model/loadModel.js';
import { encodeFeatures, computeStats } from '../model/featureEncoder.js';
import { writePredictions } from '../services/predictionWriter.js';
import { loadRecentHistory, loadRows } from '../services/dataLoader.js';
import { generateBaselineForecast } from '../services/seasonalBaseline.js';
import { LOOKBACK, HORIZON } from '../model/buildModel.js';

const router = Router();

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const berlinWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' });
const berlinDayOfWeek = (date) => WEEKDAY_INDEX[berlinWeekday.format(date)];

const SLOT_MS = 30 * 60 * 1000;

// Phase 6.4: all 5 complete 336-step runs on record produced days 2-7
// byte-identical to day 1 across 4 different model versions -- confirmed
// fixed-point convergence, not "similar", identical. Cap publishing at this
// many steps (12 hours, the remainder of a typical opening day); the widget's
// 7-day view is served from the seasonal baseline instead (below), labeled
// "typical for this time", never as a model prediction.
const MAX_LSTM_HORIZON_STEPS = 24;

// Phase 6.3: the autoregressive loop used to anchor on the last available
// DB row, not now -- once ingestion stalled, it silently kept re-predicting
// the same dead week for 13 days with nothing noticing. Refuse instead.
const STALENESS_MS = 2 * 60 * 60 * 1000;

router.post('/', mlAuth, async (req, res, next) => {
  try {
    let { history, forecastHorizon = MAX_LSTM_HORIZON_STEPS } = req.body || {};
    if (!Array.isArray(history) || history.length === 0) {
      history = await loadRecentHistory(LOOKBACK * 2);
    }
    if (history.length < LOOKBACK) {
      return res.status(400).json({ error: `Need at least ${LOOKBACK} history rows` });
    }

    const anchor = new Date(history[history.length - 1].interval_start);
    if (Date.now() - anchor.getTime() > STALENESS_MS) {
      return res.json({
        active_source: 'collecting_data',
        reason: `Seed data is stale (anchored at ${anchor.toISOString()}) -- refusing to publish a forecast computed from it`,
        count: 0, predictions: [],
      });
    }

    const sensorConfigId = history[history.length - 1].sensor_config_id;

    // Backs the widget's 7-day view regardless of whether an LSTM ends up
    // active below -- always refreshed alongside, at negligible cost.
    const baselineResult = sensorConfigId
      ? await generateBaselineForecast({ sensorConfigId, anchor, horizonSteps: 336 })
      : { written: 0 };

    const model = await getActiveModel();
    if (!model) {
      return res.json({
        active_source: baselineResult.written ? 'baseline' : 'collecting_data',
        count: baselineResult.written, model_version: null,
      });
    }

    const horizonSteps = Math.min(forecastHorizon, MAX_LSTM_HORIZON_STEPS);
    const stats = computeStats(history);
    const predictions = [];
    const buffer = [...history.slice(-LOOKBACK)];

    // Bulk-fetch real historical occupancy once, covering everything a
    // 12h-capped horizon could ever need for lag48/lag336. At this horizon
    // both always reference genuinely-past, already-observed data -- never
    // a synthesized future value -- unlike the old 336-step loop, which
    // hardcoded both to null for the entire chain (zeroing out both
    // seasonal lag features across the whole autoregressive horizon).
    const lagLookupFrom = new Date(anchor.getTime() - (336 + horizonSteps) * SLOT_MS);
    const lagLookupTo = new Date(anchor.getTime() + horizonSteps * SLOT_MS);
    const lagRows = await loadRows(lagLookupFrom, lagLookupTo);
    const occupancyByTime = new Map(lagRows.map(r => [new Date(r.interval_start).getTime(), r.occupancy]));
    const realLag = (targetTimeMs, stepsBack) => occupancyByTime.get(targetTimeMs - stepsBack * SLOT_MS) ?? null;

    while (predictions.length < horizonSteps) {
      const window = buffer.slice(-LOOKBACK).map(r => encodeFeatures(r, stats));
      const xTensor = tf.tensor3d([window]);
      const yTensor = model.predict(xTensor);
      const output = await yTensor.array();
      tf.dispose([xTensor, yTensor]);

      const take = Math.min(HORIZON, horizonSteps - predictions.length);
      for (let h = 0; h < take; h++) {
        const prev = buffer[buffer.length - 1];
        const target = new Date(new Date(prev.interval_start).getTime() + SLOT_MS);
        const predicted_occ = Math.max(0, Math.round(output[0][h]));

        predictions.push({ target_interval: target.toISOString(), predicted_occ });

        buffer.push({
          ...prev,
          interval_start: target.toISOString(),
          day_of_week: berlinDayOfWeek(target),
          occupancy: predicted_occ,
          lag1: prev.occupancy,
          lag2: buffer.length >= 2 ? buffer[buffer.length - 2].occupancy : 0,
          lag48: realLag(target.getTime(), 48),
          lag336: realLag(target.getTime(), 336),
        });
        if (buffer.length > LOOKBACK) buffer.shift();
      }
    }

    const versionId = getActiveVersionId();
    if (versionId) await writePredictions(predictions, versionId, 'lstm');

    res.json({ active_source: 'lstm', count: predictions.length, model_version: versionId, predictions });
  } catch (err) { next(err); }
});

export default router;
