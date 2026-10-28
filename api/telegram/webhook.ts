import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export function parseTelegramUrgentMessage(rawText: string): {
  isUrgent: boolean;
  cleanText: string;
} {
  const trimmed = String(rawText || '').trim();
  if (trimmed.startsWith('!')) {
    return {
      isUrgent: true,
      cleanText: trimmed.slice(1).trim(),
    };
  }
  return {
    isUrgent: false,
    cleanText: trimmed,
  };
}

function escapeHtmlBasic(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatMoscowTime(date = new Date()): string {
  return date.toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCompactIncomingTelegramMessage(params: {
  senderName: string;
  senderRole?: string;
  messageText: string;
  targetType?: 'direct' | 'department' | 'broadcast' | string;
  targetLabel?: string | null;
}): string {
  const name = escapeHtmlBasic(params.senderName || 'Сотрудник');
  const body = escapeHtmlBasic(params.messageText || '');
  const tType = String(params.targetType || 'direct').toLowerCase();
  const label = String(params.targetLabel || '').trim();

  if (tType !== 'direct' && label) {
    return `💬 <b>${name}</b> [${escapeHtmlBasic(label)}]: ${body}`;
  }

  return `💬 <b>${name}:</b> ${body}`;
}

export function extractColleagueNameFromReplyText(quotedText?: string | null): string | null {
  const raw = String(quotedText || '').trim();
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0].replace(/<[^>]+>/g, '').trim();

  // Новый нативный формат Блока 1: "💬 Имя Фамилия: текст" или "💬 Имя Фамилия [Отдел]: текст"
  if (firstLine.startsWith('💬')) {
    const withoutIcon = firstLine.replace(/^💬\s*/, '').trim();
    const colonIdx = withoutIcon.indexOf(':');
    if (colonIdx > 0) {
      const namePart = withoutIcon
        .slice(0, colonIdx)
        .replace(/\s*\[[^\]]*\]\s*$/, '')
        .trim();
      if (namePart) return namePart;
    }
  }

  // Поддержка формата "Имя Фамилия · Должность"
  if (firstLine.includes('·')) {
    const beforeDot = firstLine.split('·')[0].replace(/<[^>]+>/g, '').trim();
    if (beforeDot) return beforeDot;
  }

  // Поддержка старого формата: "От: Имя Фамилия (Должность)"
  for (const line of lines) {
    if (line.startsWith('От:')) {
      const afterFrom = line.slice(3).trim();
      const withoutRole = afterFrom.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (withoutRole) return withoutRole;
    }
  }

  return null;
}

export function extractMessageBodyFromQuotedReply(quotedText?: string | null): string {
  const raw = String(quotedText || '').trim();
  if (!raw) return '';
  const clean = raw.replace(/<[^>]+>/g, '').trim();
  if (clean.startsWith('💬')) {
    const colonIdx = clean.indexOf(':');
    if (colonIdx !== -1 && colonIdx + 1 < clean.length) {
      return clean.slice(colonIdx + 1).trim();
    }
  }
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1 && lines[0].includes('·')) {
    return lines.slice(1).join(' ').trim();
  }
  return clean;
}

async function reactToTelegramMessage(
  chatId: string | number,
  messageId?: number | null,
  emoji = '⚡'
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !messageId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reaction: [{ type: 'emoji', emoji }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function extractTelegramMediaAttachments(message: any): Promise<{
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  photoFileId?: string;
  documentFileId?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !message) return { attachments: [] };

  let fileId = '';
  let fileName = '';
  let mimeType = 'application/octet-stream';
  let fileSize = 0;
  let photoFileId: string | undefined;
  let documentFileId: string | undefined;

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    fileId = String(largestPhoto?.file_id || '');
    photoFileId = fileId;
    fileSize = Number(largestPhoto?.file_size || 0);
    mimeType = 'image/jpeg';
    fileName = `telegram_photo_${Date.now()}.jpg`;
  } else if (message.document && message.document.file_id) {
    fileId = String(message.document.file_id || '');
    documentFileId = fileId;
    fileSize = Number(message.document.file_size || 0);
    mimeType = String(message.document.mime_type || 'application/octet-stream');
    fileName = String(message.document.file_name || `telegram_file_${Date.now()}`);
  }

  if (!fileId) return { attachments: [] };

  try {
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    if (!getFileRes.ok) return { attachments: [], photoFileId, documentFileId };
    const getFileJson: any = await getFileRes.json();
    const filePath = getFileJson?.result?.file_path;
    if (!filePath) return { attachments: [], photoFileId, documentFileId };

    const directFileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    let finalUrl = directFileUrl;

    if (!fileSize || fileSize <= 2.5 * 1024 * 1024) {
      try {
        const binaryRes = await fetch(directFileUrl);
        if (binaryRes.ok) {
          const arrayBuffer = await binaryRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          finalUrl = `data:${mimeType};base64,${base64}`;
          if (!fileSize) fileSize = arrayBuffer.byteLength;
        }
      } catch {
        finalUrl = directFileUrl;
      }
    }

    return {
      attachments: [
        {
          id: `tg_att_${Date.now()}`,
          name: fileName,
          mimeType,
          size: fileSize,
          url: finalUrl,
        },
      ],
      photoFileId,
      documentFileId,
    };
  } catch {
    return { attachments: [], photoFileId, documentFileId };
  }
}

function runBuiltInAiAssistant(params: {
  mode: string;
  prompt?: string;
  companyName?: string;
  currentUser?: any;
  nodes?: any[];
  tasks?: any[];
  leads?: any[];
  messages?: any[];
}): { reply: string } {
  const companyTitle = params.companyName || 'TedCloud';
  const userName = params.currentUser?.name || 'Сотрудник';
  const userRole = params.currentUser?.role_type || 'Специалист';
  const tasks = Array.isArray(params.tasks) ? params.tasks : [];
  const leads = Array.isArray(params.leads) ? params.leads : [];
  const messages = Array.isArray(params.messages) ? params.messages : [];

  const openTasks = tasks.filter((t) => t.status !== 'Done');
  const highTasks = openTasks.filter((t) => t.priority === 'High');
  const activeLeads = leads.filter((l) => (l.status || l.stage || 'New') !== 'Lost');
  const pipelineSum = activeLeads.reduce((s, l) => s + Number(l.amount ?? l.deal_value ?? 0), 0);
  const urgentMessages = messages.filter((m) => Boolean(m.is_urgent));

  return {
    reply: [
      `Оперативная сводка для ${userName} (${userRole}) — ${companyTitle}:`,
      `• Открытых задач: ${openTasks.length} (высокий приоритет: ${highTasks.length})`,
      `• Активных сделок CRM: ${activeLeads.length} на сумму ${new Intl.NumberFormat('ru-RU').format(pipelineSum)} ₽`,
      `• Срочных сообщений в инфополе: ${urgentMessages.length}`,
      highTasks.length > 0
        ? `Фокус внимания: «${highTasks[0].title}» (${highTasks[0].department || 'Общий контур'}).`
        : 'Критичных блокеров по задачам не зафиксировано.',
    ].join('\n'),
  };
}

