import pg from 'pg';

// pg returns NUMERIC/DECIMAL columns (e.g. loss_final, mae_final) as strings by
// default to avoid float precision loss; parse them as numbers since this app
// has no need for arbitrary-precision decimals.
pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

export default pool;
