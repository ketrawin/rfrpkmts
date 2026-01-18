import { Express } from 'express';
import * as AuthService from '../services/auth.service';
import { validateCredentials } from '../utils/validators';
import { createRateLimiter } from '../utils/rateLimiter';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const rateWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 10;
const maxRegisterAttempts = 5;
const loginLimiter = createRateLimiter(maxLoginAttempts, rateWindowMs);
const registerLimiter = createRateLimiter(maxRegisterAttempts, rateWindowMs);

// validation utilities moved to utils/validators.ts

import User from '../models/User';
import jwt from 'jsonwebtoken';

export function setupAuthRoutes(app: Express) {
  app.post('/register', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const { username, password, email } = req.body || {};
    if (registerLimiter.isRateLimited(ip)) {
      return res.status(429).json({ result: 'rate_limited' });
    }
    const v = validateCredentials({ username, password, email });
    if (!v.ok) return res.status(400).json({ result: 'invalid_input', errors: v.errors });
    try {
      const r = await AuthService.registerUser({ username, password, email });
      if (!r.ok) return res.json({ result: r.errors ? r.errors[0] : 'register_failed' });
      return res.json({ result: 'success' });
    } catch (e) {
      return res.json({ result: 'internal_error' });
    }
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ result: 'missing_fields' });
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (loginLimiter.isRateLimited(ip)) {
      return res.status(429).json({ result: 'rate_limited' });
    }
    try {
      const r = await AuthService.loginUser({ username, password });
      if (!r.ok) return res.json({ result: 'invalid_credentials' });
      return res.json({ result: 'success', token: r.token });
    } catch (e) {
      return res.json({ result: 'internal_error' });
    }
  });

  // Middleware d'authentification JWT
  async function authMiddleware(req: any, res: any, next: any) {
    const auth = req.headers.authorization as string | undefined;
    if (!auth) return res.status(401).json({ result: 'unauthorized' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ result: 'unauthorized' });
    const token = parts[1];
    try {
      const payload: any = jwt.verify(token, JWT_SECRET);
      if (!payload || !(payload.id || payload.userId)) return res.status(401).json({ result: 'unauthorized' });
      const userId = payload.id || payload.userId;
      const user = await User.findById(userId).select('-passwordHash').lean().exec();
      if (!user) return res.status(401).json({ result: 'invalid_token' });
      req.user = user;
      next();
    } catch (e) {
      return res.status(401).json({ result: 'invalid_token' });
    }
  }

  // Endpoint protégé : infos utilisateur courant
  app.get('/me', authMiddleware, (req: any, res) => {
    const user = req.user;
    res.json({ result: 'success', user });
  });
}
