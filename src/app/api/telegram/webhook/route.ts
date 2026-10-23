import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type BotUserRole =
  | 'SUPERADMIN'
  | 'TENANT_OWNER'
  | 'MANAGER'
  | 'SPECIALIST'
  | 'OBSERVER'
  | string;

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
  id: string;
  company_id: string | null;
  role_type: BotUserRole;
  name?: string;
}

export interface WebhookProcessOptions {
  botToken?: string;
  siteUrl?: string;
  supabaseClient?: Pick<SupabaseClient, 'from'> | null;
  fetchImpl?: typeof fetch;
}

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

async function sendTelegramMessage(
  botToken: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (!botToken && fetchImpl === fetch) {
    return;
  }
  const endpoint = `https://api.telegram.org/bot${botToken || 'DEMO_BOT_TOKEN'}/sendMessage`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${errBody}`);
  }
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
 * Определяет тип маршрута для switch/case обработки входящего сообщения.
 */
function resolveRouteCommand(
  rawText: string
): '/start' | '/help' | '/new' | 'TEXT' {
  const normalized = rawText.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
  if (normalized === '/start') return '/start';
  if (normalized === '/help') return '/help';
  if (normalized === '/new') return '/new';
  return 'TEXT';
}

/**
 * Основная серверная логика обработки вебхука Telegram и маршрутизации ролей.
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
    | 'unauthorized_text'
    | 'ignored';
  chatId: number | null;
  replyPayload?: Record<string, unknown>;
}> {
  const message = update.message;
  const chatId = message?.chat?.id ?? null;
  const rawText = message?.text?.trim() ?? '';

  if (!chatId || !rawText) {
    return { ok: true, action: 'ignored', chatId };
  }

  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const siteUrl = (
    options?.siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'https://app.tedcloud.ru'
  ).replace(/\/$/, '');
  const supabase =
    options?.supabaseClient !== undefined
      ? options.supabaseClient
      : getServerSupabaseClient();
  const fetchFn = options?.fetchImpl ?? fetch;

  // 1. Авторизация и проверка ролей в таблице organization_nodes
  let userNode: OrganizationNodeAuthRow | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from('organization_nodes')
      .select('id, company_id, role_type, name')
      .eq('telegram_chat_id', String(chatId))
      .maybeSingle();

    if (!error && data) {
      userNode = data as OrganizationNodeAuthRow;
    }
  }

  const command = resolveRouteCommand(rawText);

  // 2. Маршрутизация (switch / case) с учетом ролей
  switch (command) {
    case '/start': {
      if (userNode) {
        const startParam = extractStartAppParam(rawText);
        const targetWebAppUrl = buildDeepLinkedWebAppUrl(siteUrl, startParam);

        const replyPayload = {
          chat_id: chatId,
          text: 'Добро пожаловать в рабочее пространство!',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть TedCloud',
                  web_app: {
                    url: targetWebAppUrl,
                  },
                },
              ],
            ],
          },
        };

        await sendTelegramMessage(botToken, replyPayload, fetchFn);
        return {
          ok: true,
          action: 'start_authorized',
          chatId,
          replyPayload,
        };
      } else {
        const replyPayload = {
          chat_id: chatId,
          text: `Доступ закрыт. Ваш Telegram ID: ${chatId}. Передайте его руководителю для получения доступа.`,
        };

        await sendTelegramMessage(botToken, replyPayload, fetchFn);
        return {
          ok: true,
          action: 'start_unauthorized',
          chatId,
          replyPayload,
        };
      }
    }

    case '/help': {
      const replyPayload = {
        chat_id: chatId,
        text: 'Отправьте текстовое сообщение или используйте команду /new, чтобы создать задачу. Статус отслеживайте в приложении.',
      };

      await sendTelegramMessage(botToken, replyPayload, fetchFn);
      return {
        ok: true,
        action: 'help_sent',
        chatId,
        replyPayload,
      };
    }

    case '/new': {
      const replyPayload = {
        chat_id: chatId,
        text: 'Опишите суть задачи:',
      };

      await sendTelegramMessage(botToken, replyPayload, fetchFn);
      return {
        ok: true,
        action: 'new_task_prompt',
        chatId,
        replyPayload,
      };
    }

    case 'TEXT':
    default: {
      if (!userNode) {
        const replyPayload = {
          chat_id: chatId,
          text: `Доступ закрыт. Ваш Telegram ID: ${chatId}. Передайте его руководителю для получения доступа.`,
        };

        await sendTelegramMessage(botToken, replyPayload, fetchFn);
        return {
          ok: true,
          action: 'unauthorized_text',
          chatId,
          replyPayload,
        };
      }

      // Проверка прав: роль OBSERVER не имеет права создавать задачи
      const normalizedRole = String(userNode.role_type || '').toUpperCase();
      if (normalizedRole === 'OBSERVER') {
        const replyPayload = {
          chat_id: chatId,
          text: 'У вас нет прав на создание задач.',
        };

        await sendTelegramMessage(botToken, replyPayload, fetchFn);
        return {
          ok: true,
          action: 'observer_denied',
          chatId,
          replyPayload,
        };
      }

      // Создание задачи в таблице tasks (SUPERADMIN, TENANT_OWNER, MANAGER, SPECIALIST)
      if (supabase) {
        const { error: insertError } = await supabase.from('tasks').insert({
          title: rawText,
          company_id: userNode.company_id,
          status: 'new',
          created_by: userNode.id,
        });

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      const replyPayload = {
        chat_id: chatId,
        text: '✅ Задача сохранена в системе.',
      };

      await sendTelegramMessage(botToken, replyPayload, fetchFn);
      return {
        ok: true,
        action: 'task_saved',
        chatId,
        replyPayload,
      };
    }
  }
}

/**
 * Next.js App Router POST Route: app/api/telegram/webhook/route.ts
 * Всегда возвращает Response('OK', { status: 200 }), чтобы Telegram не дублировал вебхуки.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const update = (await request.json()) as TelegramUpdate;
    await processTelegramWebhook(update);
  } catch (error) {
    console.error('[Telegram Webhook Error]:', error);
  }

  return new Response('OK', { status: 200 });
}
