import {
  CrmLead,
  LeadStage,
  PartnerNode,
  PartnerPlaybook,
  PartnerRank,
  TaskItem,
  TaskPriority,
  TaskStatus,
  ValuationInput,
  ValuationMetrics,
} from '../types/saas';

export function determinePartnerRank(totalPv: number): PartnerRank {
  if (totalPv >= 4000) return 'Супервайзор';
  if (totalPv >= 2500) return 'Успешный строитель';
  if (totalPv >= 500) return 'Старший консультант';
  return 'Консультант';
}

/**
 * Преобразует произвольный ID партнёра в валидный сегмент PostgreSQL ltree ([A-Za-z0-9_])
 */
export function sanitizeLtreeLabel(rawId: string): string {
  const cleaned = rawId.replace(/[^A-Za-z0-9_]/g, '_');
  return cleaned.startsWith('p_') ? cleaned : `p_${cleaned}`;
}

/**
 * Формирует материализованный путь ltree для нового партнёра:
 * Например: uplinePath = 'root.p_partner_1', childId = 'partner-5' -> 'root.p_partner_1.p_partner_5'
 */
export function buildChildLtreePath(
  uplinePath: string | null | undefined,
  childId: string
): string {
  const label = sanitizeLtreeLabel(childId);
  const base = uplinePath && uplinePath.trim().length > 0 ? uplinePath.trim() : 'root';
  return `${base}.${label}`;
}

/**
 * Аналог оператора PostgreSQL ltree `candidatePath <@ ancestorPath`
 */
export function isDescendantLtreePath(
  candidatePath: string,
  ancestorPath: string
): boolean {
  if (!candidatePath || !ancestorPath) return false;
  if (candidatePath === ancestorPath) return true;
  return candidatePath.startsWith(`${ancestorPath}.`);
}

/**
 * Вычисляет групповой объём (ГО) всех нижестоящих веток партнёра по дереву ltree
 */
export function computeDownlineGroupPv(
  partners: PartnerNode[],
  ancestorPath: string
): number {
  return partners
    .filter(
      (p) =>
        p.hierarchyPath &&
        p.hierarchyPath !== ancestorPath &&
        isDescendantLtreePath(p.hierarchyPath, ancestorPath)
    )
    .reduce((sum, p) => sum + p.personalPv, 0);
}

export function getNextTaskStatus(current: TaskStatus): TaskStatus {
  const order: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
  const idx = order.indexOf(current);
  if (idx === -1 || idx === order.length - 1) return 'done';
  return order[idx + 1];
}

export interface TaskFilterCriteria {
  search: string;
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  project: string | 'all';
}

