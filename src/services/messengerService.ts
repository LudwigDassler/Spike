/**
 * TedCloud — Zero-Chat CRM Communication Layer (Server-Side)
 * Интеграция с Telegram Bot API (Webhook /start, Smart Push с startapp Deep Links,
 * управление закрытыми группами) и Meta WhatsApp Cloud API через нативный fetch.
 */

export interface TelegramInlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  url?: string;
}

export interface TelegramSendMessagePayload {
  chat_id: string | number;
  text: string;
  parse_mode: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup?: {
    inline_keyboard: TelegramInlineKeyboardButton[][];
  };
}

export interface TelegramWebhookUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      username?: string;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    date: number;
    text?: string;
  };
}

export interface WhatsAppTemplateParameter {
  type: 'text';
  text: string;
}

export interface WhatsAppTemplatePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: 'body';
      parameters: WhatsAppTemplateParameter[];
    }>;
  };
}

export interface TelegramInviteLinkResponse {
  ok: boolean;
  invite_link: string;
  expire_date: number;
  member_limit: number;
  name: string;
  simulated?: boolean;
}

export interface MessengerDeliveryResult<TPayload> {
  ok: boolean;
  provider: 'telegram' | 'whatsapp';
  endpoint: string;
  payload: TPayload;
  messageId?: string | number;
  simulated?: boolean;
}

/**
 * Приветственный текст бота TedCloud при команде /start (формат Markdown).
 */
export const TEDCLOUD_WELCOME_MARKDOWN = [
  '*Добро пожаловать в TedCloud* ✨',
  '',
  'Я — ваш персональный ИИ-ассистент внутри корпоративной платформы *TedCloud*.',
  '',
  'Что уже подготовлено для вас сегодня:',
  '• *Фокус дня без таблиц и рутины* — приоритетные касания клиентов с готовыми заботливыми скриптами.',
  '• *Прозрачный баланс VP* — мгновенное начисление баллов объёма за каждый продлённый курс.',
  '• *Единая связь с отделами* — быстрая маршрутизация запросов в профильные подразделения компании.',
  '',
  'Нажмите кнопку ниже, чтобы развернуть ваше рабочее пространство:',
].join('\n');

/**
 * Нормализует телефонный номер к формату E.164 без знака "+" и спецсимволов.
 * Пример: "+7 (926) 418-22-10" -> "79264182210"
 */
export function normalizePhoneForMessenger(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Шаг 1. Обработка входящего Webhook-обновления от Telegram Bot API (команда /start).
 * Отправляет мотивирующее Markdown-приветствие и Inline-кнопку
 * "🚀 Открыть рабочее пространство" для запуска Telegram Mini App.
 */
export async function handleTelegramWebhookUpdate(
  update: TelegramWebhookUpdate,
  options?: {
    botToken?: string;
    webAppUrl?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<{
  handled: boolean;
  command: string | null;
  chatId: number | null;
  delivery?: MessengerDeliveryResult<TelegramSendMessagePayload>;
}> {
  const messageText = update.message?.text?.trim() || '';
  const chatId = update.message?.chat?.id ?? null;

  if (!chatId || !messageText.startsWith('/start')) {
    return {
      handled: false,
      command: null,
      chatId,
    };
  }

  // Извлекаем опциональный deep-link параметр после "/start " (например, "/start task-101")
  const parts = messageText.split(/\s+/);
  const startPayload = parts[1] ? parts[1].trim() : '';

  const baseWebAppUrl =
    options?.webAppUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://app.tedcloud.ru';

  const targetWebAppUrl = startPayload
    ? `${baseWebAppUrl.replace(/\/$/, '')}/?startapp=${encodeURIComponent(startPayload)}`
    : baseWebAppUrl;

  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fetchFn = options?.fetchImpl ?? fetch;

  const payload: TelegramSendMessagePayload = {
    chat_id: chatId,
    text: TEDCLOUD_WELCOME_MARKDOWN,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть рабочее пространство',
            web_app: {
              url: targetWebAppUrl,
            },
          },
        ],
      ],
    },
  };

  const safeToken = botToken || 'DEMO_BOT_TOKEN';
  const endpoint = `https://api.telegram.org/bot${safeToken}/sendMessage`;

  if (!botToken && !options?.fetchImpl) {
    return {
      handled: true,
      command: '/start',
      chatId,
      delivery: {
        ok: true,
        provider: 'telegram',
        endpoint,
        payload,
        messageId: `tg-start-${Date.now()}`,
        simulated: true,
      },
    };
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Telegram webhook reply failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result?: { message_id?: number };
  };

  return {
    handled: true,
    command: '/start',
    chatId,
    delivery: {
      ok: Boolean(data.ok),
      provider: 'telegram',
      endpoint,
      payload,
      messageId: data.result?.message_id,
      simulated: false,
    },
  };
}

