export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskClass = 'client_action' | 'internal_ticket';
export type UserRole = 'SUPERADMIN' | 'NETWORK_PARTNER' | 'INTERNAL_IT';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskCommentItem {
  id: string;
  taskId: string;
  authorPartnerId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  parentTaskId?: string | null;
  code: string;
  title: string;
  description: string;
  task_class?: TaskClass;
  targetDepartment?: string; // Например: 'IT Support', 'Платформа и интеграции', 'HR и обучение'
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  assigneeName: string;
  assigneeRole: string;
  dueDate: string;
  pvImpact: number;
  estimatedHours: number;
  subtasks: SubtaskItem[];
  playbookSource?: string;
  clientScript?: string;
  clientPhone?: string;
  telegramUsername?: string;
  comments?: TaskCommentItem[];
}

export type LeadStage =
  | 'contact'
  | 'consultation'
  | 'marathon'
  | 'repeat_client'
  | 'partner_ready';

export interface CrmLead {
  id: string;
  name: string;
  phone: string;
  city: string;
  stage: LeadStage;
  monthlyPv: number;
  dealValueRub: number;
  programName: string;
  mentorName: string;
  lastActivity: string;
  convertedToPartner?: boolean;
}

export type PartnerRank =
  | 'Консультант'
  | 'Старший консультант'
  | 'Успешный строитель'
  | 'Супервайзор';

export interface PartnerNode {
  id: string;
  uplineId?: string | null;
  hierarchyPath?: string;
  name: string;
  city: string;
  joinedDate: string;
  uplineName: string;
  personalPv: number;
  groupPv: number;
  targetPv: number;
  activeClients: number;
  onboardingCompletedSteps: number;
  onboardingTotalSteps: number;
  status: 'active' | 'onboarding' | 'risk';
}

export interface PartnerPlaybook {
  id: string;
  title: string;
  category: string;
  durationDays: number;
  description: string;
  expectedPvGain: number;
  tasksTemplate: Array<{
    title: string;
    description: string;
    priority: TaskPriority;
    project: string;
    pvImpact: number;
    estimatedHours: number;
    subtasks: string[];
  }>;
}

export interface WhiteLabelPreset {
  id: string;
  brandName: string;
  industryLabel: string;
  volumeUnitLabel: string;
  partnerTitleLabel: string;
  clientEventLabel: string;
  primaryColorHex: string;
  corporateBuyerExample: string;
}

export interface ValuationInput {
  activePartnersCount: number;
  arpuMonthlyRub: number;
  corporateEnterpriseSeats: number;
  corporateSeatPriceRub: number;
  monthlyChurnPercent: number;
  cacRub: number;
  grossMarginPercent: number;
}

export interface ValuationMetrics {
  partnerMrrRub: number;
  corporateMrrRub: number;
  totalMrrRub: number;
  arrRub: number;
  netDollarRetentionPercent: number;
  ltvRub: number;
  ltvCacRatio: number;
  revenueMultiple: number;
  enterpriseValuationRub: number;
  enterpriseValuationUsd: number;
  readinessScore: number;
}

export interface ClientCycleItem {
  id: string;
  ownerPartnerId: string;
  ownerPartnerName: string;
  clientFirstName: string;
  phoneRaw: string;
  telegramUsername?: string;
  productSku: string;
  productName: string;
  cycleDays: number;
  cycleStartedAt: string;
  cycleEndDate: string;
  pvValue: number;
  isActive: boolean;
}

export interface PlaybookStepNode {
  stepId: string;
  title: string;
  scriptTemplate: string;
  kpiValue: number;
  customData?: Record<string, string | number>;
  transitions: {
    success: string | null;
    fallback?: string | null;
  };
}

export interface PlaybookStateGraph {
  id: string;
  code: string;
  title: string;
  initialStepId: string;
  nodes: Record<string, PlaybookStepNode>;
}

export type TedCloudViewerRole = 'network_partner' | 'internal_it' | 'network_mentor';
export type TedCloudRoutingMode = 'DEPARTMENT_QUEUE' | 'DIRECT_ASSIGNMENT';
export type TedCloudDevStage = 'QUEUED' | 'IN_CODE_REVIEW' | 'DEPLOYED';

export interface OrganizationNodeItem {
  id: string;
  displayName: string;
  nodeScope: 'INTERNAL_DEPT' | 'EXTERNAL_NETWORK';
  roleCode: 'internal_it' | 'internal_hr' | 'network_leader' | 'network_partner';
  treePath: string;
  kpiValue: number;
  customData: Record<string, string | number | boolean>;
}

export interface SmartCopilotTask {
  id: string;
  idempotencyKey: string;
  task_class?: TaskClass;
  targetDepartment?: string;
  priority?: TaskPriority;
  ownerPartnerId: string;
  ownerPartnerName: string;
  clientId: string;
  clientFirstName: string;
  phoneRaw: string;
  telegramUsername?: string;
  productSku: string;
  productName: string;
  cycleDays: number;
  daysRemaining: number;
  pvImpact: number;
  customData?: Record<string, string | number>;
  playbookStepId?: string;
  nextStepIdOnSuccess?: string | null;
  empatheticScript: string;
  status: 'pending' | 'completed_reordered' | 'snoozed';
  dueDate: string;
  comments?: TaskCommentItem[];
  targetDepartmentPath?: string;
  assigneeNodeId?: string | null;
  assigneeNodeName?: string | null;
  routingMode?: TedCloudRoutingMode;
  itDevStage?: TedCloudDevStage;
  gitBranch?: string;
}
