export type AccessLevel = 'root' | 'manager' | 'member' | 'observer';

export interface EmployeePermissions {
  tasks_view_all: boolean;
  tasks_assign: boolean;
  crm_view: boolean;
  crm_edit: boolean;
  team_manage: boolean;
  data_export: boolean;
  billing_admin: boolean;
}

export const PERMISSION_KEYS: readonly (keyof EmployeePermissions)[] = [
  'tasks_view_all',
  'tasks_assign',
  'crm_view',
  'crm_edit',
  'team_manage',
  'data_export',
  'billing_admin',
];

export type TaskPriority = 'Low' | 'Medium' | 'High';

export type TaskStatus = 'Todo' | 'In Progress' | 'Done';

export type CrmLeadStatus = 'New' | 'Negotiation' | 'Won' | 'Lost';

export type SubscriptionPlanTier = 'Trial' | 'Business' | 'Enterprise';

export type PaymentGatewayRegion = 'RU' | 'GLOBAL';

export type DashboardSection =
  | 'overview'
  | 'tasks'
  | 'crm'
  | 'team'
  | 'profile'
  | 'workspace';

export interface Company {
  id: string;
  name: string;
  plan?: SubscriptionPlanTier;
  payment_region?: PaymentGatewayRegion;
  created_at?: string;
}

export interface OrganizationNode {
  id: string;
  company_id: string;
  user_id?: string | null;
  name: string;
  role_type: string;
  department?: string | null;
  email?: string | null;
  telegram_chat_id?: string | null;
  invite_code?: string | null;
  access_level?: AccessLevel;
  permissions?: EmployeePermissions;
  parent_id?: string | null;
  tree_path?: string | null;
  kpi_value?: number;
  created_at?: string;
}

export interface TaskRecord {
  id: string;
  company_id: string;
  owner_node_id?: string | null;
  title: string;
  type: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to?: string | null;
  created_by?: string | null;
  description?: string | null;
  notes?: string | null;
  due_date?: string | null;
  created_at?: string;
}

export interface CrmLeadRecord {
  id: string;
  company_id: string;
  owner_node_id?: string | null;
  title?: string;
  client_name: string;
  full_name?: string;
  amount: number;
  deal_value?: number;
  contact?: string | null;
  phone?: string | null;
  telegram_chat_id?: string | null;
  status: CrmLeadStatus;
  stage?: string;
  source?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface DashboardKpis {
  totalDealValue: number;
  activeTasksCount: number;
  conversionRatePercent: number;
  employeesCount: number;
}

export function normalizeAccessLevel(
  rawLevel?: string | null,
  roleType?: string | null
): AccessLevel {
  const cleanRole = String(roleType || '').trim().toUpperCase();
  if (cleanRole === 'SUPERADMIN' || cleanRole === 'ROOT') {
    return 'root';
  }
  const cleanLevel = String(rawLevel || '').trim().toLowerCase();
  if (cleanLevel === 'root') return 'root';
  if (cleanLevel === 'manager') return 'manager';
  if (cleanLevel === 'observer' || cleanLevel === 'viewer') return 'observer';
  return 'member';
}

export function getDefaultPermissionsForAccessLevel(level: AccessLevel): EmployeePermissions {
  switch (level) {
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

export function normalizeEmployeePermissions(
  accessLevel?: string | null,
  rawPermissions?: Partial<EmployeePermissions> | Record<string, any> | string | null,
  roleType?: string | null
): { access_level: AccessLevel; permissions: EmployeePermissions } {
  const normalizedLevel = normalizeAccessLevel(accessLevel, roleType);

  // Для root / SUPERADMIN все 7 прав всегда true
  if (normalizedLevel === 'root') {
    return {
      access_level: 'root',
      permissions: getDefaultPermissionsForAccessLevel('root'),
    };
  }

  const defaults = getDefaultPermissionsForAccessLevel(normalizedLevel);
  if (!rawPermissions) {
    return { access_level: normalizedLevel, permissions: defaults };
  }

  let parsed: Record<string, any> = {};
  if (typeof rawPermissions === 'string') {
    try {
      parsed = JSON.parse(rawPermissions);
    } catch {
      parsed = {};
    }
  } else if (typeof rawPermissions === 'object') {
    parsed = rawPermissions as Record<string, any>;
  }

  return {
    access_level: normalizedLevel,
    permissions: {
      tasks_view_all:
        typeof parsed.tasks_view_all === 'boolean'
          ? parsed.tasks_view_all
          : defaults.tasks_view_all,
      tasks_assign:
        typeof parsed.tasks_assign === 'boolean'
          ? parsed.tasks_assign
          : defaults.tasks_assign,
      crm_view:
        typeof parsed.crm_view === 'boolean' ? parsed.crm_view : defaults.crm_view,
      crm_edit:
        typeof parsed.crm_edit === 'boolean' ? parsed.crm_edit : defaults.crm_edit,
      team_manage:
        typeof parsed.team_manage === 'boolean'
          ? parsed.team_manage
          : defaults.team_manage,
      data_export:
        typeof parsed.data_export === 'boolean'
          ? parsed.data_export
          : defaults.data_export,
      billing_admin:
        typeof parsed.billing_admin === 'boolean'
          ? parsed.billing_admin
          : defaults.billing_admin,
    },
  };
}

export function generateCorporateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TC-${suffix}`;
}

export function computeDashboardKpis(
  leads: Array<Partial<CrmLeadRecord>>,
  tasks: Array<Partial<TaskRecord>>,
  nodes: Array<Partial<OrganizationNode>>
): DashboardKpis {
  const totalDealValue = leads.reduce((sum, l) => {
    const val = Number(l.amount ?? l.deal_value ?? 0);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);

  const activeTasksCount = tasks.filter((t) => {
    const st = String(t.status || '').toLowerCase();
    return st !== 'done';
  }).length;

  const wonOrQualifiedCount = leads.filter((l) => {
    const st = String(l.status || l.stage || '').toLowerCase();
    return st === 'won' || st === 'qualified';
  }).length;

  const conversionRatePercent =
    leads.length > 0 ? Math.round((wonOrQualifiedCount / leads.length) * 100) : 0;

  return {
    totalDealValue,
    activeTasksCount,
    conversionRatePercent,
    employeesCount: nodes.length,
  };
}
