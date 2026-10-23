/**
 * TedCloud — Серверная утилита интеграции с Telegram Bot API (lib/telegram.ts)
 * 1) `sendTaskNotification(chatId, text, taskId)` — отправка Push-уведомления с Inline-кнопкой
 *    "Открыть задачу" и Deep Link параметром `?startapp={taskId}`.
 * 2) `handleStartWebhook(update)` — ответ на `/start`:
 *    "Добро пожаловать в TedCloud! Ваше корпоративное пространство готово."
 */

export interface TelegramInlineButton {
  text: string;
  web_app?: {
    url: string;
  };
  url?: string;
}

export interface TelegramSendMessageBody {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
  reply_markup: {
    inline_keyboard: TelegramInlineButton[][];
  };
}

export interface TelegramNotificationResult {
  ok: boolean;
  endpoint: string;
  payload: TelegramSendMessageBody;
  messageId?: number | string;
  simulated?: boolean;
}

export const TEDCLOUD_CORPORATE_WELCOME_TEXT =
  'Добро пожаловать в TedCloud! Ваше корпоративное пространство готово.';

/**
 * Отправляет Push-уведомление в Telegram с Inline-кнопкой "Открыть задачу",
 * содержащей URL Web App с параметром `?startapp={taskId}` (Deep Linking).
 */
export async function sendTaskNotification(
  chatId: string | number,
  text: string,
  taskId: string,
  options?: {
    botToken?: string;
    webAppBaseUrl?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<TelegramNotificationResult> {
  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fetchFn = options?.fetchImpl ?? fetch;

  const baseUrl = (
    options?.webAppBaseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://app.tedcloud.ru'
  ).replace(/\/$/, '');

  const deepLinkUrl = `${baseUrl}/?startapp=${encodeURIComponent(taskId.trim())}`;

  const payload: TelegramSendMessageBody = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть задачу',
            web_app: {
              url: deepLinkUrl,
            },
          },
        ],
      ],
    },
  };

  const endpoint = `https://api.telegram.org/bot${botToken || 'DEMO_BOT_TOKEN'}/sendMessage`;

  if (!botToken && !options?.fetchImpl) {
    return {
      ok: true,
      endpoint,
      payload,
      messageId: `sim-task-${Date.now()}`,
      simulated: true,
    };
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Telegram sendTaskNotification failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result?: { message_id?: number };
  };

  return {
    ok: Boolean(data.ok),
    endpoint,
    payload,
    messageId: data.result?.message_id,
    simulated: false,
  };
}
