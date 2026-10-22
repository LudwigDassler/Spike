import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSaasValuation,
  computeTaskBoardMetrics,
  convertLeadToPartner,
  determinePartnerRank,
  filterTasks,
  getNextTaskStatus,
  instantiatePlaybookTasks,
} from './saasLogic';
import { CrmLead, PartnerPlaybook, TaskItem } from '../types/saas';

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
