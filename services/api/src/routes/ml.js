import { Router } from 'express';
import jwtAuth from '../middleware/jwtAuth.js';
import { triggerRetrain, triggerForecast, getStatus } from '../services/mlClient.js';

const router = Router();
router.use(jwtAuth);

router.post('/retrain', async (req, res, next) => {
  try {
    const { from, to } = req.body || {};
    const result = await triggerRetrain(from, to);
    // The new version invalidates the old one's forecasts — regenerate right
    // away instead of leaving a gap until the next scheduler run.
    let forecasts_generated = 0;
    try {
      forecasts_generated = (await triggerForecast()).count ?? 0;
    } catch (err) {
      console.warn('[ml] Post-retrain forecast generation failed:', err.message);
    }
    res.json({ ...result, forecasts_generated });
  } catch (err) { next(err); }
});

router.post('/forecast', async (req, res, next) => {
  try {
    const { count, model_version } = await triggerForecast();
    res.json({ ok: true, count, model_version });
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    res.json(await getStatus());
  } catch (err) { next(err); }
});

export default router;
