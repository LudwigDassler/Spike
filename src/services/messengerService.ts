/**
 * TedCloud — Zero-Chat CRM Communication Layer (Server-Side)
 * Интеграция с Telegram Bot API и Meta WhatsApp Cloud API через нативный fetch.
 * Подходит для использования в Next.js App Router (Route Handlers / Server Actions),
 * Node.js бэкенде или Supabase Edge Functions.
 */

export interface TelegramInlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  url?: string;
}

export interface TelegramSendMessagePayload {
  chat_id: string | number;
  text: string;
  parse_mode: 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup: {
    inline_keyboard: TelegramInlineKeyboardButton[][];
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
 * Нормализует телефонный номер к формату E.164 без знака "+" и спецсимволов
 * (требование WhatsApp Cloud API и ссылок wa.me).
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
 * Шаг 1.1. Отправка Push-уведомления в Telegram с кнопкой запуска Telegram Mini App
 * на конкретной фокус-задаче (используется нативный fetch без telegraf).
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

  // В локальном/демо-окружении без реального токена возвращаем валидный сформированный пакет,
  // а при наличии токена (или кастомного fetch в тестах) выполняем реальный HTTP POST.
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
 * Шаг 1.2. Отправка шаблонного сообщения через официальный WhatsApp Cloud API (Meta Graph API).
 *
 * ПОЧЕМУ WHATSAPP ТРЕБУЕТ ПРЕДВАРИТЕЛЬНО ОДОБРЕННЫХ ШАБЛОНОВ ДЛЯ ПЕРВОГО КАСАНИЯ:
 * В архитектуре WhatsApp Business Platform действует жесткое правило «24-hour Customer Service Window»
 * (24-часовое сервисное окно). Бизнес-аккаунт НЕ имеет права отправлять произвольный текст (`type: "text"`)
 * клиенту первым или спустя более 24 часов после последнего входящего ответа клиента — Meta API отклонит
 * такой запрос с ошибкой `131047 (Re-engagement message)` для защиты пользователей от спама.
 *
 * Чтобы инициировать диалог со стороны бизнеса (Business-Initiated Conversation — например, напомнить
 * об окончании 21-дневного курса коктейля или подтвердить заказ), сообщение ОБЯЗАНО использовать
 * заранее прошедший модерацию Meta HSM-шаблон (`type: "template"`, например `tedcloud_refill_reminder_v1`),
 * в который подставляются динамические переменные (`variables`: имя клиента, название продукта, количество дней).
 * Как только клиент ответит на шаблон, открывается 24-часовое окно для свободного общения.
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
 * Шаг 3. Управление корпоративными чатами (Telegram Bot API).
 * Генерирует персональную одноразовую ссылку (`member_limit: 1`) на вступление в закрытую
 * группу наставника после успешного прохождения онбординга партнёром, либо одобряет заявку
 * (`approveChatJoinRequest`), если группа настроена в режиме проверки по userId.
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
  const ttlSeconds = options?.ttlSeconds ?? 86400; // Срок жизни ссылки: 24 часа
  const expireDate = Math.floor(Date.now() / 1000) + ttlSeconds;
  const fetchFn = options?.fetchImpl ?? fetch;
  const linkLabel = `TedCloud Onboarding Partner #${userId}`;

  // Сценарий А: Одобрение прямой заявки на вступление (approveChatJoinRequest)
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

  // Сценарий Б (по умолчанию): Генерация одноразовой инвайт-ссылки (createChatInviteLink с member_limit: 1)
  const createLinkEndpoint = `https://api.telegram.org/bot${botToken || 'DEMO_TOKEN'}/createChatInviteLink`;
  const requestBody = {
    chat_id: chatId,
    name: linkLabel,
    expire_date: expireDate,
    member_limit: 1, // Строго 1 активация для конкретного новичка
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
