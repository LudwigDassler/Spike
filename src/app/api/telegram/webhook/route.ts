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

export const TEDCLOUD_HELP_MESSAGE = [
  '📖 Справка по интерактивному боту TedCloud:',
  '',
  '• /start — Открыть рабочее пространство TedCloud (Web App)',
  '• /help — Показать список команд и возможностей',
  '• /new <текст> — Быстро поставить задачу',
  '',
  '💡 Быстрая постановка задач (Natural Language to Task):',
  'Просто отправьте любое текстовое сообщение в этот чат — бот автоматически зарегистрирует новую задачу в рабочем пространстве вашей компании.',
].join('\n');

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
 * Основной движок обработки входящего Telegram Webhook:
 * - /start: Приветствие + кнопка Web App (или ID для гостя)
 * - /help: Текстовая инструкция и возможности бота
 * - Обычный текст от сотрудника (Natural Language to Task) или /new: INSERT в tasks + текстовое подтверждение
 * - Обычный текст от неизвестного контакта: INSERT в crm_leads (company_id = null)
 */
export async function processTelegramWebhook(
  update: TelegramUpdate,
  options?: WebhookProcessOptions
): Promise<{
  ok: boolean;
  action:
    | 'employee_active'
    | 'help_sent'
    | 'task_created'
    | 'guest_start'
    | 'guest_lead_captured'
    | 'db_error'
    | 'ignored';
  chatId: number | null;
  companyName?: string;
  webAppUrl?: string;
  replyPayload?: Record<string, unknown>;
  error?: string;
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

  // 1. Проверяем наличие пользователя в organization_nodes по telegram_chat_id
  let existingNode: OrganizationNodeWithCompany | null = null;
  let companyName = 'TedCloud Enterprise';

  if (supabase) {
    try {
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
    } catch {
      // Если не удалось загрузить связь companies, продолжаем с дефолтным именем
    }
  }

  const isStartCommand = /^\/start(@\S+)?(\s+.*)?$/i.test(rawText);
  const isHelpCommand = /^\/help(@\S+)?(\s+.*)?$/i.test(rawText);
  const isNewCommand = /^\/new(@\S+)?(\s+.*)?$/i.test(rawText);
  const isOtherCommand =
    rawText.startsWith('/') && !isStartCommand && !isHelpCommand && !isNewCommand;

  // КОМАНДА 1: /help — Инструкция и список возможностей
  if (isHelpCommand) {
    const replyPayload = {
      chat_id: chatId,
      text: TEDCLOUD_HELP_MESSAGE,
    };

    await sendTelegramMessage(botToken, replyPayload, fetchFn);
    return {
      ok: true,
      action: 'help_sent',
      chatId,
      replyPayload,
    };
  }

  // КОМАНДА 2: /start — Приветствие с кнопкой Web App
  if (isStartCommand) {
    const startAppParam = extractStartAppParam(rawText);
    const targetWebAppUrl = buildDeepLinkedWebAppUrl(siteUrl, startAppParam);

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

    const guestStartPayload = {
      chat_id: chatId,
      text: `Добро пожаловать в TedCloud! Ваш ID: ${chatId}. Передайте его руководителю для приглашения в рабочее пространство компании, либо оставьте заявку.`,
    };

    await sendTelegramMessage(botToken, guestStartPayload, fetchFn);
    return {
      ok: true,
      action: 'guest_start',
      chatId,
      replyPayload: guestStartPayload,
    };
  }

  if (isOtherCommand) {
    return { ok: true, action: 'ignored', chatId };
  }

  // Извлекаем текст задачи (для обычного сообщения или команды /new <текст>)
  const taskTitle = isNewCommand
    ? rawText.replace(/^\/new(@\S+)?\s*/i, '').trim()
    : rawText;

  // СЦЕНАРИЙ 3: Natural Language to Task (сообщение от зарегистрированного сотрудника)
  if (existingNode) {
    if (!taskTitle) {
      const promptPayload = {
        chat_id: chatId,
        text: 'Напишите текст задачи одним сообщением (или после команды /new), чтобы зарегистрировать её в TedCloud.',
      };
      await sendTelegramMessage(botToken, promptPayload, fetchFn);
      return { ok: true, action: 'ignored', chatId, replyPayload: promptPayload };
    }

    if (supabase) {
      try {
        const insertResult = await supabase.from('tasks').insert({
          title: taskTitle,
          status: 'new',
          company_id: existingNode.company_id ?? null,
          created_by: existingNode.id,
          type: 'client',
          priority: 'medium',
        });

        if (insertResult && 'error' in insertResult && insertResult.error) {
          throw new Error(insertResult.error.message);
        }
      } catch (dbErr) {
        const errMessage = (dbErr as Error).message;
        const errorReply = {
          chat_id: chatId,
          text: `❌ Не удалось сохранить задачу в БД: ${errMessage}`,
        };
        await sendTelegramMessage(botToken, errorReply, fetchFn);
        return {
          ok: false,
          action: 'db_error',
          chatId,
          error: errMessage,
          replyPayload: errorReply,
        };
      }
    }

    const replyPayload = {
      chat_id: chatId,
      text: '✅ Задача зарегистрирована. Вы можете отслеживать её статус в рабочем пространстве.',
    };

    await sendTelegramMessage(botToken, replyPayload, fetchFn);
    return {
      ok: true,
      action: 'task_created',
      chatId,
      companyName,
      replyPayload,
    };
  }

  // СЦЕНАРИЙ 4: Сообщение от неизвестного пользователя -> сохраняем лид в crm_leads
  if (supabase) {
    try {
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
    } catch {
      // Логируем ошибку записи гостевого лида без прерывания ответа пользователю
    }
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
