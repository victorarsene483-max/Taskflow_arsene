import pg from 'pg';

const baseOptions = {
  max: 10, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 5000, 
};

const connectionOptions = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new pg.Pool({ ...baseOptions, ...connectionOptions });

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

export default pool;