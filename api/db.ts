import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Серверное in-memory хранилище (используется ТОЛЬКО в локальном превью-контейнере,
// если в окружении еще не заданы NEXT_PUBLIC_SUPABASE_URL и ключи Supabase).
// На Vercel, где переменные окружения заданы, все запросы идут строго в Supabase.
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

    // 1. GET: Чтение всех сущностей (или конкретного сотрудника по telegram_chat_id)
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
          leads: localStore.leads,
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
        leads: leadsRes.data || [],
        tasks: tasksRes.data || [],
      });
    }

    // 2. POST: Создание записей (tasks, organization_nodes, crm_leads, companies) и мутации
    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {};

      const action = body.action || 'create';
      const entity = body.entity || body.table || '';
      const payload = body.payload || body.data || body;

      // 2.1. Обновление стадии сделки
      if (action === 'update_lead_stage') {
        const { id, stage } = payload;
        if (!supabase) {
          localStore.leads = localStore.leads.map((l) =>
            l.id === id ? { ...l, stage } : l
          );
          const updated = localStore.leads.find((l) => l.id === id) || null;
          return res.status(200).json({ ok: true, data: updated });
        }

        const { data, error } = await supabase
          .from('crm_leads')
          .update({ stage })
          .eq('id', id)
          .select('*')
          .single();

        if (error) {
          console.error('[API /api/db update_lead_stage] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true, data });
      }

      // 2.2. Удаление сделки
      if (action === 'delete_lead') {
        const { id } = payload;
        if (!supabase) {
          localStore.leads = localStore.leads.filter((l) => l.id !== id);
          return res.status(200).json({ ok: true });
        }

        const { error } = await supabase
          .from('crm_leads')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[API /api/db delete_lead] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true });
      }

      // 2.3. Переключение статуса задачи
      if (action === 'toggle_task') {
        const { id, status } = payload;
        if (!supabase) {
          localStore.tasks = localStore.tasks.map((t) =>
            t.id === id ? { ...t, status } : t
          );
          const updated = localStore.tasks.find((t) => t.id === id) || null;
          return res.status(200).json({ ok: true, data: updated });
        }

        const { data, error } = await supabase
          .from('tasks')
          .update({ status })
          .eq('id', id)
          .select('*')
          .single();

        if (error) {
          console.error('[API /api/db toggle_task] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true, data });
      }

      // 2.4. Удаление задачи
      if (action === 'delete_task') {
        const { id } = payload;
        if (!supabase) {
          localStore.tasks = localStore.tasks.filter((t) => t.id !== id);
          return res.status(200).json({ ok: true });
        }

        const { error } = await supabase.from('tasks').delete().eq('id', id);

        if (error) {
          console.error('[API /api/db delete_task] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true });
      }

      // 2.5. Удаление сотрудника
      if (action === 'delete_node') {
        const { id } = payload;
        if (!supabase) {
          localStore.nodes = localStore.nodes.filter((n) => n.id !== id);
          return res.status(200).json({ ok: true });
        }

        const { error } = await supabase
          .from('organization_nodes')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[API /api/db delete_node] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }
        return res.status(200).json({ ok: true });
      }

      // 2.6. Создание задачи (tasks)
      if (entity === 'task' || entity === 'tasks') {
        const title = String(payload.title || '').trim();
        if (!title) {
          return res
            .status(400)
            .json({ ok: false, error: 'Введите описание задачи.' });
        }

        const companyId = await ensureCompanyId(supabase, payload.company_id);

        if (!supabase) {
          const created = {
            id: crypto.randomUUID(),
            company_id: companyId,
            title,
            priority: payload.priority || 'medium',
            assigned_to: payload.assigned_to || null,
            created_by: payload.created_by || null,
            status: payload.status || 'new',
            type: payload.type || 'client',
            created_at: new Date().toISOString(),
          };
          localStore.tasks.unshift(created);
          return res.status(200).json({ ok: true, data: created });
        }

        const { data, error } = await supabase
          .from('tasks')
          .insert({
            company_id: companyId,
            title,
            priority: payload.priority || 'medium',
            assigned_to: payload.assigned_to || null,
            created_by: payload.created_by || null,
            status: payload.status || 'new',
            type: payload.type || 'client',
          })
          .select('*')
          .single();

        if (error) {
          console.error('[API /api/db create task] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }

        return res.status(200).json({ ok: true, data });
      }

      // 2.7. Создание сотрудника (organization_nodes)
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

      // 2.8. Создание сделки (crm_leads)
      if (entity === 'deal' || entity === 'lead' || entity === 'crm_leads') {
        const fullName = String(payload.full_name || '').trim();
        if (!fullName) {
          return res
            .status(400)
            .json({ ok: false, error: 'Укажите название клиента.' });
        }

        const companyId = await ensureCompanyId(supabase, payload.company_id);

        if (!supabase) {
          const created = {
            id: crypto.randomUUID(),
            company_id: companyId,
            owner_node_id: payload.owner_node_id || null,
            full_name: fullName,
            deal_value: Number(payload.deal_value) || 0,
            phone: payload.phone ? String(payload.phone).trim() : null,
            stage: payload.stage || 'new',
            created_at: new Date().toISOString(),
          };
          localStore.leads.unshift(created);
          return res.status(200).json({ ok: true, data: created });
        }

        const { data, error } = await supabase
          .from('crm_leads')
          .insert({
            company_id: companyId,
            owner_node_id: payload.owner_node_id || null,
            full_name: fullName,
            deal_value: Number(payload.deal_value) || 0,
            phone: payload.phone ? String(payload.phone).trim() : null,
            stage: payload.stage || 'new',
          })
          .select('*')
          .single();

        if (error) {
          console.error('[API /api/db create deal] Error:', error);
          return res.status(400).json({ ok: false, error: error.message });
        }

        return res.status(200).json({ ok: true, data });
      }

      // 2.9. Создание компании (companies)
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
        error: `Неизвестный тип сущности или действия: entity="${entity}", action="${action}"`,
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
