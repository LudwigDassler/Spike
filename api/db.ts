import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  companies: ['name', 'plan', 'payment_region', 'departments'],
  tasks: [
    'title',
    'description',
    'notes',
    'type',
    'priority',
    'status',
    'department',
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
    'avatar_url',
    'department',
    'invite_code',
    'access_level',
    'permissions',
    'company_id',
    'user_id',
    'parent_id',
    'tree_path',
  ],
  crm_leads: [
    'title',
    'description',
    'notes',
    'client_name',
    'amount',
    'contact',
    'status',
    'department',
    'assigned_to',
    'owner_node_id',
    'company_id',
    'jurisdiction',
    'tax_id',
    'reg_number',
    'contract_number',
    'full_name',
    'deal_value',
    'phone',
    'stage',
    'source',
  ],
  workspace_messages: [
    'company_id',
    'sender_id',
    'sender_name',
    'sender_role',
    'target_type',
    'target_id',
    'target_label',
    'message_text',
    'text',
    'is_urgent',
    'is_read',
    'created_at',
  ],
};

// Оверлей для сохранения расширенных атрибутов и комментариев, если схема удаленной БД еще обновляется
const recordNotesOverlay = new Map<string, { description?: string | null; notes?: string | null }>();
const recordExtrasOverlay = new Map<string, Record<string, any>>();

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

async function safeSupabaseInsert(
  supabase: SupabaseClient,
  table: string,
  rawPayload: Record<string, any>
): Promise<{ data: any; error: any; strippedColumns: string[] }> {
  const payload = sanitizeByWhitelist(table, rawPayload);
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase.from(table).insert([payload]).select().single();
    if (!error) {
      return { data, error: null, strippedColumns };
    }

    const missingCol = extractMissingColumnName(error);
    if (
      (error.code === 'PGRST204' || error.code === '42703' || missingCol) &&
      missingCol &&
      missingCol in payload
    ) {
      console.warn(
        `[API /api/db] Schema Cache Safe: stripping unknown column "${missingCol}" from INSERT into "${table}"`
      );
      delete payload[missingCol];
      strippedColumns.push(missingCol);
      continue;
    }

    if (
      'tree_path' in payload &&
      String(error?.message || '').toLowerCase().includes('tree_path')
    ) {
      delete payload.tree_path;
      strippedColumns.push('tree_path');
      continue;
    }

    return { data: null, error, strippedColumns };
  }

  return {
    data: null,
    error: new Error(`Safe insert exceeded maximum column fallback attempts for table ${table}`),
    strippedColumns,
  };
}

async function safeSupabaseUpdate(
  supabase: SupabaseClient,
  table: string,
  id: string,
  rawUpdates: Record<string, any>
): Promise<{ data: any; error: any; strippedColumns: string[] }> {
  const payload = sanitizeByWhitelist(table, rawUpdates);
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 20; attempt++) {
    if (Object.keys(payload).length === 0) {
      const { data: existing, error: fetchErr } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return { data: existing || { id, ...rawUpdates }, error: fetchErr, strippedColumns };
    }

    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      return { data, error: null, strippedColumns };
    }

    const missingCol = extractMissingColumnName(error);
    if (
      (error.code === 'PGRST204' || error.code === '42703' || missingCol) &&
      missingCol &&
      missingCol in payload
    ) {
      console.warn(
        `[API /api/db] Schema Cache Safe: stripping unknown column "${missingCol}" from UPDATE on "${table}"`
      );
      delete payload[missingCol];
      strippedColumns.push(missingCol);
      continue;
    }

    return { data: null, error, strippedColumns };
  }

  return {
    data: null,
    error: new Error(`Safe update exceeded maximum column fallback attempts for table ${table}`),
    strippedColumns,
  };
}

