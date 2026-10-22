import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEDCLOUD_HYBRID_ORG_NODES,
  advancePlaybookStepJustInTime,
  buildChildLtreePath,
  calculateSaasValuation,
  computeDownlineGroupPv,
  computeTaskBoardMetrics,
  convertLeadToPartner,
  determinePartnerRank,
  filterTasks,
  filterTasksByUserRole,
  getNextTaskStatus,
  instantiatePlaybookTasks,
  isDescendantLtreePath,
  maskPhoneForRls,
  routeTedCloudTaskByRbac,
  runRefillEngineIdempotent,
} from './saasLogic';
import { getPermissionsForRole } from '../context/RoleContext';
import {
  ClientCycleItem,
  CrmLead,
  PartnerNode,
  PartnerPlaybook,
  TaskItem,
} from '../types/saas';

test('getPermissionsForRole and filterTasksByUserRole separate client_action and internal_ticket by role', () => {
  const itPerms = getPermissionsForRole('INTERNAL_IT');
  assert.equal(itPerms.canViewCrmAndPv, false);
  assert.equal(itPerms.canViewItTickets, true);
  assert.equal(itPerms.canViewWhiteLabel, false);

  const partnerPerms = getPermissionsForRole('NETWORK_PARTNER');
  assert.equal(partnerPerms.canViewCrmAndPv, true);
  assert.equal(partnerPerms.canViewItTickets, false);
  assert.equal(partnerPerms.canViewWhiteLabel, false);

  const adminPerms = getPermissionsForRole('SUPERADMIN');
  assert.equal(adminPerms.canViewCrmAndPv, true);
  assert.equal(adminPerms.canViewItTickets, true);
  assert.equal(adminPerms.canViewWhiteLabel, true);

  const sampleItems = [
    { id: '1', task_class: 'client_action' as const },
    { id: '2', task_class: 'internal_ticket' as const },
  ];

  assert.equal(filterTasksByUserRole(sampleItems, 'NETWORK_PARTNER').length, 1);
  assert.equal(filterTasksByUserRole(sampleItems, 'NETWORK_PARTNER')[0].id, '1');
  assert.equal(filterTasksByUserRole(sampleItems, 'INTERNAL_IT').length, 1);
  assert.equal(filterTasksByUserRole(sampleItems, 'INTERNAL_IT')[0].id, '2');
  assert.equal(filterTasksByUserRole(sampleItems, 'SUPERADMIN').length, 2);
});


test('TedCloud hybrid organization_nodes coexist in one ltree and routeTedCloudTaskByRbac enforces IT department queue for network partners', () => {
  // Проверяем сосуществование tedcloud.internal.it и tedcloud.network.leader_1
  const itNode = TEDCLOUD_HYBRID_ORG_NODES.find((n) => n.treePath === 'tedcloud.internal.it');
  const netNode = TEDCLOUD_HYBRID_ORG_NODES.find(
    (n) => n.treePath === 'tedcloud.network.leader_1.partner_4'
  );
  assert.ok(itNode);
  assert.ok(netNode);
  assert.equal(isDescendantLtreePath(itNode.treePath, 'tedcloud.internal'), true);
  assert.equal(isDescendantLtreePath(netNode.treePath, 'tedcloud.network'), true);

  // 1. Партнёр сети пытается создать тикет в IT и назначить напрямую разработчику -> принудительно в очередь отдела!
  const crossContourTicket = routeTedCloudTaskByRbac({
    creatorTreePath: 'tedcloud.network.leader_1.partner_4',
    targetDepartmentPath: 'tedcloud.internal.it',
    requestedAssigneeNodeId: 'node-it-dev-max',
    requestedAssigneeName: 'Максим Орлов',
  });
  assert.equal(crossContourTicket.routingMode, 'DEPARTMENT_QUEUE');
  assert.equal(crossContourTicket.assigneeNodeId, null);
  assert.equal(crossContourTicket.wasForcedToDepartmentQueue, true);

  // 2. Внутри IT-отдела тимлид назначает задачу напрямую разработчику -> прямое назначение сохраняется
  const intraDeptAssignment = routeTedCloudTaskByRbac({
    creatorTreePath: 'tedcloud.internal.it',
    targetDepartmentPath: 'tedcloud.internal.it',
    requestedAssigneeNodeId: 'node-it-dev-max',
    requestedAssigneeName: 'Максим Орлов',
  });
  assert.equal(intraDeptAssignment.routingMode, 'DIRECT_ASSIGNMENT');
  assert.equal(intraDeptAssignment.assigneeNodeId, 'node-it-dev-max');
  assert.equal(intraDeptAssignment.wasForcedToDepartmentQueue, false);
});


