export type AccessLevel = 'root' | 'manager' | 'member' | 'viewer';

export interface EmployeePermissions {
  canAssignTasks: boolean;
  canManageCrm: boolean;
  canManageTeam: boolean;
  canDeleteAndSettings: boolean;
}

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
  /**
   * Свободная должность сотрудника (например: «Главный инженер», «Финансовый директор», «Юрист»)
   */
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
  created_at?: string;
}

export interface DashboardKpis {
  totalDealValue: number;
  activeTasksCount: number;
  conversionRatePercent: number;
  employeesCount: number;
}

export function getDefaultPermissionsForAccessLevel(level: AccessLevel): EmployeePermissions {
  switch (level) {
    case 'root':
      return {
        canAssignTasks: true,
        canManageCrm: true,
        canManageTeam: true,
        canDeleteAndSettings: true,
      };
    case 'manager':
      return {
        canAssignTasks: true,
        canManageCrm: true,
        canManageTeam: true,
        canDeleteAndSettings: false,
      };
    case 'member':
      return {
        canAssignTasks: true,
        canManageCrm: true,
        canManageTeam: false,
        canDeleteAndSettings: false,
      };
    case 'viewer':
    default:
      return {
        canAssignTasks: false,
        canManageCrm: false,
        canManageTeam: false,
        canDeleteAndSettings: false,
      };
  }
}

export function normalizeEmployeePermissions(
  accessLevel?: string | null,
  rawPermissions?: Partial<EmployeePermissions> | string | null
): { access_level: AccessLevel; permissions: EmployeePermissions } {
  const validLevels: AccessLevel[] = ['root', 'manager', 'member', 'viewer'];
  const normalizedLevel: AccessLevel = validLevels.includes(accessLevel as AccessLevel)
    ? (accessLevel as AccessLevel)
    : 'member';

  const defaults = getDefaultPermissionsForAccessLevel(normalizedLevel);
  if (!rawPermissions) {
    return { access_level: normalizedLevel, permissions: defaults };
  }

  let parsed: Partial<EmployeePermissions> = {};
  if (typeof rawPermissions === 'string') {
    try {
      parsed = JSON.parse(rawPermissions);
    } catch {
      parsed = {};
    }
  } else if (typeof rawPermissions === 'object') {
    parsed = rawPermissions;
  }

  return {
    access_level: normalizedLevel,
    permissions: {
      canAssignTasks:
        typeof parsed.canAssignTasks === 'boolean' ? parsed.canAssignTasks : defaults.canAssignTasks,
      canManageCrm:
        typeof parsed.canManageCrm === 'boolean' ? parsed.canManageCrm : defaults.canManageCrm,
      canManageTeam:
        typeof parsed.canManageTeam === 'boolean' ? parsed.canManageTeam : defaults.canManageTeam,
      canDeleteAndSettings:
        typeof parsed.canDeleteAndSettings === 'boolean'
          ? parsed.canDeleteAndSettings
          : defaults.canDeleteAndSettings,
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
