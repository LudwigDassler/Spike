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
  | 'lead'
  | 'negotiation'
  | 'qualified'
  | 'won'
  | 'new'
  | 'trial_marathon'
  | 'repeat_client'
  | 'partner_ready'
  | 'archived';

export type TaskType = 'client' | 'ticket';

export type TaskStatusType = 'new' | 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriorityType =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

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
 * Поддерживает как новые колонки (client_name, amount, contact, status),
 * так и обратную совместимость (full_name, deal_value, phone, stage).
 */
export interface CrmLeadRecord {
  id: string;
  company_id: string | null;
  owner_node_id?: string | null;
  client_name?: string;
  full_name: string;
  amount?: number;
  deal_value: number;
  contact?: string | null;
  phone: string | null;
  telegram_chat_id?: string | null;
  status?: LeadStage;
  stage: LeadStage;
  description?: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * 4. Таблица `tasks` — задачи рабочего пространства
 */
export interface TaskRecord {
  id: string;
  company_id: string | null;
  type?: TaskType;
  title: string;
  status: TaskStatusType;
  priority: TaskPriorityType;
  assigned_to: string | null;
  created_by?: string | null;
  due_date?: string | null;
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

export function getLeadClientName(lead: Partial<CrmLeadRecord>): string {
  return lead.client_name || lead.full_name || 'Без названия';
}

export function getLeadAmount(lead: Partial<CrmLeadRecord>): number {
  if (lead.amount !== undefined && lead.amount !== null) {
    return Number(lead.amount) || 0;
  }
  return Number(lead.deal_value) || 0;
}

export function getLeadContact(lead: Partial<CrmLeadRecord>): string {
  return lead.contact || lead.phone || lead.description || '—';
}

export function getLeadStatus(lead: Partial<CrmLeadRecord>): LeadStage {
  const raw = lead.status || lead.stage || 'lead';
  if (raw === 'new') return 'lead';
  if (raw === 'trial_marathon') return 'negotiation';
  if (raw === 'partner_ready' || raw === 'repeat_client') return 'won';
  return raw;
}

export function isHighPriority(priority?: string | null): boolean {
  const norm = String(priority || '').toLowerCase();
  return norm === 'high' || norm === 'critical';
}

export function normalizePriorityLabel(
  priority?: string | null
): 'High' | 'Medium' | 'Low' {
  const norm = String(priority || '').toLowerCase();
  if (norm === 'high' || norm === 'critical') return 'High';
  if (norm === 'low') return 'Low';
  return 'Medium';
}

/**
 * Вычисляет универсальные B2B-метрики: Сумма сделок, Активные задачи, Конверсия (процент закрытых сделок), Сотрудники.
 */
export function computeDashboardKpis(
  leads: CrmLeadRecord[],
  tasks: TaskRecord[],
  nodes: OrganizationNode[]
): DashboardKpiSummary {
  const totalDealValue = leads.reduce(
    (sum, lead) => sum + getLeadAmount(lead),
    0
  );

  const activeTasksCount = tasks.filter(
    (task) => task.status !== 'done'
  ).length;

  const wonLeadsCount = leads.filter((lead) => {
    const st = String(lead.status || lead.stage || '').toLowerCase();
    return (
      st === 'won' ||
      st === 'closed' ||
      st === 'partner_ready' ||
      st === 'repeat_client' ||
      st === 'qualified'
    );
  }).length;

  const conversionRatePercent =
    leads.length > 0 ? Math.round((wonLeadsCount / leads.length) * 100) : 0;

  return {
    totalDealValue,
    activeTasksCount,
    conversionRatePercent,
    employeesCount: nodes.length,
  };
}