// Серверная память ожидающих делегирования чатов и отправки корпоративных сообщений
const pendingDelegateMap = new Map<string, string>();

interface PendingCommState {
  mode: 'direct' | 'department' | 'broadcast';
  targetNodeId?: string;
  targetDepartment?: string;
}

const pendingCommMap = new Map<string, PendingCommState>();

const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
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
    'due_date',
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
    'attachments',
    'reactions',
    'reply_to',
    'acknowledged_by',
    'is_urgent',
    'is_read',
    'created_at',
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

  for (let attempt = 0; attempt < 20; attempt++) {
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

  for (let attempt = 0; attempt < 20; attempt++) {
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
      ? 'Полный доступ'
      : accessLevel === 'manager'
      ? 'Руководитель'
      : accessLevel === 'observer'
      ? 'Аудитор (Чтение)'
      : 'Базовый доступ';

  return {
    accessLevel,
    accessLabel,
    canAssignTasks,
    canViewCrm,
    rawPerms,
  };
}

const pendingNatTextMap = new Map<string, string>();
const pendingFwdMap = new Map<string, { clientName: string; text: string; phone?: string }>();

// Главное меню командного центра с кнопками «Аналитика TedCloud AI», «Связь с коллегами» и «Рабочая смена» (ZERO EMOJI)
function buildRoleCommandCenterKeyboard(siteUrl: string, chatId: string, user: any) {
  const { canAssignTasks, canViewCrm, rawPerms } = resolveUserPermissions(user);
  const isShiftActive = Boolean(rawPerms?.shift_started_at);
  const rows: any[][] = [
    [
      {
        text: isShiftActive ? 'Завершить смену (Отчет)' : 'Начать рабочую смену',
        callback_data: 'shift_toggle',
      },
    ],
    [{ text: 'Мои активные задачи', callback_data: 'menu_my_tasks' }],
    [{ text: 'Аналитика TedCloud AI', callback_data: 'menu_ai_brief' }],
    [{ text: 'Связь с коллегами / Отделом', callback_data: 'menu_comm' }],
  ];

  if (canAssignTasks) {
    rows.push([{ text: 'Поручить задачу коллеге', callback_data: 'menu_delegate' }]);
  }

  if (canViewCrm) {
    rows.push([{ text: 'Финансовая сводка CRM', callback_data: 'menu_crm_digest' }]);
  }

  const inviteQuery = user?.invite_code
    ? `&invite=${encodeURIComponent(String(user.invite_code))}`
    : '';

  rows.push([
    {
      text: 'Открыть панель TedCloud',
      url: `${siteUrl}/?tg_id=${chatId}${inviteQuery}&chatId=${chatId}`,
    },
  ]);

  return { inline_keyboard: rows };
}

function buildWebAppKeyboard(
  siteUrl: string,
  chatId: string,
  extraRows: any[][] = [],
  inviteCode?: string | null
) {
  const inviteQuery = inviteCode ? `&invite=${encodeURIComponent(String(inviteCode))}` : '';
  return {
    inline_keyboard: [
      ...extraRows,
      [{ text: 'Командное меню', callback_data: 'menu_home' }],
      [
        {
          text: 'Открыть панель TedCloud',
          url: `${siteUrl}/?tg_id=${chatId}${inviteQuery}&chatId=${chatId}`,
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

    const setPendingCommForUser = async (
      targetChatId: string,
      user: any,
      state: PendingCommState | null
    ) => {
      if (state) {
        pendingCommMap.set(targetChatId, state);
      } else {
        pendingCommMap.delete(targetChatId);
      }

      const { rawPerms } = resolveUserPermissions(user);
      const updatedPerms = { ...rawPerms };
      if (state) {
        updatedPerms.pending_comm = state;
      } else {
        delete updatedPerms.pending_comm;
      }
      await safeWebhookUpdate(supabase, 'organization_nodes', user.id, {
        permissions: updatedPerms,
      });
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
        '/ai — Аналитика и сводка TedCloud AI',
        '/tasks — Список моих активных задач',
        '/new — Поставить новую задачу',
        '/digest — Финансовая сводка CRM и задач',
      ].join('\n');

      await sendTelegramMessage(targetChatId, menuHtml, {
        reply_markup: buildRoleCommandCenterKeyboard(siteUrl, targetChatId, user),
      });
    };

    // БЛОК 2: ИИ-ассистент TedCloud AI в Telegram-боте (/ai и кнопка «Аналитика TedCloud AI»)
    const sendTedCloudAiBrief = async (
      targetChatId: string,
      user: any,
      customQuestion?: string
    ) => {
      const companyId = user?.company_id || null;
      let tasksQuery = supabase.from('tasks').select('*');
      let leadsQuery = supabase.from('crm_leads').select('*');
      let nodesQuery = supabase.from('organization_nodes').select('*');
      let msgsQuery = supabase.from('workspace_messages').select('*').limit(100);

      if (companyId) {
        tasksQuery = tasksQuery.eq('company_id', companyId);
        leadsQuery = leadsQuery.eq('company_id', companyId);
        nodesQuery = nodesQuery.eq('company_id', companyId);
        msgsQuery = msgsQuery.eq('company_id', companyId);
      }

      const [tasksRes, leadsRes, nodesRes, msgsRes, compRes] = await Promise.all([
        tasksQuery,
        leadsQuery,
        nodesQuery,
        msgsQuery,
        companyId
          ? supabase.from('companies').select('name').eq('id', companyId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const companyName = compRes?.data?.name || 'TedCloud';
      const companyTasks = (tasksRes.data || []).filter(
        (t: any) => !companyId || String(t.company_id || '') === String(companyId)
      );
      const companyLeads = (leadsRes.data || []).filter(
        (l: any) => !companyId || String(l.company_id || '') === String(companyId)
      );
      const companyNodes = (nodesRes.data || []).filter(
        (n: any) => !companyId || String(n.company_id || '') === String(companyId)
      );
      const companyMessages = (msgsRes.data || []).filter(
        (m: any) => !companyId || String(m.company_id || '') === String(companyId)
      );

      const { canViewCrm } = resolveUserPermissions(user);
      const filteredLeadsForAi = canViewCrm ? companyLeads : [];

      const aiMode = customQuestion && customQuestion.trim() ? 'custom' : 'daily_brief';
      const builtIn = runBuiltInAiAssistant({
        mode: aiMode,
        prompt: customQuestion || '',
        companyName,
        currentUser: user,
        nodes: companyNodes,
        tasks: companyTasks,
        leads: filteredLeadsForAi,
        messages: companyMessages,
      });

      let replyBody = builtIn.reply;

      const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
      if (geminiApiKey) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'aistudio-build',
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `Ты — корпоративный аналитический копилот TedCloud Intelligence в Telegram.
Сотрудник: ${user.name} (${user.role_type || 'Специалист'}).
Базовая сводка по данным компании «${companyName}»:
${builtIn.reply}
${customQuestion ? `Вопрос сотрудника: ${customQuestion}` : ''}
Сформируй четкий, деловой ответ на русском языке без эмодзи (до 900 символов).`,
                    },
                  ],
                },
              ],
            }),
          });
          if (geminiRes.ok) {
            const geminiJson: any = await geminiRes.json();
            const textOut = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textOut && String(textOut).trim()) {
              replyBody = String(textOut).trim();
            }
          }
        } catch (err) {
          console.warn('[WEBHOOK] Gemini fallback to built-in engine:', err);
        }
      }

      const aiHtml = [
        '<b>TEDCLOUD AI | ИНТЕЛЛЕКТУАЛЬНЫЙ КОПИЛОТ</b>',
        escapeHtml(replyBody),
      ].join('\n\n');

      await sendTelegramMessage(targetChatId, aiHtml, {
        reply_markup: buildRoleCommandCenterKeyboard(siteUrl, targetChatId, user),
      });
    };

    const sendActiveTasksList = async (targetChatId: string, user: any) => {
      let query = supabase.from('tasks').select('*');
      if (user?.company_id) {
        query = query.eq('company_id', user.company_id);
      }
      const { data: allTasks, error: tasksErr } = await query;

      if (tasksErr) {
        throw new Error(`Ошибка загрузки реестра задач: ${tasksErr.message}`);
      }

      const activeTasks = (allTasks || []).filter(
        (t: any) =>
          (!user.company_id || String(t.company_id || '') === String(user.company_id)) &&
          t.status !== 'Done' &&
          (t.assigned_to === user.id ||
            t.owner_node_id === user.id ||
            t.created_by === user.id ||
            (user.department &&
              t.department &&
              String(t.department).toLowerCase() === String(user.department).toLowerCase()))
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
        const deptTag = t.department ? ` | ${escapeHtml(t.department)}` : '';
        return `${index + 1}. [${prio} | ${st}${deptTag}] ${escapeHtml(t.title)}`;
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
          reply_markup: buildWebAppKeyboard(
            siteUrl,
            targetChatId,
            extraRows,
            user?.invite_code || null
          ),
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

      let tasksQuery = supabase.from('tasks').select('*');
      let leadsQuery = supabase.from('crm_leads').select('*');
      if (user?.company_id) {
        tasksQuery = tasksQuery.eq('company_id', user.company_id);
        leadsQuery = leadsQuery.eq('company_id', user.company_id);
      }

      const [tasksRes, leadsRes] = await Promise.all([tasksQuery, leadsQuery]);

      const allTasks = (tasksRes.data || []).filter(
        (t: any) => !user.company_id || String(t.company_id || '') === String(user.company_id)
      );
      const allLeads = (leadsRes.data || []).filter(
        (l: any) => !user.company_id || String(l.company_id || '') === String(user.company_id)
      );

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

      // 1. Смена статуса задачи (В работу / Выполнено)
      if (cbData.startsWith('task_progress:') || cbData.startsWith('task_done:')) {
        const [action, taskId] = cbData.split(':');
        const nextStatus = action === 'task_done' ? 'Done' : 'In Progress';
        const statusLabel = action === 'task_done' ? 'Выполнено' : 'В работе';

        if (taskId) {
          await safeWebhookUpdate(supabase, 'tasks', taskId, { status: nextStatus });
        }

        if (cbId) {
          await answerCallbackQuery(cbId, `Статус задачи: ${statusLabel}`);
        }

        await sendTelegramMessage(
          cbChatId,
          `✓ Статус задачи обновлен: <b>${statusLabel}</b>`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
            },
          }
        );

        return res.status(200).send('OK');
      }

      // 1b. БЛОК 3: Согласование и Заявки в 1 клик (Утвердить / Отклонить)
      if (cbData.startsWith('approve_task_') || cbData.startsWith('reject_task_')) {
        const isApproved = cbData.startsWith('approve_task_');
        const taskId = isApproved
          ? cbData.slice('approve_task_'.length).trim()
          : cbData.slice('reject_task_'.length).trim();
        const nextStatus = isApproved ? 'Done' : 'Cancelled';

        let taskRow: any = null;
        if (taskId) {
          const { data: existingTask } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .maybeSingle();
          taskRow = existingTask;
          await safeWebhookUpdate(supabase, 'tasks', taskId, { status: nextStatus });
        }

        const taskTitle = taskRow?.title || 'Заявка на согласование';

        // Запись в журнал безопасности audit_logs
        try {
          await supabase.from('audit_logs').insert([
            {
              company_id: taskRow?.company_id || user?.company_id || null,
              actor_id: user?.id || null,
              actor_name: user?.name || 'Руководитель',
              action_type: isApproved ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
              entity_type: 'tasks',
              entity_id: taskId,
              details: `${
                isApproved ? 'Утверждена заявка' : 'Отклонена заявка'
              } «${taskTitle}» руководителем ${user?.name || 'Руководитель'}`,
            },
          ]);
        } catch {}

        // Мгновенное уведомление автору заявки в Telegram
        const authorId = taskRow?.created_by || taskRow?.owner_node_id;
        if (authorId) {
          const { data: authorNode } = await supabase
            .from('organization_nodes')
            .select('*')
            .eq('id', authorId)
            .maybeSingle();
          const authorChatId = String(authorNode?.telegram_chat_id || '').trim();
          if (authorChatId && authorChatId !== cbChatId) {
            const decisionNotification = isApproved
              ? `✓ Ваша заявка «<b>${escapeHtml(taskTitle)}</b>» утверждена руководителем <b>${escapeHtml(
                  user?.name || 'Руководитель'
                )}</b>`
              : `✕ Ваша заявка «<b>${escapeHtml(taskTitle)}</b>» отклонена руководителем <b>${escapeHtml(
                  user?.name || 'Руководитель'
                )}</b>`;
            await sendTelegramMessage(authorChatId, decisionNotification, {
              reply_markup: {
                inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
              },
            });
          }
        }

        if (cbId) {
          await answerCallbackQuery(
            cbId,
            isApproved ? 'Заявка утверждена' : 'Заявка отклонена'
          );
        }

        await sendTelegramMessage(
          cbChatId,
          `${isApproved ? '✓ Заявка утверждена' : '✕ Заявка отклонена'}: <b>${escapeHtml(
            taskTitle
          )}</b>`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
            },
          }
        );

        return res.status(200).send('OK');
      }

      // 1c. БЛОК 1: Создание задачи из входящего сообщения (msg_to_task_<msgId>)
      if (cbData.startsWith('msg_to_task_')) {
        const msgId = cbData.slice('msg_to_task_'.length).trim();
        let sourceText = '';

        if (msgId) {
          const { data: msgRecord } = await supabase
            .from('workspace_messages')
            .select('*')
            .eq('id', msgId)
            .maybeSingle();
          sourceText = String(
            msgRecord?.message_text || msgRecord?.text || ''
          ).trim();
        }

        if (!sourceText && cb.message?.text) {
          const lines = String(cb.message.text)
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter(Boolean);
          sourceText = lines.length > 1 ? lines.slice(1).join(' ') : lines[0] || '';
        }

        const taskTitle = (sourceText || 'Поручение из сообщения в чате').slice(0, 140);
        const companyId = user?.company_id || (await resolveCompanyId());

        await safeWebhookInsert(supabase, 'tasks', {
          company_id: companyId,
          title: taskTitle,
          description: sourceText || null,
          notes: sourceText || null,
          type: 'Task',
          priority: 'Medium',
          status: 'Todo',
          department: user?.department || null,
          assigned_to: user?.id || null,
          owner_node_id: user?.id || null,
          created_by: user?.id || null,
        });

        if (cbId) {
          await answerCallbackQuery(cbId, 'Задача создана');
        }

        await sendTelegramMessage(
          cbChatId,
          `✓ Задача создана: <b>${escapeHtml(taskTitle)}</b>`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
            },
          }
        );

        return res.status(200).send('OK');
      }

      // 2. Главное меню (только по явному вызову)
      if (cbData === 'menu_home' || cbData === 'open_main_menu') {
        await setPendingCommForUser(cbChatId, user, null);
        if (cbId) await answerCallbackQuery(cbId, 'Командный центр');
        await sendCommandCenterCard(cbChatId, user);
        return res.status(200).send('OK');
      }

      // 2b. БЛОК 2: Аналитика TedCloud AI
      if (cbData === 'menu_ai_brief') {
        if (cbId) await answerCallbackQuery(cbId, 'Запуск аналитики TedCloud AI');
        await sendTedCloudAiBrief(cbChatId, user);
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

      // 5. Меню «Связь с коллегами / Отделом»
      if (cbData === 'menu_comm') {
        if (cbId) await answerCallbackQuery(cbId, 'Выберите контур связи');
        await sendTelegramMessage(
          cbChatId,
          [
            '<b>ЕДИНОЕ ИНФОПОЛЕ И СВЯЗЬ TEDCLOUD</b>',
            'Выберите получателя корпоративного сообщения:',
          ].join('\n'),
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Написать сотруднику', callback_data: 'comm_mode_direct' }],
                [{ text: 'Оповестить отдел', callback_data: 'comm_mode_dept' }],
                [{ text: 'Общее сообщение компании', callback_data: 'comm_mode_broadcast' }],
                [{ text: 'Отмена', callback_data: 'menu_home' }],
              ],
            },
          }
        );
        return res.status(200).send('OK');
      }

      if (cbData === 'comm_mode_direct') {
        let nodesQuery = supabase.from('organization_nodes').select('*');
        if (user?.company_id) {
          nodesQuery = nodesQuery.eq('company_id', user.company_id);
        }
        const { data: nodes } = await nodesQuery;
        const companyNodes = (nodes || []).filter(
          (emp: any) =>
            !user.company_id || String(emp.company_id || '') === String(user.company_id)
        );
        const employees = companyNodes.filter((emp: any) => emp.id !== user.id);
        const listToRender = employees.length > 0 ? employees : companyNodes;

        const buttons = listToRender.slice(0, 12).map((emp: any) => [
          {
            text: `${emp.name} (${emp.role_type || 'Специалист'})`,
            callback_data: `comm_to_node:${emp.id}`,
          },
        ]);
        buttons.push([{ text: 'Отмена', callback_data: 'menu_home' }]);

        if (cbId) await answerCallbackQuery(cbId, 'Выберите сотрудника');
        await sendTelegramMessage(
          cbChatId,
          [
            '<b>ОТПРАВКА ЛИЧНОГО СООБЩЕНИЯ</b>',
            'Выберите сотрудника из списка организации:',
          ].join('\n'),
          {
            reply_markup: { inline_keyboard: buttons },
          }
        );
        return res.status(200).send('OK');
      }

      if (cbData === 'comm_mode_dept') {
        let nodesQuery = supabase.from('organization_nodes').select('department, company_id');
        let compQuery = supabase.from('companies').select('id, departments');
        if (user?.company_id) {
          nodesQuery = nodesQuery.eq('company_id', user.company_id);
          compQuery = compQuery.eq('id', user.company_id);
        }
        const [{ data: nodes }, { data: compRows }] = await Promise.all([
          nodesQuery,
          compQuery.limit(1),
        ]);

        const deptSet = new Set<string>();
        const compDepts = compRows?.[0]?.departments;
        if (Array.isArray(compDepts)) {
          compDepts.forEach((d: any) => {
            if (typeof d === 'string' && d.trim()) deptSet.add(d.trim());
          });
        }
        (nodes || []).forEach((n: any) => {
          if (
            (!user.company_id || String(n?.company_id || '') === String(user.company_id)) &&
            n?.department &&
            String(n.department).trim()
          ) {
            deptSet.add(String(n.department).trim());
          }
        });

        const departments = Array.from(deptSet);
        if (departments.length === 0) {
          departments.push(user?.department || 'Основное подразделение');
        }

        const deptButtons = departments.slice(0, 10).map((deptName) => [
          {
            text: deptName,
            callback_data: `comm_to_dept:${deptName.slice(0, 36)}`,
          },
        ]);
        deptButtons.push([{ text: 'Отмена', callback_data: 'menu_home' }]);

        if (cbId) await answerCallbackQuery(cbId, 'Выберите подразделение');
        await sendTelegramMessage(
          cbChatId,
          [
            '<b>ОПОВЕЩЕНИЕ ПОДРАЗДЕЛЕНИЯ (ОТДЕЛА)</b>',
            'Выберите целевой отдел для отправки сообщения всем его сотрудникам:',
          ].join('\n'),
          {
            reply_markup: { inline_keyboard: deptButtons },
          }
        );
        return res.status(200).send('OK');
      }

      if (cbData === 'comm_mode_broadcast') {
        await setPendingCommForUser(cbChatId, user, { mode: 'broadcast' });
        if (cbId) await answerCallbackQuery(cbId, 'Общее оповещение');
        await sendTelegramMessage(
          cbChatId,
          [
            '<b>ОБЩЕЕ ОПОВЕЩЕНИЕ ПО КОМПАНИИ</b>',
            'Отправьте текст сообщения следующим ответом в чат.',
            'Для пометки «Срочно» начните сообщение с символа «!» (например: <code>!Собрание руководителей в 15:00</code>).',
          ].join('\n'),
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Отмена', callback_data: 'cancel_comm' }]],
            },
          }
        );
        return res.status(200).send('OK');
      }

      // 5.1 Рабочая смена (Check-in / Check-out с авто-отчетом)
      if (cbData === 'shift_toggle') {
        const { rawPerms } = resolveUserPermissions(user);
        const companyId = user.company_id || (await resolveCompanyId());
        const nowIso = new Date().toISOString();
        const timeLabel = formatMoscowTime();

        if (!rawPerms?.shift_started_at) {
          await safeWebhookUpdate(supabase, 'organization_nodes', user.id, {
            permissions: {
              ...rawPerms,
              shift_started_at: nowIso,
            },
          });
          if (cbId) await answerCallbackQuery(cbId, 'Рабочая смена открыта');
          await sendTelegramMessage(
            cbChatId,
            `✓ <b>Смена начата (${timeLabel})</b> · Статус: На линии`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
              },
            }
          );
          return res.status(200).send('OK');
        } else {
          const startedMs = new Date(rawPerms.shift_started_at).getTime();
          const diffMin = Math.max(1, Math.round((Date.now() - startedMs) / 60000));
          const hours = Math.floor(diffMin / 60);
          const mins = diffMin % 60;
          const durationStr = hours > 0 ? `${hours} ч ${mins} мин` : `${mins} мин`;

          const { data: userTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('assigned_to', user.id);
          const doneCount = (userTasks || []).filter((t: any) => t.status === 'Done').length;
          const inProgCount = (userTasks || []).filter((t: any) => t.status !== 'Done').length;

          const cleanedPerms = { ...rawPerms };
          delete cleanedPerms.shift_started_at;
          await safeWebhookUpdate(supabase, 'organization_nodes', user.id, {
            permissions: cleanedPerms,
          });

          const summaryText = `Завершена смена (${durationStr}). Выполнено задач: ${doneCount}, в работе: ${inProgCount}.`;
          await safeWebhookInsert(supabase, 'workspace_messages', {
            company_id: companyId,
            sender_id: user.id,
            sender_name: user.name,
            sender_role: user.role_type || 'Специалист',
            target_type: 'broadcast',
            target_label: 'Всем сотрудникам',
            message_text: summaryText,
            text: summaryText,
            is_urgent: false,
            is_read: false,
          });

          if (cbId) await answerCallbackQuery(cbId, 'Смена завершена, отчет отправлен');
          await sendTelegramMessage(
            cbChatId,
            `✓ <b>Смена завершена (${durationStr})</b>\nАвто-отчет опубликован в общем инфополе (Выполнено: ${doneCount}, В работе: ${inProgCount}).`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
              },
            }
          );
          return res.status(200).send('OK');
        }
      }

      // 5.2 Быстрые реакции в 1 клик под входящим сообщением (quick_ack_ / quick_wait_)
      if (cbData.startsWith('quick_ack_') || cbData.startsWith('quick_wait_')) {
        const isAck = cbData.startsWith('quick_ack_');
        const targetNodeId = isAck
          ? cbData.slice('quick_ack_'.length)
          : cbData.slice('quick_wait_'.length);
        const quickReplyText = isAck
          ? 'Принято в работу, сделаю!'
          : 'На связи, отвечу через 10 минут!';

        const companyId = user.company_id || (await resolveCompanyId());
        const { data: targetNode } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('id', targetNodeId)
          .maybeSingle();

        const { data: insertedQuickMsg } = await safeWebhookInsert(
          supabase,
          'workspace_messages',
          {
            company_id: companyId,
            sender_id: user.id,
            sender_name: user.name,
            sender_role: user.role_type || 'Специалист',
            target_type: 'direct',
            target_id: targetNodeId,
            target_label: targetNode?.name || 'Сотрудник',
            message_text: quickReplyText,
            text: quickReplyText,
            is_urgent: false,
            is_read: false,
          }
        );

        if (targetNode?.telegram_chat_id && String(targetNode.telegram_chat_id).trim() !== cbChatId) {
          const recChatId = String(targetNode.telegram_chat_id).trim();
          await setPendingCommForUser(recChatId, targetNode, {
            mode: 'direct',
            targetNodeId: String(user.id),
          });
          const incomingHtml = formatCompactIncomingTelegramMessage({
            senderName: user.name || 'Сотрудник',
            senderRole: user.role_type || 'Специалист',
            messageText: quickReplyText,
            targetType: 'direct',
            targetLabel: null,
          });
          await sendTelegramMessage(recChatId, incomingHtml);
        }

        if (cbId) await answerCallbackQuery(cbId, 'Ответ отправлен');
        return res.status(200).send('OK');
      }

      // 5.3 Умное распознавание имени коллеги или пересланного контакта (nat_msg_, nat_task_, fwd_to_lead, fwd_to_task)
      if (cbData.startsWith('nat_msg_') || cbData.startsWith('nat_task_')) {
        const isMsg = cbData.startsWith('nat_msg_');
        const targetNodeId = isMsg
          ? cbData.slice('nat_msg_'.length)
          : cbData.slice('nat_task_'.length);
        const savedText = pendingNatTextMap.get(cbChatId) || 'Оперативное поручение';
        pendingNatTextMap.delete(cbChatId);
        const companyId = user.company_id || (await resolveCompanyId());

        const { data: targetNode } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('id', targetNodeId)
          .maybeSingle();
        const targetName = targetNode?.name || 'Сотрудник';

        if (isMsg) {
          await setPendingCommForUser(cbChatId, user, {
            mode: 'direct',
            targetNodeId,
          });
          await safeWebhookInsert(supabase, 'workspace_messages', {
            company_id: companyId,
            sender_id: user.id,
            sender_name: user.name,
            sender_role: user.role_type || 'Специалист',
            target_type: 'direct',
            target_id: targetNodeId,
            target_label: targetName,
            message_text: savedText,
            text: savedText,
            is_urgent: false,
            is_read: false,
          });
          if (targetNode?.telegram_chat_id && String(targetNode.telegram_chat_id).trim() !== cbChatId) {
            const recChatId = String(targetNode.telegram_chat_id).trim();
            await setPendingCommForUser(recChatId, targetNode, {
              mode: 'direct',
              targetNodeId: String(user.id),
            });
            const incomingHtml = formatCompactIncomingTelegramMessage({
              senderName: user.name || 'Сотрудник',
              senderRole: user.role_type || 'Специалист',
              messageText: savedText,
              targetType: 'direct',
              targetLabel: null,
            });
            await sendTelegramMessage(recChatId, incomingHtml);
          }
          if (cbId) await answerCallbackQuery(cbId, `Отправлено: ${targetName}`);
          return res.status(200).send('OK');
        } else {
          const { data: createdTask } = await safeWebhookInsert(supabase, 'tasks', {
            company_id: companyId,
            title: savedText,
            type: 'Task',
            priority: 'Medium',
            status: 'Todo',
            department: targetNode?.department || null,
            owner_node_id: targetNodeId,
            assigned_to: targetNodeId,
            created_by: user.id,
          });
          if (targetNode?.telegram_chat_id && String(targetNode.telegram_chat_id).trim() !== cbChatId) {
            await sendTelegramMessage(
              String(targetNode.telegram_chat_id).trim(),
              `<b>Поручение</b> · ${escapeHtml(user.name)} (<i>${escapeHtml(
                user.role_type || 'Руководитель'
              )}</i>)\n${escapeHtml(savedText)}`,
              {
                reply_markup: {
                  inline_keyboard: createdTask?.id
                    ? [
                        [
                          { text: 'В работу', callback_data: `task_progress:${createdTask.id}` },
                          { text: 'Выполнено', callback_data: `task_done:${createdTask.id}` },
                        ],
                      ]
                    : [],
                },
              }
            );
          }
          if (cbId) await answerCallbackQuery(cbId, 'Задача поручена');
          await sendTelegramMessage(
            cbChatId,
            `✓ Задача поручена (<b>${escapeHtml(targetName)}</b>): <b>${escapeHtml(savedText)}</b>`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
              },
            }
          );
          return res.status(200).send('OK');
        }
      }

      if (cbData === 'fwd_to_lead' || cbData === 'fwd_to_task') {
        const fwd = pendingFwdMap.get(cbChatId) || {
          clientName: 'Внешний контакт Telegram',
          text: 'Запрос из Telegram',
        };
        pendingFwdMap.delete(cbChatId);
        const companyId = user.company_id || (await resolveCompanyId());

        if (cbData === 'fwd_to_lead') {
          await safeWebhookInsert(supabase, 'crm_leads', {
            company_id: companyId,
            client_name: fwd.clientName,
            full_name: fwd.clientName,
            title: `${fwd.clientName} — Telegram`,
            amount: 0,
            deal_value: 0,
            status: 'New',
            stage: 'New',
            contact: fwd.phone || null,
            notes: fwd.text,
            description: fwd.text,
            owner_node_id: user.id,
            assigned_to: user.id,
          });
          if (cbId) await answerCallbackQuery(cbId, 'Сделка создана в CRM');
          await sendTelegramMessage(
            cbChatId,
            `✓ Создана сделка CRM: <b>${escapeHtml(fwd.clientName)}</b>`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
              },
            }
          );
          return res.status(200).send('OK');
        } else {
          await safeWebhookInsert(supabase, 'tasks', {
            company_id: companyId,
            title: `${fwd.clientName}: ${fwd.text}`.slice(0, 140),
            type: 'Task',
            priority: 'Medium',
            status: 'Todo',
            owner_node_id: user.id,
            assigned_to: user.id,
            created_by: user.id,
          });
          if (cbId) await answerCallbackQuery(cbId, 'Задача создана');
          await sendTelegramMessage(
            cbChatId,
            `✓ Задача создана из пересланного контакта: <b>${escapeHtml(fwd.clientName)}</b>`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
              },
            }
          );
          return res.status(200).send('OK');
        }
      }

      // Обработка выбора сотрудника или кнопки «Написать ответ» (reply_msg_<UUID>) — непрерывная сессия диалога (Sticky Chat Session)
      if (cbData.startsWith('comm_to_node:') || cbData.startsWith('reply_msg_')) {
        const targetNodeId = cbData.startsWith('comm_to_node:')
          ? cbData.slice('comm_to_node:'.length)
          : cbData.slice('reply_msg_'.length);

        if (!targetNodeId) {
          return res.status(200).send('OK');
        }

        const { data: targetNode } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('id', targetNodeId)
          .maybeSingle();

        const targetName = targetNode?.name || 'Сотрудник';

        await setPendingCommForUser(cbChatId, user, {
          mode: 'direct',
          targetNodeId,
        });

        if (cbId) await answerCallbackQuery(cbId, `Связь с: ${targetName}`);
        await sendTelegramMessage(
          cbChatId,
          `<b>Связь с: ${escapeHtml(targetName)}</b>\nПишите сообщения подряд — они доставляются мгновенно:`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Завершить диалог', callback_data: 'cancel_action' }]],
            },
          }
        );
        return res.status(200).send('OK');
      }

      if (cbData.startsWith('comm_to_dept:')) {
        const targetDept = cbData.slice('comm_to_dept:'.length).trim();
        await setPendingCommForUser(cbChatId, user, {
          mode: 'department',
          targetDepartment: targetDept,
        });

        if (cbId) await answerCallbackQuery(cbId, `Отдел: ${targetDept}`);
        await sendTelegramMessage(
          cbChatId,
          `Сообщение для отдела <b>${escapeHtml(targetDept)}</b> (отправьте текст):`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Отмена', callback_data: 'cancel_reply' }]],
            },
          }
        );
        return res.status(200).send('OK');
      }

      if (cbData === 'cancel_comm' || cbData === 'cancel_reply' || cbData === 'cancel_action') {
        await setPendingCommForUser(cbChatId, user, null);
        if (cbId) await answerCallbackQuery(cbId, 'Диалог завершен');
        await sendTelegramMessage(cbChatId, 'Диалог завершен.', {
          reply_markup: {
            inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
          },
        });
        return res.status(200).send('OK');
      }

      // 6. Меню делегирования задачи коллеге
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

        let nodesQuery = supabase.from('organization_nodes').select('*');
        if (user?.company_id) {
          nodesQuery = nodesQuery.eq('company_id', user.company_id);
        }
        const { data: nodes } = await nodesQuery;
        const employees = (nodes || []).filter(
          (emp: any) =>
            !user.company_id || String(emp.company_id || '') === String(user.company_id)
        );

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

      // 7. Выбор конкретного коллеги для поручения
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
    const rawText: string = (message?.text || message?.caption || '').trim();
    const hasMedia = Boolean(
      (Array.isArray(message?.photo) && message.photo.length > 0) || message?.document
    );
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
      await setPendingCommForUser(chatId, user, null);
      await sendCommandCenterCard(chatId, user);
      return res.status(200).send('OK');
    }

    // 2. КОМАНДА /ai — ИИ-ассистент TedCloud AI
    if (rawText === '/ai' || rawText.startsWith('/ai ') || rawText.startsWith('/ai@')) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      const customQuestion = rawText.replace(/^\/ai(@\S+)?\s*/i, '').trim();
      await sendTedCloudAiBrief(chatId, user, customQuestion);
      return res.status(200).send('OK');
    }

    // 3. КОМАНДА /tasks — Список активных задач
    if (rawText === '/tasks' || rawText.startsWith('/tasks@')) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      await sendActiveTasksList(chatId, user);
      return res.status(200).send('OK');
    }

    // 4. КОМАНДА /digest — Финансовая сводка CRM и задач
    if (rawText === '/digest' || rawText.startsWith('/digest@')) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      await sendFinancialCrmDigest(chatId, user);
      return res.status(200).send('OK');
    }

    // 5. КОМАНДА /new — Создание задачи
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

    // 5b. БЛОК 1: Превращение любого сообщения в задачу через свайп-Reply командами /task или +задача
    const quotedMessageText =
      message?.reply_to_message?.text || message?.reply_to_message?.caption || '';
    const lowerRawCmd = rawText.toLowerCase();
    if (
      quotedMessageText &&
      (lowerRawCmd === '/task' ||
        lowerRawCmd.startsWith('/task ') ||
        lowerRawCmd.startsWith('/task@') ||
        lowerRawCmd === '+задача' ||
        lowerRawCmd.startsWith('+задача ') ||
        lowerRawCmd === 'в задачу')
    ) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      const companyId = user.company_id || (await resolveCompanyId());
      const customNote = rawText
        .replace(/^(\/task(@\S+)?|\+задача|в задачу)\s*/i, '')
        .trim();
      const extractedBody = extractMessageBodyFromQuotedReply(quotedMessageText);
      const taskTitle = (customNote || extractedBody || 'Поручение из сообщения в чате').slice(
        0,
        140
      );

      await safeWebhookInsert(supabase, 'tasks', {
        company_id: companyId,
        title: taskTitle,
        description: extractedBody || taskTitle,
        notes: extractedBody || taskTitle,
        type: 'Task',
        priority: taskTitle.startsWith('!') ? 'High' : 'Medium',
        status: 'Todo',
        department: user?.department || null,
        assigned_to: user?.id || null,
        owner_node_id: user?.id || null,
        created_by: user?.id || null,
      });

      await reactToTelegramMessage(chatId, message?.message_id, '⚡');
      await sendTelegramMessage(
        chatId,
        `✓ Задача создана: <b>${escapeHtml(taskTitle)}</b>`
      );
      return res.status(200).send('OK');
    }

    if (rawText.length > 0 || hasMedia) {
      const user = await findOrCreateUserByChatId(chatId, firstName);
      const companyId = user.company_id || (await resolveCompanyId());
      const { rawPerms, canAssignTasks } = resolveUserPermissions(user);

      // Проверяем, находится ли пользователь в режиме отправки сообщения ИЛИ сделал нативный свайп-Reply в Telegram
      let activeCommState: PendingCommState | null =
        pendingCommMap.get(chatId) ||
        (rawPerms.pending_comm && typeof rawPerms.pending_comm === 'object'
          ? (rawPerms.pending_comm as PendingCommState)
          : null);

      let cachedCompanyNodes: any[] | null = null;
      const loadCompanyNodes = async (): Promise<any[]> => {
        if (cachedCompanyNodes) return cachedCompanyNodes;
        let allNodesQuery = supabase.from('organization_nodes').select('*');
        if (companyId) {
          allNodesQuery = allNodesQuery.eq('company_id', companyId);
        }
        const { data: allNodes } = await allNodesQuery;
        cachedCompanyNodes = (allNodes || []).filter(
          (n: any) => !companyId || String(n.company_id || '') === String(companyId)
        );
        return cachedCompanyNodes;
      };

      // Нативный Reply в Telegram: если сотрудник делает свайп-ответить на сообщение коллеги
      if (!activeCommState && !rawText.startsWith('/') && quotedMessageText) {
        const extractedColleagueName = extractColleagueNameFromReplyText(quotedMessageText);
        if (extractedColleagueName) {
          const nodesList = await loadCompanyNodes();
          const nameLower = extractedColleagueName.toLowerCase();
          const matchedNode = nodesList.find((n: any) => {
            const candidate = String(n.name || '').trim().toLowerCase();
            return (
              candidate === nameLower ||
              candidate.includes(nameLower) ||
              nameLower.includes(candidate)
            );
          });
          if (matchedNode) {
            activeCommState = {
              mode: 'direct',
              targetNodeId: String(matchedNode.id),
            };
            await setPendingCommForUser(chatId, user, activeCommState);
          }
        }
      }

      if (activeCommState && !rawText.startsWith('/')) {
        // В режиме личного диалога ('direct') сохраняем сессию, чтобы сотрудник мог писать сообщения подряд!
        if (activeCommState.mode !== 'direct') {
          await setPendingCommForUser(chatId, user, null);
        }
        const nodesList = await loadCompanyNodes();

        const mediaResult = hasMedia
          ? await extractTelegramMediaAttachments(message)
          : { attachments: [] };

        // БЛОК 1: is_urgent ставится ТОЛЬКО если сообщение начинается с "!" (символ "!" убирается)
        const { isUrgent: isUrgentMsg, cleanText: parsedText } =
          parseTelegramUrgentMessage(rawText);
        const msgBody =
          parsedText ||
          (mediaResult.attachments.length > 0
            ? `📎 ${mediaResult.attachments.map((a) => a.name).join(', ')}`
            : '');

        if (!msgBody && mediaResult.attachments.length === 0) {
          return res.status(200).send('OK');
        }

        let targetNodes: any[] = [];
        let resolvedTargetType: 'direct' | 'department' | 'broadcast' = 'broadcast';
        let resolvedTargetId: string | null = null;
        let resolvedTargetLabel = 'Всем сотрудникам';

        if (activeCommState.mode === 'direct' && activeCommState.targetNodeId) {
          const recipientNode = nodesList.find(
            (n: any) => String(n.id) === String(activeCommState.targetNodeId)
          );
          resolvedTargetType = 'direct';
          resolvedTargetId = String(recipientNode?.id || activeCommState.targetNodeId);
          resolvedTargetLabel = recipientNode?.name || 'Сотрудник';

          if (recipientNode) {
            targetNodes = [recipientNode];
          }
        } else if (activeCommState.mode === 'department' && activeCommState.targetDepartment) {
          const deptClean = activeCommState.targetDepartment.trim();
          resolvedTargetType = 'department';
          resolvedTargetId = deptClean;
          resolvedTargetLabel = deptClean;

          targetNodes = nodesList.filter(
            (n: any) =>
              String(n.id) !== String(user.id) &&
              String(n.department || '')
                .trim()
                .toLowerCase() === deptClean.toLowerCase()
          );
        } else {
          resolvedTargetType = 'broadcast';
          resolvedTargetId = null;
          resolvedTargetLabel = 'Всем сотрудникам';
          targetNodes = nodesList.filter((n: any) => String(n.id) !== String(user.id));
        }

        await safeWebhookInsert(supabase, 'workspace_messages', {
          company_id: companyId,
          sender_id: user.id,
          sender_name: user.name,
          sender_role: user.role_type || 'Специалист',
          target_type: resolvedTargetType,
          target_id: resolvedTargetId,
          target_label: resolvedTargetLabel,
          message_text: msgBody,
          text: msgBody,
          attachments: mediaResult.attachments,
          is_urgent: isUrgentMsg,
          is_read: false,
        });

        // БЛОК 1: Живой формат входящего сообщения у получателя БЕЗ кнопок под каждой фразой:
        // 💬 Имя Фамилия: Текст сообщения
        const incomingHtml = formatCompactIncomingTelegramMessage({
          senderName: user.name || 'Сотрудник',
          senderRole: user.role_type || 'Специалист',
          messageText: msgBody,
          targetType: resolvedTargetType,
          targetLabel: resolvedTargetType === 'direct' ? null : resolvedTargetLabel,
        });

        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        for (const recipient of targetNodes) {
          const recChatId = String(recipient?.telegram_chat_id || '').trim();
          if (!recChatId || recChatId === chatId) continue;

          // Автоматически запоминаем отправителя как текущего активного собеседника для получателя!
          if (resolvedTargetType === 'direct') {
            await setPendingCommForUser(recChatId, recipient, {
              mode: 'direct',
              targetNodeId: String(user.id),
            });
          }

          if (botToken && mediaResult.photoFileId) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: recChatId,
                  photo: mediaResult.photoFileId,
                  caption: incomingHtml,
                  parse_mode: 'HTML',
                }),
              });
              continue;
            } catch {}
          } else if (botToken && mediaResult.documentFileId) {
            try {
              await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: recChatId,
                  document: mediaResult.documentFileId,
                  caption: incomingHtml,
                  parse_mode: 'HTML',
                }),
              });
              continue;
            } catch {}
          }

          await sendTelegramMessage(recChatId, incomingHtml);
        }

        // БЛОК 1 (Silent Live Bridge): Никаких текстовых отписок «✓ Доставлено...»!
        // Ставим нативную реакцию ⚡ на сообщение отправителя и держим чат идеально чистым.
        await reactToTelegramMessage(chatId, message?.message_id, '⚡');

        return res.status(200).send('OK');
      }

      // БЛОК 3.4: Пересылка внешнего сообщения или контакта (Forward-to-CRM / Task)
      const isForwarded = Boolean(
        message?.forward_from ||
          message?.forward_sender_name ||
          message?.forward_from_chat ||
          message?.contact
      );
      if (isForwarded && !rawText.startsWith('/')) {
        const fwdClientName =
          message?.contact?.first_name ||
          message?.forward_from?.first_name ||
          message?.forward_sender_name ||
          message?.forward_from_chat?.title ||
          'Внешний клиент';
        pendingFwdMap.set(chatId, {
          clientName: String(fwdClientName).trim(),
          text: rawText || message?.caption || 'Контакт из Telegram',
          phone: message?.contact?.phone_number || undefined,
        });
        await sendTelegramMessage(
          chatId,
          `Распознан внешний контакт (<b>${escapeHtml(
            String(fwdClientName).trim()
          )}</b>). Создать из сообщения:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '+ В новую сделку CRM', callback_data: 'fwd_to_lead' },
                  { text: '+ В задачу', callback_data: 'fwd_to_task' },
                ],
              ],
            },
          }
        );
        return res.status(200).send('OK');
      }

      const strippedCommandText = rawText.startsWith('/new ')
        ? rawText.slice(5).trim()
        : rawText;

      const isUrgent = strippedCommandText.startsWith('!');
      const cleanTitle = isUrgent ? strippedCommandText.slice(1).trim() : strippedCommandText;
      const taskPriority = isUrgent ? 'High' : 'Medium';

      if (!cleanTitle) {
        await sendTelegramMessage(
          chatId,
          'Укажите наименование задачи.',
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'Командное меню', callback_data: 'open_main_menu' }]],
            },
          }
        );
        return res.status(200).send('OK');
      }

      // Проверяем, было ли активировано делегирование задачи коллеге
      const delegatedTargetId =
        pendingDelegateMap.get(chatId) ||
        (typeof rawPerms.pending_delegate_to === 'string' ? rawPerms.pending_delegate_to : null);

      // БЛОК 3.4: Естественное распознавание имени/фамилии коллеги в тексте вне режима диалога
      if (!delegatedTargetId && !rawText.startsWith('/new')) {
        const nodesList = await loadCompanyNodes();
        const lowerInput = cleanTitle.toLowerCase();
        const matchedColleague = nodesList.find((emp: any) => {
          if (String(emp.id) === String(user.id)) return false;
          const parts = String(emp.name || '')
            .toLowerCase()
            .split(/\s+/)
            .filter((part) => part.length >= 4);
          return parts.some((token) => {
            const stem = token.length >= 5 ? token.slice(0, -1) : token;
            return lowerInput.includes(stem);
          });
        });

        if (matchedColleague) {
          pendingNatTextMap.set(chatId, cleanTitle);
          await sendTelegramMessage(
            chatId,
            `Нашел сотрудника <b>${escapeHtml(
              matchedColleague.name
            )}</b>. Отправить как сообщение или поставить задачу?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Отправить сообщение',
                      callback_data: `nat_msg_${matchedColleague.id}`,
                    },
                    {
                      text: 'Поставить задачу',
                      callback_data: `nat_task_${matchedColleague.id}`,
                    },
                  ],
                ],
              },
            }
          );
          return res.status(200).send('OK');
        }
      }

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
          department: targetAssigneeNode.department || null,
          owner_node_id: targetAssigneeNode.id,
          assigned_to: targetAssigneeNode.id,
          created_by: user.id,
        }
      );

      if (taskInsertError) {
        throw new Error(`Ошибка записи задачи: ${taskInsertError.message}`);
      }

      const taskActionRows: any[][] = [];
      if (createdTask?.id) {
        taskActionRows.push([
          { text: 'В работу', callback_data: `task_progress:${createdTask.id}` },
          { text: 'Выполнено', callback_data: `task_done:${createdTask.id}` },
        ]);
      }

      if (
        isDelegated &&
        targetAssigneeNode.telegram_chat_id &&
        String(targetAssigneeNode.telegram_chat_id).trim() !== chatId
      ) {
        const colleagueChatId = String(targetAssigneeNode.telegram_chat_id).trim();
        await sendTelegramMessage(
          colleagueChatId,
          `<b>Поручение</b> · ${escapeHtml(user.name)} (<i>${escapeHtml(
            user.role_type || 'Руководитель'
          )}</i>)\n${escapeHtml(cleanTitle)}`,
          {
            reply_markup: {
              inline_keyboard: taskActionRows,
            },
          }
        );
      }

      await sendTelegramMessage(
        chatId,
        isDelegated
          ? `✓ Задача поручена (<b>${escapeHtml(targetAssigneeNode.name || firstName)}</b>): <b>${escapeHtml(cleanTitle)}</b>`
          : `✓ Задача создана: <b>${escapeHtml(cleanTitle)}</b>`,
        {
          reply_markup: {
            inline_keyboard: [
              ...taskActionRows,
              [{ text: 'Командное меню', callback_data: 'open_main_menu' }],
            ],
          },
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
