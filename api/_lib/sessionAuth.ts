import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function resolveLocalDataFileForSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = String(env.TEDCLOUD_DATA_FILE || '').trim();
  if (configured.toLowerCase() === 'off') return null;
  if (configured) return path.resolve(configured);
  const isTestProcess =
    Boolean(env.VERCEL || env.NODE_TEST_CONTEXT || env.NODE_ENV === 'test') ||
    (Array.isArray(process.argv) &&
      process.argv.some((arg) => arg === '--test' || arg.includes('.test.')));
  if (isTestProcess) return null;
  return path.resolve(process.cwd(), 'data', 'tedcloud-store.json');
}

function loadOrCreatePersistedDevSecret(): string | null {
  const dataFile = resolveLocalDataFileForSecret();
  if (!dataFile) return null;
  const secretFile = path.join(path.dirname(dataFile), '.dev-session-secret');
  try {
    const existing = fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : '';
    if (existing.length >= 32) return existing;
    const created = crypto.randomBytes(48).toString('base64url');
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, created, { encoding: 'utf8', mode: 0o600 });
    return created;
  } catch {
    return null;
  }
}

export interface SessionClaims {
  /** id профиля (organization_nodes.id) */
  sub: string;
  /** id компании (companies.id) */
  cid: string;
  /** issued at, секунды */
  iat: number;
  /** expires at, секунды */
  exp: number;
  v: 1;
}

export const SESSION_SECRET_ENV = 'TEDCLOUD_SESSION_SECRET';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;

let ephemeralDevSecret: string | null = null;

export class SessionConfigError extends Error {}

function deriveDeterministicFallbackSecret(): string {
  const seedParts = [
    process.env[SESSION_SECRET_ENV] || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    process.env.VITE_SUPABASE_ANON_KEY || '',
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_URL || '',
    process.env.TELEGRAM_BOT_TOKEN || '',
    process.env.VERCEL_PROJECT_ID || '',
    'tedcloud-enterprise-session-hmac-key-v1',
  ].join('|');
  return crypto.createHash('sha256').update(seedParts).digest('base64url');
}

export function getSessionSecret(): string {
  const configured = String(process.env[SESSION_SECRET_ENV] || '').trim();
  if (configured && configured.length >= MIN_SECRET_LENGTH) {
    return configured;
  }
  if (configured && configured.length > 0 && configured.length < MIN_SECRET_LENGTH) {
    return crypto.createHash('sha256').update(configured).digest('base64url');
  }
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return deriveDeterministicFallbackSecret();
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret =
      loadOrCreatePersistedDevSecret() || deriveDeterministicFallbackSecret();
  }
  return ephemeralDevSecret;
}

function hmac(data: string, secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

export function signSessionToken(
  params: { profileId: string; companyId: string },
  options: { nowSeconds?: number; ttlSeconds?: number; secret?: string } = {}
): string {
  const profileId = String(params.profileId || '').trim();
  const companyId = String(params.companyId || '').trim();
  if (!profileId || !companyId) {
    throw new Error('Нельзя выдать сессию без профиля и компании.');
  }
  const now = Math.floor(options.nowSeconds ?? Date.now() / 1000);
  const claims: SessionClaims = {
    sub: profileId,
    cid: companyId,
    iat: now,
    exp: now + (options.ttlSeconds ?? SESSION_TTL_SECONDS),
    v: 1,
  };
  const encoded = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = hmac(encoded, options.secret ?? getSessionSecret()).toString('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  options: { nowSeconds?: number; secret?: string } = {}
): SessionClaims | null {
  if (!token || typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encoded, signature] = parts;

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  const expected = hmac(encoded, options.secret ?? getSessionSecret());
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  let claims: any;
  try {
    claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    !claims ||
    claims.v !== 1 ||
    typeof claims.sub !== 'string' ||
    typeof claims.cid !== 'string' ||
    !claims.sub ||
    !claims.cid ||
    typeof claims.exp !== 'number' ||
    typeof claims.iat !== 'number'
  ) {
    return null;
  }
  const now = Math.floor(options.nowSeconds ?? Date.now() / 1000);
  if (claims.exp <= now) return null;
  return claims as SessionClaims;
}

export function extractBearerToken(req: any): string | null {
  const headers = req?.headers || {};
  const raw =
    typeof headers.get === 'function'
      ? headers.get('authorization')
      : headers.authorization ?? headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && typeof value === 'string') {
    const match = value.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  const rawCookie =
    typeof headers.get === 'function'
      ? headers.get('cookie')
      : headers.cookie ?? headers.Cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'tedcloud_session' && rest.length > 0) {
        try {
          const decoded = decodeURIComponent(rest.join('=').trim());
          if (decoded) return decoded;
        } catch {
          const fallback = rest.join('=').trim();
          if (fallback) return fallback;
        }
      }
    }
  }

  return null;
}
