import {
  AiAssistantMode,
  AttachmentItem,
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
 * Автоматическая двусторонняя локализация дефолтных должностей, подразделений и системных значений из БД
 */
export function formatRoleOrDept(val?: string | null, lang: 'ru' | 'en' = 'ru'): string {
  const raw = String(val || '').trim();
  if (!raw || raw === 'common.generalScope') {
    return lang === 'en' ? 'General Workspace' : 'Общий контур';
  }

  const lower = raw.toLowerCase();

  if (lang === 'en') {
    if (lower === 'специалист' || lower === 'штатный специалист') return 'Specialist';
    if (lower === 'основное подразделение') return 'Core Department';
    if (lower === 'дирекция / общий штат') return 'Executive / General Staff';
    if (lower === 'генеральный директор') return 'Chief Executive Officer';
    if (lower === 'исполнительная дирекция' || lower === 'руководство') return 'Executive Management';
    if (lower === 'не назначено' || lower === 'не назначен') return 'Unassigned';
    if (lower === 'общий контур' || lower === 'common.generalscope') return 'General Workspace';
    if (lower === 'отдел не указан' || lower === 'без привязки к отделу') return 'General Workspace';
    if (lower === 'руководитель' || lower === 'руководитель организации') return 'Executive Lead';
    if (lower === 'сотрудник' || lower === 'штатный сотрудник') return 'Staff Member';
    if (lower === 'всем сотрудникам') return 'All Company Members';
    if (lower === 'финансовый отдел') return 'Finance Department';
    if (lower === 'юридический отдел') return 'Legal Department';
    if (lower === 'коммерческий блок' || lower === 'отдел продаж') return 'Commercial & Sales';
    return raw;
  } else {
    if (lower === 'specialist') return 'Специалист';
    if (lower === 'core department') return 'Основное подразделение';
    if (lower === 'executive / general staff') return 'Дирекция / Общий штат';
    if (lower === 'chief executive officer' || lower === 'ceo') return 'Генеральный директор';
    if (lower === 'executive management') return 'Исполнительная дирекция';
    if (lower === 'unassigned') return 'Не назначен';
    if (lower === 'general workspace' || lower === 'common.generalscope') return 'Общий контур';
    if (lower === 'no department specified' || lower === 'no specific department') return 'Общий контур';
    if (lower === 'all company members') return 'Всем сотрудникам';
    return raw;
  }
}

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
 * Генерация детерминированного чек-листа из 4-5 подзадач для задачи (TedCloud Intelligence) с поддержкой RU / EN
 */
export function buildBuiltInChecklistForTask(
  taskTitle: string,
  taskDescription?: string | null,
  lang: 'ru' | 'en' = 'ru'
): { checklist: TaskChecklistItem[]; summary: string } {
  const defaultTitle = lang === 'en' ? 'Corporate Initiative' : 'Корпоративное поручение';
  const titleClean = String(taskTitle || defaultTitle).trim();
  const lower = `${titleClean} ${taskDescription || ''}`.toLowerCase();

  let steps: string[] = [];

  if (lang === 'en') {
    if (
      lower.includes('contract') ||
      lower.includes('legal') ||
      lower.includes('agreement') ||
      lower.includes('deal') ||
      lower.includes('tax') ||
      lower.includes('vat') ||
      lower.includes('договор') ||
      lower.includes('контракт') ||
      lower.includes('сделк') ||
      lower.includes('инн')
    ) {
      steps = [
        `Verify counterparty legal & tax requisites (VAT / Tax ID) for "${titleClean}"`,
        'Align commercial terms, pricing schedule, and settlement milestones',
        'Complete legal compliance review with the responsible department',
        'Route final agreement for signature and log the contract number in CRM',
        'Update task status and notify the executive stakeholder',
      ];
    } else if (
      lower.includes('report') ||
      lower.includes('financ') ||
      lower.includes('budget') ||
      lower.includes('audit') ||
      lower.includes('отчет') ||
      lower.includes('финанс') ||
      lower.includes('бюджет') ||
      lower.includes('аудит')
    ) {
      steps = [
        `Aggregate primary datasets and operational exports for "${titleClean}"`,
        'Reconcile figures against the CRM deal registry and billing invoices',
        'Compile executive variance summary and key analytical findings',
        'Review and approve final report with the department lead',
      ];
    } else if (
      lower.includes('client') ||
      lower.includes('sales') ||
      lower.includes('pitch') ||
      lower.includes('meeting') ||
      lower.includes('клиент') ||
      lower.includes('продаж') ||
      lower.includes('встреч')
    ) {
      steps = [
        `Prepare executive agenda and client briefing materials for "${titleClean}"`,
        'Conduct discovery review and document technical & commercial requirements',
        'Draft tailored commercial proposal with financial specification',
        'Log negotiation outcome and next steps in the CRM deal card',
      ];
    } else {
      steps = [
        `Clarify input requirements and acceptance criteria for "${titleClean}"`,
        'Assign ownership and align resources within the responsible department',
        'Execute core deliverable milestone and internal quality check',
        'Finalize output and mark completion in the TedCloud workspace',
      ];
    }
  } else {
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
  }

  const checklist: TaskChecklistItem[] = steps.map((stepTitle, idx) => ({
    id: `chk_${Date.now()}_${idx + 1}`,
    title: stepTitle,
    done: false,
  }));

  const summary =
    lang === 'en'
      ? `Task decomposed into ${checklist.length} sequential execution steps tracked in your TedCloud workspace.`
      : `Задача декомпозирована на ${checklist.length} последовательных этапа с контролем исполнения в рабочем контуре TedCloud.`;

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

export type TeddyAnalysisFocus = 'operations' | 'finance' | 'automation' | 'strategist' | 'mathematician';

export interface AiAssistantInput {
  mode: AiAssistantMode;
  personaMode?: TeddyAnalysisFocus;
  lang?: 'ru' | 'en';
  prompt?: string;
  taskTitle?: string;
  taskDescription?: string;
  companyName?: string;
  currency?: CurrencyCode;
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

function formatPriorityLabel(prio?: string | null, lang: 'ru' | 'en' = 'ru'): string {
  if (lang === 'en') {
    if (prio === 'High') return 'High priority';
    if (prio === 'Low') return 'Low priority';
    return 'Medium priority';
  }
  if (prio === 'High') return 'Высокий приоритет';
  if (prio === 'Low') return 'Низкий приоритет';
  return 'Средний приоритет';
}

function formatStatusLabel(st?: string | null, lang: 'ru' | 'en' = 'ru'): string {
  if (lang === 'en') {
    if (st === 'Done') return 'Completed';
    if (st === 'In Progress') return 'In Progress';
    return 'To Do';
  }
  if (st === 'Done') return 'Завершено';
  if (st === 'In Progress') return 'В работе';
  return 'К выполнению';
}

export function formatCompanyCurrency(
  amount: number | string | null | undefined,
  currency: CurrencyCode = 'RUB',
  lang: 'ru' | 'en' = 'ru'
): string {
  const num = Math.round(Number(amount || 0));
  const safeNum = Number.isFinite(num) ? num : 0;
  const curr = currency === 'USD' || currency === 'EUR' ? currency : 'RUB';
  if (curr === 'USD') {
    return `$${safeNum.toLocaleString('en-US')}`;
  }
  if (curr === 'EUR') {
    return `€${safeNum.toLocaleString('en-US')}`;
  }
  return `${safeNum.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')} ₽`;
}

/**
 * Интеллектуальный аналитический движок TedCloud Intelligence по реальным данным компании (RU / EN)
 */
export function runBuiltInAiAssistant(input: AiAssistantInput): AiAssistantOutput {
  const {
    mode,
    personaMode = 'operations',
    lang = 'ru',
    prompt = '',
    taskTitle = '',
    taskDescription = '',
    companyName = 'TedCloud',
    currency = 'RUB',
    currentUser,
    nodes = [],
    tasks = [],
    leads = [],
    messages = [],
  } = input;

  const isEn = lang === 'en';
  const isFinanceFocus = personaMode === 'finance' || personaMode === 'mathematician';
  const isAutomationFocus = personaMode === 'automation';
  const fmtMoney = (val: number | string | null | undefined) =>
    formatCompanyCurrency(val, currency, lang);

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

  const baseMetrics: AiAssistantMetric[] = isEn
    ? [
        {
          label: 'Open Tasks',
          value: String(openTasks.length),
          sublabel: `Completed: ${doneTasks.length}`,
        },
        {
          label: 'High Priority',
          value: String(highPriorityTasks.length),
          sublabel:
            urgentMessages.length > 0
              ? `Urgent alerts: ${urgentMessages.length}`
              : 'Critical contour',
        },
        {
          label: 'Active Pipeline',
          value: fmtMoney(activePipelineSum),
          sublabel: `Deals: ${activeLeads.length} · Conversion ${conversionRate}%`,
        },
      ]
    : [
        {
          label: 'Активные задачи',
          value: String(openTasks.length),
          sublabel: `Выполнено: ${doneTasks.length}`,
        },
        {
          label: 'Срочные поручения',
          value: String(highPriorityTasks.length),
          sublabel:
            urgentMessages.length > 0
              ? `Срочных сообщений: ${urgentMessages.length}`
              : 'Критичный контур',
        },
        {
          label: 'Сумма воронки',
          value: fmtMoney(activePipelineSum),
          sublabel: `Сделок: ${activeLeads.length} · Конверсия ${conversionRate}%`,
        },
      ];

  if (mode === 'decompose_task') {
    const targetTitle = taskTitle || prompt || (isEn ? 'Task' : 'Поручение');
    const { checklist, summary } = buildBuiltInChecklistForTask(
      targetTitle,
      taskDescription,
      lang
    );
    const sections: AiAssistantSection[] = [
      {
        title: isEn
          ? `Execution Milestones for "${targetTitle}"`
          : `Этапы выполнения поручения «${targetTitle}»`,
        items: checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
      },
    ];
    const replyLines = isEn
      ? [
          `Task Decomposition for "${targetTitle}" (${checklist.length} steps):`,
          '',
          ...checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
          '',
          summary,
        ]
      : [
          `Декомпозиция задачи «${targetTitle}» (${checklist.length} этапа):`,
          '',
          ...checklist.map((item, idx) => `${idx + 1}. ${item.title}`),
          '',
          summary,
        ];
    return {
      mode: 'decompose_task',
      headline: isEn
        ? `Task Decomposition: "${targetTitle}"`
        : `Декомпозиция поручения «${targetTitle}»`,
      metrics: baseMetrics,
      sections,
      reply: replyLines.join('\n'),
      checklist,
      aiSummary: summary,
      provider: 'tedcloud-engine',
    };
  }

  if (mode === 'daily_brief') {
    const userName = currentUser?.name || (isEn ? 'Team Member' : 'Сотрудник');
    const userRole = formatRoleOrDept(currentUser?.role_type, lang);
    const topUserTasks = userTasks.slice(0, 4);

    if (isEn) {
      const taskItems: string[] = [
        `Open tasks in your scope: ${userTasks.length} (workspace total open: ${openTasks.length}, completed: ${doneTasks.length}).`,
        `High-priority assignments: ${userTasks.filter((t) => t.priority === 'High').length}.`,
      ];

      if (topUserTasks.length > 0) {
        topUserTasks.forEach((t) => {
          const duePart = t.due_date ? ` · Due: ${t.due_date}` : '';
          const deptLabel = t.department ? ` (${formatRoleOrDept(t.department, 'en')})` : '';
          taskItems.push(
            `${t.title} — ${formatPriorityLabel(t.priority, 'en')}, ${formatStatusLabel(
              t.status,
              'en'
            )}${deptLabel}${duePart}`
          );
        });
      } else {
        taskItems.push('All current assignments are completed or awaiting new delegation.');
      }

      const commItems: string[] = [
        `Workspace messages: ${messages.length} (urgent notifications: ${urgentMessages.length}).`,
      ];

      const crmItems: string[] = [
        `Active deals in pipeline: ${activeLeads.length} totaling ${fmtMoney(activePipelineSum)}.`,
        `Closed Won contracts: ${wonLeads.length} totaling ${fmtMoney(
          wonPipelineSum
        )} (${conversionRate}% conversion).`,
      ];

      const sections: AiAssistantSection[] = [
        { title: 'Operational Task Contour', items: taskItems },
        { title: 'Workspace Communications', items: commItems },
        { title: 'Commercial CRM Pipeline', items: crmItems },
      ];

      const lines: string[] = [
        `Daily Executive Brief — ${userName} (${userRole}), ${companyName}`,
        '',
        'Operational Task Contour:',
        ...taskItems.map((i) => `• ${i}`),
        '',
        'Workspace Communications:',
        ...commItems.map((i) => `• ${i}`),
        '',
        'Commercial CRM Pipeline:',
        ...crmItems.map((i) => `• ${i}`),
      ];

      return {
        mode: 'daily_brief',
        headline: `Daily Executive Brief — ${userName} (${userRole})`,
        metrics: baseMetrics,
        sections,
        reply: lines.join('\n'),
        provider: 'tedcloud-engine',
      };
    }

    const taskItems: string[] = [
      `Активных задач в вашей зоне ответственности: ${userTasks.length} (всего по организации открыто: ${openTasks.length}, завершено: ${doneTasks.length}).`,
      `Поручений высокого приоритета: ${userTasks.filter((t) => t.priority === 'High').length}.`,
    ];

    if (topUserTasks.length > 0) {
      topUserTasks.forEach((t) => {
        const duePart = t.due_date ? ` · Срок: ${t.due_date}` : '';
        taskItems.push(
          `${t.title} — ${formatPriorityLabel(t.priority, 'ru')}, ${formatStatusLabel(
            t.status,
            'ru'
          )}${t.department ? ` (${formatRoleOrDept(t.department, 'ru')})` : ''}${duePart}`
        );
      });
    } else {
      taskItems.push('Все текущие поручения закрыты или ожидают новых назначений.');
    }

    const commItems: string[] = [
      `Сообщений в рабочем контуре: ${messages.length} (срочных уведомлений: ${urgentMessages.length}).`,
    ];

    const crmItems: string[] = [
      `Активных сделок в работе: ${activeLeads.length} на сумму ${fmtMoney(activePipelineSum)}.`,
      `Закрыто контрактов: ${wonLeads.length} на сумму ${fmtMoney(
        wonPipelineSum
      )} (конверсия ${conversionRate}%).`,
    ];

    const sections: AiAssistantSection[] = [
      { title: 'Операционный контур задач', items: taskItems },
      { title: 'Инфополе и коммуникации', items: commItems },
      { title: 'Коммерческий контур CRM', items: crmItems },
    ];

    const focusSummary = isFinanceFocus
      ? `Финансовая аналитика: активная воронка составляет ${fmtMoney(activePipelineSum)}, конверсия в оплату — ${conversionRate}%.`
      : isAutomationFocus
      ? `Автоматизация задач: ${openTasks.length} поручений в работе готовы к автоматической декомпозиции на чек-листы.`
      : `Операционный контроль: под контролем ${highPriorityTasks.length} приоритетных поручений и ${activeLeads.length} активных сделок.`;

    const lines: string[] = [
      `Teddy · Операционная сводка дня — ${userName} (${userRole}), ${companyName}`,
      focusSummary,
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
      headline: `Teddy · Сводка дня — ${userName} (${userRole})`,
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
        name: n.name || (isEn ? 'Team Member' : 'Сотрудник'),
        role: formatRoleOrDept(n.role_type, lang),
        dept: formatRoleOrDept(n.department, lang),
        openCount: assignedOpen,
        highCount,
      };
    });

    nodeLoad.sort((a, b) => b.openCount - a.openCount);

    const overloaded = nodeLoad.filter((n) => n.openCount >= 3);
    const underloaded = nodeLoad.filter((n) => n.openCount === 0);

    if (isEn) {
      const staffItems: string[] =
        nodeLoad.length === 0
          ? ['Team directory is empty.']
          : nodeLoad.slice(0, 6).map((item) => {
              const statusIndicator =
                item.openCount >= 3
                  ? 'High load'
                  : item.openCount >= 1
                  ? 'Optimal load'
                  : 'Available for assignment';
              return `${item.name} (${item.role}, ${item.dept}) — open tasks: ${item.openCount}, high priority: ${item.highCount} · ${statusIndicator}`;
            });

      const crmAuditItems: string[] = [
        `Total deals in registry: ${leads.length} · In negotiation: ${
          leads.filter((l) => (l.status || l.stage) === 'Negotiation').length
        } · Closed Won: ${wonLeads.length}.`,
        `Active pipeline volume: ${fmtMoney(
          activePipelineSum
        )} · Win conversion rate: ${conversionRate}%.`,
      ];

      const recommendationItems: string[] = [];
      if (overloaded.length > 0 && underloaded.length > 0) {
        recommendationItems.push(
          `Rebalance assignments from ${overloaded[0].name} (${overloaded[0].openCount} open tasks) to ${underloaded[0].name} (0 active tasks).`
        );
      } else if (highPriorityTasks.length > 0) {
        recommendationItems.push(
          `There are ${highPriorityTasks.length} high-priority tasks in progress — decompose them into checklists and set target due dates.`
        );
      } else {
        recommendationItems.push(
          'Task distribution across departments is balanced with zero critical bottlenecks detected.'
        );
      }

      const sections: AiAssistantSection[] = [
        {
          title: `Team Workload Balance (${nodes.length} members)`,
          items: staffItems,
        },
        {
          title: 'Commercial CRM Pipeline Audit',
          items: crmAuditItems,
        },
        {
          title: 'TedCloud Intelligence Recommendations',
          items: recommendationItems,
        },
      ];

      const lines: string[] = [
        `Team Workload & CRM Pipeline Audit — ${companyName}`,
        '',
        'Team Workload Balance:',
        ...staffItems.map((i) => `• ${i}`),
        '',
        'Commercial CRM Pipeline Audit:',
        ...crmAuditItems.map((i) => `• ${i}`),
        '',
        'TedCloud Intelligence Recommendations:',
        ...recommendationItems.map((i) => `• ${i}`),
      ];

      return {
        mode: 'workload_analysis',
        headline: `Team Workload & CRM Pipeline Audit — ${companyName}`,
        metrics: baseMetrics,
        sections,
        reply: lines.join('\n'),
        provider: 'tedcloud-engine',
      };
    }

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
      `Объем активного пайплайна: ${fmtMoney(
        activePipelineSum
      )} · Конверсия в контракт: ${conversionRate}%.`,
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
        title: 'Рекомендации Teddy по оптимизации процессов',
        items: recommendationItems,
      },
    ];

    const lines: string[] = [
      `Teddy · Анализ загрузки команды и воронки CRM — ${companyName}`,
      '',
      'Баланс нагрузки по штату:',
      ...staffItems.map((i) => `• ${i}`),
      '',
      'Аудит коммерческой воронки CRM:',
      ...crmAuditItems.map((i) => `• ${i}`),
      '',
      'Рекомендации Teddy:',
      ...recommendationItems.map((i) => `• ${i}`),
    ];

    return {
      mode: 'workload_analysis',
      headline: `Teddy · Аудит нагрузки и воронки CRM — ${companyName}`,
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
  const defaultQueryTitle = isEn ? 'Workspace Overview' : 'Обзор компании';
  const lines: string[] = [
    isEn
      ? `TedCloud Intelligence Analytical Report for: "${prompt.trim() || defaultQueryTitle}"`
      : `Аналитический отчет TedCloud Intelligence по запросу: «${prompt.trim() || defaultQueryTitle}»`,
    '',
  ];

  if (matchedLeads.length > 0) {
    const items = matchedLeads.slice(0, 4).map((l) =>
      isEn
        ? `${l.client_name || l.title} — ${fmtMoney(
            l.amount ?? l.deal_value ?? 0
          )} · Stage: ${l.status || 'New'}${
            l.tax_id ? ` · Tax ID/VAT: ${l.tax_id}` : ''
          }${l.contract_number ? ` · Contract: ${l.contract_number}` : ''}`
        : `${l.client_name || l.title} — ${fmtMoney(
            l.amount ?? l.deal_value ?? 0
          )} · Статус: ${l.status || 'New'}${
            l.tax_id ? ` · ИНН/VAT: ${l.tax_id}` : ''
          }${l.contract_number ? ` · Договор: ${l.contract_number}` : ''}`
    );
    const title = isEn
      ? `Matched CRM Deals (${matchedLeads.length})`
      : `Найденные сделки CRM (${matchedLeads.length})`;
    sections.push({ title, items });
    lines.push(`${title}:`, ...items.map((i) => `• ${i}`), '');
  }

  if (matchedTasks.length > 0) {
    const items = matchedTasks.slice(0, 4).map(
      (t) =>
        `${t.title} — ${formatPriorityLabel(t.priority, lang)}, ${formatStatusLabel(
          t.status,
          lang
        )}${t.department ? ` (${formatRoleOrDept(t.department, lang)})` : ''}`
    );
    const title = isEn
      ? `Matched Tasks (${matchedTasks.length})`
      : `Найденные задачи (${matchedTasks.length})`;
    sections.push({ title, items });
    lines.push(`${title}:`, ...items.map((i) => `• ${i}`), '');
  }

  if (matchedNodes.length > 0) {
    const items = matchedNodes.slice(0, 4).map((n) =>
      isEn
        ? `${n.name} — ${formatRoleOrDept(n.role_type, 'en')}${
            n.department ? ` · Department: ${formatRoleOrDept(n.department, 'en')}` : ''
          }`
        : `${n.name} — ${formatRoleOrDept(n.role_type, 'ru')}${
            n.department ? ` · Подразделение: ${formatRoleOrDept(n.department, 'ru')}` : ''
          }`
    );
    const title = isEn
      ? `Relevant Team Members (${matchedNodes.length})`
      : `Профильные сотрудники (${matchedNodes.length})`;
    sections.push({ title, items });
    lines.push(`${title}:`, ...items.map((i) => `• ${i}`), '');
  }

  if (sections.length === 0) {
    const fallbackItems = isEn
      ? [
          `Team members in directory: ${nodes.length}`,
          `Open tasks: ${openTasks.length} (high priority: ${highPriorityTasks.length})`,
          `CRM deals: ${leads.length} with active pipeline volume of ${fmtMoney(
            activePipelineSum
          )} (${conversionRate}% conversion).`,
          'For targeted lookup, enter a client name, Tax ID / VAT, employee name, or task subject.',
        ]
      : [
          `Сотрудников в штате: ${nodes.length}`,
          `Открытых задач: ${openTasks.length} (высокого приоритета: ${highPriorityTasks.length})`,
          `Сделок в CRM: ${leads.length} на общую сумму активного пайплайна ${fmtMoney(
            activePipelineSum
          )} (конверсия ${conversionRate}%).`,
          'Для точечного поиска укажите название контрагента, ИНН/VAT, фамилию сотрудника или тему поручения.',
        ];
    const title = isEn
      ? `Executive Summary for "${companyName}"`
      : `Сводная статистика пространства «${companyName}»`;
    sections.push({
      title,
      items: fallbackItems,
    });
    lines.push(`${title}:`, ...fallbackItems.map((i) => `• ${i}`));
  }

  return {
    mode: 'custom',
    headline: isEn
      ? `Analytical Response: "${prompt.trim() || defaultQueryTitle}"`
      : `Ответ по запросу «${prompt.trim() || defaultQueryTitle}»`,
    metrics: baseMetrics,
    sections,
    reply: lines.join('\n'),
    provider: 'tedcloud-engine',
  };
}

export interface PricingPlanConfig {
  id: SubscriptionPlanTier;
  nameRu: string;
  nameEn: string;
  titleRu: string;
  titleEn: string;
  badgeRu: string;
  badgeEn: string;
  maxEmployeesLabelRu: string;
  maxEmployeesLabelEn: string;
  seatsLabelRu: string;
  seatsLabelEn: string;
  maxEmployeesCount: number | null; // null = unlimited
  monthly: {
    RUB: number;
    USD: number;
    EUR: number;
  };
  yearlyMonthly: {
    RUB: number;
    USD: number;
    EUR: number;
  };
  yearlyMonthlyEquivalent: {
    RUB: number;
    USD: number;
    EUR: number;
  };
  featuresRu: string[];
  featuresEn: string[];
}

export const PRICING_PLANS: Record<SubscriptionPlanTier, PricingPlanConfig> = {
  Trial: {
    id: 'Trial',
    nameRu: 'Starter',
    nameEn: 'Starter',
    titleRu: 'Starter',
    titleEn: 'Starter',
    badgeRu: 'До 5 сотрудников',
    badgeEn: 'Up to 5 employees',
    maxEmployeesLabelRu: 'До 5 сотрудников',
    maxEmployeesLabelEn: 'Up to 5 employees',
    seatsLabelRu: 'До 5 сотрудников',
    seatsLabelEn: 'Up to 5 employees',
    maxEmployeesCount: 5,
    monthly: {
      RUB: 0,
      USD: 0,
      EUR: 0,
    },
    yearlyMonthly: {
      RUB: 0,
      USD: 0,
      EUR: 0,
    },
    yearlyMonthlyEquivalent: {
      RUB: 0,
      USD: 0,
      EUR: 0,
    },
    featuresRu: [
      'До 5 сотрудников в штате',
      'Канбан-доска поручений и чек-листы',
      'Базовая воронка сделок CRM',
      'Синхронизация с Telegram-ботом',
    ],
    featuresEn: [
      'Up to 5 team members',
      'Kanban task board & checklists',
      'Core CRM deal pipeline',
      'Live Telegram bot sync',
    ],
  },
  Business: {
    id: 'Business',
    nameRu: 'Business',
    nameEn: 'Business',
    titleRu: 'Business',
    titleEn: 'Business',
    badgeRu: 'До 50 сотрудников',
    badgeEn: 'Up to 50 employees',
    maxEmployeesLabelRu: 'До 50 сотрудников',
    maxEmployeesLabelEn: 'Up to 50 employees',
    seatsLabelRu: 'До 50 сотрудников',
    seatsLabelEn: 'Up to 50 employees',
    maxEmployeesCount: 50,
    monthly: {
      RUB: 9900,
      USD: 99,
      EUR: 92,
    },
    yearlyMonthly: {
      RUB: 7920,
      USD: 79,
      EUR: 74,
    },
    yearlyMonthlyEquivalent: {
      RUB: 7920,
      USD: 79,
      EUR: 74,
    },
    featuresRu: [
      'До 50 сотрудников и ролевая матрица RBAC',
      'CRM, авто-генерация договоров и B2B-счетов',
      'Учет рабочего времени и смен (Time Tracking)',
      'TedCloud Intelligence и сквозная аналитика',
    ],
    featuresEn: [
      'Up to 50 members & granular RBAC matrix',
      'CRM, automated contracts & B2B invoices',
      'Work shifts & Time Tracking contour',
      'TedCloud Intelligence & executive analytics',
    ],
  },
  Enterprise: {
    id: 'Enterprise',
    nameRu: 'Enterprise',
    nameEn: 'Enterprise',
    titleRu: 'Enterprise',
    titleEn: 'Enterprise',
    badgeRu: 'Безлимит · SLA 99.9%',
    badgeEn: 'Unlimited · SLA 99.9%',
    maxEmployeesLabelRu: 'Безлимит сотрудников, SLA 99.9%, выделенный контур',
    maxEmployeesLabelEn: 'Unlimited employees, SLA 99.9%, dedicated contour',
    seatsLabelRu: 'Безлимит сотрудников, SLA 99.9%, выделенный контур',
    seatsLabelEn: 'Unlimited employees, SLA 99.9%, dedicated contour',
    maxEmployeesCount: null,
    monthly: {
      RUB: 29900,
      USD: 299,
      EUR: 279,
    },
    yearlyMonthly: {
      RUB: 23920,
      USD: 239,
      EUR: 223,
    },
    yearlyMonthlyEquivalent: {
      RUB: 23920,
      USD: 239,
      EUR: 223,
    },
    featuresRu: [
      'Безлимитный штат и холдинговая структура',
      'Выделенный контур БД, SSO и Журнал аудита',
      'Международный биллинг (РФ / SWIFT / USDT)',
      'Гарантированный SLA 99.9% и приоритетная поддержка',
    ],
    featuresEn: [
      'Unlimited staff & multi-branch hierarchy',
      'Dedicated DB contour, SSO & Security Audit Log',
      'Global settlement (RU / SWIFT / SEPA / USDT)',
      'Guaranteed 99.9% SLA & dedicated architect',
    ],
  },
};

/**
 * Единый безопасный хелпер получения стоимости тарифа.
 * Всегда защищен через optional chaining ?. и возвращает дефолт 0 при любых невалидных аргументах.
 */
export function getPlanPrice(
  planId: string,
  currency: string = 'RUB',
  cycle: string = 'monthly'
): number {
  const normalizedPlanKey: SubscriptionPlanTier =
    planId === 'Business' || planId === 'Enterprise' ? planId : 'Trial';
  const planObj = PRICING_PLANS?.[normalizedPlanKey];
  if (!planObj) return 0;

  const normalizedCurrency: CurrencyCode =
    currency === 'USD' || currency === 'EUR' ? currency : 'RUB';
  const isYearly = String(cycle || '').toLowerCase().includes('year');

  const priceSource = isYearly
    ? planObj?.yearlyMonthlyEquivalent ?? planObj?.yearlyMonthly
    : planObj?.monthly;

  const rawPrice = priceSource?.[normalizedCurrency] ?? priceSource?.RUB ?? 0;
  return Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : 0;
}

/**
 * Расчет стоимости корпоративного тарифа на базе единой константы PRICING_PLANS
 * с поддержкой глобальных валют (USD/EUR) и РФ/СНГ (RUB), а также скидки -20% при годовом контракте.
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
  const planConfig = PRICING_PLANS[plan] || PRICING_PLANS.Trial;
  const resolvedCurrency: CurrencyCode =
    currencyOverride || (region === 'GLOBAL' ? 'USD' : 'RUB');

  if (cycle === 'yearly') {
    const discountedMonthlyRub = planConfig.yearlyMonthly.RUB;
    const totalAmountRub = discountedMonthlyRub * 12;

    const discountedMonthly = planConfig.yearlyMonthly[resolvedCurrency];
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

  const baseMonthlyRub = planConfig.monthly.RUB;
  const baseMonthly = planConfig.monthly[resolvedCurrency];

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

/**
 * Мгновенная изолированная печать / сохранение PDF за 0.1 сек через чистый скрытый iframe
 * без зависания Chrome Print Preview на тяжелом DOM основного SPA.
 */
export function handleInstantPrint(documentHtmlElementId: string, title = 'TedCloud_Document'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const targetEl = document.getElementById(documentHtmlElementId);
  if (!targetEl) return;

  const existingIframe = document.getElementById('tc-instant-print-iframe');
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'tc-instant-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) return;

  const safeTitle = String(title || 'TedCloud_Document').replace(/[<>]/g, '');

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #000000 !important;
      background: #ffffff !important;
    }
    h1, h2, h3, h4, p, div, span, strong, b {
      color: #000000;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid #1e293b !important;
      padding: 8px 10px;
      text-align: left;
      color: #0f172a !important;
      font-size: 11px;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 600 !important;
    }
    .grid { display: grid; }
    .grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .grid-cols-2, .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .col-span-2 { grid-column: span 2 / span 2; }
    .col-span-3 { grid-column: span 3 / span 3; }
    .col-span-7 { grid-column: span 7 / span 7; }
    .col-span-9 { grid-column: span 9 / span 9; }
    .gap-2 { gap: 8px; }
    .gap-6 { gap: 24px; }
    .gap-8 { gap: 32px; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-start { align-items: flex-start; }
    .items-center { align-items: center; }
    .items-end { align-items: flex-end; }
    .justify-between { justify-content: space-between; }
    .justify-end { justify-content: flex-end; }
    .space-y-1 > * + * { margin-top: 4px; }
    .space-y-2 > * + * { margin-top: 8px; }
    .space-y-2\\.5 > * + * { margin-top: 10px; }
    .space-y-5 > * + * { margin-top: 18px; }
    .space-y-6 > * + * { margin-top: 20px; }
    .border { border: 1px solid #0f172a; }
    .border-b { border-bottom: 1px solid #0f172a; }
    .border-b-2 { border-bottom: 2px solid #0f172a; }
    .border-t { border-top: 1px solid #0f172a; }
    .border-t-2 { border-top: 2px solid #0f172a; }
    .border-r { border-right: 1px solid #0f172a; }
    .p-2 { padding: 8px; }
    .p-2\\.5 { padding: 10px; }
    .p-3 { padding: 12px; }
    .pb-2 { padding-bottom: 8px; }
    .pb-3 { padding-bottom: 12px; }
    .pb-4 { padding-bottom: 16px; }
    .pt-1 { padding-top: 4px; }
    .pt-2 { padding-top: 8px; }
    .pt-3 { padding-top: 12px; }
    .pt-4 { padding-top: 16px; }
    .pt-6 { padding-top: 24px; }
    .mt-1 { margin-top: 4px; }
    .mt-3 { margin-top: 12px; }
    .w-64 { width: 256px; }
    .w-full { width: 100%; }
    .text-center { text-align: center; }
    .text-right, .sm\\:text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .uppercase { text-transform: uppercase; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .rounded-lg { border-radius: 6px; }
    .bg-slate-50, .bg-zinc-100, .bg-slate-100 { background-color: #f1f5f9 !important; }
  </style>
</head>
<body>
  <div class="a4-print-root">${targetEl.innerHTML}</div>
</body>
</html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Instant print error:', e);
    }
  }, 60);
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

export function normalizeAttachments(raw: any): AttachmentItem[] {
  if (!raw) return [];
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  }
  return arr
    .filter((item) => item && typeof item === 'object' && item.url)
    .map((item, idx) => ({
      id: String(item.id || `att_${idx + 1}`),
      name: String(item.name || `file_${idx + 1}`),
      mimeType: String(item.mimeType || item.type || 'application/octet-stream'),
      size: Number(item.size || 0),
      url: String(item.url),
    }));
}

export function isImageAttachment(att?: Partial<AttachmentItem> | null): boolean {
  if (!att) return false;
  const mime = String(att.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = String(att.name || '').toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg)$/.test(name);
}

export function formatAttachmentSize(bytes?: number | null): string {
  const b = Number(bytes || 0);
  if (!Number.isFinite(b) || b <= 0) return '1 KB';
  if (b >= 1024 * 1024) {
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

