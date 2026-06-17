import bcrypt from 'bcrypt';
import pg from 'pg';
import { createInterface } from 'readline/promises';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rl   = createInterface({ input: process.stdin, output: process.stdout });

const username = await rl.question('Username: ');
const password = await rl.question('Password: ');
rl.close();

if (!username || password.length < 8) {
  console.error('Username required and password must be at least 8 characters.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
await pool.query(
  'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash',
  [username, hash]
);
console.log(`User "${username}" created/updated.`);
await pool.end();
