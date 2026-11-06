import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import authRoutes from './Routes/authRoute.js';
import projectRoutes from './Routes/projectRoute.js';
import taskRoutes from './Routes/taskRoute.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
//Render sitting behind a proxy
app.set('trust proxy',1);
//Security headers:off for now since html has vanilla javascript in it.
app.use(helmet({contentSecurityPolicy: false}));
//Reject oversized request bodies
app.use(express.json({limit:'10kb'}));
//Slow down password guesssing and sign up spam.Skipped in tests so they can log in freely
if(process.env.NODE_ENV !== 'test'){
  app.use(
    ['/api/auth/login','api/auth/register'],
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit : 20,
      standardHeaders :'draft-7',
      legacyHeaders: false,
      message:{error:'Too many attempts.Please try again later.'}
    }),
  );
}

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// public/ lives in the project root, one level above src/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Unknown API routes return JSON instead of an HTML error page
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Malformed JSON bodies and any other uncaught errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;