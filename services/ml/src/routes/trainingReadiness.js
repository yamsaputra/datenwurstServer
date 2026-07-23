import { Router } from 'express';
import mlAuth from '../middleware/mlAuth.js';
import { checkReadiness } from '../services/trainingReadiness.js';

const router = Router();

router.get('/', mlAuth, async (req, res, next) => {
  try {
    res.json(await checkReadiness());
  } catch (err) { next(err); }
});

export default router;
