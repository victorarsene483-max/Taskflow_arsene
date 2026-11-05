import pg from 'pg';

// On Render, DATABASE_URL holds the full connection string.
// Locally, the separate DB_* variables from .env are used.
const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new pg.Pool(config);

export default pool;