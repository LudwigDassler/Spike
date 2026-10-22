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

/**
 * Защита базы от кражи (Privacy by Design / RLS-маскирование на клиенте и сервере):
 * Если карточку просматривает владелец клиента (ownerPartnerId === viewerPartnerId),
 * возвращается полный номер. Если карточку смотрит вышестоящий наставник — номер маскируется (+7 *** ***-**-10).
 */
export function maskPhoneForRls(
  rawPhone: string,
  ownerPartnerId: string,
  viewerPartnerId: string
): {
  displayPhone: string;
  isMasked: boolean;
} {
  if (ownerPartnerId && viewerPartnerId && ownerPartnerId === viewerPartnerId) {
    return {
      displayPhone: rawPhone,
      isMasked: false,
    };
  }

  const digits = rawPhone.replace(/\D/g, '');
  const lastTwo = digits.length >= 2 ? digits.slice(-2) : '00';
  return {
    displayPhone: `+7 *** ***-**-${lastTwo}`,
    isMasked: true,
  };
}

/**
 * Детерминированный ключ идемпотентности для исключения дублей при перезапуске pg_cron воркера
 */
export function buildRefillIdempotencyKey(
  clientId: string,
  productSku: string,
  cycleEndDateIso: string
): string {
  return `refill:${clientId}:${productSku}:${cycleEndDateIso}`;
}

/**
 * Генерация заботливого («Anti-Cringe») скрипта для клиента без давления холодных продаж
 */
export function buildEmpatheticRefillScript(
  clientFirstName: string,
  productName: string,
  daysRemaining: number
): string {
  const daysWord =
    daysRemaining === 1 ? '1 день' : daysRemaining <= 4 ? `${daysRemaining} дня` : `${daysRemaining} дней`;
  return `${clientFirstName}, привет! 🌿 Смотрю по нашему дневнику, твоя баночка «${productName}» подходит к концу примерно через ${daysWord}. Как твоё самочувствие и лёгкость по утрам? Давай закажем свежую заранее, чтобы не прерывать твой ритм, или попробуем новый вкус?`;
}

/**
 * Идемпотентный воркер Refill Engine: проверяет 21-дневные циклы потребления
 * и за 0..3 дня до конца генерирует фокус-задачу (с защитой через idempotencyKey)
 */
export function runRefillEngineIdempotent(
  cycles: import('../types/saas').ClientCycleItem[],
  existingTasks: import('../types/saas').SmartCopilotTask[],
  referenceDateIso: string = '2026-10-22'
): {
  createdCount: number;
  skippedDuplicatesCount: number;
  tasks: import('../types/saas').SmartCopilotTask[];
} {
  const existingKeys = new Set(existingTasks.map((t) => t.idempotencyKey));
  const refTime = new Date(`${referenceDateIso}T00:00:00Z`).getTime();
  const newlyCreated: import('../types/saas').SmartCopilotTask[] = [];
  let skippedDuplicatesCount = 0;

  for (const cycle of cycles) {
    if (!cycle.isActive) continue;
    const endTime = new Date(`${cycle.cycleEndDate}T00:00:00Z`).getTime();
    const diffDays = Math.round((endTime - refTime) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 3) {
      const idempotencyKey = buildRefillIdempotencyKey(
        cycle.id,
        cycle.productSku,
        cycle.cycleEndDate
      );

      if (existingKeys.has(idempotencyKey)) {
        skippedDuplicatesCount += 1;
        continue;
      }

      existingKeys.add(idempotencyKey);
      newlyCreated.push({
        id: `copilot-task-${cycle.id}-${cycle.cycleEndDate}`,
        idempotencyKey,
        ownerPartnerId: cycle.ownerPartnerId,
        ownerPartnerName: cycle.ownerPartnerName,
        clientId: cycle.id,
        clientFirstName: cycle.clientFirstName,
        phoneRaw: cycle.phoneRaw,
        telegramUsername: cycle.telegramUsername,
        productSku: cycle.productSku,
        productName: cycle.productName,
        cycleDays: cycle.cycleDays,
        daysRemaining: diffDays,
        pvImpact: cycle.pvValue,
        playbookStepId: 'step_1_warm_touch',
        nextStepIdOnSuccess: 'step_2_taste_check',
        customData: { vertical: 'wellness_franchise', cycleDays: cycle.cycleDays },
        empatheticScript: buildEmpatheticRefillScript(
          cycle.clientFirstName,
          cycle.productName,
          diffDays
        ),
        status: 'pending',
        dueDate: referenceDateIso,
        comments: [
          {
            id: `cmt-init-${cycle.id}`,
            taskId: `copilot-task-${cycle.id}-${cycle.cycleEndDate}`,
            authorPartnerId: 'partner-1',
            authorName: 'Алина Соколова',
            authorRole: 'Наставник ветки',
            body: 'Сделай мягкое касание в Telegram по готовому скрипту, не предлагай сразу каталог.',
            createdAt: 'Сегодня, 09:30',
          },
        ],
      });
    }
  }

  return {
    createdCount: newlyCreated.length,
    skippedDuplicatesCount,
    tasks: [...newlyCreated, ...existingTasks],
  };
}

