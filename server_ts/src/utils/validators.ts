export function isValidUsername(u?: string) {
  if (!u) return false;
  if (u.length < 4 || u.length > 32) return false;
  return /^[A-Za-z0-9_]+$/.test(u);
}

export function isValidPassword(p?: string) {
  if (!p) return false;
  return p.length >= 8 && p.length <= 128;
}

export function isValidEmail(email?: string) {
  if (!email) return false;
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(email);
}

export function validateCredentials(payload: any) {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') return { ok: false, errors: ['invalid_payload'] };
  const u = payload.username || '';
  const p = payload.password || '';
  const e = payload.email || '';
  if (!isValidUsername(u)) errors.push('invalid_username');
  if (!isValidPassword(p)) errors.push('invalid_password');
  if (e && !isValidEmail(e)) errors.push('invalid_email');
  return { ok: errors.length === 0, errors };
}
