export function validateCredentials(payload: any) {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') return { ok: false, errors: ['invalid_payload'] };
  const u = payload.username || '';
  const p = payload.password || '';
  const e = payload.email || '';
  if (!u || u.length < 3) errors.push('username_too_short');
  if (!p || p.length < 6) errors.push('password_too_short');
  if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) errors.push('invalid_email');
  return { ok: errors.length === 0, errors };
}