export function filterTasks(tasks: TaskItem[], criteria: TaskFilterCriteria): TaskItem[] {
  const q = criteria.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (criteria.status !== 'all' && t.status !== criteria.status) return false;
    if (criteria.priority !== 'all' && t.priority !== criteria.priority) return false;
    if (criteria.project !== 'all' && t.project !== criteria.project) return false;
    if (q.length > 0) {
      const hay = `${t.code} ${t.title} ${t.description} ${t.assigneeName} ${t.project}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function computeTaskBoardMetrics(tasks: TaskItem[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const review = tasks.filter((t) => t.status === 'review').length;
  const todo = tasks.filter((t) => t.status === 'todo').length;
  const criticalCount = tasks.filter((t) => t.priority === 'critical' && t.status !== 'done').length;
  const totalPvImpact = tasks.reduce((sum, t) => sum + t.pvImpact, 0);
  const earnedPvImpact = tasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + t.pvImpact, 0);
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    done,
    inProgress,
    review,
    todo,
    criticalCount,
    totalPvImpact,
    earnedPvImpact,
    completionRate,
  };
}

export function instantiatePlaybookTasks(
  playbook: PartnerPlaybook,
  assigneeName: string,
  assigneeRole: string,
  existingTaskCount: number,
  baseDateIso: string = '2026-10-25'
): TaskItem[] {
  return playbook.tasksTemplate.map((tpl, index) => {
    const seq = existingTaskCount + index + 1;
    const baseDate = new Date(baseDateIso);
    baseDate.setDate(baseDate.getDate() + (index + 1) * 2);
    const dueDate = baseDate.toISOString().split('T')[0];

    return {
      id: `task-pb-${playbook.id}-${seq}-${ index }`,
      code: `PF-${100 + seq}`,
      title: tpl.title,
      description: tpl.description,
      status: 'todo',
      priority: tpl.priority,
      project: tpl.project,
      assigneeName,
      assigneeRole,
      dueDate,
      pvImpact: tpl.pvImpact,
      estimatedHours: tpl.estimatedHours,
      playbookSource: playbook.title,
      subtasks: tpl.subtasks.map((st, sIdx) => ({
        id: `sub-${seq}-${sIdx}`,
        title: st,
        completed: false,
      })),
    };
  });
}

export function convertLeadToPartner(
  lead: CrmLead,
  existingPartnersCount: number,
  existingTasksCount: number
): {
  updatedLead: CrmLead;
  newPartner: PartnerNode;
  onboardingTasks: TaskItem[];
} {
  const updatedLead: CrmLead = {
    ...lead,
    stage: 'partner_ready',
    convertedToPartner: true,
  };

  const initialPv = Math.max(lead.monthlyPv, 150);
  const newPartner: PartnerNode = {
    id: `partner-conv-${existingPartnersCount + 1}`,
    name: lead.name,
    city: lead.city,
    joinedDate: '2026-10-22',
    uplineName: lead.mentorName,
    personalPv: initialPv,
    groupPv: 0,
    targetPv: 500,
    activeClients: 1,
    onboardingCompletedSteps: 1,
    onboardingTotalSteps: 6,
    status: 'onboarding',
  };

  const onboardingTasks: TaskItem[] = [
    {
      id: `task-conv-${existingTasksCount + 1}`,
      code: `PF-${100 + existingTasksCount + 1}`,
      title: `Онбординг нового партнёра: ${lead.name}`,
      description: `Провести стартовую сессию, настроить личный кабинет и запустить список из 25 контактов для ${lead.name}.`,
      status: 'in_progress',
      priority: 'high',
      project: 'Запуск партнёров',
      assigneeName: lead.name,
      assigneeRole: 'Консультант (Новичок)',
      dueDate: '2026-10-26',
      pvImpact: 250,
      estimatedHours: 3,
      playbookSource: 'Авто-конверсия из CRM',
      subtasks: [
        { id: `sc-1-${existingTasksCount}`, title: 'Подписать партнёрское соглашение и получить ID', completed: true },
        { id: `sc-2-${existingTasksCount}`, title: 'Составить список первых 15 кандидатов на велнес-тест', completed: false },
        { id: `sc-3-${existingTasksCount}`, title: 'Запустить первый 10-дневный марафон с наставником', completed: false },
      ],
    },
    {
      id: `task-conv-${existingTasksCount + 2}`,
      code: `PF-${100 + existingTasksCount + 2}`,
      title: `Первые 500 PV квалификации: ${lead.name}`,
      description: `Вывести партнёра ${lead.name} на ступень Старшего консультанта через 5 клиентов марафона.`,
      status: 'todo',
      priority: 'medium',
      project: 'Квалификация PV',
      assigneeName: lead.mentorName,
      assigneeRole: 'Наставник ветки',
      dueDate: '2026-11-02',
      pvImpact: 350,
      estimatedHours: 5,
      playbookSource: 'Авто-конверсия из CRM',
      subtasks: [
        { id: `sc-4-${existingTasksCount}`, title: 'Провести 3 совместные тройные встречи с клиентами', completed: false },
        { id: `sc-5-${existingTasksCount}`, title: 'Проверить учёт повторных заказов в CRM', completed: false },
      ],
    },
  ];

  return {
    updatedLead,
    newPartner,
    onboardingTasks,
  };
}

export function getNextLeadStage(current: LeadStage): LeadStage {
  const order: LeadStage[] = [
    'contact',
    'consultation',
    'marathon',
    'repeat_client',
    'partner_ready',
  ];
  const idx = order.indexOf(current);
  if (idx === -1 || idx === order.length - 1) return 'partner_ready';
  return order[idx + 1];
}

export function calculateSaasValuation(input: ValuationInput): ValuationMetrics {
  const partnerMrrRub = Math.max(0, input.activePartnersCount * input.arpuMonthlyRub);
  const corporateMrrRub = Math.max(0, input.corporateEnterpriseSeats * input.corporateSeatPriceRub);
  const totalMrrRub = partnerMrrRub + corporateMrrRub;
  const arrRub = totalMrrRub * 12;

  // Вирусный сетевой рост через спонсорские ветки повышает Net Dollar Retention
  const expansionRateMonthly = 0.032; // +3.2% апсейл за счёт роста партнёров до Супервайзоров
  const churnRateDecimal = Math.min(0.25, Math.max(0.005, input.monthlyChurnPercent / 100));
  const netDollarRetentionPercent = Math.round(
    (1 + (expansionRateMonthly - churnRateDecimal) * 12) * 100
  );

  const grossMarginDecimal = Math.min(0.95, Math.max(0.4, input.grossMarginPercent / 100));
  const blendedArpu =
    input.activePartnersCount + input.corporateEnterpriseSeats > 0
      ? totalMrrRub / (input.activePartnersCount + input.corporateEnterpriseSeats)
      : input.arpuMonthlyRub;

  const ltvRub = Math.round((blendedArpu * grossMarginDecimal) / churnRateDecimal);
  const ltvCacRatio =
    input.cacRub > 0 ? Number((ltvRub / input.cacRub).toFixed(1)) : 10.0;

  // Мультипликатор оценки B2B2C SaaS зависит от NDR, доли корпоративных контрактов и LTV/CAC
  const enterpriseShare = totalMrrRub > 0 ? corporateMrrRub / totalMrrRub : 0;
  let baseMultiple = 5.5;
  if (netDollarRetentionPercent >= 115) baseMultiple += 2.0;
  else if (netDollarRetentionPercent >= 105) baseMultiple += 1.0;

  if (ltvCacRatio >= 5) baseMultiple += 1.2;
  if (enterpriseShare >= 0.3) baseMultiple += 1.5;

  const revenueMultiple = Number(baseMultiple.toFixed(1));
  const enterpriseValuationRub = Math.round(arrRub * revenueMultiple);
  const enterpriseValuationUsd = Math.round(enterpriseValuationRub / 92);

  const readinessScore = Math.min(
    99,
    Math.round(
      55 +
        Math.min(20, (input.activePartnersCount / 1500) * 20) +
        Math.min(15, enterpriseShare * 35) +
        (ltvCacRatio >= 4 ? 9 : 4)
    )
  );

  return {
    partnerMrrRub,
    corporateMrrRub,
    totalMrrRub,
    arrRub,
    netDollarRetentionPercent,
    ltvRub,
    ltvCacRatio,
    revenueMultiple,
    enterpriseValuationRub,
    enterpriseValuationUsd,
    readinessScore,
  };
}
