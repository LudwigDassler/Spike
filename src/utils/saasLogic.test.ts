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

test('Zero-Chat CRM: sendTelegramNotification, sendWhatsAppTemplate, inviteToTeamChat and Seamless Messaging deep-links', async () => {
  const {
    sendTelegramNotification,
    sendWhatsAppTemplate,
    inviteToTeamChat,
  } = await import('../services/messengerService');
  const {
    handleTelegramContact,
    handleWhatsAppContact,
  } = await import('./seamlessMessaging');

  // 1. Тест sendTelegramNotification с Inline Keyboard (web_app)
  let capturedTgUrl = '';
  let capturedTgBody = '';
  const mockTgFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedTgUrl = String(url);
    capturedTgBody = String(init?.body || '');
    return new Response(JSON.stringify({ ok: true, result: { message_id: 777 } }), {
      status: 200,
    });
  }) as typeof fetch;

  const tgResult = await sendTelegramNotification(
    99887766,
    'Екатерина: заканчивается Коктейль Формула 1 (3 дн.)',
    'https://app.tedcloud.ru/tma?taskId=task-101',
    {
      botToken: '123456:ABC-DEF',
      fetchImpl: mockTgFetch,
    }
  );

  assert.equal(tgResult.ok, true);
  assert.equal(tgResult.messageId, 777);
  assert.equal(capturedTgUrl, 'https://api.telegram.org/bot123456:ABC-DEF/sendMessage');
  const parsedTg = JSON.parse(capturedTgBody);
  assert.equal(
    parsedTg.reply_markup.inline_keyboard[0][0].web_app.url,
    'https://app.tedcloud.ru/tma?taskId=task-101'
  );

  // 2. Тест sendWhatsAppTemplate (нормализация номера и подстановка переменных шаблона)
  let capturedWaUrl = '';
  let capturedWaBody = '';
  const mockWaFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedWaUrl = String(url);
    capturedWaBody = String(init?.body || '');
    return new Response(
      JSON.stringify({ messages: [{ id: 'wamid.HBgLNzkyNjQxODIyMTAVAgASGBQz' }] }),
      { status: 200 }
    );
  }) as typeof fetch;

  const waResult = await sendWhatsAppTemplate(
    '+7 (926) 418-22-10',
    'tedcloud_refill_reminder_v1',
    ['Екатерина', 'Протеиновый коктейль Формула 1', '3'],
    {
      accessToken: 'EAAB_TOKEN',
      phoneNumberId: '10987654321',
      fetchImpl: mockWaFetch,
    }
  );

  assert.equal(waResult.ok, true);
  assert.equal(capturedWaUrl, 'https://graph.facebook.com/v20.0/10987654321/messages');
  const parsedWa = JSON.parse(capturedWaBody);
  assert.equal(parsedWa.to, '79264182210');
  assert.equal(parsedWa.type, 'template');
  assert.equal(parsedWa.template.name, 'tedcloud_refill_reminder_v1');
  assert.equal(parsedWa.template.components[0].parameters.length, 3);
  assert.equal(parsedWa.template.components[0].parameters[0].text, 'Екатерина');

  // 3. Тест клиентских Seamless Messaging ссылок (Telegram & WhatsApp)
  const tgLinks = handleTelegramContact('@ekaterina_wellness', 'Привет, Екатерина!');
  assert.equal(tgLinks.cleanUsername, 'ekaterina_wellness');
  assert.equal(
    tgLinks.tgResolveUrl,
    `tg://resolve?domain=ekaterina_wellness&text=${encodeURIComponent('Привет, Екатерина!')}`
  );

  const waLink = handleWhatsAppContact('8 (926) 418-22-10', 'Привет, Екатерина!');
  assert.equal(
    waLink,
    `https://wa.me/79264182210?text=${encodeURIComponent('Привет, Екатерина!')}`
  );

  // 4. Тест inviteToTeamChat (одноразовая ссылка member_limit: 1)
  let capturedInviteBody = '';
  const mockInviteFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    capturedInviteBody = String(init?.body || '');
    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          invite_link: 'https://t.me/+OneTimeMentorGroupLink',
          member_limit: 1,
        },
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  const inviteResult = await inviteToTeamChat('123456:ABC-DEF', -100192837465, 554433, {
    fetchImpl: mockInviteFetch,
  });
  assert.equal(inviteResult.ok, true);
  assert.equal(inviteResult.invite_link, 'https://t.me/+OneTimeMentorGroupLink');
  assert.equal(inviteResult.member_limit, 1);
  assert.equal(JSON.parse(capturedInviteBody).member_limit, 1);
});

