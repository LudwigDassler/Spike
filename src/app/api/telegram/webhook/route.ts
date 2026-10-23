import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TelegramUpdate {
  update_id: number;
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
 * Основная бизнес-логика обработки входящего Telegram Webhook (команда /start и входящие лиды).
 */
export async function processTelegramWebhook(
  update: TelegramUpdate,
  options?: WebhookProcessOptions
): Promise<{
  ok: boolean;
  action: 'employee_start' | 'guest_start' | 'lead_created' | 'ignored';
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

  // 1. Проверяем наличие пользователя в таблице organization_nodes по telegram_chat_id
  let existingNode: { id: string; name: string; role_type: string } | null = null;

  if (supabase) {
    const { data } = await supabase
      .from('organization_nodes')
      .select('id, name, role_type')
      .eq('telegram_chat_id', String(chatId))
      .maybeSingle();

    if (data) {
      existingNode = data as { id: string; name: string; role_type: string };
    }
  }

  const isCommand = rawText.startsWith('/');
  const isStartCommand = /^\/start(@\S+)?(\s+.*)?$/i.test(rawText);

  // СЦЕНАРИЙ А: Команда /start
  if (isStartCommand) {
    if (existingNode) {
      // Пользователь найден (сотрудник / партнёр)
      const replyPayload = {
        chat_id: chatId,
        text: '⚡️ С возвращением в TedCloud! Ваше рабочее пространство готово.',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Открыть систему',
                web_app: {
                  url: siteUrl,
                },
              },
            ],
          ],
        },
      };

      await sendTelegramMessage(botToken, replyPayload, fetchFn);
      return {
        ok: true,
        action: 'employee_start',
        chatId,
        replyPayload,
      };
    } else {
      // Пользователь НЕ найден (незнакомец / клиент)
      const replyPayload = {
        chat_id: chatId,
        text: `Добро пожаловать в TedCloud! Ваш Telegram ID: ${chatId}. Если вы сотрудник, передайте его администратору. Если у вас вопрос — просто напишите его сюда.`,
      };

      await sendTelegramMessage(botToken, replyPayload, fetchFn);
      return {
        ok: true,
        action: 'guest_start',
        chatId,
        replyPayload,
      };
    }
  }

  // СЦЕНАРИЙ Б: Любое текстовое сообщение (кроме команд)
  if (!isCommand) {
    if (!existingNode) {
      if (supabase) {
        await supabase.from('crm_leads').insert({
          stage: 'new',
          full_name: 'Новый контакт из ТГ',
          telegram_chat_id: String(chatId),
          description: rawText,
        });
      }

      const replyPayload = {
        chat_id: chatId,
        text: 'Ваша заявка принята! Мы свяжемся с вами в ближайшее время.',
      };

      await sendTelegramMessage(botToken, replyPayload, fetchFn);
      return {
        ok: true,
        action: 'lead_created',
        chatId,
        replyPayload,
      };
    }
  }

  return { ok: true, action: 'ignored', chatId };
}

/**
 * Next.js App Router POST Route: app/api/telegram/webhook/route.ts
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const result = await processTelegramWebhook(update);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 200 }
    );
  }
}
