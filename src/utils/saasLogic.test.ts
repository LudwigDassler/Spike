import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChildLtreePath,
  calculateSaasValuation,
  computeDownlineGroupPv,
  computeTaskBoardMetrics,
  convertLeadToPartner,
  determinePartnerRank,
  filterTasks,
  getNextTaskStatus,
  instantiatePlaybookTasks,
  isDescendantLtreePath,
} from './saasLogic';
import { CrmLead, PartnerNode, PartnerPlaybook, TaskItem } from '../types/saas';

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
