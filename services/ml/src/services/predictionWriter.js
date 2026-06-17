import pool from '../db.js';

export async function writePredictions(predictions, modelVersionId) {
  if (!predictions.length) return;
  const values = predictions.map((p, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
  const params = predictions.flatMap(p => [p.target_interval, p.predicted_occ, modelVersionId]);
  await pool.query(`
    INSERT INTO forecasts (target_interval, predicted_occ, model_version)
    VALUES ${values}
    ON CONFLICT (target_interval, model_version) DO UPDATE SET
      predicted_occ = EXCLUDED.predicted_occ,
      generated_at  = NOW()
  `, params);
}
