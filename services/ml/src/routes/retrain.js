import { Router } from 'express';
import mlAuth from '../middleware/mlAuth.js';
import { trainAndSave } from '../model/trainModel.js';
import { invalidateModel } from '../model/loadModel.js';

const router = Router();

router.post('/', mlAuth, async (req, res, next) => {
  try {
    const { from, to } = req.body || {};
    const result = await trainAndSave(from, to);
    invalidateModel();
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

export default router;
