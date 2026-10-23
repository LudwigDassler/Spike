'use server';

import { getSupabaseAdmin } from '../lib/supabase/admin';
import {
  CrmLeadRecord,
  OrganizationNode,
  OrganizationRoleType,
  TaskPriorityType,
  TaskRecord,
} from '../types/database';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface CreateTaskInput {
  company_id?: string | null;
  title: string;
  priority: TaskPriorityType;
  assigned_to?: string | null;
  created_by?: string | null;
}

export interface CreateEmployeeInput {
  company_id?: string | null;
  name: string;
  telegram_chat_id: string;
  role_type: OrganizationRoleType;
}

export interface CreateDealInput {
  company_id?: string | null;
  owner_node_id?: string | null;
  full_name: string;
  deal_value: number;
  phone?: string | null;
}

/**
 * Server Action: Гарантирует наличие company_id.
 * Если company_id не передан с клиента, находит первую компанию в БД или создаёт дефолтную организацию.
 */
async function resolveOrCreateCompanyId(
  providedCompanyId?: string | null
): Promise<string> {
  if (providedCompanyId && providedCompanyId.trim()) {
    return providedCompanyId.trim();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingCompany } = await supabaseAdmin
    .from('companies')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingCompany?.id) {
    return String(existingCompany.id);
  }

  const { data: createdCompany, error: createError } = await supabaseAdmin
    .from('companies')
    .insert({ name: 'TedCloud Enterprise' })
    .select('id')
    .single();

  if (createError || !createdCompany) {
    throw new Error(
      `Не удалось определить или создать компанию (companies): ${
        createError?.message || 'Unknown error'
      }`
    );
  }

  return String(createdCompany.id);
}

/**
 * Server Action: Создание задачи в таблице `tasks` с обходом RLS через Admin-клиент.
 */
export async function createTaskAction(
  input: CreateTaskInput
): Promise<ActionResult<TaskRecord>> {
  try {
    const trimmedTitle = input.title?.trim();
    if (!trimmedTitle) {
      return { success: false, error: 'Введите описание задачи.' };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const companyId = await resolveOrCreateCompanyId(input.company_id);

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        company_id: companyId,
        title: trimmedTitle,
        priority: input.priority || 'medium',
        assigned_to: input.assigned_to?.trim() || null,
        created_by: input.created_by?.trim() || null,
        status: 'new',
        type: 'client',
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Не удалось создать задачу в таблице tasks.',
      };
    }

    return {
      success: true,
      data: data as TaskRecord,
    };
  } catch (error: any) {
    console.error('[createTaskAction] Error:', error);
    return {
      success: false,
      error: error?.message || 'Внутренняя ошибка сервера при создании задачи.',
    };
  }
}

/**
 * Server Action: Создание сотрудника в таблице `organization_nodes` с обходом RLS через Admin-клиент.
 */
export async function createEmployeeAction(
  input: CreateEmployeeInput
): Promise<ActionResult<OrganizationNode>> {
  try {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return { success: false, error: 'Укажите имя сотрудника.' };
    }

    const trimmedTelegramId = String(input.telegram_chat_id ?? '').trim();
    if (!trimmedTelegramId) {
      return { success: false, error: 'Укажите Telegram ID сотрудника.' };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const companyId = await resolveOrCreateCompanyId(input.company_id);
    const safePathId =
      trimmedTelegramId.replace(/[^a-zA-Z0-9_]/g, '') || Date.now().toString();

    let { data, error } = await supabaseAdmin
      .from('organization_nodes')
      .insert({
        company_id: companyId,
        name: trimmedName,
        telegram_chat_id: trimmedTelegramId,
        role_type: input.role_type || 'Specialist',
        tree_path: `tedcloud.emp_${safePathId}`,
      })
      .select('*')
      .single();

    // Фоллбэк, если в схеме таблицы organization_nodes отсутствует колонка tree_path
    if (error && error.message?.includes('tree_path')) {
      const fallbackRes = await supabaseAdmin
        .from('organization_nodes')
        .insert({
          company_id: companyId,
          name: trimmedName,
          telegram_chat_id: trimmedTelegramId,
          role_type: input.role_type || 'Specialist',
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
          'Не удалось создать сотрудника в таблице organization_nodes.',
      };
    }

    return {
      success: true,
      data: data as OrganizationNode,
    };
  } catch (error: any) {
    console.error('[createEmployeeAction] Error:', error);
    return {
      success: false,
      error:
        error?.message || 'Внутренняя ошибка сервера при создании сотрудника.',
    };
  }
}

/**
 * Server Action: Создание сделки в таблице `crm_leads` с обходом RLS через Admin-клиент.
 */
export async function createDealAction(
  input: CreateDealInput
): Promise<ActionResult<CrmLeadRecord>> {
  try {
    const trimmedClientName = input.full_name?.trim();
    if (!trimmedClientName) {
      return { success: false, error: 'Укажите название клиента.' };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const companyId = await resolveOrCreateCompanyId(input.company_id);

    const { data, error } = await supabaseAdmin
      .from('crm_leads')
      .insert({
        company_id: companyId,
        owner_node_id: input.owner_node_id?.trim() || null,
        full_name: trimmedClientName,
        deal_value: Number(input.deal_value) || 0,
        phone: input.phone?.trim() || null,
        stage: 'new',
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        success: false,
        error:
          error?.message || 'Не удалось сохранить сделку в таблице crm_leads.',
      };
    }

    return {
      success: true,
      data: data as CrmLeadRecord,
    };
  } catch (error: any) {
    console.error('[createDealAction] Error:', error);
    return {
      success: false,
      error:
        error?.message || 'Внутренняя ошибка сервера при создании сделки.',
    };
  }
}
