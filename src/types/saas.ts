export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  assigneeName: string;
  assigneeRole: string;
  dueDate: string;
  pvImpact: number; // Очки объёма (PV) или KPI-эффект
  estimatedHours: number;
  subtasks: SubtaskItem[];
  playbookSource?: string;
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
  volumeUnitLabel: string; // например "PV (Очки Объёма)" или "Баллы KPI"
  partnerTitleLabel: string; // например "Независимый Партнёр" или "Франчайзи-агент"
  clientEventLabel: string; // например "Марафон стройности 10д" или "Демо-спринт клиента"
  primaryColorHex: string;
  corporateBuyerExample: string;
}

export interface ValuationInput {
  activePartnersCount: number;
  arpuMonthlyRub: number; // Средний чек подписки одного партнёра в месяц (₽)
  corporateEnterpriseSeats: number; // Корпоративные лицензии (оплачивает головная компания)
  corporateSeatPriceRub: number;
  monthlyChurnPercent: number;
  cacRub: number; // Стоимость привлечения одного партнёра через аплайн-сеть
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