test('advancePlaybookStepJustInTime generates strictly 1 next task from JSONB State Machine without spam', () => {
  const initialCycles: ClientCycleItem[] = [
    {
      id: 'cycle-jit-1',
      ownerPartnerId: 'partner-4',
      ownerPartnerName: 'Артём Громов',
      clientFirstName: 'Екатерина',
      phoneRaw: '+7 (926) 418-22-10',
      productSku: 'HL-F1-21D',
      productName: 'Коктейль Формула 1',
      cycleDays: 21,
      cycleStartedAt: '2026-10-04',
      cycleEndDate: '2026-10-25',
      pvValue: 24,
      isActive: true,
    },
  ];

  const seeded = runRefillEngineIdempotent(initialCycles, [], '2026-10-22');
  const firstTask = seeded.tasks[0];
  assert.equal(firstTask.playbookStepId, 'step_1_warm_touch');

  // Завершаем шаг 1 -> State Machine генерирует строго 1 следующую задачу (step_2_taste_check)
  const jitStep2 = advancePlaybookStepJustInTime({
    completedTask: firstTask,
    outcome: 'success',
    existingTasks: seeded.tasks,
  });

  assert.equal(jitStep2.nextStepId, 'step_2_taste_check');
  assert.ok(jitStep2.nextTask);
  assert.equal(jitStep2.nextTask.playbookStepId, 'step_2_taste_check');
  assert.equal(jitStep2.nextTask.idempotencyKey, 'jit:cycle-jit-1:step_2_taste_check');
  assert.equal(
    jitStep2.tasks.filter((t) => t.status === 'pending').length,
    1
  );
});

test('maskPhoneForRls reveals full phone to client owner and masks PII (+7 *** ***-**-10) for upline mentor', () => {
  const ownerCheck = maskPhoneForRls('+7 (926) 418-22-10', 'partner-4', 'partner-4');
  assert.equal(ownerCheck.isMasked, false);
  assert.equal(ownerCheck.displayPhone, '+7 (926) 418-22-10');

  const uplineCheck = maskPhoneForRls('+7 (926) 418-22-10', 'partner-4', 'partner-1');
  assert.equal(uplineCheck.isMasked, true);
  assert.equal(uplineCheck.displayPhone, '+7 *** ***-**-10');
});

test('runRefillEngineIdempotent generates 21-day refill task at T-3 days and prevents duplicates via idempotency_key', () => {
  const cycles: ClientCycleItem[] = [
    {
      id: 'cycle-101',
      ownerPartnerId: 'partner-4',
      ownerPartnerName: 'Артём Громов',
      clientFirstName: 'Екатерина',
      phoneRaw: '+7 (926) 418-22-10',
      productSku: 'HL-F1-21D',
      productName: 'Коктейль Формула 1',
      cycleDays: 21,
      cycleStartedAt: '2026-10-04',
      cycleEndDate: '2026-10-25', // 3 days left from 2026-10-22
      pvValue: 24,
      isActive: true,
    },
  ];

  const firstRun = runRefillEngineIdempotent(cycles, [], '2026-10-22');
  assert.equal(firstRun.createdCount, 1);
  assert.equal(firstRun.skippedDuplicatesCount, 0);
  assert.equal(
    firstRun.tasks[0].idempotencyKey,
    'refill:cycle-101:HL-F1-21D:2026-10-25'
  );

  // Повторный запуск воркера с тем же состоянием не создаёт дубликатов
  const secondRun = runRefillEngineIdempotent(cycles, firstRun.tasks, '2026-10-22');
  assert.equal(secondRun.createdCount, 0);
  assert.equal(secondRun.skippedDuplicatesCount, 1);
  assert.equal(secondRun.tasks.length, 1);
});

