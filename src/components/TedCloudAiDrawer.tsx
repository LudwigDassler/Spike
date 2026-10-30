import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Plus,
  CheckCircle2,
  TrendingUp,
  ListTodo,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Building2,
  UserCheck,
  Briefcase,
  Target,
  Activity,
  DollarSign,
  Cpu,
} from 'lucide-react';
import {
  Company,
  CrmLeadRecord,
  DashboardSection,
  OrganizationNode,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

export type TeddyPersonaMode = 'operations' | 'finance' | 'automation';

export interface TeddyAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Swiss-minimalist faceted geometric monolith emblem with stylized architectural T
 * inside a multi-layered glass sphere (Rule 4)
 */
export const TeddyAvatar: React.FC<TeddyAvatarProps> = ({ size = 'md', className = '' }) => {
  const dims =
    size === 'xs'
      ? 'w-5 h-5 rounded-lg'
      : size === 'sm'
      ? 'w-7 h-7 rounded-xl'
      : size === 'lg'
      ? 'w-11 h-11 rounded-2xl'
      : 'w-9 h-9 rounded-xl';

  return (
    <div
      className={`${dims} relative overflow-hidden bg-gradient-to-b from-white/[0.14] via-indigo-500/[0.12] to-zinc-950/90 border border-white/[0.18] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_16px_rgba(99,102,241,0.22)] flex items-center justify-center shrink-0 ${className}`}
      title="Teddy · Executive AI Assistant"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[76%] h-[76%]"
      >
        <defs>
          <linearGradient id="tcMonolithOuter" x1="6" y1="4" x2="30" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#818CF8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#4338CA" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="tcMonolithFacet" x1="18" y1="5" x2="29" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Outer Isometric Hexagonal Crystal Monolith */}
        <polygon
          points="18,3.5 30.5,10.5 30.5,25.5 18,32.5 5.5,25.5 5.5,10.5"
          fill="#0B0C14"
          stroke="url(#tcMonolithOuter)"
          strokeWidth="1.5"
        />

        {/* Right Shaded Crystal Facet */}
        <polygon
          points="18,3.5 30.5,10.5 30.5,25.5 18,32.5"
          fill="url(#tcMonolithFacet)"
        />

        {/* Internal Geometric Wireframe Lines */}
        <line
          x1="5.5"
          y1="10.5"
          x2="30.5"
          y2="10.5"
          stroke="#A5B4FC"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <line
          x1="18"
          y1="3.5"
          x2="18"
          y2="32.5"
          stroke="#C7D2FE"
          strokeOpacity="0.28"
          strokeWidth="1"
        />

        {/* Architectural Stylized 'T' Monolith Core */}
        <path
          d="M11 12.2H25V15.4H19.7V25.5H16.3V15.4H11V12.2Z"
          fill="#FFFFFF"
        />
        <rect
          x="16.3"
          y="12.2"
          width="3.4"
          height="3.2"
          fill="#818CF8"
        />
      </svg>
    </div>
  );
};

interface TedCloudAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
  companyName?: string;
  currentProfile: OrganizationNode | null;
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  nodes: OrganizationNode[];
  messages: WorkspaceMessageRecord[];
  canCreateTasks?: boolean;
  canViewCrm?: boolean;
  onRefreshWorkspace?: () => void;
  onCreateFollowUpTask?: (suggestedTitle?: string) => void;
  onNavigateToCrm?: () => void;
  onNavigateToTasks?: () => void;
  onCreateSuggestedTask?: (draft: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    department: string;
    due_date: string;
  }) => Promise<void>;
  onSelectSection?: (section: DashboardSection) => void;
  onSelectTask?: (taskId: string) => void;
  onSelectLead?: (leadId: string) => void;
}

export interface TeddyMetricBadge {
  label: string;
  value: string;
  tone: 'neutral' | 'emerald' | 'amber' | 'rose' | 'indigo';
}

export interface TeddyActionLink {
  label: string;
  targetSection?: DashboardSection;
  taskId?: string;
  leadId?: string;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  persona?: TeddyPersonaMode;
  highlights?: string[];
  metrics?: TeddyMetricBadge[];
  actionLinks?: TeddyActionLink[];
  suggestedTasks?: Array<{
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    department: string;
    due_date: string;
  }>;
}

