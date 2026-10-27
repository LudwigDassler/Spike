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

export interface AiAssistantInput {
  mode: AiAssistantMode;
  lang?: 'ru' | 'en';
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

/**
 * Интеллектуальный аналитический движок TedCloud Intelligence по реальным данным компании (RU / EN)
 */
export function runBuiltInAiAssistant(input: AiAssistantInput): AiAssistantOutput {
  const {
    mode,
    lang = 'ru',
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

  const isEn = lang === 'en';
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
          value: `${Math.round(activePipelineSum).toLocaleString('en-US')} RUB`,
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
          value: `${Math.round(activePipelineSum).toLocaleString('ru-RU')} ₽`,
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
        `Active deals in pipeline: ${activeLeads.length} totaling ${Math.round(
          activePipelineSum
        ).toLocaleString('en-US')} RUB.`,
        `Closed Won contracts: ${wonLeads.length} totaling ${Math.round(
          wonPipelineSum
        ).toLocaleString('en-US')} RUB (${conversionRate}% conversion).`,
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
        `Active pipeline volume: ${Math.round(activePipelineSum).toLocaleString(
          'en-US'
        )} RUB · Win conversion rate: ${conversionRate}%.`,
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
        ? `${l.client_name || l.title} — ${Math.round(
            Number(l.amount ?? l.deal_value ?? 0)
          ).toLocaleString('en-US')} RUB · Stage: ${l.status || 'New'}${
            l.tax_id ? ` · Tax ID/VAT: ${l.tax_id}` : ''
          }${l.contract_number ? ` · Contract: ${l.contract_number}` : ''}`
        : `${l.client_name || l.title} — ${Math.round(
            Number(l.amount ?? l.deal_value ?? 0)
          ).toLocaleString('ru-RU')} RUB · Статус: ${l.status || 'New'}${
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
          `CRM deals: ${leads.length} with active pipeline volume of ${Math.round(
            activePipelineSum
          ).toLocaleString('en-US')} RUB (${conversionRate}% conversion).`,
          'For targeted lookup, enter a client name, Tax ID / VAT, employee name, or task subject.',
        ]
      : [
          `Сотрудников в штате: ${nodes.length}`,
          `Открытых задач: ${openTasks.length} (высокого приоритета: ${highPriorityTasks.length})`,
          `Сделок в CRM: ${leads.length} на общую сумму активного пайплайна ${Math.round(
            activePipelineSum
          ).toLocaleString('ru-RU')} RUB (конверсия ${conversionRate}%).`,
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
