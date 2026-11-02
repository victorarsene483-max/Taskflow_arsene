import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './Routes/authRoute.js';
import projectRoutes from './Routes/projectRoute.js';
import taskRoutes from './Routes/taskRoute.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

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