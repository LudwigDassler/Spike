export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export type OrganizationRoleType =
  | 'Owner'
  | 'Manager'
  | 'Specialist'
  | 'Observer'
  | 'SUPERADMIN'
  | 'INTERNAL_IT'
  | 'NETWORK_PARTNER';

export type LeadStage =
  | 'new'
  | 'qualified'
  | 'trial_marathon'
  | 'repeat_client'
  | 'partner_ready'
  | 'archived';

export type TaskType = 'client' | 'ticket';

export type TaskStatusType = 'new' | 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriorityType = 'low' | 'medium' | 'high' | 'critical';

/**
 * 1. Таблица `companies` — рабочее пространство компании-арендатора (Tenant)
 */
export interface Company {
  id: string;
  name: string;
  subscription_status: SubscriptionStatus;
  created_at: string;
}

/**
 * 2. Таблица `organization_nodes` — сотрудники и иерархические узлы компании
 */
export interface OrganizationNode {
  id: string;
  company_id: string | null;
  auth_user_id?: string | null;
  name: string;
  role_type: OrganizationRoleType;
  tree_path: string;
  telegram_chat_id: string | null;
  kpi_value: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * 3. Таблица `crm_leads` — сделки и лиды воронки продаж
 */
export interface CrmLeadRecord {
  id: string;
  company_id: string | null;
  owner_node_id: string | null;
  full_name: string;
  phone: string | null;
  telegram_chat_id: string | null;
  stage: LeadStage;
  description: string | null;
  deal_value: number;
  created_at: string;
  updated_at?: string;
}

/**
 * 4. Таблица `tasks` — клиентские задачи и внутренние тикеты
 */
export interface TaskRecord {
  id: string;
  company_id: string | null;
  type: TaskType;
  title: string;
  status: TaskStatusType;
  priority: TaskPriorityType;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  created_at: string;
  updated_at?: string;
}

export type DashboardSection = 'overview' | 'leads' | 'tasks' | 'team';

export interface DashboardKpiSummary {
  totalDealValue: number;
  activeTasksCount: number;
  conversionRatePercent: number;
  employeesCount: number;
}

/**
 * Вычисляет универсальные B2B-метрики: Сумма сделок, Активные задачи, Конверсия, Сотрудники.
 */
export function computeDashboardKpis(
  leads: CrmLeadRecord[],
  tasks: TaskRecord[],
  nodes: OrganizationNode[]
): DashboardKpiSummary {
  const totalDealValue = leads.reduce(
    (sum, lead) => sum + (Number(lead.deal_value) || 0),
    0
  );

  const activeTasksCount = tasks.filter((task) => task.status !== 'done').length;

  const convertedLeadsCount = leads.filter(
    (lead) =>
      lead.stage === 'qualified' ||
      lead.stage === 'repeat_client' ||
      lead.stage === 'partner_ready'
  ).length;

  const conversionRatePercent =
    leads.length > 0
      ? Math.round((convertedLeadsCount / leads.length) * 100)
      : 0;

  return {
    totalDealValue,
    activeTasksCount,
    conversionRatePercent,
    employeesCount: nodes.length,
  };
}
