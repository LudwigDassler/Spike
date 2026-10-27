import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTelegramUrgentMessage,
  buildBuiltInChecklistForTask,
  runBuiltInAiAssistant,
  calculateSubscriptionPricing,
  generateInvoiceNumber,
  searchWorkspaceEntities,
  formatError,
  formatRoleOrDept,
} from './enterpriseLogic';

test('parseTelegramUrgentMessage: sets isUrgent=false for standard messages', () => {
  const res = parseTelegramUrgentMessage('Коллеги, направляю акт сверки');
  assert.equal(res.isUrgent, false);
  assert.equal(res.cleanText, 'Коллеги, направляю акт сверки');
});

test('parseTelegramUrgentMessage: sets isUrgent=true and strips leading ! only when starting with !', () => {
  const res = parseTelegramUrgentMessage('! Срочно согласовать договор до 18:00');
  assert.equal(res.isUrgent, true);
  assert.equal(res.cleanText, 'Срочно согласовать договор до 18:00');

  const midBang = parseTelegramUrgentMessage('Отличная работа! Все принято');
  assert.equal(midBang.isUrgent, false);
  assert.equal(midBang.cleanText, 'Отличная работа! Все принято');
});

test('formatRoleOrDept: translates default Russian/English DB strings and never outputs raw keys', () => {
  assert.equal(formatRoleOrDept('Специалист', 'en'), 'Specialist');
  assert.equal(formatRoleOrDept('Основное подразделение', 'en'), 'Core Department');
  assert.equal(formatRoleOrDept('Дирекция / Общий штат', 'en'), 'Executive / General Staff');
  assert.equal(formatRoleOrDept('common.generalScope', 'en'), 'General Workspace');
  assert.equal(formatRoleOrDept('common.generalScope', 'ru'), 'Общий контур');
  assert.equal(formatRoleOrDept('', 'en'), 'General Workspace');
  assert.equal(formatRoleOrDept('Specialist', 'ru'), 'Специалист');
});

test('buildBuiltInChecklistForTask: creates 4-5 actionable subtasks in RU and EN', () => {
  const legalRu = buildBuiltInChecklistForTask('Согласование договора поставки по ИНН 7707083893', null, 'ru');
  assert.ok(legalRu.checklist.length >= 4);
  assert.equal(legalRu.checklist.every((i) => i.done === false && i.title.length > 5), true);
  assert.ok(legalRu.summary.includes(String(legalRu.checklist.length)));

  const legalEn = buildBuiltInChecklistForTask('Review enterprise contract terms', null, 'en');
  assert.ok(legalEn.checklist.length >= 4);
  assert.ok(legalEn.summary.includes('Task decomposed into'));
  assert.ok(legalEn.checklist[0].title.includes('Verify counterparty'));
});