export function buildTeddyExecutiveBrief(params: {
  prompt: string;
  persona: TeddyPersonaMode;
  isEn: boolean;
  companyName: string;
  userRole: string;
  userName: string;
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  nodes: OrganizationNode[];
  messages: WorkspaceMessageRecord[];
  formatMoney: (n: number) => string;
}): {
  headline: string;
  highlights: string[];
  metrics: TeddyMetricBadge[];
  actionLinks: TeddyActionLink[];
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    department: string;
    due_date: string;
  }>;
} {
  const {
    prompt,
    persona,
    isEn,
    companyName,
    userRole,
    tasks,
    leads,
    nodes,
    formatMoney,
  } = params;

  const q = prompt.toLowerCase().trim();
  const isExecutive =
    userRole === 'CEO' ||
    userRole === 'Founder' ||
    userRole === 'Owner' ||
    userRole === 'SuperAdmin' ||
    userRole === 'SysAdmin' ||
    userRole === 'DepartmentHead' ||
    userRole.toLowerCase().includes('директор') ||
    userRole.toLowerCase().includes('руковод');

  const nowDate = new Date().toISOString().slice(0, 10);
  const next3Days = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);

  const openTasks = tasks.filter((t) => t.status !== 'Done');
  const doneTasks = tasks.filter((t) => t.status === 'Done');
  const highPriorityOpen = openTasks.filter((t) => t.priority === 'High');
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < nowDate);

  const activeLeads = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');
  const wonLeads = leads.filter((l) => l.status === 'Won');
  const pipelineAmount = activeLeads.reduce((s, l) => s + (l.amount || 0), 0);
  const wonAmount = wonLeads.reduce((s, l) => s + (l.amount || 0), 0);
  const topActiveLeads = [...activeLeads].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const primaryLead = topActiveLeads[0];

  const completionRate =
    tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 100;

  const isFinanceFocus =
    persona === 'finance' ||
    q.includes('crm') ||
    q.includes('сделк') ||
    q.includes('выруч') ||
    q.includes('воронк') ||
    q.includes('деньг') ||
    q.includes('финанс') ||
    q.includes('revenue') ||
    q.includes('pipeline') ||
    q.includes('deal');

  const isStaffQuery =
    q.includes('сотрудн') ||
    q.includes('команд') ||
    q.includes('штат') ||
    q.includes('нагрузк') ||
    q.includes('узк') ||
    q.includes('bottleneck') ||
    q.includes('team') ||
    q.includes('overload');

  const isTaskFocus =
    persona === 'automation' ||
    q.includes('просроч') ||
    q.includes('дедлайн') ||
    q.includes('риск') ||
    q.includes('задач') ||
    q.includes('overdue') ||
    q.includes('sla') ||
    q.includes('deadline');

  const metrics: TeddyMetricBadge[] = [
    {
      label: isEn ? 'SLA Velocity' : 'Ритм исполнения',
      value: `${completionRate}% (${doneTasks.length}/${tasks.length})`,
      tone: completionRate >= 65 ? 'emerald' : completionRate >= 40 ? 'amber' : 'rose',
    },
    {
      label: isEn ? 'Critical / Overdue' : 'Срочные / Просрочка',
      value: `${highPriorityOpen.length} / ${overdueTasks.length}`,
      tone: overdueTasks.length > 0 ? 'rose' : highPriorityOpen.length > 0 ? 'amber' : 'emerald',
    },
  ];

  if (isExecutive && leads.length > 0) {
    metrics.push({
      label: isEn ? 'Active Pipeline' : 'Активная воронка',
      value: formatMoney(pipelineAmount),
      tone: 'indigo',
    });
    metrics.push({
      label: isEn ? 'Closed Won' : 'Закрытая выручка',
      value: formatMoney(wonAmount),
      tone: 'emerald',
    });
  } else {
    metrics.push({
      label: isEn ? 'Active Roster' : 'Штат в контуре',
      value: `${nodes.length}`,
      tone: 'neutral',
    });
  }

  // Workload by assignee
  const workloadByNode = new Map<string, { name: string; dept: string; open: number; high: number }>();
  for (const n of nodes) {
    workloadByNode.set(n.id, {
      name: n.name || (isEn ? 'Unassigned' : 'Свободный слот'),
      dept: n.department || (isEn ? 'Operations' : 'Операционный блок'),
      open: 0,
      high: 0,
    });
  }
  for (const t of openTasks) {
    const assigneeKey = t.assigned_to || t.owner_node_id;
    if (assigneeKey && workloadByNode.has(assigneeKey)) {
      const entry = workloadByNode.get(assigneeKey)!;
      entry.open += 1;
      if (t.priority === 'High') entry.high += 1;
    }
  }
  const busiestStaff = Array.from(workloadByNode.values()).sort(
    (a, b) => b.high * 2 + b.open - (a.high * 2 + a.open)
  );
  const topBusy = busiestStaff[0];

  let headline = '';
  const highlights: string[] = [];
  const actionLinks: TeddyActionLink[] = [];
  const suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    department: string;
    due_date: string;
  }> = [];

  if (isFinanceFocus && isExecutive) {
    headline = isEn
      ? `Financial & CRM Pipeline Audit (${companyName}): Active pipeline stands at ${formatMoney(pipelineAmount)} across ${activeLeads.length} open deals, with ${formatMoney(wonAmount)} already closed.`
      : `Финансовый аудит воронки CRM (${companyName}): В активной проработке ${activeLeads.length} сделок на сумму ${formatMoney(pipelineAmount)}, закрытая выручка составляет ${formatMoney(wonAmount)}.`;

    if (primaryLead) {
      highlights.push(
        isEn
          ? `Highest-leverage deal: "${primaryLead.client_name}" (${formatMoney(primaryLead.amount || 0)}, stage: ${primaryLead.status}). Prioritize direct decision-maker alignment within 24 hours.`
          : `Приоритетная сделка: «${primaryLead.client_name}» (${formatMoney(primaryLead.amount || 0)}, этап: ${primaryLead.status}). Рекомендуется зафиксировать финальные условия договора и график оплаты.`
      );
      actionLinks.push({
        label: isEn ? `Inspect "${primaryLead.client_name}"` : `Открыть сделку «${primaryLead.client_name}»`,
        leadId: primaryLead.id,
      });
    }

    const negotiationLeads = activeLeads.filter(
      (l) => l.status === 'Negotiation' || l.status === 'Proposal'
    );
    highlights.push(
      isEn
        ? `Conversion bottleneck: ${negotiationLeads.length} deals in Proposal/Negotiation (${formatMoney(
            negotiationLeads.reduce((s, l) => s + (l.amount || 0), 0)
          )}). Standardize commercial terms to compress sales cycle.`
        : `Конверсионный резерв: на стадии КП и согласования договора находятся ${negotiationLeads.length} сделок на сумму ${formatMoney(
            negotiationLeads.reduce((s, l) => s + (l.amount || 0), 0)
          )}.`
    );

    actionLinks.push({
      label: isEn ? 'Open CRM Pipeline' : 'Перейти в воронку CRM',
      targetSection: 'crm',
    });

    if (primaryLead) {
      suggestedTasks.push({
        title: isEn
          ? `Close commercial terms with ${primaryLead.client_name}`
          : `Согласовать финальные условия и счет по сделке «${primaryLead.client_name}»`,
        description: isEn
          ? `Deal value: ${formatMoney(primaryLead.amount || 0)}. Confirm contract specification and payment date.`
          : `Сумма сделки: ${formatMoney(primaryLead.amount || 0)}. Проверить реквизиты, спецификацию и дату поступления оплаты.`,
        priority: 'High',
        department: primaryLead.department || (isEn ? 'Sales' : 'Отдел продаж'),
        due_date: next3Days,
      });
    }
  } else if (isStaffQuery) {
    headline = isEn
      ? `Organizational Capacity & Bottleneck Audit (${nodes.length} nodes): ${openTasks.length} active tasks across departments.`
      : `Анализ загрузки команды и узких мест (${nodes.length} профилей): в работе ${openTasks.length} активных поручений.`;

    if (topBusy && topBusy.open > 0) {
      highlights.push(
        isEn
          ? `Peak load concentration: ${topBusy.name} (${topBusy.dept}) holds ${topBusy.open} open tasks (${topBusy.high} High priority). Rebalance non-critical items to prevent SLA drift.`
          : `Пиковая концентрация задач: ${topBusy.name} (${topBusy.dept}) ведет ${topBusy.open} активных задач (из них ${topBusy.high} — высокий приоритет). Рекомендуется перераспределить второстепенные поручения.`
      );
    } else {
      highlights.push(
        isEn
          ? `Workload across ${nodes.length} staff profiles is evenly balanced with zero critical overload.`
          : `Нагрузка между ${nodes.length} сотрудниками распределена равномерно, критических перегрузок не зафиксировано.`
      );
    }

    const unassignedTasks = openTasks.filter((t) => !t.assigned_to && !t.owner_node_id);
    if (unassignedTasks.length > 0) {
      highlights.push(
        isEn
          ? `Ownership gap: ${unassignedTasks.length} active task(s) have no assigned owner. Every task requires a single accountable specialist.`
          : `Зона без ответственного: обнаружено ${unassignedTasks.length} задач без закрепленного исполнителя. Назначьте владельца для каждого поручения.`
      );
    }

    actionLinks.push({
      label: isEn ? 'Open Team & Access' : 'Открыть штат и доступы',
      targetSection: 'team',
    });

    suggestedTasks.push({
      title: isEn
        ? 'Rebalance high-priority task load across departments'
        : 'Балансировка очереди срочных задач между отделами',
      description: isEn
        ? `Assign owners to ${unassignedTasks.length} unowned tasks and offload peak queues.`
        : `Закрепить ответственных за свободными поручениями и разгрузить пиковые очереди исполнения.`,
      priority: 'Medium',
      department: isEn ? 'Operations' : 'Операционный блок',
      due_date: next3Days,
    });
  } else if (isTaskFocus) {
    headline = isEn
      ? `Task Automation & SLA Control: ${overdueTasks.length} overdue and ${highPriorityOpen.length} high-priority tasks require immediate execution.`
      : `Контроль поручений и дедлайнов: просрочено ${overdueTasks.length} задач, в высоком приоритете находятся ${highPriorityOpen.length} поручений.`;

    if (overdueTasks.length > 0) {
      const firstOverdue = overdueTasks[0];
      highlights.push(
        isEn
          ? `Primary SLA breach: "${firstOverdue.title}" (due ${firstOverdue.due_date}). Reassign or decompose into 24-hour execution subtasks.`
          : `Приоритетный срыв срока: «${firstOverdue.title}» (дедлайн ${firstOverdue.due_date}). Требуется закрыть блокер или декомпозировать задачу.`
      );
      actionLinks.push({
        label: isEn ? `Open "${firstOverdue.title}"` : `Открыть «${firstOverdue.title}»`,
        taskId: firstOverdue.id,
      });
    } else if (highPriorityOpen.length > 0) {
      const firstHigh = highPriorityOpen[0];
      highlights.push(
        isEn
          ? `Zero overdue tasks. Top active priority: "${firstHigh.title}" (${firstHigh.department || 'General'}).`
          : `Просроченных задач нет. Главный фокус: «${firstHigh.title}» (${firstHigh.department || 'Общий контур'}).`
      );
      actionLinks.push({
        label: isEn ? `Open "${firstHigh.title}"` : `Открыть «${firstHigh.title}»`,
        taskId: firstHigh.id,
      });
    }

    actionLinks.push({
      label: isEn ? 'Open Task Registry' : 'Открыть реестр задач',
      targetSection: 'tasks',
    });

    suggestedTasks.push({
      title: isEn
        ? `Resolve ${Math.max(1, overdueTasks.length || highPriorityOpen.length)} priority SLA blockers`
        : `Закрыть приоритетные блокеры по срочным задачам (${Math.max(1, overdueTasks.length || highPriorityOpen.length)} шт.)`,
      description: isEn
        ? 'Verify deliverables, update deadlines, and confirm completion status across active tasks.'
        : 'Проверить готовность результатов, актуализировать сроки и подтвердить закрытие срочных задач.',
      priority: 'High',
      department: isEn ? 'Operations' : 'Операционный блок',
      due_date: next3Days,
    });
  } else {
    headline = isEn
      ? `Operations Control Summary (${companyName}): ${completionRate}% task completion (${doneTasks.length}/${tasks.length}), ${highPriorityOpen.length} high-priority items active${
          isExecutive ? `, and ${formatMoney(pipelineAmount)} in active CRM pipeline.` : '.'
        }`
      : `Операционная сводка (${companyName}): выполнено ${completionRate}% задач (${doneTasks.length} из ${tasks.length}), в высоком приоритете ${highPriorityOpen.length} поручений${
          isExecutive ? `, активная воронка CRM — ${formatMoney(pipelineAmount)}.` : '.'
        }`;

    if (highPriorityOpen.length > 0) {
      const topTask = highPriorityOpen[0];
      highlights.push(
        isEn
          ? `Execution Focus #1: "${topTask.title}" (${topTask.department || 'Operations'}, status: ${topTask.status}).`
          : `Операционный приоритет №1: «${topTask.title}» (${topTask.department || 'Операционный блок'}, статус: ${topTask.status}).`
      );
      actionLinks.push({
        label: isEn ? `Open Task "${topTask.title}"` : `Открыть задачу «${topTask.title}»`,
        taskId: topTask.id,
      });
    }

    if (isExecutive && primaryLead) {
      highlights.push(
        isEn
          ? `Commercial Focus #2: Advance deal "${primaryLead.client_name}" (${formatMoney(primaryLead.amount || 0)}) from stage "${primaryLead.status}".`
          : `Коммерческий фокус №2: Продвинуть сделку «${primaryLead.client_name}» (${formatMoney(primaryLead.amount || 0)}) со стадии «${primaryLead.status}».`
      );
      actionLinks.push({
        label: isEn ? `Open Deal "${primaryLead.client_name}"` : `Открыть сделку «${primaryLead.client_name}»`,
        leadId: primaryLead.id,
      });
    }

    if (topBusy && topBusy.open > 0) {
      highlights.push(
        isEn
          ? `Resource Allocation #3: ${topBusy.name} carries ${topBusy.open} active tasks (${topBusy.high} urgent).`
          : `Ресурсный баланс №3: у сотрудника ${topBusy.name} в работе ${topBusy.open} задач (срочных: ${topBusy.high}).`
      );
    }

    actionLinks.push({
      label: isEn ? 'Open Tasks' : 'Реестр задач',
      targetSection: 'tasks',
    });
    if (isExecutive) {
      actionLinks.push({
        label: isEn ? 'Open CRM' : 'Воронка CRM',
        targetSection: 'crm',
      });
    }

    suggestedTasks.push({
      title: isEn
        ? `Execute daily SLA audit for ${Math.max(1, highPriorityOpen.length)} urgent tasks`
        : `Контроль сроков по приоритетным поручениям (${Math.max(1, highPriorityOpen.length)} шт.)`,
      description: isEn
        ? 'Verify intermediate milestones, confirm owner readiness, and close completed items.'
        : 'Проверить промежуточные этапы, подтвердить готовность ответственных и закрыть выполненные пункты.',
      priority: 'High',
      department: isEn ? 'Operations' : 'Операционный блок',
      due_date: next3Days,
    });

    if (isExecutive && primaryLead) {
      suggestedTasks.push({
        title: isEn
          ? `Advance contract stage with ${primaryLead.client_name}`
          : `Согласовать договор и спецификацию с «${primaryLead.client_name}»`,
        description: isEn
          ? `Deal value: ${formatMoney(primaryLead.amount || 0)}. Confirm invoice and signing date.`
          : `Сумма контракта: ${formatMoney(primaryLead.amount || 0)}. Зафиксировать дату подписания и выставления счета.`,
        priority: 'Medium',
        department: primaryLead.department || (isEn ? 'Sales' : 'Отдел продаж'),
        due_date: next3Days,
      });
    }
  }

  return {
    headline,
    highlights,
    metrics,
    actionLinks,
    suggestedTasks,
  };
}

