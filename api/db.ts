import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export type AiAssistantMode =
  | 'daily_brief'
  | 'decompose_task'
  | 'workload_analysis'
  | 'custom';

export interface TaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export function formatError(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') {
    return err === '[object Object]' ? 'Unknown error' : err;
  }
  const extracted =
    err.message ||
    err.error_description ||
    err.details ||
    err.hint ||
    (typeof err.error === 'string' ? err.error : err.error?.message);
  if (typeof extracted === 'string' && extracted !== '[object Object]') {
    return extracted;
  }
  try {
    const json = JSON.stringify(err);
    return json && json !== '{}' ? json : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

function generateInvoiceNumber(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `TC-${yyyy}${mm}${dd}-${rand}`;
}

function buildBuiltInChecklistForTask(
  taskTitle: string,
  taskDescription?: string | null
): { checklist: TaskChecklistItem[]; summary: string } {
  const titleClean = String(taskTitle || 'Корпоративное поручение').trim();
  const lower = `${titleClean} ${taskDescription || ''}`.toLowerCase();

  let steps: string[] = [];
  if (
    lower.includes('договор') ||
    lower.includes('контракт') ||
    lower.includes('юрид') ||
    lower.includes('сделк') ||
    lower.includes('инн') ||
    lower.includes('кп') ||
    lower.includes('коммерческ')
  ) {
    steps = [
      `Проверить юридические реквизиты контрагента (ИНН/КПП) по задаче «${titleClean}»`,
      'Согласовать финансовые условия, спецификацию и график расчетов',
      'Провести правовую экспертизу проекта документа с профильным отделом',
      'Направить финальную редакцию на подписание и зафиксировать номер в CRM',
      'Обновить статус поручения и уведомить ответственного руководителя',
    ];
  } else if (
    lower.includes('отчет') ||
    lower.includes('финанс') ||
    lower.includes('бюджет') ||
    lower.includes('аудит') ||
    lower.includes('сверк') ||
    lower.includes('экономи')
  ) {
    steps = [
      `Собрать первичные данные и выгрузки по задаче «${titleClean}»`,
      'Выполнить сверку показателей с реестром сделок CRM и счетами биллинга',
      'Сформировать аналитическую сводку с отклонениями и выводами',
      'Согласовать итоговый расчет с руководителем подразделения',
    ];
  } else if (
    lower.includes('клиент') ||
    lower.includes('продаж') ||
    lower.includes('презентац') ||
    lower.includes('встреч') ||
    lower.includes('звонок')
  ) {
    steps = [
      `Подготовить повестку и материалы по клиенту для «${titleClean}»`,
      'Провести квалификацию потребностей и зафиксировать ключевые возражения',
      'Сформировать персональное коммерческое предложение со сметой',
      'Зафиксировать итоги переговоров и следующий шаг в карточке сделки CRM',
    ];
  } else {
    steps = [
      `Уточнить входные требования и критерии готовности по задаче «${titleClean}»`,
      'Распределить зону ответственности и согласовать ресурсы внутри отдела',
      'Выполнить основной этап работ и промежуточную проверку качества',
      'Подготовить итоговый результат и зафиксировать выполнение в TedCloud',
    ];
  }

  const checklist: TaskChecklistItem[] = steps.map((stepTitle, idx) => ({
    id: `chk_${Date.now()}_${idx + 1}`,
    title: stepTitle,
    done: false,
  }));

  const summary = `Задача декомпозирована на ${checklist.length} последовательных этапа с контролем исполнения в рабочем контуре TedCloud.`;
  return { checklist, summary };
}

function runBuiltInAiAssistant(input: {
  mode: AiAssistantMode;
  prompt?: string;
  taskTitle?: string;
  taskDescription?: string;
  companyName?: string;
  currentUser?: any | null;
  nodes: any[];
  tasks: any[];
  leads: any[];
  messages: any[];
}): {
  mode: AiAssistantMode;
  reply: string;
  checklist?: TaskChecklistItem[];
  aiSummary?: string;
  provider: 'gemini' | 'tedcloud-engine';
} {
  const {
    mode,
    prompt = '',
    taskTitle = '',
    taskDescription = '',
    companyName = 'TedCloud',
    currentUser,
    nodes = [],
    tasks = [],
    leads = [],
    messages = [],
  } = input;

  if (mode === 'decompose_task') {
    const { checklist, summary } = buildBuiltInChecklistForTask(
      taskTitle || prompt || 'Поручение',
      taskDescription
    );
    const replyLines = [
      `ИИ-декомпозиция задачи «${taskTitle || prompt || 'Поручение'}» выполнена (${checklist.length} шага):`,
      '',
      ...checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
      '',
      summary,
    ];
    return {
      mode: 'decompose_task',
      reply: replyLines.join('\n'),
      checklist,
      aiSummary: summary,
      provider: 'tedcloud-engine',
    };
  }

  const openTasks = tasks.filter((t) => t.status !== 'Done');
  const highPriorityTasks = openTasks.filter((t) => t.priority === 'High');
  const doneTasks = tasks.filter((t) => t.status === 'Done');

  const userTasks = currentUser?.id
    ? openTasks.filter(
        (t) =>
          t.assigned_to === currentUser.id ||
          t.owner_node_id === currentUser.id ||
          (currentUser.department &&
            t.department &&
            String(t.department).toLowerCase() === String(currentUser.department).toLowerCase())
      )
    : openTasks;

  const urgentMessages = messages.filter((m) => Boolean(m.is_urgent));
  const activeLeads = leads.filter((l) => (l.status || l.stage) !== 'Lost');
  const wonLeads = leads.filter((l) => (l.status || l.stage) === 'Won');
  const activePipelineSum = activeLeads.reduce(
    (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
    0
  );
  const wonPipelineSum = wonLeads.reduce(
    (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
    0
  );
  const conversionRate =
    leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

  if (mode === 'daily_brief') {
    const userName = currentUser?.name || 'Сотрудник';
    const userRole = currentUser?.role_type || 'Специалист';
    const topUserTasks = userTasks.slice(0, 4);

    const lines: string[] = [
      `ПЕРСОНАЛЬНАЯ СВОДКА ДНЯ — ${userName} (${userRole})`,
      `Организация: ${companyName}`,
      '',
      '1. ОПЕРАЦИОННЫЙ КОНТУР ЗАДАЧ:',
      `• Активных задач в вашей зоне ответственности: ${userTasks.length} (всего по компании открыто: ${openTasks.length}, выполнено: ${doneTasks.length}).`,
      `• Срочных поручений высокого приоритета (High): ${
        userTasks.filter((t) => t.priority === 'High').length
      }.`,
    ];

    if (topUserTasks.length > 0) {
      lines.push('• Приоритетный фокус на сегодня:');
      topUserTasks.forEach((t, idx) => {
        lines.push(
          `  ${idx + 1}) [${t.priority || 'Medium'} | ${t.status || 'Todo'}] ${t.title}${
            t.department ? ` (${t.department})` : ''
          }`
        );
      });
    } else {
      lines.push('• Все текущие задачи закрыты или ожидают новых назначений.');
    }

    lines.push('');
    lines.push('2. ИНФОПОЛЕ И КОММУНИКАЦИИ:');
    lines.push(
      `• Всего сообщений в рабочем контуре: ${messages.length} (срочных уведомлений: ${urgentMessages.length}).`
    );

    lines.push('');
    lines.push('3. КОММЕРЧЕСКИЙ КОНТУР CRM:');
    lines.push(
      `• Активных сделок в воронке: ${activeLeads.length} на сумму ${Math.round(
        activePipelineSum
      ).toLocaleString('ru-RU')} RUB.`
    );
    lines.push(
      `• Закрыто контрактов (Won): ${wonLeads.length} на сумму ${Math.round(
        wonPipelineSum
      ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`
    );

    return {
      mode: 'daily_brief',
      reply: lines.join('\n'),
      provider: 'tedcloud-engine',
    };
  }

  if (mode === 'workload_analysis') {
    const nodeLoad = nodes.map((n) => {
      const assignedOpen = openTasks.filter(
        (t) => t.assigned_to === n.id || t.owner_node_id === n.id
      ).length;
      const highCount = openTasks.filter(
        (t) => (t.assigned_to === n.id || t.owner_node_id === n.id) && t.priority === 'High'
      ).length;
      return {
        name: n.name || 'Сотрудник',
        role: n.role_type || 'Специалист',
        dept: n.department || 'Без отдела',
        openCount: assignedOpen,
        highCount,
      };
    });

    nodeLoad.sort((a, b) => b.openCount - a.openCount);
    const overloaded = nodeLoad.filter((n) => n.openCount >= 3);
    const underloaded = nodeLoad.filter((n) => n.openCount === 0);

    const lines: string[] = [
      `АНАЛИЗ ЗАГРУЗКИ КОМАНДЫ И ВОРОНКИ CRM — ${companyName}`,
      '',
      `1. БАЛАНС НАГРУЗКИ ПО ШТАТУ (${nodes.length} сотр. / ${openTasks.length} активных задач):`,
    ];

    if (nodeLoad.length === 0) {
      lines.push('• Штатное расписание пусто.');
    } else {
      nodeLoad.slice(0, 6).forEach((item) => {
        const statusIndicator =
          item.openCount >= 3
            ? 'Высокая нагрузка'
            : item.openCount >= 1
            ? 'Оптимально'
            : 'Свободен';
        lines.push(
          `• ${item.name} (${item.role}, ${item.dept}): ${item.openCount} акт. задач (High: ${item.highCount}) — [${statusIndicator}]`
        );
      });
    }

    lines.push('');
    lines.push('2. АУДИТ КОММЕРЧЕСКОЙ ВОРОНКИ CRM:');
    lines.push(
      `• Всего сделок: ${leads.length} | На согласовании (Negotiation): ${
        leads.filter((l) => (l.status || l.stage) === 'Negotiation').length
      } | Успешно закрыто (Won): ${wonLeads.length}.`
    );
    lines.push(
      `• Объем активного пайплайна: ${Math.round(activePipelineSum).toLocaleString(
        'ru-RU'
      )} RUB | Конверсия в контракт: ${conversionRate}%.`
    );

    lines.push('');
    lines.push('3. УПРАВЛЕНЧЕСКИЕ РЕКОМЕНДАЦИИ TEDCLOUD AI:');
    if (overloaded.length > 0 && underloaded.length > 0) {
      lines.push(
        `• Рекомендуется перераспределить часть задач от ${overloaded[0].name} (${overloaded[0].openCount} зад.) сотруднику ${underloaded[0].name} (0 активных поручений).`
      );
    } else if (highPriorityTasks.length > 0) {
      lines.push(
        `• В контуре ${highPriorityTasks.length} задач с высоким приоритетом (High) — рекомендуется провести декомпозицию на чек-листы и зафиксировать промежуточный статус.`
      );
    } else {
      lines.push(
        '• Распределение задач сбалансировано, критических блокировок по подразделениям не выявлено.'
      );
    }

    return {
      mode: 'workload_analysis',
      reply: lines.join('\n'),
      provider: 'tedcloud-engine',
    };
  }

  const q = prompt.trim().toLowerCase();
  const matchedTasks = tasks.filter(
    (t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.department || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
  );
  const matchedLeads = leads.filter(
    (l) =>
      (l.client_name || '').toLowerCase().includes(q) ||
      (l.title || '').toLowerCase().includes(q) ||
      (l.tax_id || '').toLowerCase().includes(q) ||
      (l.contract_number || '').toLowerCase().includes(q)
  );
  const matchedNodes = nodes.filter(
    (n) =>
      (n.name || '').toLowerCase().includes(q) ||
      (n.role_type || '').toLowerCase().includes(q) ||
      (n.department || '').toLowerCase().includes(q)
  );

  const lines: string[] = [
    `ОТВЕТ TEDCLOUD AI ПО ЗАПРОСУ: «${prompt.trim() || 'Обзор компании'}»`,
    '',
  ];

  if (matchedLeads.length > 0) {
    lines.push(`Найденные сделки CRM (${matchedLeads.length}):`);
    matchedLeads.slice(0, 4).forEach((l) => {
      lines.push(
        `• ${l.client_name || l.title} — ${Math.round(
          Number(l.amount ?? l.deal_value ?? 0)
        ).toLocaleString('ru-RU')} RUB | Статус: ${l.status || 'New'}${
          l.tax_id ? ` | ИНН/VAT: ${l.tax_id}` : ''
        }${l.contract_number ? ` | Договор: ${l.contract_number}` : ''}`
      );
    });
    lines.push('');
  }

  if (matchedTasks.length > 0) {
    lines.push(`Найденные задачи (${matchedTasks.length}):`);
    matchedTasks.slice(0, 4).forEach((t) => {
      lines.push(
        `• [${t.priority || 'Medium'} | ${t.status || 'Todo'}] ${t.title}${
          t.department ? ` (${t.department})` : ''
        }`
      );
    });
    lines.push('');
  }

  if (matchedNodes.length > 0) {
    lines.push(`Профильные сотрудники (${matchedNodes.length}):`);
    matchedNodes.slice(0, 4).forEach((n) => {
      lines.push(
        `• ${n.name} — ${n.role_type || 'Специалист'}${
          n.department ? ` · Отдел: ${n.department}` : ''
        }`
      );
    });
    lines.push('');
  }

  if (matchedLeads.length === 0 && matchedTasks.length === 0 && matchedNodes.length === 0) {
    lines.push(
      `Сводная статистика пространства «${companyName}»:`,
      `• Сотрудников в штате: ${nodes.length}`,
      `• Открытых задач: ${openTasks.length} (высокого приоритета: ${highPriorityTasks.length})`,
      `• Сделок в CRM: ${leads.length} на общую сумму активного пайплайна ${Math.round(
        activePipelineSum
      ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`,
      'Для точечного поиска укажите название контрагента, ИНН, фамилию сотрудника или тему поручения.'
    );
  }

  return {
    mode: 'custom',
    reply: lines.join('\n'),
    provider: 'tedcloud-engine',
  };
}

const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  companies: [
    'name',
    'plan',
    'billing_cycle',
    'payment_region',
    'billing_details',
    'departments',
  ],
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
    'checklist',
    'ai_summary',
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
  billing_invoices: [
    'company_id',
    'invoice_number',
    'plan',
    'billing_cycle',
    'amount',
    'currency',
    'status',
    'payment_method',
    'payer_details',
    'created_by',
    'created_at',
    'paid_at',
  ],
  audit_logs: [
    'company_id',
    'actor_id',
    'actor_name',
    'action_type',
    'entity_type',
    'entity_id',
    'details',
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

  for (let attempt = 0; attempt < 25; attempt++) {
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

  for (let attempt = 0; attempt < 25; attempt++) {
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

/**
 * Безопасная обертка чтения таблиц Supabase (НИКОГДА не выбрасывает исключение и не роняет /api/db со статусом 500)
 */
async function safeSelect(
  supabase: any,
  table: string,
  queryBuilder?: (q: any) => any
): Promise<any[]> {
  if (!supabase) return [];
  try {
    let query = supabase.from(table).select('*');
    if (typeof queryBuilder === 'function') {
      query = queryBuilder(query);
    }
    const firstRes = await query;
    if (!firstRes?.error && Array.isArray(firstRes?.data)) {
      return firstRes.data;
    }
    if (firstRes?.error) {
      console.warn(
        `[API /api/db] safeSelect primary warning on "${table}":`,
        formatError(firstRes.error)
      );
    }

    const fallbackRes = await supabase.from(table).select('*');
    if (!fallbackRes?.error && Array.isArray(fallbackRes?.data)) {
      return fallbackRes.data;
    }
    if (fallbackRes?.error) {
      console.warn(
        `[API /api/db] safeSelect fallback warning on "${table}" (returning []):`,
        formatError(fallbackRes.error)
      );
    }
    return [];
  } catch (err: any) {
    console.warn(
      `[API /api/db] safeSelect exception on "${table}" (returning []):`,
      formatError(err)
    );
    return [];
  }
}

async function safeSelectTable(
  supabase: SupabaseClient,
  table: string,
  ascending = false,
  limitCount?: number
): Promise<{ data: any[]; error: any }> {
  const rows = await safeSelect(supabase, table, (q) => {
    let next = q.order('created_at', { ascending });
    if (limitCount) {
      next = next.limit(limitCount);
    }
    return next;
  });
  return { data: rows, error: null };
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
  billing_invoices: Record<string, any>[];
  audit_logs: Record<string, any>[];
}

const localStore: InMemoryStore = {
  companies: [],
  organization_nodes: [],
  tasks: [],
  crm_leads: [],
  workspace_messages: [],
  billing_invoices: [],
  audit_logs: [],
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
      billing_cycle: 'monthly',
      payment_region: 'RU',
      billing_details: {},
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

async function fetchAllCompanyNodes(
  supabase: SupabaseClient | null,
  companyId?: string | null
): Promise<any[]> {
  let rows: any[] = [];
  if (!supabase) {
    rows = localStore.organization_nodes;
  } else {
    let query = supabase.from('organization_nodes').select('*');
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data } = await query;
    rows = Array.isArray(data) ? data : [];
  }
  if (companyId) {
    return rows.filter((n) => String(n?.company_id || '') === String(companyId));
  }
  return rows;
}

// БЛОК 5: Автоматическая запись события в журнал безопасности и аудита (audit_logs)
async function recordAuditLog(params: {
  supabase: SupabaseClient | null;
  companyId: string;
  actorId?: string | null;
  actorName?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  details: string;
}): Promise<any> {
  try {
    const {
      supabase,
      companyId,
      actorId = null,
      actorName = 'Система TedCloud',
      actionType,
      entityType,
      entityId = null,
      details,
    } = params;

    let resolvedActorName = actorName;
    if (!resolvedActorName || resolvedActorName === 'Сотрудник TedCloud') {
      const matchedActor =
        (actorId &&
          localStore.organization_nodes.find((n) => String(n.id) === String(actorId))) ||
        localStore.organization_nodes.find(
          (n) => String(n.company_id) === String(companyId) && n.access_level === 'root'
        ) ||
        localStore.organization_nodes.find((n) => String(n.company_id) === String(companyId));
      if (matchedActor?.name) {
        resolvedActorName = matchedActor.name;
      }
    }

    const rawAudit: Record<string, any> = {
      company_id: companyId,
      actor_id: actorId,
      actor_name: resolvedActorName || 'Руководитель организации',
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details,
      created_at: new Date().toISOString(),
    };

    const localEntry = {
      id: crypto.randomUUID(),
      ...rawAudit,
    };

    localStore.audit_logs.unshift(localEntry);

    if (supabase) {
      try {
        const { data } = await safeSupabaseInsert(supabase, 'audit_logs', rawAudit);
        if (data?.id) {
          return { ...localEntry, ...data };
        }
      } catch (err) {
        console.warn('[API /api/db] Audit log fallback to memory:', formatError(err));
      }
    }

    return localEntry;
  } catch (outerErr) {
    console.warn('[API /api/db] Audit log ignored:', formatError(outerErr));
    return null;
  }
}

// Отправка Telegram-уведомления конкретному исполнителю ИЛИ всему подразделению (отделу) строго внутри companyId
async function sendTelegramTaskOrDepartmentPush(params: {
  supabase: SupabaseClient | null;
  companyId?: string | null;
  assignedToId?: string | null;
  department?: string | null;
  taskId?: string;
  taskTitle: string;
  taskPriority: string;
  taskType?: string;
}): Promise<{ pushed: boolean; count?: number; reason?: string }> {
  const {
    supabase,
    companyId,
    assignedToId,
    department,
    taskId,
    taskTitle,
    taskPriority,
    taskType,
  } = params;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { pushed: false, reason: 'missing_bot_token' };
  }

  const allNodes = await fetchAllCompanyNodes(supabase, companyId);
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
    const inviteParam = node.invite_code
      ? `&invite=${encodeURIComponent(String(node.invite_code))}`
      : '';
    inlineKeyboard.push([
      {
        text: 'Открыть панель TedCloud',
        url: `${siteUrl}/?tg_id=${telegramChatId}${inviteParam}&chatId=${telegramChatId}`,
      },
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

// Мгновенная доставка сообщения из единого инфополя (workspace_messages) в Telegram
async function sendTelegramWorkspaceMessagePush(params: {
  supabase: SupabaseClient | null;
  messageRecord: Record<string, any>;
}): Promise<{ pushed: boolean; count: number; reason?: string }> {
  const { supabase, messageRecord } = params;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { pushed: false, count: 0, reason: 'missing_bot_token' };
  }

  const allNodes = await fetchAllCompanyNodes(
    supabase,
    messageRecord.company_id ? String(messageRecord.company_id) : null
  );
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
    const inviteParam = recipient.invite_code
      ? `&invite=${encodeURIComponent(String(recipient.invite_code))}`
      : '';
    inlineKeyboard.push([
      {
        text: 'Открыть панель TedCloud',
        url: `${siteUrl}/?tg_id=${tgChatId}${inviteParam}&chatId=${tgChatId}`,
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
  let billingDetails = row.billing_details ?? extras?.billing_details ?? null;
  if (typeof billingDetails === 'string') {
    try {
      billingDetails = JSON.parse(billingDetails);
    } catch {
      billingDetails = null;
    }
  }
  return {
    ...row,
    ...(extras || {}),
    plan: row.plan ?? extras?.plan ?? 'Business',
    billing_cycle: row.billing_cycle ?? extras?.billing_cycle ?? 'monthly',
    payment_region: row.payment_region ?? extras?.payment_region ?? 'RU',
    billing_details:
      billingDetails && typeof billingDetails === 'object' ? billingDetails : null,
    departments: Array.isArray(departments) ? departments : [],
  };
}

function normalizeTaskRow(row: any) {
  const overlay = row.id ? recordNotesOverlay.get(`tasks:${row.id}`) : undefined;
  const extras = row.id ? recordExtrasOverlay.get(`tasks:${row.id}`) : undefined;
  const noteText =
    row.description ?? row.notes ?? overlay?.description ?? overlay?.notes ?? null;

  let rawChecklist = row.checklist ?? extras?.checklist ?? [];
  if (typeof rawChecklist === 'string') {
    try {
      rawChecklist = JSON.parse(rawChecklist);
    } catch {
      rawChecklist = [];
    }
  }
  const checklist: TaskChecklistItem[] = Array.isArray(rawChecklist)
    ? rawChecklist.map((item: any, idx: number) => ({
        id: String(item?.id || `chk_${idx + 1}`),
        title: String(item?.title || '').trim(),
        done: Boolean(item?.done),
      }))
    : [];

  return {
    ...row,
    ...(extras || {}),
    description: noteText,
    notes: noteText,
    type: row.type || 'Task',
    priority: row.priority || 'Medium',
    status: row.status || 'Todo',
    department: row.department ?? extras?.department ?? null,
    checklist,
    ai_summary: row.ai_summary ?? extras?.ai_summary ?? null,
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

function normalizeInvoiceRow(row: any) {
  const extras = row.id ? recordExtrasOverlay.get(`billing_invoices:${row.id}`) : undefined;
  const merged = { ...(extras || {}), ...row };
  let payerDetails = merged.payer_details ?? null;
  if (typeof payerDetails === 'string') {
    try {
      payerDetails = JSON.parse(payerDetails);
    } catch {
      payerDetails = null;
    }
  }
  return {
    ...merged,
    invoice_number: merged.invoice_number || generateInvoiceNumber(),
    plan: merged.plan || 'Business',
    billing_cycle: merged.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
    amount: Number(merged.amount ?? 0),
    currency: merged.currency || 'RUB',
    status: merged.status || 'Issued',
    payment_method: merged.payment_method || 'b2b_invoice',
    payer_details: payerDetails,
    created_at: merged.created_at || new Date().toISOString(),
  };
}

function normalizeAuditLogRow(row: any) {
  const actionCode = row.action_type || row.action || 'SYSTEM_EVENT';
  return {
    ...row,
    actor_name: row.actor_name || 'Руководитель организации',
    action_type: actionCode,
    action: actionCode,
    entity_type: row.entity_type || 'workspace',
    details: row.details || '',
    created_at: row.created_at || new Date().toISOString(),
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

  if (tType === 'direct') {
    if (senderId && senderId === userId) return true;
    if (targetId && targetId === userId) return true;
    if (userName && targetLabelLower && targetLabelLower === userName) return true;
    return false;
  }

  if (tType === 'department') {
    if (userAccess === 'root') return true;
    if (senderId && senderId === userId) return true;
    if (!userDept) return false;
    return userDept === targetId.toLowerCase() || userDept === targetLabelLower;
  }

  return true;
}

function findMatchingNodeByInput(nodes: any[], rawInput: string): any | null {
  const q = String(rawInput || '').trim().toLowerCase();
  if (!q) return null;

  return (
    nodes.find(
      (node: any) =>
        String(node.id || '').trim().toLowerCase() === q ||
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
      const tgId = req.query?.tg_id ? String(req.query.tg_id).trim() : null;
      const inviteCode = req.query?.invite ? String(req.query.invite).trim() : null;
      const profileId = req.query?.profileId ? String(req.query.profileId).trim() : null;
      const requestedCompanyId =
        req.query?.company_id || req.query?.companyId
          ? String(req.query.company_id || req.query.companyId).trim()
          : null;

      if (!supabase) {
        const allNodes = localStore.organization_nodes.map(normalizeNodeRow);
        let currentProfile = null;
        if (profileId) {
          currentProfile =
            allNodes.find((n) => String(n.id) === profileId) ||
            findMatchingNodeByInput(allNodes, profileId);
        }
        if (!currentProfile && inviteCode) {
          currentProfile = findMatchingNodeByInput(allNodes, inviteCode);
        }
        if (!currentProfile && tgId) {
          currentProfile = findMatchingNodeByInput(allNodes, tgId);
        }
        if (!currentProfile && chatId) {
          currentProfile = findMatchingNodeByInput(allNodes, chatId);
        }

        const activeCompanyId =
          currentProfile?.company_id || requestedCompanyId || null;

        if (!activeCompanyId) {
          return res.status(200).json({
            ok: true,
            mode: 'local_empty',
            company: null,
            currentProfile: null,
            nodes: allNodes,
            tasks: [],
            leads: [],
            messages: [],
            invoices: [],
            auditLogs: [],
          });
        }

        const matchedCompany =
          localStore.companies.find((c) => String(c.id) === String(activeCompanyId)) || null;
        const companyNodes = allNodes.filter(
          (n) => String(n.company_id || '') === String(activeCompanyId)
        );
        const companyTasks = localStore.tasks
          .map(normalizeTaskRow)
          .filter((t) => String(t.company_id || '') === String(activeCompanyId));
        const companyLeads = localStore.crm_leads
          .map(normalizeLeadRow)
          .filter((l) => String(l.company_id || '') === String(activeCompanyId));
        const companyMessages = localStore.workspace_messages
          .map(normalizeMessageRow)
          .filter(
            (m) =>
              String(m.company_id || '') === String(activeCompanyId) &&
              (!currentProfile || canServerUserSeeMessage(m, currentProfile))
          );
        const companyInvoices = localStore.billing_invoices
          .map(normalizeInvoiceRow)
          .filter((inv) => String(inv.company_id || '') === String(activeCompanyId));
        const companyAuditLogs = localStore.audit_logs
          .map(normalizeAuditLogRow)
          .filter((log) => String(log.company_id || '') === String(activeCompanyId))
          .slice(0, 60);

        return res.status(200).json({
          ok: true,
          mode: 'local_empty',
          company: normalizeCompanyRow(matchedCompany),
          currentProfile,
          nodes: companyNodes,
          tasks: companyTasks,
          leads: companyLeads,
          messages: companyMessages,
          invoices: companyInvoices,
          auditLogs: companyAuditLogs,
        });
      }

      const [
        companiesData,
        nodesData,
        tasksData,
        leadsData,
        messagesData,
        invoicesData,
        auditLogsData,
      ] = await Promise.all([
        safeSelect(supabase, 'companies', (q) => q.order('created_at', { ascending: false }).limit(100)),
        safeSelect(supabase, 'organization_nodes', (q) => q.order('created_at', { ascending: true })),
        safeSelect(supabase, 'tasks', (q) => q.order('created_at', { ascending: false })),
        safeSelect(supabase, 'crm_leads', (q) => q.order('created_at', { ascending: false })),
        safeSelect(supabase, 'workspace_messages', (q) => q.order('created_at', { ascending: false }).limit(300)),
        safeSelect(supabase, 'billing_invoices', (q) => q.order('created_at', { ascending: false }).limit(100)),
        safeSelect(supabase, 'audit_logs', (q) => q.order('created_at', { ascending: false }).limit(100)),
      ]);

      const rawCompanies = (companiesData || []).map(normalizeCompanyRow);
      const rawNodes = (nodesData || []).map(normalizeNodeRow);
      const rawTasks = (tasksData || []).map(normalizeTaskRow);
      const rawLeads = (leadsData || []).map(normalizeLeadRow);

      let currentProfile = null;
      if (profileId) {
        currentProfile =
          rawNodes.find((n: any) => String(n.id) === profileId) ||
          findMatchingNodeByInput(rawNodes, profileId);
      }
      if (!currentProfile && inviteCode) {
        currentProfile = findMatchingNodeByInput(rawNodes, inviteCode);
      }
      if (!currentProfile && tgId) {
        currentProfile = findMatchingNodeByInput(rawNodes, tgId);
      }
      if (!currentProfile && chatId) {
        currentProfile = findMatchingNodeByInput(rawNodes, chatId);
      }

      const activeCompanyId =
        currentProfile?.company_id || requestedCompanyId || null;

      if (!activeCompanyId) {
        return res.status(200).json({
          ok: true,
          mode: 'supabase',
          company: null,
          currentProfile: null,
          nodes: rawNodes,
          tasks: [],
          leads: [],
          messages: [],
          invoices: [],
          auditLogs: [],
        });
      }

      let activeCompany =
        rawCompanies.find((c: any) => String(c?.id) === String(activeCompanyId)) || null;
      if (!activeCompany) {
        const singleCompanyRows = await safeSelect(supabase, 'companies', (q) =>
          q.eq('id', activeCompanyId).limit(1)
        );
        if (singleCompanyRows[0]) {
          activeCompany = normalizeCompanyRow(singleCompanyRows[0]);
        }
      }

      // STRICT MULTI-TENANCY FILTER BY company_id
      const companyNodes = rawNodes.filter(
        (n: any) => String(n.company_id || '') === String(activeCompanyId)
      );
      const companyTasks = rawTasks.filter(
        (t: any) => String(t.company_id || '') === String(activeCompanyId)
      );
      const companyLeads = rawLeads.filter(
        (l: any) => String(l.company_id || '') === String(activeCompanyId)
      );

      // Merge remote workspace_messages with in-memory fallback messages strictly for activeCompanyId
      const remoteMessages = Array.isArray(messagesData) ? messagesData : [];
      const seenMsgIds = new Set<string>();
      const mergedMessages: any[] = [];
      for (const m of [...remoteMessages, ...localStore.workspace_messages]) {
        if (m && m.id && !seenMsgIds.has(m.id)) {
          seenMsgIds.add(m.id);
          const norm = normalizeMessageRow(m);
          if (
            String(norm.company_id || '') === String(activeCompanyId) &&
            (!currentProfile || canServerUserSeeMessage(norm, currentProfile))
          ) {
            mergedMessages.push(norm);
          }
        }
      }

      // Merge remote billing_invoices with in-memory fallback invoices strictly for activeCompanyId
      const remoteInvoices = Array.isArray(invoicesData) ? invoicesData : [];
      const seenInvIds = new Set<string>();
      const mergedInvoices: any[] = [];
      for (const inv of [...remoteInvoices, ...localStore.billing_invoices]) {
        if (inv && inv.id && !seenInvIds.has(inv.id)) {
          seenInvIds.add(inv.id);
          const norm = normalizeInvoiceRow(inv);
          if (String(norm.company_id || '') === String(activeCompanyId)) {
            mergedInvoices.push(norm);
          }
        }
      }

      // Merge remote audit_logs with in-memory fallback audit logs strictly for activeCompanyId
      const remoteAudits = Array.isArray(auditLogsData) ? auditLogsData : [];
      const seenAuditIds = new Set<string>();
      const mergedAuditLogs: any[] = [];
      for (const log of [...remoteAudits, ...localStore.audit_logs]) {
        if (log && log.id && !seenAuditIds.has(log.id)) {
          seenAuditIds.add(log.id);
          const norm = normalizeAuditLogRow(log);
          if (String(norm.company_id || '') === String(activeCompanyId)) {
            mergedAuditLogs.push(norm);
          }
        }
      }

      return res.status(200).json({
        ok: true,
        mode: 'supabase',
        company: activeCompany,
        currentProfile,
        nodes: companyNodes,
        tasks: companyTasks,
        leads: companyLeads,
        messages: mergedMessages,
        invoices: mergedInvoices,
        auditLogs: mergedAuditLogs.slice(0, 60),
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      // БЛОК 2: Корпоративный ИИ-ассистент TedCloud AI (в стиле Jira Rovo — Веб + Telegram)
      if (body.action === 'ai_assistant') {
        const mode: AiAssistantMode =
          body.mode === 'daily_brief' ||
          body.mode === 'decompose_task' ||
          body.mode === 'workload_analysis'
            ? body.mode
            : 'custom';
        const requestedCompanyId = body.company_id || body.companyId || null;
        const profileId = body.profile_id || body.profileId || null;
        const taskId = body.task_id || body.taskId || null;
        const promptText = String(body.prompt || body.question || '').trim();
        const taskTitle = String(body.taskTitle || body.title || '').trim();
        const taskDescription = String(body.taskDescription || body.description || '').trim();

        let companyNodes: any[] = [];
        let companyTasks: any[] = [];
        let companyLeads: any[] = [];
        let companyMessages: any[] = [];
        let companyName = String(body.companyName || 'TedCloud');

        if (!supabase) {
          companyNodes = localStore.organization_nodes
            .map(normalizeNodeRow)
            .filter((n) => !requestedCompanyId || String(n.company_id) === String(requestedCompanyId));
          companyTasks = localStore.tasks
            .map(normalizeTaskRow)
            .filter((t) => !requestedCompanyId || String(t.company_id) === String(requestedCompanyId));
          companyLeads = localStore.crm_leads
            .map(normalizeLeadRow)
            .filter((l) => !requestedCompanyId || String(l.company_id) === String(requestedCompanyId));
          companyMessages = localStore.workspace_messages
            .map(normalizeMessageRow)
            .filter((m) => !requestedCompanyId || String(m.company_id) === String(requestedCompanyId));
        } else {
          const [nodesRes, tasksRes, leadsRes, messagesRes, compRes] = await Promise.all([
            safeSelectTable(supabase, 'organization_nodes', true),
            safeSelectTable(supabase, 'tasks', false),
            safeSelectTable(supabase, 'crm_leads', false),
            safeSelectTable(supabase, 'workspace_messages', false, 150),
            requestedCompanyId
              ? supabase.from('companies').select('*').eq('id', requestedCompanyId).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          if (compRes?.data?.name) {
            companyName = compRes.data.name;
          }
          companyNodes = (nodesRes.data || [])
            .map(normalizeNodeRow)
            .filter((n) => !requestedCompanyId || String(n.company_id) === String(requestedCompanyId));
          companyTasks = (tasksRes.data || [])
            .map(normalizeTaskRow)
            .filter((t) => !requestedCompanyId || String(t.company_id) === String(requestedCompanyId));
          companyLeads = (leadsRes.data || [])
            .map(normalizeLeadRow)
            .filter((l) => !requestedCompanyId || String(l.company_id) === String(requestedCompanyId));
          companyMessages = (messagesRes.data || [])
            .map(normalizeMessageRow)
            .filter((m) => !requestedCompanyId || String(m.company_id) === String(requestedCompanyId));
        }

        const currentUser = profileId
          ? companyNodes.find((n) => String(n.id) === String(profileId)) || null
          : null;

        const targetTaskRecord = taskId
          ? companyTasks.find((t) => String(t.id) === String(taskId)) || null
          : null;
        const resolvedTaskTitle = taskTitle || targetTaskRecord?.title || '';
        const resolvedTaskDescription =
          taskDescription || targetTaskRecord?.description || targetTaskRecord?.notes || '';

        // First compute deterministic analysis & checklist as baseline / fallback
        const builtInResult = runBuiltInAiAssistant({
          mode,
          prompt: promptText,
          taskTitle: resolvedTaskTitle,
          taskDescription: resolvedTaskDescription,
          companyName,
          currentUser,
          nodes: companyNodes,
          tasks: companyTasks,
          leads: companyLeads,
          messages: companyMessages,
        });

        let finalResult = builtInResult;

        // If GEMINI_API_KEY is configured, enhance response via native fetch (zero external SDK dependency)
        const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
        if (geminiApiKey) {
          try {
            const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
              geminiApiKey
            )}`;

            if (mode === 'decompose_task') {
              const targetTitle =
                resolvedTaskTitle || promptText || 'Корпоративное поручение';
              const geminiRes = await fetch(geminiEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'aistudio-build',
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          text: `Ты — корпоративный ИИ-ассистент TedCloud AI (уровень Atlassian Rovo / Linear).
Декомпозируй корпоративную задачу «${targetTitle}» ${
                            resolvedTaskDescription
                              ? `(Описание: ${resolvedTaskDescription})`
                              : ''
                          } на 4–5 конкретных, деловых подзадач для чек-листа и напиши краткое резюме (1 предложение). Отвечай строго в формате JSON {"subtasks": ["..."], "summary": "..."} на русском языке без эмодзи.`,
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    responseMimeType: 'application/json',
                  },
                }),
              });

              if (geminiRes.ok) {
                const geminiJson: any = await geminiRes.json();
                const rawText =
                  geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (rawText) {
                  const parsed = JSON.parse(rawText);
                  if (Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
                    const checklist: TaskChecklistItem[] = parsed.subtasks
                      .slice(0, 6)
                      .map((st: string, i: number) => ({
                        id: `chk_${Date.now()}_${i + 1}`,
                        title: String(st || '').trim(),
                        done: false,
                      }))
                      .filter((item: TaskChecklistItem) => Boolean(item.title));

                    if (checklist.length > 0) {
                      const summary = String(
                        parsed.summary || builtInResult.aiSummary || ''
                      ).trim();
                      finalResult = {
                        mode: 'decompose_task',
                        checklist,
                        aiSummary: summary,
                        reply: [
                          `ИИ-декомпозиция задачи «${targetTitle}» (${checklist.length} шага):`,
                          '',
                          ...checklist.map((c, idx) => `${idx + 1}. ${c.title}`),
                          '',
                          summary,
                        ].join('\n'),
                        provider: 'gemini',
                      };
                    }
                  }
                }
              }
            } else {
              const contextDigest = JSON.stringify({
                company: companyName,
                currentUser: currentUser
                  ? {
                      name: currentUser.name,
                      role: currentUser.role_type,
                      department: currentUser.department,
                    }
                  : null,
                employeesCount: companyNodes.length,
                employees: companyNodes.slice(0, 15).map((n) => ({
                  name: n.name,
                  role: n.role_type,
                  department: n.department,
                })),
                tasks: companyTasks.slice(0, 20).map((t) => ({
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  department: t.department,
                })),
                crmDeals: companyLeads.slice(0, 15).map((l) => ({
                  client: l.client_name,
                  amount: l.amount,
                  status: l.status,
                  tax_id: l.tax_id,
                  department: l.department,
                })),
              });

              const systemTaskInstruction =
                mode === 'daily_brief'
                  ? 'Сформируй деловую персональную сводку дня для текущего сотрудника по его активным задачам, срочным поручениям и сделкам компании.'
                  : mode === 'workload_analysis'
                  ? 'Проведи управленческий анализ распределения задач по сотрудникам/отделам и конверсии сделок CRM, дай 2–3 конкретные рекомендации.'
                  : `Ответь на вопрос сотрудника: «${promptText}» строго на основе данных компании.`;

              const geminiRes = await fetch(geminiEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'aistudio-build',
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          text: `Ты — корпоративный ИИ-ассистент TedCloud AI (стиль Atlassian Rovo / Linear). Отвечай емко, структурно, деловым русским языком без лишней воды.
Контекст компании (JSON): ${contextDigest}
Базовая аналитическая выжимка:
${builtInResult.reply}

Задание: ${systemTaskInstruction}`,
                        },
                      ],
                    },
                  ],
                }),
              });

              if (geminiRes.ok) {
                const geminiJson: any = await geminiRes.json();
                const rawText = String(
                  geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                ).trim();
                if (rawText) {
                  finalResult = {
                    ...builtInResult,
                    reply: rawText,
                    provider: 'gemini',
                  };
                }
              }
            }
          } catch (aiErr) {
            console.warn(
              '[API /api/db] Gemini fetch fallback to built-in engine:',
              formatError(aiErr)
            );
          }
        }

        // If taskId is provided during decompose_task, persist checklist & ai_summary to DB
        let updatedTaskRecord: any = null;
        if (mode === 'decompose_task' && taskId && finalResult.checklist) {
          const prevExtras = recordExtrasOverlay.get(`tasks:${taskId}`) || {};
          recordExtrasOverlay.set(`tasks:${taskId}`, {
            ...prevExtras,
            checklist: finalResult.checklist,
            ai_summary: finalResult.aiSummary || null,
          });

          if (!supabase) {
            const idx = localStore.tasks.findIndex((t) => String(t.id) === String(taskId));
            if (idx !== -1) {
              localStore.tasks[idx] = {
                ...localStore.tasks[idx],
                checklist: finalResult.checklist,
                ai_summary: finalResult.aiSummary || null,
              };
              updatedTaskRecord = normalizeTaskRow(localStore.tasks[idx]);
            }
          } else {
            const { data: updated } = await safeSupabaseUpdate(supabase, 'tasks', String(taskId), {
              checklist: finalResult.checklist,
              ai_summary: finalResult.aiSummary || null,
            });
            if (updated) {
              updatedTaskRecord = normalizeTaskRow({
                ...updated,
                checklist: finalResult.checklist,
                ai_summary: finalResult.aiSummary || null,
              });
            }
          }
        }

        return res.status(200).json({
          ok: true,
          ...finalResult,
          updatedTask: updatedTaskRecord,
        });
      }

      // Универсальный вход сотрудника по любому из 5 идентификаторов (Telegram ID, Invite Code, Email, UUID, ФИО)
      if (body.action === 'login') {
        const q = String(body.input || body.identifier || '').trim().toLowerCase();
        if (!q) {
          return res.status(400).json({ error: 'Введите идентификатор для входа.' });
        }

        let nodes: any[] = [];
        let companies: any[] = [];

        if (!supabase) {
          nodes = localStore.organization_nodes.map(normalizeNodeRow);
          companies = localStore.companies.map(normalizeCompanyRow);
        } else {
          const [nodesRes, companiesRes] = await Promise.all([
            safeSelectTable(supabase, 'organization_nodes', true),
            safeSelectTable(supabase, 'companies', false, 100),
          ]);
          if (nodesRes.error) {
            return res.status(400).json({ error: formatError(nodesRes.error) });
          }
          nodes = (nodesRes.data || []).map(normalizeNodeRow);
          companies = (companiesRes.data || []).map(normalizeCompanyRow);
        }

        const matched = findMatchingNodeByInput(nodes, q);

        if (!matched) {
          return res.status(404).json({
            error:
              'Профиль сотрудника не найден. Проверьте персональный код доступа (TC-XXXX), корпоративный Email, ФИО или Telegram ID.',
          });
        }

        let company =
          companies.find((c: any) => String(c?.id) === String(matched.company_id)) || null;

        if (!company && matched.company_id && supabase) {
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

      // Регистрация новой компании и корневого руководителя (изолированный company_id)
      if (body.action === 'register_workspace' || body.action === 'register') {
        const companyName = String(body.companyName || '').trim();
        const leaderName = String(body.leaderName || '').trim();
        const leaderTitle = String(
          body.leaderTitle || body.role_type || 'Генеральный директор'
        ).trim();
        const leaderDepartment = body.leaderDepartment
          ? String(body.leaderDepartment).trim()
          : '';
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
            billing_cycle: 'monthly',
            payment_region: 'RU',
            billing_details: { legal_name: companyName },
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

          await recordAuditLog({
            supabase: null,
            companyId: newCompany.id,
            actorId: rootNode.id,
            actorName: leaderName,
            actionType: 'WORKSPACE_CREATED',
            entityType: 'companies',
            entityId: newCompany.id,
            details: `Создано корпоративное пространство «${companyName}» (Руководитель: ${leaderName})`,
          });

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
            billing_cycle: 'monthly',
            payment_region: 'RU',
            departments: initialDepts,
          }
        );

        if (compErr || !createdCompany) {
          return res.status(400).json({
            error: formatError(compErr) || 'Не удалось создать организацию.',
          });
        }

        recordExtrasOverlay.set(`companies:${createdCompany.id}`, {
          departments: initialDepts,
          billing_cycle: 'monthly',
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
            error: formatError(nodeErr) || 'Не удалось создать корневой профиль руководителя.',
          });
        }

        await recordAuditLog({
          supabase,
          companyId: createdCompany.id,
          actorId: createdNode.id,
          actorName: leaderName,
          actionType: 'WORKSPACE_CREATED',
          entityType: 'companies',
          entityId: createdCompany.id,
          details: `Зарегистрирована организация «${companyName}» (Root: ${leaderName})`,
        });

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

        const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];

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
          checklist,
          ai_summary: payload.ai_summary || null,
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
            return res.status(400).json({ error: formatError(error) });
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
            checklist,
            ai_summary: payload.ai_summary || null,
          });
        }

        await recordAuditLog({
          supabase,
          companyId,
          actorId: payload.created_by || resolvedOwnerNodeId,
          actorName: payload.actor_name || 'Сотрудник TedCloud',
          actionType: 'TASK_CREATED',
          entityType: 'tasks',
          entityId: savedTask?.id,
          details: `Создана задача «${title}» [${rawInsertPayload.priority}]${
            taskDept ? ` (${taskDept})` : ''
          }`,
        });

        const pushStatus = await sendTelegramTaskOrDepartmentPush({
          supabase,
          companyId,
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

        let createdEmployee: any;
        if (!supabase) {
          createdEmployee = {
            id: crypto.randomUUID(),
            ...rawInsertPayload,
            created_at: new Date().toISOString(),
          };
          localStore.organization_nodes.push(createdEmployee);
        } else {
          const { data, error } = await safeSupabaseInsert(
            supabase,
            'organization_nodes',
            rawInsertPayload
          );

          if (error) {
            console.error('[API /api/db] Supabase INSERT error in organization_nodes:', error);
            return res.status(400).json({ error: formatError(error) });
          }

          if (data?.id && rawInsertPayload.avatar_url) {
            recordExtrasOverlay.set(`organization_nodes:${data.id}`, {
              avatar_url: rawInsertPayload.avatar_url,
            });
          }
          createdEmployee = { ...rawInsertPayload, ...data };
        }

        await recordAuditLog({
          supabase,
          companyId,
          actorId: payload.actor_id || null,
          actorName: payload.actor_name || 'Руководитель',
          actionType: 'EMPLOYEE_ADDED',
          entityType: 'organization_nodes',
          entityId: createdEmployee?.id,
          details: `Добавлен сотрудник ${rawInsertPayload.name} (${rawInsertPayload.role_type}, код: ${generatedInviteCode})`,
        });

        return res.status(200).json({
          ok: true,
          data: normalizeNodeRow(createdEmployee),
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
            return res.status(400).json({ error: formatError(error) });
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

        await recordAuditLog({
          supabase,
          companyId,
          actorId: leadAssignee || payload.owner_node_id || null,
          actorName: payload.actor_name || 'Менеджер CRM',
          actionType: 'DEAL_CREATED',
          entityType: 'crm_leads',
          entityId: savedLead?.id,
          details: `Создана сделка CRM «${clientName}» на сумму ${Math.round(amount).toLocaleString(
            'ru-RU'
          )} RUB${taxId ? ` (ИНН/VAT: ${taxId})` : ''}`,
        });

        let telegramPush: { pushed: boolean; count?: number; reason?: string } = {
          pushed: false,
        };
        if (leadAssignee || leadDept) {
          telegramPush = await sendTelegramTaskOrDepartmentPush({
            supabase,
            companyId,
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

      // БЛОК 4: Оформление подписки и генерация B2B-счета (billing_invoices)
      if (table === 'billing_invoices') {
        const invoiceNumber = payload.invoice_number
          ? String(payload.invoice_number).trim()
          : generateInvoiceNumber();
        const plan = payload.plan || 'Business';
        const billingCycle = payload.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
        const amount = Number(payload.amount ?? 0);
        const currency = payload.currency || 'RUB';
        const paymentMethod = payload.payment_method || 'b2b_invoice';
        const status =
          payload.status || (paymentMethod === 'card_sbp' ? 'Paid' : 'Issued');
        const payerDetails = payload.payer_details || null;

        const rawInvoicePayload: Record<string, any> = {
          company_id: companyId,
          invoice_number: invoiceNumber,
          plan,
          billing_cycle: billingCycle,
          amount,
          currency,
          status,
          payment_method: paymentMethod,
          payer_details: payerDetails,
          created_by: payload.created_by || null,
          created_at: new Date().toISOString(),
          paid_at: status === 'Paid' ? new Date().toISOString() : null,
        };

        let savedInvoice: any = {
          id: crypto.randomUUID(),
          ...rawInvoicePayload,
        };

        if (supabase) {
          const { data } = await safeSupabaseInsert(
            supabase,
            'billing_invoices',
            rawInvoicePayload
          );
          if (data?.id) {
            savedInvoice = { ...rawInvoicePayload, ...data };
          }
        }

        recordExtrasOverlay.set(`billing_invoices:${savedInvoice.id}`, rawInvoicePayload);
        localStore.billing_invoices.unshift(savedInvoice);

        // Также обновим тарифный план и период компании
        if (companyId) {
          const prevCompExtras = recordExtrasOverlay.get(`companies:${companyId}`) || {};
          recordExtrasOverlay.set(`companies:${companyId}`, {
            ...prevCompExtras,
            plan,
            billing_cycle: billingCycle,
            ...(payerDetails ? { billing_details: payerDetails } : {}),
          });
          if (!supabase) {
            const cIdx = localStore.companies.findIndex((c) => String(c.id) === String(companyId));
            if (cIdx !== -1) {
              localStore.companies[cIdx] = {
                ...localStore.companies[cIdx],
                plan,
                billing_cycle: billingCycle,
                ...(payerDetails ? { billing_details: payerDetails } : {}),
              };
            }
          } else {
            await safeSupabaseUpdate(supabase, 'companies', companyId, {
              plan,
              billing_cycle: billingCycle,
              ...(payerDetails ? { billing_details: payerDetails } : {}),
            });
          }
        }

        await recordAuditLog({
          supabase,
          companyId,
          actorId: payload.created_by || null,
          actorName: payload.actor_name || 'Администратор биллинга',
          actionType: status === 'Paid' ? 'INVOICE_PAID' : 'INVOICE_ISSUED',
          entityType: 'billing_invoices',
          entityId: savedInvoice.id,
          details: `${
            status === 'Paid' ? 'Оплачена подписка' : 'Выставлен B2B-счет'
          } № ${invoiceNumber} по тарифу ${plan} (${
            billingCycle === 'yearly' ? '1 год' : '1 мес.'
          }) на сумму ${Math.round(amount).toLocaleString('ru-RU')} ${currency}`,
        });

        return res.status(200).json({
          ok: true,
          data: normalizeInvoiceRow(savedInvoice),
        });
      }

      // БЛОК 5: Запись произвольного события в audit_logs
      if (table === 'audit_logs') {
        const entry = await recordAuditLog({
          supabase,
          companyId,
          actorId: payload.actor_id || null,
          actorName: payload.actor_name || 'Сотрудник TedCloud',
          actionType: payload.action_type || 'CUSTOM_EVENT',
          entityType: payload.entity_type || 'workspace',
          entityId: payload.entity_id || null,
          details: payload.details || '',
        });
        return res.status(200).json({
          ok: true,
          data: normalizeAuditLogRow(entry),
        });
      }

      // Единое инфополе и мгновенная связь между сотрудниками (workspace_messages)
      if (table === 'workspace_messages') {
        const msgBody = String(
          payload.message_text || payload.text || payload.content || payload.message || ''
        ).trim();
        if (!msgBody) {
          return res.status(400).json({ error: 'Текст сообщения не может быть пустым.' });
        }

        const allNodes = await fetchAllCompanyNodes(supabase, companyId);
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
        if (updates.billing_cycle !== undefined) rawUpdates.billing_cycle = updates.billing_cycle;
        if (updates.payment_region !== undefined)
          rawUpdates.payment_region = updates.payment_region;
        if (updates.billing_details !== undefined) {
          rawUpdates.billing_details = updates.billing_details;
        }
        if (updates.departments !== undefined) {
          rawUpdates.departments = Array.isArray(updates.departments) ? updates.departments : [];
        }

        const prevExtras = recordExtrasOverlay.get(`companies:${id}`) || {};
        recordExtrasOverlay.set(`companies:${id}`, {
          ...prevExtras,
          ...rawUpdates,
        });

        if (updates.billing_details !== undefined || updates.plan !== undefined) {
          await recordAuditLog({
            supabase,
            companyId: id,
            actorId: body.actor_id || null,
            actorName: body.actor_name || 'Администратор биллинга',
            actionType:
              updates.billing_details !== undefined
                ? 'BILLING_DETAILS_UPDATED'
                : 'COMPANY_PLAN_UPDATED',
            entityType: 'companies',
            entityId: id,
            details:
              updates.billing_details !== undefined
                ? `Обновлены юридические реквизиты плательщика (${
                    updates.billing_details?.legal_name || 'Организация'
                  })`
                : `Обновлен тарифный план компании: ${updates.plan}`,
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
          return res.status(400).json({ error: formatError(error) });
        }
        return res
          .status(200)
          .json({ ok: true, data: normalizeCompanyRow({ id, ...rawUpdates, ...data }) });
      }

      if (table === 'billing_invoices') {
        const rawUpdates: Record<string, any> = {};
        if (updates.status !== undefined) {
          rawUpdates.status = updates.status;
          if (updates.status === 'Paid') {
            rawUpdates.paid_at = new Date().toISOString();
          }
        }
        const prevInvExtras = recordExtrasOverlay.get(`billing_invoices:${id}`) || {};
        recordExtrasOverlay.set(`billing_invoices:${id}`, {
          ...prevInvExtras,
          ...rawUpdates,
        });

        const localIdx = localStore.billing_invoices.findIndex((inv) => inv.id === id);
        if (localIdx !== -1) {
          localStore.billing_invoices[localIdx] = {
            ...localStore.billing_invoices[localIdx],
            ...rawUpdates,
          };
        }

        if (supabase) {
          await safeSupabaseUpdate(supabase, 'billing_invoices', id, rawUpdates);
        }

        const updatedInv =
          localIdx !== -1
            ? localStore.billing_invoices[localIdx]
            : { id, ...prevInvExtras, ...rawUpdates };

        if (updatedInv.company_id && rawUpdates.status === 'Paid') {
          await recordAuditLog({
            supabase,
            companyId: updatedInv.company_id,
            actionType: 'INVOICE_PAID',
            entityType: 'billing_invoices',
            entityId: id,
            details: `Подтверждена оплата счета № ${updatedInv.invoice_number || id}`,
          });
        }

        return res.status(200).json({
          ok: true,
          data: normalizeInvoiceRow(updatedInv),
        });
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
        if (updates.checklist !== undefined) {
          rawUpdates.checklist = Array.isArray(updates.checklist) ? updates.checklist : [];
        }
        if (updates.ai_summary !== undefined) {
          rawUpdates.ai_summary = updates.ai_summary;
        }
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
          ...(rawUpdates.checklist !== undefined ? { checklist: rawUpdates.checklist } : {}),
          ...(rawUpdates.ai_summary !== undefined ? { ai_summary: rawUpdates.ai_summary } : {}),
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
            return res.status(400).json({ error: formatError(error) });
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
            companyId: updatedTask.company_id || null,
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
            companyId: updatedTask.company_id || null,
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
          return res.status(400).json({ error: formatError(error) });
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
          const prevNode = localStore.organization_nodes[idx];
          localStore.organization_nodes[idx] = {
            ...prevNode,
            ...rawUpdates,
          };

          if (updates.access_level !== undefined || updates.permissions !== undefined) {
            await recordAuditLog({
              supabase: null,
              companyId: prevNode.company_id,
              actorName: 'Администратор безопасности',
              actionType: 'PERMISSIONS_UPDATED',
              entityType: 'organization_nodes',
              entityId: id,
              details: `Изменена матрица прав доступа сотрудника ${prevNode.name} (Уровень: ${
                rawUpdates.access_level || prevNode.access_level
              })`,
            });
          }

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
          return res.status(400).json({ error: formatError(error) });
        }

        if (
          existing?.company_id &&
          (updates.access_level !== undefined || updates.permissions !== undefined)
        ) {
          await recordAuditLog({
            supabase,
            companyId: existing.company_id,
            actorName: 'Администратор безопасности',
            actionType: 'PERMISSIONS_UPDATED',
            entityType: 'organization_nodes',
            entityId: id,
            details: `Обновлены полномочия RBAC для сотрудника ${
              existing.name || id
            } (Уровень: ${rawUpdates.access_level || existing.access_level})`,
          });
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
        let deletedItem: any = null;
        if (table === 'tasks') {
          deletedItem = localStore.tasks.find((t) => t.id === id);
          localStore.tasks = localStore.tasks.filter((t) => t.id !== id);
        } else if (table === 'crm_leads') {
          deletedItem = localStore.crm_leads.find((l) => l.id === id);
          localStore.crm_leads = localStore.crm_leads.filter((l) => l.id !== id);
        } else if (table === 'organization_nodes') {
          deletedItem = localStore.organization_nodes.find((n) => n.id === id);
          localStore.organization_nodes = localStore.organization_nodes.filter((n) => n.id !== id);
        }

        if (deletedItem?.company_id) {
          await recordAuditLog({
            supabase: null,
            companyId: deletedItem.company_id,
            actorName: 'Администратор',
            actionType: `${table.toUpperCase()}_DELETED`,
            entityType: table,
            entityId: id,
            details: `Удалена запись из «${table}»: ${
              deletedItem.title || deletedItem.client_name || deletedItem.name || id
            }`,
          });
        }

        return res.status(200).json({ ok: true, id });
      }

      const { data: existingToDelete } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (table === 'organization_nodes') {
        await supabase.from('tasks').update({ assigned_to: null }).eq('assigned_to', id);
        await supabase.from('tasks').update({ owner_node_id: null }).eq('owner_node_id', id);
      }

      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) {
        console.error(`[API /api/db] Supabase DELETE error in ${table}:`, error);
        return res.status(400).json({ error: formatError(error) });
      }

      if (existingToDelete?.company_id) {
        await recordAuditLog({
          supabase,
          companyId: existingToDelete.company_id,
          actorName: 'Администратор',
          actionType: `${table.toUpperCase()}_DELETED`,
          entityType: table,
          entityId: id,
          details: `Удален объект (${table}): ${
            existingToDelete.title ||
            existingToDelete.client_name ||
            existingToDelete.name ||
            id
          }`,
        });
      }

      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (err: any) {
    console.error('[API /api/db] Fatal Error:', err);
    return res.status(500).json({
      error: formatError(err) || 'Внутренняя ошибка серверного шлюза /api/db',
    });
  }
}
