import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Plus,
  CheckCircle2,
  ListTodo,
  Clock,
  ArrowUpRight,
  Building2,
  Briefcase,
  Bot,
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

export type TeddyPersonaMode = 'assistant' | 'actions' | 'operations' | 'finance' | 'automation';

export interface TeddyAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const TeddyAvatar: React.FC<TeddyAvatarProps> = ({ size = 'sm', className = '' }) => {
  const boxDims =
    size === 'xs'
      ? 'w-6 h-6 rounded-md'
      : size === 'lg'
      ? 'w-9 h-9 rounded-xl'
      : 'w-7 h-7 rounded-lg';
  const iconDims =
    size === 'xs' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <div
      className={`${boxDims} bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 ${className}`}
      title="Teddy"
    >
      <Bot className={iconDims} />
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

function translateStatusRu(status: string | undefined, isEn: boolean): string {
  const s = String(status || '').trim();
  if (isEn) return s || 'In Progress';
  if (s === 'Todo' || s === 'To Do') return 'К выполнению';
  if (s === 'In Progress' || s === 'InProgress') return 'В работе';
  if (s === 'Done' || s === 'Completed') return 'Выполнено';
  if (s === 'New') return 'Новая';
  if (s === 'Qualified') return 'Квалификация';
  if (s === 'Proposal') return 'КП отправлено';
  if (s === 'Negotiation') return 'Согласование';
  if (s === 'Won' || s === 'Closed Won') return 'Успешно закрыта';
  if (s === 'Lost' || s === 'Closed Lost') return 'Закрыта без сделки';
  return s || 'К выполнению';
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

  const attentionCount = highPriorityOpen.length + overdueTasks.length;

  const metrics: TeddyMetricBadge[] = [
    {
      label: isEn ? 'Plan Completion' : 'Выполнение плана',
      value: `${completionRate}% (${doneTasks.length}/${tasks.length})`,
      tone: completionRate >= 65 ? 'emerald' : completionRate >= 40 ? 'amber' : 'rose',
    },
    {
      label: isEn ? 'Needs Attention' : 'Требуют внимания',
      value: isEn
        ? `${highPriorityOpen.length} urgent · ${overdueTasks.length} overdue`
        : `${highPriorityOpen.length} срочных · ${overdueTasks.length} просрочено`,
      tone: overdueTasks.length > 0 ? 'rose' : highPriorityOpen.length > 0 ? 'amber' : 'emerald',
    },
    {
      label: isEn ? 'Active Staff' : 'Активный штат',
      value: isEn ? `${nodes.length} specialists` : `${nodes.length} сотр.`,
      tone: 'indigo',
    },
  ];

  const workloadByNode = new Map<string, { name: string; dept: string; open: number; high: number }>();
  for (const n of nodes) {
    workloadByNode.set(n.id, {
      name: n.name || (isEn ? 'Specialist' : 'Сотрудник'),
      dept: n.department || (isEn ? 'Operations' : 'Операционный отдел'),
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

  const isFinanceFocus =
    q.includes('crm') ||
    q.includes('сделк') ||
    q.includes('выруч') ||
    q.includes('воронк') ||
    q.includes('финанс') ||
    q.includes('revenue') ||
    q.includes('pipeline');

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
      ? `In ${companyName}, ${activeLeads.length} deals are currently active worth ${formatMoney(pipelineAmount)}, with ${formatMoney(wonAmount)} already closed.`
      : `По компании «${companyName}» в работе находится ${activeLeads.length} сделок на сумму ${formatMoney(pipelineAmount)}, уже закрыто контрактов на ${formatMoney(wonAmount)}.`;

    if (primaryLead) {
      highlights.push(
        isEn
          ? `Key deal "${primaryLead.client_name}" for ${formatMoney(primaryLead.amount || 0)} is at the "${translateStatusRu(primaryLead.status, true)}" stage — align final contract terms today.`
          : `Крупнейшая сделка «${primaryLead.client_name}» на сумму ${formatMoney(primaryLead.amount || 0)} находится на этапе «${translateStatusRu(primaryLead.status, false)}» — рекомендуется согласовать график оплаты.`
      );
      actionLinks.push({
        label: isEn ? `Open "${primaryLead.client_name}"` : `Сделка «${primaryLead.client_name}»`,
        leadId: primaryLead.id,
      });
    }
  } else {
    headline = isEn
      ? `Across ${companyName}, ${doneTasks.length} of ${tasks.length} tasks are completed (${completionRate}%). ${
          attentionCount > 0
            ? `${highPriorityOpen.length} urgent tasks are in work and ${overdueTasks.length} require deadline updates.`
            : 'All active tasks are progressing on schedule.'
        }${isExecutive && activeLeads.length > 0 ? ` Active CRM pipeline stands at ${formatMoney(pipelineAmount)}.` : ''}`
      : `По компании «${companyName}» закрыто ${doneTasks.length} из ${tasks.length} задач (${completionRate}%). ${
          attentionCount > 0
            ? `Сейчас ${highPriorityOpen.length} срочных поручений требуют фокуса, просроченных — ${overdueTasks.length}.`
            : 'Все текущие задачи выполняются в плановом графике без просрочек.'
        }${isExecutive && activeLeads.length > 0 ? ` В воронке CRM в работе сделки на ${formatMoney(pipelineAmount)}.` : ''}`;

    if (highPriorityOpen.length > 0) {
      const topTask = highPriorityOpen[0];
      const ruStatus = translateStatusRu(topTask.status, isEn);
      highlights.push(
        isEn
          ? `Key task in focus: "${topTask.title}" (${topTask.department || 'Operations'}, status: ${ruStatus}).`
          : `Главная задача в фокусе: «${topTask.title}» (${topTask.department || 'Операционный отдел'}, статус: ${ruStatus}).`
      );
      actionLinks.push({
        label: isEn ? `Task "${topTask.title}"` : `Задача «${topTask.title}»`,
        taskId: topTask.id,
      });
    }

    if (isExecutive && primaryLead) {
      const ruLeadStage = translateStatusRu(primaryLead.status, isEn);
      highlights.push(
        isEn
          ? `Commercial priority: advance deal "${primaryLead.client_name}" (${formatMoney(primaryLead.amount || 0)}, stage: ${ruLeadStage}).`
          : `Приоритетная сделка: «${primaryLead.client_name}» на ${formatMoney(primaryLead.amount || 0)} (этап: ${ruLeadStage}).`
      );
      actionLinks.push({
        label: isEn ? `Deal "${primaryLead.client_name}"` : `Сделка «${primaryLead.client_name}»`,
        leadId: primaryLead.id,
      });
    }

    if (topBusy && topBusy.open > 0) {
      highlights.push(
        isEn
          ? `Team workload: ${topBusy.name} is leading ${topBusy.open} open tasks (${topBusy.high} urgent).`
          : `Загрузка команды: у сотрудника ${topBusy.name} в работе ${topBusy.open} поручений (из них срочных — ${topBusy.high}).`
      );
    }
  }

  actionLinks.push({
    label: isEn ? 'Open Tasks' : 'Перейти к задачам',
    targetSection: 'tasks',
  });
  if (isExecutive) {
    actionLinks.push({
      label: isEn ? 'Open CRM' : 'Открыть CRM',
      targetSection: 'crm',
    });
  }

  suggestedTasks.push({
    title: isEn
      ? `Review deadlines on ${Math.max(1, highPriorityOpen.length)} urgent tasks`
      : `Проверить готовность по срочным поручениям (${Math.max(1, highPriorityOpen.length)} шт.)`,
    description: isEn
      ? 'Confirm deliverables with assignees and close completed items in the task board.'
      : 'Сверить промежуточные результаты с ответственными и закрыть выполненные этапы.',
    priority: 'High',
    department: isEn ? 'Operations' : 'Операционный блок',
    due_date: next3Days,
  });

  if (isExecutive && primaryLead) {
    suggestedTasks.push({
      title: isEn
        ? `Finalize commercial offer for ${primaryLead.client_name}`
        : `Согласовать условия договора и счет с «${primaryLead.client_name}»`,
      description: isEn
        ? `Deal value: ${formatMoney(primaryLead.amount || 0)}. Confirm contract specification and payment schedule.`
        : `Сумма контракта: ${formatMoney(primaryLead.amount || 0)}. Зафиксировать спецификацию и дату оплаты.`,
      priority: 'Medium',
      department: primaryLead.department || (isEn ? 'Sales' : 'Отдел продаж'),
      due_date: next3Days,
    });
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

  const [viewTab, setViewTab] = useState<'assistant' | 'actions'>('assistant');
  const [promptInput, setPromptInput] = useState('');
  const [addedTitles, setAddedTitles] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const userRole = currentProfile?.role_type || 'Member';
  const userName = currentProfile?.name || (isEn ? 'Executive' : 'Руководитель');

  const initialBrief = useMemo(
    () =>
      buildTeddyExecutiveBrief({
        prompt: 'executive brief',
        persona: viewTab,
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
      viewTab,
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
      persona: viewTab,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: initialBrief.headline,
      highlights: initialBrief.highlights,
      metrics: initialBrief.metrics,
      actionLinks: initialBrief.actionLinks,
      suggestedTasks: initialBrief.suggestedTasks,
    };
    return [welcomeTurn, ...chatHistory];
  }, [initialBrief, chatHistory, viewTab]);

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
      persona: viewTab,
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
          personaMode: 'operations',
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
        persona: viewTab,
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
        persona: viewTab,
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

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 font-sans transition-colors ${
        isLight ? 'bg-slate-900/35 backdrop-blur-sm' : 'bg-black/65 backdrop-blur-sm'
      }`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl h-[88dvh] sm:h-[82dvh] rounded-2xl flex flex-col overflow-hidden transition-all ${
          isLight
            ? 'bg-white border border-slate-200/90 text-slate-900 shadow-2xl'
            : 'bg-zinc-950 border border-white/[0.09] text-zinc-100 shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`shrink-0 px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
            isLight
              ? 'border-slate-200/80 bg-slate-50/60'
              : 'border-white/[0.07] bg-zinc-900/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  className={`text-sm font-semibold tracking-tight ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Teddy
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-medium text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{resolvedCompanyName}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`inline-flex items-center p-0.5 rounded-lg border text-xs ${
                isLight
                  ? 'bg-slate-100 border-slate-200/90'
                  : 'bg-zinc-900 border-white/[0.08]'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewTab('assistant')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewTab === 'assistant'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'bg-zinc-800 text-white shadow-2xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isEn ? 'Assistant' : 'Ассистент'}
              </button>
              <button
                type="button"
                onClick={() => setViewTab('actions')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewTab === 'actions'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'bg-zinc-800 text-white shadow-2xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isEn ? 'Auto-Actions' : 'Авто-действия'}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close Teddy' : 'Закрыть Teddy'}
              className={`p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                isLight
                  ? 'border-slate-200/80 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  : 'border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 w-full overflow-y-auto px-5 py-5 space-y-4"
        >
          {effectiveHistory.map((turn) => (
            <div
              key={turn.id}
              className={`w-full flex flex-col ${
                turn.role === 'user' ? 'items-end' : 'items-stretch'
              }`}
            >
              <div
                className={`rounded-2xl p-4 sm:p-5 space-y-4 transition-all ${
                  turn.role === 'user'
                    ? 'max-w-[80%] bg-indigo-600 text-white shadow-xs'
                    : isLight
                    ? 'w-full bg-slate-50/70 border border-slate-200/90 text-slate-900 shadow-2xs'
                    : 'w-full bg-zinc-900/70 border border-white/[0.08] text-zinc-100 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {turn.role === 'assistant' ? (
                      <>
                        <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          Teddy
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-indigo-100">{userName}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] tabular-nums ${
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

                {turn.metrics && turn.metrics.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {turn.metrics.slice(0, 3).map((m, idx) => (
                      <div
                        key={`${turn.id}-m-${idx}`}
                        className={`rounded-xl px-3.5 py-2.5 border ${
                          m.tone === 'emerald'
                            ? isLight
                              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                              : 'bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300'
                            : m.tone === 'rose'
                            ? isLight
                              ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                              : 'bg-rose-500/[0.08] border-rose-500/25 text-rose-300'
                            : m.tone === 'amber'
                            ? isLight
                              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                              : 'bg-amber-500/[0.08] border-amber-500/25 text-amber-300'
                            : isLight
                            ? 'bg-white border-slate-200/90 text-slate-900'
                            : 'bg-zinc-950/60 border-white/[0.08] text-zinc-200'
                        }`}
                      >
                        <div className="text-[11px] font-medium opacity-75 truncate">
                          {m.label}
                        </div>
                        <div className="text-xs font-semibold tabular-nums mt-0.5 truncate">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewTab === 'assistant' && (
                  <>
                    <p
                      className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        turn.role === 'user'
                          ? 'text-white font-medium'
                          : isLight
                          ? 'text-slate-800'
                          : 'text-zinc-200'
                      }`}
                    >
                      {turn.text}
                    </p>

                    {turn.highlights && turn.highlights.length > 0 && (
                      <div
                        className={`space-y-2 pt-2.5 border-t ${
                          isLight ? 'border-slate-200/80' : 'border-white/[0.07]'
                        }`}
                      >
                        {turn.highlights.map((h, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-2.5 text-xs leading-relaxed ${
                              isLight ? 'text-slate-700' : 'text-zinc-300'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    )}

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
                                ? 'border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-700'
                                : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white'
                            }`}
                          >
                            {link.leadId ? (
                              <Briefcase className="w-3 h-3 text-amber-500" />
                            ) : link.taskId ? (
                              <ListTodo className="w-3 h-3 text-indigo-500" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                            )}
                            <span className="truncate max-w-[240px]">{link.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {canCreateTasks && turn.suggestedTasks && turn.suggestedTasks.length > 0 && (
                  <div
                    className={`pt-3 border-t space-y-2.5 ${
                      isLight ? 'border-slate-200/80' : 'border-white/[0.07]'
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold flex items-center gap-1.5 ${
                        isLight ? 'text-slate-800' : 'text-zinc-200'
                      }`}
                    >
                      <ListTodo className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        {isEn ? 'Suggested Tasks' : 'Конкретные поручения к запуску'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {turn.suggestedTasks.map((st, idx) => {
                        const isAdded = addedTitles.includes(st.title);
                        return (
                          <div
                            key={`${turn.id}-task-${idx}`}
                            className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                              isLight
                                ? 'border-slate-200/90 bg-white shadow-2xs'
                                : 'border-white/[0.08] bg-zinc-950/70'
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
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                                  isAdded
                                    ? isLight
                                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                      : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{isEn ? 'Created' : 'Создано'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" />
                                    <span>
                                      {isEn ? 'Create Task' : 'Создать поручение'}
                                    </span>
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
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.07] w-full text-xs text-indigo-500 dark:text-indigo-300">
              <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="animate-pulse">
                {isEn
                  ? 'Teddy is analyzing workspace data...'
                  : 'Teddy анализирует данные компании...'}
              </span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAsk();
          }}
          className={`shrink-0 p-4 border-t ${
            isLight
              ? 'border-slate-200/80 bg-slate-50/70'
              : 'border-white/[0.07] bg-zinc-900/60'
          }`}
        >
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 transition-colors ${
              isLight
                ? 'bg-white border-slate-200/90 focus-within:border-indigo-500'
                : 'bg-zinc-950 border-white/[0.09] focus-within:border-indigo-500/50'
            }`}
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={
                isEn
                  ? 'Ask Teddy about tasks, deals, or team workload...'
                  : 'Спросите Teddy о задачах, сделках или загрузке команды...'
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
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isEn ? 'Ask' : 'Спросить'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
