// Register / login support: scrypt password hashing and signed (HMAC) session tokens.
// No external packages: only Node's built-in crypto.

import crypto from 'crypto';
import { createUser, getUserByEmail, getUserById, UserRow } from './db.js';

// The secret is read when first needed (not when this file is loaded), so settings from .env always apply.
let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) { cachedSecret = s; return s; }
  console.warn('[Auth] AUTH_SECRET is not set (or too short). Using a temporary random secret: logins will be reset on every restart. Set AUTH_SECRET in .env.local.');
  cachedSecret = crypto.randomBytes(32).toString('hex');
  return cachedSecret;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function signToken(user: Pick<UserRow, 'id' | 'role'>, ttl = TOKEN_TTL_SECONDS): string {
  const payload = b64u(JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + ttl }));
  const sig = b64u(crypto.createHmac('sha256', getSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}
export function verifyToken(token: string): { sub: string; role: string; exp: number } | null {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest();
  let given: Buffer;
  try { given = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.sub || typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

/** Returns the signed-in user for a request (or null). Disabled accounts are rejected. */
export function getAuthUser(headers: Record<string, string | undefined>): UserRow | null {
  const h = headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const data = verifyToken(m[1]);
  if (!data) return null;
  const user = getUserById(data.sub);
  return user && !user.disabled ? user : null;
}

export const publicUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

/** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (if set). */
export function ensureAdminSeed(): void {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) return;
  const existing = getUserByEmail(email);
  if (existing) return;
  createUser({ id: `usr-${crypto.randomUUID()}`, name: 'Administrator', email, password_hash: hashPassword(password), role: 'admin', disabled: 0, created_at: new Date().toISOString() });
  console.log(`[Auth] Admin account created for ${email}`);
}

// ---- tiny in-memory limiter (per server instance) ----
const buckets = new Map<string, { count: number; reset: number }>();
export function hitLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return false; }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return b.count > max;
}
export const clearLimit = (key: string) => buckets.delete(key);
