import { Router } from 'express';
import jwtAuth from '../middleware/jwtAuth.js';
import { triggerRetrain, getStatus } from '../services/mlClient.js';

const router = Router();
router.use(jwtAuth);

router.post('/retrain', async (req, res, next) => {
  try {
    const { from, to } = req.body || {};
    const result = await triggerRetrain(from, to);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    res.json(await getStatus());
  } catch (err) { next(err); }
});

export default router;
