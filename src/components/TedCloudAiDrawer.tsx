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
  Briefcase,
  FileText,
  Layers,
  Activity,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RotateCcw,
  Sparkles,
  Users,
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
        label: isEn ? 'Reassign' : 'Перенос задачи',
        badgeClass:
          'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      };
    case 'followup_lead':
      return {
        label: isEn ? 'Deal follow-up' : 'Задача по сделке',
        badgeClass:
          'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      };
    case 'create_lead':
      return {
        label: isEn ? 'New deal' : 'Новая сделка',
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
        label: isEn ? 'New task' : 'Новая задача',
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200/90 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/10',
      };
  }
}

type AiAssistantReply = {
  text: string;
  provider: 'gemini' | 'tedcloud-engine' | 'local';
  generatedAt: string;
};

type CommitOutcome = { kind: 'success' | 'partial' | 'error'; message: string };

const CANVAS_TABS: Array<{
  id: CloudCodeCanvasMode;
  ru: string;
  en: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'decompose', ru: 'План по цели', en: 'Goal plan', icon: Layers },
  { id: 'rebalance', ru: 'Нагрузка', en: 'Workload', icon: SlidersHorizontal },
  { id: 'deals_audit', ru: 'Сделки', en: 'Deals', icon: Briefcase },
  { id: 'contract', ru: 'Документы', en: 'Documents', icon: FileText },
  { id: 'brief', ru: 'Сводка', en: 'Summary', icon: Activity },
];

