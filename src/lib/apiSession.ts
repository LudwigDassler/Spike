/**
 * Клиентское хранение серверного токена сессии TedCloud.
 *
 * Токен выдаёт `/api/db` при входе/регистрации (поле `sessionToken`), а этот модуль
 * автоматически добавляет его в заголовок `Authorization: Bearer …` всех запросов к `/api/db`.
 */

export const SESSION_TOKEN_KEY = 'tedcloud_session_token';
export const SESSION_COOKIE_NAME = 'tedcloud_session';
export const SESSION_EXPIRED_EVENT = 'tedcloud:session-expired';

let memoryToken: string | null = null;

function syncSessionCookie(token: string | null): void {
  if (typeof document === 'undefined') return;
  try {
    const isSecure = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const sameSite = isSecure ? 'SameSite=None; Secure' : 'SameSite=Lax';
    if (token) {
      document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; ${sameSite}`;
    } else {
      document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; ${sameSite}`;
    }
  } catch {}
}

export function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY) || memoryToken;
    if (stored) return stored;
  } catch {}
  return memoryToken;
}

export function setSessionToken(token: string | null | undefined): void {
  const clean = typeof token === 'string' && token.trim() ? token.trim() : null;
  memoryToken = clean;
  try {
    if (clean) localStorage.setItem(SESSION_TOKEN_KEY, clean);
    else localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
  syncSessionCookie(clean);
}

export function clearSessionToken(): void {
  setSessionToken(null);
}

/** Сохраняет токен из ответа API, если сервер его выдал. */
export function rememberSessionTokenFrom(payload: any): void {
  if (payload && typeof payload.sessionToken === 'string' && payload.sessionToken) {
    setSessionToken(payload.sessionToken);
  }
}

export function isApiDbRequest(input: RequestInfo | URL): boolean {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url;
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname === '/api/db';
  } catch {
    return false;
  }
}

let installed = false;

/**
 * Оборачивает `window.fetch`: к запросам на `/api/db` того же origin добавляется
 * `Authorization: Bearer <token>`, а ответ 401 сбрасывает сохранённый токен.
 * Безопасно работает в средах (iframe/strict mode), где `window.fetch` задан только через getter.
 */
export function installApiAuthFetch(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;

  // Синхронизируем существующий токен из localStorage в cookie при старте
  const initialToken = getSessionToken();
  if (initialToken) {
    syncSessionCookie(initialToken);
  }

  const originalFetch = window.fetch.bind(window);

  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiDbRequest(input)) {
      return originalFetch(input, init);
    }
    const token = getSessionToken();
    let nextInit = init;
    if (token) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      nextInit = { ...(init || {}), headers };
    }
    const response = await originalFetch(input, nextInit);
    if (response.status === 401 && token && getSessionToken() === token) {
      clearSessionToken();
      try {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      } catch {}
    }
    return response;
  };

  try {
    (window as any).__tedcloudFetch = wrappedFetch;
  } catch {}

  try {
    Object.defineProperty(window, 'fetch', {
      value: wrappedFetch,
      configurable: true,
      writable: true,
    });
  } catch {
    try {
      (window as any).fetch = wrappedFetch;
    } catch {
      // В некоторых песочницах window.fetch защищён от перезаписи (getter-only non-configurable).
      // В этом случае запросы идут через window.__tedcloudFetch и/или cookie tedcloud_session.
    }
  }
}
