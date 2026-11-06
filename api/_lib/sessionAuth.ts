import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveLocalDataFile } from './localPersistence';

/**
 * В разработке без TEDCLOUD_SESSION_SECRET секрет сохраняется рядом с локальным хранилищем
 * (data/.dev-session-secret), чтобы вход переживал перезапуск dev-сервера.
 * В тестах и на Vercel файл не используется — секрет живёт только в памяти процесса.
 */
function loadOrCreatePersistedDevSecret(): string | null {
  const dataFile = resolveLocalDataFile();
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

/**
 * Подписанный серверный токен сессии TedCloud.
 *
 * Формат: `<base64url(JSON claims)>.<base64url(HMAC-SHA256)>`.
 * Компания (`cid`) и профиль (`sub`) берутся только из проверенного токена,
 * а не из тела/квери запроса.
 *
 * Секрет подписи: переменная окружения `TEDCLOUD_SESSION_SECRET` (минимум 32 символа).
 * В production без неё токены не выдаются и не принимаются.
 * В режиме разработки при её отсутствии генерируется временный секрет процесса
 * (сессии сбрасываются при перезапуске сервера).
 */

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
let warnedAboutEphemeralSecret = false;

export class SessionConfigError extends Error {}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.argv.includes('--production')
  );
}

export function getSessionSecret(): string {
  const configured = String(process.env[SESSION_SECRET_ENV] || '').trim();
  if (configured) {
    if (configured.length < MIN_SECRET_LENGTH) {
      throw new SessionConfigError(
        `${SESSION_SECRET_ENV} должен содержать не менее ${MIN_SECRET_LENGTH} символов.`
      );
    }
    return configured;
  }
  if (isProductionRuntime()) {
    throw new SessionConfigError(
      `Не задан ${SESSION_SECRET_ENV}: подпись сессий в production невозможна.`
    );
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret =
      loadOrCreatePersistedDevSecret() || crypto.randomBytes(48).toString('base64url');
  }
  if (!warnedAboutEphemeralSecret) {
    warnedAboutEphemeralSecret = true;
    console.warn(
      `[auth] ${SESSION_SECRET_ENV} не задан — используется временный секрет процесса (только для разработки).`
    );
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

