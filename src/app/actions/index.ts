"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  CrmLeadRecord,
  OrganizationNode,
  OrganizationRoleType,
  TaskPriorityType,
  TaskRecord,
} from '../../types/database';

export type ActionResult<T = any> =
  | { success: true; data: T; error?: null }
  | { success: false; error: string; data?: null };

export interface CreateTaskPayload {
  company_id?: string | null;
  title: string;
  priority: TaskPriorityType;
  assigned_to?: string | null;
  created_by?: string | null;
}

export interface CreateEmployeePayload {
  company_id?: string | null;
  name: string;
  telegram_chat_id: string;
  role_type: OrganizationRoleType;
}

export interface CreateDealPayload {
  company_id?: string | null;
  owner_node_id?: string | null;
  full_name: string;
  deal_value: number;
  phone?: string | null;
}

/**
 * Server Action: Создание задачи в таблице `tasks`.
 * Вся инициализация Supabase и чтение process.env происходят строго внутри функции.
 */
export async function createTaskAction(
  payload: CreateTaskPayload
): Promise<ActionResult<TaskRecord>> {
  try {
    console.log('ENV CHECK:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error:
          'Серверная ошибка: Не заданы переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY на сервере.',
      };
    }

    const trimmedTitle = payload.title?.trim();
    if (!trimmedTitle) {
      return { success: false, error: 'Введите описание задачи.' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let companyId = payload.company_id?.trim() || null;
    if (!companyId) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) {
        companyId = String(existingCompany.id);
      } else {
        const { data: newCompany, error: companyErr } = await supabase
          .from('companies')
          .insert({ name: 'TedCloud Workspace' })
          .select('id')
          .single();

        if (companyErr || !newCompany) {
          return {
            success: false,
            error: `Не удалось создать компанию в БД: ${companyErr?.message || 'Нет данных'}`,
          };
        }
        companyId = String(newCompany.id);
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        company_id: companyId,
        title: trimmedTitle,
        priority: payload.priority || 'medium',
        assigned_to: payload.assigned_to?.trim() || null,
        created_by: payload.created_by?.trim() || null,
        status: 'new',
        type: 'client',
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'БД не вернула созданную задачу.',
      };
    }

    return {
      success: true,
      data: data as TaskRecord,
    };
  } catch (error: any) {
    console.error('[createTaskAction] Fatal Error:', error);
    return {
      success: false,
      error: error?.message || 'Неизвестная серверная ошибка при создании задачи.',
    };
  }
}

/**
 * Server Action: Создание сотрудника в таблице `organization_nodes`.
 * Вся инициализация Supabase и чтение process.env происходят строго внутри функции.
 */
export async function createEmployeeAction(
  payload: CreateEmployeePayload
): Promise<ActionResult<OrganizationNode>> {
  try {
    console.log('ENV CHECK:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error:
          'Серверная ошибка: Не заданы переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY на сервере.',
      };
    }

    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
      return { success: false, error: 'Укажите имя сотрудника.' };
    }

    const trimmedTelegramId = String(payload.telegram_chat_id ?? '').trim();
    if (!trimmedTelegramId) {
      return { success: false, error: 'Укажите Telegram ID сотрудника.' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let companyId = payload.company_id?.trim() || null;
    if (!companyId) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) {
        companyId = String(existingCompany.id);
      } else {
        const { data: newCompany, error: companyErr } = await supabase
          .from('companies')
          .insert({ name: 'TedCloud Workspace' })
          .select('id')
          .single();

        if (companyErr || !newCompany) {
          return {
            success: false,
            error: `Не удалось создать компанию в БД: ${companyErr?.message || 'Нет данных'}`,
          };
        }
        companyId = String(newCompany.id);
      }
    }

    const safePathId =
      trimmedTelegramId.replace(/[^a-zA-Z0-9_]/g, '') || Date.now().toString();

    let { data, error } = await supabase
      .from('organization_nodes')
      .insert({
        company_id: companyId,
        name: trimmedName,
        telegram_chat_id: trimmedTelegramId,
        role_type: payload.role_type || 'Specialist',
        tree_path: `tedcloud.emp_${safePathId}`,
      })
      .select('*')
      .single();

    if (error && error.message?.includes('tree_path')) {
      const fallbackRes = await supabase
        .from('organization_nodes')
        .insert({
          company_id: companyId,
          name: trimmedName,
          telegram_chat_id: trimmedTelegramId,
          role_type: payload.role_type || 'Specialist',
        })
        .select('*')
        .single();

      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error || !data) {
      return {
        success: false,
        error:
          error?.message ||
          'БД отклонила создание сотрудника в таблице organization_nodes.',
      };
    }

    return {
      success: true,
      data: data as OrganizationNode,
    };
  } catch (error: any) {
    console.error('[createEmployeeAction] Fatal Error:', error);
    return {
      success: false,
      error:
        error?.message || 'Неизвестная серверная ошибка при создании сотрудника.',
    };
  }
}

/**
 * Server Action: Создание сделки в таблице `crm_leads`.
 * Вся инициализация Supabase и чтение process.env происходят строго внутри функции.
 */
export async function createDealAction(
  payload: CreateDealPayload
): Promise<ActionResult<CrmLeadRecord>> {
  try {
    console.log('ENV CHECK:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error:
          'Серверная ошибка: Не заданы переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY на сервере.',
      };
    }

    const trimmedClient = payload.full_name?.trim();
    if (!trimmedClient) {
      return { success: false, error: 'Укажите название клиента.' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let companyId = payload.company_id?.trim() || null;
    if (!companyId) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) {
        companyId = String(existingCompany.id);
      } else {
        const { data: newCompany, error: companyErr } = await supabase
          .from('companies')
          .insert({ name: 'TedCloud Workspace' })
          .select('id')
          .single();

        if (companyErr || !newCompany) {
          return {
            success: false,
            error: `Не удалось создать компанию в БД: ${companyErr?.message || 'Нет данных'}`,
          };
        }
        companyId = String(newCompany.id);
      }
    }

    const { data, error } = await supabase
      .from('crm_leads')
      .insert({
        company_id: companyId,
        owner_node_id: payload.owner_node_id?.trim() || null,
        full_name: trimmedClient,
        deal_value: Number(payload.deal_value) || 0,
        phone: payload.phone?.trim() || null,
        stage: 'new',
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'БД не вернула созданную сделку.',
      };
    }

    return {
      success: true,
      data: data as CrmLeadRecord,
    };
  } catch (error: any) {
    console.error('[createDealAction] Fatal Error:', error);
    return {
      success: false,
      error: error?.message || 'Неизвестная серверная ошибка при создании сделки.',
    };
  }
}
