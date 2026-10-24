import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  tasks: [
    'title',
    'type',
    'priority',
    'status',
    'assigned_to',
    'owner_node_id',
    'company_id',
    'created_by',
  ],
  organization_nodes: [
    'name',
    'role_type',
    'telegram_chat_id',
    'email',
    'department',
    'invite_code',
    'access_level',
    'permissions',
    'company_id',
    'user_id',
    'tree_path',
  ],
};

function sanitizeByWhitelist(table: string, rawPayload: Record<string, any>): Record<string, any> {
  const whitelist = ALLOWED_COLUMNS[table];
  const clean: Record<string, any> = {};
  const keys = whitelist || Object.keys(rawPayload);
  for (const key of keys) {
    if (rawPayload[key] !== undefined) {
      clean[key] = rawPayload[key];
    }
  }
  return clean;
}

function extractMissingColumnName(error: any): string | null {
  const msg = String(error?.message || error?.details || '');
  const matchCache = msg.match(/Could not find the '([^']+)' column/i);
  if (matchCache && matchCache[1]) return matchCache[1];
  const matchPg = msg.match(/column "([^"]+)" of relation/i);
  if (matchPg && matchPg[1]) return matchPg[1];
  return null;
}

async function safeWebhookInsert(
  supabase: SupabaseClient,
  table: string,
  rawPayload: Record<string, any>
): Promise<{ data: any; error: any }> {
  const payload = sanitizeByWhitelist(table, rawPayload);

  for (let attempt = 0; attempt < 14; attempt++) {
    const { data, error } = await supabase.from(table).insert([payload]).select().single();
    if (!error) return { data, error: null };

    const missingCol = extractMissingColumnName(error);
    if (
      (error.code === 'PGRST204' || error.code === '42703' || missingCol) &&
      missingCol &&
      missingCol in payload
    ) {
      delete payload[missingCol];
      continue;
    }

    if (
      'tree_path' in payload &&
      String(error?.message || '').toLowerCase().includes('tree_path')
    ) {
      delete payload.tree_path;
      continue;
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: new Error(`Webhook safe insert exceeded fallback attempts for ${table}`),
  };
}

async function safeWebhookUpdate(
  supabase: SupabaseClient,
  table: string,
  id: string,
  rawUpdates: Record<string, any>
): Promise<{ data: any; error: any }> {
  const payload = sanitizeByWhitelist(table, rawUpdates);

  for (let attempt = 0; attempt < 14; attempt++) {
    if (Object.keys(payload).length === 0) {
      return { data: { id, ...rawUpdates }, error: null };
    }

    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (!error) return { data, error: null };

    const missingCol = extractMissingColumnName(error);
    if (
      (error.code === 'PGRST204' || error.code === '42703' || missingCol) &&
      missingCol &&
      missingCol in payload
    ) {
      delete payload[missingCol];
      continue;
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: new Error(`Webhook safe update exceeded fallback attempts for ${table}`),
  };
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildWebAppKeyboard(siteUrl: string, chatId: string, extraRows: any[][] = []) {
  return {
    inline_keyboard: [
      ...extraRows,
      [
        {
          text: 'Открыть панель TedCloud',
          url: `${siteUrl}/?chatId=${chatId}`,
        },
      ],
    ],
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  let chatId: string | undefined;

  const sendTelegramMessage = async (
    targetChatId: string,
    text: string,
    extra: Record<string, any> = {}
  ) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('[WEBHOOK] TELEGRAM_BOT_TOKEN is missing');
      return;
    }
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text,
          parse_mode: 'HTML',
          ...extra,
        }),
      });
    } catch (fetchErr) {
      console.error('[WEBHOOK] Failed to call Telegram sendMessage:', fetchErr);
    }
  };

  const answerCallbackQuery = async (callbackQueryId: string, text: string) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      });
    } catch (err) {
      console.error('[WEBHOOK] Failed to answerCallbackQuery:', err);
    }
  };

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Не заданы переменные окружения NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.'
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      'https://tedcloud.vercel.app'
    ).replace(/\/$/, '');

    // Обработка inline-кнопок управления задачей
    if (body?.callback_query) {
      const cb = body.callback_query;
      const cbId = cb.id;
      const cbData = String(cb.data || '');
      const cbChatId = cb.message?.chat?.id ? String(cb.message.chat.id) : undefined;
      chatId = cbChatId;

      if (cbData.startsWith('task_progress:') || cbData.startsWith('task_done:')) {
        const [action, taskId] = cbData.split(':');
        const nextStatus = action === 'task_done' ? 'Done' : 'In Progress';
        const statusLabel = action === 'task_done' ? 'Выполнено' : 'В работе';

        if (taskId) {
          await safeWebhookUpdate(supabase, 'tasks', taskId, { status: nextStatus });
        }

        if (cbId) {
          await answerCallbackQuery(cbId, `Статус задачи обновлен: ${statusLabel}`);
        }

        if (cbChatId) {
          await sendTelegramMessage(
            cbChatId,
            `<b>СТАТУС ЗАДАЧИ ОБНОВЛЕН</b>\nНовое состояние: <b>${statusLabel}</b>`,
            {
              reply_markup: buildWebAppKeyboard(siteUrl, cbChatId),
            }
          );
        }
      }

      return res.status(200).send('OK');
    }

    const message = body?.message || body?.edited_message;
    const rawChatId = message?.chat?.id;
    const rawText: string = (message?.text || '').trim();
    const firstName: string = message?.from?.first_name || 'Сотрудник';

    if (!rawChatId) {
      return res.status(200).send('OK');
    }

    chatId = String(rawChatId).trim();

    const resolveCompanyId = async (): Promise<string> => {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) return existingCompany.id;

      const { data: newCompany, error: createCompanyError } = await supabase
        .from('companies')
        .insert([{ name: 'Корпоративное пространство' }])
        .select('id')
        .single();

      if (createCompanyError || !newCompany) {
        throw new Error(
          `Ошибка создания компании: ${createCompanyError?.message || 'Unknown error'}`
        );
      }

      return newCompany.id;
    };

    const findOrCreateUserByChatId = async (inviteParam?: string): Promise<any> => {
      const { data: allNodes, error: nodesErr } = await supabase
        .from('organization_nodes')
        .select('*');

      if (nodesErr) {
        throw new Error(`Ошибка чтения профилей сотрудников: ${nodesErr.message}`);
      }

      const list = allNodes || [];

      if (inviteParam) {
        const cleanInvite = inviteParam.trim().toLowerCase();
        const invitedNode = list.find(
          (n: any) => String(n.invite_code || '').trim().toLowerCase() === cleanInvite
        );
        if (invitedNode) {
          const { data: updatedNode } = await safeWebhookUpdate(
            supabase,
            'organization_nodes',
            invitedNode.id,
            { telegram_chat_id: chatId }
          );
          return { ...invitedNode, ...(updatedNode || {}), telegram_chat_id: chatId };
        }
      }

      const existingByChat = list.find(
        (n: any) => String(n.telegram_chat_id || '').trim() === chatId
      );
      if (existingByChat) {
        return existingByChat;
      }

      const companyId = list[0]?.company_id || (await resolveCompanyId());
      const isFirstNode = list.length === 0;
      const roleTitle = isFirstNode ? 'Генеральный директор' : 'Специалист';
      const inviteCode = isFirstNode
        ? 'TC-ROOT'
        : `TC-${String(chatId).slice(-4).padStart(4, '0')}`;

      const rawNewNode = {
        company_id: companyId,
        user_id: `tg_${chatId}`,
        name: firstName,
        role_type: roleTitle,
        department: isFirstNode ? 'Дирекция' : 'Основное подразделение',
        telegram_chat_id: chatId,
        invite_code: inviteCode,
        access_level: isFirstNode ? 'root' : 'member',
        tree_path: 'root',
      };

      const { data: insertedNode, error: insertErr } = await safeWebhookInsert(
        supabase,
        'organization_nodes',
        rawNewNode
      );

      if (insertErr) {
        if (list[0]) return list[0];
        throw new Error(`Ошибка регистрации профиля: ${insertErr.message}`);
      }

      return { ...rawNewNode, ...(insertedNode || {}) };
    };

    // =========================================================================
    // 1. КОМАНДА /start [TC-XXXX]
    // =========================================================================
    if (rawText === '/start' || rawText.startsWith('/start ') || rawText.startsWith('/start@')) {
      const parts = rawText.split(/\s+/);
      const startParam = parts.length > 1 ? parts[1].trim() : '';

      const user = await findOrCreateUserByChatId(startParam);
      const userName = escapeHtml(user?.name || firstName);
      const userRole = escapeHtml(user?.role_type || 'Специалист');

      const startHtml = `<b>TEDCLOUD WORKSPACE</b>\nСтатус: Сессия активна\nСотрудник: ${userName} (${userRole})\nTelegram ID: ${chatId}\n\nДоступные команды:\n/tasks — Список активных задач\n/new — Создать задачу`;

      await sendTelegramMessage(chatId, startHtml, {
        reply_markup: buildWebAppKeyboard(siteUrl, chatId),
      });

      return res.status(200).send('OK');
    }

    // =========================================================================
    // 2. КОМАНДА /tasks — Список активных задач
    // =========================================================================
    if (rawText === '/tasks' || rawText.startsWith('/tasks@')) {
      const user = await findOrCreateUserByChatId();

      const { data: allTasks, error: tasksErr } = await supabase
        .from('tasks')
        .select('*');

      if (tasksErr) {
        throw new Error(`Ошибка загрузки реестра задач: ${tasksErr.message}`);
      }

      const activeTasks = (allTasks || []).filter(
        (t: any) =>
          t.status !== 'Done' &&
          (t.assigned_to === user.id || t.owner_node_id === user.id)
      );

      if (activeTasks.length === 0) {
        await sendTelegramMessage(
          chatId,
          `<b>TEDCLOUD WORKSPACE</b>\nСотрудник: ${escapeHtml(user.name)} (${escapeHtml(
            user.role_type || 'Специалист'
          )})\nАктивных невыполненных задач не числится.`,
          {
            reply_markup: buildWebAppKeyboard(siteUrl, chatId),
          }
        );
        return res.status(200).send('OK');
      }

      const lines = activeTasks.map((t: any, index: number) => {
        const prio =
          t.priority === 'High' ? 'Высокий' : t.priority === 'Low' ? 'Низкий' : 'Средний';
        const st = t.status === 'In Progress' ? 'В работе' : 'К выполнению';
        return `${index + 1}. [${prio} | ${st}] ${escapeHtml(t.title)}`;
      });

      const firstTask = activeTasks[0];
      const extraRows: any[][] = [];
      if (firstTask?.id) {
        extraRows.push([
          { text: 'Принять в работу', callback_data: `task_progress:${firstTask.id}` },
          { text: 'Завершить задачу', callback_data: `task_done:${firstTask.id}` },
        ]);
      }

      await sendTelegramMessage(
        chatId,
        [
          `<b>АКТИВНЫЕ ЗАДАЧИ (${activeTasks.length})</b>`,
          `Сотрудник: ${escapeHtml(user.name)} (${escapeHtml(user.role_type || 'Специалист')})`,
          '',
          ...lines,
        ].join('\n'),
        {
          reply_markup: buildWebAppKeyboard(siteUrl, chatId, extraRows),
        }
      );

      return res.status(200).send('OK');
    }

    // =========================================================================
    // 3. КОМАНДА /new ИЛИ ЛЮБОЙ ТЕКСТ ЧАТА — Создание задачи
    // =========================================================================
    if (rawText === '/new' || rawText.startsWith('/new@')) {
      await sendTelegramMessage(
        chatId,
        '<b>СОЗДАНИЕ ЗАДАЧИ</b>\nОтправьте текст задачи следующим сообщением. Для высокого приоритета начните сообщение с символа «!».\nПример: <code>!Согласовать коммерческое предложение</code>',
        {
          reply_markup: buildWebAppKeyboard(siteUrl, chatId),
        }
      );
      return res.status(200).send('OK');
    }

    if (rawText.length > 0) {
      const user = await findOrCreateUserByChatId();
      const companyId = user.company_id || (await resolveCompanyId());

      const strippedCommandText = rawText.startsWith('/new ')
        ? rawText.slice(5).trim()
        : rawText;

      const isUrgent = strippedCommandText.startsWith('!');
      const cleanTitle = isUrgent ? strippedCommandText.slice(1).trim() : strippedCommandText;
      const taskPriority = isUrgent ? 'High' : 'Medium';
      const priorityLabel = isUrgent ? 'Высокий' : 'Средний';

      if (!cleanTitle) {
        await sendTelegramMessage(
          chatId,
          '<b>ОШИБКА ФОРМАТА</b>\nУкажите наименование задачи.',
          {
            reply_markup: buildWebAppKeyboard(siteUrl, chatId),
          }
        );
        return res.status(200).send('OK');
      }

      const { data: createdTask, error: taskInsertError } = await safeWebhookInsert(
        supabase,
        'tasks',
        {
          company_id: companyId,
          title: cleanTitle,
          type: 'Task',
          priority: taskPriority,
          status: 'Todo',
          owner_node_id: user.id,
          assigned_to: user.id,
          created_by: user.id,
        }
      );

      if (taskInsertError) {
        throw new Error(`Ошибка записи задачи в БД: ${taskInsertError.message}`);
      }

      const extraRows: any[][] = [];
      if (createdTask?.id) {
        extraRows.push([
          { text: 'Принять в работу', callback_data: `task_progress:${createdTask.id}` },
          { text: 'Завершить задачу', callback_data: `task_done:${createdTask.id}` },
        ]);
      }

      await sendTelegramMessage(
        chatId,
        [
          '<b>ЗАДАЧА СОЗДАНА</b>',
          `Наименование: ${escapeHtml(cleanTitle)}`,
          `Приоритет: ${priorityLabel}`,
          'Статус: К выполнению',
          `Исполнитель: ${escapeHtml(user.name || firstName)} (${escapeHtml(
            user.role_type || 'Специалист'
          )})`,
        ].join('\n'),
        {
          reply_markup: buildWebAppKeyboard(siteUrl, chatId, extraRows),
        }
      );
    }

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error('[WEBHOOK] Critical Failure:', error);

    if (chatId) {
      await sendTelegramMessage(
        chatId,
        `<b>СИСТЕМНОЕ СООБЩЕНИЕ TEDCLOUD</b>\n${escapeHtml(error?.message || String(error))}`
      );
    }

    return res.status(200).send('OK');
  }
}