test('ltree hierarchy functions build valid paths and compute downline group PV (<@ operator)', () => {
  const rootPath = buildChildLtreePath(null, 'partner-1');
  assert.equal(rootPath, 'root.p_partner_1');

  const branchPath = buildChildLtreePath(rootPath, 'partner-2');
  assert.equal(branchPath, 'root.p_partner_1.p_partner_2');

  const leafPath = buildChildLtreePath(branchPath, 'partner-4');
  assert.equal(leafPath, 'root.p_partner_1.p_partner_2.p_partner_4');

  assert.equal(isDescendantLtreePath(leafPath, rootPath), true);
  assert.equal(isDescendantLtreePath(rootPath, leafPath), false);

  const sampleTree: PartnerNode[] = [
    {
      id: 'partner-1',
      hierarchyPath: rootPath,
      name: 'Алина',
      city: 'Москва',
      joinedDate: '2026-01-01',
      uplineName: 'HQ',
      personalPv: 1000,
      groupPv: 0,
      targetPv: 4000,
      activeClients: 10,
      onboardingCompletedSteps: 6,
      onboardingTotalSteps: 6,
      status: 'active',
    },
    {
      id: 'partner-2',
      hierarchyPath: branchPath,
      name: 'Елена',
      city: 'НСК',
      joinedDate: '2026-02-01',
      uplineName: 'Алина',
      personalPv: 800,
      groupPv: 0,
      targetPv: 2500,
      activeClients: 8,
      onboardingCompletedSteps: 6,
      onboardingTotalSteps: 6,
      status: 'active',
    },
    {
      id: 'partner-4',
      hierarchyPath: leafPath,
      name: 'Артём',
      city: 'ЕКБ',
      joinedDate: '2026-03-01',
      uplineName: 'Елена',
      personalPv: 300,
      groupPv: 0,
      targetPv: 500,
      activeClients: 3,
      onboardingCompletedSteps: 2,
      onboardingTotalSteps: 6,
      status: 'onboarding',
    },
  ];

  assert.equal(computeDownlineGroupPv(sampleTree, rootPath), 1100);
  assert.equal(computeDownlineGroupPv(sampleTree, branchPath), 300);
});

test('determinePartnerRank assigns Herbalife-style partner tiers accurately by PV', () => {
  assert.equal(determinePartnerRank(120), 'Консультант');
  assert.equal(determinePartnerRank(500), 'Старший консультант');
  assert.equal(determinePartnerRank(2500), 'Успешный строитель');
  assert.equal(determinePartnerRank(4200), 'Супервайзор');
});

test('getNextTaskStatus advances workflow through todo -> in_progress -> review -> done', () => {
  assert.equal(getNextTaskStatus('todo'), 'in_progress');
  assert.equal(getNextTaskStatus('in_progress'), 'review');
  assert.equal(getNextTaskStatus('review'), 'done');
  assert.equal(getNextTaskStatus('done'), 'done');
});