/**
 * Шаг 3. Умные Push-уведомления с поддержкой Deep Links (`startapp={taskId}`).
 * Если передан `taskId`, к сообщению прикрепляется Inline-кнопка "Посмотреть задачу",
 * открывающая Web App с параметром `startapp={taskId}`.
 */
export async function sendSmartPush(
  chatId: string | number,
  message: string,
  taskId?: string,
  options?: {
    botToken?: string;
    baseWebAppUrl?: string;
    botUsername?: string;
    appShortName?: string;
    useDirectMiniAppLink?: boolean;
    fetchImpl?: typeof fetch;
  }
): Promise<MessengerDeliveryResult<TelegramSendMessagePayload>> {
  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fetchFn = options?.fetchImpl ?? fetch;
  const baseWebAppUrl = (
    options?.baseWebAppUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://app.tedcloud.ru'
  ).replace(/\/$/, '');

  let replyMarkup: TelegramSendMessagePayload['reply_markup'] | undefined;

  if (taskId && taskId.trim()) {
    const cleanTaskId = encodeURIComponent(taskId.trim());
    const deepLinkWebAppUrl = `${baseWebAppUrl}/?startapp=${cleanTaskId}`;

    // Поддерживаем как прямое открытие WebApp контейнера (`web_app.url` с `?startapp=`),
    // так и классическую t.me Direct Link схему (`https://t.me/<bot>/<app>?startapp=<taskId>`)
    const button: TelegramInlineKeyboardButton =
      options?.useDirectMiniAppLink && options?.botUsername && options?.appShortName
        ? {
            text: 'Посмотреть задачу',
            url: `https://t.me/${options.botUsername}/${options.appShortName}?startapp=${cleanTaskId}`,
          }
        : {
            text: 'Посмотреть задачу',
            web_app: {
              url: deepLinkWebAppUrl,
            },
          };

    replyMarkup = {
      inline_keyboard: [[button]],
    };
  }

  const payload: TelegramSendMessagePayload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };

  const safeToken = botToken || 'DEMO_BOT_TOKEN';
  const endpoint = `https://api.telegram.org/bot${safeToken}/sendMessage`;

  if (!botToken && !options?.fetchImpl) {
    return {
      ok: true,
      provider: 'telegram',
      endpoint,
      payload,
      messageId: `tg-smart-push-${Date.now()}`,
      simulated: true,
    };
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram sendSmartPush error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result?: { message_id?: number };
  };

  return {
    ok: Boolean(data.ok),
    provider: 'telegram',
    endpoint,
    payload,
    messageId: data.result?.message_id,
    simulated: false,
  };
}

/**
 * Формирует тело запроса для Telegram Bot API sendMessage с Inline-кнопкой запуска Mini App.
 */
export function buildTelegramNotificationPayload(
  chatId: string | number,
  message: string,
  webAppUrl: string,
  buttonText = 'Открыть задачу в TedCloud'
): TelegramSendMessagePayload {
  return {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            web_app: {
              url: webAppUrl,
            },
          },
        ],
      ],
    },
  };
}

/**
 * Отправка Push-уведомления в Telegram с кнопкой запуска Telegram Mini App.
 */
