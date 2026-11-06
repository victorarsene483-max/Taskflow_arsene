import pool from './src/db/index.js';
import app from './src/app.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('JWT_SECRET is missing or too short. Set it in .env (at least 32 characters).');
  process.exit(1);
}

const PORT = process.env.PORT || 9777;

async function start() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('PostgreSQL connected. Server time:', result.rows[0].now);
  } catch (err) {
    console.error('DATABASE_URL set:', Boolean(process.env.DATABASE_URL));
    console.error('Database connection failed:', err.code, err.message);
    // Node 20+ reports a refused connection as an AggregateError whose message is blank
    if (err.errors) {
      err.errors.forEach((e) => console.error(' -', e.code, e.address, e.port));
    }
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server has started on: http://localhost:${PORT}`);
  });
}

start();