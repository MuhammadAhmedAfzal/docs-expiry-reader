import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { User } from './models/User.js';
import { startExpiryScheduler } from './services/notifications.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import documentRoutes from './routes/documents.js';
import importRoutes from './routes/import.js';
import taskRoutes from './routes/tasks.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/import', importRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', notFound);

// In production, serve the built React app from the same server.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.use(errorHandler);

async function ensureAdminExists() {
  if (await User.exists({})) return;
  await User.create({ ...config.admin, role: 'admin' });
  console.log(`Created first admin account: ${config.admin.email} / ${config.admin.password} (change this password)`);
}

async function start() {
  await connectDatabase();
  await ensureAdminExists();
  startExpiryScheduler();
  app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
