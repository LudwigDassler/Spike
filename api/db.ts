import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface LocalServerStore {
  companies: Array<Record<string, any>>;
  nodes: Array<Record<string, any>>;
  leads: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
}

const localStore: LocalServerStore = {
  companies: [],
  nodes: [],
  leads: [],
  tasks: [],
};

function getAdminSupabaseOrNull(): SupabaseClient | null {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function normalizeLeadRecord(raw: Record<string, any>): Record<string, any> {
  const clientName = raw.client_name ?? raw.full_name ?? 'Без названия';
  const amount =
    raw.amount !== undefined && raw.amount !== null
      ? Number(raw.amount) || 0
      : Number(raw.deal_value) || 0;
  const contact = raw.contact ?? raw.phone ?? raw.description ?? null;
  const status = raw.status ?? raw.stage ?? 'lead';

  return {
    ...raw,
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

async function ensureCompanyId(
  supabase: SupabaseClient | null,
  providedCompanyId?: string | null
): Promise<string> {
  if (providedCompanyId && String(providedCompanyId).trim()) {
    return String(providedCompanyId).trim();
  }

  if (!supabase) {
    if (localStore.companies.length === 0) {
      localStore.companies.push({
        id: crypto.randomUUID(),
        name: 'TedCloud Workspace',
        subscription_status: 'active',
        created_at: new Date().toISOString(),
      });
    }
    return String(localStore.companies[0].id);
  }

  const { data: existingCompany, error: findError } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`Ошибка чтения таблицы companies: ${findError.message}`);
  }

  if (existingCompany?.id) {
    return String(existingCompany.id);
  }

  const { data: createdCompany, error: createError } = await supabase
    .from('companies')
    .insert({ name: 'TedCloud Workspace' })
    .select('id')
    .single();

  if (createError || !createdCompany) {
    throw new Error(
      `Не удалось автоматически создать запись в companies: ${
        createError?.message || 'Нет данных'
      }`
    );
  }

  return String(createdCompany.id);
}

/**
 * Киллер-фича: Отправка Telegram Push-уведомления сотруднику при назначении задачи
 * с инлайн-кнопками [⚡️ В работу] и [✅ Выполнено].
 */
async function sendTaskAssignmentPush(
  supabase: SupabaseClient | null,
  task: { id: string; title: string; priority?: string | null; assigned_to?: string | null }
) {
  const assignedToId = task.assigned_to ? String(task.assigned_to).trim() : '';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!assignedToId || !botToken) {
    return;
  }

  try {
    let telegramChatId: string | null = null;

    if (!supabase) {
      const localAssignee = localStore.nodes.find((n) => n.id === assignedToId);
      telegramChatId = localAssignee?.telegram_chat_id
        ? String(localAssignee.telegram_chat_id)
        : null;
    } else {
      const { data: assigneeNode } = await supabase
        .from('organization_nodes')
        .select('id, name, telegram_chat_id')
        .eq('id', assignedToId)
        .maybeSingle();

      telegramChatId = assigneeNode?.telegram_chat_id
        ? String(assigneeNode.telegram_chat_id).trim()
        : null;
    }

    if (!telegramChatId) {
      return;
    }

    const priorityLabel = task.priority || 'Medium';
    const messageText =
      '🔔 Вам назначена новая задача!\n\n📌 ' +
      task.title +
      '\n⚡ Приоритет: ' +
      priorityLabel;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: messageText,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⚡️ В работу',
                callback_data: 'task_progress_' + task.id,
              },
              {
                text: '✅ Выполнено',
                callback_data: 'task_done_' + task.id,
              },
            ],
          ],
        },
      }),
    });
  } catch (pushError) {
    console.error('[API /api/db] Ошибка отправки Telegram Push исполнителю:', pushError);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getAdminSupabaseOrNull();

    // =========================================================================
    // 1. GET: Получение списков tasks, organization_nodes, crm_leads, companies
    // =========================================================================
    if (req.method === 'GET') {
      const telegramChatId = req.query?.telegram_chat_id;

      if (!supabase) {
        if (telegramChatId) {
          const foundNode =
            localStore.nodes.find(
              (n) => String(n.telegram_chat_id) === String(telegramChatId)
            ) || null;
          const foundCompany = foundNode
            ? localStore.companies.find((c) => c.id === foundNode.company_id) ||
              localStore.companies[0] ||
              null
            : null;
          return res
            .status(200)
            .json({ ok: true, node: foundNode, company: foundCompany });
        }

        return res.status(200).json({
          ok: true,
          company: localStore.companies[0] || null,
          companies: localStore.companies,
          nodes: localStore.nodes,
          leads: localStore.leads.map(normalizeLeadRecord),
          tasks: localStore.tasks,
        });
      }

      if (telegramChatId) {
        const { data: node, error: nodeErr } = await supabase
          .from('organization_nodes')
          .select('*')
          .eq('telegram_chat_id', String(telegramChatId))
          .maybeSingle();

        if (nodeErr) {
          console.error('[API /api/db GET telegram_chat_id] Error:', nodeErr);
          return res.status(400).json({ ok: false, error: nodeErr.message });
        }

        let company = null;
        if (node?.company_id) {
          const { data: compData } = await supabase
            .from('companies')
            .select('*')
            .eq('id', node.company_id)
            .maybeSingle();
          company = compData || null;
        }

        return res.status(200).json({ ok: true, node: node || null, company });
      }

      const [companiesRes, nodesRes, leadsRes, tasksRes] = await Promise.all([
        supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('organization_nodes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_leads')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      const firstError =
        companiesRes.error ||
        nodesRes.error ||
        leadsRes.error ||
        tasksRes.error;

      if (firstError) {
        console.error('[API /api/db GET] Database Error:', firstError);
        return res.status(400).json({ ok: false, error: firstError.message });
      }

      const companies = companiesRes.data || [];
      return res.status(200).json({
        ok: true,
        company: companies[0] || null,
        companies,
        nodes: nodesRes.data || [],
        leads: (leadsRes.data || []).map(normalizeLeadRecord),
        tasks: tasksRes.data || [],
      });
    }

    // =========================================================================
    // 2. PATCH: Обновление status, priority, assigned_to у задач и status у сделок
    // =========================================================================
    if (req.method === 'PATCH') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {};

      const table = body.table || body.entity || '';
      const id = body.id || body.payload?.id;
      const updates = body.updates || body.payload || body;

      if (!id) {
        return res
          .status(400)
          .json({ ok: false, error: 'Не указан id записи для PATCH.' });
      }

      // 2.1. Обновление задачи в таблице tasks
      if (table === 'tasks' || table === 'task') {
        const patchFields: Record<string, any> = {};
        if (updates.status !== undefined) patchFields.status = updates.status;
        if (updates.priority !== undefined)
          patchFields.priority = updates.priority;
        if (updates.assigned_to !== undefined)
          patchFields.assigned_to = updates.assigned_to || null;
        if (updates.title !== undefined) patchFields.title = updates.title;

        if (!supabase) {
          localStore.tasks = localStore.tasks.map((t) =>
            t.id === id ? { ...t, ...patchFields } : t
          );
          const updated = localStore.tasks.find((t) => t.id === id) || null;
          if (patchFields.assigned_to && updated) {
            await sendTaskAssignmentPush(null, updated as any);
          }
          return res.status(200).json({ ok: true, data: updated });
        }

        let { data, error } = await supabase
          .from('tasks')
          .update(patchFields)
          .eq('id', id)
          .select('*')
          .single();

        // Фоллбэк регистра priority ('High' -> 'high'), если в БД lowercase CHECK constraint
        if (
          error &&
          patchFields.priority &&
          error.message?.toLowerCase().includes('priority')
        ) {
          const retryRes = await supabase
            .from('tasks')
            .update({
              ...patchFields,
              priority: String(patchFields.priority).toLowerCase(),
            })
            .eq('id', id)
            .select('*')
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) {
          console.error('[API /api/db PATCH tasks] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }

        if (patchFields.assigned_to && data) {
          await sendTaskAssignmentPush(supabase, data);
        }

        return res.status(200).json({ ok: true, data });
      }

      // 2.2. Обновление статуса сделки в таблице crm_leads
      if (table === 'crm_leads' || table === 'deal' || table === 'lead') {
        const nextStatus = updates.status ?? updates.stage;
        if (!nextStatus) {
          return res.status(400).json({
            ok: false,
            error: 'Не передан новый статус сделки (status).',
          });
        }

        if (!supabase) {
          localStore.leads = localStore.leads.map((l) =>
            l.id === id
              ? normalizeLeadRecord({ ...l, status: nextStatus, stage: nextStatus })
              : l
          );
          const updated = localStore.leads.find((l) => l.id === id) || null;
          return res.status(200).json({ ok: true, data: updated });
        }

        // Сначала пробуем обновить колонку status (новая схема crm_leads)
        let { data, error } = await supabase
          .from('crm_leads')
          .update({ status: nextStatus })
          .eq('id', id)
          .select('*')
          .single();

        // Если в БД колонка называется stage — делаем автоматический фоллбэк
        if (error) {
          const legacyStageMap: Record<string, string> = {
            lead: 'new',
            negotiation: 'trial_marathon',
            qualified: 'qualified',
            won: 'partner_ready',
          };
          const mappedStage = legacyStageMap[nextStatus] || nextStatus;
          const retryStage = await supabase
            .from('crm_leads')
            .update({ stage: mappedStage })
            .eq('id', id)
            .select('*')
            .single();

          if (!retryStage.error) {
            data = retryStage.data;
            error = null;
          }
        }

        if (error) {
          console.error('[API /api/db PATCH crm_leads] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }

        return res
          .status(200)
          .json({ ok: true, data: normalizeLeadRecord(data || {}) });
      }

      return res.status(400).json({
        ok: false,
        error: `Неподдерживаемая таблица для PATCH: "${table}"`,
      });
    }

    // =========================================================================
    // 3. DELETE: Удаление записи по id и table
    // =========================================================================
    if (req.method === 'DELETE') {
      const body =
        typeof req.body === 'string' && req.body
          ? JSON.parse(req.body)
          : req.body || {};

      const table =
        req.query?.table || body.table || body.entity || '';
      const id = req.query?.id || body.id || body.payload?.id;

      if (!table || !id) {
        return res.status(400).json({
          ok: false,
          error: 'Для DELETE необходимо передать параметры table и id.',
        });
      }

      const resolvedTable =
        table === 'task'
          ? 'tasks'
          : table === 'deal' || table === 'lead'
          ? 'crm_leads'
          : table === 'employee' || table === 'node'
          ? 'organization_nodes'
          : table;

      if (!supabase) {
        if (resolvedTable === 'tasks') {
          localStore.tasks = localStore.tasks.filter((t) => t.id !== id);
        } else if (resolvedTable === 'crm_leads') {
          localStore.leads = localStore.leads.filter((l) => l.id !== id);
        } else if (resolvedTable === 'organization_nodes') {
          localStore.nodes = localStore.nodes.filter((n) => n.id !== id);
        }
        return res.status(200).json({ ok: true, id, table: resolvedTable });
      }

      const { error } = await supabase
        .from(resolvedTable)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[API /api/db DELETE ${resolvedTable}] Error:`, error);
        return res.status(400).json({ ok: false, error: error.message });
      }

      return res.status(200).json({ ok: true, id, table: resolvedTable });
    }

    // =========================================================================
    // 4. POST: Создание записей (tasks + Telegram Push, crm_leads, organization_nodes)
    // =========================================================================
    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {};

      const action = body.action || 'create';
      const entity = body.entity || body.table || '';
      const payload = body.payload || body.data || body;

      // Обратная совместимость для POST-экшенов обновления/удаления
      if (action === 'update_lead_stage') {
        req.method = 'PATCH';
        req.body = {
          table: 'crm_leads',
          id: payload.id,
          status: payload.status || payload.stage,
        };
        return handler(req, res);
      }
      if (action === 'toggle_task') {
        req.method = 'PATCH';
        req.body = {
          table: 'tasks',
          id: payload.id,
          status: payload.status,
        };
        return handler(req, res);
      }
      if (
        action === 'delete_lead' ||
        action === 'delete_task' ||
        action === 'delete_node'
      ) {
        req.method = 'DELETE';
        req.body = {
          table:
            action === 'delete_lead'
              ? 'crm_leads'
              : action === 'delete_task'
              ? 'tasks'
              : 'organization_nodes',
          id: payload.id,
        };
        return handler(req, res);
      }

      // 4.1. Создание задачи (tasks) + Telegram Push при назначении assigned_to
      if (entity === 'task' || entity === 'tasks') {
        const title = String(payload.title || '').trim();
        if (!title) {
          return res
            .status(400)
            .json({ ok: false, error: 'Введите описание задачи.' });
        }

        const companyId = await ensureCompanyId(supabase, payload.company_id);
        const assignedTo = payload.assigned_to
          ? String(payload.assigned_to).trim()
          : null;
        const priority = payload.priority || 'Medium';
        const status = payload.status || 'new';

        if (!supabase) {
          const newTask = {
            id: crypto.randomUUID(),
            company_id: companyId,
            title,
            priority,
            assigned_to: assignedTo,
            created_by: payload.created_by || null,
            status,
            type: payload.type || 'client',
            created_at: new Date().toISOString(),
          };
          localStore.tasks.unshift(newTask);

          if (assignedTo) {
            await sendTaskAssignmentPush(null, newTask);
          }

          return res.status(200).json({ ok: true, data: newTask });
        }

        let { data: newTask, error } = await supabase
          .from('tasks')
          .insert({
            company_id: companyId,
            title,
            priority,
            assigned_to: assignedTo,
            created_by: payload.created_by || null,
            status,
            type: payload.type || 'client',
          })
          .select('*')
          .single();

        // Фоллбэк: если в таблице tasks нет колонки type или created_by, либо priority ожидает lowercase
        if (error) {
          const minimalTaskInsert = await supabase
            .from('tasks')
            .insert({
              company_id: companyId,
              title,
              priority: String(priority).toLowerCase(),
              assigned_to: assignedTo,
              status,
            })
            .select('*')
            .single();

          if (!minimalTaskInsert.error) {
            newTask = minimalTaskInsert.data;
            error = null;
          }
        }

        if (error || !newTask) {
          console.error('[API /api/db create task] Error:', error);
          return res.status(400).json({
            ok: false,
            error: error?.message || 'Ошибка создания задачи в таблице tasks.',
          });
        }

        // Киллер-фича: если указан assigned_to, отправляем Telegram Push с инлайн-кнопками
        if (assignedTo) {
          await sendTaskAssignmentPush(supabase, {
            id: String(newTask.id),
            title: String(newTask.title || title),
            priority: String(newTask.priority || priority),
            assigned_to: assignedTo,
          });
        }

        return res.status(200).json({ ok: true, data: newTask });
      }

      // 4.2. Создание сотрудника (organization_nodes)
      if (entity === 'employee' || entity === 'organization_nodes') {
        const name = String(payload.name || '').trim();
        const telegramChatId = String(payload.telegram_chat_id || '').trim();
        const requestedRole = payload.role_type || 'Specialist';

        if (!name || !telegramChatId) {
          return res.status(400).json({
            ok: false,
            error: 'Имя сотрудника и Telegram ID обязательны.',
          });
        }

        const companyId = await ensureCompanyId(supabase, payload.company_id);
        const safePathId =
          telegramChatId.replace(/[^a-zA-Z0-9_]/g, '') ||
          Date.now().toString();

        if (!supabase) {
          const created = {
            id: crypto.randomUUID(),
            company_id: companyId,
            name,
            telegram_chat_id: telegramChatId,
            role_type: requestedRole,
            tree_path: `tedcloud.emp_${safePathId}`,
            kpi_value: 0,
            created_at: new Date().toISOString(),
          };
          localStore.nodes.unshift(created);
          return res.status(200).json({ ok: true, data: created });
        }

        let { data, error } = await supabase
          .from('organization_nodes')
          .insert({
            company_id: companyId,
            name,
            telegram_chat_id: telegramChatId,
            role_type: requestedRole,
            tree_path: `tedcloud.emp_${safePathId}`,
          })
          .select('*')
          .single();

        if (error && error.message?.includes('tree_path')) {
          const retryRes = await supabase
            .from('organization_nodes')
            .insert({
              company_id: companyId,
              name,
              telegram_chat_id: telegramChatId,
              role_type: requestedRole,
            })
            .select('*')
            .single();

          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) {
          console.error('[API /api/db create employee] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }

        return res.status(200).json({ ok: true, data });
      }

      // 4.3. Создание сделки (crm_leads: поддержка client_name, amount, contact, status)
      if (entity === 'deal' || entity === 'lead' || entity === 'crm_leads') {
        const clientName = String(
          payload.client_name || payload.full_name || ''
        ).trim();
        if (!clientName) {
          return res
            .status(400)
            .json({ ok: false, error: 'Укажите название клиента.' });
        }

        const amount =
          payload.amount !== undefined
            ? Number(payload.amount) || 0
            : Number(payload.deal_value) || 0;
        const contact =
          payload.contact !== undefined
            ? String(payload.contact || '').trim() || null
            : payload.phone
            ? String(payload.phone).trim()
            : null;
        const status = payload.status || payload.stage || 'lead';
        const companyId = await ensureCompanyId(supabase, payload.company_id);

        if (!supabase) {
          const created = normalizeLeadRecord({
            id: crypto.randomUUID(),
            company_id: companyId,
            owner_node_id: payload.owner_node_id || null,
            client_name: clientName,
            amount,
            contact,
            status,
            created_at: new Date().toISOString(),
          });
          localStore.leads.unshift(created);
          return res.status(200).json({ ok: true, data: created });
        }

        // Попытка 1: Вставка с новыми колонками (client_name, amount, contact, status)
        let { data, error } = await supabase
          .from('crm_leads')
          .insert({
            company_id: companyId,
            client_name: clientName,
            amount,
            contact,
            status,
          })
          .select('*')
          .single();

        // Попытка 2: Если в БД также обязательна колонка full_name или используется старая схема
        if (error) {
          const combinedAttempt = await supabase
            .from('crm_leads')
            .insert({
              company_id: companyId,
              client_name: clientName,
              full_name: clientName,
              amount,
              deal_value: amount,
              contact,
              phone: contact,
              status,
              stage: status === 'lead' ? 'new' : status,
            })
            .select('*')
            .single();

          if (!combinedAttempt.error) {
            data = combinedAttempt.data;
            error = null;
          } else {
            const legacyAttempt = await supabase
              .from('crm_leads')
              .insert({
                company_id: companyId,
                owner_node_id: payload.owner_node_id || null,
                full_name: clientName,
                deal_value: amount,
                phone: contact,
                stage: status === 'lead' ? 'new' : status,
              })
              .select('*')
              .single();

            if (!legacyAttempt.error) {
              data = legacyAttempt.data;
              error = null;
            }
          }
        }

        if (error || !data) {
          console.error('[API /api/db create deal] Error:', error);
          return res.status(400).json({
            ok: false,
            error: error?.message || 'Ошибка создания сделки в crm_leads.',
          });
        }

        return res
          .status(200)
          .json({ ok: true, data: normalizeLeadRecord(data) });
      }

      // 4.4. Создание компании (companies)
      if (entity === 'company' || entity === 'companies') {
        const name = String(payload.name || 'TedCloud Workspace').trim();
        if (!supabase) {
          const created = {
            id: crypto.randomUUID(),
            name,
            subscription_status: 'active',
            created_at: new Date().toISOString(),
          };
          localStore.companies.unshift(created);
          return res.status(200).json({ ok: true, data: created });
        }

        const { data, error } = await supabase
          .from('companies')
          .insert({ name })
          .select('*')
          .single();

        if (error) {
          console.error('[API /api/db create company] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }

        return res.status(200).json({ ok: true, data });
      }

      return res.status(400).json({
        ok: false,
        error: `Неизвестный тип сущности: entity="${entity}"`,
      });
    }

    return res
      .status(405)
      .json({ ok: false, error: `Метод ${req.method} не поддерживается` });
  } catch (error: any) {
    console.error('[API /api/db] Fatal Error:', error);
    return res.status(400).json({
      ok: false,
      error: error?.message || 'Внутренняя ошибка сервера в /api/db',
    });
  }
}