/**
 * Шаг 2: Граф состояний универсального Playbook (JSONB State Machine)
 * Вместо генерации 30 задач на месяц вперёд хранит переходы и выдаёт строго по 1 задаче Just-in-Time
 */
export const UNIVERSAL_PLAYBOOK_GRAPH: import('../types/saas').PlaybookStateGraph = {
  id: 'pb-graph-universal-01',
  code: 'JIT_CLIENT_RETENTION_FLOW',
  title: 'Умный онбординг и удержание клиента (Just-in-Time Граф)',
  initialStepId: 'step_1_warm_touch',
  nodes: {
    step_1_warm_touch: {
      stepId: 'step_1_warm_touch',
      title: 'Шаг 1/3: Мягкое касание за 3 дня до конца цикла',
      scriptTemplate:
        '{{clientName}}, привет! 🌿 Смотрю по нашему трекеру, «{{productName}}» скоро заканчивается. Как твоя динамика и самочувствие на этой неделе?',
      kpiValue: 25,
      transitions: {
        success: 'step_2_taste_check',
        fallback: 'step_1_retry',
      },
    },
    step_2_taste_check: {
      stepId: 'step_2_taste_check',
      title: 'Шаг 2/3: Подбор обновлённой программы (Just-in-Time)',
      scriptTemplate:
        '{{clientName}}, супер! Давай на следующие 21 день оставим «{{productName}}» как базу, но добавим новый вкус, чтобы не приедалось. Оформить доставку на привычный адрес?',
      kpiValue: 50,
      transitions: {
        success: 'step_3_referral_invite',
        fallback: 'step_2_taste_check',
      },
    },
    step_3_referral_invite: {
      stepId: 'step_3_referral_invite',
      title: 'Шаг 3/3: Приглашение с подругой (Партнёрский рычаг)',
      scriptTemplate:
        '{{clientName}}, заказ в пути! Кстати, в понедельник стартует закрытая фокус-группа на 10 дней. Если позовёшь с собой одного человека — для тебя участие с бонусной привилегией 25%. Кого запишем?',
      kpiValue: 100,
      transitions: {
        success: null,
        fallback: null,
      },
    },
  },
};

/**
 * Серверный метод Just-in-Time генерации следующей задачи по триггеру выполнения текущего шага State Machine
 */
