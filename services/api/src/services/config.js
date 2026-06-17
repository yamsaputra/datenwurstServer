import pool from '../db.js';

export async function getConfig() {
  const { rows } = await pool.query('SELECT key, value FROM config');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

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
