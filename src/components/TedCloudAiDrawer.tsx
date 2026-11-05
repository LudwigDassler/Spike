import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Loader2,
  Plus,
  Check,
  Printer,
  Trash2,
  Mic,
  MicOff,
  CornerDownLeft,
  ArrowRight,
  Briefcase,
  Clock,
  FileText,
  Layers,
  Activity,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import { CrmLeadRecord, OrganizationNode, TaskPriority, TaskRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';
import {
  getAiQuotaState,
  incrementAiQuotaUsage,
  recordImmutableAuditEntry,
} from '../utils/saasEnterpriseEngine';

export interface TeddyAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP: Record<NonNullable<TeddyAvatarProps['size']>, string> = {
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

const ICON_SIZE_MAP: Record<NonNullable<TeddyAvatarProps['size']>, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

/**
 * Neutral CloudCode-inspired architectural emblem:
 * Geometric cloud-circuit silhouette with code/orchestration brackets and central node.
 */
export const TeddyPrismIcon: React.FC<TeddyAvatarProps> = ({
  size = 'sm',
  className = '',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className || SIZE_MAP[size] || 'w-4 h-4'}
    aria-hidden="true"
  >
    {/* Outer CloudCode architectural cloud-frame */}
    <path
      d="M6.5 18.5H17.2C19.57 18.5 21.5 16.57 21.5 14.2C21.5 12.08 19.96 10.32 17.93 9.96C17.25 6.84 14.48 4.5 11.15 4.5C7.34 4.5 4.25 7.59 4.25 11.4C4.25 11.69 4.27 11.98 4.31 12.26C2.98 12.88 2.05 14.23 2.05 15.8C2.05 17.29 3.26 18.5 4.75 18.5H6.5Z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Code & workflow brackets inside cloud core */}
    <path
      d="M9.4 10.3L7.4 12.3L9.4 14.3"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.6 10.3L16.6 12.3L14.6 14.3"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Central orchestration node */}
    <circle cx="12" cy="12.3" r="1.25" fill="currentColor" />
  </svg>
);

export const TeddyAvatar: React.FC<TeddyAvatarProps> = ({
  size = 'md',
  className = '',
}) => (
  <div
    className={`rounded-lg bg-slate-900 text-white border border-slate-800 dark:bg-white/[0.08] dark:text-white dark:border-white/[0.14] flex items-center justify-center shrink-0 shadow-2xs ${SIZE_MAP[size]} ${className}`}
  >
    <TeddyPrismIcon className={ICON_SIZE_MAP[size]} />
  </div>
);

export type SpectralStreamType = 'amber' | 'emerald' | 'sapphire' | 'violet';

export interface StagingRowItem {
  id: string;
  checked: boolean;
  spectrum: SpectralStreamType;
  mode:
    | 'create_task'
    | 'reassign_task'
    | 'followup_lead'
    | 'create_lead'
    | 'prepare_contract'
    | 'telegram_broadcast';
  title: string;
  department: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  existingTaskId?: string;
  leadId?: string;
  dealValue?: number;
  clientName?: string;
}

type CloudCodeCanvasMode = 'decompose' | 'deals_audit' | 'rebalance' | 'contract' | 'brief';

export interface TedCloudAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  planTier?: string;
  currentUser: OrganizationNode;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  onRefreshData: () => Promise<void>;
  onOptimisticTasksAdded?: (newTasks: TaskRecord[]) => void;
  onNavigateToSection?: (
    section: 'overview' | 'tasks' | 'crm' | 'team' | 'workspace' | 'billing'
  ) => void;
  onOpenLegalDocModal?: (lead: CrmLeadRecord, docType?: 'contract' | 'invoice' | 'act') => void;
  showToast?: (msg: string) => void;
}

function getIsoDateOffset(daysAhead: number): string {
  const dt = new Date(Date.now() + daysAhead * 86400000);
  return dt.toISOString().split('T')[0];
}

function getNextWeekdayIso(targetDay: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  let diff = (targetDay - currentDay + 7) % 7;
  if (diff === 0) diff = 7;
  const target = new Date(now.getTime() + diff * 86400000);
  return target.toISOString().split('T')[0];
}

function parseRussianAmount(rawText: string): number | null {
  const mlnMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*(?:млн|миллион|m\b)/i);
  if (mlnMatch) {
    const val = parseFloat(mlnMatch[1].replace(',', '.'));
    if (!Number.isNaN(val)) return Math.round(val * 1_000_000);
  }
  const kMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*(?:тыс|к\b|k\b)/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(',', '.'));
    if (!Number.isNaN(val)) return Math.round(val * 1_000);
  }
  const plainMatch = rawText.match(/(\d{4,10})/);
  if (plainMatch) {
    const val = parseInt(plainMatch[1], 10);
    if (!Number.isNaN(val)) return val;
  }
  return null;
}