async function postJson(url: string, method: 'POST' | 'PATCH', body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && typeof data === 'object' && 'error' in data && data.error)) {
    throw new Error(String((data as any)?.error || `HTTP ${res.status}`));
  }
  return data as any;
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
  onNavigateToSection,
  onOpenLegalDocModal,
  showToast,
}) => {
  const { language, formatMoney } = useLocale();
  const isEn = language === 'en';
  const tr = (ru: string, en: string) => (isEn ? en : ru);

  const [inputText, setInputText] = useState<string>('');
  const [activeCanvasMode, setActiveCanvasMode] = useState<CloudCodeCanvasMode>('decompose');
  const [stagingRows, setStagingRows] = useState<StagingRowItem[]>([]);
  const [planSource, setPlanSource] = useState<string>('');
  const [selectedContractLeadId, setSelectedContractLeadId] = useState<string>('');
  const [isApplyingDb, setIsApplyingDb] = useState<boolean>(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [isQueryingAi, setIsQueryingAi] = useState<boolean>(false);
  const [aiReply, setAiReply] = useState<AiAssistantReply | null>(null);
  const [commitOutcome, setCommitOutcome] = useState<CommitOutcome | null>(null);
  const [quotaState, setQuotaState] = useState(() => getAiQuotaState(companyId, planTier));
  const [isListening, setIsListening] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const titleId = 'tc-ai-dialog-title';
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    setQuotaState(getAiQuotaState(companyId, planTier));
  }, [companyId, planTier, isOpen]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach((n) => {
      if (n.department && n.department.trim()) set.add(n.department.trim());
    });
    if (currentUser?.department) set.add(currentUser.department);
    if (set.size === 0) set.add(tr('Общий отдел', 'General'));
    return Array.from(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, currentUser, isEn]);

  const activeLeads = useMemo(
    () => leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost'),
    [leads]
  );

  const insights = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');
    const todayIso = new Date().toISOString().slice(0, 10);
    const overdue = openTasks.filter(
      (t) => t.due_date && String(t.due_date).slice(0, 10) < todayIso
    );
    const loads = nodes
      .map((n) => ({
        node: n,
        count: openTasks.filter((t) => (t.assigned_to || t.owner_node_id) === n.id).length,
      }))
      .sort((a, b) => b.count - a.count);
    const busiest = loads[0] || null;
    const leastBusy = loads.length > 1 ? loads[loads.length - 1] : null;
    const pipeline = activeLeads.reduce(
      (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
      0
    );
    const topDeal =
      [...activeLeads].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null;
    const isBalanced = !busiest || !leastBusy || busiest.count - leastBusy.count <= 1;
    return {
      openTasks,
      openCount: openTasks.length,
      overdueCount: overdue.length,
      busiest,
      leastBusy,
      isBalanced,
      pipeline,
      topDeal,
    };
  }, [tasks, nodes, activeLeads]);

  const localSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      tr(
        `В работе ${insights.openCount} задач, просрочено: ${insights.overdueCount}.`,
        `${insights.openCount} open tasks, ${insights.overdueCount} overdue.`
      )
    );
    parts.push(
      activeLeads.length > 0
        ? tr(
            `Активных сделок: ${activeLeads.length} на ${formatMoney(insights.pipeline)}.`,
            `${activeLeads.length} active deals worth ${formatMoney(insights.pipeline)}.`
          )
        : tr('Активных сделок в CRM пока нет.', 'No active CRM deals yet.')
    );
    if (insights.busiest && insights.busiest.count > 0) {
      parts.push(
        tr(
          `Больше всего задач у ${insights.busiest.node.name} (${insights.busiest.count}).`,
          `${insights.busiest.node.name} has the highest load (${insights.busiest.count}).`
        )
      );
    }
    if (insights.topDeal) {
      parts.push(
        tr(
          `Крупнейшая сделка: ${insights.topDeal.client_name || insights.topDeal.title} — ${formatMoney(
            Number(insights.topDeal.amount || 0)
          )}.`,
          `Largest deal: ${insights.topDeal.client_name || insights.topDeal.title} — ${formatMoney(
            Number(insights.topDeal.amount || 0)
          )}.`
        )
      );
    }
    return parts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights, activeLeads, formatMoney, isEn]);

  /* ------------------------------------------------------------------ */
  /* Dialog behaviour: focus, Escape, body scroll lock                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);
    setCommitOutcome(null);
    if (!selectedContractLeadId && leads[0]?.id) setSelectedContractLeadId(leads[0].id);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleCommitToDatabase();
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Quota                                                                */
  /* ------------------------------------------------------------------ */
  const consumeQuota = (): boolean => {
    const current = getAiQuotaState(companyId, planTier);
    if (current.isExhausted) {
      const msg = tr(
        `Дневной лимит ИИ-запросов исчерпан (${current.usedToday}/${current.dailyLimit}). Лимит обновится завтра или после смены тарифа.`,
        `Daily AI quota reached (${current.usedToday}/${current.dailyLimit}). It resets tomorrow or after a plan upgrade.`
      );
      setCommitOutcome({ kind: 'error', message: msg });
      showToast?.(msg);
      return false;
    }
    setQuotaState(incrementAiQuotaUsage(companyId, planTier, 1));
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* Plan builders (local, deterministic — no fabricated data)            */
  /* ------------------------------------------------------------------ */
  const defaultAssignee = currentUser?.id || nodes[0]?.id || '';
  const defaultDepartment = currentUser?.department || departments[0];

  const makeTaskRow = (
    title: string,
    idx: number,
    patch: Partial<StagingRowItem> = {}
  ): StagingRowItem => ({
    id: `stg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    checked: true,
    spectrum: 'amber',
    mode: 'create_task',
    title,
    department: defaultDepartment,
    assignedTo: defaultAssignee,
    priority: idx === 0 ? 'High' : 'Medium',
    dueDate: getIsoDateOffset(idx + 1),
    ...patch,
  });

  const buildRebalanceRows = (): StagingRowItem[] => {
    const { busiest, leastBusy, openTasks, isBalanced } = insights;
    if (!busiest || !leastBusy || isBalanced) return [];
    const movable = openTasks
      .filter((t) => (t.assigned_to || t.owner_node_id) === busiest.node.id)
      .sort((a, b) => String(b.due_date || '').localeCompare(String(a.due_date || '')));
    const moveCount = Math.max(1, Math.floor((busiest.count - leastBusy.count) / 2));
    return movable.slice(0, moveCount).map((t, idx) => ({
      id: `stg-reb-${t.id}-${idx}`,
      checked: true,
      spectrum: 'violet' as const,
      mode: 'reassign_task' as const,
      title: t.title,
      department: t.department || leastBusy.node.department || defaultDepartment,
      assignedTo: leastBusy.node.id,
      priority: (t.priority as TaskPriority) || 'Medium',
      dueDate: t.due_date ? String(t.due_date).slice(0, 10) : getIsoDateOffset(2 + idx),
      existingTaskId: t.id,
    }));
  };

  const buildDealsAuditRows = (): StagingRowItem[] =>
    [...activeLeads]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 3)
      .map((lead, idx) => {
        const name = lead.client_name || lead.title || tr('Клиент', 'Client');
        const value = Number(lead.amount || lead.deal_value || 0);
        return {
          id: `stg-crm-${lead.id}-${idx}`,
          checked: true,
          spectrum: 'emerald' as const,
          mode: 'followup_lead' as const,
          title: tr(
            `Связаться с клиентом и продвинуть сделку: ${name}`,
            `Follow up and move the deal forward: ${name}`
          ),
          department: lead.department || defaultDepartment,
          assignedTo: lead.assigned_to || lead.owner_node_id || defaultAssignee,
          priority: (value >= 300000 ? 'High' : 'Medium') as TaskPriority,
          dueDate: getIsoDateOffset(1 + idx),
          leadId: lead.id,
          dealValue: value,
        };
      });

  /** Recognises explicit commands (move tasks / create deal). Returns [] when nothing matched. */
  const parseCommandToRows = (rawCommand: string): StagingRowItem[] => {
    const text = rawCommand.trim();
    const lower = text.toLowerCase();
    const results: StagingRowItem[] = [];

    let targetDueDate = '';
    if (lower.includes('пятниц') || lower.includes('friday')) targetDueDate = getNextWeekdayIso(5);
    else if (lower.includes('понедельн') || lower.includes('monday')) targetDueDate = getNextWeekdayIso(1);
    else if (lower.includes('вторник') || lower.includes('tuesday')) targetDueDate = getNextWeekdayIso(2);
    else if (lower.includes('сред') || lower.includes('wednesday')) targetDueDate = getNextWeekdayIso(3);
    else if (lower.includes('четверг') || lower.includes('thursday')) targetDueDate = getNextWeekdayIso(4);
    else if (lower.includes('завтра') || lower.includes('tomorrow')) targetDueDate = getIsoDateOffset(1);

    const matchedEmployee = nodes.find((emp) =>
      (emp.name || '')
        .toLowerCase()
        .split(/\s+/)
        .filter((p) => p.length >= 4)
        .some((part) => lower.includes(part.slice(0, Math.max(4, part.length - 2))))
    );

    const wantsMove =
      lower.includes('перенес') ||
      lower.includes('перенеси') ||
      lower.includes('сдвин') ||
      lower.includes('move') ||
      lower.includes('reschedule');

    if (wantsMove) {
      const targetTasks = insights.openTasks.filter((t) =>
        matchedEmployee ? (t.assigned_to || t.owner_node_id) === matchedEmployee.id : true
      );
      targetTasks.slice(0, 5).forEach((t, idx) => {
        results.push({
          id: `stg-shift-${t.id}-${idx}`,
          checked: true,
          spectrum: 'amber',
          mode: 'reassign_task',
          title: t.title,
          department: t.department || defaultDepartment,
          assignedTo: t.assigned_to || matchedEmployee?.id || defaultAssignee,
          priority: (t.priority as TaskPriority) || 'Medium',
          dueDate: targetDueDate || getIsoDateOffset(2),
          existingTaskId: t.id,
        });
      });
    }

    const wantsDeal =
      /(создай|создать|добавь|завести|заведи|new|create|add)[^.]*?(сделк|лид|deal|lead)/i.test(text);
    if (wantsDeal) {
      const amount = parseRussianAmount(text) || 0;
      let clientName = '';
      const m = text.match(
        /(?:сделк[ауи]|лид[а]?|клиент[а]?|deal|lead)\s+(?:с\s+|для\s+|with\s+|for\s+)?([«"']?[А-ЯЁA-Z][^\s,.;«»"']*(?:\s+[А-ЯЁA-Z][^\s,.;«»"']*)?)/u
      );
      if (m?.[1]) clientName = m[1].replace(/[«»"']/g, '').trim();
      results.push({
        id: `stg-newlead-${Date.now()}`,
        checked: true,
        spectrum: 'emerald',
        mode: 'create_lead',
        clientName: clientName || tr('Новый клиент', 'New client'),
        dealValue: amount,
        title: tr(
          `Новая сделка: ${clientName || 'новый клиент'}`,
          `New deal: ${clientName || 'new client'}`
        ),
        department: matchedEmployee?.department || defaultDepartment,
        assignedTo: matchedEmployee?.id || defaultAssignee,
        priority: 'High',
        dueDate: targetDueDate || getIsoDateOffset(3),
      });
    }

    return results;
  };

  /** Breaks a free-form goal into steps via the AI endpoint (analysis only, nothing is written). */
  const generatePlanFromGoal = async (goal: string) => {
    const commandRows = parseCommandToRows(goal);
    if (commandRows.length > 0) {
      setStagingRows(commandRows);
      setPlanSource(goal);
      return;
    }
    setIsGeneratingPlan(true);
    try {
      const data = await postJson('/api/db', 'POST', {
        action: 'ai_assistant',
        mode: 'decompose_task',
        execute_actions: false,
        company_id: companyId,
        companyName,
        profile_id: currentUser?.id,
        taskTitle: goal,
        prompt: goal,
        lang: isEn ? 'en' : 'ru',
      });
      const steps: string[] = Array.isArray(data?.checklist)
        ? data.checklist.map((c: any) => String(c?.title || '').trim()).filter(Boolean)
        : [];
      if (steps.length === 0) throw new Error('empty');
      setStagingRows(steps.slice(0, 6).map((title, idx) => makeTaskRow(title, idx)));
      setPlanSource(goal);
    } catch {
      // Offline / server unavailable: one editable task with the user's own wording.
      setStagingRows([makeTaskRow(goal, 0)]);
      setPlanSource(goal);
      showToast?.(
        tr(
          'ИИ-сервис недоступен — создан черновик из одной задачи, его можно отредактировать.',
          'AI service unavailable — a single editable draft task was created.'
        )
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleRunAiBrief = async (customPrompt?: string) => {
    if (!consumeQuota()) return;
    setIsQueryingAi(true);
    try {
      const custom = customPrompt?.trim();
      const data = await postJson('/api/db', 'POST', {
        action: 'ai_assistant',
        // Without a custom question → structured workload & pipeline analysis with recommendations.
        mode: custom ? 'custom' : 'workload_analysis',
        execute_actions: false,
        company_id: companyId,
        companyName,
        profile_id: currentUser?.id,
        lang: isEn ? 'en' : 'ru',
        prompt:
          custom ||
          tr(
            'Сформируй краткую управленческую сводку: узкие места, просроченные задачи, ключевые сделки и 2–3 рекомендации.',
            'Give a concise management summary: bottlenecks, overdue tasks, key deals and 2–3 recommendations.'
          ),
      });
      const text = String(data?.reply || '').trim();
      setAiReply({
        text: text || localSummary,
        provider: text ? (data?.provider === 'gemini' ? 'gemini' : 'tedcloud-engine') : 'local',
        generatedAt: new Date().toISOString(),
      });
    } catch {
      setAiReply({ text: localSummary, provider: 'local', generatedAt: new Date().toISOString() });
      showToast?.(
        tr(
          'Не удалось связаться с ИИ-сервисом. Показана локальная сводка.',
          'Could not reach the AI service. Showing a local summary.'
        )
      );
    } finally {
      setIsQueryingAi(false);
    }
  };

  const switchMode = (mode: CloudCodeCanvasMode) => {
    setActiveCanvasMode(mode);
    setCommitOutcome(null);
    if (mode === 'rebalance') {
      setStagingRows(buildRebalanceRows());
      setPlanSource('');
    } else if (mode === 'deals_audit') {
      setStagingRows(buildDealsAuditRows());
      setPlanSource('');
    } else if (mode === 'decompose') {
      setStagingRows((prev) => (planSource ? prev : []));
    } else if (mode === 'brief' && !aiReply && !isQueryingAi) {
      void handleRunAiBrief();
    }
  };

  /* ------------------------------------------------------------------ */
  /* Voice input                                                          */
  /* ------------------------------------------------------------------ */
  const handleToggleVoiceRecognition = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      showToast?.(
        tr(
          'Голосовой ввод не поддерживается этим браузером. Используйте Chrome, Edge или Safari.',
          'Voice input is not supported in this browser. Use Chrome, Edge or Safari.'
        )
      );
      return;
    }
    try {
      const recognition = new Ctor();
      recognition.lang = isEn ? 'en-US' : 'ru-RU';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) setInputText(transcript.trim());
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event?.error === 'not-allowed') {
          showToast?.(tr('Нет доступа к микрофону.', 'Microphone access denied.'));
        }
      };
      recognition.onend = () => {
        setIsListening(false);
        inputRef.current?.focus();
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Submit & commit                                                      */
  /* ------------------------------------------------------------------ */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isGeneratingPlan || isQueryingAi) return;
    if (!consumeQuota()) return;
    setCommitOutcome(null);

    const lower = trimmed.toLowerCase();
    const isQuestion =
      /\?$/.test(trimmed) ||
      /^(как|что|почему|кто|сколько|какие|какой|покажи|расскажи|проанализируй|сводк|how|what|why|who|which|show|summar|analy)/i.test(
        lower
      );
    if (isQuestion) {
      setActiveCanvasMode('brief');
      // quota already consumed above → call without consuming twice
      setIsQueryingAi(true);
      postJson('/api/db', 'POST', {
        action: 'ai_assistant',
        execute_actions: false,
        company_id: companyId,
        companyName,
        profile_id: currentUser?.id,
        lang: isEn ? 'en' : 'ru',
        prompt: trimmed,
      })
        .then((data) => {
          const text = String(data?.reply || '').trim();
          setAiReply({
            text: text || localSummary,
            provider: text ? (data?.provider === 'gemini' ? 'gemini' : 'tedcloud-engine') : 'local',
            generatedAt: new Date().toISOString(),
          });
        })
        .catch(() =>
          setAiReply({ text: localSummary, provider: 'local', generatedAt: new Date().toISOString() })
        )
        .finally(() => setIsQueryingAi(false));
    } else {
      setActiveCanvasMode('decompose');
      void generatePlanFromGoal(trimmed);
    }
    setInputText('');
  };

  const handleUpdateRow = (id: string, patch: Partial<StagingRowItem>) =>
    setStagingRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const handleDeleteRow = (id: string) =>
    setStagingRows((prev) => prev.filter((row) => row.id !== id));

  const handleAddBlankRow = () =>
    setStagingRows((prev) => [
      ...prev,
      makeTaskRow('', prev.length, { priority: 'Medium', dueDate: getIsoDateOffset(3) }),
    ]);

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
        label: tr('Высокий', 'High'),
        className:
          'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 dark:hover:bg-rose-500/25',
      };
    }
    if (norm === 'low') {
      return {
        label: tr('Низкий', 'Low'),
        className:
          'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/10 dark:hover:bg-white/10',
      };
    }
    return {
      label: tr('Средний', 'Medium'),
      className:
        'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/25',
    };
  };

  async function handleCommitToDatabase() {
    const selected = stagingRows.filter((r) => r.checked && r.title.trim());
    if (selected.length === 0 || isApplyingDb) return;

    setIsApplyingDb(true);
    setCommitOutcome(null);
    const optimisticCreated: TaskRecord[] = [];
    let createdTasks = 0;
    let updatedTasks = 0;
    let createdLeads = 0;
    const failedIds: string[] = [];

    for (const item of selected) {
      try {
        if (item.mode === 'create_lead') {
          const value = Number(item.dealValue || 0);
          await postJson('/api/db', 'POST', {
            table: 'crm_leads',
            company_id: companyId,
            record: {
              company_id: companyId,
              client_name: (item.clientName || '').trim() || item.title.trim(),
              title: item.title.trim(),
              amount: value,
              deal_value: value,
              status: 'New',
              stage: 'New',
              department: item.department,
              assigned_to: item.assignedTo || null,
              owner_node_id: item.assignedTo || null,
              notes: tr('Создано ИИ-ассистентом', 'Created by AI assistant'),
            },
          });
          createdLeads++;
        } else if (item.mode === 'reassign_task' && item.existingTaskId) {
          await postJson('/api/db', 'PATCH', {
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
          });
          updatedTasks++;
        } else {
          const data = await postJson('/api/db', 'POST', {
            table: 'tasks',
            company_id: companyId,
            record: {
              company_id: companyId,
              title: item.title.trim(),
              description: planSource
                ? tr(`Цель: ${planSource}`, `Goal: ${planSource}`)
                : tr('Создано ИИ-ассистентом', 'Created by AI assistant'),
              status: 'Todo',
              priority: item.priority,
              department: item.department,
              assigned_to: item.assignedTo || null,
              owner_node_id: item.assignedTo || null,
              created_by: currentUser?.id || null,
              due_date: item.dueDate,
              lead_id: item.leadId || null,
            },
          });
          if (data?.data?.id) optimisticCreated.push(data.data as TaskRecord);
          createdTasks++;
        }
      } catch {
        failedIds.push(item.id);
      }
    }

    if (optimisticCreated.length > 0) onOptimisticTasksAdded?.(optimisticCreated);
    try {
      await onRefreshData();
    } catch {}

    const parts: string[] = [];
    if (createdTasks) parts.push(tr(`создано задач: ${createdTasks}`, `tasks created: ${createdTasks}`));
    if (updatedTasks) parts.push(tr(`обновлено задач: ${updatedTasks}`, `tasks updated: ${updatedTasks}`));
    if (createdLeads) parts.push(tr(`создано сделок: ${createdLeads}`, `deals created: ${createdLeads}`));

    if (parts.length > 0) {
      recordImmutableAuditEntry({
        companyId,
        actorId: currentUser?.id,
        actorName: currentUser?.name || 'Admin',
        actorRole: currentUser?.role_type || 'Manager',
        actionType: 'AI Assistant Batch Commit',
        targetEntity: 'tasks / crm_leads',
        details: parts.join(', '),
      });
    }

    let outcome: CommitOutcome;
    if (failedIds.length === 0) {
      outcome = { kind: 'success', message: tr(`Готово: ${parts.join(', ')}.`, `Done: ${parts.join(', ')}.`) };
      setStagingRows([]);
      setPlanSource('');
    } else if (parts.length > 0) {
      outcome = {
        kind: 'partial',
        message: tr(
          `Частично выполнено (${parts.join(', ')}). Не удалось применить: ${failedIds.length}. Оставшиеся шаги можно повторить.`,
          `Partially applied (${parts.join(', ')}). Failed: ${failedIds.length}. You can retry the remaining steps.`
        ),
      };
      setStagingRows((prev) => prev.filter((r) => failedIds.includes(r.id)));
    } else {
      outcome = {
        kind: 'error',
        message: tr(
          'Не удалось сохранить изменения. Проверьте соединение и повторите попытку.',
          'Could not save changes. Check your connection and try again.'
        ),
      };
    }
    setCommitOutcome(outcome);
    showToast?.(outcome.message);
    setIsApplyingDb(false);
  }

  const handleCopyReply = async () => {
    if (!aiReply?.text) return;
    try {
      await navigator.clipboard.writeText(aiReply.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (!isOpen) return null;

  const selectedLeadForContract =
    leads.find((l) => l.id === selectedContractLeadId) || leads[0] || null;
  const checkedCount = stagingRows.filter((r) => r.checked && r.title.trim()).length;
  const showPlanFooter =
    activeCanvasMode === 'decompose' ||
    activeCanvasMode === 'rebalance' ||
    activeCanvasMode === 'deals_audit';

  const suggestions = isEn
    ? ['Launch a new product line by the end of the month', 'Move overdue tasks to Friday', 'Create a deal with Acme for 500k']
    : ['Запустить новую услугу до конца месяца', 'Перенеси просроченные задачи на пятницу', 'Создай сделку с Альфа на 500 тыс'];

  const fieldClass =
    'w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400';
  const labelClass =
    'block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400';

  const renderEmptyState = (
    icon: React.ReactNode,
    title: string,
    text: string,
    action?: React.ReactNode
  ) => (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 dark:text-zinc-400">
        {icon}
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{title}</div>
      <p className="max-w-md text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{text}</p>
      {action}
    </div>
  );

  const renderPlanRows = () => (
    <div className="space-y-2.5">
      {stagingRows.map((row, idx) => {
        const modeMeta = getModeTagMeta(row.mode, isEn);
        const prioMeta = getPriorityBadgeMeta(row.priority);
        const assignedEmp = nodeById.get(row.assignedTo) || currentUser;
        const isLead = row.mode === 'create_lead';
        return (
          <div
            key={row.id}
            className={`rounded-xl border p-3 sm:p-3.5 space-y-2.5 transition-opacity ${
              row.checked
                ? 'border-slate-200 bg-white dark:border-white/[0.09] dark:bg-white/[0.03]'
                : 'border-slate-200/70 bg-slate-50 opacity-60 dark:border-white/[0.05] dark:bg-transparent'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={row.checked}
                onChange={() => handleUpdateRow(row.id, { checked: !row.checked })}
                aria-label={tr(`Включить шаг ${idx + 1}`, `Include step ${idx + 1}`)}
                className="mt-1.5 w-4 h-4 shrink-0 rounded accent-indigo-600 cursor-pointer"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                    {idx + 1}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${modeMeta.badgeClass}`}
                  >
                    {modeMeta.label}
                  </span>
                </div>
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => handleUpdateRow(row.id, { title: e.target.value })}
                  placeholder={tr('Название задачи или действия', 'Task or action title')}
                  aria-label={tr('Название шага', 'Step title')}
                  className="tc-inline-input w-full rounded-md border border-transparent px-1.5 py-1 -mx-1.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-500 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-white/10 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRow(row.id)}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 shrink-0 cursor-pointer"
                aria-label={tr('Удалить шаг', 'Remove step')}
                title={tr('Удалить шаг', 'Remove step')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2.5 border-t border-slate-100 dark:border-white/[0.06]">
              {isLead ? (
                <>
                  <label className="space-y-1">
                    <span className={labelClass}>{tr('Клиент', 'Client')}</span>
                    <input
                      type="text"
                      value={row.clientName || ''}
                      onChange={(e) =>
                        handleUpdateRow(row.id, {
                          clientName: e.target.value,
                          title: tr(`Новая сделка: ${e.target.value}`, `New deal: ${e.target.value}`),
                        })
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{tr('Сумма, ₽', 'Amount, RUB')}</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={row.dealValue ?? 0}
                      onChange={(e) =>
                        handleUpdateRow(row.id, { dealValue: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className={`${fieldClass} tabular-nums`}
                    />
                  </label>
                </>
              ) : (
                <label className="space-y-1">
                  <span className={labelClass}>{tr('Подразделение', 'Department')}</span>
                  <select
                    value={row.department}
                    onChange={(e) => handleUpdateRow(row.id, { department: e.target.value })}
                    className={fieldClass}
                  >
                    {!departments.includes(row.department) && row.department && (
                      <option value={row.department}>{row.department}</option>
                    )}
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="space-y-1">
                <span className={labelClass}>{tr('Ответственный', 'Assignee')}</span>
                <div className="flex items-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white pl-2 dark:border-white/10 dark:bg-white/[0.04] focus-within:border-indigo-500">
                  <UserAvatar name={assignedEmp?.name || '—'} avatarUrl={assignedEmp?.avatar_url} size="xs" />
                  <select
                    value={row.assignedTo}
                    onChange={(e) =>
                      handleUpdateRow(row.id, {
                        assignedTo: e.target.value,
                        department: nodeById.get(e.target.value)?.department || row.department,
                      })
                    }
                    className="tc-inline-input flex-1 min-w-0 h-full border-0 bg-transparent pr-2 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none truncate"
                  >
                    {nodes.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              {!isLead && (
                <div className="space-y-1">
                  <span className={labelClass}>{tr('Приоритет', 'Priority')}</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateRow(row.id, { priority: cyclePriority(row.priority) })}
                    title={tr('Нажмите, чтобы сменить приоритет', 'Click to change priority')}
                    className={`w-full h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center cursor-pointer ${prioMeta.className}`}
                  >
                    {prioMeta.label}
                  </button>
                </div>
              )}

              <label className="space-y-1">
                <span className={labelClass}>{tr('Срок', 'Due date')}</span>
                <input
                  type="date"
                  value={row.dueDate}
                  onChange={(e) => handleUpdateRow(row.id, { dueDate: e.target.value })}
                  className={`${fieldClass} tabular-nums`}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPlanSkeleton = () => (
    <div className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-white/[0.08] p-3.5 space-y-3">
          <div className="tc-skeleton h-3 w-24" />
          <div className="tc-skeleton h-4 w-3/4" />
          <div className="grid grid-cols-4 gap-2">
            <div className="tc-skeleton h-8" />
            <div className="tc-skeleton h-8" />
            <div className="tc-skeleton h-8" />
            <div className="tc-skeleton h-8" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    if (activeCanvasMode === 'brief') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: tr('Задач в работе', 'Open tasks'), value: String(insights.openCount) },
              {
                label: tr('Просрочено', 'Overdue'),
                value: String(insights.overdueCount),
                tone: insights.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : '',
              },
              { label: tr('Воронка', 'Pipeline'), value: formatMoney(insights.pipeline) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03] p-3"
              >
                <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">{kpi.label}</div>
                <div
                  className={`mt-1 text-base sm:text-lg font-semibold tabular-nums text-slate-900 dark:text-white truncate ${
                    kpi.tone || ''
                  }`}
                >
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {tr('Ответ ассистента', 'Assistant answer')}
                </span>
                {aiReply && !isQueryingAi && (
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400">
                    {aiReply.provider === 'gemini'
                      ? 'Gemini'
                      : aiReply.provider === 'tedcloud-engine'
                      ? tr('Встроенная аналитика', 'Built-in analytics')
                      : tr('Локальная сводка', 'Local summary')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyReply}
                  disabled={!aiReply || isQueryingAi}
                  className="h-7 px-2 rounded-md inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? tr('Скопировано', 'Copied') : tr('Копировать', 'Copy')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunAiBrief()}
                  disabled={isQueryingAi}
                  className="h-7 px-2 rounded-md inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isQueryingAi ? 'animate-spin' : ''}`} />
                  <span>{tr('Обновить', 'Refresh')}</span>
                </button>
              </div>
            </div>
            <div className="px-4 py-3.5" aria-live="polite" aria-busy={isQueryingAi}>
              {isQueryingAi ? (
                <div className="space-y-2">
                  <div className="tc-skeleton h-3 w-11/12" />
                  <div className="tc-skeleton h-3 w-10/12" />
                  <div className="tc-skeleton h-3 w-7/12" />
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-line break-words">
                  {aiReply?.text || localSummary}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeCanvasMode === 'contract') {
      if (leads.length === 0) {
        return renderEmptyState(
          <FileText className="w-5 h-5" />,
          tr('Нет сделок для документов', 'No deals for documents'),
          tr(
            'Договор, счёт и акт формируются по карточке сделки. Добавьте сделку в CRM, и документы будут заполнены реквизитами автоматически.',
            'Contracts, invoices and acts are generated from a deal card. Add a deal in CRM and documents will be prefilled automatically.'
          ),
          onNavigateToSection ? (
            <button
              type="button"
              onClick={() => {
                onNavigateToSection('crm');
                onClose();
              }}
              className="mt-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:bg-white/[0.09] cursor-pointer"
            >
              {tr('Перейти в CRM', 'Open CRM')}
            </button>
          ) : null
        );
      }
      return (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03] p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {tr('Договор, счёт и акт по сделке', 'Contract, invoice and act for a deal')}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              {tr(
                'Документы формата А4 заполняются реквизитами компании и клиента. Их можно распечатать или сохранить в PDF.',
                'A4 documents are prefilled with company and client details. Print them or save as PDF.'
              )}
            </p>
          </div>
          <label className="block space-y-1">
            <span className={labelClass}>{tr('Сделка', 'Deal')}</span>
            <select
              value={selectedLeadForContract?.id || ''}
              onChange={(e) => setSelectedContractLeadId(e.target.value)}
              className={fieldClass}
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.client_name || l.title) + ' · ' + formatMoney(Number(l.amount || 0))}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['contract', tr('Договор', 'Contract')],
                ['invoice', tr('Счёт', 'Invoice')],
                ['act', tr('Акт', 'Act')],
              ] as const
            ).map(([docType, label], i) => (
              <button
                key={docType}
                type="button"
                disabled={!selectedLeadForContract || !onOpenLegalDocModal}
                onClick={() =>
                  selectedLeadForContract && onOpenLegalDocModal?.(selectedLeadForContract, docType)
                }
                className={
                  i === 0
                    ? 'tc-btn-primary h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer'
                    : 'h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:bg-white/[0.09] inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer'
                }
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Plan modes
    const header =
      activeCanvasMode === 'rebalance'
        ? {
            title: tr('Перераспределение нагрузки', 'Workload rebalancing'),
            text:
              insights.busiest && insights.leastBusy && !insights.isBalanced
                ? tr(
                    `Предлагаем передать часть задач от ${insights.busiest.node.name} (${insights.busiest.count}) сотруднику ${insights.leastBusy.node.name} (${insights.leastBusy.count}).`,
                    `Suggest moving some tasks from ${insights.busiest.node.name} (${insights.busiest.count}) to ${insights.leastBusy.node.name} (${insights.leastBusy.count}).`
                  )
                : '',
          }
        : activeCanvasMode === 'deals_audit'
        ? {
            title: tr('Задачи по ключевым сделкам', 'Follow-ups for key deals'),
            text: activeLeads.length
              ? tr(
                  'Крупнейшие активные сделки — по каждой предлагается задача на следующий шаг.',
                  'Largest active deals — a next-step task is suggested for each.'
                )
              : '',
          }
        : {
            title: planSource
              ? tr(`План: «${planSource}»`, `Plan: “${planSource}”`)
              : tr('План по цели', 'Goal plan'),
            text: planSource
              ? tr(
                  'Проверьте шаги, ответственных и сроки — в рабочее пространство попадут только отмеченные.',
                  'Review steps, assignees and dates — only checked steps will be applied.'
                )
              : '',
          };

    let body: React.ReactNode;
    if (isGeneratingPlan) {
      body = renderPlanSkeleton();
    } else if (stagingRows.length > 0) {
      body = renderPlanRows();
    } else if (activeCanvasMode === 'rebalance') {
      body = renderEmptyState(
        <Users className="w-5 h-5" />,
        nodes.length < 2
          ? tr('Нужно минимум два сотрудника', 'At least two employees needed')
          : tr('Нагрузка распределена равномерно', 'Workload is balanced'),
        nodes.length < 2
          ? tr(
              'Перераспределять задачи можно, когда в штате больше одного человека. Пригласите сотрудников в разделе «Штат и доступы».',
              'Tasks can be rebalanced once the team has more than one person. Invite colleagues in Team & Access.'
            )
          : tr(
              'Разница в количестве открытых задач между сотрудниками не превышает одной. Перераспределение не требуется.',
              'Open task counts differ by at most one between employees. No rebalancing needed.'
            )
      );
    } else if (activeCanvasMode === 'deals_audit') {
      body = renderEmptyState(
        <Briefcase className="w-5 h-5" />,
        tr('Нет активных сделок', 'No active deals'),
        tr(
          'Когда в CRM появятся сделки на этапах «Новая» или «Переговоры», ассистент предложит задачи для их продвижения.',
          'When CRM has deals in New or Negotiation stages, the assistant will suggest tasks to move them forward.'
        ),
        onNavigateToSection ? (
          <button
            type="button"
            onClick={() => {
              onNavigateToSection('crm');
              onClose();
            }}
            className="mt-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:bg-white/[0.09] cursor-pointer"
          >
            {tr('Перейти в CRM', 'Open CRM')}
          </button>
        ) : null
      );
    } else {
      body = renderEmptyState(
        <Sparkles className="w-5 h-5" />,
        tr('Опишите цель или дайте команду', 'Describe a goal or give a command'),
        tr(
          'Ассистент разобьёт цель на шаги с ответственными и сроками. Ничего не сохраняется, пока вы не нажмёте «Применить».',
          'The assistant breaks the goal into steps with assignees and due dates. Nothing is saved until you press Apply.'
        ),
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setInputText(s);
                inputRef.current?.focus();
              }}
              className="h-7 px-2.5 rounded-full border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {(header.text || stagingRows.length > 0) && (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 break-words">
                {header.title}
              </h3>
              {header.text && (
                <p className="text-xs text-slate-600 dark:text-zinc-400">{header.text}</p>
              )}
            </div>
            {stagingRows.length > 0 && (
              <button
                type="button"
                onClick={handleAddBlankRow}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:bg-white/[0.09] inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tr('Добавить шаг', 'Add step')}</span>
              </button>
            )}
          </div>
        )}
        {body}
      </div>
    );
  };

  return (
    <div
      className="tc-overlay fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
        className="tc-pop-in w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[88vh] sm:rounded-2xl bg-slate-50 dark:bg-[#0F1117] sm:border border-slate-200 dark:border-white/[0.09] text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#12141B] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <TeddyPrismIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                {tr('ИИ-ассистент', 'AI assistant')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {companyName} · {tr(`задач ${tasks.length}`, `${tasks.length} tasks`)} ·{' '}
                {tr(`сделок ${leads.length}`, `${leads.length} deals`)} ·{' '}
                {tr(`сотрудников ${nodes.length}`, `${nodes.length} people`)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`hidden sm:inline-flex items-center h-7 px-2 rounded-md border text-[11px] font-medium tabular-nums ${
                quotaState.isExhausted
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400'
              }`}
              title={tr('Использовано ИИ-запросов сегодня', 'AI requests used today')}
            >
              {isEn ? quotaState.labelEn : quotaState.labelRu}
            </span>
            <kbd className="hidden md:inline-flex items-center h-7 px-1.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
              Esc
            </kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Закрыть', 'Close')}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.08] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt + tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-2.5 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#12141B] space-y-2.5 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 h-10 rounded-xl border border-slate-300 bg-white px-3 dark:border-white/[0.12] dark:bg-white/[0.04] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-colors">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                aria-label={tr('Запрос к ИИ-ассистенту', 'Ask the AI assistant')}
                placeholder={tr('Цель, команда или вопрос…', 'Goal, command or question…')}
                className="tc-inline-input w-full min-w-0 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleToggleVoiceRecognition}
              aria-pressed={isListening}
              aria-label={isListening ? tr('Остановить запись', 'Stop recording') : tr('Голосовой ввод', 'Voice input')}
              title={isListening ? tr('Остановить запись', 'Stop recording') : tr('Голосовой ввод', 'Voice input')}
              className={`h-10 w-10 rounded-xl border inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                isListening
                  ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 animate-pulse'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="submit"
              disabled={!inputText.trim() || isGeneratingPlan || isQueryingAi}
              className="tc-btn-primary h-10 px-3 sm:px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGeneratingPlan || isQueryingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CornerDownLeft className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{tr('Отправить', 'Send')}</span>
            </button>
          </form>

          <div
            role="tablist"
            aria-label={tr('Сценарии ассистента', 'Assistant scenarios')}
            className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1"
          >
            {CANVAS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCanvasMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchMode(tab.id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/30'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? tab.en : tab.ru}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 min-h-[240px]">
          {commitOutcome && (
            <div
              role={commitOutcome.kind === 'success' ? 'status' : 'alert'}
              className={`rounded-xl border px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs font-medium ${
                commitOutcome.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : commitOutcome.kind === 'partial'
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {commitOutcome.kind === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mt-px shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-px shrink-0" />
                )}
                <span>{commitOutcome.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setCommitOutcome(null)}
                aria-label={tr('Скрыть уведомление', 'Dismiss')}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {renderContent()}
        </div>

        {/* Footer */}
        {showPlanFooter && stagingRows.length > 0 && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#12141B] flex flex-wrap items-center justify-between gap-2.5 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="text-xs text-slate-600 dark:text-zinc-400">
              {tr(
                `Будет применено шагов: ${checkedCount} из ${stagingRows.length}`,
                `${checkedCount} of ${stagingRows.length} steps will be applied`
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  setStagingRows([]);
                  setPlanSource('');
                }}
                disabled={isApplyingDb}
                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09] disabled:opacity-40 cursor-pointer"
              >
                {tr('Очистить', 'Clear')}
              </button>
              <button
                type="button"
                onClick={() => void handleCommitToDatabase()}
                disabled={isApplyingDb || checkedCount === 0}
                title="Ctrl+Enter"
                className="tc-btn-primary h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isApplyingDb ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{tr(`Применить (${checkedCount})`, `Apply (${checkedCount})`)}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
