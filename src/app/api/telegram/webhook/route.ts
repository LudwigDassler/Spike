import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type BotUserRole =
  | 'SUPERADMIN'
  | 'TENANT_OWNER'
  | 'MANAGER'
  | 'SPECIALIST'
  | 'OBSERVER'
  | string;

export interface TelegramInlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  url?: string;
  callback_data?: string;
}

export type TelegramInlineKeyboard = TelegramInlineKeyboardButton[][];

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    first_name?: string;
    username?: string;
  };
  date?: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
}

export interface OrganizationNodeAuthRow {
  id?: string;
  company_id: string | null;
  role_type?: BotUserRole;
  name?: string;
}

export interface WebhookProcessOptions {
  botToken?: string;
  siteUrl?: string;
  supabaseClient?: Pick<SupabaseClient, 'from'> | null;
  fetchImpl?: typeof fetch;
}

/**
 * Хелпер отправки сообщений через нативный fetch к Telegram Bot API
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  inlineKeyboard?: TelegramInlineKeyboard,
  options?: {
    botToken?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<Record<string, unknown>> {
  const token = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const fetchFn = options?.fetchImpl ?? fetch;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (inlineKeyboard) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  }

  if (!token && fetchFn === fetch) {
    console.error('[Telegram Webhook]: TELEGRAM_BOT_TOKEN не задан в .env');
    return payload;
  }

  try {
    const response = await fetchFn(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `[Telegram sendMessage Error ${response.status}]:`,
        errText
      );
    }
  } catch (networkError) {
    console.error('[Telegram sendMessage Network Error]:', networkError);
  }

  return payload;
}

/**
 * Извлекает параметр startapp из команды /start <startParam> для Deep Linking.
 */
