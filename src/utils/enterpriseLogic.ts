import {
  AiAssistantMode,
  BillingCycle,
  CrmLeadRecord,
  OrganizationNode,
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
 * БЛОК 1: Разбор срочности сообщения из Telegram-бота.
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
 * Генерация детерминированного чек-листа из 4-5 подзадач для задачи (ИИ-декомпозиция)
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
      `Проверить юридические реквизиты контрагента (ИНН/КПП) по задаче «${titleClean}»`,
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
  reply: string;
  checklist?: TaskChecklistItem[];
  aiSummary?: string;
  provider: 'gemini' | 'tedcloud-engine';
}

/**
 * Встроенный алгоритмический анализатор TedCloud AI (Jira Rovo style) по реальным данным компании
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

  if (mode === 'decompose_task') {
    const { checklist, summary } = buildBuiltInChecklistForTask(
      taskTitle || prompt || 'Поручение',
      taskDescription
    );
    const replyLines = [
      `ИИ-декомпозиция задачи «${taskTitle || prompt || 'Поручение'}» выполнена (${checklist.length} шага):`,
      '',
      ...checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
      '',
      summary,
    ];
    return {
      mode: 'decompose_task',
      reply: replyLines.join('\n'),
      checklist,
      aiSummary: summary,
      provider: 'tedcloud-engine',
    };
  }

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

  if (mode === 'daily_brief') {
    const userName = currentUser?.name || 'Сотрудник';
    const userRole = currentUser?.role_type || 'Специалист';
    const topUserTasks = userTasks.slice(0, 4);

    const lines: string[] = [
      `ПЕРСОНАЛЬНАЯ СВОДКА ДНЯ — ${userName} (${userRole})`,
      `Организация: ${companyName}`,
      '',
      `1. ОПЕРАЦИОННЫЙ КОНТУР ЗАДАЧ:`,
      `• Активных задач в вашей зоне ответственности: ${userTasks.length} (всего по компании открыто: ${openTasks.length}, выполнено: ${doneTasks.length}).`,
      `• Срочных поручений высокого приоритета (High): ${
        userTasks.filter((t) => t.priority === 'High').length
      }.`,
    ];

    if (topUserTasks.length > 0) {
      lines.push('• Приоритетный фокус на сегодня:');
      topUserTasks.forEach((t, idx) => {
        lines.push(
          `  ${idx + 1}) [${t.priority || 'Medium'} | ${t.status || 'Todo'}] ${t.title}${
            t.department ? ` (${t.department})` : ''
          }`
        );
      });
    } else {
      lines.push('• Все текущие задачи закрыты или ожидают новых назначений.');
    }

    lines.push('');
    lines.push('2. ИНФОПОЛЕ И КОММУНИКАЦИИ:');
    lines.push(
      `• Всего сообщений в рабочем контуре: ${messages.length} (срочных уведомлений: ${urgentMessages.length}).`
    );

    lines.push('');
    lines.push('3. КОММЕРЧЕСКИЙ КОНТУР CRM:');
    lines.push(
      `• Активных сделок в воронке: ${activeLeads.length} на сумму ${Math.round(
        activePipelineSum
      ).toLocaleString('ru-RU')} RUB.`
    );
    lines.push(
      `• Закрыто контрактов (Won): ${wonLeads.length} на сумму ${Math.round(
        wonPipelineSum
      ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`
    );

    return {
      mode: 'daily_brief',
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
        dept: n.department || 'Без отдела',
        openCount: assignedOpen,
        highCount,
      };
    });

    nodeLoad.sort((a, b) => b.openCount - a.openCount);

    const overloaded = nodeLoad.filter((n) => n.openCount >= 3);
    const underloaded = nodeLoad.filter((n) => n.openCount === 0);

    const lines: string[] = [
      `АНАЛИЗ ЗАГРУЗКИ КОМАНДЫ И ВОРОНКИ CRM — ${companyName}`,
      '',
      `1. БАЛАНС НАГРУЗКИ ПО ШТАТУ (${nodes.length} сотр. / ${openTasks.length} активных задач):`,
    ];

    if (nodeLoad.length === 0) {
      lines.push('• Штатное расписание пусто.');
    } else {
      nodeLoad.slice(0, 6).forEach((item) => {
        const statusIndicator =
          item.openCount >= 3
            ? 'Высокая нагрузка'
            : item.openCount >= 1
            ? 'Оптимально'
            : 'Свободен';
        lines.push(
          `• ${item.name} (${item.role}, ${item.dept}): ${item.openCount} акт. задач (High: ${item.highCount}) — [${statusIndicator}]`
        );
      });
    }

    lines.push('');
    lines.push('2. АУДИТ КОММЕРЧЕСКОЙ ВОРОНКИ CRM:');
    lines.push(
      `• Всего сделок: ${leads.length} | На согласовании (Negotiation): ${
        leads.filter((l) => (l.status || l.stage) === 'Negotiation').length
      } | Успешно закрыто (Won): ${wonLeads.length}.`
    );
    lines.push(
      `• Объем активного пайплайна: ${Math.round(activePipelineSum).toLocaleString(
        'ru-RU'
      )} RUB | Конверсия в контракт: ${conversionRate}%.`
    );

    lines.push('');
    lines.push('3. УПРАВЛЕНЧЕСКИЕ РЕКОМЕНДАЦИИ TEDCLOUD AI:');
    if (overloaded.length > 0 && underloaded.length > 0) {
      lines.push(
        `• Рекомендуется перераспределить часть задач от ${overloaded[0].name} (${overloaded[0].openCount} зад.) сотруднику ${underloaded[0].name} (0 активных поручений).`
      );
    } else if (highPriorityTasks.length > 0) {
      lines.push(
        `• В контуре ${highPriorityTasks.length} задач с высоким приоритетом (High) — рекомендуется провести декомпозицию на чек-листы и зафиксировать промежуточный статус.`
      );
    } else {
      lines.push(
        '• Распределение задач сбалансировано, критических блокировок по подразделениям не выявлено.'
      );
    }

    return {
      mode: 'workload_analysis',
      reply: lines.join('\n'),
      provider: 'tedcloud-engine',
    };
  }

  // mode === 'custom': Свободный вопрос по базе знаний компании
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

  const lines: string[] = [
    `ОТВЕТ TEDCLOUD AI ПО ЗАПРОСУ: «${prompt.trim() || 'Обзор компании'}»`,
    '',
  ];

  if (matchedLeads.length > 0) {
    lines.push(`Найденные сделки CRM (${matchedLeads.length}):`);
    matchedLeads.slice(0, 4).forEach((l) => {
      lines.push(
        `• ${l.client_name || l.title} — ${Math.round(
          Number(l.amount ?? l.deal_value ?? 0)
        ).toLocaleString('ru-RU')} RUB | Статус: ${l.status || 'New'}${
          l.tax_id ? ` | ИНН/VAT: ${l.tax_id}` : ''
        }${l.contract_number ? ` | Договор: ${l.contract_number}` : ''}`
      );
    });
    lines.push('');
  }

  if (matchedTasks.length > 0) {
    lines.push(`Найденные задачи (${matchedTasks.length}):`);
    matchedTasks.slice(0, 4).forEach((t) => {
      lines.push(
        `• [${t.priority || 'Medium'} | ${t.status || 'Todo'}] ${t.title}${
          t.department ? ` (${t.department})` : ''
        }`
      );
    });
    lines.push('');
  }

  if (matchedNodes.length > 0) {
    lines.push(`Профильные сотрудники (${matchedNodes.length}):`);
    matchedNodes.slice(0, 4).forEach((n) => {
      lines.push(
        `• ${n.name} — ${n.role_type || 'Специалист'}${
          n.department ? ` · Отдел: ${n.department}` : ''
        }`
      );
    });
    lines.push('');
  }

  if (matchedLeads.length === 0 && matchedTasks.length === 0 && matchedNodes.length === 0) {
    lines.push(
      `Сводная статистика пространства «${companyName}»:`,
      `• Сотрудников в штате: ${nodes.length}`,
      `• Открытых задач: ${openTasks.length} (высокого приоритета: ${highPriorityTasks.length})`,
      `• Сделок в CRM: ${leads.length} на общую сумму активного пайплайна ${Math.round(
        activePipelineSum
      ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`,
      'Для точечного поиска укажите название контрагента, ИНН, фамилию сотрудника или тему поручения.'
    );
  }

  return {
    mode: 'custom',
    reply: lines.join('\n'),
    provider: 'tedcloud-engine',
  };
}

/**
 * Расчет стоимости корпоративного тарифа с учетом скидки -20% при годовой оплате
 */
export function calculateSubscriptionPricing(
  plan: SubscriptionPlanTier,
  cycle: BillingCycle
): {
  monthlyPriceRub: number;
  totalAmountRub: number;
  discountPercent: number;
  periodLabelRu: string;
} {
  const baseMonthlyRub = plan === 'Enterprise' ? 89000 : plan === 'Business' ? 24900 : 0;
  if (cycle === 'yearly') {
    const discountedMonthly = Math.round(baseMonthlyRub * 0.8);
    const totalAmountRub = discountedMonthly * 12;
    return {
      monthlyPriceRub: discountedMonthly,
      totalAmountRub,
      discountPercent: 20,
      periodLabelRu: '12 месяцев (Годовой контракт, -20%)',
    };
  }
  return {
    monthlyPriceRub: baseMonthlyRub,
    totalAmountRub: baseMonthlyRub,
    discountPercent: 0,
    periodLabelRu: '1 месяц (Ежемесячная подписка)',
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
