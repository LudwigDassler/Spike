import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Серверная память ожидающих делегирования чатов + дублирование в permissions.pending_delegate_to для Serverless
const pendingDelegateMap = new Map<string, string>();

const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  tasks: [
    'title',
    'description',
    'notes',
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

  for (let attempt = 0; attempt < 16; attempt++) {
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

  for (let attempt = 0; attempt < 16; attempt++) {
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

function resolveUserPermissions(user: any): {
  accessLevel: 'root' | 'manager' | 'member' | 'observer';
  accessLabel: string;
  canAssignTasks: boolean;
  canViewCrm: boolean;
  rawPerms: Record<string, any>;
} {
  const roleUpper = String(user?.role_type || '').trim().toUpperCase();
  const rawLevel = String(user?.access_level || '').trim().toLowerCase();

  let accessLevel: 'root' | 'manager' | 'member' | 'observer' = 'member';
  if (roleUpper === 'SUPERADMIN' || rawLevel === 'root' || user?.tree_path === 'root') {
    accessLevel = 'root';
  } else if (rawLevel === 'manager') {
    accessLevel = 'manager';
  } else if (rawLevel === 'observer' || rawLevel === 'viewer') {
    accessLevel = 'observer';
  }

  let parsedPerms = user?.permissions;
  if (typeof parsedPerms === 'string') {
    try {
      parsedPerms = JSON.parse(parsedPerms);
    } catch {
      parsedPerms = {};
    }
  }
  const rawPerms = parsedPerms && typeof parsedPerms === 'object' ? parsedPerms : {};

  const canAssignTasks =
    accessLevel === 'root' ||
    accessLevel === 'manager' ||
    rawPerms.tasks_assign === true ||
    rawPerms.canAssignTasks === true;

  const canViewCrm =
    accessLevel === 'root' ||
    accessLevel === 'manager' ||
    accessLevel === 'observer' ||
    rawPerms.crm_view === true ||
    rawPerms.canManageCrm === true;

  const accessLabel =
    accessLevel === 'root'
      ? 'Суперадминистратор'
      : accessLevel === 'manager'
      ? 'Руководитель подразделения'
      : accessLevel === 'observer'
      ? 'Наблюдатель / Аудитор'
      : 'Штатный специалист';

  return {
    accessLevel,
    accessLabel,
    canAssignTasks,
    canViewCrm,
    rawPerms,
  };
}

function buildRoleCommandCenterKeyboard(siteUrl: string, chatId: string, user: any) {
  const { canAssignTasks, canViewCrm } = resolveUserPermissions(user);
  const rows: any[][] = [
    [{ text: 'Мои активные задачи', callback_data: 'menu_my_tasks' }],
  ];

  if (canAssignTasks) {
    rows.push([{ text: 'Поручить задачу коллеге', callback_data: 'menu_delegate' }]);
  }

  if (canViewCrm) {
    rows.push([{ text: 'Финансовая сводка CRM', callback_data: 'menu_crm_digest' }]);
  }

  rows.push([
    {
      text: 'Открыть панель TedCloud',
      url: `${siteUrl}/?chatId=${chatId}`,
    },
  ]);

  return { inline_keyboard: rows };
}

function buildWebAppKeyboard(siteUrl: string, chatId: string, extraRows: any[][] = []) {
  return {
    inline_keyboard: [
      ...extraRows,
      [{ text: 'Командное меню', callback_data: 'menu_home' }],
      [
        {
          text: 'Открыть панель TedCloud',
          url: `${siteUrl}/?chatId=${chatId}`,
        },
      ],
    ],
  };
}

function formatRubCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('ru-RU')} RUB`;
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

    const findOrCreateUserByChatId = async (
      targetChatId: string,
      firstNameFallback = 'Сотрудник',
      inviteParam?: string
    ): Promise<any> => {
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
            { telegram_chat_id: targetChatId }
          );
          return { ...invitedNode, ...(updatedNode || {}), telegram_chat_id: targetChatId };
        }
      }

      const existingByChat = list.find(
        (n: any) => String(n.telegram_chat_id || '').trim() === targetChatId
      );
      if (existingByChat) {
        return existingByChat;
      }

      const companyId = list[0]?.company_id || (await resolveCompanyId());
      const isFirstNode = list.length === 0;
      const roleTitle = isFirstNode ? 'Генеральный директор' : 'Специалист';
      const inviteCode = isFirstNode
        ? 'TC-ROOT'
        : `TC-${String(targetChatId).slice(-4).padStart(4, '0')}`;

      const rawNewNode = {
        company_id: companyId,
        user_id: `tg_${targetChatId}`,
        name: firstNameFallback,
        role_type: roleTitle,
        department: isFirstNode ? 'Дирекция' : 'Основное подразделение',
        telegram_chat_id: targetChatId,
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

    const sendCommandCenterCard = async (targetChatId: string, user: any) => {
      const { accessLabel } = resolveUserPermissions(user);
      const userName = escapeHtml(user?.name || 'Сотрудник');
      const userRole = escapeHtml(user?.role_type || 'Специалист');
      const userDept = user?.department ? `\nПодразделение: ${escapeHtml(user.department)}` : '';

      const menuHtml = [
        '<b>TEDCLOUD WORKSPACE | КОМАНДНЫЙ ЦЕНТР</b>',
        'Статус: Корпоративная сессия активна',
        `Сотрудник: ${userName}`,
        `Должность: ${userRole}${userDept}`,
        `Контур доступа: ${accessLabel}`,
        `Telegram ID: <code>${targetChatId}</code>`,
        '',
        'Доступные команды:',
        '/menu — Интерактивный командный центр',
        '/tasks — Список моих активных задач',
        '/new — Поставить новую задачу',
        '/digest — Финансовая сводка CRM и задач',
      ].join('\n');

      await sendTelegramMessage(targetChatId, menuHtml, {
        reply_markup: buildRoleCommandCenterKeyboard(siteUrl, targetChatId, user),
      });
    };

    const sendActiveTasksList = async (targetChatId: string, user: any) => {
      const { data: allTasks, error: tasksErr } = await supabase.from('tasks').select('*');

      if (tasksErr) {
        throw new Error(`Ошибка загрузки реестра задач: ${tasksErr.message}`);
      }

      const activeTasks = (allTasks || []).filter(
        (t: any) =>
          t.status !== 'Done' &&
          (t.assigned_to === user.id || t.owner_node_id === user.id || t.created_by === user.id)
      );

      if (activeTasks.length === 0) {
        await sendTelegramMessage(
          targetChatId,
          [
            '<b>АКТИВНЫЕ ЗАДАЧИ</b>',
            `Сотрудник: ${escapeHtml(user.name)} (${escapeHtml(user.role_type || 'Специалист')})`,
            'Активных невыполненных задач не числится.',
          ].join('\n'),
          {
            reply_markup: buildRoleCommandCenterKeyboard(siteUrl, targetChatId, user),
          }
        );
        return;
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
        targetChatId,
        [
          `<b>АКТИВНЫЕ ЗАДАЧИ (${activeTasks.length})</b>`,
          `Сотрудник: ${escapeHtml(user.name)} (${escapeHtml(user.role_type || 'Специалист')})`,
          '',
          ...lines,
        ].join('\n'),
        {
          reply_markup: buildWebAppKeyboard(siteUrl, targetChatId, extraRows),
        }
      );
    };

    const sendFinancialCrmDigest = async (targetChatId: string, user: any) => {
      const { canViewCrm } = resolveUserPermissions(user);
      if (!canViewCrm) {
        await sendTelegramMessage(
          targetChatId,
          '<b>ОГРАНИЧЕНИЕ ДОСТУПА</b>\nВаш профиль не обладает полномочиями для просмотра финансовой сводки CRM.',
          {
            reply_markup: buildRoleCommandCenterKeyboard(siteUrl, targetChatId, user),
          }
        );
        return;
      }

      const [tasksRes, leadsRes] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('crm_leads').select('*'),
      ]);

      const allTasks = tasksRes.data || [];
      const allLeads = leadsRes.data || [];

      const openTasks = allTasks.filter((t: any) => t.status !== 'Done');
      const highPriorityOpen = openTasks.filter((t: any) => t.priority === 'High');

      const totalDealsCount = allLeads.length;
      const activeLeads = allLeads.filter(
        (l: any) => (l.status || l.stage || 'New') !== 'Lost'
      );
      const wonLeads = allLeads.filter((l: any) => (l.status || l.stage) === 'Won');

      const activePipelineAmount = activeLeads.reduce(
        (sum: number, l: any) => sum + Number(l.amount ?? l.deal_value ?? 0),
        0
      );
      const wonAmount = wonLeads.reduce(
        (sum: number, l: any) => sum + Number(l.amount ?? l.deal_value ?? 0),
        0
      );

      const digestHtml = [
        '<b>ФИНАНСОВАЯ И ОПЕРАЦИОННАЯ СВОДКА TEDCLOUD</b>',
        `Запросил: ${escapeHtml(user.name)} (${escapeHtml(user.role_type || 'Специалист')})`,
        '',
        '<b>ОПЕРАЦИОННЫЙ КОНТУР ЗАДАЧ</b>',
        `Открытых задач в работе: <b>${openTasks.length}</b>`,
        `Задач высокого приоритета: <b>${highPriorityOpen.length}</b>`,
        '',
        '<b>КОММЕРЧЕСКИЙ КОНТУР CRM</b>',
        `Всего сделок в реестре: <b>${totalDealsCount}</b>`,
        `Сумма активного пайплайна: <b>${formatRubCurrency(activePipelineAmount)}</b>`,
        `Сумма закрытых контрактов (Won): <b>${formatRubCurrency(wonAmount)}</b>`,
      ].join('\n');

      await sendTelegramMessage(targetChatId, digestHtml, {
        reply_markup: buildRoleCommandCenterKeyboard(siteUrl, targetChatId, user),
      });
    };

    // =========================================================================
    // ОБРАБОТКА INLINE-КНОПОК (callback_query)
    // =========================================================================
    if (body?.callback_query) {
      const cb = body.callback_query;
      const cbId = cb.id;
      const cbData = String(cb.data || '');
      const cbChatId = cb.message?.chat?.id ? String(cb.message.chat.id).trim() : undefined;
      const cbFirstName = cb.from?.first_name || 'Сотрудник';
      chatId = cbChatId;

      if (!cbChatId) {
        return res.status(200).send('OK');
      }

      const user = await findOrCreateUserByChatId(cbChatId, cbFirstName);

      // 1. Смена статуса задачи
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

        await sendTelegramMessage(
          cbChatId,
          `<b>СТАТУС ЗАДАЧИ ОБНОВЛЕН</b>\nНовое состояние: <b>${statusLabel}</b>`,
          {
            reply_markup: buildRoleCommandCenterKeyboard(siteUrl, cbChatId, user),
          }
        );

        return res.status(200).send('OK');
      }

      // 2. Главное меню
      if (cbData === 'menu_home') {
        if (cbId) await answerCallbackQuery(cbId, 'Командный центр');
        await sendCommandCenterCard(cbChatId, user);
        return res.status(200).send('OK');
      }

      // 3. Мои активные задачи
      if (cbData === 'menu_my_tasks') {
        if (cbId) await answerCallbackQuery(cbId, 'Загрузка списка задач');
        await sendActiveTasksList(cbChatId, user);
        return res.status(200).send('OK');
      }

      // 4. Финансовая сводка CRM
      if (cbData === 'menu_crm_digest') {
        if (cbId) await answerCallbackQuery(cbId, 'Формирование сводки CRM');
        await sendFinancialCrmDigest(cbChatId, user);
        return res.status(200).send('OK');
      }

      // 5. Меню делегирования задачи коллеге
      if (cbData === 'menu_delegate') {
        const { canAssignTasks } = resolveUserPermissions(user);
        if (!canAssignTasks) {
          if (cbId) await answerCallbackQuery(cbId, 'Недостаточно прав для поручения задач');
          await sendTelegramMessage(
            cbChatId,
            '<b>ОГРАНИЧЕНИЕ ДОСТУПА</b>\nВаш уровень полномочий не позволяет назначать задачи другим сотрудникам.',
            {
              reply_markup: buildRoleCommandCenterKeyboard(siteUrl, cbChatId, user),
            }
          );
          return res.status(200).send('OK');
        }

        const { data: nodes } = await supabase.from('organization_nodes').select('*');
        const employees = nodes || [];

        const colleagueButtons = employees.slice(0, 12).map((emp: any) => [
          {
            text: `${emp.name} (${emp.role_type || 'Специалист'})`,
            callback_data: `delegate_to:${emp.id}`,
          },
        ]);
        colleagueButtons.push([{ text: 'Отмена', callback_data: 'menu_home' }]);

        if (cbId) await answerCallbackQuery(cbId, 'Выберите исполнителя');
        await sendTelegramMessage(
          cbChatId,
          [
            '<b>ДЕЛЕГИРОВАНИЕ ЗАДАЧИ</b>',
            'Выберите сотрудника из штатного расписания, которому необходимо поручить задачу:',
          ].join('\n'),
          {
            reply_markup: { inline_keyboard: colleagueButtons },
          }
        );
        return res.status(200).send('OK');
      }

      // 6. Выбор конкретного коллеги для поручения
      if (cbData.startsWith('delegate_to:')) {
        const targetNodeId = cbData.split(':')[1];
        if (!targetNodeId) {
          return res.status(200).send('OK');
        }

        const { data: targetNode } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('id', targetNodeId)
          .maybeSingle();

        const targetName = targetNode?.name || 'Сотрудник';
        const targetRole = targetNode?.role_type || 'Специалист';

        pendingDelegateMap.set(cbChatId, targetNodeId);

        const { rawPerms } = resolveUserPermissions(user);
        await safeWebhookUpdate(supabase, 'organization_nodes', user.id, {
          permissions: {
            ...rawPerms,
            pending_delegate_to: targetNodeId,
          },
        });

        if (cbId) await answerCallbackQuery(cbId, `Исполнитель: ${targetName}`);

        await sendTelegramMessage(
          cbChatId,
          [
            '<b>ПОРУЧЕНИЕ ЗАДАЧИ КОЛЛЕГЕ</b>',
            `Выбран исполнитель: <b>${escapeHtml(targetName)} (${escapeHtml(targetRole)})</b>`,
            '',
            'Отправьте текст поручения следующим сообщением в чат.',
            'Для высокого приоритета начните сообщение с символа «!» (например: <code>!Подготовить финансовый отчет</code>).',
          ].join('\n'),
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Отменить поручение', callback_data: 'cancel_delegate' }]],
            },
          }
        );

        return res.status(200).send('OK');
      }

      if (cbData === 'cancel_delegate') {
        pendingDelegateMap.delete(cbChatId);
        const { rawPerms } = resolveUserPermissions(user);
        const cleanedPerms = { ...rawPerms };
        delete cleanedPerms.pending_delegate_to;
        await safeWebhookUpdate(supabase, 'organization_nodes', user.id, {
          permissions: cleanedPerms,
        });

        if (cbId) await answerCallbackQuery(cbId, 'Делегирование отменено');
        await sendCommandCenterCard(cbChatId, user);
        return res.status(200).send('OK');
      }

      return res.status(200).send('OK');
    }

    // =========================================================================
    // ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ И КОМАНД
    // =========================================================================
    const message = body?.message || body?.edited_message;
    const rawChatId = message?.chat?.id;
    const rawText: string = (message?.text || '').trim();
    const firstName: string = message?.from?.first_name || 'Сотрудник';

    if (!rawChatId) {
      return res.status(200).send('OK');
    }

    chatId = String(rawChatId).trim();

    // 1. КОМАНДЫ /start [TC-XXXX] И /menu
    if (
      rawText === '/start' ||
      rawText.startsWith('/start ') ||
      rawText.startsWith('/start@') ||
      rawText === '/menu' ||
      rawText.startsWith('/menu@')
    ) {
      const parts = rawText.split(/\s+/);
      const startParam =
        rawText.startsWith('/start') && parts.length > 1 ? parts[1].trim() : '';

      const user = await findOrCreateUserByChatId(chatId, firstName, startParam);
      await sendCommandCenterCard(chatId, user);
      return res.status(200).send('OK');
    }

    // 2. КОМАНДА /tasks — Список активных задач
    if (rawText === '/tasks' || rawText.startsWith('/tasks@')) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      await sendActiveTasksList(chatId, user);
      return res.status(200).send('OK');
    }

    // 3. КОМАНДА /digest — Финансовая сводка CRM и задач
    if (rawText === '/digest' || rawText.startsWith('/digest@')) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      await sendFinancialCrmDigest(chatId, user);
      return res.status(200).send('OK');
    }

    // 4. КОМАНДА /new ИЛИ ЛЮБОЙ ТЕКСТ ЧАТА — Создание или делегирование задачи
    if (rawText === '/new' || rawText.startsWith('/new@')) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      await sendTelegramMessage(
        chatId,
        '<b>СОЗДАНИЕ ЗАДАЧИ</b>\nОтправьте текст задачи следующим сообщением. Для высокого приоритета начните сообщение с символа «!».\nПример: <code>!Согласовать коммерческое предложение</code>',
        {
          reply_markup: buildRoleCommandCenterKeyboard(siteUrl, chatId, user),
        }
      );
      return res.status(200).send('OK');
    }

    if (rawText.length > 0) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
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
            reply_markup: buildRoleCommandCenterKeyboard(siteUrl, chatId, user),
          }
        );
        return res.status(200).send('OK');
      }

      // Проверяем, было ли активировано делегирование задачи коллеге
      const { rawPerms, canAssignTasks } = resolveUserPermissions(user);
      const delegatedTargetId =
        pendingDelegateMap.get(chatId) ||
        (typeof rawPerms.pending_delegate_to === 'string' ? rawPerms.pending_delegate_to : null);

      let targetAssigneeNode = user;
      let isDelegated = false;

      if (delegatedTargetId && canAssignTasks) {
        const { data: foundColleague } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('id', delegatedTargetId)
          .maybeSingle();

        if (foundColleague) {
          targetAssigneeNode = foundColleague;
          isDelegated = true;
        }

        pendingDelegateMap.delete(chatId);
        const cleanedPerms = { ...rawPerms };
        delete cleanedPerms.pending_delegate_to;
        await safeWebhookUpdate(supabase, 'organization_nodes', user.id, {
          permissions: cleanedPerms,
        });
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
          owner_node_id: targetAssigneeNode.id,
          assigned_to: targetAssigneeNode.id,
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

      // Если задача поручена другому сотруднику, отправляем ему мгновенное Push-уведомление в Telegram
      if (
        isDelegated &&
        targetAssigneeNode.telegram_chat_id &&
        String(targetAssigneeNode.telegram_chat_id).trim() !== chatId
      ) {
        const colleagueChatId = String(targetAssigneeNode.telegram_chat_id).trim();
        await sendTelegramMessage(
          colleagueChatId,
          [
            '<b>НОВОЕ ПОРУЧЕНИЕ TEDCLOUD</b>',
            `Постановщик: ${escapeHtml(user.name)} (${escapeHtml(user.role_type || 'Руководитель')})`,
            `Исполнитель: ${escapeHtml(targetAssigneeNode.name)} (${escapeHtml(
              targetAssigneeNode.role_type || 'Специалист'
            )})`,
            `Задача: <b>${escapeHtml(cleanTitle)}</b>`,
            `Приоритет: ${priorityLabel}`,
          ].join('\n'),
          {
            reply_markup: buildWebAppKeyboard(siteUrl, colleagueChatId, extraRows),
          }
        );
      }

      await sendTelegramMessage(
        chatId,
        [
          isDelegated ? '<b>ЗАДАЧА ПОРУЧЕНА КОЛЛЕГЕ</b>' : '<b>ЗАДАЧА СОЗДАНА</b>',
          `Наименование: ${escapeHtml(cleanTitle)}`,
          `Приоритет: ${priorityLabel}`,
          'Статус: К выполнению',
          `Исполнитель: ${escapeHtml(targetAssigneeNode.name || firstName)} (${escapeHtml(
            targetAssigneeNode.role_type || 'Специалист'
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
