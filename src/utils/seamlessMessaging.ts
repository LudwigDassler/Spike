/**
 * TedCloud — Zero-Chat CRM Client-Side Seamless Messaging
 * Бесшовный переход партнёра из карточки задачи сразу в личный диалог
 * с клиентом в Telegram или WhatsApp с предзаполненным эмпатичным скриптом.
 */

export interface TelegramContactLinks {
  cleanUsername: string;
  /** Нативный deep-link протокола Telegram для десктопных и мобильных клиентов */
  tgResolveUrl: string;
  /** Универсальная HTTPS-ссылка для Telegram Mini Apps SDK (openTelegramLink) */
  tMeUrl: string;
}

/**
 * Очищает Telegram username от лидирующего символа "@" и пробелов.
 */
export function sanitizeTelegramUsername(username: string): string {
  return username.replace(/^@/, '').trim();
}

/**
 * Очищает телефонный номер от скобок, пробелов, дефисов и плюса для формата https://wa.me/<number>.
 * Пример: "+7 (926) 418-22-10" -> "79264182210"
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Строит обе ссылки для открытия личного чата в Telegram с предзаполненным текстом скрипта:
 * 1) tg://resolve?domain=<username>&text=<encodedText>
 * 2) https://t.me/<username>?text=<encodedText>
 */
export function buildTelegramContactLinks(
  username: string,
  text: string
): TelegramContactLinks {
  const cleanUsername = sanitizeTelegramUsername(username);
  const encodedText = encodeURIComponent(text);

  if (!cleanUsername) {
    return {
      cleanUsername: '',
      tgResolveUrl: `tg://msg_url?url=&text=${encodedText}`,
      tMeUrl: `https://t.me/share/url?url=&text=${encodedText}`,
    };
  }

  return {
    cleanUsername,
    tgResolveUrl: `tg://resolve?domain=${cleanUsername}&text=${encodedText}`,
    tMeUrl: `https://t.me/${cleanUsername}?text=${encodedText}`,
  };
}

/**
 * Строит каноническую ссылку https://wa.me/<phone>?text=<encodedText> для перехода в чат WhatsApp.
 */
export function buildWhatsAppContactUrl(phone: string, text: string): string {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Шаг 2.1. Клиентский переход в личку Telegram с предзаполненным скриптом.
 * Приоритетно использует нативный мост Telegram Mini Apps (@telegram-apps/sdk-react / Telegram.WebApp.openTelegramLink),
 * а вне контейнера TMA использует схему tg://resolve?domain=...
 */
export function handleTelegramContact(
  username: string,
  text: string
): TelegramContactLinks {
  const links = buildTelegramContactLinks(username, text);

  if (typeof window !== 'undefined') {
    const tgWebApp = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            openTelegramLink?: (url: string) => void;
          };
        };
      }
    ).Telegram?.WebApp;

    if (tgWebApp && typeof tgWebApp.openTelegramLink === 'function') {
      // Нативный вызов внутри Telegram Mini App без перезагрузки WebView
      tgWebApp.openTelegramLink(links.tMeUrl);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      // Дублируем скрипт в буфер обмена для удобства партнёра
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
  }

  return links;
}

/**
 * Шаг 2.2. Клиентский переход в личку WhatsApp с предзаполненным скриптом.
 * Формирует валидную ссылку https://wa.me/<cleanPhone>?text=<encodedText>
 * и поддерживает открытие через внешний браузер Telegram Mini App (Telegram.WebApp.openLink).
 */
export function handleWhatsAppContact(phone: string, text: string): string {
  const waUrl = buildWhatsAppContactUrl(phone, text);

  if (typeof window !== 'undefined') {
    const tgWebApp = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
          };
        };
      }
    ).Telegram?.WebApp;

    if (tgWebApp && typeof tgWebApp.openLink === 'function') {
      tgWebApp.openLink(waUrl, { try_instant_view: false });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
  }

  return waUrl;
}
