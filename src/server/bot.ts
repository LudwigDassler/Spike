/**
 * TedCloud — Серверный модуль Telegram-бота (bot.ts)
 * Поддерживает два режима работы:
 * 1) Webhook-режим (для Next.js API Route `app/api/webhook/route.ts` или Express `POST /api/webhook`)
 * 2) Long-Polling режим (`startTelegramLongPolling`) — автоматически перехватывает `/start`,
 *    если задан `TELEGRAM_BOT_TOKEN`, но внешний Webhook ещё не зарегистрирован.
 */

export interface TelegramWebAppInfo {
  url: string;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  web_app?: TelegramWebAppInfo;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramBotUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      first_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

export interface TelegramSendMessageRequest {
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
  reply_markup: TelegramInlineKeyboardMarkup;
}

/**
 * Утверждённый текст приветствия при команде /start
 */
export const TEDCLOUD_START_MESSAGE =
  'Добро пожаловать в TedCloud! Ваше рабочее пространство готово.';

/**
 * Формирует payload ответа на команду /start с обязательной InlineKeyboardMarkup
 * и кнопкой Web App (`web_app: { url }`) прямо под сообщением.
 */
export function buildStartCommandPayload(
  chatId: number | string,
  webAppUrl: string,
  startParam?: string
): TelegramSendMessageRequest {
  const cleanBaseUrl = webAppUrl.replace(/\/$/, '');
  const finalWebAppUrl =
    startParam && startParam.trim()
      ? `${cleanBaseUrl}/?startapp=${encodeURIComponent(startParam.trim())}`
      : cleanBaseUrl;

  return {
    chat_id: chatId,
    text: TEDCLOUD_START_MESSAGE,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть рабочее пространство TedCloud',
            web_app: {
              url: finalWebAppUrl,
            },
          },
        ],
      ],
    },
  };
}

/**
 * Перехватывает команду `/start` из входящего Update и отправляет приветствие
 * с InlineKeyboardMarkup (`web_app: { url }`) через Telegram Bot API `sendMessage`.
 */
export async function handleTelegramStartCommand(
  update: TelegramBotUpdate,
  options?: {
    botToken?: string;
    webAppUrl?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<{
  handled: boolean;
  chatId: number | null;
  command: string | null;
  payload?: TelegramSendMessageRequest;
  simulated?: boolean;
}> {
  const rawText = update.message?.text?.trim() || '';
  const chatId = update.message?.chat?.id ?? null;

  // Перехватываем `/start` и `/start@BotName`, а также deep-link `/start task-101`
  if (!chatId || !/^\/start(@\S+)?(\s+.*)?$/i.test(rawText)) {
    return {
      handled: false,
      chatId,
      command: null,
    };
  }

  const parts = rawText.split(/\s+/);
  const startParam = parts[1] ? parts[1].trim() : undefined;

  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const webAppUrl =
    options?.webAppUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://app.tedcloud.ru';
  const fetchFn = options?.fetchImpl ?? fetch;

  const payload = buildStartCommandPayload(chatId, webAppUrl, startParam);
  const endpoint = `https://api.telegram.org/bot${botToken || 'DEMO_BOT_TOKEN'}/sendMessage`;

  if (!botToken && !options?.fetchImpl) {
    return {
      handled: true,
      chatId,
      command: '/start',
      payload,
      simulated: true,
    };
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Telegram sendMessage failed (${response.status}): ${errorBody}`);
  }

  return {
    handled: true,
    chatId,
    command: '/start',
    payload,
    simulated: false,
  };
}

/**
 * Утилита для программной привязки Webhook URL к Telegram Bot API.
 * Вызовите один раз при деплое: `await registerTelegramWebhook(token, 'https://ВАШ_ДОМЕН/api/webhook')`
 */
export async function registerTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; description?: string }> {
  const endpoint = `https://api.telegram.org/bot${botToken}/setWebhook`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
    }),
  });
  return (await response.json()) as { ok: boolean; description?: string };
}

/**
 * Автоматический фоновый Long-Polling для локальной разработки и контейнеров,
 * где внешний HTTPS Webhook ещё не настроен в Telegram.
 */
let isPollingActive = false;

export async function startTelegramLongPolling(options?: {
  botToken?: string;
  webAppUrl?: string;
}): Promise<void> {
  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!botToken || isPollingActive) return;

  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    if (!infoRes.ok) return;
    const infoData = (await infoRes.json()) as {
      ok: boolean;
      result?: { url?: string };
    };

    // Если у бота уже прописан боевой HTTPS Webhook — не сбиваем его поллингом
    if (infoData.result?.url) {
      return;
    }

    isPollingActive = true;
    let offset = 0;

    const pollTick = async () => {
      if (!isPollingActive) return;
      try {
        const updatesRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=15`,
          {
            method: 'GET',
          }
        );
        if (updatesRes.ok) {
          const data = (await updatesRes.json()) as {
            ok: boolean;
            result?: TelegramBotUpdate[];
          };
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              offset = Math.max(offset, update.update_id + 1);
              await handleTelegramStartCommand(update, {
                botToken,
                webAppUrl: options?.webAppUrl,
              });
            }
          }
        }
      } catch {
        // Игнорируем кратковременные сетевые ошибки и продолжаем цикл опроса
      } finally {
        if (isPollingActive) {
          setTimeout(pollTick, 2500);
        }
      }
    };

    void pollTick();
  } catch {
    // Без вывода ошибок, если токен тестовый или нет доступа к внешней сети
  }
}
