import express from 'express';
import retrainRouter from './routes/retrain.js';
import predictRouter from './routes/predict.js';
import statusRouter  from './routes/status.js';
import trainingReadinessRouter from './routes/trainingReadiness.js';
import errorHandler  from './middleware/errorHandler.js';
import { getActiveModel } from './model/loadModel.js';
import { nowIso } from './lib/logger.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/retrain', retrainRouter);
app.use('/predict', predictRouter);
app.use('/status',  statusRouter);
app.use('/training-readiness', trainingReadinessRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  console.log(`[ml][${nowIso()}] ML service listening on :${PORT}`);
  try {
    const model = await getActiveModel();
    if (model) console.log(`[ml][${nowIso()}] Active model loaded.`);
    else        console.log(`[ml][${nowIso()}] No trained model found — waiting for first retrain.`);
  } catch (err) {
    console.warn(`[ml][${nowIso()}] Could not load model on startup:`, err.message);
  }
});
