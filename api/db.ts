import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  companies: ['name', 'plan', 'payment_region'],
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
    'owner_node_id',
    'company_id',
    'full_name',
    'deal_value',
    'phone',
    'stage',
    'source',
  ],
};

// Оверлей для сохранения рабочих комментариев (notes/description), если в схеме удаленной БД еще не создана колонка
const recordNotesOverlay = new Map<string, { description?: string | null; notes?: string | null }>();

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

  for (let attempt = 0; attempt < 16; attempt++) {
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

  for (let attempt = 0; attempt < 16; attempt++) {
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

export function normalizeAccessLevel(rawLevel?: string | null, roleType?: string | null): 'root' | 'manager' | 'member' | 'observer' {
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
    if (rawPermissions && typeof rawPermissions === 'object' && rawPermissions.pending_delegate_to) {
      baseRoot.pending_delegate_to = rawPermissions.pending_delegate_to;
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

  return result;
}

interface InMemoryStore {
  companies: Record<string, any>[];
  organization_nodes: Record<string, any>[];
  tasks: Record<string, any>[];
  crm_leads: Record<string, any>[];
}

const localStore: InMemoryStore = {
  companies: [],
  organization_nodes: [],
  tasks: [],
  crm_leads: [],
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

async function sendTelegramTaskPush(params: {
  supabase: SupabaseClient | null;
  assignedToId: string | null | undefined;
  taskId?: string;
  taskTitle: string;
  taskPriority: string;
  taskType?: string;
}): Promise<{ pushed: boolean; reason?: string }> {
  const { supabase, assignedToId, taskId, taskTitle, taskPriority, taskType } = params;
  if (!assignedToId) {
    return { pushed: false, reason: 'no_assignee' };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { pushed: false, reason: 'missing_bot_token' };
  }

  let employeeName = 'Сотрудник';
  let employeeRole = '';
  let telegramChatId: string | null = null;

  if (supabase) {
    const { data: node } = await supabase
      .from('organization_nodes')
      .select('id, name, role_type, telegram_chat_id')
      .eq('id', assignedToId)
      .maybeSingle();

    if (node) {
      employeeName = node.name || employeeName;
      employeeRole = node.role_type || '';
      telegramChatId = node.telegram_chat_id ? String(node.telegram_chat_id).trim() : null;
    }
  } else {
    const node = localStore.organization_nodes.find((n) => n.id === assignedToId);
    if (node) {
      employeeName = node.name || employeeName;
      employeeRole = node.role_type || '';
      telegramChatId = node.telegram_chat_id ? String(node.telegram_chat_id).trim() : null;
    }
  }

  if (!telegramChatId) {
    return { pushed: false, reason: 'missing_telegram_chat_id' };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    'https://tedcloud.vercel.app'
  ).replace(/\/$/, '');

  const notificationHtml = [
    '<b>УВЕДОМЛЕНИЕ TEDCLOUD</b>',
    'Назначена новая корпоративная задача.',
    '',
    `<b>Исполнитель:</b> ${employeeName}${employeeRole ? ` (${employeeRole})` : ''}`,
    `<b>Задача:</b> ${taskTitle}`,
    `<b>Категория:</b> ${taskType || 'Task'}`,
    `<b>Приоритет:</b> ${taskPriority || 'Medium'}`,
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

    if (!tgRes.ok) {
      const errBody = await tgRes.text();
      console.error('[API /api/db] Telegram Push API non-200:', errBody);
      return { pushed: false, reason: 'telegram_api_error' };
    }

    return { pushed: true };
  } catch (err: any) {
    console.error('[API /api/db] Telegram Push network error:', err);
    return { pushed: false, reason: err?.message || 'network_error' };
  }
}

function normalizeTaskRow(row: any) {
  const overlay = row.id ? recordNotesOverlay.get(`tasks:${row.id}`) : undefined;
  const noteText =
    row.description ?? row.notes ?? overlay?.description ?? overlay?.notes ?? null;

  return {
    ...row,
    description: noteText,
    notes: noteText,
    type: row.type || 'Task',
    priority: row.priority || 'Medium',
    status: row.status || 'Todo',
    assigned_to: row.assigned_to ?? row.owner_node_id ?? null,
    owner_node_id: row.owner_node_id ?? row.assigned_to ?? null,
    created_by: row.created_by ?? row.owner_node_id ?? null,
  };
}

function normalizeNodeRow(row: any) {
  const accessLevel = normalizeAccessLevel(row.access_level, row.role_type);
  const permissions = normalizePermissionsObject(accessLevel, row.permissions);

  return {
    ...row,
    role_type: row.role_type || 'Специалист',
    department: row.department || null,
    email: row.email || null,
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
  const noteText =
    row.description ?? row.notes ?? overlay?.description ?? overlay?.notes ?? null;
  const clientName = row.client_name || row.full_name || row.title || 'Контрагент';
  const title = row.title || clientName;
  const amount = Number(row.amount ?? row.deal_value ?? 0);
  const contact = row.contact ?? row.phone ?? null;
  const status = row.status || row.stage || 'New';

  return {
    ...row,
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
  };
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

        return res.status(200).json({
          ok: true,
          mode: 'local_empty',
          company: localStore.companies[0] || null,
          currentProfile,
          nodes,
          tasks: localStore.tasks.map(normalizeTaskRow),
          leads: localStore.crm_leads.map(normalizeLeadRow),
        });
      }

      const [companiesRes, nodesRes, tasksRes, leadsRes] = await Promise.all([
        safeSelectTable(supabase, 'companies', false, 1),
        safeSelectTable(supabase, 'organization_nodes', true),
        safeSelectTable(supabase, 'tasks', false),
        safeSelectTable(supabase, 'crm_leads', false),
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

      return res.status(200).json({
        ok: true,
        mode: 'supabase',
        company: companiesRes.data?.[0] || null,
        currentProfile,
        nodes: rawNodes,
        tasks: rawTasks,
        leads: rawLeads,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      // Вход сотрудника по любому из 4 полей (telegram_chat_id, invite_code, email, name)
      if (body.action === 'login') {
        const q = String(body.input || body.identifier || '').trim().toLowerCase();
        if (!q) {
          return res.status(400).json({ error: 'Введите идентификатор для входа.' });
        }

        let nodes: any[] = [];
        let company: any = null;

        if (!supabase) {
          nodes = localStore.organization_nodes.map(normalizeNodeRow);
          company = localStore.companies[0] || null;
        } else {
          const [nodesRes, companiesRes] = await Promise.all([
            safeSelectTable(supabase, 'organization_nodes', true),
            safeSelectTable(supabase, 'companies', false, 1),
          ]);
          if (nodesRes.error) {
            return res.status(400).json({ error: nodesRes.error.message });
          }
          nodes = (nodesRes.data || []).map(normalizeNodeRow);
          company = companiesRes.data?.[0] || null;
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
            company = matchedCompany;
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

        if (!supabase) {
          const newCompany = {
            id: crypto.randomUUID(),
            name: companyName,
            plan: 'Business',
            payment_region: 'RU',
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
            company: newCompany,
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
          }
        );

        if (compErr || !createdCompany) {
          return res.status(400).json({
            error: compErr?.message || 'Не удалось создать организацию в БД.',
          });
        }

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
          company: createdCompany,
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
        const resolvedOwnerNodeId =
          payload.owner_node_id ||
          payload.assigned_to ||
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
          assigned_to: payload.assigned_to || resolvedOwnerNodeId || null,
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
          savedTask = { ...rawInsertPayload, ...data };
        }

        if (savedTask?.id && (rawInsertPayload.description || rawInsertPayload.notes)) {
          recordNotesOverlay.set(`tasks:${savedTask.id}`, {
            description: rawInsertPayload.description,
            notes: rawInsertPayload.notes,
          });
        }

        const pushStatus = await sendTelegramTaskPush({
          supabase,
          assignedToId: savedTask.assigned_to || rawInsertPayload.assigned_to,
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

        if (!clientName) {
          return res
            .status(400)
            .json({ error: 'Поле "client_name" обязательно для создания сделки.' });
        }

        const fallbackNodeId = await resolveFallbackOwnerNodeId(supabase, companyId);

        const rawInsertPayload: Record<string, any> = {
          company_id: companyId,
          owner_node_id: payload.owner_node_id || fallbackNodeId || null,
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
          source: payload.source || 'Direct B2B',
        };

        if (!supabase) {
          const newRecord = {
            id: crypto.randomUUID(),
            ...rawInsertPayload,
            created_at: new Date().toISOString(),
          };
          localStore.crm_leads.unshift(newRecord);
          return res.status(200).json({ ok: true, data: normalizeLeadRow(newRecord) });
        }

        const { data, error } = await safeSupabaseInsert(supabase, 'crm_leads', rawInsertPayload);

        if (error) {
          console.error('[API /api/db] Supabase INSERT error in crm_leads:', error);
          return res.status(400).json({ error: error.message, details: error });
        }

        const savedLead = { ...rawInsertPayload, ...data };
        if (savedLead?.id && (rawInsertPayload.description || rawInsertPayload.notes)) {
          recordNotesOverlay.set(`crm_leads:${savedLead.id}`, {
            description: rawInsertPayload.description,
            notes: rawInsertPayload.notes,
          });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeLeadRow(savedLead),
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
        if (updates.payment_region !== undefined) rawUpdates.payment_region = updates.payment_region;

        if (!supabase) {
          const idx = localStore.companies.findIndex((c) => c.id === id);
          if (idx !== -1) {
            localStore.companies[idx] = { ...localStore.companies[idx], ...rawUpdates };
            return res.status(200).json({ ok: true, data: localStore.companies[idx] });
          }
          return res.status(200).json({ ok: true, data: { id, ...rawUpdates } });
        }

        const { data, error } = await safeSupabaseUpdate(supabase, 'companies', id, rawUpdates);
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.status(200).json({ ok: true, data: { id, ...rawUpdates, ...data } });
      }

      if (table === 'tasks') {
        const rawUpdates: Record<string, any> = {};
        if (updates.status !== undefined) rawUpdates.status = updates.status;
        if (updates.priority !== undefined) rawUpdates.priority = updates.priority;
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

        let updatedTask: any = null;
        let previousAssignee: string | null = null;

        if (!supabase) {
          const idx = localStore.tasks.findIndex((t) => t.id === id);
          if (idx === -1) {
            return res.status(404).json({ error: 'Задача не найдена.' });
          }
          previousAssignee = localStore.tasks[idx].assigned_to || null;
          localStore.tasks[idx] = { ...localStore.tasks[idx], ...rawUpdates };
          updatedTask = localStore.tasks[idx];
        } else {
          const { data: existing } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          previousAssignee = existing?.assigned_to || null;

          const { data, error } = await safeSupabaseUpdate(supabase, 'tasks', id, rawUpdates);
          if (error) {
            console.error('[API /api/db] Supabase PATCH error in tasks:', error);
            return res.status(400).json({ error: error.message, details: error });
          }
          updatedTask = { ...existing, ...rawUpdates, ...data };
        }

        let telegramPush = { pushed: false, reason: 'not_reassigned' };
        if (rawUpdates.assigned_to && rawUpdates.assigned_to !== previousAssignee) {
          telegramPush = await sendTelegramTaskPush({
            supabase,
            assignedToId: rawUpdates.assigned_to,
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
        if (updates.description !== undefined || updates.notes !== undefined) {
          const noteVal =
            updates.description !== undefined ? updates.description : updates.notes;
          rawUpdates.description = noteVal;
          rawUpdates.notes = noteVal;
          recordNotesOverlay.set(`crm_leads:${id}`, { description: noteVal, notes: noteVal });
        }

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
        if (updates.role_type !== undefined) rawUpdates.role_type = String(updates.role_type).trim();
        if (updates.department !== undefined) {
          rawUpdates.department = updates.department ? String(updates.department).trim() : null;
        }
        if (updates.email !== undefined) {
          rawUpdates.email = updates.email ? String(updates.email).trim() : null;
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
          const level = normalizeAccessLevel(
            updates.access_level,
            updates.role_type
          );
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
          error: 'Для DELETE-запроса обязательны параметры "table" и "id".',
        });
      }

      if (!['tasks', 'crm_leads', 'organization_nodes'].includes(table)) {
        return res.status(400).json({ error: `Удаление из таблицы ${table} запрещено.` });
      }

      if (!supabase) {
        const list = (localStore as any)[table] as Record<string, any>[];
        const idx = list.findIndex((item) => item.id === id);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
        return res.status(200).json({ ok: true, deletedId: id, table });
      }

      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        console.error(`[API /api/db] Supabase DELETE error in ${table}:`, error);
        return res.status(400).json({ error: error.message, details: error });
      }

      return res.status(200).json({ ok: true, deletedId: id, table });
    }

    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (err: any) {
    console.error('[API /api/db] Fatal Error:', err);
    return res.status(400).json({
      error: err?.message || 'Internal Server Error in /api/db',
    });
  }
}