export function advancePlaybookStepJustInTime(params: {
  completedTask: import('../types/saas').SmartCopilotTask;
  outcome?: 'success' | 'fallback';
  existingTasks: import('../types/saas').SmartCopilotTask[];
  graph?: import('../types/saas').PlaybookStateGraph;
}): {
  nextTask: import('../types/saas').SmartCopilotTask | null;
  nextStepId: string | null;
  tasks: import('../types/saas').SmartCopilotTask[];
} {
  const graph = params.graph || UNIVERSAL_PLAYBOOK_GRAPH;
  const outcome = params.outcome || 'success';
  const currentStepId = params.completedTask.playbookStepId || graph.initialStepId;
  const currentNode = graph.nodes[currentStepId];

  const updatedList = params.existingTasks.map((t) =>
    t.id === params.completedTask.id
      ? { ...t, status: 'completed_reordered' as const }
      : t
  );

  if (!currentNode) {
    return { nextTask: null, nextStepId: null, tasks: updatedList };
  }

  const nextStepId =
    outcome === 'success'
      ? currentNode.transitions.success
      : currentNode.transitions.fallback || null;

  if (!nextStepId || !graph.nodes[nextStepId]) {
    return { nextTask: null, nextStepId: null, tasks: updatedList };
  }

  const nextNode = graph.nodes[nextStepId];
  const jitIdempotencyKey = `jit:${params.completedTask.clientId}:${nextNode.stepId}`;

  // Защита от дублей: если задача этого шага уже сгенерирована, не дублируем
  const alreadyExists = updatedList.find((t) => t.idempotencyKey === jitIdempotencyKey);
  if (alreadyExists) {
    return { nextTask: alreadyExists, nextStepId, tasks: updatedList };
  }

  const renderedScript = nextNode.scriptTemplate
    .replace(/\{\{clientName\}\}/g, params.completedTask.clientFirstName)
    .replace(/\{\{productName\}\}/g, params.completedTask.productName);

  const nextTask: import('../types/saas').SmartCopilotTask = {
    id: `copilot-jit-${params.completedTask.clientId}-${nextNode.stepId}`,
    idempotencyKey: jitIdempotencyKey,
    ownerPartnerId: params.completedTask.ownerPartnerId,
    ownerPartnerName: params.completedTask.ownerPartnerName,
    clientId: params.completedTask.clientId,
    clientFirstName: params.completedTask.clientFirstName,
    phoneRaw: params.completedTask.phoneRaw,
    telegramUsername: params.completedTask.telegramUsername,
    productSku: params.completedTask.productSku,
    productName: `${params.completedTask.productName} · ${nextNode.title}`,
    cycleDays: params.completedTask.cycleDays,
    daysRemaining: params.completedTask.daysRemaining,
    pvImpact: nextNode.kpiValue,
    playbookStepId: nextNode.stepId,
    nextStepIdOnSuccess: nextNode.transitions.success,
    customData: {
      ...(params.completedTask.customData || {}),
      jitGeneratedFrom: currentStepId,
    },
    empatheticScript: renderedScript,
    status: 'pending',
    dueDate: params.completedTask.dueDate,
    comments: [
      {
        id: `cmt-jit-${Date.now()}`,
        taskId: `copilot-jit-${params.completedTask.clientId}-${nextNode.stepId}`,
        authorPartnerId: 'partner-1',
        authorName: 'Система JIT Playbook',
        authorRole: 'State Machine',
        body: `Задача создана автоматически (Just-in-Time) после закрытия шага «${currentStepId}».`,
        createdAt: 'Только что',
      },
    ],
  };

  return {
    nextTask,
    nextStepId,
    tasks: [nextTask, ...updatedList],
  };
}

/**
 * Шаг 1: Гибридное дерево organization_nodes (ltree), где в одной БД сосуществуют
 * внутренние отделы (tedcloud.internal.it, tedcloud.internal.hr) и внешняя партнёрская сеть (tedcloud.network.leader_1)
 */
export const TEDCLOUD_HYBRID_ORG_NODES: import('../types/saas').OrganizationNodeItem[] = [
  {
    id: 'node-it-dept',
    displayName: 'IT-отдел (Core Platform)',
    nodeScope: 'INTERNAL_DEPT',
    roleCode: 'internal_it',
    treePath: 'tedcloud.internal.it',
    kpiValue: 420,
    customData: { kpiUnit: 'Story Points', slaHours: 4, repo: 'tedcloud/core' },
  },
  {
    id: 'node-it-dev-max',
    displayName: 'Максим Орлов (Senior Backend Dev)',
    nodeScope: 'INTERNAL_DEPT',
    roleCode: 'internal_it',
    treePath: 'tedcloud.internal.it.dev_max',
    kpiValue: 145,
    customData: { kpiUnit: 'Story Points', grade: 'Senior', stack: 'Next.js / PostgreSQL' },
  },
  {
    id: 'node-hr-dept',
    displayName: 'HR & People Ops',
    nodeScope: 'INTERNAL_DEPT',
    roleCode: 'internal_hr',
    treePath: 'tedcloud.internal.hr',
    kpiValue: 85,
    customData: { kpiUnit: 'Закрытые вакансии', openRoles: 6 },
  },
  {
    id: 'node-net-leader-1',
    displayName: 'Алина Соколова (Лидер ветки #1)',
    nodeScope: 'EXTERNAL_NETWORK',
    roleCode: 'network_leader',
    treePath: 'tedcloud.network.leader_1',
    kpiValue: 4680,
    customData: { kpiUnit: 'PV', rank: 'Супервайзор', region: 'Москва' },
  },
  {
    id: 'node-net-partner-4',
    displayName: 'Артём Громов (Партнёр сети)',
    nodeScope: 'EXTERNAL_NETWORK',
    roleCode: 'network_partner',
    treePath: 'tedcloud.network.leader_1.partner_4',
    kpiValue: 320,
    customData: { kpiUnit: 'PV', rank: 'Консультант', tmaEnabled: true },
  },
];

