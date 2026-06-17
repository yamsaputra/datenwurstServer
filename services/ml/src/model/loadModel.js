import * as tf from '@tensorflow/tfjs-node';
import pool from '../db.js';

let activeModel = null;
let activeVersionId = null;

export async function getActiveModel() {
  const { rows } = await pool.query(
    'SELECT id, model_path FROM model_versions WHERE is_active = TRUE LIMIT 1'
  );
  if (!rows.length) return null;

  const { id, model_path } = rows[0];
  if (activeVersionId === id) return activeModel;

  console.log(`[ml] Loading model v${id} from ${model_path}`);
  if (activeModel) activeModel.dispose();
  activeModel = await tf.loadLayersModel(`file://${model_path}/model.json`);
  activeVersionId = id;
  return activeModel;
}

export function getActiveVersionId() { return activeVersionId; }

export function invalidateModel() {
  if (activeModel) activeModel.dispose();
  activeModel = null;
  activeVersionId = null;
}