export const TedCloudAiDrawer: React.FC<TedCloudAiDrawerProps> = ({
  isOpen,
  onClose,
  company,
  companyName: companyNameProp,
  currentProfile,
  tasks,
  leads,
  nodes,
  messages,
  canCreateTasks = true,
  canViewCrm = true,
  onRefreshWorkspace,
  onCreateFollowUpTask,
  onNavigateToCrm,
  onNavigateToTasks,
  onCreateSuggestedTask,
  onSelectSection,
  onSelectTask,
  onSelectLead,
}) => {
  const { language, theme, formatMoney, formatRole } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';

  const resolvedCompanyName =
    companyNameProp || company?.name || (isEn ? 'TedCloud Enterprise' : 'TedCloud');

  const [persona, setPersona] = useState<TeddyPersonaMode>('operations');
  const [promptInput, setPromptInput] = useState('');
  const [addedTitles, setAddedTitles] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const userRole = currentProfile?.role_type || 'Member';
  const userName = currentProfile?.name || (isEn ? 'Executive' : 'Руководитель');

  const initialBrief = useMemo(
    () =>
      buildTeddyExecutiveBrief({
        prompt:
          persona === 'finance'
            ? 'crm pipeline revenue'
            : persona === 'automation'
            ? 'overdue tasks sla automation'
            : 'executive brief',
        persona,
        isEn,
        companyName: resolvedCompanyName,
        userRole,
        userName,
        tasks,
        leads: canViewCrm ? leads : [],
        nodes,
        messages,
        formatMoney,
      }),
    [
      persona,
      isEn,
      resolvedCompanyName,
      userRole,
      userName,
      tasks,
      leads,
      canViewCrm,
      nodes,
      messages,
      formatMoney,
    ]
  );

  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);

  const effectiveHistory: ChatTurn[] = useMemo(() => {
    const welcomeTurn: ChatTurn = {
      id: 'teddy-welcome',
      role: 'assistant',
      persona,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: initialBrief.headline,
      highlights: initialBrief.highlights,
      metrics: initialBrief.metrics,
      actionLinks: initialBrief.actionLinks,
      suggestedTasks: initialBrief.suggestedTasks,
    };
    return [welcomeTurn, ...chatHistory];
  }, [initialBrief, chatHistory, persona]);

  useEffect(() => {
    if (scrollContainerRef.current && chatHistory.length > 0) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [chatHistory.length, isThinking]);

  const formatPriorityLabel = (priority: 'High' | 'Medium' | 'Low') => {
    if (isEn) return priority;
    if (priority === 'High') return 'Высокий';
    if (priority === 'Low') return 'Низкий';
    return 'Средний';
  };

  if (!isOpen) return null;

  const handleAddRecommendedTask = async (st: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    department: string;
    due_date: string;
  }) => {
    setAddedTitles((prev) => (prev.includes(st.title) ? prev : [...prev, st.title]));

    if (onCreateSuggestedTask) {
      await onCreateSuggestedTask(st);
      return;
    }

    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          payload: {
            company_id: currentProfile?.company_id || company?.id || 'default',
            title: st.title,
            description: st.description,
            priority: st.priority,
            status: 'Todo',
            department: st.department || currentProfile?.department || null,
            due_date: st.due_date,
            owner_node_id: currentProfile?.id || null,
            assigned_to: currentProfile?.id || null,
          },
        }),
      });
      if (onRefreshWorkspace) {
        onRefreshWorkspace();
      }
    } catch {
      if (onCreateFollowUpTask) {
        onCreateFollowUpTask(st.title);
      }
    }
  };

  const handleAsk = async (customPrompt?: string) => {
    const query = (customPrompt ?? promptInput).trim();
    if (!query || isThinking) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: nowTime,
    };

    const localBrief = buildTeddyExecutiveBrief({
      prompt: query,
      persona,
      isEn,
      companyName: resolvedCompanyName,
      userRole,
      userName,
      tasks,
      leads: canViewCrm ? leads : [],
      nodes,
      messages,
      formatMoney,
    });

    setChatHistory((prev) => [...prev, userTurn]);
    if (!customPrompt) setPromptInput('');
    setIsThinking(true);

    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'ai_assistant',
          mode: 'custom',
          personaMode: persona,
          lang: isEn ? 'en' : 'ru',
          companyId: currentProfile?.company_id || company?.id || 'default',
          companyName: resolvedCompanyName,
          prompt: query,
          currentUser: currentProfile,
          nodes,
          tasks,
          leads: canViewCrm ? leads : [],
          messages,
        }),
      });

      let aiSummaryText = localBrief.headline;
      let aiHighlights = localBrief.highlights;
      let aiTasks = localBrief.suggestedTasks;

      if (response.ok) {
        const data = await response.json();
        if (data?.reply && typeof data.reply === 'string' && data.reply.trim().length > 10) {
          aiSummaryText = data.reply.trim();
        } else if (
          data?.summary &&
          typeof data.summary === 'string' &&
          data.summary.trim().length > 10
        ) {
          aiSummaryText = data.summary.trim();
        }
        if (Array.isArray(data?.highlights) && data.highlights.length > 0) {
          aiHighlights = data.highlights;
        }
        if (Array.isArray(data?.suggestedTasks) && data.suggestedTasks.length > 0) {
          aiTasks = data.suggestedTasks;
        }
      }

      const assistantTurn: ChatTurn = {
        id: `ai-${Date.now() + 1}`,
        role: 'assistant',
        persona,
        text: aiSummaryText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        highlights: aiHighlights,
        metrics: localBrief.metrics,
        actionLinks: localBrief.actionLinks,
        suggestedTasks: aiTasks,
      };

      setChatHistory((prev) => [...prev, assistantTurn]);
    } catch {
      const assistantTurn: ChatTurn = {
        id: `ai-${Date.now() + 1}`,
        role: 'assistant',
        persona,
        text: localBrief.headline,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        highlights: localBrief.highlights,
        metrics: localBrief.metrics,
        actionLinks: localBrief.actionLinks,
        suggestedTasks: localBrief.suggestedTasks,
      };
      setChatHistory((prev) => [...prev, assistantTurn]);
    } finally {
      setIsThinking(false);
    }
  };

  const quickChips = [
    {
      label: isEn ? '3 Key Decisions Today' : '3 главных решения дня',
      prompt: isEn
        ? 'Give me the 3 highest-leverage executive decisions for today based on tasks and CRM.'
        : 'Дай 3 главных управленческих решения на сегодня по задачам и сделкам.',
      icon: Target,
    },
    ...(canViewCrm
      ? [
          {
            label: isEn ? 'CRM Pipeline & Revenue' : 'Аудит воронки CRM и выручки',
            prompt: isEn
              ? 'Analyze active CRM deals, revenue pipeline, and key bottlenecks.'
              : 'Проанализируй активные сделки CRM, потенциал выручки и узкие места.',
            icon: TrendingUp,
          },
        ]
      : []),
    {
      label: isEn ? 'Overdue & SLA Risks' : 'Просрочки и риски дедлайнов',
      prompt: isEn
        ? 'Identify overdue tasks and SLA bottlenecks across departments.'
        : 'Какие задачи просрочены или находятся под риском срыва дедлайна?',
      icon: ShieldAlert,
    },
    {
      label: isEn ? 'Team Workload Balance' : 'Разбор загрузки команды',
      prompt: isEn
        ? 'Analyze team workload distribution and identify overloaded specialists.'
        : 'Проведи разбор загрузки сотрудников и найди узкие места в штате.',
      icon: UserCheck,
    },
  ];

  const analysisModes: Array<{
    id: TeddyPersonaMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'operations',
      label: isEn ? 'Operations Control' : 'Операционный контроль',
      icon: Activity,
    },
    {
      id: 'finance',
      label: isEn ? 'Financial Analytics' : 'Финансовая аналитика',
      icon: DollarSign,
    },
    {
      id: 'automation',
      label: isEn ? 'Task Automation' : 'Автоматизация задач',
      icon: Cpu,
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 font-sans transition-colors ${
        isLight ? 'bg-slate-900/35 backdrop-blur-md' : 'bg-black/65 backdrop-blur-md'
      }`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-4xl h-[92dvh] sm:h-[85dvh] rounded-3xl flex flex-col overflow-hidden backdrop-blur-3xl transition-all ${
          isLight
            ? 'bg-white/80 border border-slate-200/80 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]'
            : 'bg-zinc-900/65 border border-white/[0.09] text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.1)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Blur Spheres behind frosted glass */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          <div
            className={`absolute -top-24 -left-20 w-80 h-80 rounded-full blur-3xl ${
              isLight ? 'bg-indigo-400/15' : 'bg-indigo-500/15'
            }`}
          />
          <div
            className={`absolute top-1/3 -right-24 w-72 h-72 rounded-full blur-3xl ${
              isLight ? 'bg-sky-400/15' : 'bg-violet-500/10'
            }`}
          />
        </div>

        {/* =================================================================
            1. FIXED HEADER (shrink-0): Clean Branding + 1-Line Segmented Control + Quick Scenarios
        ================================================================== */}
        <div
          className={`relative z-10 shrink-0 px-5 sm:px-6 pt-4 pb-3.5 border-b ${
            isLight
              ? 'border-slate-200/80 bg-white/60'
              : 'border-white/[0.07] bg-zinc-950/30'
          }`}
        >
          {/* Top Row: Teddy Identity + Close */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeddyAvatar size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2
                    className={`text-base font-bold tracking-tight ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    Teddy
                  </h2>
                  <span
                    className={`text-xs font-medium ${
                      isLight ? 'text-slate-500' : 'text-zinc-400'
                    }`}
                  >
                    {isEn ? 'Executive AI Assistant' : 'Корпоративный ИИ-ассистент'}
                  </span>
                </div>
                <p
                  className={`text-[11px] truncate flex items-center gap-1.5 mt-0.5 ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}
                >
                  <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{resolvedCompanyName}</span>
                  <span>·</span>
                  <span>
                    {userName} ({formatRole(userRole)})
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Teddy' : 'Закрыть Teddy'}
              className={`p-2 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                isLight
                  ? 'border-slate-200/80 bg-white/80 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  : 'border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Compact 1-Line Segmented Control for Analysis Modes */}
          <div
            className={`mt-3 grid grid-cols-3 gap-1 p-1 rounded-xl border ${
              isLight
                ? 'bg-slate-100/90 border-slate-200/80'
                : 'bg-black/30 border-white/[0.07]'
            }`}
          >
            {analysisModes.map((mode) => {
              const Icon = mode.icon;
              const active = persona === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPersona(mode.id)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer truncate ${
                    active
                      ? isLight
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70'
                        : 'bg-white/[0.12] text-white shadow-xs border border-white/[0.12]'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      active ? 'text-indigo-400' : isLight ? 'text-slate-400' : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate">{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Scenario Buttons */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {quickChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => void handleAsk(chip.prompt)}
                  disabled={isThinking}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer ${
                    isLight
                      ? 'border-slate-200/90 bg-white/80 hover:bg-indigo-50/70 hover:border-indigo-300 text-slate-700'
                      : 'border-white/[0.08] bg-white/[0.04] hover:bg-indigo-500/15 hover:border-indigo-400/40 text-zinc-200'
                  }`}
                >
                  <Icon className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================
            2. SCROLLABLE DIALOG AREA (flex-1 overflow-y-auto pt-4 pb-6 px-6 space-y-4)
        ================================================================== */}
        <div
          ref={scrollContainerRef}
          className="relative z-10 flex-1 overflow-y-auto pt-4 pb-6 px-5 sm:px-6 space-y-4"
        >
          {effectiveHistory.map((turn) => (
            <div
              key={turn.id}
              className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[95%] sm:max-w-[90%] rounded-2xl p-4 sm:p-5 space-y-3.5 transition-all ${
                  turn.role === 'user'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isLight
                    ? 'bg-white/90 border border-slate-200/80 text-slate-800 shadow-sm'
                    : 'bg-white/[0.04] border border-white/[0.08] text-zinc-100 shadow-xs'
                }`}
              >
                {/* Turn Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {turn.role === 'assistant' ? (
                      <>
                        <TeddyAvatar size="xs" />
                        <span
                          className={`text-xs font-bold ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          Teddy
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                            isLight
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300'
                          }`}
                        >
                          {turn.persona === 'finance'
                            ? isEn
                              ? 'Financial Analytics'
                              : 'Финансовая аналитика'
                            : turn.persona === 'automation'
                            ? isEn
                              ? 'Task Automation'
                              : 'Автоматизация задач'
                            : isEn
                            ? 'Operations Control'
                            : 'Операционный контроль'}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-indigo-100">{userName}</span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] tabular-nums ${
                      turn.role === 'user'
                        ? 'text-indigo-200'
                        : isLight
                        ? 'text-slate-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {turn.timestamp}
                  </span>
                </div>

                {/* Live Metric Badges */}
                {turn.metrics && turn.metrics.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {turn.metrics.map((m, idx) => (
                      <div
                        key={`${turn.id}-m-${idx}`}
                        className={`rounded-xl px-3 py-2 border ${
                          m.tone === 'emerald'
                            ? isLight
                              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                              : 'bg-emerald-500/[0.07] border-emerald-500/25 text-emerald-300'
                            : m.tone === 'rose'
                            ? isLight
                              ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                              : 'bg-rose-500/[0.07] border-rose-500/25 text-rose-300'
                            : m.tone === 'amber'
                            ? isLight
                              ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                              : 'bg-amber-500/[0.07] border-amber-500/25 text-amber-300'
                            : m.tone === 'indigo'
                            ? isLight
                              ? 'bg-indigo-50/90 border-indigo-200 text-indigo-800'
                              : 'bg-indigo-500/[0.07] border-indigo-500/25 text-indigo-300'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-800'
                            : 'bg-white/[0.03] border-white/[0.07] text-zinc-200'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider opacity-75 truncate">
                          {m.label}
                        </div>
                        <div className="text-xs font-bold tabular-nums mt-0.5 truncate">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Main Executive Headline */}
                <p
                  className={`text-xs sm:text-sm leading-relaxed font-medium whitespace-pre-wrap ${
                    turn.role === 'user'
                      ? 'text-white'
                      : isLight
                      ? 'text-slate-800'
                      : 'text-zinc-100'
                  }`}
                >
                  {turn.text}
                </p>

                {/* Structured Bullet Highlights */}
                {turn.highlights && turn.highlights.length > 0 && (
                  <div
                    className={`space-y-2 pt-1 border-t ${
                      isLight ? 'border-slate-200/70' : 'border-white/[0.06]'
                    }`}
                  >
                    {turn.highlights.map((h, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 text-xs leading-relaxed ${
                          isLight ? 'text-slate-600' : 'text-zinc-300'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct Deep-Links to Tasks, Deals & Modules */}
                {turn.actionLinks && turn.actionLinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {turn.actionLinks.map((link, idx) => (
                      <button
                        key={`${turn.id}-link-${idx}`}
                        type="button"
                        onClick={() => {
                          if (link.taskId && onSelectTask) {
                            onClose();
                            onSelectTask(link.taskId);
                          } else if (link.leadId && onSelectLead) {
                            onClose();
                            onSelectLead(link.leadId);
                          } else if (link.targetSection && onSelectSection) {
                            onClose();
                            onSelectSection(link.targetSection);
                          } else if (link.targetSection === 'crm' && onNavigateToCrm) {
                            onClose();
                            onNavigateToCrm();
                          } else if (link.targetSection === 'tasks' && onNavigateToTasks) {
                            onClose();
                            onNavigateToTasks();
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          isLight
                            ? 'border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700'
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white'
                        }`}
                      >
                        {link.leadId ? (
                          <Briefcase className="w-3 h-3 text-amber-400" />
                        ) : link.taskId ? (
                          <ListTodo className="w-3 h-3 text-indigo-400" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        )}
                        <span className="truncate max-w-[240px]">{link.label}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-60" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 1-Click Actionable Task Creation Cards */}
                {canCreateTasks && turn.suggestedTasks && turn.suggestedTasks.length > 0 && (
                  <div
                    className={`pt-2.5 border-t space-y-2 ${
                      isLight ? 'border-slate-200/70' : 'border-white/[0.07]'
                    }`}
                  >
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                        isLight ? 'text-indigo-600' : 'text-indigo-300'
                      }`}
                    >
                      <ListTodo className="w-3 h-3" />
                      <span>
                        {isEn
                          ? 'Recommended Actions (1-Click to Task Registry)'
                          : 'Рекомендованные поручения (в реестр за 1 клик)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {turn.suggestedTasks.map((st, idx) => {
                        const isAdded = addedTitles.includes(st.title);
                        return (
                          <div
                            key={`${turn.id}-task-${idx}`}
                            className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${
                              isLight
                                ? 'border-slate-200/90 bg-slate-50/80'
                                : 'border-white/[0.08] bg-black/25'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                    st.priority === 'High'
                                      ? isLight
                                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                                      : isLight
                                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                  }`}
                                >
                                  {formatPriorityLabel(st.priority)}
                                </span>
                                <span
                                  className={`text-[10px] truncate ${
                                    isLight ? 'text-slate-500' : 'text-zinc-400'
                                  }`}
                                >
                                  {formatRole(st.department)}
                                </span>
                              </div>
                              <div
                                className={`text-xs font-semibold leading-snug ${
                                  isLight ? 'text-slate-900' : 'text-white'
                                }`}
                              >
                                {st.title}
                              </div>
                              <div
                                className={`text-[11px] line-clamp-2 ${
                                  isLight ? 'text-slate-600' : 'text-zinc-400'
                                }`}
                              >
                                {st.description}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] tabular-nums ${
                                  isLight ? 'text-slate-500' : 'text-zinc-500'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {st.due_date}
                              </span>

                              <button
                                type="button"
                                disabled={isAdded}
                                onClick={() => void handleAddRecommendedTask(st)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors shrink-0 cursor-pointer ${
                                  isAdded
                                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                    : isLight
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                    : 'bg-white text-black hover:bg-zinc-200'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{isEn ? 'Created' : 'В работе'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" />
                                    <span>{isEn ? 'To Work' : 'В работу'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.07] w-fit text-xs text-indigo-300">
              <TeddyAvatar size="xs" />
              <span className="animate-pulse">
                {isEn
                  ? 'Teddy is analyzing live company metrics...'
                  : 'Teddy анализирует показатели вашей компании...'}
              </span>
            </div>
          )}
        </div>

        {/* =================================================================
            3. BOTTOM COMPOSER CAPSULE (shrink-0 p-4 border-t)
        ================================================================== */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAsk();
          }}
          className={`relative z-10 shrink-0 p-4 border-t ${
            isLight
              ? 'border-slate-200/80 bg-white/70'
              : 'border-white/[0.07] bg-zinc-950/40'
          }`}
        >
          <div
            className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 transition-colors ${
              isLight
                ? 'bg-slate-100/80 border-slate-200/90 focus-within:border-indigo-400 focus-within:bg-white'
                : 'bg-white/[0.05] border-white/[0.08] focus-within:border-indigo-500/50 focus-within:bg-white/[0.07]'
            }`}
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={
                isEn
                  ? 'Ask Teddy about tasks, CRM deals, revenue, or team workload...'
                  : 'Спросите Teddy о задачах, сделках CRM, выручке или загрузке отдела...'
              }
              className={`tc-composer-input flex-1 !bg-transparent border-0 text-xs sm:text-sm focus:outline-none ${
                isLight
                  ? '!text-slate-900 placeholder-slate-400'
                  : '!text-zinc-100 placeholder-zinc-500'
              }`}
            />
            <button
              type="submit"
              disabled={!promptInput.trim() || isThinking}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 shrink-0 shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEn ? 'Ask Teddy' : 'Спросить'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
