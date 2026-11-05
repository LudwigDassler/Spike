import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  Briefcase,
  FileText,
  Layers,
  SlidersHorizontal,
  Plus,
  Check,
  Printer,
  Terminal,
  Trash2,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { CrmLeadRecord, OrganizationNode, TaskPriority, TaskRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

export const TeddyAvatar: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => (
  <div
    className={`rounded-lg bg-slate-100 dark:bg-zinc-800/90 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0 ${className}`}
  >
    <Terminal className="w-4 h-4" />
  </div>
);

export interface StagingRowItem {
  id: string;
  checked: boolean;
  mode: 'create_task' | 'reassign_task' | 'followup_lead';
  title: string;
  department: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  existingTaskId?: string;
  leadId?: string;
  dealValue?: number;
}

type TeddyCanvasMode = 'decompose' | 'deals_audit' | 'rebalance' | 'contract';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  canvasMode?: TeddyCanvasMode;
}

interface TedCloudAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
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

export const TedCloudAiDrawer: React.FC<TedCloudAiDrawerProps> = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  currentUser,
  nodes,
  tasks,
  leads,
  onRefreshData,
  onOptimisticTasksAdded,
  onOpenLegalDocModal,
  showToast,
}) => {
  const { language, theme, formatMoney } = useLocale();
  const isEn = language === 'en';

  const [inputText, setInputText] = useState<string>('');
  const [activeCanvasMode, setActiveCanvasMode] = useState<TeddyCanvasMode>('decompose');
  const [canvasTitle, setCanvasTitle] = useState<string>(
    isEn ? 'Goal Decomposition & Task Batch' : 'Декомпозиция цели в задачи'
  );
  const [stagingRows, setStagingRows] = useState<StagingRowItem[]>([]);
  const [selectedContractLeadId, setSelectedContractLeadId] = useState<string>(
    leads[0]?.id || ''
  );
  const [isApplyingDb, setIsApplyingDb] = useState<boolean>(false);
  const [appliedSuccessBanner, setAppliedSuccessBanner] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<ChatTurn[]>([]);
  const [openAssigneePopoverRowId, setOpenAssigneePopoverRowId] = useState<string | null>(null);
  const [openDeptPopoverRowId, setOpenDeptPopoverRowId] = useState<string | null>(null);
  const [editingTitleRowId, setEditingTitleRowId] = useState<string | null>(null);

  const feedScrollRef = useRef<HTMLDivElement | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>(['Отдел продаж', 'Производство и ИТ', 'Финансы и Юр. отдел']);
    nodes.forEach((n) => {
      if (n.department && n.department.trim()) set.add(n.department.trim());
    });
    return Array.from(set);
  }, [nodes]);

  const buildDecompositionRows = (goalTopic?: string): StagingRowItem[] => {
    const cleanTopic = (goalTopic || '').trim();
    const prefix = cleanTopic ? `${cleanTopic}: ` : '';
    const n0 = nodes[0]?.id || currentUser?.id || '';
    const n1 = nodes[1]?.id || n0;
    const n2 = nodes[2]?.id || n0;
    const n3 = nodes[3]?.id || n1;

    return [
      {
        id: `stg-dec-1-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Prepare commercial specification & SLA' : 'Подготовить ТЗ, смету и регламент SLA'}`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: n0,
        priority: 'High',
        dueDate: getIsoDateOffset(2),
      },
      {
        id: `stg-dec-2-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Configure production pipeline & QA' : 'Настроить контур исполнения и контроль качества'}`,
        department: departments[1] || 'Производство и ИТ',
        assignedTo: n1,
        priority: 'Medium',
        dueDate: getIsoDateOffset(4),
      },
      {
        id: `stg-dec-3-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Approve B2B contract & issue invoice' : 'Согласовать договор поставки и выставить счет'}`,
        department: departments[2] || 'Финансы и Юр. отдел',
        assignedTo: n2,
        priority: 'High',
        dueDate: getIsoDateOffset(3),
      },
      {
        id: `stg-dec-4-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Verify client onboarding & final acceptance' : 'Провести контрольную приемку и запуск клиента'}`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: n3,
        priority: 'Medium',
        dueDate: getIsoDateOffset(5),
      },
    ];
  };

  const buildDealsAuditRows = (): StagingRowItem[] => {
    const activeLeads = leads.filter((l) => l.status !== 'Won');
    const source = activeLeads.length > 0 ? activeLeads.slice(0, 4) : leads.slice(0, 4);

    if (source.length === 0) {
      return [
        {
          id: `stg-crm-fallback-${Date.now()}`,
          checked: true,
          mode: 'followup_lead',
          title: isEn
            ? 'Follow up with key B2B client & send commercial proposal'
            : 'Связаться с ЛПР по ключевой сделке и направить КП',
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
        mode: 'followup_lead' as const,
        title: `${isEn ? 'Follow-up:' : 'Дожим сделки:'} ${leadTitle} (${formatMoney(leadVal)})`,
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
    const leastBusyNode =
      [...nodes].sort((a, b) => {
        const countA = openTasks.filter((t) => t.assigned_to === a.id).length;
        const countB = openTasks.filter((t) => t.assigned_to === b.id).length;
        return countA - countB;
      })[0] ||
      nodes[0] ||
      currentUser;

    if (openTasks.length === 0) {
      return buildDecompositionRows(isEn ? 'Sprint Rebalance' : 'Балансировка спринта');
    }

    return openTasks.slice(0, 4).map((t, idx) => ({
      id: `stg-reb-${t.id}-${idx}`,
      checked: true,
      mode: 'reassign_task',
      title: t.title,
      department: t.department || leastBusyNode?.department || departments[0] || 'Отдел продаж',
      assignedTo: leastBusyNode?.id || currentUser?.id || '',
      priority: (t.priority as TaskPriority) || 'Medium',
      dueDate: t.due_date ? String(t.due_date).split('T')[0] : getIsoDateOffset(2 + idx),
      existingTaskId: t.id,
    }));
  };

  useEffect(() => {
    if (!isOpen) return;
    if (dialogue.length === 0) {
      const initialRows = buildDecompositionRows();
      setStagingRows(initialRows);
      setActiveCanvasMode('decompose');
      setCanvasTitle(isEn ? 'Goal Decomposition & Task Batch' : 'Декомпозиция цели в задачи');
      setDialogue([
        {
          id: 'welcome-turn',
          role: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: isEn
            ? `Workspace "${companyName}" analyzed (${tasks.length} tasks, ${leads.length} deals, ${nodes.length} employees). Click any field on the action cards below to edit inline, or choose a quick command above the input dock.`
            : `Проанализирован контур «${companyName}» (задач: ${tasks.length}, сделок: ${leads.length}, сотрудников: ${nodes.length}). Отредактируйте карточки прямого действия ниже в один клик или выберите быструю команду над строкой ввода.`,
          canvasMode: 'decompose',
        },
      ]);
    }
    if (!selectedContractLeadId && leads[0]?.id) {
      setSelectedContractLeadId(leads[0].id);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerQuickAction = (mode: TeddyCanvasMode, customTopic?: string) => {
    setAppliedSuccessBanner(null);
    setOpenAssigneePopoverRowId(null);
    setOpenDeptPopoverRowId(null);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (mode === 'decompose') {
      const rows = buildDecompositionRows(customTopic);
      setStagingRows(rows);
      setActiveCanvasMode('decompose');
      setCanvasTitle(
        customTopic
          ? `${isEn ? 'Decomposition:' : 'Декомпозиция:'} ${customTopic}`
          : isEn
          ? 'Goal Decomposition & Task Batch'
          : 'Декомпозиция цели в задачи'
      );
      setDialogue((prev) => [
        ...prev.slice(-3),
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: customTopic || (isEn ? 'Break goal into tasks' : 'Разбить цель на задачи'),
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Prepared ${rows.length} interactive task cards. Click any title, assignee, or priority to customize before creating.`
            : `Подготовил ${rows.length} карточки поручений. Кликните по названию, исполнителю или приоритету для точной настройки.`,
          canvasMode: 'decompose',
        },
      ]);
    } else if (mode === 'deals_audit') {
      const rows = buildDealsAuditRows();
      setStagingRows(rows);
      setActiveCanvasMode('deals_audit');
      setCanvasTitle(
        isEn ? 'Stalled Deals Audit & Follow-ups' : 'Проверка зависших сделок CRM'
      );
      setDialogue((prev) => [
        ...prev.slice(-3),
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: isEn ? 'Check stalled deals' : 'Проверить зависшие сделки',
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Audited ${leads.length} CRM deals and prepared ${rows.length} follow-up action cards.`
            : `Проверил воронку CRM (${leads.length} сделок) и сформировал ${rows.length} поручения на дожим клиентов.`,
          canvasMode: 'deals_audit',
        },
      ]);
    } else if (mode === 'rebalance') {
      const rows = buildRebalanceRows();
      setStagingRows(rows);
      setActiveCanvasMode('rebalance');
      setCanvasTitle(
        isEn ? 'Workload Rebalancing Across Staff' : 'Балансировка нагрузки сотрудников'
      );
      setDialogue((prev) => [
        ...prev.slice(-3),
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: isEn ? 'Rebalance workload' : 'Сбалансировать нагрузку',
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Calculated optimal redistribution across ${nodes.length} staff members.`
            : `Рассчитал оптимальное перераспределение ${rows.length} задач между сотрудниками (${nodes.length} чел.).`,
          canvasMode: 'rebalance',
        },
      ]);
    } else if (mode === 'contract') {
      const targetLead =
        leads.find((l) => l.id === selectedContractLeadId) || leads[0] || null;
      if (targetLead && !selectedContractLeadId) {
        setSelectedContractLeadId(targetLead.id);
      }
      setActiveCanvasMode('contract');
      setCanvasTitle(
        isEn ? 'B2B Contract A4 Generator' : 'Подготовка договора поставки А4'
      );
      setDialogue((prev) => [
        ...prev.slice(-3),
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: isEn ? 'Prepare A4 contract' : 'Подготовить договор А4',
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Prepared official B2B contract A4 sheet below. Select a counterparty deal and open print preview or create an approval task.`
            : `Сформировал карточку коммерческого договора А4. Выберите сделку контрагента для вывода на печать или создания поручения на визирование.`,
          canvasMode: 'contract',
        },
      ]);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');

    const lower = trimmed.toLowerCase();
    if (lower.includes('договор') || lower.includes('счет') || lower.includes('contract')) {
      triggerQuickAction('contract', trimmed);
    } else if (lower.includes('сделк') || lower.includes('воронк') || lower.includes('crm')) {
      triggerQuickAction('deals_audit', trimmed);
    } else if (lower.includes('баланс') || lower.includes('нагрузк') || lower.includes('перегруз')) {
      triggerQuickAction('rebalance', trimmed);
    } else {
      triggerQuickAction('decompose', trimmed);
    }
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
      mode: 'create_task',
      title: isEn ? 'New operational task' : 'Новое операционное поручение',
      department: departments[0] || 'Отдел продаж',
      assignedTo: currentUser?.id || nodes[0]?.id || '',
      priority: 'Medium',
      dueDate: getIsoDateOffset(3),
    };
    setStagingRows((prev) => [...prev, newRow]);
    setEditingTitleRowId(newId);
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
          'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/25 hover:bg-rose-500/20',
      };
    }
    if (norm === 'low') {
      return {
        label: isEn ? 'Low' : 'Низкий',
        className:
          'bg-slate-500/10 text-slate-600 dark:text-zinc-300 border-slate-400/25 hover:bg-slate-500/20',
      };
    }
    return {
      label: isEn ? 'Medium' : 'Средний',
      className:
        'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/20',
    };
  };

  const handleCommitToDatabase = async () => {
    const selected = stagingRows.filter((r) => r.checked && r.title.trim());
    if (selected.length === 0 || isApplyingDb) return;

    setIsApplyingDb(true);
    setAppliedSuccessBanner(null);

    try {
      const optimisticCreated: TaskRecord[] = [];

      for (const item of selected) {
        if (item.mode === 'reassign_task' && item.existingTaskId) {
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
        } else {
          const payloadRecord = {
            company_id: companyId,
            title: item.title.trim(),
            description: `Создано через Teddy Copilot (${canvasTitle})`,
            status: 'Todo' as const,
            priority: item.priority,
            department: item.department,
            assigned_to: item.assignedTo || null,
            owner_node_id: item.assignedTo || null,
            created_by: currentUser?.id || null,
            due_date: item.dueDate,
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
        }
      }

      if (optimisticCreated.length > 0 && onOptimisticTasksAdded) {
        onOptimisticTasksAdded(optimisticCreated);
      }

      await onRefreshData();

      const msg = isEn
        ? `Created & synchronized ${selected.length} tasks in workspace.`
        : `Успешно создано и синхронизировано поручений: ${selected.length}`;
      setAppliedSuccessBanner(msg);
      if (showToast) showToast(msg);
    } finally {
      setIsApplyingDb(false);
    }
  };

  const selectedLeadForContract =
    leads.find((l) => l.id === selectedContractLeadId) || leads[0] || null;
  const checkedCount = stagingRows.filter((r) => r.checked).length;
  const lastAssistantTurn =
    [...dialogue].reverse().find((d) => d.role === 'assistant') || dialogue[dialogue.length - 1];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        style={{
          backgroundImage:
            'radial-gradient(600px circle at 50% 0%, rgba(99,102,241,0.10), transparent 70%)',
        }}
        className="max-w-3xl w-full max-h-[86vh] rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#12141C] text-slate-900 dark:text-zinc-100 shadow-[0_30px_90px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] flex flex-col overflow-hidden relative"
        onClick={(e) => {
          e.stopPropagation();
          setOpenAssigneePopoverRowId(null);
          setOpenDeptPopoverRowId(null);
        }}
      >
        {/* STREAMLINED RAYCAST AI / LINEAR ASK HEADER */}
        <div className="h-14 shrink-0 px-6 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <TeddyAvatar className="w-8 h-8" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                  Teddy
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                  Linear Ask · Copilot
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {canvasTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'Закрыть'}
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* UNIFIED STREAMLINED WORKSPACE STREAM (NO HEAVY PARTITIONS) */}
        <div
          ref={feedScrollRef}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0"
        >
          {/* Compact Contextual AI Status Bubble */}
          {lastAssistantTurn && (
            <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#181B26] px-4 py-3 flex items-start justify-between gap-3">
              <div className="text-xs leading-relaxed text-slate-700 dark:text-zinc-200">
                {lastAssistantTurn.text}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums shrink-0 mt-0.5">
                {lastAssistantTurn.timestamp}
              </span>
            </div>
          )}

          {appliedSuccessBanner && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{appliedSuccessBanner}</span>
            </div>
          )}

          {/* INLINE ACTION CARDS (LINEAR / RAYCAST STYLE) */}
          {activeCanvasMode === 'contract' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  {isEn
                    ? 'Select Deal for Official A4 Contract'
                    : 'Выберите сделку CRM для автозаполнения договора А4'}
                </div>
                <select
                  value={selectedContractLeadId}
                  onChange={(e) => setSelectedContractLeadId(e.target.value)}
                  className="h-9 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#181B26] px-3 text-xs font-medium text-slate-900 dark:text-zinc-100"
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.client_name || l.title} ({formatMoney(Number(l.amount || 0))})
                    </option>
                  ))}
                </select>
              </div>

              <div className="tc-a4-paper rounded-xl border border-slate-300 p-5 shadow-sm space-y-3.5 text-xs">
                <div className="flex items-start justify-between border-b border-slate-300 pb-3">
                  <div>
                    <div className="text-sm font-bold uppercase tracking-tight">
                      {isEn
                        ? `COMMERCIAL CONTRACT #TC-${new Date().getFullYear()}-09`
                        : `ДОГОВОР ПОСТАВКИ И РАБОТ № TC-${new Date().getFullYear()}-09`}
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {isEn ? 'City of Moscow' : 'г. Москва'} ·{' '}
                      {new Date().toLocaleDateString(isEn ? 'en-US' : 'ru-RU')}
                    </div>
                  </div>
                  <span className="tc-a4-badge px-2.5 py-1 rounded-md bg-slate-900 !text-white text-[11px] font-semibold">
                    B2B A4
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-[10px] font-semibold uppercase text-slate-600">
                      {isEn ? 'Supplier / Contractor' : 'Исполнитель'}
                    </div>
                    <div className="font-semibold mt-0.5">{companyName}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-[10px] font-semibold uppercase text-slate-600">
                      {isEn ? 'Client / Counterparty' : 'Заказчик'}
                    </div>
                    <div className="font-semibold mt-0.5">
                      {selectedLeadForContract?.client_name ||
                        selectedLeadForContract?.title ||
                        'ООО «Северсталь Контур»'}
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {selectedLeadForContract?.contact || 'Дирекция закупок'}
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr>
                      <th className="border border-slate-300 py-2 px-3 text-left">
                        {isEn ? 'Item / Deliverable' : 'Наименование работ / поставки'}
                      </th>
                      <th className="border border-slate-300 py-2 px-3 text-right">
                        {isEn ? 'Amount' : 'Сумма'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 py-2 px-3">
                        {selectedLeadForContract?.notes ||
                          (isEn
                            ? 'Enterprise license & implementation package'
                            : 'Комплексная поставка и внедрение по спецификации')}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-semibold tabular-nums">
                        {formatMoney(Number(selectedLeadForContract?.amount || 450000))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                {selectedLeadForContract && onOpenLegalDocModal && (
                  <button
                    type="button"
                    onClick={() => onOpenLegalDocModal(selectedLeadForContract, 'contract')}
                    className="h-10 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#181B26] text-slate-900 dark:text-zinc-100 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isEn ? 'Open Print A4' : 'Открыть печать А4'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const leadTitle =
                      selectedLeadForContract?.client_name ||
                      selectedLeadForContract?.title ||
                      'Контрагент';
                    setStagingRows([
                      {
                        id: `stg-doc-${Date.now()}`,
                        checked: true,
                        mode: 'create_task',
                        title: `Согласовать и подписать договор: ${leadTitle}`,
                        department: departments[2] || 'Финансы и Юр. отдел',
                        assignedTo: currentUser?.id || nodes[0]?.id || '',
                        priority: 'High',
                        dueDate: getIsoDateOffset(2),
                      },
                    ]);
                    setActiveCanvasMode('decompose');
                  }}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isEn ? 'Create Approval Task' : 'Создать поручение на визирование'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {isEn
                    ? 'Proposed Action Cards (Click any item to edit inline)'
                    : 'Интерактивные карточки поручений (кликните по любому полю для правки)'}
                </span>
                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#181B26] text-slate-700 dark:text-zinc-200 text-[11px] font-medium inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Add Card' : 'Добавить поручение'}</span>
                </button>
              </div>

              {/* LINEAR-STYLE SINGLE-ROW INLINE ACTION CARDS */}
              <div className="space-y-2">
                {stagingRows.map((row) => {
                  const assigneeNode =
                    nodes.find((n) => String(n.id) === String(row.assignedTo)) ||
                    currentUser ||
                    nodes[0];
                  const prioMeta = getPriorityBadgeMeta(row.priority);
                  const isAssigneeOpen = openAssigneePopoverRowId === row.id;
                  const isDeptOpen = openDeptPopoverRowId === row.id;
                  const isEditingTitle = editingTitleRowId === row.id;

                  return (
                    <div
                      key={row.id}
                      className={`group relative rounded-xl border transition px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 ${
                        row.checked
                          ? 'border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#181B26] shadow-2xs'
                          : 'border-slate-200/50 dark:border-white/[0.04] bg-slate-50/50 dark:bg-[#141720]/60 opacity-60'
                      }`}
                    >
                      {/* Left: Checkbox + Inline-Editable Title */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { checked: e.target.checked })
                          }
                          className="w-4 h-4 rounded accent-indigo-600 shrink-0 cursor-pointer"
                        />

                        {isEditingTitle ? (
                          <input
                            type="text"
                            autoFocus
                            value={row.title}
                            onChange={(e) =>
                              handleUpdateRow(row.id, { title: e.target.value })
                            }
                            onBlur={() => setEditingTitleRowId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setEditingTitleRowId(null);
                              }
                            }}
                            className="flex-1 h-7 rounded-md border border-indigo-500 bg-white dark:bg-zinc-900 px-2 text-xs font-medium text-slate-900 dark:text-zinc-100"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingTitleRowId(row.id)}
                            title={
                              isEn ? 'Click to edit task title' : 'Нажмите для редактирования текста'
                            }
                            className="flex-1 text-left text-xs font-medium text-slate-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate cursor-text"
                          >
                            {row.title}
                          </button>
                        )}
                      </div>

                      {/* Right: Department Pill + Assignee Avatar Popover + Priority Pill + Date + Delete */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                        {/* Department Pill with Popover */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenAssigneePopoverRowId(null);
                              setOpenDeptPopoverRowId(isDeptOpen ? null : row.id);
                            }}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 text-[11px] font-medium text-slate-700 dark:text-zinc-300 inline-flex items-center gap-1 hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer max-w-[135px]"
                          >
                            <span className="truncate">{row.department}</span>
                            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                          </button>

                          {isDeptOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-[#181B26] shadow-xl p-1.5 space-y-0.5"
                            >
                              {departments.map((dept) => (
                                <button
                                  key={dept}
                                  type="button"
                                  onClick={() => {
                                    handleUpdateRow(row.id, { department: dept });
                                    setOpenDeptPopoverRowId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                                    row.department === dept
                                      ? 'bg-indigo-600 !text-white font-semibold'
                                      : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <span className="truncate">{dept}</span>
                                  {row.department === dept && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Assignee Avatar + Name Chip with Popover */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDeptPopoverRowId(null);
                              setOpenAssigneePopoverRowId(isAssigneeOpen ? null : row.id);
                            }}
                            className="h-7 pl-1.5 pr-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 text-[11px] font-medium text-slate-800 dark:text-zinc-200 inline-flex items-center gap-1.5 hover:border-slate-300 dark:hover:border-white/20 transition cursor-pointer max-w-[155px]"
                          >
                            <UserAvatar
                              name={assigneeNode?.name || 'Сотрудник'}
                              avatarUrl={assigneeNode?.avatar_url}
                              size="xs"
                            />
                            <span className="truncate">
                              {assigneeNode?.name || 'Назначить'}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                          </button>

                          {isAssigneeOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 z-30 w-56 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-[#181B26] shadow-xl p-1.5 space-y-0.5"
                            >
                              {nodes.map((emp) => {
                                const isSel = String(emp.id) === String(row.assignedTo);
                                return (
                                  <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => {
                                      handleUpdateRow(row.id, {
                                        assignedTo: emp.id,
                                        ...(emp.department ? { department: emp.department } : {}),
                                      });
                                      setOpenAssigneePopoverRowId(null);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                                      isSel
                                        ? 'bg-indigo-600 !text-white font-semibold'
                                        : 'text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <UserAvatar
                                        name={emp.name}
                                        avatarUrl={emp.avatar_url}
                                        size="xs"
                                      />
                                      <div className="min-w-0">
                                        <div className="truncate">{emp.name}</div>
                                        <div
                                          className={`text-[10px] truncate ${
                                            isSel
                                              ? '!text-indigo-100'
                                              : 'text-slate-500 dark:text-zinc-400'
                                          }`}
                                        >
                                          {emp.role_type}
                                        </div>
                                      </div>
                                    </div>
                                    {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Priority Pill (cycles on click) */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateRow(row.id, {
                              priority: cyclePriority(row.priority),
                            })
                          }
                          title={
                            isEn ? 'Click to switch priority' : 'Нажмите для смены приоритета'
                          }
                          className={`h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${prioMeta.className}`}
                        >
                          {prioMeta.label}
                        </button>

                        {/* Compact Date Input Pill */}
                        <label className="h-7 px-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 text-[11px] font-medium text-slate-700 dark:text-zinc-300 inline-flex items-center gap-1 cursor-pointer">
                          <Calendar className="w-3 h-3 opacity-65 shrink-0" />
                          <input
                            type="date"
                            value={row.dueDate}
                            onChange={(e) =>
                              handleUpdateRow(row.id, { dueDate: e.target.value })
                            }
                            className="bg-transparent !border-0 text-[11px] tabular-nums text-slate-800 dark:text-zinc-200 focus:outline-none w-[92px] cursor-pointer"
                          />
                        </label>

                        {/* Remove Row */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          title={isEn ? 'Remove card' : 'Удалить карточку'}
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary CTA Button at bottom of Inline Action Cards */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                  {isEn
                    ? `Ready for instant commit: ${checkedCount} of ${stagingRows.length}`
                    : `Выбрано карточек к созданию: ${checkedCount} из ${stagingRows.length}`}
                </span>

                <button
                  type="button"
                  disabled={isApplyingDb || checkedCount === 0}
                  onClick={() => void handleCommitToDatabase()}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isApplyingDb ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {isApplyingDb
                      ? isEn
                        ? 'Creating tasks...'
                        : 'Запись поручений в БД...'
                      : isEn
                      ? `Create Selected Tasks (${checkedCount})`
                      : `Создать выбранные поручения (${checkedCount})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM FLOATING COMMAND-DOCK (RAYCAST / CLAUDE STYLE) */}
        <div className="shrink-0 px-6 pb-5 pt-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0E1017]/90 space-y-2.5">
          {/* Quick Command Chips right above the floating capsule */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              {
                id: 'decompose' as TeddyCanvasMode,
                label: isEn ? 'Break goal into tasks' : 'Разбить цель на задачи',
                icon: Layers,
              },
              {
                id: 'deals_audit' as TeddyCanvasMode,
                label: isEn ? 'Check stalled deals' : 'Проверить зависшие сделки',
                icon: Briefcase,
              },
              {
                id: 'rebalance' as TeddyCanvasMode,
                label: isEn ? 'Rebalance workload' : 'Сбалансировать нагрузку',
                icon: SlidersHorizontal,
              },
              {
                id: 'contract' as TeddyCanvasMode,
                label: isEn ? 'Prepare A4 contract' : 'Подготовить договор А4',
                icon: FileText,
              },
            ].map((chip) => {
              const Icon = chip.icon;
              const isActive = activeCanvasMode === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => triggerQuickAction(chip.id)}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] whitespace-nowrap transition cursor-pointer border ${
                    isActive
                      ? 'bg-indigo-600 !text-white border-indigo-600 font-semibold shadow-2xs'
                      : theme === 'light'
                      ? 'bg-white text-slate-700 border-slate-200/90 font-medium hover:bg-slate-100'
                      : 'bg-[#181B26] text-zinc-300 border-white/[0.08] font-medium hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Floating Capsule Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 rounded-2xl border border-slate-300/90 dark:border-white/12 bg-white dark:bg-[#181B26] px-3.5 py-1.5 shadow-sm focus-within:border-indigo-500 transition"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isEn
                  ? 'Ask Teddy to break down a goal, audit deals, or prepare a contract...'
                  : 'Опишите цель для декомпозиции, сделку или команду для Teddy...'
              }
              className="tc-composer-input !bg-transparent flex-1 h-8 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 shadow-2xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isEn ? 'Run' : 'Выполнить'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
