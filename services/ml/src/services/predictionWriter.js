import pool from '../db.js';

export async function writePredictions(predictions, modelVersionId, source = 'lstm') {
  if (!predictions.length) return;
  const values = predictions.map((p, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
  const params = predictions.flatMap(p => [p.target_interval, p.predicted_occ, modelVersionId, source]);
  await pool.query(`
    INSERT INTO forecasts (target_interval, predicted_occ, model_version, source)
    VALUES ${values}
    ON CONFLICT (target_interval, model_version) DO UPDATE SET
      predicted_occ = EXCLUDED.predicted_occ,
      generated_at  = NOW(),
      source        = EXCLUDED.source
  `, params);
}