test('filterTasks filters by status, priority, project, and text query', () => {
  const sampleTasks: TaskItem[] = [
    {
      id: '1',
      code: 'PF-101',
      title: 'Запустить 10-дневный марафон клиентов',
      description: 'Сформировать чат и чек-лист питания',
      status: 'in_progress',
      priority: 'critical',
      project: 'Велнес-марафон',
      assigneeName: 'Алина Соколова',
      assigneeRole: 'Супервайзор',
      dueDate: '2026-10-25',
      pvImpact: 450,
      estimatedHours: 4,
      subtasks: [],
    },
    {
      id: '2',
      code: 'PF-102',
      title: 'Онбординг нового партнёра',
      description: 'Обучение работе с CRM',
      status: 'done',
      priority: 'high',
      project: 'Запуск партнёров',
      assigneeName: 'Дмитрий Волков',
      assigneeRole: 'Консультант',
      dueDate: '2026-10-26',
      pvImpact: 200,
      estimatedHours: 2,
      subtasks: [],
    },
  ];

  const byStatus = filterTasks(sampleTasks, {
    search: '',
    status: 'in_progress',
    priority: 'all',
    project: 'all',
  });
  assert.equal(byStatus.length, 1);
  assert.equal(byStatus[0].code, 'PF-101');

  const bySearch = filterTasks(sampleTasks, {
    search: 'волков',
    status: 'all',
    priority: 'all',
    project: 'all',
  });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].code, 'PF-102');

  const metrics = computeTaskBoardMetrics(sampleTasks);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.done, 1);
  assert.equal(metrics.completionRate, 50);
  assert.equal(metrics.totalPvImpact, 650);
  assert.equal(metrics.earnedPvImpact, 200);
});

test('convertLeadToPartner transforms a CRM client into an onboarding partner and generates tasks', () => {
  const lead: CrmLead = {
    id: 'lead-1',
    name: 'Екатерина Морозова',
    phone: '+7 (999) 245-18-90',
    city: 'Екатеринбург',
    stage: 'repeat_client',
    monthlyPv: 210,
    dealValueRub: 24500,
    programName: 'Марафон 21 день + Программа завтрака',
    mentorName: 'Алина Соколова',
    lastActivity: 'Сегодня, 11:20',
  };

  const result = convertLeadToPartner(lead, 5, 10);
  assert.equal(result.updatedLead.convertedToPartner, true);
  assert.equal(result.updatedLead.stage, 'partner_ready');
  assert.equal(result.newPartner.name, 'Екатерина Морозова');
  assert.equal(result.newPartner.personalPv, 210);
  assert.equal(result.onboardingTasks.length, 2);
  assert.equal(result.onboardingTasks[0].code, 'PF-111');
});

test('instantiatePlaybookTasks creates structured tasks from a partner playbook', () => {
  const playbook: PartnerPlaybook = {
    id: 'pb-test',
    title: 'Тестовый плейбук',
    category: 'Онбординг',
    durationDays: 14,
    description: 'Описание',
    expectedPvGain: 500,
    tasksTemplate: [
      {
        title: 'Шаг 1',
        description: 'Описание шага 1',
        priority: 'high',
        project: 'Запуск партнёров',
        pvImpact: 250,
        estimatedHours: 2,
        subtasks: ['Подзадача А', 'Подзадача Б'],
      },
    ],
  };

  const created = instantiatePlaybookTasks(playbook, 'Иван Петров', 'Консультант', 8);
  assert.equal(created.length, 1);
  assert.equal(created[0].code, 'PF-109');
  assert.equal(created[0].subtasks.length, 2);
});

test('calculateSaasValuation computes ARR, NDR, LTV/CAC and Enterprise M&A valuation', () => {
  const valuation = calculateSaasValuation({
    activePartnersCount: 1200,
    arpuMonthlyRub: 2490,
    corporateEnterpriseSeats: 500,
    corporateSeatPriceRub: 3900,
    monthlyChurnPercent: 1.8,
    cacRub: 4500,
    grossMarginPercent: 84,
  });

  assert.equal(valuation.partnerMrrRub, 1200 * 2490);
  assert.equal(valuation.corporateMrrRub, 500 * 3900);
  assert.equal(valuation.totalMrrRub, 4938000);
  assert.equal(valuation.arrRub, 4938000 * 12);
  assert.ok(valuation.ltvCacRatio > 10);
  assert.ok(valuation.enterpriseValuationRub > 300_000_000);
});
