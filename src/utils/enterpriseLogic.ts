import {
  AiAssistantMode,
  BillingCycle,
  CrmLeadRecord,
  CurrencyCode,
  OrganizationNode,
  PaymentGatewayRegion,
  SubscriptionPlanTier,
  TaskChecklistItem,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';

/**
 * Нормализация любой ошибки (PostgREST, Error, объект, строка) в гарантированную чистую строку без [object Object]
 */
export function formatError(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') {
    return err === '[object Object]' ? 'Unknown error' : err;
  }
  const extracted =
    err.message ||
    err.error_description ||
    err.details ||
    err.hint ||
    (typeof err.error === 'string' ? err.error : err.error?.message);
  if (typeof extracted === 'string' && extracted !== '[object Object]') {
    return extracted;
  }
  try {
    const json = JSON.stringify(err);
    return json && json !== '{}' ? json : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

/**
 * Разбор срочности сообщения из Telegram-бота.
 * is_urgent = true ТОЛЬКО если сообщение начинается с символа "!" (сам символ "!" убирается).
 */
export function parseTelegramUrgentMessage(rawText: string): {
  isUrgent: boolean;
  cleanText: string;
} {
  const trimmed = String(rawText || '').trim();
  if (trimmed.startsWith('!')) {
    return {
      isUrgent: true,
      cleanText: trimmed.slice(1).trim(),
    };
  }
  return {
    isUrgent: false,
    cleanText: trimmed,
  };
}

/**
 * Генерация детерминированного чек-листа из 4-5 подзадач для задачи (TedCloud Intelligence)
 */
export function buildBuiltInChecklistForTask(
  taskTitle: string,
  taskDescription?: string | null
): { checklist: TaskChecklistItem[]; summary: string } {
  const titleClean = String(taskTitle || 'Корпоративное поручение').trim();
  const lower = `${titleClean} ${taskDescription || ''}`.toLowerCase();

  let steps: string[] = [];

  if (
    lower.includes('договор') ||
    lower.includes('контракт') ||
    lower.includes('юрид') ||
    lower.includes('сделк') ||
    lower.includes('инн') ||
    lower.includes('кп') ||
    lower.includes('коммерческ')
  ) {
    steps = [
      `Проверить юридические реквизиты контрагента (ИНН/КПП или VAT) по задаче «${titleClean}»`,
      'Согласовать финансовые условия, спецификацию и график расчетов',
      'Провести правовую экспертизу проекта документа с профильным отделом',
      'Направить финальную редакцию на подписание и зафиксировать номер в CRM',
      'Обновить статус поручения и уведомить ответственного руководителя',
    ];
  } else if (
    lower.includes('отчет') ||
    lower.includes('финанс') ||
    lower.includes('бюджет') ||
    lower.includes('аудит') ||
    lower.includes('сверк') ||
    lower.includes('экономи')
  ) {
    steps = [
      `Собрать первичные данные и выгрузки по задаче «${titleClean}»`,
      'Выполнить сверку показателей с реестром сделок CRM и счетами биллинга',
      'Сформировать аналитическую сводку с отклонениями и выводами',
      'Согласовать итоговый расчет с руководителем подразделения',
    ];
  } else if (
    lower.includes('клиент') ||
    lower.includes('продаж') ||
    lower.includes('презентац') ||
    lower.includes('встреч') ||
    lower.includes('звонок')
  ) {
    steps = [
      `Подготовить повестку и материалы по клиенту для «${titleClean}»`,
      'Провести квалификацию потребностей и зафиксировать ключевые возражения',
      'Сформировать персональное коммерческое предложение со сметой',
      'Зафиксировать итоги переговоров и следующий шаг в карточке сделки CRM',
    ];
  } else {
    steps = [
      `Уточнить входные требования и критерии готовности по задаче «${titleClean}»`,
      'Распределить зону ответственности и согласовать ресурсы внутри отдела',
      'Выполнить основной этап работ и промежуточную проверку качества',
      'Подготовить итоговый результат и зафиксировать выполнение в TedCloud',
    ];
  }

  const checklist: TaskChecklistItem[] = steps.map((stepTitle, idx) => ({
    id: `chk_${Date.now()}_${idx + 1}`,
    title: stepTitle,
    done: false,
  }));

  const summary = `Задача декомпозирована на ${checklist.length} последовательных этапа с контролем исполнения в рабочем контуре TedCloud.`;

  return { checklist, summary };
}

export interface AiAssistantMetric {
  label: string;
  value: string;
  sublabel?: string;
}

export interface AiAssistantSection {
  title: string;
  items: string[];
}

export interface AiAssistantInput {
  mode: AiAssistantMode;
  prompt?: string;
  taskTitle?: string;
  taskDescription?: string;
  companyName?: string;
  currentUser?: Partial<OrganizationNode> | null;
  nodes: Partial<OrganizationNode>[];
  tasks: Partial<TaskRecord>[];
  leads: Partial<CrmLeadRecord>[];
  messages: Partial<WorkspaceMessageRecord>[];
}

export interface AiAssistantOutput {
  mode: AiAssistantMode;
  headline?: string;
  metrics?: AiAssistantMetric[];
  sections?: AiAssistantSection[];
  reply: string;
  checklist?: TaskChecklistItem[];
  aiSummary?: string;
  provider: 'gemini' | 'tedcloud-engine';
}

function formatPriorityLabelRu(prio?: string | null): string {
  if (prio === 'High') return 'Высокий приоритет';
  if (prio === 'Low') return 'Низкий приоритет';
  return 'Средний приоритет';
}

function formatStatusLabelRu(st?: string | null): string {
  if (st === 'Done') return 'Завершено';
  if (st === 'In Progress') return 'В работе';
  return 'К выполнению';
}

/**
 * Интеллектуальный аналитический движок TedCloud Intelligence по реальным данным компании
 */
export function runBuiltInAiAssistant(input: AiAssistantInput): AiAssistantOutput {
  const {
    mode,
    prompt = '',
    taskTitle = '',
    taskDescription = '',
    companyName = 'TedCloud',
    currentUser,
    nodes = [],
    tasks = [],
    leads = [],
    messages = [],
  } = input;

  const openTasks = tasks.filter((t) => t.status !== 'Done');
  const highPriorityTasks = openTasks.filter((t) => t.priority === 'High');
  const doneTasks = tasks.filter((t) => t.status === 'Done');

  const userTasks = currentUser?.id
    ? openTasks.filter(
        (t) =>
          t.assigned_to === currentUser.id ||
          t.owner_node_id === currentUser.id ||
          (currentUser.department &&
            t.department &&
            String(t.department).toLowerCase() === String(currentUser.department).toLowerCase())
      )
    : openTasks;

  const urgentMessages = messages.filter((m) => Boolean(m.is_urgent));
  const activeLeads = leads.filter((l) => (l.status || l.stage) !== 'Lost');
  const wonLeads = leads.filter((l) => (l.status || l.stage) === 'Won');
  const activePipelineSum = activeLeads.reduce(
    (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
    0
  );
  const wonPipelineSum = wonLeads.reduce(
    (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
    0
  );
  const conversionRate =
    leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

  const baseMetrics: AiAssistantMetric[] = [
    {
      label: 'Активные задачи',
      value: String(openTasks.length),
      sublabel: `Выполнено: ${doneTasks.length}`,
    },
    {
      label: 'Срочные поручения',
      value: String(highPriorityTasks.length),
      sublabel: urgentMessages.length > 0 ? `Срочных сообщений: ${urgentMessages.length}` : 'Критичный контур',
    },
    {
      label: 'Сумма воронки',
      value: `${Math.round(activePipelineSum).toLocaleString('ru-RU')} ₽`,
      sublabel: `Сделок: ${activeLeads.length} · Конверсия ${conversionRate}%`,
    },
  ];

  if (mode === 'decompose_task') {
    const targetTitle = taskTitle || prompt || 'Поручение';
    const { checklist, summary } = buildBuiltInChecklistForTask(
      targetTitle,
      taskDescription
    );
    const sections: AiAssistantSection[] = [
      {
        title: `Этапы выполнения поручения «${targetTitle}»`,
        items: checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
      },
    ];
    const replyLines = [
      `Декомпозиция задачи «${targetTitle}» (${checklist.length} этапа):`,
      '',
      ...checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
      '',
      summary,
    ];
    return {
      mode: 'decompose_task',
      headline: `Декомпозиция поручения «${targetTitle}»`,
      metrics: baseMetrics,
      sections,
      reply: replyLines.join('\n'),
      checklist,
      aiSummary: summary,
      provider: 'tedcloud-engine',
    };
  }

  if (mode === 'daily_brief') {
    const userName = currentUser?.name || 'Сотрудник';
    const userRole = currentUser?.role_type || 'Специалист';
    const topUserTasks = userTasks.slice(0, 4);

    const taskItems: string[] = [
      `Активных задач в вашей зоне ответственности: ${userTasks.length} (всего по организации открыто: ${openTasks.length}, завершено: ${doneTasks.length}).`,
      `Поручений высокого приоритета: ${userTasks.filter((t) => t.priority === 'High').length}.`,
    ];

    if (topUserTasks.length > 0) {
      topUserTasks.forEach((t) => {
        const duePart = t.due_date ? ` · Срок: ${t.due_date}` : '';
        taskItems.push(
          `${t.title} — ${formatPriorityLabelRu(t.priority)}, ${formatStatusLabelRu(t.status)}${
            t.department ? ` (${t.department})` : ''
          }${duePart}`
        );
      });
    } else {
      taskItems.push('Все текущие поручения закрыты или ожидают новых назначений.');
    }

    const commItems: string[] = [
      `Сообщений в рабочем контуре: ${messages.length} (срочных уведомлений: ${urgentMessages.length}).`,
    ];

    const crmItems: string[] = [
      `Активных сделок в работе: ${activeLeads.length} на сумму ${Math.round(
        activePipelineSum
      ).toLocaleString('ru-RU')} RUB.`,
      `Закрыто контрактов: ${wonLeads.length} на сумму ${Math.round(
        wonPipelineSum
      ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`,
    ];

    const sections: AiAssistantSection[] = [
      { title: 'Операционный контур задач', items: taskItems },
      { title: 'Инфополе и коммуникации', items: commItems },
      { title: 'Коммерческий контур CRM', items: crmItems },
    ];

    const lines: string[] = [
      `Персональная сводка дня — ${userName} (${userRole}), ${companyName}`,
      '',
      'Операционный контур задач:',
      ...taskItems.map((i) => `• ${i}`),
      '',
      'Инфополе и коммуникации:',
      ...commItems.map((i) => `• ${i}`),
      '',
      'Коммерческий контур CRM:',
      ...crmItems.map((i) => `• ${i}`),
    ];

    return {
      mode: 'daily_brief',
      headline: `Персональная сводка дня — ${userName} (${userRole})`,
      metrics: baseMetrics,
      sections,
      reply: lines.join('\n'),
      provider: 'tedcloud-engine',
    };
  }

  if (mode === 'workload_analysis') {
    const nodeLoad = nodes.map((n) => {
      const assignedOpen = openTasks.filter(
        (t) => t.assigned_to === n.id || t.owner_node_id === n.id
      ).length;
      const highCount = openTasks.filter(
        (t) => (t.assigned_to === n.id || t.owner_node_id === n.id) && t.priority === 'High'
      ).length;
      return {
        name: n.name || 'Сотрудник',
        role: n.role_type || 'Специалист',
        dept: n.department || 'Общий контур',
        openCount: assignedOpen,
        highCount,
      };
    });

    nodeLoad.sort((a, b) => b.openCount - a.openCount);

    const overloaded = nodeLoad.filter((n) => n.openCount >= 3);
    const underloaded = nodeLoad.filter((n) => n.openCount === 0);

    const staffItems: string[] =
      nodeLoad.length === 0
        ? ['Штатное расписание пусто.']
        : nodeLoad.slice(0, 6).map((item) => {
            const statusIndicator =
              item.openCount >= 3
                ? 'Высокая нагрузка'
                : item.openCount >= 1
                ? 'Оптимальная загрузка'
                : 'Свободен для поручений';
            return `${item.name} (${item.role}, ${item.dept}) — активных задач: ${item.openCount}, срочных: ${item.highCount} · ${statusIndicator}`;
          });

    const crmAuditItems: string[] = [
      `Всего сделок в реестре: ${leads.length} · На согласовании: ${
        leads.filter((l) => (l.status || l.stage) === 'Negotiation').length
      } · Выиграно: ${wonLeads.length}.`,
      `Объем активного пайплайна: ${Math.round(activePipelineSum).toLocaleString(
        'ru-RU'
      )} RUB · Конверсия в контракт: ${conversionRate}%.`,
    ];

    const recommendationItems: string[] = [];
    if (overloaded.length > 0 && underloaded.length > 0) {
      recommendationItems.push(
        `Перераспределить часть поручений от ${overloaded[0].name} (${overloaded[0].openCount} зад.) сотруднику ${underloaded[0].name} (0 активных задач).`
      );
    } else if (highPriorityTasks.length > 0) {
      recommendationItems.push(
        `В работе находится ${highPriorityTasks.length} поручений высокого приоритета — рекомендуется выполнить декомпозицию на чек-листы и назначить контрольные сроки.`
      );
    } else {
      recommendationItems.push(
        'Распределение задач между подразделениями сбалансировано, критических блокировок не выявлено.'
      );
    }

    const sections: AiAssistantSection[] = [
      {
        title: `Баланс нагрузки по штату (${nodes.length} сотр.)`,
        items: staffItems,
      },
      {
        title: 'Аудит коммерческой воронки CRM',
        items: crmAuditItems,
      },
      {
        title: 'Рекомендации TedCloud Intelligence',
        items: recommendationItems,
      },
    ];

    const lines: string[] = [
      `Анализ загрузки команды и воронки CRM — ${companyName}`,
      '',
      'Баланс нагрузки по штату:',
      ...staffItems.map((i) => `• ${i}`),
      '',
      'Аудит коммерческой воронки CRM:',
      ...crmAuditItems.map((i) => `• ${i}`),
      '',
      'Рекомендации TedCloud Intelligence:',
      ...recommendationItems.map((i) => `• ${i}`),
    ];

    return {
      mode: 'workload_analysis',
      headline: `Анализ загрузки команды и воронки CRM — ${companyName}`,
      metrics: baseMetrics,
      sections,
      reply: lines.join('\n'),
      provider: 'tedcloud-engine',
    };
  }

  // mode === 'custom': Свободный запрос по данным компании
  const q = prompt.trim().toLowerCase();
  const matchedTasks = tasks.filter(
    (t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.department || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
  );
  const matchedLeads = leads.filter(
    (l) =>
      (l.client_name || '').toLowerCase().includes(q) ||
      (l.title || '').toLowerCase().includes(q) ||
      (l.tax_id || '').toLowerCase().includes(q) ||
      (l.contract_number || '').toLowerCase().includes(q)
  );
  const matchedNodes = nodes.filter(
    (n) =>
      (n.name || '').toLowerCase().includes(q) ||
      (n.role_type || '').toLowerCase().includes(q) ||
      (n.department || '').toLowerCase().includes(q)
  );

  const sections: AiAssistantSection[] = [];
  const lines: string[] = [
    `Аналитический отчет TedCloud Intelligence по запросу: «${prompt.trim() || 'Обзор компании'}»`,
    '',
  ];

  if (matchedLeads.length > 0) {
    const items = matchedLeads.slice(0, 4).map(
      (l) =>
        `${l.client_name || l.title} — ${Math.round(
          Number(l.amount ?? l.deal_value ?? 0)
        ).toLocaleString('ru-RU')} RUB · Статус: ${l.status || 'New'}${
          l.tax_id ? ` · ИНН/VAT: ${l.tax_id}` : ''
        }${l.contract_number ? ` · Договор: ${l.contract_number}` : ''}`
    );
    sections.push({ title: `Найденные сделки CRM (${matchedLeads.length})`, items });
    lines.push(`Найденные сделки CRM (${matchedLeads.length}):`, ...items.map((i) => `• ${i}`), '');
  }

  if (matchedTasks.length > 0) {
    const items = matchedTasks.slice(0, 4).map(
      (t) =>
        `${t.title} — ${formatPriorityLabelRu(t.priority)}, ${formatStatusLabelRu(t.status)}${
          t.department ? ` (${t.department})` : ''
        }`
    );
    sections.push({ title: `Найденные задачи (${matchedTasks.length})`, items });
    lines.push(`Найденные задачи (${matchedTasks.length}):`, ...items.map((i) => `• ${i}`), '');
  }

  if (matchedNodes.length > 0) {
    const items = matchedNodes.slice(0, 4).map(
      (n) =>
        `${n.name} — ${n.role_type || 'Специалист'}${
          n.department ? ` · Подразделение: ${n.department}` : ''
        }`
    );
    sections.push({ title: `Профильные сотрудники (${matchedNodes.length})`, items });
    lines.push(`Профильные сотрудники (${matchedNodes.length}):`, ...items.map((i) => `• ${i}`), '');
  }

  if (sections.length === 0) {
    const fallbackItems = [
      `Сотрудников в штате: ${nodes.length}`,
      `Открытых задач: ${openTasks.length} (высокого приоритета: ${highPriorityTasks.length})`,
      `Сделок в CRM: ${leads.length} на общую сумму активного пайплайна ${Math.round(
        activePipelineSum
      ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`,
      'Для точечного поиска укажите название контрагента, ИНН/VAT, фамилию сотрудника или тему поручения.',
    ];
    sections.push({
      title: `Сводная статистика пространства «${companyName}»`,
      items: fallbackItems,
    });
    lines.push(
      `Сводная статистика пространства «${companyName}»:`,
      ...fallbackItems.map((i) => `• ${i}`)
    );
  }

  return {
    mode: 'custom',
    headline: `Ответ по запросу «${prompt.trim() || 'Обзор компании'}»`,
    metrics: baseMetrics,
    sections,
    reply: lines.join('\n'),
    provider: 'tedcloud-engine',
  };
}

/**
 * Расчет стоимости корпоративного тарифа с поддержкой глобальных валют (USD/EUR) и РФ/СНГ (RUB),
 * а также скидки -20% при годовом контракте.
 */
export function calculateSubscriptionPricing(
  plan: SubscriptionPlanTier,
  cycle: BillingCycle,
  region: PaymentGatewayRegion = 'RU',
  currencyOverride?: CurrencyCode
): {
  monthlyPriceRub: number;
  totalAmountRub: number;
  monthlyPrice: number;
  totalAmount: number;
  currency: CurrencyCode;
  discountPercent: number;
  periodLabelRu: string;
  periodLabelEn: string;
} {
  const baseMonthlyRub = plan === 'Enterprise' ? 89000 : plan === 'Business' ? 24900 : 0;
  const baseMonthlyUsd = plan === 'Enterprise' ? 960 : plan === 'Business' ? 269 : 0;
  const baseMonthlyEur = plan === 'Enterprise' ? 890 : plan === 'Business' ? 249 : 0;

  const resolvedCurrency: CurrencyCode =
    currencyOverride || (region === 'GLOBAL' ? 'USD' : 'RUB');

  const baseMonthly =
    resolvedCurrency === 'USD'
      ? baseMonthlyUsd
      : resolvedCurrency === 'EUR'
      ? baseMonthlyEur
      : baseMonthlyRub;

  if (cycle === 'yearly') {
    const discountedMonthlyRub = Math.round(baseMonthlyRub * 0.8);
    const totalAmountRub = discountedMonthlyRub * 12;

    const discountedMonthly = Math.round(baseMonthly * 0.8);
    const totalAmount = discountedMonthly * 12;

    return {
      monthlyPriceRub: discountedMonthlyRub,
      totalAmountRub,
      monthlyPrice: discountedMonthly,
      totalAmount,
      currency: resolvedCurrency,
      discountPercent: 20,
      periodLabelRu: '12 месяцев (Годовой контракт, -20%)',
      periodLabelEn: '12 Months (Annual Contract, -20%)',
    };
  }

  return {
    monthlyPriceRub: baseMonthlyRub,
    totalAmountRub: baseMonthlyRub,
    monthlyPrice: baseMonthly,
    totalAmount: baseMonthly,
    currency: resolvedCurrency,
    discountPercent: 0,
    periodLabelRu: '1 месяц (Ежемесячная подписка)',
    periodLabelEn: '1 Month (Monthly Subscription)',
  };
}

export function generateInvoiceNumber(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `TC-${yyyy}${mm}${dd}-${rand}`;
}

export interface OmnisearchResults {
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  nodes: OrganizationNode[];
  messages: WorkspaceMessageRecord[];
}

export function searchWorkspaceEntities(
  query: string,
  tasks: TaskRecord[],
  leads: CrmLeadRecord[],
  nodes: OrganizationNode[],
  messages: WorkspaceMessageRecord[]
): OmnisearchResults {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    return {
      tasks: tasks.slice(0, 4),
      leads: leads.slice(0, 4),
      nodes: nodes.slice(0, 4),
      messages: messages.slice(0, 3),
    };
  }

  const matchedTasks = tasks.filter(
    (t) =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || t.notes || '').toLowerCase().includes(q) ||
      (t.department || '').toLowerCase().includes(q) ||
      (t.type || '').toLowerCase().includes(q)
  );

  const matchedLeads = leads.filter(
    (l) =>
      (l.client_name || l.full_name || '').toLowerCase().includes(q) ||
      (l.title || '').toLowerCase().includes(q) ||
      (l.tax_id || '').toLowerCase().includes(q) ||
      (l.reg_number || '').toLowerCase().includes(q) ||
      (l.contract_number || '').toLowerCase().includes(q) ||
      (l.department || '').toLowerCase().includes(q) ||
      (l.contact || l.phone || '').toLowerCase().includes(q)
  );

  const matchedNodes = nodes.filter(
    (n) =>
      (n.name || '').toLowerCase().includes(q) ||
      (n.role_type || '').toLowerCase().includes(q) ||
      (n.department || '').toLowerCase().includes(q) ||
      (n.email || '').toLowerCase().includes(q) ||
      (n.invite_code || '').toLowerCase().includes(q)
  );

  const matchedMessages = messages.filter((m) => {
    const body = String(m.message_text || m.text || m.content || '').toLowerCase();
    const sender = String(m.sender_name || '').toLowerCase();
    const label = String(m.target_label || '').toLowerCase();
    return body.includes(q) || sender.includes(q) || label.includes(q);
  });

  return {
    tasks: matchedTasks.slice(0, 6),
    leads: matchedLeads.slice(0, 6),
    nodes: matchedNodes.slice(0, 6),
    messages: matchedMessages.slice(0, 5),
  };
}
