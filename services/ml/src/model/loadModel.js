import * as tf from '@tensorflow/tfjs-node';
import pool from '../db.js';
import { FEATURES } from './buildModel.js';
import { nowIso } from '../lib/logger.js';

let activeModel = null;
let activeVersionId = null;

// Returns null (never throws) when no model is safely loadable -- callers
// must fall back to the seasonal baseline rather than crash. A model becomes
// unloadable the moment FEATURES changes (e.g. is_semester replaced by the
// lecture/exam/break one-hot, 18->20): its saved weights still load fine
// (the shape is baked into the file itself), but encoding a FEATURES-length
// vector against a model trained on a different input width would throw a
// tensor shape mismatch inside tf.predict() instead of degrading cleanly.
// Existing pre-migration rows have feature_count=NULL (never backfilled --
// see 009_model_versions_metrics.sql), which correctly never matches
// FEATURES and is rejected the same way.
export async function getActiveModel() {
  const { rows } = await pool.query(
    'SELECT id, model_path, feature_count FROM model_versions WHERE is_active = TRUE LIMIT 1'
  );
  if (!rows.length) return null;

  const { id, model_path, feature_count } = rows[0];
  if (feature_count !== FEATURES) {
    console.warn(`[ml][${nowIso()}] Active model v${id} has feature_count=${feature_count}, live encoder produces ${FEATURES} -- refusing to load`);
    invalidateModel();
    return null;
  }

  if (activeVersionId === id) return activeModel;

  console.log(`[ml][${nowIso()}] Loading model v${id} from ${model_path}`);
  if (activeModel) activeModel.dispose();
  try {
    activeModel = await tf.loadLayersModel(`file://${model_path}/model.json`);
  } catch (err) {
    console.error(`[ml][${nowIso()}] Failed to load model v${id} from ${model_path}:`, err.message);
    activeModel = null;
    activeVersionId = null;
    return null;
  }
  activeVersionId = id;
  return activeModel;
}

export function getActiveVersionId() { return activeVersionId; }

export function invalidateModel() {
  if (activeModel) activeModel.dispose();
  activeModel = null;
  activeVersionId = null;
}
