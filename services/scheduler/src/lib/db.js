import pg from 'pg';

// pg returns NUMERIC/DECIMAL columns (e.g. weather_temp, weather_precip) as
// strings by default to avoid float precision loss; parse them as numbers
// since this app has no need for arbitrary-precision decimals.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value === null ? null : parseFloat(value)));

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('DB error:', err.message));

export default pool;
