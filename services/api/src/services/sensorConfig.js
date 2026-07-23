import pool from '../db.js';

export class NoActiveSensorConfigError extends Error {
  constructor() {
    super('No sensor_configs row is marked is_active -- refusing to attribute new ' +
      'ingest data to an unknown sensor configuration. Run activateSensorConfig.js after ' +
      'the sensor is (re)installed.');
    this.name = 'NoActiveSensorConfigError';
  }
}

let cachedId = null;

// Cached in-process since this changes at most once every few months (a
// physical remount), never per-request -- but never defaulted or guessed:
// if nothing is active yet, ingest for a device that hasn't been formally
// activated should fail loudly, not silently attribute data to the pilot
// configuration.
export async function getActiveSensorConfigId() {
  if (cachedId !== null) return cachedId;
  const { rows } = await pool.query('SELECT id FROM sensor_configs WHERE is_active = TRUE LIMIT 1');
  if (!rows.length) throw new NoActiveSensorConfigError();
  cachedId = rows[0].id;
  return cachedId;
}

export function invalidateActiveSensorConfigCache() {
  cachedId = null;
}
