import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from './types/socketEvents';
import mongoose from 'mongoose';
import { setupSocketHandlers } from './socketHandlers';
import { gameManager } from './managers/GameManager';
import { setupAuthRoutes } from './routes/auth';

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes
setupAuthRoutes(app);

const server = http.createServer(app);
const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(server, { cors: { origin: '*' } });

// Socket handlers
setupSocketHandlers(io);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 2827;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemmo_refactor';

mongoose.connect(MONGODB_URI).then(() => {
  console.log('[server_ts] connected to MongoDB', MONGODB_URI);
  // enable persistence in game manager now that DB is connected
  try { gameManager.setPersistPositions(true); } catch (e) {}
  try { gameManager.start(); } catch (e) {}
  server.listen(PORT, () => {
    console.log(`server_ts listening on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('[server_ts] failed to connect to MongoDB', err);
  process.exit(1);
});