export function extractStartAppParam(rawText: string): string | null {
  const trimmed = rawText.trim();
  const startMatch = trimmed.match(/^\/start(?:@\S+)?\s+([A-Za-z0-9_-]+)$/i);
  if (startMatch?.[1]) {
    return startMatch[1];
  }
  const urlMatch = trimmed.match(/[?&]startapp=([A-Za-z0-9_-]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return null;
}

/**
 * Формирует URL для Telegram Web App с поддержкой Deep Linking (?startapp=...).
 */
export function buildDeepLinkedWebAppUrl(
  baseUrl: string,
  startAppParam?: string | null
): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (!startAppParam) {
    return normalizedBase;
  }
  return `${normalizedBase}/?startapp=${encodeURIComponent(startAppParam)}`;
}

function createServerSupabase(): Pick<SupabaseClient, 'from'> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Не заданы переменные NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY в .env'
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

/**
 * Основное ядро обработки вебхука с проверкой telegram_chat_id
 */
export async function processTelegramWebhook(
  update: TelegramUpdate,
  options?: WebhookProcessOptions
): Promise<{
  ok: boolean;
  action:
    | 'start_authorized'
    | 'start_unauthorized'
    | 'help_sent'
    | 'new_task_prompt'
    | 'observer_denied'
    | 'task_saved'
    | 'task_error'
    | 'ignored';
  chatId: number | null;
  replyPayload?: Record<string, unknown>;
}> {
  const message = update?.message;
  const chatId = message?.chat?.id ?? null;
  const text = message?.text?.trim() ?? '';

  if (!message || !chatId || !text) {
    return { ok: true, action: 'ignored', chatId };
  }

  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const siteUrl = (
    options?.siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://tedcloud.vercel.app'
  ).replace(/\/$/, '');
  const fetchImpl = options?.fetchImpl ?? fetch;

  const supabase =
    options?.supabaseClient !== undefined
      ? options.supabaseClient
      : createServerSupabase();

  // Поиск юзера в таблице organization_nodes по колонке telegram_chat_id
  let user: OrganizationNodeAuthRow | null = null;
  let lookupError: { message: string } | null = null;

  if (supabase) {
    const queryBuilder = supabase
      .from('organization_nodes')
      .select('company_id, role_type, id, name')
      .eq('telegram_chat_id', String(chatId));

    const result =
      typeof queryBuilder.single === 'function'
        ? await queryBuilder.single()
        : await queryBuilder.maybeSingle();

    user = (result.data as OrganizationNodeAuthRow | null) ?? null;
    lookupError = result.error;
  }

  // Если юзер НЕ найден (или вернулась ошибка поиска)
  if (!user || lookupError) {
    const replyPayload = await sendMessage(
      chatId,
      '⚠️ Вас нет в базе. Впишите этот ID в колонку telegram_chat_id: ' + chatId,
      undefined,
      { botToken, fetchImpl }
    );

    return {
      ok: true,
      action: 'start_unauthorized',
      chatId,
      replyPayload,
    };
  }

  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  if (command === '/start') {
    const startParam = extractStartAppParam(text);
    const webAppUrl = buildDeepLinkedWebAppUrl(siteUrl, startParam);

    const replyPayload = await sendMessage(
      chatId,
      'Добро пожаловать в TedCloud! Рабочее пространство готово.',
      [
        [
          {
            text: '🚀 Открыть TedCloud',
            web_app: { url: webAppUrl },
          },
        ],
      ],
      { botToken, fetchImpl }
    );

    return {
      ok: true,
      action: 'start_authorized',
      chatId,
      replyPayload,
    };
  }

  if (command === '/help') {
    const replyPayload = await sendMessage(
      chatId,
      'Для создания задачи просто напишите её суть текстом в этот чат, или используйте команду /new.',
      undefined,
      { botToken, fetchImpl }
    );

    return {
      ok: true,
      action: 'help_sent',
      chatId,
      replyPayload,
    };
  }

  if (command === '/new') {
    const replyPayload = await sendMessage(
      chatId,
      'Напишите суть задачи следующим сообщением:',
      undefined,
      { botToken, fetchImpl }
    );

    return {
      ok: true,
      action: 'new_task_prompt',
      chatId,
      replyPayload,
    };
  }

  // Обычный текст -> создание задачи в таблице tasks
  if (!text.startsWith('/')) {
    const normalizedRole = String(user.role_type || '').toUpperCase();
    if (normalizedRole === 'OBSERVER') {
      const replyPayload = await sendMessage(
        chatId,
        'У вас нет прав на создание задач.',
        undefined,
        { botToken, fetchImpl }
      );
      return {
        ok: true,
        action: 'observer_denied',
        chatId,
        replyPayload,
      };
    }

    if (supabase) {
      const { error: insertError } = await supabase.from('tasks').insert({
        title: text,
        status: 'new',
        company_id: user.company_id,
      });

      if (insertError) {
        const errorReply = await sendMessage(
          chatId,
          '❌ Ошибка: ' + insertError.message,
          undefined,
          { botToken, fetchImpl }
        );
        return {
          ok: false,
          action: 'task_error',
          chatId,
          replyPayload: errorReply,
        };
      }
    }

    const replyPayload = await sendMessage(
      chatId,
      '✅ Задача создана',
      undefined,
      { botToken, fetchImpl }
    );

    return {
      ok: true,
      action: 'task_saved',
      chatId,
      replyPayload,
    };
  }

  return { ok: true, action: 'ignored', chatId };
}

/**
 * Next.js App Router POST Route: app/api/telegram/webhook/route.ts
 * Всегда возвращает Response('OK', { status: 200 }) в конце.
 */
export async function POST(request: Request): Promise<Response> {
  let chatId: number | string | undefined;

  try {
    const body = (await request.json()) as TelegramUpdate;
    const message = body?.message;
    chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';

    if (!chatId || !text) {
      return new Response('OK', { status: 200 });
    }

    const supabase = createServerSupabase();

    // Главное исправление: ищем по колонке telegram_chat_id
    const { data: user, error } = await supabase
      .from('organization_nodes')
      .select('company_id')
      .eq('telegram_chat_id', String(chatId))
      .single();

    // Если юзер НЕ найден (или вернулась ошибка поиска)
    if (error || !user) {
      await sendMessage(
        chatId,
        '⚠️ Вас нет в базе. Впишите этот ID в колонку telegram_chat_id: ' +
          chatId
      );
      return new Response('OK', { status: 200 });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

    // Если юзер найден и пришла команда /start
    if (command === '/start') {
      await sendMessage(
        chatId,
        'Добро пожаловать в TedCloud! Рабочее пространство готово.',
        siteUrl
          ? [
              [
                {
                  text: '🚀 Открыть TedCloud',
                  web_app: { url: siteUrl },
                },
              ],
            ]
          : undefined
      );
      return new Response('OK', { status: 200 });
    }

    if (command === '/help') {
      await sendMessage(
        chatId,
        'Для создания задачи просто напишите её суть текстом в этот чат, или используйте команду /new.'
      );
      return new Response('OK', { status: 200 });
    }

    if (command === '/new') {
      await sendMessage(chatId, 'Напишите суть задачи следующим сообщением:');
      return new Response('OK', { status: 200 });
    }

    // Если юзер найден и пришел обычный текст — INSERT в таблицу tasks
    if (!text.startsWith('/')) {
      const { error: insertError } = await supabase.from('tasks').insert({
        title: text,
        status: 'new',
        company_id: user.company_id,
      });

      if (insertError) {
        await sendMessage(
          chatId,
          '❌ Ошибка создания задачи (RLS/DB): ' + insertError.message
        );
        return new Response('OK', { status: 200 });
      }

      await sendMessage(chatId, '✅ Задача создана');
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]:', error);

    if (chatId) {
      await sendMessage(
        chatId,
        '❌ Ошибка: ' + (error?.message || String(error))
      );
    }

    return new Response('OK', { status: 200 });
  }
}