/**
 * Шаг 2: Маршрутизация задач (RBAC Tickets).
 * - Если задачу создаёт партнёр из внешней сети (tedcloud.network.*) для внутреннего отдела (tedcloud.internal.*),
 *   задача НЕ может быть назначена напрямую разработчику — она принудительно попадает в общую очередь отдела
 *   (assigneeNodeId = null, routingMode = 'DEPARTMENT_QUEUE').
 * - Внутри своего отдела (например, тимлид IT -> разработчик IT) задачи назначаются напрямую (DIRECT_ASSIGNMENT).
 */
export function routeTedCloudTaskByRbac(params: {
  creatorTreePath: string;
  targetDepartmentPath: string;
  requestedAssigneeNodeId?: string | null;
  requestedAssigneeName?: string | null;
}): {
  assigneeNodeId: string | null;
  assigneeNodeName: string;
  routingMode: import('../types/saas').TedCloudRoutingMode;
  wasForcedToDepartmentQueue: boolean;
  rlsPolicyExplanation: string;
} {
  const isExternalNetworkCreator = isDescendantLtreePath(
    params.creatorTreePath,
    'tedcloud.network'
  );
  const isInternalDepartmentTarget = isDescendantLtreePath(
    params.targetDepartmentPath,
    'tedcloud.internal'
  );

  // Межконтурный тикет: Партнёр сети -> Внутренний отдел (IT / HR)
  if (isExternalNetworkCreator && isInternalDepartmentTarget) {
    return {
      assigneeNodeId: null,
      assigneeNodeName: `Общая очередь (${params.targetDepartmentPath})`,
      routingMode: 'DEPARTMENT_QUEUE',
      wasForcedToDepartmentQueue: Boolean(params.requestedAssigneeNodeId),
      rlsPolicyExplanation:
        'RLS Policy: Партнёр внешней сети не может назначать баг напрямую разработчику — тикет помещён в общую очередь отдела.',
    };
  }

  // Внутри своего отдела или своей ветки: разрешено прямое назначение
  if (params.requestedAssigneeNodeId) {
    return {
      assigneeNodeId: params.requestedAssigneeNodeId,
      assigneeNodeName: params.requestedAssigneeName || params.requestedAssigneeNodeId,
      routingMode: 'DIRECT_ASSIGNMENT',
      wasForcedToDepartmentQueue: false,
      rlsPolicyExplanation:
        'RLS Policy: Внутри своего подразделения разрешено прямое назначение исполнителя (DIRECT_ASSIGNMENT).',
    };
  }

  return {
    assigneeNodeId: null,
    assigneeNodeName: `Очередь (${params.targetDepartmentPath})`,
    routingMode: 'DEPARTMENT_QUEUE',
    wasForcedToDepartmentQueue: false,
    rlsPolicyExplanation: 'Задача поставлена в очередь подразделения.',
  };
}

/**
 * Фильтрация списка задач по роли пользователя из CurrentRoleProvider:
 * - SUPERADMIN видит и клиентские задачи (client_action), и внутренние тикеты отделов (internal_ticket)
 * - NETWORK_PARTNER видит только клиентские задачи продаж и сопровождения (client_action)
 * - INTERNAL_IT видит только внутренние тикеты отделов (internal_ticket)
 */
export function filterTasksByUserRole<T extends { task_class?: import('../types/saas').TaskClass }>(
  items: T[],
  role: import('../types/saas').UserRole
): T[] {
  if (role === 'SUPERADMIN') return items;
  if (role === 'INTERNAL_IT') {
    return items.filter((item) => item.task_class === 'internal_ticket');
  }
  return items.filter((item) => (item.task_class || 'client_action') === 'client_action');
}