export async function sendTelegramNotification(
  chatId: string | number,
  message: string,
  webAppUrl: string,
  options?: {
    botToken?: string;
    buttonText?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<MessengerDeliveryResult<TelegramSendMessagePayload>> {
  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fetchFn = options?.fetchImpl ?? fetch;
  const payload = buildTelegramNotificationPayload(
    chatId,
    message,
    webAppUrl,
    options?.buttonText
  );

  const safeToken = botToken || 'DEMO_BOT_TOKEN';
  const endpoint = `https://api.telegram.org/bot${safeToken}/sendMessage`;

  if (!botToken && !options?.fetchImpl) {
    return {
      ok: true,
      provider: 'telegram',
      endpoint,
      payload,
      messageId: `tg-sim-${Date.now()}`,
      simulated: true,
    };
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram Bot API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result?: { message_id?: number };
  };

  return {
    ok: Boolean(data.ok),
    provider: 'telegram',
    endpoint,
    payload,
    messageId: data.result?.message_id,
    simulated: false,
  };
}

/**
 * Формирует payload для отправки HSM-шаблона через WhatsApp Cloud API.
 */
export function buildWhatsAppTemplatePayload(
  phone: string,
  templateName: string,
  variables: string[],
  languageCode = 'ru'
): WhatsAppTemplatePayload {
  const cleanPhone = normalizePhoneForMessenger(phone);
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: [
        {
          type: 'body',
          parameters: variables.map((val) => ({
            type: 'text',
            text: String(val),
          })),
        },
      ],
    },
  };
}

/**
 * Отправка шаблонного сообщения через официальный WhatsApp Cloud API.
 */
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  variables: string[],
  options?: {
    accessToken?: string;
    phoneNumberId?: string;
    languageCode?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<MessengerDeliveryResult<WhatsAppTemplatePayload>> {
  const accessToken = options?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  const phoneNumberId =
    options?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '100000000000000';
  const fetchFn = options?.fetchImpl ?? fetch;

  const payload = buildWhatsAppTemplatePayload(
    phone,
    templateName,
    variables,
    options?.languageCode ?? 'ru'
  );

  const endpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  if (!accessToken && !options?.fetchImpl) {
    return {
      ok: true,
      provider: 'whatsapp',
      endpoint,
      payload,
      messageId: `wamid.sim.${Date.now()}`,
      simulated: true,
    };
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp Cloud API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    messages?: Array<{ id: string }>;
  };

  return {
    ok: true,
    provider: 'whatsapp',
    endpoint,
    payload,
    messageId: data.messages?.[0]?.id,
    simulated: false,
  };
}

/**
 * Управление корпоративными чатами (Telegram Bot API).
 */
export async function inviteToTeamChat(
  botToken: string,
  chatId: string | number,
  userId: string | number,
  options?: {
    mode?: 'one_time_link' | 'approve_join_request';
    ttlSeconds?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<TelegramInviteLinkResponse> {
  const mode = options?.mode ?? 'one_time_link';
  const ttlSeconds = options?.ttlSeconds ?? 86400;
  const expireDate = Math.floor(Date.now() / 1000) + ttlSeconds;
  const fetchFn = options?.fetchImpl ?? fetch;
  const linkLabel = `TedCloud Onboarding Partner #${userId}`;

  if (mode === 'approve_join_request') {
    const approveEndpoint = `https://api.telegram.org/bot${botToken || 'DEMO_TOKEN'}/approveChatJoinRequest`;

    if (!botToken && !options?.fetchImpl) {
      return {
        ok: true,
        invite_link: `https://t.me/+approved_user_${userId}`,
        expire_date: expireDate,
        member_limit: 1,
        name: linkLabel,
        simulated: true,
      };
    }

    const response = await fetchFn(approveEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: Number(userId),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram approveChatJoinRequest error (${response.status}): ${errorText}`);
    }

    return {
      ok: true,
      invite_link: `https://t.me/+approved_user_${userId}`,
      expire_date: expireDate,
      member_limit: 1,
      name: linkLabel,
      simulated: false,
    };
  }

  const createLinkEndpoint = `https://api.telegram.org/bot${botToken || 'DEMO_TOKEN'}/createChatInviteLink`;
  const requestBody = {
    chat_id: chatId,
    name: linkLabel,
    expire_date: expireDate,
    member_limit: 1,
    creates_join_request: false,
  };

  if (!botToken && !options?.fetchImpl) {
    return {
      ok: true,
      invite_link: `https://t.me/+TedCloudInvite_${chatId}_${userId}`,
      expire_date: expireDate,
      member_limit: 1,
      name: linkLabel,
      simulated: true,
    };
  }

  const response = await fetchFn(createLinkEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram createChatInviteLink error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    result: {
      invite_link: string;
      expire_date?: number;
      member_limit?: number;
      name?: string;
    };
  };

  return {
    ok: Boolean(data.ok),
    invite_link: data.result.invite_link,
    expire_date: data.result.expire_date ?? expireDate,
    member_limit: data.result.member_limit ?? 1,
    name: data.result.name ?? linkLabel,
    simulated: false,
  };
}
