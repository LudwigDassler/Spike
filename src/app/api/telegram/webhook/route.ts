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

interface OrganizationNodeWithCompany {
  id: string;
  name: string;
  role_type: string;
  company_id?: string | null;
  companies?: { name?: string } | Array<{ name?: string }> | null;
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
 * Извлекает параметр startapp из команды /start <startParam> или текста сообщения для Deep Linking.
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
 * Основной движок обработки входящего Telegram Webhook (Multi-Tenancy + Deep Linking).
 */
export async function processTelegramWebhook(
  update: TelegramUpdate,
  options?: WebhookProcessOptions
): Promise<{
  ok: boolean;
  action: 'employee_active' | 'guest_lead_captured' | 'ignored';
  chatId: number | null;
  companyName?: string;
  webAppUrl?: string;
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

  // 1. Проверяем наличие пользователя в organization_nodes по telegram_chat_id + подтягиваем название компании
  let existingNode: OrganizationNodeWithCompany | null = null;
  let companyName = 'TedCloud Enterprise';

  if (supabase) {
    const { data } = await supabase
      .from('organization_nodes')
      .select('id, name, role_type, company_id, companies(name)')
      .eq('telegram_chat_id', String(chatId))
      .maybeSingle();

    if (data) {
      existingNode = data as OrganizationNodeWithCompany;
      const joinedCompany = existingNode.companies;
      if (Array.isArray(joinedCompany) && joinedCompany[0]?.name) {
        companyName = joinedCompany[0].name;
      } else if (
        joinedCompany &&
        !Array.isArray(joinedCompany) &&
        joinedCompany.name
      ) {
        companyName = joinedCompany.name;
      }
    }
  }

  // 2. Извлекаем параметр startapp (для открытия конкретной задачи в Mini App по Deep Link)
  const startAppParam = extractStartAppParam(rawText);
  const targetWebAppUrl = buildDeepLinkedWebAppUrl(siteUrl, startAppParam);

  // СЦЕНАРИЙ 1: Зарегистрированный сотрудник (найден в organization_nodes)
  if (existingNode) {
    const replyPayload = {
      chat_id: chatId,
      text: `⚡️ TedCloud активен. Рабочее пространство [${companyName}] готово.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть систему',
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
      action: 'employee_active',
      chatId,
      companyName,
      webAppUrl: targetWebAppUrl,
      replyPayload,
    };
  }

  // СЦЕНАРИЙ 2: Неизвестный пользователь (отсутствует в organization_nodes)
  // Сохраняем обращение в crm_leads с пустым company_id (null) для ручного разбора
  if (supabase) {
    await supabase.from('crm_leads').insert({
      company_id: null,
      stage: 'new',
      full_name:
        [message?.from?.first_name, message?.from?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Новый контакт из ТГ',
      telegram_chat_id: String(chatId),
      description: rawText,
    });
  }

  const replyPayload = {
    chat_id: chatId,
    text: `Добро пожаловать в TedCloud! Ваш ID: ${chatId}. Передайте его руководителю для приглашения в рабочее пространство компании, либо оставьте заявку.`,
  };

  await sendTelegramMessage(botToken, replyPayload, fetchFn);
  return {
    ok: true,
    action: 'guest_lead_captured',
    chatId,
    replyPayload,
  };
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