function getModeTagMeta(mode: StagingRowItem['mode'], isEn: boolean) {
  switch (mode) {
    case 'reassign_task':
      return {
        label: isEn ? 'SLA Rebalance' : 'Балансировка / Перенос',
        badgeClass:
          'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      };
    case 'followup_lead':
      return {
        label: isEn ? 'CRM Follow-up' : 'Дожим сделки CRM',
        badgeClass:
          'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      };
    case 'create_lead':
      return {
        label: isEn ? 'New CRM Deal' : 'Новая сделка CRM',
        badgeClass:
          'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      };
    case 'prepare_contract':
      return {
        label: isEn ? 'Document A4' : 'Документ А4',
        badgeClass:
          'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
      };
    default:
      return {
        label: isEn ? 'Task Step' : 'Этап / Поручение',
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200/90 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/10',
      };
  }
}

export const TedCloudAiDrawer: React.FC<TedCloudAiDrawerProps> = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  planTier = 'Business',
  currentUser,
  nodes,
  tasks,
  leads,
  onRefreshData,
  onOptimisticTasksAdded,
  onOpenLegalDocModal,
  showToast,
}) => {
  const { language, formatMoney } = useLocale();
  const isEn = language === 'en';

  const [inputText, setInputText] = useState<string>('');
  const [activeCanvasMode, setActiveCanvasMode] = useState<CloudCodeCanvasMode>('decompose');
  const [stagingRows, setStagingRows] = useState<StagingRowItem[]>([]);
  const [selectedContractLeadId, setSelectedContractLeadId] = useState<string>(
    leads[0]?.id || ''
  );
  const [isApplyingDb, setIsApplyingDb] = useState<boolean>(false);
  const [isQueryingAi, setIsQueryingAi] = useState<boolean>(false);
  const [aiAnalysisSummary, setAiAnalysisSummary] = useState<string>('');
  const [appliedSuccessBanner, setAppliedSuccessBanner] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>('');
  const [quotaState, setQuotaState] = useState(() => getAiQuotaState(companyId, planTier));

  useEffect(() => {
    setQuotaState(getAiQuotaState(companyId, planTier));
  }, [companyId, planTier, isOpen]);

  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const spotlightInputRef = useRef<HTMLInputElement | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>(['Отдел продаж', 'Производство и ИТ', 'Финансы и Юр. отдел']);
    nodes.forEach((n) => {
      if (n.department && n.department.trim()) set.add(n.department.trim());
    });
    return Array.from(set);
  }, [nodes]);

  const executiveInsights = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== 'Done');
    const todayIso = new Date().toISOString().slice(0, 10);
    const overdueTasks = openTasks.filter(
      (t) => t.due_date && String(t.due_date).slice(0, 10) < todayIso
    );

    const staffLoads = nodes.map((n) => {
      const count = openTasks.filter(
        (t) => t.assigned_to === n.id || t.owner_node_id === n.id
      ).length;
      return { node: n, count };
    });
    staffLoads.sort((a, b) => b.count - a.count);

    const busiest = staffLoads[0] || { node: currentUser, count: openTasks.length };
    const leastBusy =
      staffLoads[staffLoads.length - 1] || { node: nodes[0] || currentUser, count: 0 };

    const activeLeads = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');
    const totalPipelineValue = activeLeads.reduce(
      (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
      0
    );
    const topDeal =
      [...activeLeads].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] ||
      leads[0] ||
      null;

    return {
      openTasksCount: openTasks.length,
      overdueCount: overdueTasks.length,
      busiest,
      leastBusy,
      topDeal,
      totalPipelineValue,
      activeLeadsCount: activeLeads.length,
    };
  }, [tasks, leads, nodes, currentUser]);

  const buildDecompositionRows = (goalTopic?: string): StagingRowItem[] => {
    const cleanTopic = (goalTopic || '').trim();
    const prefix = cleanTopic ? `${cleanTopic} — ` : '';
    const n0 = nodes[0]?.id || currentUser?.id || '';
    const n1 = nodes[1]?.id || n0;
    const n2 = nodes[2]?.id || n0;

    return [
      {
        id: `stg-dec-1-${Date.now()}`,
        checked: true,
        spectrum: 'amber',
        mode: 'create_task',
        title: `${prefix}${
          isEn
            ? 'Prepare commercial specification, estimate & SLA terms'
            : 'Подготовить ТЗ, коммерческую смету и регламент SLA'
        }`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: n0,
        priority: 'High',
        dueDate: getIsoDateOffset(2),
      },
      {
        id: `stg-dec-2-${Date.now()}`,
        checked: true,
        spectrum: 'emerald',
        mode: 'create_task',
        title: `${prefix}${
          isEn
            ? 'Approve supply contract & issue B2B invoice'
            : 'Согласовать договор поставки и выставить счет контрагенту'
        }`,
        department: departments[2] || 'Финансы и Юр. отдел',
        assignedTo: n1,
        priority: 'High',
        dueDate: getIsoDateOffset(3),
      },
      {
        id: `stg-dec-3-${Date.now()}`,
        checked: true,
        spectrum: 'violet',
        mode: 'create_task',
        title: `${prefix}${
          isEn
            ? 'Configure execution pipeline & assign engineering team'
            : 'Настроить рабочий контур исполнения и передать в производство'
        }`,
        department: departments[1] || 'Производство и ИТ',
        assignedTo: n2,
        priority: 'Medium',
        dueDate: getIsoDateOffset(4),
      },
    ];
  };

  const buildDealsAuditRows = (): StagingRowItem[] => {
    const activeLeads = leads.filter((l) => l.status !== 'Won');
    const source = activeLeads.length > 0 ? activeLeads.slice(0, 3) : leads.slice(0, 3);

    if (source.length === 0) {
      return [
        {
          id: `stg-crm-fallback-${Date.now()}`,
          checked: true,
          spectrum: 'emerald',
          mode: 'followup_lead',
          title: isEn
            ? 'Contact key decision-maker & send commercial proposal'
            : 'Связаться с ЛПР по приоритетной сделке и направить КП',
          department: departments[0] || 'Отдел продаж',
          assignedTo: currentUser?.id || nodes[0]?.id || '',
          priority: 'High',
          dueDate: getIsoDateOffset(1),
        },
      ];
    }

    return source.map((lead, idx) => {
      const leadTitle = lead.client_name || lead.title || 'Контрагент';
      const leadVal = Number(lead.amount || 0);
      const prio: TaskPriority = leadVal >= 300000 ? 'High' : 'Medium';
      return {
        id: `stg-crm-${lead.id}-${idx}`,
        checked: true,
        spectrum: 'emerald',
        mode: 'followup_lead' as const,
        title: `${isEn ? 'Follow-up & close stage:' : 'Контрольный дожим сделки:'} ${leadTitle} (${formatMoney(
          leadVal
        )})`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: lead.assigned_to || currentUser?.id || nodes[0]?.id || '',
        priority: prio,
        dueDate: getIsoDateOffset(1 + (idx % 3)),
        leadId: lead.id,
        dealValue: leadVal,
      };
    });
  };

  const buildRebalanceRows = (): StagingRowItem[] => {
    const openTasks = tasks.filter((t) => t.status !== 'Done');
    const leastBusyNode = executiveInsights.leastBusy?.node || nodes[0] || currentUser;

    if (openTasks.length === 0) {
      return buildDecompositionRows(isEn ? 'Sprint Rebalance' : 'Оптимизация спринта');
    }

    return openTasks.slice(0, 4).map((t, idx) => ({
      id: `stg-reb-${t.id}-${idx}`,
      checked: true,
      spectrum: 'violet',
      mode: 'reassign_task',
      title: t.title,
      department: t.department || leastBusyNode?.department || departments[0] || 'Отдел продаж',
      assignedTo: leastBusyNode?.id || currentUser?.id || '',
      priority: (t.priority as TaskPriority) || 'Medium',
      dueDate: t.due_date ? String(t.due_date).split('T')[0] : getIsoDateOffset(2 + idx),
      existingTaskId: t.id,
    }));
  };

  const parseComplexCommandToRows = (rawCommand: string): StagingRowItem[] => {
    const text = rawCommand.trim();
    const lower = text.toLowerCase();
    const results: StagingRowItem[] = [];

    let targetDueDate = getIsoDateOffset(2);
    if (lower.includes('пятниц') || lower.includes('friday')) {
      targetDueDate = getNextWeekdayIso(5);
    } else if (lower.includes('понедельн') || lower.includes('monday')) {
      targetDueDate = getNextWeekdayIso(1);
    } else if (lower.includes('вторник') || lower.includes('tuesday')) {
      targetDueDate = getNextWeekdayIso(2);
    } else if (lower.includes('сред') || lower.includes('wednesday')) {
      targetDueDate = getNextWeekdayIso(3);
    } else if (lower.includes('четверг') || lower.includes('thursday')) {
      targetDueDate = getNextWeekdayIso(4);
    } else if (lower.includes('завтра') || lower.includes('tomorrow')) {
      targetDueDate = getIsoDateOffset(1);
    }

    const matchedEmployee = nodes.find((emp) => {
      const parts = (emp.name || '').toLowerCase().split(/\s+/).filter(Boolean);
      return parts.some((part) => {
        if (part.length < 3) return false;
        const stem = part.slice(0, Math.max(3, part.length - 1));
        return lower.includes(stem);
      });
    });

    if (
      lower.includes('перенес') ||
      lower.includes('сдвин') ||
      lower.includes('перераспредел') ||
      lower.includes('задач') ||
      lower.includes('move') ||
      lower.includes('reschedule')
    ) {
      const targetTasks = tasks.filter((t) => {
        if (t.status === 'Done') return false;
        if (matchedEmployee) {
          return t.assigned_to === matchedEmployee.id || t.owner_node_id === matchedEmployee.id;
        }
        return true;
      });

      if (
        targetTasks.length > 0 &&
        (lower.includes('перенес') || lower.includes('сдвин') || matchedEmployee)
      ) {
        targetTasks.slice(0, 3).forEach((t, idx) => {
          results.push({
            id: `stg-shift-${t.id}-${Date.now()}-${idx}`,
            checked: true,
            spectrum: 'amber',
            mode: 'reassign_task',
            title: t.title,
            department:
              t.department || matchedEmployee?.department || departments[0] || 'Отдел продаж',
            assignedTo: matchedEmployee?.id || t.assigned_to || currentUser?.id || '',
            priority: (t.priority as TaskPriority) || 'High',
            dueDate: targetDueDate,
            existingTaskId: t.id,
          });
        });
      }
    }

    if (
      lower.includes('сделк') ||
      lower.includes('лид') ||
      lower.includes('deal') ||
      lower.includes('контракт')
    ) {
      const parsedAmount = parseRussianAmount(text) || 1_200_000;
      let clientName = 'Северсталь';
      const dealNameMatch = text.match(
        /(?:сделк[ауи]|клиент[а]?|контрагент[а]?|deal)\s+([А-Яа-яA-Za-z0-9«»"'-]+(?:\s+[А-Яа-яA-Za-z0-9«»"'-]+)?)/i
      );
      if (dealNameMatch && dealNameMatch[1]) {
        clientName = dealNameMatch[1].replace(/\s+(?:на|суммой|за|по|в)\b.*$/i, '').trim();
      }
      results.push({
        id: `stg-newlead-${Date.now()}`,
        checked: true,
        spectrum: 'emerald',
        mode: 'create_lead',
        clientName,
        dealValue: parsedAmount,
        title: `${
          isEn ? 'Create CRM Deal:' : 'Создать сделку CRM:'
        } ${clientName} (${formatMoney(parsedAmount)})`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: matchedEmployee?.id || currentUser?.id || nodes[0]?.id || '',
        priority: 'High',
        dueDate: targetDueDate,
      });
    }

    if (results.length === 0) {
      return buildDecompositionRows(text);
    }

    return results;
  };

  const buildDefaultExecutiveSummary = () => {
    const busiestName = executiveInsights.busiest.node?.name || 'Руководитель';
    const leastBusyName = executiveInsights.leastBusy.node?.name || 'Специалист';
    const topDealTitle =
      executiveInsights.topDeal?.client_name ||
      executiveInsights.topDeal?.title ||
      'Северсталь Логистика';
    const topDealVal = formatMoney(Number(executiveInsights.topDeal?.amount || 1500000));

    if (isEn) {
      return `Workspace telemetry (${companyName}): ${executiveInsights.openTasksCount} active tasks (${executiveInsights.overdueCount} overdue), ${executiveInsights.activeLeadsCount} open CRM deals totaling ${formatMoney(executiveInsights.totalPipelineValue)}. Highest load: ${busiestName} (${executiveInsights.busiest.count} tasks); available capacity: ${leastBusyName} (${executiveInsights.leastBusy.count} tasks). Priority revenue focus: ${topDealTitle} (${topDealVal}).`;
    }
    return `Анализ контура «${companyName}»: в работе ${executiveInsights.openTasksCount} задач (просрочено: ${executiveInsights.overdueCount}), активный портфель CRM — ${executiveInsights.activeLeadsCount} сделок на сумму ${formatMoney(executiveInsights.totalPipelineValue)}. Пиковая нагрузка у сотрудника ${busiestName} (${executiveInsights.busiest.count} задач), свободный ресурс — ${leastBusyName} (${executiveInsights.leastBusy.count} в работе). Приоритетный контрагент для закрытия счета: ${topDealTitle} (${topDealVal}).`;
  };

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    if (stagingRows.length === 0) {
      const initialRows = buildDecompositionRows();
      setStagingRows(initialRows);
      setActiveCanvasMode('decompose');
      setStatusLine(
        isEn
          ? `${tasks.length} tasks · ${leads.length} deals · ${nodes.length} members`
          : `Задач: ${tasks.length} · Сделок: ${leads.length} · Штат: ${nodes.length}`
      );
    }
    if (!aiAnalysisSummary) {
      setAiAnalysisSummary(buildDefaultExecutiveSummary());
    }
    if (!selectedContractLeadId && leads[0]?.id) {
      setSelectedContractLeadId(leads[0].id);
    }
    setTimeout(() => {
      spotlightInputRef.current?.focus();
    }, 60);
  }, [isOpen]);

  const handleRunLiveServerAiBrief = async (customPrompt?: string) => {
    setIsQueryingAi(true);
    try {
      const promptToUse =
        customPrompt?.trim() ||
        (isEn
          ? 'Provide a concise executive audit of bottlenecks, overdue tasks, and priority CRM deals.'
          : 'Сформируй краткую управленческую сводку по узким местам, срокам задач и ключевым сделкам CRM.');
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_assistant',
          company_id: companyId,
          prompt: promptToUse,
          context: {
            companyName,
            userName: currentUser?.name,
            userRole: currentUser?.role_type,
            tasksCount: tasks.length,
            leadsCount: leads.length,
            teamCount: nodes.length,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.reply) {
        setAiAnalysisSummary(String(data.reply).trim());
      } else {
        setAiAnalysisSummary(buildDefaultExecutiveSummary());
      }
    } catch {
      setAiAnalysisSummary(buildDefaultExecutiveSummary());
    } finally {
      setIsQueryingAi(false);
    }
  };

  const handleToggleVoiceRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setIsListening(true);
      const sampleCommand = isEn
        ? 'Move Lytnev tasks to Friday and create Severstal deal for 1.2M'
        : 'Перенеси задачи Лытнева на пятницу и создай сделку Северсталь на 1.2 млн';
      setInputText(sampleCommand);
      setTimeout(() => {
        setIsListening(false);
        const rows = parseComplexCommandToRows(sampleCommand);
        setStagingRows(rows);
        setActiveCanvasMode('decompose');
        setStatusLine(
          isEn
            ? `Voice command parsed into ${rows.length} actions`
            : `Голосовая команда разобрана в пакет из ${rows.length} действий`
        );
      }, 900);
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = isEn ? 'en-US' : 'ru-RU';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInputText(transcript.trim());
          if (event.results[event.results.length - 1]?.isFinal) {
            const rows = parseComplexCommandToRows(transcript.trim());
            setStagingRows(rows);
            setActiveCanvasMode('decompose');
            setStatusLine(
              isEn
                ? `Voice command parsed into ${rows.length} actions`
                : `Голосовая команда разобрана в пакет из ${rows.length} действий`
            );
          }
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  if (!isOpen) return null;

  const triggerQuickAction = (mode: CloudCodeCanvasMode, customTopic?: string) => {
    const currentQuota = getAiQuotaState(companyId, planTier);
    if (currentQuota.isExhausted) {
      const msg = isEn
        ? `Daily AI quota reached (${currentQuota.usedToday}/${currentQuota.dailyLimit}). Upgrade plan for more.`
        : `Дневной лимит AI-операций исчерпан (${currentQuota.usedToday}/${currentQuota.dailyLimit}). Повысьте тариф.`;
      setStatusLine(msg);
      if (showToast) showToast(msg);
      return;
    }
    const nextQuota = incrementAiQuotaUsage(companyId, planTier, 1);
    setQuotaState(nextQuota);
    setAppliedSuccessBanner(null);

    if (mode === 'decompose') {
      const rows = customTopic
        ? parseComplexCommandToRows(customTopic)
        : buildDecompositionRows();
      setStagingRows(rows);
      setActiveCanvasMode('decompose');
      setStatusLine(
        customTopic
          ? `${isEn ? 'Command plan:' : 'План по запросу:'} «${customTopic}» (${rows.length})`
          : isEn
          ? `Prepared ${rows.length} structured steps`
          : `Сформировано этапов в плане: ${rows.length}`
      );
      if (customTopic) {
        void handleRunLiveServerAiBrief(customTopic);
      }
    } else if (mode === 'deals_audit') {
      const rows = buildDealsAuditRows();
      setStagingRows(rows);
      setActiveCanvasMode('deals_audit');
      setStatusLine(
        isEn
          ? `${rows.length} CRM follow-up tasks prepared`
          : `Подготовлено поручений на дожим сделок CRM: ${rows.length}`
      );
    } else if (mode === 'rebalance') {
      const rows = buildRebalanceRows();
      setStagingRows(rows);
      setActiveCanvasMode('rebalance');
      setStatusLine(
        isEn
          ? `Workload balanced across ${nodes.length} employees`
          : `Оптимизировано распределение ${rows.length} задач по штату`
      );
    } else if (mode === 'contract') {
      const targetLead =
        leads.find((l) => l.id === selectedContractLeadId) || leads[0] || null;
      if (targetLead && !selectedContractLeadId) {
        setSelectedContractLeadId(targetLead.id);
      }
      setActiveCanvasMode('contract');
      setStatusLine(
        isEn
          ? 'Express A4 Contract & Invoice Generator'
          : 'Генератор договора, счета и акта А4'
      );
    } else if (mode === 'brief') {
      setActiveCanvasMode('brief');
      void handleRunLiveServerAiBrief(customTopic);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) {
      if (stagingRows.some((r) => r.checked)) {
        void handleCommitToDatabase();
      }
      return;
    }

    const lower = trimmed.toLowerCase();
    if (
      (lower.includes('договор') ||
        lower.includes('счет') ||
        lower.includes('акт') ||
        lower.includes('contract')) &&
      !lower.includes('сделк') &&
      !lower.includes('перенес')
    ) {
      triggerQuickAction('contract', trimmed);
    } else {
      triggerQuickAction('decompose', trimmed);
    }
    setInputText('');
  };

  const handleUpdateRow = (id: string, patch: Partial<StagingRowItem>) => {
    setStagingRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleDeleteRow = (id: string) => {
    setStagingRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleAddBlankRow = () => {
    const newId = `stg-custom-${Date.now()}`;
    const newRow: StagingRowItem = {
      id: newId,
      checked: true,
      spectrum: 'amber',
      mode: 'create_task',
      title: isEn ? 'New operational task' : 'Новое операционное поручение',
      department: departments[0] || 'Отдел продаж',
      assignedTo: currentUser?.id || nodes[0]?.id || '',
      priority: 'Medium',
      dueDate: getIsoDateOffset(3),
    };
    setStagingRows((prev) => [...prev, newRow]);
  };

  const cyclePriority = (current: TaskPriority): TaskPriority => {
    const norm = String(current || 'Medium').toLowerCase();
    if (norm === 'high') return 'Medium';
    if (norm === 'medium') return 'Low';
    return 'High';
  };

  const getPriorityBadgeMeta = (priority: TaskPriority) => {
    const norm = String(priority || 'Medium').toLowerCase();
    if (norm === 'high') {
      return {
        label: isEn ? 'High' : 'Высокий',
        className:
          'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 dark:hover:bg-rose-500/25',
      };
    }
    if (norm === 'low') {
      return {
        label: isEn ? 'Low' : 'Низкий',
        className:
          'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/10 dark:hover:bg-white/10',
      };
    }
    return {
      label: isEn ? 'Medium' : 'Средний',
      className:
        'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/25',
    };
  };

  const handleCommitToDatabase = async (customRows?: StagingRowItem[]) => {
    const sourceRows = customRows || stagingRows;
    const selected = sourceRows.filter((r) => r.checked && r.title.trim());
    if (selected.length === 0 || isApplyingDb) return;

    const currentQuota = getAiQuotaState(companyId, planTier);
    if (currentQuota.isExhausted) {
      const msg = isEn
        ? `Daily AI quota reached (${currentQuota.usedToday}/${currentQuota.dailyLimit}).`
        : `Дневной лимит AI-операций исчерпан (${currentQuota.usedToday}/${currentQuota.dailyLimit}).`;
      if (showToast) showToast(msg);
      return;
    }
    setQuotaState(incrementAiQuotaUsage(companyId, planTier, 1));

    setIsApplyingDb(true);
    setAppliedSuccessBanner(null);

    try {
      const optimisticCreated: TaskRecord[] = [];
      let createdTasksCount = 0;
      let updatedTasksCount = 0;
      let createdLeadsCount = 0;

      for (const item of selected) {
        if (item.mode === 'create_lead') {
          const leadPayload = {
            company_id: companyId,
            client_name: item.clientName || item.title.replace(/^.*:\s*/, '').trim(),
            title: item.title.trim(),
            amount: item.dealValue || 1200000,
            deal_value: item.dealValue || 1200000,
            status: 'Negotiation',
            stage: 'Negotiation',
            department: item.department || 'Отдел продаж',
            assigned_to: item.assignedTo || currentUser?.id || null,
            owner_node_id: item.assignedTo || currentUser?.id || null,
            notes: `Создано через CloudCode AI Console`,
          };
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'crm_leads',
              company_id: companyId,
              record: leadPayload,
            }),
          });
          createdLeadsCount++;
        } else if (item.mode === 'reassign_task' && item.existingTaskId) {
          await fetch('/api/db', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'tasks',
              id: item.existingTaskId,
              company_id: companyId,
              updates: {
                title: item.title.trim(),
                department: item.department,
                assigned_to: item.assignedTo || null,
                owner_node_id: item.assignedTo || null,
                priority: item.priority,
                due_date: item.dueDate,
              },
            }),
          });
          updatedTasksCount++;
        } else {
          const payloadRecord = {
            company_id: companyId,
            title: item.title.trim(),
            description: `Создано через CloudCode AI Console`,
            status: 'Todo' as const,
            priority: item.priority,
            department: item.department,
            assigned_to: item.assignedTo || null,
            owner_node_id: item.assignedTo || null,
            created_by: currentUser?.id || null,
            due_date: item.dueDate,
            lead_id: item.leadId || null,
          };

          const res = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'tasks',
              company_id: companyId,
              record: payloadRecord,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (data?.data?.id) {
            optimisticCreated.push(data.data as TaskRecord);
          }
          createdTasksCount++;
        }
      }

      if (optimisticCreated.length > 0 && onOptimisticTasksAdded) {
        onOptimisticTasksAdded(optimisticCreated);
      }

      await onRefreshData();

      const summaryParts: string[] = [];
      if (createdTasksCount > 0)
        summaryParts.push(
          isEn ? `created tasks: ${createdTasksCount}` : `создано задач: ${createdTasksCount}`
        );
      if (updatedTasksCount > 0)
        summaryParts.push(
          isEn ? `updated tasks: ${updatedTasksCount}` : `обновлено задач: ${updatedTasksCount}`
        );
      if (createdLeadsCount > 0)
        summaryParts.push(
          isEn ? `created CRM deals: ${createdLeadsCount}` : `создано сделок CRM: ${createdLeadsCount}`
        );

      const msg = isEn
        ? `Executed in workspace (${summaryParts.join(', ')}).`
        : `Выполнено в рабочем контуре (${summaryParts.join(', ')}).`;
      recordImmutableAuditEntry({
        companyId,
        actorId: currentUser?.id,
        actorName: currentUser?.name || 'Admin',
        actorRole: currentUser?.role_type || 'Manager',
        actionType: 'CloudCode AI Batch Commit',
        targetEntity: 'tasks / crm_leads',
        details: summaryParts.join(', '),
      });
      setAppliedSuccessBanner(msg);
      if (showToast) showToast(msg);
    } finally {
      setIsApplyingDb(false);
    }
  };

  const selectedLeadForContract =
    leads.find((l) => l.id === selectedContractLeadId) || leads[0] || null;
  const checkedCount = stagingRows.filter((r) => r.checked).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full max-h-[90vh] rounded-2xl bg-white dark:bg-[#0E1017] border border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =================================================================
            1. ARCHITECTURAL HEADER (CloudCode / Linear Style)
        ================================================================== */}
        <div className="px-5 py-3.5 border-b border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#12151E] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-white/[0.08] dark:border dark:border-white/[0.14] flex items-center justify-center shrink-0">
              <TeddyPrismIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  TedCloud Intelligence
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/80 text-slate-700 dark:bg-white/[0.07] dark:text-zinc-300">
                  CloudCode Core
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">
                {statusLine}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-semibold tabular-nums ${
                quotaState.isExhausted
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300'
              }`}
              title={isEn ? 'Daily AI Operations Quota' : 'Суточный лимит операций ИИ по тарифу'}
            >
              {isEn ? quotaState.labelEn : quotaState.labelRu}
            </span>

            <span className="hidden md:inline-flex items-center px-2 py-1 rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04] text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
              Alt+Space
            </span>

            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close' : 'Закрыть'}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.08] transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =================================================================
            2. COMMAND PROMPT BAR + 5 SCENARIO TABS
        ================================================================== */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0E1017] space-y-3 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2.5 rounded-xl border border-slate-300 dark:border-white/[0.12] bg-slate-50/70 dark:bg-[#141722] px-3.5 py-2 focus-within:border-indigo-600 dark:focus-within:border-indigo-500 transition">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">
                &gt;_
              </span>
              <input
                ref={spotlightInputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isEn
                    ? 'Enter command or goal: "Move Lytnev tasks to Friday and create Severstal deal for 1.2M"...'
                    : 'Введите цель или команду: «Перенеси задачи Лытнева на пятницу и создай сделку Северсталь на 1.2 млн»...'
                }
                className="w-full !bg-transparent !border-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleToggleVoiceRecognition}
              title={
                isEn
                  ? 'Voice dictation (Speech-to-Plan)'
                  : 'Голосовой ввод команды (распознавание речи в задачи и сделки)'
              }
              className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                isListening
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 animate-pulse'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#141722] dark:text-zinc-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 text-rose-500" />
                  <span className="hidden sm:inline">{isEn ? 'Listening...' : 'Слушаю...'}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                  <span className="hidden md:inline">{isEn ? 'Voice' : 'Голос'}</span>
                </>
              )}
            </button>

            <button
              type="submit"
              className="tc-btn-primary h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
            >
              <span>{isEn ? 'Generate Plan' : 'Сформировать'}</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* 5 Clean Scenario Mode Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'decompose' as CloudCodeCanvasMode,
                  label: isEn ? 'Decompose Goal' : 'Декомпозиция цели',
                  icon: Layers,
                },
                {
                  id: 'rebalance' as CloudCodeCanvasMode,
                  label: isEn ? 'SLA & Staff Balance' : 'Балансировка штата и SLA',
                  icon: SlidersHorizontal,
                },
                {
                  id: 'deals_audit' as CloudCodeCanvasMode,
                  label: isEn ? 'CRM Pipeline Follow-up' : 'Дожим сделок CRM',
                  icon: Briefcase,
                },
                {
                  id: 'contract' as CloudCodeCanvasMode,
                  label: isEn ? 'A4 Document Generator' : 'Договор и счет А4',
                  icon: FileText,
                },
                {
                  id: 'brief' as CloudCodeCanvasMode,
                  label: isEn ? 'Executive Audit' : 'Аналитическая сводка',
                  icon: Activity,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCanvasMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => triggerQuickAction(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-600 !text-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================
            3. MAIN SCROLLABLE AI WORKSPACE (Zero Horizontal Scrollbars)
        ================================================================== */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* EXECUTIVE DIAGNOSTIC BRIEF & 3 COMPACT OPERATIONAL CARDS */}
          <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#12151E] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                  {isEn
                    ? 'Live Operational Diagnosis'
                    : 'Оперативная диагностика рабочего контура'}
                </span>
              </div>
              <button
                type="button"
                disabled={isQueryingAi}
                onClick={() => void handleRunLiveServerAiBrief(inputText)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {isQueryingAi ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Activity className="w-3 h-3 text-indigo-500" />
                )}
                <span>{isEn ? 'Refresh AI Audit' : 'Обновить AI-сводку'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
              {aiAnalysisSummary || buildDefaultExecutiveSummary()}
            </p>

            {/* 3 Clean Single-Elevation Quick Cards (No thick colored left borders) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {/* Card 1: Workload Balance */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#161924] p-3 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {isEn ? 'Staff Load & SLA' : 'Нагрузка и сроки'}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                      {executiveInsights.busiest.count} {isEn ? 'tasks' : 'задач'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {executiveInsights.busiest.node?.name || 'Сотрудник'}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug truncate">
                    {isEn
                      ? `Available: ${executiveInsights.leastBusy.node?.name || 'Staff'} (${executiveInsights.leastBusy.count} active)`
                      : `Свободен: ${executiveInsights.leastBusy.node?.name || 'штат'} (${executiveInsights.leastBusy.count} в раб.)`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const rebRows = buildRebalanceRows();
                    setStagingRows(rebRows);
                    setActiveCanvasMode('rebalance');
                    void handleCommitToDatabase(rebRows);
                  }}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200/80 text-slate-800 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] dark:text-zinc-100 text-[11px] font-semibold inline-flex items-center justify-between gap-1.5 transition cursor-pointer"
                >
                  <span className="truncate">
                    {isEn ? 'Rebalance in 1 Click' : 'Перераспределить в 1 клик'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>

              {/* Card 2: Priority CRM Deal */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#161924] p-3 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                      {isEn ? 'CRM Pipeline' : 'Приоритет CRM'}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                      {executiveInsights.topDeal
                        ? formatMoney(Number(executiveInsights.topDeal.amount || 0))
                        : formatMoney(0)}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {executiveInsights.topDeal?.client_name ||
                      executiveInsights.topDeal?.title ||
                      (isEn ? 'Active Pipeline' : 'Активная сделка')}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug">
                    {isEn
                      ? 'Schedule control follow-up & invoice'
                      : 'Поставить задачу на дожим ЛПР и счет'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const crmRows = buildDealsAuditRows().slice(0, 1);
                    setStagingRows(crmRows);
                    setActiveCanvasMode('deals_audit');
                    void handleCommitToDatabase(crmRows);
                  }}
                  className="w-full h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-emerald-200 text-[11px] font-semibold inline-flex items-center justify-between gap-1.5 transition cursor-pointer"
                >
                  <span className="truncate">
                    {isEn ? 'Create Follow-Up Task' : 'Создать задачу на дожим'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>

              {/* Card 3: Express A4 Document */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#161924] p-3 flex flex-col justify-between gap-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      {isEn ? 'A4 Legal Document' : 'Документ А4 по сделке'}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300">
                      PDF / A4
                    </span>
                  </div>

                  <select
                    value={selectedContractLeadId}
                    onChange={(e) => setSelectedContractLeadId(e.target.value)}
                    aria-label={isEn ? 'Select CRM Deal' : 'Выберите сделку CRM'}
                    className="w-full h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#12151E] px-2 text-[11px] font-medium text-slate-900 dark:text-white focus:outline-none"
                  >
                    {leads.length === 0 ? (
                      <option value="">
                        {isEn ? 'No deals available' : 'Нет активных сделок'}
                      </option>
                    ) : (
                      leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.client_name || l.title} ({formatMoney(Number(l.amount || 0))})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedLeadForContract && onOpenLegalDocModal) {
                      onOpenLegalDocModal(selectedLeadForContract, 'contract');
                    }
                  }}
                  disabled={!selectedLeadForContract}
                  className="w-full h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:hover:bg-indigo-500/25 dark:text-indigo-200 disabled:opacity-40 text-[11px] font-semibold inline-flex items-center justify-between gap-1.5 transition cursor-pointer"
                >
                  <span className="truncate">
                    {isEn ? 'Open Contract & Invoice A4' : 'Открыть договор и счет А4'}
                  </span>
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {appliedSuccessBanner && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{appliedSuccessBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setAppliedSuccessBanner(null)}
                className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* =================================================================
              4. ACTION PLAN CARDS (Full-Width Titles + Structured 4-Col Metadata)
          ================================================================== */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {isEn
                    ? 'Action Plan & Database Staging (Editable)'
                    : 'План действий к исполнению в базе данных (все поля редактируемы)'}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                  {isEn
                    ? 'Review or adjust titles, departments, assignees, priorities, and deadlines before committing.'
                    : 'Проверьте формулировки задач, подразделения, ответственных и сроки перед записью в рабочее пространство.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddBlankRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-xs font-semibold transition cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isEn ? 'Add Step' : 'Добавить шаг'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {stagingRows.map((row, idx) => {
                const modeMeta = getModeTagMeta(row.mode, isEn);
                const prioMeta = getPriorityBadgeMeta(row.priority);
                const assignedEmp =
                  nodes.find((n) => n.id === row.assignedTo) || currentUser;

                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border transition-all p-3.5 space-y-2.5 ${
                      row.checked
                        ? 'border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#141722] shadow-2xs'
                        : 'border-slate-200/50 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] opacity-60'
                    }`}
                  >
                    {/* Top Row: Checkbox + Step Number & Mode Badge + Full-Width Editable Title + Delete */}
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateRow(row.id, { checked: !row.checked })}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition cursor-pointer ${
                          row.checked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-white/20 bg-transparent'
                        }`}
                        aria-label={isEn ? 'Toggle step' : 'Выбрать шаг'}
                      >
                        {row.checked && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${modeMeta.badgeClass}`}
                          >
                            {modeMeta.label}
                          </span>
                        </div>

                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => handleUpdateRow(row.id, { title: e.target.value })}
                          placeholder={
                            isEn ? 'Enter task or action title...' : 'Введите название задачи или действия...'
                          }
                          className="w-full rounded-lg border border-transparent hover:border-slate-200 focus:border-indigo-500 dark:hover:border-white/10 bg-transparent px-2 py-1 -mx-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none transition"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                        title={isEn ? 'Remove step' : 'Удалить из пакета'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Row: 4-Column Responsive Metadata Controls (Department, Assignee, Priority, Deadline) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                      {/* 1. Department Select */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          {isEn ? 'Department' : 'Подразделение'}
                        </label>
                        <select
                          value={row.department}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { department: e.target.value })
                          }
                          className="w-full h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0E1017] px-2.5 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none"
                        >
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Assignee Select with Avatar Preview */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          {isEn ? 'Assignee' : 'Ответственный'}
                        </label>
                        <div className="flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0E1017] px-2">
                          <UserAvatar
                            name={assignedEmp?.name || 'TC'}
                            avatarUrl={assignedEmp?.avatar_url}
                            size="xs"
                          />
                          <select
                            value={row.assignedTo}
                            onChange={(e) =>
                              handleUpdateRow(row.id, {
                                assignedTo: e.target.value,
                                department:
                                  nodes.find((n) => n.id === e.target.value)?.department ||
                                  row.department,
                              })
                            }
                            className="flex-1 min-w-0 !bg-transparent !border-0 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none truncate"
                          >
                            {nodes.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 3. Priority Toggle Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          {isEn ? 'Priority' : 'Приоритет'}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateRow(row.id, {
                              priority: cyclePriority(row.priority),
                            })
                          }
                          className={`w-full h-8 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center transition cursor-pointer ${prioMeta.className}`}
                        >
                          {prioMeta.label}
                        </button>
                      </div>

                      {/* 4. Single Clean Date Picker (Zero duplicate calendar icon) */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          {isEn ? 'Due Date' : 'Срок исполнения'}
                        </label>
                        <input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { dueDate: e.target.value })
                          }
                          className="w-full h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0E1017] px-2.5 text-xs font-medium text-slate-800 dark:text-zinc-200 tabular-nums focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* =================================================================
            5. FOOTER BAR (Selected Counter + Execute Batch Button)
        ================================================================== */}
        <div className="px-5 py-3.5 border-t border-slate-200/90 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#12151E] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            {isEn
              ? `Selected actions to execute: ${checkedCount} of ${stagingRows.length}`
              : `Выбрано действий к выполнению: ${checkedCount} из ${stagingRows.length}`}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-xs font-semibold transition cursor-pointer"
            >
              {isEn ? 'Close' : 'Закрыть'}
            </button>

            <button
              type="button"
              onClick={() => void handleCommitToDatabase()}
              disabled={isApplyingDb || checkedCount === 0}
              className="tc-btn-primary h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white disabled:opacity-40 text-xs font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              {isApplyingDb ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                {isEn
                  ? `Execute in Workspace (${checkedCount})`
                  : `Выполнить в рабочем контуре (${checkedCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