test('Telegram Deep Integration: /start webhook, initDataUnsafe user/start_param extraction, and sendSmartPush with startapp={taskId}', async () => {
  const {
    handleTelegramWebhookUpdate,
    sendSmartPush,
  } = await import('../services/messengerService');
  const { extractTelegramInitContext } = await import('../hooks/useTelegramSync');

  // 1. Тест команды /start на вебхуке
  let webhookBody = '';
  const mockWebhookFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    webhookBody = String(init?.body || '');
    return new Response(JSON.stringify({ ok: true, result: { message_id: 901 } }), {
      status: 200,
    });
  }) as typeof fetch;

  const webhookResult = await handleTelegramWebhookUpdate(
    {
      update_id: 10001,
      message: {
        message_id: 42,
        chat: { id: 77889900, type: 'private', first_name: 'Артём' },
        date: 1729600000,
        text: '/start',
      },
    },
    {
      botToken: '123456:ABC-DEF',
      webAppUrl: 'https://app.tedcloud.ru',
      fetchImpl: mockWebhookFetch,
    }
  );

  assert.equal(webhookResult.handled, true);
  assert.equal(webhookResult.command, '/start');
  const parsedWebhookPayload = JSON.parse(webhookBody);
  assert.equal(parsedWebhookPayload.parse_mode, 'Markdown');
  assert.equal(
    parsedWebhookPayload.reply_markup.inline_keyboard[0][0].text,
    '🚀 Открыть рабочее пространство'
  );
  assert.equal(
    parsedWebhookPayload.reply_markup.inline_keyboard[0][0].web_app.url,
    'https://app.tedcloud.ru'
  );

  // 2. Тест извлечения initDataUnsafe.user.id и start_param в useTelegramSync
  const tgCtx = extractTelegramInitContext({
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user: { id: 77889900, username: 'artem_tedcloud' },
          start_param: 'ticket-it-102',
        },
      },
    },
  });
  assert.equal(tgCtx.telegramChatId, '77889900');
  assert.equal(tgCtx.telegramUsername, 'artem_tedcloud');
  assert.equal(tgCtx.startAppTaskId, 'ticket-it-102');

  // 3. Тест sendSmartPush с параметром taskId (кнопка "Посмотреть задачу" со startapp={taskId})
  let smartPushBody = '';
  const mockSmartPushFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    smartPushBody = String(init?.body || '');
    return new Response(JSON.stringify({ ok: true, result: { message_id: 902 } }), {
      status: 200,
    });
  }) as typeof fetch;

  await sendSmartPush(
    '77889900',
    'Вам назначена новая фокус-задача в *TedCloud*',
    'ticket-it-102',
    {
      botToken: '123456:ABC-DEF',
      baseWebAppUrl: 'https://app.tedcloud.ru',
      fetchImpl: mockSmartPushFetch,
    }
  );

  const parsedSmartPush = JSON.parse(smartPushBody);
  assert.equal(
    parsedSmartPush.reply_markup.inline_keyboard[0][0].text,
    'Посмотреть задачу'
  );
  assert.equal(
    parsedSmartPush.reply_markup.inline_keyboard[0][0].web_app.url,
    'https://app.tedcloud.ru/?startapp=ticket-it-102'
  );

  // 4. Тест серверного модуля bot.ts (команда /start + InlineKeyboardMarkup web_app) и lib/telegram.ts (sendTaskNotification)
  const { handleTelegramStartCommand, TEDCLOUD_START_MESSAGE } = await import(
    '../server/bot'
  );
  const { sendTaskNotification } = await import('../lib/telegram');

  let botStartBody = '';
  const mockBotFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    botStartBody = String(init?.body || '');
    return new Response(JSON.stringify({ ok: true, result: { message_id: 903 } }), {
      status: 200,
    });
  }) as typeof fetch;

  const botStartResult = await handleTelegramStartCommand(
    {
      update_id: 20001,
      message: {
        message_id: 55,
        chat: { id: 11223344, type: 'private', first_name: 'Екатерина' },
        date: 1729600100,
        text: '/start',
      },
    },
    {
      botToken: '123456:ABC-DEF',
      webAppUrl: 'https://app.tedcloud.ru',
      fetchImpl: mockBotFetch,
    }
  );

  assert.equal(botStartResult.handled, true);
  assert.equal(botStartResult.command, '/start');
  const parsedBotStart = JSON.parse(botStartBody);
  assert.equal(
    parsedBotStart.text,
    'Добро пожаловать в TedCloud! Ваше корпоративное пространство готово.'
  );
  assert.equal(parsedBotStart.text, TEDCLOUD_START_MESSAGE);
  assert.equal(
    parsedBotStart.reply_markup.inline_keyboard[0][0].web_app.url,
    'https://app.tedcloud.ru'
  );

  let taskNotifyBody = '';
  const mockTaskNotifyFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    taskNotifyBody = String(init?.body || '');
    return new Response(JSON.stringify({ ok: true, result: { message_id: 904 } }), {
      status: 200,
    });
  }) as typeof fetch;

  const notifyRes = await sendTaskNotification(
    11223344,
    'Новая задача в TedCloud: Продление курса для Екатерины',
    'task-101',
    {
      botToken: '123456:ABC-DEF',
      webAppBaseUrl: 'https://app.tedcloud.ru',
      fetchImpl: mockTaskNotifyFetch,
    }
  );

  assert.equal(notifyRes.ok, true);
  const parsedTaskNotify = JSON.parse(taskNotifyBody);
  assert.equal(
    parsedTaskNotify.reply_markup.inline_keyboard[0][0].text,
    'Открыть задачу'
  );
  assert.equal(
    parsedTaskNotify.reply_markup.inline_keyboard[0][0].web_app.url,
    'https://app.tedcloud.ru/?startapp=task-101'
  );
});