test('runBuiltInAiAssistant: supports daily_brief, decompose_task, workload_analysis, and custom Q&A in RU and EN', () => {
  const sampleNodes = [
    { id: 'u1', name: 'Иванов П.С.', role_type: 'Генеральный директор', department: 'Руководство' },
    { id: 'u2', name: 'Смирнова Е.А.', role_type: 'Финансовый аналитик', department: 'Финансовый отдел' },
  ];
  const sampleTasks = [
    {
      id: 't1',
      title: 'Аудит бюджета Q4',
      status: 'In Progress' as const,
      priority: 'High' as const,
      assigned_to: 'u1',
      department: 'Финансовый отдел',
    },
  ];
  const sampleLeads = [
    {
      id: 'l1',
      client_name: 'ПАО Северсталь',
      title: 'Лицензия Enterprise',
      amount: 1200000,
      status: 'Negotiation' as const,
      tax_id: '3528000597',
      contract_number: 'TC-99/26',
    },
  ];

  const brief = runBuiltInAiAssistant({
    mode: 'daily_brief',
    lang: 'ru',
    companyName: 'Сигма Групп',
    currentUser: sampleNodes[0],
    nodes: sampleNodes,
    tasks: sampleTasks,
    leads: sampleLeads,
    messages: [],
  });
  assert.ok(brief.reply.includes('Сигма Групп'));
  assert.ok(brief.reply.includes('Аудит бюджета Q4'));

  const briefEn = runBuiltInAiAssistant({
    mode: 'daily_brief',
    lang: 'en',
    companyName: 'Sigma Group',
    currentUser: sampleNodes[0],
    nodes: sampleNodes,
    tasks: sampleTasks,
    leads: sampleLeads,
    messages: [],
  });
  assert.ok(briefEn.reply.includes('Daily Executive Brief'));
  assert.ok(briefEn.metrics?.[0]?.label === 'Open Tasks');

  const decompose = runBuiltInAiAssistant({
    mode: 'decompose_task',
    lang: 'en',
    taskTitle: 'Q4 Financial Audit',
    nodes: sampleNodes,
    tasks: sampleTasks,
    leads: sampleLeads,
    messages: [],
  });
  assert.ok(Array.isArray(decompose.checklist));
  assert.ok((decompose.checklist?.length || 0) >= 4);
  assert.ok(decompose.headline?.includes('Task Decomposition'));

  const workload = runBuiltInAiAssistant({
    mode: 'workload_analysis',
    lang: 'ru',
    companyName: 'Сигма Групп',
    nodes: sampleNodes,
    tasks: sampleTasks,
    leads: sampleLeads,
    messages: [],
  });
  assert.ok(workload.reply.includes('Баланс нагрузки по штату'));

  const custom = runBuiltInAiAssistant({
    mode: 'custom',
    lang: 'ru',
    prompt: '3528000597',
    companyName: 'Сигма Групп',
    nodes: sampleNodes,
    tasks: sampleTasks,
    leads: sampleLeads,
    messages: [],
  });
  assert.ok(custom.reply.includes('ПАО Северсталь'));
});

test('calculateSubscriptionPricing & generateInvoiceNumber: computes -20% yearly discount and TC invoice number', () => {
  const monthly = calculateSubscriptionPricing('Business', 'monthly');
  assert.equal(monthly.totalAmountRub, 24900);
  assert.equal(monthly.discountPercent, 0);

  const yearly = calculateSubscriptionPricing('Business', 'yearly');
  assert.equal(yearly.discountPercent, 20);
  assert.equal(yearly.monthlyPriceRub, Math.round(24900 * 0.8));
  assert.equal(yearly.totalAmountRub, Math.round(24900 * 0.8) * 12);

  const invNum = generateInvoiceNumber(new Date('2026-10-26T12:00:00Z'));
  assert.match(invNum, /^TC-20261026-\d{4}$/);
});

test('searchWorkspaceEntities: matches tasks, CRM leads by tax_id, nodes, and messages', () => {
  const res = searchWorkspaceEntities(
    '7707083893',
    [],
    [
      {
        id: 'l1',
        company_id: 'c1',
        client_name: 'ПАО Сбербанк',
        title: 'Корпоративный контур',
        amount: 850000,
        status: 'Won',
        tax_id: '7707083893',
      },
    ],
    [],
    []
  );
  assert.equal(res.leads.length, 1);
  assert.equal(res.leads[0].client_name, 'ПАО Сбербанк');
});

test('formatError: never returns [object Object] for PostgREST/Vercel error objects', () => {
  assert.equal(formatError('Simple error'), 'Simple error');
  assert.equal(formatError({ message: 'Relation billing_invoices does not exist' }), 'Relation billing_invoices does not exist');
  assert.equal(formatError({ details: 'Missing column', hint: 'Run migration' }), 'Missing column');
  assert.equal(formatError({ code: '500', status: 500 }), '{"code":"500","status":500}');
  assert.equal(formatError(new Error('[object Object]')), 'Unknown error');
});
