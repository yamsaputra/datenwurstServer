import pool from '../db.js';

// Mirror of services/api/src/services/config.js. Duplicating these two
// small queries rather than depending on the api service keeps the two
// services' Docker builds independent, at negligible drift risk.
export async function getConfigValue(key) {
  const { rows } = await pool.query('SELECT value FROM config WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function setConfigValue(key, value) {
  await pool.query(`
    INSERT INTO config (key, value) VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [key, JSON.stringify(value)]);
}