test('registerTelegramWebhook calls setWebhook and processTelegramWebhook routes /start, /help, /new, OBSERVER guard, and NLP to Task', async () => {
  const { registerTelegramWebhook } = await import(
    '../app/api/telegram/setup/route'
  );
  const { processTelegramWebhook, POST } = await import(
    '../app/api/telegram/webhook/route'
  );

  // 0. Проверка авто-регистрации Webhook (app/api/telegram/setup/route.ts)
  let capturedSetWebhookUrl = '';
  const setupRes = await registerTelegramWebhook({
    botToken: '123456:BOT_SECRET',
    siteUrl: 'https://tedcloud.vercel.app/',
    fetchImpl: (async (url: string | URL | Request) => {
      capturedSetWebhookUrl = String(url);
      return new Response(
        JSON.stringify({
          ok: true,
          result: true,
          description: 'Webhook was set',
        }),
        { status: 200 }
      );
    }) as typeof fetch,
  });

  assert.equal(setupRes.ok, true);
  assert.equal(
    capturedSetWebhookUrl,
    'https://api.telegram.org/bot123456:BOT_SECRET/setWebhook?url=https%3A%2F%2Ftedcloud.vercel.app%2Fapi%2Ftelegram%2Fwebhook'
  );

  const insertedTasks: Array<Record<string, unknown>> = [];
  const mockSupabase = {
    from(table: string) {
      if (table === 'organization_nodes') {
        return {
          select() {
            return {
              eq(_col: string, val: string) {
                return {
                  async maybeSingle() {
                    if (val === '500100') {
                      return {
                        data: {
                          id: 'node-1',
                          name: 'Алексей Смирнов',
                          role_type: 'MANAGER',
                          company_id: 'comp-uuid-1',
                        },
                        error: null,
                      };
                    }
                    if (val === '700200') {
                      return {
                        data: {
                          id: 'node-observer',
                          name: 'Наблюдатель Аудит',
                          role_type: 'OBSERVER',
                          company_id: 'comp-uuid-1',
                        },
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'tasks') {
        return {
          async insert(payload: Record<string, unknown>) {
            insertedTasks.push(payload);
            return { data: payload, error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const sentPayloads: Array<Record<string, unknown>> = [];
  const mockFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    sentPayloads.push(JSON.parse(String(init?.body || '{}')));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
      status: 200,
    });
  }) as typeof fetch;

  // 1. Зарегистрированный сотрудник отправляет /start
  const empRes = await processTelegramWebhook(
    {
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 500100, type: 'private' },
        date: 1729600200,
        text: '/start',
      },
    },
    {
      botToken: '123456:BOT',
      siteUrl: 'https://tedcloud.vercel.app',
      supabaseClient: mockSupabase as never,
      fetchImpl: mockFetch,
    }
  );

  assert.equal(empRes.action, 'start_authorized');
  assert.equal(
    sentPayloads[0].text,
    'Добро пожаловать в TedCloud! Рабочее пространство готово.'
  );
  const replyMarkup = sentPayloads[0].reply_markup as {
    inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>>;
  };
  assert.equal(replyMarkup.inline_keyboard[0][0].text, '🚀 Открыть TedCloud');
  assert.equal(
    replyMarkup.inline_keyboard[0][0].web_app.url,
    'https://tedcloud.vercel.app'
  );

  // 2. Незарегистрированный пользователь отправляет /start
  const unauthStartRes = await processTelegramWebhook(
    {
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 999888, type: 'private' },
        date: 1729600202,
        text: '/start',
      },
    },
    {
      botToken: '123456:BOT',
      siteUrl: 'https://tedcloud.vercel.app',
      supabaseClient: mockSupabase as never,
      fetchImpl: mockFetch,
    }
  );

  assert.equal(unauthStartRes.action, 'start_unauthorized');
  assert.equal(
    sentPayloads[1].text,
    '⚠️ Вас нет в базе. Впишите этот ID в колонку telegram_chat_id: 999888'
  );

  // 3. Команда /help
  const helpRes = await processTelegramWebhook(
    {
      update_id: 3,
      message: {
        message_id: 12,
        chat: { id: 500100, type: 'private' },
        date: 1729600205,
        text: '/help',
      },
    },
    {
      botToken: '123456:BOT',
      siteUrl: 'https://tedcloud.vercel.app',
      supabaseClient: mockSupabase as never,
      fetchImpl: mockFetch,
    }
  );

  assert.equal(helpRes.action, 'help_sent');
  assert.equal(
    sentPayloads[2].text,
    'Для создания задачи просто напишите её суть текстом в этот чат, или используйте команду /new.'
  );

  // 4. Команда /new
  const newRes = await processTelegramWebhook(
    {
      update_id: 4,
      message: {
        message_id: 13,
        chat: { id: 500100, type: 'private' },
        date: 1729600208,
        text: '/new',
      },
    },
    {
      botToken: '123456:BOT',
      siteUrl: 'https://tedcloud.vercel.app',
      supabaseClient: mockSupabase as never,
      fetchImpl: mockFetch,
    }
  );

  assert.equal(newRes.action, 'new_task_prompt');
  assert.equal(
    sentPayloads[3].text,
    'Напишите суть задачи следующим сообщением:'
  );

  // 5. Роль OBSERVER пытается создать задачу текстом -> отказ
  const observerRes = await processTelegramWebhook(
    {
      update_id: 5,
      message: {
        message_id: 14,
        chat: { id: 700200, type: 'private' },
        date: 1729600209,
        text: 'Проверить финансовый отчет',
      },
    },
    {
      botToken: '123456:BOT',
      siteUrl: 'https://tedcloud.vercel.app',
      supabaseClient: mockSupabase as never,
      fetchImpl: mockFetch,
    }
  );

  assert.equal(observerRes.action, 'observer_denied');
  assert.equal(insertedTasks.length, 0);
  assert.equal(sentPayloads[4].text, 'У вас нет прав на создание задач.');

  // 6. Роль MANAGER отправляет обычный текст (NLP to Task) -> создается запись в tasks
  const taskRes = await processTelegramWebhook(
    {
      update_id: 6,
      message: {
        message_id: 15,
        chat: { id: 500100, type: 'private' },
        date: 1729600210,
        text: 'Подготовить коммерческое предложение для клиента Вектор до пятницы',
      },
    },
    {
      botToken: '123456:BOT',
      siteUrl: 'https://tedcloud.vercel.app',
      supabaseClient: mockSupabase as never,
      fetchImpl: mockFetch,
    }
  );

  assert.equal(taskRes.action, 'task_saved');
  assert.equal(insertedTasks.length, 1);
  assert.equal(
    insertedTasks[0].title,
    'Подготовить коммерческое предложение для клиента Вектор до пятницы'
  );
  assert.equal(insertedTasks[0].status, 'new');
  assert.equal(insertedTasks[0].company_id, 'comp-uuid-1');
  assert.equal(sentPayloads[5].text, '✅ Задача создана');

  // 7. POST-роут всегда возвращает Response('OK', { status: 200 }) и в try, и в catch
  const postHttpRes = await POST(
    new Request('https://tedcloud.vercel.app/api/telegram/webhook', {
      method: 'POST',
      body: JSON.stringify({ update_id: 99 }),
    })
  );
  assert.equal(postHttpRes.status, 200);
  assert.equal(await postHttpRes.text(), 'OK');

  const postInvalidJsonRes = await POST(
    new Request('https://tedcloud.vercel.app/api/telegram/webhook', {
      method: 'POST',
      body: 'INVALID_JSON',
    })
  );
  assert.equal(postInvalidJsonRes.status, 200);
  assert.equal(await postInvalidJsonRes.text(), 'OK');
});

test('computeDashboardKpis computes universal B2B CRM metrics and returns zeros for Empty States', async () => {
  const { computeDashboardKpis } = await import('../types/database');

  // 1. Empty State
  const emptyKpis = computeDashboardKpis([], [], []);
  assert.equal(emptyKpis.totalDealValue, 0);
  assert.equal(emptyKpis.activeTasksCount, 0);
  assert.equal(emptyKpis.conversionRatePercent, 0);
  assert.equal(emptyKpis.employeesCount, 0);

  // 2. Полноценные данные из 3 таблиц (crm_leads, tasks, organization_nodes)
  const populatedKpis = computeDashboardKpis(
    [
      {
        id: 'l-1',
        company_id: 'c-1',
        owner_node_id: null,
        full_name: 'ООО Вектор',
        phone: null,
        telegram_chat_id: null,
        stage: 'qualified',
        description: null,
        deal_value: 150000,
        created_at: '2026-10-23T10:00:00Z',
      },
      {
        id: 'l-2',
        company_id: 'c-1',
        owner_node_id: null,
        full_name: 'АО ТехноСфера',
        phone: null,
        telegram_chat_id: null,
        stage: 'new',
        description: null,
        deal_value: 250000,
        created_at: '2026-10-23T11:00:00Z',
      },
    ],
    [
      {
        id: 't-1',
        company_id: 'c-1',
        type: 'client',
        title: 'Согласовать договор',
        status: 'todo',
        priority: 'high',
        assigned_to: null,
        created_by: null,
        due_date: null,
        created_at: '2026-10-23T10:00:00Z',
      },
      {
        id: 't-2',
        company_id: 'c-1',
        type: 'ticket',
        title: 'Настроить интеграцию',
        status: 'done',
        priority: 'medium',
        assigned_to: null,
        created_by: null,
        due_date: null,
        created_at: '2026-10-23T11:00:00Z',
      },
    ],
    [
      {
        id: 'n-1',
        company_id: 'c-1',
        name: 'Сотрудник 1',
        role_type: 'SUPERADMIN',
        tree_path: 'tedcloud',
        telegram_chat_id: '100200',
        kpi_value: 0,
      },
    ]
  );

  assert.equal(populatedKpis.totalDealValue, 400000);
  assert.equal(populatedKpis.activeTasksCount, 1);
  assert.equal(populatedKpis.conversionRatePercent, 50);
  assert.equal(populatedKpis.employeesCount, 1);
});







