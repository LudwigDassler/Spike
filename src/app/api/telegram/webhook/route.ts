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

export interface TelegramUpdate {
  update_id?: number;
  message?: {
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
      type: 'private' | 'group' | 'supergroup' | 'channel';
      first_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
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

// Инициализация серверного клиента Supabase
function getServerSupabaseClient(): Pick<SupabaseClient, 'from'> | null {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

/**
 * Внутренний хелпер отправки сообщений в Telegram Bot API
 */
async function sendMessage(
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
    return payload;
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Telegram sendMessage Error ${response.status}]:`, errText);
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
 * Авторизация в Supabase: ищет запись в organization_nodes по telegram_id (с фоллбэком на telegram_chat_id)
 */
async function findUserNodeByTelegramId(
  supabase: Pick<SupabaseClient, 'from'>,
  chatIdStr: string
): Promise<OrganizationNodeAuthRow | null> {
  // 1. Поиск по полю telegram_id
  const primaryRes = await supabase
    .from('organization_nodes')
    .select('id, company_id, role_type, name')
    .eq('telegram_id', chatIdStr)
    .maybeSingle();

  if (!primaryRes.error && primaryRes.data) {
    return primaryRes.data as OrganizationNodeAuthRow;
  }

  // 2. Фоллбэк на telegram_chat_id, если в схеме используется это имя колонки
  if (primaryRes.error) {
    const fallbackRes = await supabase
      .from('organization_nodes')
      .select('id, company_id, role_type, name')
      .eq('telegram_chat_id', chatIdStr)
      .maybeSingle();

    if (!fallbackRes.error && fallbackRes.data) {
      return fallbackRes.data as OrganizationNodeAuthRow;
    }
  }

  return null;
}

/**
 * Основная серверная логика обработки входящего сообщения Telegram
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
  const supabase =
    options?.supabaseClient !== undefined
      ? options.supabaseClient
      : getServerSupabaseClient();
  const fetchImpl = options?.fetchImpl ?? fetch;

  // Авторизация (Supabase): ищем пользователя по telegram_id === String(message.chat.id)
  let userNode: OrganizationNodeAuthRow | null = null;
  if (supabase) {
    userNode = await findUserNodeByTelegramId(supabase, String(chatId));
  }

  // Нормализуем команду для switch/case (отсекаем возможный @bot_username и аргументы у /start)
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
          `Доступ закрыт. Ваш Telegram ID: ${chatId}. Передайте его руководителю для приглашения в систему.`,
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
      // Обычный текст (Создание задачи): если текст не начинается с '/' и юзер есть в БД
      if (!text.startsWith('/') && userNode) {
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

        if (supabase) {
          const { error: insertError } = await supabase.from('tasks').insert({
            title: text,
            status: 'new',
            company_id: userNode.company_id,
          });

          if (insertError) {
            console.error('[Supabase Tasks Insert Error]:', insertError);
          }
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
 * КРИТИЧНО: Всегда возвращает Response('OK', { status: 200 }) и в try, и в catch.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TelegramUpdate;
    await processTelegramWebhook(body);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[Telegram Webhook Error]:', error);
    return new Response('OK', { status: 200 });
  }
}
