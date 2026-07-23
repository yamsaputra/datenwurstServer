import { Router } from 'express';
import pool from '../db.js';
import mlAuth from '../middleware/mlAuth.js';
import { getIsTraining } from '../model/trainModel.js';
import { getActiveVersionId } from '../model/loadModel.js';

const router = Router();

router.get('/', mlAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, created_at, train_from, train_to, epochs, loss_final, mae_final, is_active,
             status, valid_windows, holdout_mae, baseline_mae, skip_reason, feature_count
      FROM model_versions WHERE model_path != '__baseline__' ORDER BY created_at DESC LIMIT 5
    `);
    res.json({
      is_training:    getIsTraining(),
      active_version: getActiveVersionId(),
      versions:       rows,
    });
  } catch (err) { next(err); }
});

export default router;