async function safeSelectTable(
  supabase: SupabaseClient,
  table: string,
  ascending = false,
  limitCount?: number
): Promise<{ data: any[]; error: any }> {
  let query = supabase.from(table).select('*').order('created_at', { ascending });
  if (limitCount) {
    query = query.limit(limitCount);
  }
  const firstRes = await query;
  if (!firstRes.error) {
    return { data: firstRes.data || [], error: null };
  }

  let fallbackQuery = supabase.from(table).select('*');
  if (limitCount) {
    fallbackQuery = fallbackQuery.limit(limitCount);
  }
  const secondRes = await fallbackQuery;
  return { data: secondRes.data || [], error: secondRes.error };
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TC-${suffix}`;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface GranularPermissions {
  tasks_view_all: boolean;
  tasks_assign: boolean;
  crm_view: boolean;
  crm_edit: boolean;
  team_manage: boolean;
  data_export: boolean;
  billing_admin: boolean;
  [key: string]: any;
}

export function normalizeAccessLevel(
  rawLevel?: string | null,
  roleType?: string | null
): 'root' | 'manager' | 'member' | 'observer' {
  const roleUpper = String(roleType || '').trim().toUpperCase();
  if (roleUpper === 'SUPERADMIN' || roleUpper === 'ROOT') {
    return 'root';
  }
  const clean = String(rawLevel || '').trim().toLowerCase();
  if (clean === 'root' || clean === 'superadmin') return 'root';
  if (clean === 'manager') return 'manager';
  if (clean === 'observer' || clean === 'viewer') return 'observer';
  return 'member';
}

export function getDefaultPermissions(accessLevel?: string): GranularPermissions {
  switch (accessLevel) {
    case 'root':
      return {
        tasks_view_all: true,
        tasks_assign: true,
        crm_view: true,
        crm_edit: true,
        team_manage: true,
        data_export: true,
        billing_admin: true,
      };
    case 'manager':
      return {
        tasks_view_all: true,
        tasks_assign: true,
        crm_view: true,
        crm_edit: true,
        team_manage: true,
        data_export: true,
        billing_admin: false,
      };
    case 'observer':
    case 'viewer':
      return {
        tasks_view_all: true,
        tasks_assign: false,
        crm_view: true,
        crm_edit: false,
        team_manage: false,
        data_export: true,
        billing_admin: false,
      };
    case 'member':
    default:
      return {
        tasks_view_all: false,
        tasks_assign: false,
        crm_view: false,
        crm_edit: false,
        team_manage: false,
        data_export: false,
        billing_admin: false,
      };
  }
}

function normalizePermissionsObject(
  accessLevel: 'root' | 'manager' | 'member' | 'observer',
  rawPermissions: any
): GranularPermissions {
  if (accessLevel === 'root') {
    const baseRoot = getDefaultPermissions('root');
    if (rawPermissions && typeof rawPermissions === 'object') {
      if (rawPermissions.pending_delegate_to) {
        baseRoot.pending_delegate_to = rawPermissions.pending_delegate_to;
      }
      if (rawPermissions.pending_comm) {
        baseRoot.pending_comm = rawPermissions.pending_comm;
      }
    }
    return baseRoot;
  }

  const defaults = getDefaultPermissions(accessLevel);
  let parsed = rawPermissions;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return defaults;
  }

  const result: GranularPermissions = {
    tasks_view_all:
      typeof parsed.tasks_view_all === 'boolean' ? parsed.tasks_view_all : defaults.tasks_view_all,
    tasks_assign:
      typeof parsed.tasks_assign === 'boolean' ? parsed.tasks_assign : defaults.tasks_assign,
    crm_view: typeof parsed.crm_view === 'boolean' ? parsed.crm_view : defaults.crm_view,
    crm_edit: typeof parsed.crm_edit === 'boolean' ? parsed.crm_edit : defaults.crm_edit,
    team_manage:
      typeof parsed.team_manage === 'boolean' ? parsed.team_manage : defaults.team_manage,
    data_export:
      typeof parsed.data_export === 'boolean' ? parsed.data_export : defaults.data_export,
    billing_admin:
      typeof parsed.billing_admin === 'boolean' ? parsed.billing_admin : defaults.billing_admin,
  };

  if (parsed.pending_delegate_to) {
    result.pending_delegate_to = parsed.pending_delegate_to;
  }
  if (parsed.pending_comm) {
    result.pending_comm = parsed.pending_comm;
  }

  return result;
}

interface InMemoryStore {
  companies: Record<string, any>[];
  organization_nodes: Record<string, any>[];
  tasks: Record<string, any>[];
  crm_leads: Record<string, any>[];
  workspace_messages: Record<string, any>[];
}

const localStore: InMemoryStore = {
  companies: [],
  organization_nodes: [],
  tasks: [],
  crm_leads: [],
  workspace_messages: [],
};

function getAdminSupabaseOrNull(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveDefaultCompanyId(
  supabase: SupabaseClient | null,
  preferredName = 'Корпоративное пространство'
): Promise<string> {
  if (!supabase) {
    if (localStore.companies.length > 0) {
      return localStore.companies[0].id;
    }
    const createdCompany = {
      id: crypto.randomUUID(),
      name: preferredName,
      plan: 'Business',
      payment_region: 'RU',
      departments: [],
      created_at: new Date().toISOString(),
    };
    localStore.companies.push(createdCompany);
    return createdCompany.id;
  }

  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await safeSupabaseInsert(supabase, 'companies', {
    name: preferredName,
    plan: 'Business',
    payment_region: 'RU',
  });

  if (createError || !created?.id) {
    return crypto.randomUUID();
  }

  return created.id;
}

async function resolveFallbackOwnerNodeId(
  supabase: SupabaseClient | null,
  companyId?: string
): Promise<string | null> {
  if (!supabase) {
    const found = companyId
      ? localStore.organization_nodes.find((n) => n.company_id === companyId)
      : localStore.organization_nodes[0];
    return found?.id || localStore.organization_nodes[0]?.id || null;
  }

  if (companyId) {
    const { data: companyNode } = await supabase
      .from('organization_nodes')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();
    if (companyNode?.id) return companyNode.id;
  }

  const { data: anyNode } = await supabase
    .from('organization_nodes')
    .select('id')
    .limit(1)
    .maybeSingle();

  return anyNode?.id || null;
}

async function fetchAllCompanyNodes(supabase: SupabaseClient | null): Promise<any[]> {
  if (!supabase) {
    return localStore.organization_nodes;
  }
  const { data } = await supabase.from('organization_nodes').select('*');
  return Array.isArray(data) ? data : [];
}

// БЛОК 2: Отправка Telegram-уведомления конкретному исполнителю ИЛИ всему подразделению (отделу)
async function sendTelegramTaskOrDepartmentPush(params: {
  supabase: SupabaseClient | null;
  assignedToId?: string | null;
  department?: string | null;
  taskId?: string;
  taskTitle: string;
  taskPriority: string;
  taskType?: string;
}): Promise<{ pushed: boolean; count?: number; reason?: string }> {
  const { supabase, assignedToId, department, taskId, taskTitle, taskPriority, taskType } = params;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { pushed: false, reason: 'missing_bot_token' };
  }

  const allNodes = await fetchAllCompanyNodes(supabase);
  let targetNodes: any[] = [];

  if (assignedToId) {
    const match = allNodes.find((n) => n.id === assignedToId);
    if (match && match.telegram_chat_id) {
      targetNodes = [match];
    }
  } else if (department && department.trim()) {
    const cleanDept = department.trim().toLowerCase();
    targetNodes = allNodes.filter(
      (n) =>
        n.telegram_chat_id &&
        String(n.department || '')
          .trim()
          .toLowerCase() === cleanDept
    );
  }

  if (targetNodes.length === 0) {
    return { pushed: false, reason: 'no_recipients_with_telegram' };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    'https://tedcloud.vercel.app'
  ).replace(/\/$/, '');

  let pushedCount = 0;

  for (const node of targetNodes) {
    const telegramChatId = String(node.telegram_chat_id || '').trim();
    if (!telegramChatId) continue;

    const employeeName = escapeHtml(node.name || 'Сотрудник');
    const employeeRole = node.role_type ? ` (${escapeHtml(node.role_type)})` : '';
    const deptLine = department ? `\n<b>Подразделение:</b> ${escapeHtml(department)}` : '';

    const notificationHtml = [
      '<b>УВЕДОМЛЕНИЕ TEDCLOUD</b>',
      assignedToId
        ? 'Назначена новая корпоративная задача.'
        : `Новое поручение на подразделение «${escapeHtml(department || '')}».`,
      '',
      `<b>Получатель:</b> ${employeeName}${employeeRole}${deptLine}`,
      `<b>Задача:</b> ${escapeHtml(taskTitle)}`,
      `<b>Категория:</b> ${escapeHtml(taskType || 'Task')}`,
      `<b>Приоритет:</b> ${escapeHtml(taskPriority || 'Medium')}`,
    ].join('\n');

    const inlineKeyboard: any[][] = [];
    if (taskId) {
      inlineKeyboard.push([
        { text: 'Принять в работу', callback_data: `task_progress:${taskId}` },
        { text: 'Завершить задачу', callback_data: `task_done:${taskId}` },
      ]);
    }
    inlineKeyboard.push([
      { text: 'Открыть панель TedCloud', url: `${siteUrl}/?chatId=${telegramChatId}` },
    ]);

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: notificationHtml,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard },
        }),
      });
      if (tgRes.ok) {
        pushedCount++;
      }
    } catch (err) {
      console.error('[API /api/db] Telegram Task Push network error:', err);
    }
  }

  return { pushed: pushedCount > 0, count: pushedCount };
}

// БЛОК 4: Мгновенная доставка сообщения из единого инфополя (workspace_messages) в Telegram
async function sendTelegramWorkspaceMessagePush(params: {
  supabase: SupabaseClient | null;
  messageRecord: Record<string, any>;
}): Promise<{ pushed: boolean; count: number; reason?: string }> {
  const { supabase, messageRecord } = params;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { pushed: false, count: 0, reason: 'missing_bot_token' };
  }

  const allNodes = await fetchAllCompanyNodes(supabase);
  const senderNode = messageRecord.sender_id
    ? allNodes.find((n) => String(n.id) === String(messageRecord.sender_id))
    : null;

  const senderName = escapeHtml(
    senderNode?.name || messageRecord.sender_name || 'Сотрудник TedCloud'
  );
  const senderRole = escapeHtml(
    senderNode?.role_type || messageRecord.sender_role || 'Специалист'
  );

  const rawTargetType = String(
    messageRecord.target_type || messageRecord.scope_type || ''
  )
    .trim()
    .toLowerCase();
  const targetId = String(
    messageRecord.target_id || messageRecord.recipient_id || ''
  ).trim();
  const targetLabel = String(
    messageRecord.target_label ||
      messageRecord.target_department ||
      messageRecord.entity_title ||
      ''
  ).trim();

  let targetNodes: any[] = [];
  let contourLabel = 'Общее оповещение по компании';

  if (rawTargetType === 'task' || messageRecord.task_id) {
    contourLabel = targetLabel ? `Задача: ${escapeHtml(targetLabel)}` : 'Задача';
  } else if (rawTargetType === 'deal' || rawTargetType === 'lead' || messageRecord.lead_id) {
    contourLabel = targetLabel ? `Сделка: ${escapeHtml(targetLabel)}` : 'Сделка CRM';
  } else if (rawTargetType === 'department' || messageRecord.target_department) {
    const deptName = targetLabel || targetId || messageRecord.target_department || '';
    contourLabel = `Отдел: ${escapeHtml(deptName)}`;
  } else if (rawTargetType === 'direct' || messageRecord.recipient_id) {
    contourLabel = 'Личное сообщение';
  }

  if (rawTargetType === 'direct' || messageRecord.recipient_id) {
    const rec = allNodes.find(
      (n) =>
        (targetId && String(n.id) === targetId) ||
        (targetLabel &&
          String(n.name || '')
            .trim()
            .toLowerCase() === targetLabel.toLowerCase())
    );
    if (rec && rec.telegram_chat_id) {
      targetNodes = [rec];
    }
  } else if (rawTargetType === 'department' || messageRecord.target_department) {
    const deptLower = String(targetId || targetLabel || messageRecord.target_department || '')
      .trim()
      .toLowerCase();
    targetNodes = allNodes.filter(
      (n) =>
        n.telegram_chat_id &&
        String(n.id) !== String(messageRecord.sender_id || '') &&
        String(n.department || '')
          .trim()
          .toLowerCase() === deptLower
    );
  } else if (
    (rawTargetType === 'task' || rawTargetType === 'deal') &&
    messageRecord.recipient_id
  ) {
    const rec = allNodes.find((n) => String(n.id) === String(messageRecord.recipient_id));
    if (rec && rec.telegram_chat_id) {
      targetNodes = [rec];
    }
  } else {
    targetNodes = allNodes.filter(
      (n) =>
        n.telegram_chat_id && String(n.id) !== String(messageRecord.sender_id || '')
    );
  }

  if (targetNodes.length === 0) {
    return { pushed: false, count: 0, reason: 'no_recipients_with_telegram' };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    'https://tedcloud.vercel.app'
  ).replace(/\/$/, '');

  const msgBody = String(
    messageRecord.message_text ||
      messageRecord.text ||
      messageRecord.content ||
      messageRecord.message ||
      ''
  ).trim();

  const htmlText = [
    '<b>ВХОДЯЩЕЕ СООБЩЕНИЕ TEDCLOUD</b>',
    `От: ${senderName} (${senderRole})`,
    `Контур: ${contourLabel}`,
    '',
    escapeHtml(msgBody),
  ].join('\n');

  let pushedCount = 0;

  for (const recipient of targetNodes) {
    const tgChatId = String(recipient.telegram_chat_id || '').trim();
    if (!tgChatId) continue;

    const inlineKeyboard: any[][] = [];
    if (messageRecord.sender_id) {
      inlineKeyboard.push([
        {
          text: 'Ответить через бота',
          callback_data: `reply_msg_${messageRecord.sender_id}`,
        },
      ]);
    }
    inlineKeyboard.push([
      {
        text: 'Открыть панель TedCloud',
        url: `${siteUrl}/?chatId=${tgChatId}`,
      },
    ]);

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: htmlText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard },
        }),
      });
      if (tgRes.ok) {
        pushedCount++;
      }
    } catch (err) {
      console.error('[API /api/db] Telegram WorkspaceMessage push error:', err);
    }
  }

  return { pushed: pushedCount > 0, count: pushedCount };
}

function normalizeCompanyRow(row: any) {
  if (!row) return null;
  const extras = row.id ? recordExtrasOverlay.get(`companies:${row.id}`) : undefined;
  let departments = row.departments ?? extras?.departments ?? [];
  if (typeof departments === 'string') {
    try {
      departments = JSON.parse(departments);
    } catch {
      departments = [];
    }
  }
  return {
    ...row,
    ...(extras || {}),
    departments: Array.isArray(departments) ? departments : [],
  };
}

function normalizeTaskRow(row: any) {
  const overlay = row.id ? recordNotesOverlay.get(`tasks:${row.id}`) : undefined;
  const extras = row.id ? recordExtrasOverlay.get(`tasks:${row.id}`) : undefined;
  const noteText =
    row.description ?? row.notes ?? overlay?.description ?? overlay?.notes ?? null;

  return {
    ...row,
    ...(extras || {}),
    description: noteText,
    notes: noteText,
    type: row.type || 'Task',
    priority: row.priority || 'Medium',
    status: row.status || 'Todo',
    department: row.department ?? extras?.department ?? null,
    assigned_to:
      row.assigned_to !== undefined
        ? row.assigned_to
        : extras?.assigned_to !== undefined
        ? extras.assigned_to
        : row.owner_node_id ?? null,
    owner_node_id: row.owner_node_id ?? row.assigned_to ?? null,
    created_by: row.created_by ?? row.owner_node_id ?? null,
  };
}

function normalizeNodeRow(row: any) {
  const extras = row.id ? recordExtrasOverlay.get(`organization_nodes:${row.id}`) : undefined;
  const accessLevel = normalizeAccessLevel(row.access_level, row.role_type);
  const permissions = normalizePermissionsObject(accessLevel, row.permissions);
  const resolvedAvatar =
    row.avatar_url !== undefined
      ? row.avatar_url
      : extras?.avatar_url !== undefined
      ? extras.avatar_url
      : null;

  return {
    ...row,
    ...(extras || {}),
    role_type: row.role_type || 'Специалист',
    department: row.department || null,
    email: row.email || null,
    avatar_url: resolvedAvatar ? String(resolvedAvatar) : null,
    telegram_chat_id:
      row.telegram_chat_id !== undefined && row.telegram_chat_id !== null
        ? String(row.telegram_chat_id).trim()
        : null,
    invite_code: row.invite_code || `TC-${String(row.id || '0000').slice(0, 4).toUpperCase()}`,
    access_level: accessLevel,
    permissions,
    tree_path: row.tree_path || 'root',
  };
}

function normalizeLeadRow(row: any) {
  const overlay = row.id ? recordNotesOverlay.get(`crm_leads:${row.id}`) : undefined;
  const extras = row.id ? recordExtrasOverlay.get(`crm_leads:${row.id}`) : undefined;
  const noteText =
    row.description ?? row.notes ?? overlay?.description ?? overlay?.notes ?? null;
  const clientName = row.client_name || row.full_name || row.title || 'Контрагент';
  const title = row.title || clientName;
  const amount = Number(row.amount ?? row.deal_value ?? 0);
  const contact = row.contact ?? row.phone ?? null;
  const status = row.status || row.stage || 'New';

  return {
    ...row,
    ...(extras || {}),
    title,
    description: noteText,
    notes: noteText,
    client_name: clientName,
    full_name: clientName,
    amount,
    deal_value: amount,
    contact,
    phone: contact,
    status,
    stage: status,
    department: row.department ?? extras?.department ?? null,
    assigned_to:
      row.assigned_to !== undefined
        ? row.assigned_to
        : extras?.assigned_to !== undefined
        ? extras.assigned_to
        : row.owner_node_id ?? null,
    jurisdiction: row.jurisdiction ?? extras?.jurisdiction ?? 'RU',
    tax_id: row.tax_id ?? extras?.tax_id ?? null,
    reg_number: row.reg_number ?? extras?.reg_number ?? null,
    contract_number: row.contract_number ?? extras?.contract_number ?? null,
  };
}

function normalizeMessageRow(row: any) {
  const extras = row.id ? recordExtrasOverlay.get(`workspace_messages:${row.id}`) : undefined;
  const merged = { ...(extras || {}), ...row };

  const msgBody = String(
    row.message_text ||
      row.text ||
      row.content ||
      row.message ||
      extras?.message_text ||
      extras?.text ||
      extras?.content ||
      ''
  ).trim();

  const rowType = String(row.target_type || row.scope_type || '').trim().toLowerCase();
  const extraType = String(extras?.target_type || extras?.scope_type || '').trim().toLowerCase();
  const rawType =
    rowType && rowType !== 'general'
      ? rowType
      : extraType && extraType !== 'general'
      ? extraType
      : rowType || extraType;

  const targetType =
    rawType === 'direct'
      ? 'direct'
      : rawType === 'department'
      ? 'department'
      : rawType === 'task' || merged.task_id
      ? 'task'
      : rawType === 'deal' || rawType === 'lead' || merged.lead_id
      ? 'deal'
      : merged.recipient_id || extras?.recipient_id
      ? 'direct'
      : merged.target_department || extras?.target_department
      ? 'department'
      : rawType === 'general'
      ? 'general'
      : 'broadcast';

  const rawTargetId = row.target_id ?? extras?.target_id;
  const targetId =
    rawTargetId !== undefined && rawTargetId !== null && String(rawTargetId) !== ''
      ? String(rawTargetId)
      : targetType === 'direct' && (merged.recipient_id || extras?.recipient_id)
      ? String(merged.recipient_id || extras?.recipient_id)
      : targetType === 'department' && (merged.target_department || extras?.target_department)
      ? String(merged.target_department || extras?.target_department)
      : targetType === 'task' && (merged.task_id || extras?.task_id)
      ? String(merged.task_id || extras?.task_id)
      : targetType === 'deal' && (merged.lead_id || extras?.lead_id)
      ? String(merged.lead_id || extras?.lead_id)
      : null;

  const targetLabel =
    row.target_label ||
    extras?.target_label ||
    (targetType === 'department'
      ? merged.target_department || extras?.target_department || targetId
      : targetType === 'task' || targetType === 'deal'
      ? merged.entity_title || extras?.entity_title || null
      : targetType === 'broadcast' || targetType === 'general'
      ? 'Всем сотрудникам'
      : null);

  return {
    ...merged,
    message_text: msgBody,
    text: msgBody,
    content: msgBody,
    target_type: targetType,
    target_id: targetId,
    target_label: targetLabel,
    scope_type: targetType === 'general' ? 'broadcast' : targetType,
    recipient_id: targetType === 'direct' ? targetId : merged.recipient_id || null,
    target_department:
      targetType === 'department' ? targetLabel || targetId : merged.target_department || null,
    task_id: targetType === 'task' ? targetId : merged.task_id || null,
    lead_id: targetType === 'deal' ? targetId : merged.lead_id || null,
    entity_id:
      targetType === 'task' || targetType === 'deal' ? targetId : merged.entity_id || null,
    entity_title:
      targetType === 'task' || targetType === 'deal' ? targetLabel : merged.entity_title || null,
    is_urgent: Boolean(merged.is_urgent),
    is_read: Boolean(merged.is_read),
    created_at: merged.created_at || new Date().toISOString(),
  };
}

/**
 * Серверная фильтрация приватности сообщений workspace_messages для текущего пользователя
 */
function canServerUserSeeMessage(msg: any, currentUser: any | null): boolean {
  if (!msg) return false;
  if (!currentUser || !currentUser.id) return true;

  const userId = String(currentUser.id).trim();
  const userName = String(currentUser.name || '').trim().toLowerCase();
  const userDept = String(currentUser.department || '').trim().toLowerCase();
  const userAccess = normalizeAccessLevel(currentUser.access_level, currentUser.role_type);

  const tType = String(msg.target_type || msg.scope_type || 'broadcast')
    .trim()
    .toLowerCase();
  const senderId = msg.sender_id ? String(msg.sender_id).trim() : '';
  const targetId = msg.target_id
    ? String(msg.target_id).trim()
    : msg.recipient_id
    ? String(msg.recipient_id).trim()
    : '';
  const targetLabelLower = String(msg.target_label || msg.target_department || '')
    .trim()
    .toLowerCase();

  // Если msg.target_type === 'direct': видят ТОЛЬКО отправитель и получатель!
  if (tType === 'direct') {
    if (senderId && senderId === userId) return true;
    if (targetId && targetId === userId) return true;
    if (userName && targetLabelLower && targetLabelLower === userName) return true;
    return false;
  }

  // Если msg.target_type === 'department': видят сотрудники этого отдела и администраторы (root)
  if (tType === 'department') {
    if (userAccess === 'root') return true;
    if (senderId && senderId === userId) return true;
    if (!userDept) return false;
    return userDept === targetId.toLowerCase() || userDept === targetLabelLower;
  }

  // general, broadcast, task, deal — видят сотрудники компании
  return true;
}

function findMatchingNodeByInput(nodes: any[], rawInput: string): any | null {
  const q = String(rawInput || '').trim().toLowerCase();
  if (!q) return null;

  return (
    nodes.find(
      (node: any) =>
        String(node.telegram_chat_id || '').trim().toLowerCase() === q ||
        String(node.invite_code || '').trim().toLowerCase() === q ||
        String(node.email || '').trim().toLowerCase() === q ||
        String(node.name || '').trim().toLowerCase() === q
    ) || null
  );
}

export default async function handler(req: any, res: any) {
  try {
    const supabase = getAdminSupabaseOrNull();
    const method = (req.method || 'GET').toUpperCase();

    if (method === 'GET') {
      const chatId = req.query?.chatId ? String(req.query.chatId).trim() : null;
      const profileId = req.query?.profileId ? String(req.query.profileId).trim() : null;

      if (!supabase) {
        const nodes = localStore.organization_nodes.map(normalizeNodeRow);
        let currentProfile = null;
        if (profileId) {
          currentProfile = nodes.find((n) => n.id === profileId) || null;
        } else if (chatId) {
          currentProfile = findMatchingNodeByInput(nodes, chatId);
        }

        const allNormalizedMessages = localStore.workspace_messages.map(normalizeMessageRow);
        const privateMessages = currentProfile
          ? allNormalizedMessages.filter((m) => canServerUserSeeMessage(m, currentProfile))
          : allNormalizedMessages;

        return res.status(200).json({
          ok: true,
          mode: 'local_empty',
          company: normalizeCompanyRow(localStore.companies[0] || null),
          currentProfile,
          nodes,
          tasks: localStore.tasks.map(normalizeTaskRow),
          leads: localStore.crm_leads.map(normalizeLeadRow),
          messages: privateMessages,
        });
      }

      const [companiesRes, nodesRes, tasksRes, leadsRes, messagesRes] = await Promise.all([
        safeSelectTable(supabase, 'companies', false, 1),
        safeSelectTable(supabase, 'organization_nodes', true),
        safeSelectTable(supabase, 'tasks', false),
        safeSelectTable(supabase, 'crm_leads', false),
        safeSelectTable(supabase, 'workspace_messages', false, 200),
      ]);

      if (nodesRes.error) {
        throw new Error(`[organization_nodes] ${nodesRes.error.message}`);
      }

      const rawNodes = (nodesRes.data || []).map(normalizeNodeRow);
      const rawTasks = (tasksRes.data || []).map(normalizeTaskRow);
      const rawLeads = (leadsRes.data || []).map(normalizeLeadRow);

      let currentProfile = null;
      if (profileId) {
        currentProfile = rawNodes.find((n: any) => n.id === profileId) || null;
      } else if (chatId) {
        currentProfile = findMatchingNodeByInput(rawNodes, chatId);
      }

      // Merge remote workspace_messages with any in-memory fallback messages
      const remoteMessages = Array.isArray(messagesRes.data) ? messagesRes.data : [];
      const seenMsgIds = new Set<string>();
      const mergedMessages: any[] = [];
      for (const m of [...remoteMessages, ...localStore.workspace_messages]) {
        if (m && m.id && !seenMsgIds.has(m.id)) {
          seenMsgIds.add(m.id);
          const norm = normalizeMessageRow(m);
          if (!currentProfile || canServerUserSeeMessage(norm, currentProfile)) {
            mergedMessages.push(norm);
          }
        }
      }

      return res.status(200).json({
        ok: true,
        mode: 'supabase',
        company: normalizeCompanyRow(companiesRes.data?.[0] || null),
        currentProfile,
        nodes: rawNodes,
        tasks: rawTasks,
        leads: rawLeads,
        messages: mergedMessages,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      // Вход сотрудника по любому из 4 полей
      if (body.action === 'login') {
        const q = String(body.input || body.identifier || '').trim().toLowerCase();
        if (!q) {
          return res.status(400).json({ error: 'Введите идентификатор для входа.' });
        }

        let nodes: any[] = [];
        let company: any = null;

        if (!supabase) {
          nodes = localStore.organization_nodes.map(normalizeNodeRow);
          company = normalizeCompanyRow(localStore.companies[0] || null);
        } else {
          const [nodesRes, companiesRes] = await Promise.all([
            safeSelectTable(supabase, 'organization_nodes', true),
            safeSelectTable(supabase, 'companies', false, 1),
          ]);
          if (nodesRes.error) {
            return res.status(400).json({ error: nodesRes.error.message });
          }
          nodes = (nodesRes.data || []).map(normalizeNodeRow);
          company = normalizeCompanyRow(companiesRes.data?.[0] || null);
        }

        const matched = nodes.find(
          (node: any) =>
            String(node.telegram_chat_id || '').trim().toLowerCase() === q ||
            String(node.invite_code || '').trim().toLowerCase() === q ||
            String(node.email || '').trim().toLowerCase() === q ||
            String(node.name || '').trim().toLowerCase() === q
        );

        if (!matched) {
          return res.status(404).json({
            error:
              'Профиль сотрудника не найден. Проверьте персональный код доступа (TC-XXXX), корпоративный Email, ФИО или Telegram ID.',
          });
        }

        if (matched.company_id && supabase) {
          const { data: matchedCompany } = await supabase
            .from('companies')
            .select('*')
            .eq('id', matched.company_id)
            .maybeSingle();
          if (matchedCompany) {
            company = normalizeCompanyRow(matchedCompany);
          }
        }

        return res.status(200).json({
          ok: true,
          profile: matched,
          company,
        });
      }

      // Регистрация новой компании и корневого руководителя
      if (body.action === 'register_workspace' || body.action === 'register') {
        const companyName = String(body.companyName || '').trim();
        const leaderName = String(body.leaderName || '').trim();
        const leaderTitle = String(
          body.leaderTitle || body.role_type || 'Генеральный директор'
        ).trim();
        const leaderDepartment = String(body.leaderDepartment || 'Дирекция').trim();
        const leaderEmail = body.leaderEmail ? String(body.leaderEmail).trim() : null;
        const leaderTelegramChatId = body.telegram_chat_id
          ? String(body.telegram_chat_id).trim()
          : null;

        if (!companyName || !leaderName) {
          return res.status(400).json({
            error: 'Укажите название организации и ФИО руководителя.',
          });
        }

        const rootInviteCode = generateInviteCode();
        const rootPermissions = getDefaultPermissions('root');
        const initialDepts = leaderDepartment ? [leaderDepartment] : [];

        if (!supabase) {
          const newCompany = {
            id: crypto.randomUUID(),
            name: companyName,
            plan: 'Business',
            payment_region: 'RU',
            departments: initialDepts,
            created_at: new Date().toISOString(),
          };
          localStore.companies.unshift(newCompany);

          const rootNode = {
            id: crypto.randomUUID(),
            company_id: newCompany.id,
            user_id: `root_${Date.now()}`,
            name: leaderName,
            role_type: leaderTitle,
            department: leaderDepartment || null,
            email: leaderEmail,
            telegram_chat_id: leaderTelegramChatId,
            invite_code: rootInviteCode,
            access_level: 'root',
            permissions: rootPermissions,
            parent_id: null,
            tree_path: 'root',
            created_at: new Date().toISOString(),
          };
          localStore.organization_nodes.push(rootNode);

          return res.status(200).json({
            ok: true,
            company: normalizeCompanyRow(newCompany),
            profile: normalizeNodeRow(rootNode),
          });
        }

        const { data: createdCompany, error: compErr } = await safeSupabaseInsert(
          supabase,
          'companies',
          {
            name: companyName,
            plan: 'Business',
            payment_region: 'RU',
            departments: initialDepts,
          }
        );

        if (compErr || !createdCompany) {
          return res.status(400).json({
            error: compErr?.message || 'Не удалось создать организацию.',
          });
        }

        recordExtrasOverlay.set(`companies:${createdCompany.id}`, {
          departments: initialDepts,
        });

        const rawRootNode = {
          company_id: createdCompany.id,
          user_id: `root_${Date.now()}`,
          name: leaderName,
          role_type: leaderTitle,
          department: leaderDepartment || null,
          email: leaderEmail,
          telegram_chat_id: leaderTelegramChatId,
          invite_code: rootInviteCode,
          access_level: 'root',
          permissions: rootPermissions,
          parent_id: null,
          tree_path: 'root',
        };

        const { data: createdNode, error: nodeErr } = await safeSupabaseInsert(
          supabase,
          'organization_nodes',
          rawRootNode
        );

        if (nodeErr || !createdNode) {
          return res.status(400).json({
            error: nodeErr?.message || 'Не удалось создать корневой профиль руководителя.',
          });
        }

        return res.status(200).json({
          ok: true,
          company: normalizeCompanyRow({ ...createdCompany, departments: initialDepts }),
          profile: normalizeNodeRow({ ...rawRootNode, ...createdNode }),
        });
      }

      const { table, payload } = body;

      if (!table || !payload) {
        return res.status(400).json({
          error: 'В теле POST-запроса обязательны поля "table" и "payload".',
        });
      }

      const companyId = payload.company_id || (await resolveDefaultCompanyId(supabase));

      if (table === 'tasks') {
        const title = String(payload.title || '').trim();
        if (!title) {
          return res.status(400).json({ error: 'Поле "title" обязательно для создания задачи.' });
        }

        const fallbackNodeId = await resolveFallbackOwnerNodeId(supabase, companyId);
        const taskDept = payload.department ? String(payload.department).trim() : null;
        const explicitAssignee =
          payload.assigned_to !== undefined ? payload.assigned_to : fallbackNodeId;

        const resolvedOwnerNodeId =
          payload.owner_node_id ||
          explicitAssignee ||
          payload.created_by ||
          fallbackNodeId ||
          null;

        const rawInsertPayload: Record<string, any> = {
          company_id: companyId,
          title,
          description: payload.description || payload.notes || null,
          notes: payload.notes || payload.description || null,
          type: payload.type || 'Task',
          priority: payload.priority || 'Medium',
          status: payload.status || 'Todo',
          department: taskDept,
          assigned_to: explicitAssignee || null,
          owner_node_id: resolvedOwnerNodeId,
          created_by: payload.created_by || resolvedOwnerNodeId || null,
        };

        let savedTask: any;

        if (!supabase) {
          savedTask = {
            id: crypto.randomUUID(),
            ...rawInsertPayload,
            created_at: new Date().toISOString(),
          };
          localStore.tasks.unshift(savedTask);
        } else {
          const { data, error } = await safeSupabaseInsert(supabase, 'tasks', rawInsertPayload);
          if (error) {
            console.error('[API /api/db] Supabase INSERT error in tasks:', error);
            return res.status(400).json({ error: error.message, details: error });
          }
          savedTask = { ...rawInsertPayload, ...data, assigned_to: explicitAssignee || null };
        }

        if (savedTask?.id) {
          if (rawInsertPayload.description || rawInsertPayload.notes) {
            recordNotesOverlay.set(`tasks:${savedTask.id}`, {
              description: rawInsertPayload.description,
              notes: rawInsertPayload.notes,
            });
          }
          recordExtrasOverlay.set(`tasks:${savedTask.id}`, {
            department: taskDept,
            assigned_to: explicitAssignee || null,
          });
        }

        const pushStatus = await sendTelegramTaskOrDepartmentPush({
          supabase,
          assignedToId: explicitAssignee || null,
          department: taskDept,
          taskId: savedTask.id,
          taskTitle: savedTask.title,
          taskPriority: savedTask.priority || rawInsertPayload.priority,
          taskType: savedTask.type || rawInsertPayload.type,
        });

        return res.status(200).json({
          ok: true,
          data: normalizeTaskRow(savedTask),
          telegramPush: pushStatus,
        });
      }

      if (table === 'organization_nodes') {
        const generatedInviteCode = payload.invite_code
          ? String(payload.invite_code).trim().toUpperCase()
          : generateInviteCode();

        const accessLevel = normalizeAccessLevel(payload.access_level, payload.role_type);
        const permissions = normalizePermissionsObject(accessLevel, payload.permissions);

        const rawInsertPayload: Record<string, any> = {
          company_id: companyId,
          user_id: payload.user_id || `emp_${Date.now()}`,
          name: String(payload.name || '').trim(),
          role_type: String(payload.role_type || 'Специалист').trim(),
          telegram_chat_id: payload.telegram_chat_id
            ? String(payload.telegram_chat_id).trim()
            : null,
          email: payload.email ? String(payload.email).trim() : null,
          avatar_url: payload.avatar_url ? String(payload.avatar_url).trim() : null,
          department: payload.department ? String(payload.department).trim() : null,
          invite_code: generatedInviteCode,
          access_level: accessLevel,
          permissions,
          parent_id: payload.parent_id || null,
          tree_path: payload.tree_path || 'root',
        };

        if (!rawInsertPayload.name) {
          return res.status(400).json({
            error: 'Поле "name" обязательно для добавления сотрудника.',
          });
        }

        if (!supabase) {
          const newRecord = {
            id: crypto.randomUUID(),
            ...rawInsertPayload,
            created_at: new Date().toISOString(),
          };
          localStore.organization_nodes.push(newRecord);
          return res.status(200).json({ ok: true, data: normalizeNodeRow(newRecord) });
        }

        const { data, error } = await safeSupabaseInsert(
          supabase,
          'organization_nodes',
          rawInsertPayload
        );

        if (error) {
          console.error('[API /api/db] Supabase INSERT error in organization_nodes:', error);
          return res.status(400).json({ error: error.message, details: error });
        }

        if (data?.id && rawInsertPayload.avatar_url) {
          recordExtrasOverlay.set(`organization_nodes:${data.id}`, {
            avatar_url: rawInsertPayload.avatar_url,
          });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeNodeRow({ ...rawInsertPayload, ...data }),
        });
      }

      if (table === 'crm_leads') {
        const clientName = String(
          payload.client_name || payload.full_name || payload.title || ''
        ).trim();
        const title = String(payload.title || clientName).trim();
        const amount = Number(payload.amount ?? payload.deal_value ?? 0);
        const contact = payload.contact || payload.phone || null;
        const status = payload.status || payload.stage || 'New';
        const leadDept = payload.department ? String(payload.department).trim() : null;
        const leadAssignee =
          payload.assigned_to !== undefined ? payload.assigned_to : payload.owner_node_id || null;
        const jurisdiction = payload.jurisdiction === 'GLOBAL' ? 'GLOBAL' : 'RU';
        const taxId = payload.tax_id ? String(payload.tax_id).trim() : null;
        const regNumber = payload.reg_number ? String(payload.reg_number).trim() : null;
        const contractNumber = payload.contract_number
          ? String(payload.contract_number).trim()
          : null;

        if (!clientName) {
          return res
            .status(400)
            .json({ error: 'Поле "client_name" обязательно для создания сделки.' });
        }

        const fallbackNodeId = await resolveFallbackOwnerNodeId(supabase, companyId);

        const rawInsertPayload: Record<string, any> = {
          company_id: companyId,
          owner_node_id: leadAssignee || payload.owner_node_id || fallbackNodeId || null,
          assigned_to: leadAssignee || null,
          department: leadDept,
          title,
          description: payload.description || payload.notes || null,
          notes: payload.notes || payload.description || null,
          client_name: clientName,
          full_name: clientName,
          amount,
          deal_value: amount,
          contact,
          phone: contact,
          status,
          stage: status,
          jurisdiction,
          tax_id: taxId,
          reg_number: regNumber,
          contract_number: contractNumber,
          source: payload.source || 'Direct B2B',
        };

        let savedLead: any;

        if (!supabase) {
          savedLead = {
            id: crypto.randomUUID(),
            ...rawInsertPayload,
            created_at: new Date().toISOString(),
          };
          localStore.crm_leads.unshift(savedLead);
        } else {
          const { data, error } = await safeSupabaseInsert(supabase, 'crm_leads', rawInsertPayload);

          if (error) {
            console.error('[API /api/db] Supabase INSERT error in crm_leads:', error);
            return res.status(400).json({ error: error.message, details: error });
          }

          savedLead = { ...rawInsertPayload, ...data };
        }

        if (savedLead?.id) {
          if (rawInsertPayload.description || rawInsertPayload.notes) {
            recordNotesOverlay.set(`crm_leads:${savedLead.id}`, {
              description: rawInsertPayload.description,
              notes: rawInsertPayload.notes,
            });
          }
          recordExtrasOverlay.set(`crm_leads:${savedLead.id}`, {
            department: leadDept,
            assigned_to: leadAssignee || null,
            jurisdiction,
            tax_id: taxId,
            reg_number: regNumber,
            contract_number: contractNumber,
          });
        }

        let telegramPush: { pushed: boolean; count?: number; reason?: string } = {
          pushed: false,
        };
        if (leadAssignee || leadDept) {
          telegramPush = await sendTelegramTaskOrDepartmentPush({
            supabase,
            assignedToId: leadAssignee || null,
            department: leadDept,
            taskTitle: `Сделка CRM: ${clientName} (${title})`,
            taskPriority: 'High',
            taskType: 'CRM Deal',
          });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeLeadRow(savedLead),
          telegramPush,
        });
      }

      // БЛОК 4: Единое инфополе и мгновенная связь между сотрудниками (workspace_messages)
      if (table === 'workspace_messages') {
        const msgBody = String(
          payload.message_text || payload.text || payload.content || payload.message || ''
        ).trim();
        if (!msgBody) {
          return res.status(400).json({ error: 'Текст сообщения не может быть пустым.' });
        }

        const allNodes = await fetchAllCompanyNodes(supabase);
        const rawTargetType = String(
          payload.target_type || payload.scope_type || payload.scope || ''
        )
          .trim()
          .toLowerCase();

        let resolvedTargetType: string = 'broadcast';
        let resolvedTargetId: string | null = null;
        let resolvedTargetLabel: string = 'Всем сотрудникам';

        if (rawTargetType === 'task' || payload.task_id) {
          resolvedTargetType = 'task';
          resolvedTargetId = String(
            payload.task_id || payload.target_id || payload.entity_id || ''
          ).trim() || null;
          resolvedTargetLabel = String(
            payload.target_label || payload.entity_title || 'Задача'
          ).trim();
        } else if (rawTargetType === 'deal' || rawTargetType === 'lead' || payload.lead_id) {
          resolvedTargetType = 'deal';
          resolvedTargetId = String(
            payload.lead_id || payload.target_id || payload.entity_id || ''
          ).trim() || null;
          resolvedTargetLabel = String(
            payload.target_label || payload.entity_title || 'Сделка CRM'
          ).trim();
        } else if (
          rawTargetType === 'direct' ||
          payload.recipient_id ||
          (payload.target_id &&
            rawTargetType !== 'department' &&
            rawTargetType !== 'broadcast' &&
            rawTargetType !== 'general')
        ) {
          resolvedTargetType = 'direct';
          resolvedTargetId = String(payload.target_id || payload.recipient_id || '').trim() || null;
          const recipientNode = resolvedTargetId
            ? allNodes.find((n) => String(n.id) === resolvedTargetId)
            : null;
          resolvedTargetLabel = String(
            payload.target_label || recipientNode?.name || 'Сотрудник'
          ).trim();
        } else if (rawTargetType === 'department' || payload.target_department) {
          resolvedTargetType = 'department';
          const deptVal = String(
            payload.target_id || payload.target_department || payload.target_label || ''
          ).trim();
          resolvedTargetId = deptVal || null;
          resolvedTargetLabel = String(payload.target_label || deptVal || 'Отдел').trim();
        } else {
          resolvedTargetType = rawTargetType === 'general' ? 'general' : 'broadcast';
          resolvedTargetId = null;
          resolvedTargetLabel = String(payload.target_label || 'Всем сотрудникам').trim();
        }

        const rawMsgPayload: Record<string, any> = {
          company_id: companyId,
          sender_id: payload.sender_id || null,
          sender_name: payload.sender_name || 'Сотрудник TedCloud',
          sender_role: payload.sender_role || '',
          target_type: resolvedTargetType,
          target_id: resolvedTargetId,
          target_label: resolvedTargetLabel,
          message_text: msgBody,
          text: msgBody,
          is_urgent: Boolean(payload.is_urgent),
          is_read: Boolean(payload.is_read ?? false),
        };

        const fullRecordExtras: Record<string, any> = {
          ...rawMsgPayload,
          content: msgBody,
          scope_type: resolvedTargetType === 'general' ? 'broadcast' : resolvedTargetType,
          recipient_id:
            resolvedTargetType === 'direct'
              ? resolvedTargetId
              : payload.recipient_id || null,
          target_department:
            resolvedTargetType === 'department'
              ? resolvedTargetLabel
              : payload.target_department || null,
          task_id:
            resolvedTargetType === 'task' ? resolvedTargetId : payload.task_id || null,
          lead_id:
            resolvedTargetType === 'deal' ? resolvedTargetId : payload.lead_id || null,
          entity_id:
            resolvedTargetType === 'task' || resolvedTargetType === 'deal'
              ? resolvedTargetId
              : payload.entity_id || null,
          entity_title:
            resolvedTargetType === 'task' || resolvedTargetType === 'deal'
              ? resolvedTargetLabel
              : payload.entity_title || null,
        };

        let savedMsg: any = {
          id: crypto.randomUUID(),
          ...fullRecordExtras,
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { data, error } = await safeSupabaseInsert(
            supabase,
            'workspace_messages',
            rawMsgPayload
          );
          if (!error && data) {
            savedMsg = {
              ...fullRecordExtras,
              ...data,
              target_type: data.target_type && data.target_type !== 'general'
                ? data.target_type
                : resolvedTargetType,
              target_id: data.target_id ?? resolvedTargetId,
              target_label: data.target_label ?? resolvedTargetLabel,
              message_text: msgBody,
              text: msgBody,
              content: msgBody,
            };
          }
        }

        if (savedMsg?.id) {
          recordExtrasOverlay.set(`workspace_messages:${savedMsg.id}`, {
            ...fullRecordExtras,
            message_text: msgBody,
            text: msgBody,
            target_type: resolvedTargetType,
            target_id: resolvedTargetId,
            target_label: resolvedTargetLabel,
          });
        }

        localStore.workspace_messages.unshift(savedMsg);

        const pushStatus = await sendTelegramWorkspaceMessagePush({
          supabase,
          messageRecord: savedMsg,
        });

        return res.status(200).json({
          ok: true,
          data: normalizeMessageRow(savedMsg),
          telegramPush: pushStatus,
        });
      }

      return res.status(400).json({ error: `Неизвестная таблица: ${table}` });
    }

    if (method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { table, id, updates } = body;

      if (!table || !id || !updates || typeof updates !== 'object') {
        return res.status(400).json({
          error: 'В теле PATCH-запроса обязательны поля "table", "id" и объект "updates".',
        });
      }

      if (table === 'companies') {
        const rawUpdates: Record<string, any> = {};
        if (updates.name !== undefined) rawUpdates.name = String(updates.name).trim();
        if (updates.plan !== undefined) rawUpdates.plan = updates.plan;
        if (updates.payment_region !== undefined)
          rawUpdates.payment_region = updates.payment_region;
        if (updates.departments !== undefined) {
          rawUpdates.departments = Array.isArray(updates.departments) ? updates.departments : [];
          const prevExtras = recordExtrasOverlay.get(`companies:${id}`) || {};
          recordExtrasOverlay.set(`companies:${id}`, {
            ...prevExtras,
            departments: rawUpdates.departments,
          });
        }

        if (!supabase) {
          const idx = localStore.companies.findIndex((c) => c.id === id);
          if (idx !== -1) {
            localStore.companies[idx] = { ...localStore.companies[idx], ...rawUpdates };
            return res
              .status(200)
              .json({ ok: true, data: normalizeCompanyRow(localStore.companies[idx]) });
          }
          return res.status(200).json({ ok: true, data: normalizeCompanyRow({ id, ...rawUpdates }) });
        }

        const { data, error } = await safeSupabaseUpdate(supabase, 'companies', id, rawUpdates);
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res
          .status(200)
          .json({ ok: true, data: normalizeCompanyRow({ id, ...rawUpdates, ...data }) });
      }

      if (table === 'tasks') {
        const rawUpdates: Record<string, any> = {};
        if (updates.status !== undefined) rawUpdates.status = updates.status;
        if (updates.priority !== undefined) rawUpdates.priority = updates.priority;
        if (updates.department !== undefined) {
          rawUpdates.department = updates.department ? String(updates.department).trim() : null;
        }
        if (updates.assigned_to !== undefined) {
          rawUpdates.assigned_to = updates.assigned_to || null;
          if (updates.assigned_to) {
            rawUpdates.owner_node_id = updates.assigned_to;
          }
        }
        if (updates.owner_node_id !== undefined) {
          rawUpdates.owner_node_id = updates.owner_node_id;
        }
        if (updates.title !== undefined) rawUpdates.title = String(updates.title).trim();
        if (updates.type !== undefined) rawUpdates.type = updates.type;
        if (updates.description !== undefined || updates.notes !== undefined) {
          const noteVal =
            updates.description !== undefined ? updates.description : updates.notes;
          rawUpdates.description = noteVal;
          rawUpdates.notes = noteVal;
          recordNotesOverlay.set(`tasks:${id}`, { description: noteVal, notes: noteVal });
        }

        const prevExtras = recordExtrasOverlay.get(`tasks:${id}`) || {};
        recordExtrasOverlay.set(`tasks:${id}`, {
          ...prevExtras,
          ...(rawUpdates.department !== undefined ? { department: rawUpdates.department } : {}),
          ...(rawUpdates.assigned_to !== undefined ? { assigned_to: rawUpdates.assigned_to } : {}),
        });

        let updatedTask: any = null;
        let previousAssignee: string | null = null;
        let previousDept: string | null = null;

        if (!supabase) {
          const idx = localStore.tasks.findIndex((t) => t.id === id);
          if (idx === -1) {
            return res.status(404).json({ error: 'Задача не найдена.' });
          }
          previousAssignee = localStore.tasks[idx].assigned_to || null;
          previousDept = localStore.tasks[idx].department || null;
          localStore.tasks[idx] = { ...localStore.tasks[idx], ...rawUpdates };
          updatedTask = localStore.tasks[idx];
        } else {
          const { data: existing } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          previousAssignee = existing?.assigned_to || null;
          previousDept = existing?.department || null;

          const { data, error } = await safeSupabaseUpdate(supabase, 'tasks', id, rawUpdates);
          if (error) {
            console.error('[API /api/db] Supabase PATCH error in tasks:', error);
            return res.status(400).json({ error: error.message, details: error });
          }
          updatedTask = { ...existing, ...rawUpdates, ...data };
        }

        let telegramPush: { pushed: boolean; count?: number; reason?: string } = {
          pushed: false,
          reason: 'not_reassigned',
        };
        if (rawUpdates.assigned_to && rawUpdates.assigned_to !== previousAssignee) {
          telegramPush = await sendTelegramTaskOrDepartmentPush({
            supabase,
            assignedToId: rawUpdates.assigned_to,
            taskId: updatedTask.id,
            taskTitle: updatedTask.title,
            taskPriority: updatedTask.priority || 'Medium',
            taskType: updatedTask.type || 'Task',
          });
        } else if (
          rawUpdates.department &&
          rawUpdates.department !== previousDept &&
          !updatedTask.assigned_to
        ) {
          telegramPush = await sendTelegramTaskOrDepartmentPush({
            supabase,
            department: rawUpdates.department,
            taskId: updatedTask.id,
            taskTitle: updatedTask.title,
            taskPriority: updatedTask.priority || 'Medium',
            taskType: updatedTask.type || 'Task',
          });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeTaskRow(updatedTask),
          telegramPush,
        });
      }

      if (table === 'crm_leads') {
        const rawUpdates: Record<string, any> = {};
        if (updates.status !== undefined || updates.stage !== undefined) {
          const nextStatus = updates.status || updates.stage;
          rawUpdates.status = nextStatus;
          rawUpdates.stage = nextStatus;
        }
        if (updates.client_name !== undefined || updates.full_name !== undefined) {
          const nextName = String(updates.client_name || updates.full_name).trim();
          rawUpdates.client_name = nextName;
          rawUpdates.full_name = nextName;
        }
        if (updates.title !== undefined) {
          rawUpdates.title = String(updates.title).trim();
        }
        if (updates.amount !== undefined || updates.deal_value !== undefined) {
          const nextAmount = Number(updates.amount ?? updates.deal_value ?? 0);
          rawUpdates.amount = nextAmount;
          rawUpdates.deal_value = nextAmount;
        }
        if (updates.contact !== undefined || updates.phone !== undefined) {
          const nextContact = updates.contact ?? updates.phone ?? null;
          rawUpdates.contact = nextContact;
          rawUpdates.phone = nextContact;
        }
        if (updates.department !== undefined) {
          rawUpdates.department = updates.department ? String(updates.department).trim() : null;
        }
        if (updates.assigned_to !== undefined) {
          rawUpdates.assigned_to = updates.assigned_to || null;
          if (updates.assigned_to) {
            rawUpdates.owner_node_id = updates.assigned_to;
          }
        }
        if (updates.jurisdiction !== undefined) {
          rawUpdates.jurisdiction = updates.jurisdiction === 'GLOBAL' ? 'GLOBAL' : 'RU';
        }
        if (updates.tax_id !== undefined) {
          rawUpdates.tax_id = updates.tax_id ? String(updates.tax_id).trim() : null;
        }
        if (updates.reg_number !== undefined) {
          rawUpdates.reg_number = updates.reg_number ? String(updates.reg_number).trim() : null;
        }
        if (updates.contract_number !== undefined) {
          rawUpdates.contract_number = updates.contract_number
            ? String(updates.contract_number).trim()
            : null;
        }
        if (updates.description !== undefined || updates.notes !== undefined) {
          const noteVal =
            updates.description !== undefined ? updates.description : updates.notes;
          rawUpdates.description = noteVal;
          rawUpdates.notes = noteVal;
          recordNotesOverlay.set(`crm_leads:${id}`, { description: noteVal, notes: noteVal });
        }

        const prevLeadExtras = recordExtrasOverlay.get(`crm_leads:${id}`) || {};
        recordExtrasOverlay.set(`crm_leads:${id}`, {
          ...prevLeadExtras,
          ...rawUpdates,
        });

        if (!supabase) {
          const idx = localStore.crm_leads.findIndex((l) => l.id === id);
          if (idx === -1) {
            return res.status(404).json({ error: 'Сделка не найдена.' });
          }
          localStore.crm_leads[idx] = { ...localStore.crm_leads[idx], ...rawUpdates };
          return res.status(200).json({
            ok: true,
            data: normalizeLeadRow(localStore.crm_leads[idx]),
          });
        }

        const { data: existing } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        const { data, error } = await safeSupabaseUpdate(supabase, 'crm_leads', id, rawUpdates);

        if (error) {
          console.error('[API /api/db] Supabase PATCH error in crm_leads:', error);
          return res.status(400).json({ error: error.message, details: error });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeLeadRow({ ...existing, ...rawUpdates, ...data }),
        });
      }

      if (table === 'organization_nodes') {
        const rawUpdates: Record<string, any> = {};
        if (updates.name !== undefined) rawUpdates.name = String(updates.name).trim();
        if (updates.role_type !== undefined)
          rawUpdates.role_type = String(updates.role_type).trim();
        if (updates.department !== undefined) {
          rawUpdates.department = updates.department ? String(updates.department).trim() : null;
        }
        if (updates.email !== undefined) {
          rawUpdates.email = updates.email ? String(updates.email).trim() : null;
        }
        if (updates.avatar_url !== undefined) {
          rawUpdates.avatar_url = updates.avatar_url ? String(updates.avatar_url).trim() : null;
          const prevNodeExtras = recordExtrasOverlay.get(`organization_nodes:${id}`) || {};
          recordExtrasOverlay.set(`organization_nodes:${id}`, {
            ...prevNodeExtras,
            avatar_url: rawUpdates.avatar_url,
          });
        }
        if (updates.telegram_chat_id !== undefined) {
          rawUpdates.telegram_chat_id = updates.telegram_chat_id
            ? String(updates.telegram_chat_id).trim()
            : null;
        }
        if (updates.invite_code !== undefined) {
          rawUpdates.invite_code = String(updates.invite_code).trim().toUpperCase();
        }
        if (updates.access_level !== undefined) {
          rawUpdates.access_level = normalizeAccessLevel(updates.access_level, updates.role_type);
        }
        if (updates.permissions !== undefined) {
          const level = normalizeAccessLevel(updates.access_level, updates.role_type);
          rawUpdates.permissions = normalizePermissionsObject(level, updates.permissions);
        }
        if (updates.tree_path !== undefined) {
          rawUpdates.tree_path = updates.tree_path;
        }

        if (!supabase) {
          const idx = localStore.organization_nodes.findIndex((n) => n.id === id);
          if (idx === -1) {
            return res.status(404).json({ error: 'Сотрудник не найден.' });
          }
          localStore.organization_nodes[idx] = {
            ...localStore.organization_nodes[idx],
            ...rawUpdates,
          };
          return res.status(200).json({
            ok: true,
            data: normalizeNodeRow(localStore.organization_nodes[idx]),
          });
        }

        const { data: existing } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        const { data, error } = await safeSupabaseUpdate(
          supabase,
          'organization_nodes',
          id,
          rawUpdates
        );

        if (error) {
          console.error('[API /api/db] Supabase PATCH error in organization_nodes:', error);
          return res.status(400).json({ error: error.message, details: error });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeNodeRow({ ...existing, ...rawUpdates, ...data }),
        });
      }

      return res.status(400).json({ error: `Таблица ${table} не поддерживает PATCH.` });
    }

    if (method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const table = body.table || req.query?.table;
      const id = body.id || req.query?.id;

      if (!table || !id) {
        return res.status(400).json({
          error: 'Для удаления записи необходимы параметры "table" и "id".',
        });
      }

      if (!['tasks', 'crm_leads', 'organization_nodes'].includes(table)) {
        return res.status(400).json({
          error: `Удаление из таблицы "${table}" запрещено политикой безопасности.`,
        });
      }

      if (!supabase) {
        if (table === 'tasks') {
          localStore.tasks = localStore.tasks.filter((t) => t.id !== id);
        } else if (table === 'crm_leads') {
          localStore.crm_leads = localStore.crm_leads.filter((l) => l.id !== id);
        } else if (table === 'organization_nodes') {
          localStore.organization_nodes = localStore.organization_nodes.filter((n) => n.id !== id);
        }
        return res.status(200).json({ ok: true, id });
      }

      if (table === 'organization_nodes') {
        await supabase.from('tasks').update({ assigned_to: null }).eq('assigned_to', id);
        await supabase.from('tasks').update({ owner_node_id: null }).eq('owner_node_id', id);
      }

      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) {
        console.error(`[API /api/db] Supabase DELETE error in ${table}:`, error);
        return res.status(400).json({ error: error.message, details: error });
      }

      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (err: any) {
    console.error('[API /api/db] Fatal Error:', err);
    return res.status(500).json({
      error: err?.message || 'Внутренняя ошибка серверного шлюза /api/db',
    });
  }
}
