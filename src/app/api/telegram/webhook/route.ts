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
  enableDebugPing?: boolean;
}

/**
 * 100% надежная функция отправки сообщений через нативный fetch к Telegram Bot API.
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
    console.error('[Telegram Debug]: TELEGRAM_BOT_TOKEN не задан в .env!');
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

    const responseText = await response.text();
    console.log(
      `[Telegram sendMessage -> chat_id=${chatId} status=${response.status}]:`,
      responseText
    );
  } catch (networkErr) {
    console.error('[Telegram sendMessage Network Error]:', networkErr);
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

/**
 * Инициализация Supabase ВНУТРИ обработчика (чтобы отсутствие env-переменных не роняло файл до старта POST)
 */
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
      'Не найдены переменные NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY (SUPABASE_SERVICE_ROLE_KEY) в окружении Vercel.'
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

/**
 * Тестируемое ядро обработки вебхука
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

  if (options?.enableDebugPing) {
    await sendMessage(
      message.chat.id,
      '🔄 Пинг прошел. Ваш ID: ' + message.chat.id,
      undefined,
      { botToken, fetchImpl }
    );
  }

  const supabase =
    options?.supabaseClient !== undefined
      ? options.supabaseClient
      : createServerSupabase();

  let userNode: OrganizationNodeAuthRow | null = null;
  if (supabase) {
    const { data, error } = await supabase
      .from('organization_nodes')
      .select('id, company_id, role_type, name')
      .eq('telegram_id', String(message.chat.id))
      .maybeSingle();

    if (error) {
      throw new Error(`Ошибка Supabase (organization_nodes): ${error.message}`);
    }

    userNode = (data as OrganizationNodeAuthRow | null) ?? null;
  }

  const baseCommand = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  switch (baseCommand) {
    case '/start': {
      if (userNode) {
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
      } else {
        const replyPayload = await sendMessage(
          chatId,
          '⚠️ Вас нет в базе. Запишите свой ID в organization_nodes: ' + chatId,
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
    }

    case '/help': {
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

    case '/new': {
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

    default: {
      if (!userNode) {
        const replyPayload = await sendMessage(
          chatId,
          '⚠️ Вас нет в базе. Запишите свой ID в organization_nodes: ' + chatId,
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

      const normalizedRole = String(userNode.role_type || '').toUpperCase();
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

      if (!text.startsWith('/') && supabase) {
        const { error: insertError } = await supabase.from('tasks').insert({
          title: text,
          status: 'new',
          company_id: userNode.company_id,
        });

        if (insertError) {
          throw new Error(`Ошибка создания задачи (tasks): ${insertError.message}`);
        }

        const replyPayload = await sendMessage(
          chatId,
          '✅ Задача успешно сохранена в системе.',
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
  }
}

/**
 * Next.js App Router POST Route: app/api/telegram/webhook/route.ts
 * С агрессивным логированием, принудительным пингом и отправкой ошибок прямо в Telegram-чат.
 */
export async function POST(request: Request): Promise<Response> {
  let message: TelegramMessage | undefined;

  try {
    const body = (await request.json()) as TelegramUpdate;
    console.log('[Telegram Webhook Incoming Update]:', JSON.stringify(body));

    message = body?.message;

    if (!message || !message.chat?.id) {
      console.log('[Telegram Webhook]: Апдейт без message.chat.id, пропускаем.');
      return new Response('OK', { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim() || '';

    // 1. Принудительный пинг перед любыми запросами к БД (доказывает, что связь с ботом работает)
    await sendMessage(chatId, '🔄 Пинг прошел. Ваш ID: ' + chatId);

    // 2. Инициализация клиента Supabase внутри try, чтобы отловить возможные проблемы с .env
    const supabase = createServerSupabase();

    // 3. Запрос к Supabase (organization_nodes), ищем telegram_id == String(message.chat.id)
    const { data: userNode, error: selectError } = await supabase
      .from('organization_nodes')
      .select('*')
      .eq('telegram_id', String(chatId))
      .maybeSingle();

    if (selectError) {
      throw new Error(selectError.message);
    }

    // 4. Если юзер не найден в БД — сообщаем его ID для записи в organization_nodes
    if (!userNode) {
      await sendMessage(
        chatId,
        '⚠️ Вас нет в базе. Запишите свой ID в organization_nodes: ' + chatId
      );
      return new Response('OK', { status: 200 });
    }

    // 5. Если юзер найден в БД — маршрутизируем команду или создаем задачу
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

    switch (command) {
      case '/start': {
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
        break;
      }

      case '/help': {
        await sendMessage(
          chatId,
          'Для создания задачи просто напишите её суть текстом в этот чат, или используйте команду /new.'
        );
        break;
      }

      case '/new': {
        await sendMessage(
          chatId,
          'Напишите суть задачи следующим сообщением:'
        );
        break;
      }

      default: {
        if (text && !text.startsWith('/')) {
          const { error: insertError } = await supabase.from('tasks').insert({
            title: text,
            status: 'new',
            company_id: userNode.company_id,
          });

          if (insertError) {
            throw new Error(insertError.message);
          }

          await sendMessage(
            chatId,
            '✅ Задача успешно сохранена в системе.'
          );
        }
        break;
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('[Telegram Webhook Critical Error]:', error);

    if (message?.chat?.id) {
      await sendMessage(
        message.chat.id,
        '❌ Критическая ошибка: ' + errorMessage
      );
    }

    return new Response('OK', { status: 200 });
  }
}
