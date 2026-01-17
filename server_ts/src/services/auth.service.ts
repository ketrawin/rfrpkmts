import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateCredentials } from '../utils/validators';
import UserModel from '../models/User';
import type { RegisterPayload, LoginCredentials, AuthResult } from '../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export async function registerUser(payload: RegisterPayload): Promise<AuthResult> {
  const v = validateCredentials(payload);
  if (!v.ok) return { ok: false, errors: v.errors };

  const existing = await UserModel.findOne({ username: payload.username });
  if (existing) return { ok: false, errors: ['username_taken'] };

  const hashed = await bcrypt.hash(payload.password, 10);
  const user = new UserModel({ username: payload.username, email: payload.email, passwordHash: hashed });
  await user.save();

  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return { ok: true, user: { id: String(user._id), username: user.username }, token };
}

export async function loginUser(credentials: LoginCredentials): Promise<AuthResult> {
  const user = await UserModel.findOne({ username: credentials.username });
  if (!user) return { ok: false, error: 'invalid_credentials' };
  const match = await bcrypt.compare(credentials.password || '', (user as any).passwordHash || '');
  if (!match) return { ok: false, error: 'invalid_credentials' };
  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  return { ok: true, user: { id: String(user._id), username: user.username }, token };
}

export function validateToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) { return null; }
}
