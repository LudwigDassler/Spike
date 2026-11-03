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
} from 'lucide-react';
import { CrmLeadRecord, OrganizationNode, TaskPriority, TaskRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

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
  const { language, formatMoney } = useLocale();
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
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

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

    return [
      {
        id: `stg-dec-1-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Prepare commercial specification & SLA' : 'Подготовить ТЗ, смету и регламент SLA'}`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: n0,
        priority: 'high',
        dueDate: getIsoDateOffset(2),
      },
      {
        id: `stg-dec-2-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Configure production pipeline & QA' : 'Настроить контур исполнения и контроль качества'}`,
        department: departments[1] || 'Производство и ИТ',
        assignedTo: n1,
        priority: 'medium',
        dueDate: getIsoDateOffset(4),
      },
      {
        id: `stg-dec-3-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Approve B2B contract & issue invoice' : 'Согласовать договор поставки и выставить счет'}`,
        department: departments[2] || 'Финансы и Юр. отдел',
        assignedTo: n2,
        priority: 'high',
        dueDate: getIsoDateOffset(3),
      },
    ];
  };

  const buildDealsAuditRows = (): StagingRowItem[] => {
    const activeLeads = leads.filter((l) => l.status !== 'Closed Won');
    const source = activeLeads.length > 0 ? activeLeads.slice(0, 5) : leads.slice(0, 4);

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
          priority: 'high',
          dueDate: getIsoDateOffset(1),
        },
      ];
    }

    return source.map((lead, idx) => ({
      id: `stg-crm-${lead.id}-${idx}`,
      checked: true,
      mode: 'followup_lead',
      title: `${isEn ? 'Follow-up:' : 'Дожим сделки:'} ${lead.company_name} (${formatMoney(Number(lead.value_amount || 0))})`,
      department: departments[0] || 'Отдел продаж',
      assignedTo: lead.owner_id || currentUser?.id || nodes[0]?.id || '',
      priority: Number(lead.value_amount || 0) >= 300000 ? 'high' : 'medium',
      dueDate: getIsoDateOffset(1 + (idx % 3)),
      leadId: lead.id,
      dealValue: Number(lead.value_amount || 0),
    }));
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

    return openTasks.slice(0, 5).map((t, idx) => ({
      id: `stg-reb-${t.id}-${idx}`,
      checked: true,
      mode: 'reassign_task',
      title: t.title,
      department: t.department || leastBusyNode?.department || departments[0] || 'Отдел продаж',
      assignedTo: leastBusyNode?.id || currentUser?.id || '',
      priority: (t.priority as TaskPriority) || 'medium',
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
            ? `Workspace "${companyName}" analyzed (${tasks.length} tasks, ${leads.length} deals, ${nodes.length} employees). Select a quick action in the top bar or describe your goal below — the interactive table on the right is ready for editing and committing to the database.`
            : `Проанализирован контур «${companyName}» (задач: ${tasks.length}, сделок: ${leads.length}, сотрудников: ${nodes.length}). Выберите действие в верхней панели или опишите задачу в чате — справа на холсте сформирована интерактивная таблица для проверки и записи в БД.`,
          canvasMode: 'decompose',
        },
      ]);
    }
    if (!selectedContractLeadId && leads[0]?.id) {
      setSelectedContractLeadId(leads[0].id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [dialogue.length]);

  if (!isOpen) return null;

  const triggerQuickAction = (mode: TeddyCanvasMode, customTopic?: string) => {
    setAppliedSuccessBanner(null);
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
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: customTopic || (isEn ? 'Decompose goal into tasks' : 'Декомпозиция цели'),
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Prepared ${rows.length} structured tasks on the right canvas. Adjust assignees, priority, or deadlines and click "Apply to Database".`
            : `Сформировал пакет из ${rows.length} поручений на правом холсте. Проверьте ответственных, приоритет и сроки, после чего нажмите «Применить в базу данных».`,
          canvasMode: 'decompose',
        },
      ]);
    } else if (mode === 'deals_audit') {
      const rows = buildDealsAuditRows();
      setStagingRows(rows);
      setActiveCanvasMode('deals_audit');
      setCanvasTitle(
        isEn ? 'CRM Pipeline Audit & Follow-up Tasks' : 'Аудит сделок CRM и задачи на дожим'
      );
      setDialogue((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: isEn ? 'Audit CRM deals' : 'Аудит сделок',
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Analyzed active CRM deals (${leads.length}) and generated ${rows.length} follow-up tasks on the right canvas.`
            : `Проверил активные сделки CRM (${leads.length}) и подготовил ${rows.length} поручений на дожим клиентов в правой панели.`,
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
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: isEn ? 'Rebalance team workload' : 'Балансировка нагрузки',
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Calculated optimal task redistribution across ${nodes.length} employees. Review the changes on the right and apply to the database.`
            : `Рассчитал перераспределение ${rows.length} активных задач между сотрудниками (${nodes.length} чел.). Проверьте назначения справа и примените в БД.`,
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
        isEn ? 'B2B Contract & Specification Generator' : 'Формирование договора и спецификации'
      );
      setDialogue((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          timestamp: nowTime,
          text: isEn ? 'Generate B2B contract' : 'Сформировать договор',
        },
        {
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          timestamp: nowTime,
          text: isEn
            ? `Prepared official B2B contract preview on the right canvas. You can select any deal and open the print-ready A4 sheet.`
            : `Подготовил бланк коммерческого договора на правом холсте. Выберите сделку из списка и откройте печатную форму А4 или сохраните задачу на согласование.`,
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
    setStagingRows((prev) => [
      ...prev,
      {
        id: `stg-custom-${Date.now()}`,
        checked: true,
        mode: 'create_task',
        title: isEn ? 'New operational task' : 'Новое операционное поручение',
        department: departments[0] || 'Отдел продаж',
        assignedTo: currentUser?.id || nodes[0]?.id || '',
        priority: 'medium',
        dueDate: getIsoDateOffset(3),
      },
    ]);
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
            status: 'To Do' as const,
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
        ? `Successfully applied ${selected.length} records to the database.`
        : `Успешно записано в базу данных: ${selected.length} поз.`;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-w-5xl w-full h-[78vh] rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111319] text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ВЕРХНЯЯ ШАПКА (h-14 shrink-0 px-6 border-b flex items-center justify-between) */}
        <div className="h-14 shrink-0 px-6 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#14171F] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <TeddyAvatar className="w-8 h-8" />
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
              Teddy
            </span>
          </div>

          {/* 4 аккуратные кнопки быстрых действий в один ряд без слэшей '/' */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              {
                id: 'decompose' as TeddyCanvasMode,
                label: isEn ? 'Goal Decomposition' : 'Декомпозиция цели',
                icon: Layers,
              },
              {
                id: 'deals_audit' as TeddyCanvasMode,
                label: isEn ? 'Deals Audit' : 'Аудит сделок',
                icon: Briefcase,
              },
              {
                id: 'rebalance' as TeddyCanvasMode,
                label: isEn ? 'Workload Balance' : 'Балансировка нагрузки',
                icon: SlidersHorizontal,
              },
              {
                id: 'contract' as TeddyCanvasMode,
                label: isEn ? 'Generate Contract' : 'Сформировать договор',
                icon: FileText,
              },
            ].map((btn) => {
              const Icon = btn.icon;
              const isActive = activeCanvasMode === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => triggerQuickAction(btn.id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer border ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs'
                      : 'bg-slate-100/80 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{btn.label}</span>
                </button>
              );
            })}
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

        {/* ОСНОВНАЯ РАБОЧАЯ ЗОНА В 2 КОЛОНКИ (flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* 1) ЛЕВАЯ КОЛОНКА (lg:col-span-5 flex flex-col border-r overflow-hidden — Живой Диалог) */}
          <div className="lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111319] overflow-hidden min-h-0">
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {dialogue.map((turn) => {
                const isUser = turn.role === 'user';
                return (
                  <div
                    key={turn.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-br-xs shadow-2xs'
                          : 'bg-slate-100 dark:bg-zinc-900 border border-slate-200/90 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{turn.text}</div>
                      <div
                        className={`text-[10px] mt-1.5 tabular-nums ${
                          isUser ? 'text-indigo-100' : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        {turn.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Нижняя строка ввода сообщения (shrink-0 p-4 border-t) с контрастной кнопкой Отправить */}
            <form
              onSubmit={handleSendMessage}
              className="shrink-0 p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#14171F] flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isEn
                    ? 'Describe a goal or task for decomposition...'
                    : 'Опишите цель или задачу для расчета...'
                }
                className="flex-1 h-10 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-3.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-600 dark:placeholder-zinc-400 focus:border-indigo-600 focus:outline-none"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 shadow-xs transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isEn ? 'Send' : 'Отправить'}</span>
              </button>
            </form>
          </div>

          {/* 2) ПРАВАЯ КОЛОНКА (lg:col-span-7 flex flex-col bg-slate-50/60 dark:bg-zinc-900/40 overflow-y-auto p-6 — Холст результатов и таблиц БД) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-50/60 dark:bg-zinc-900/40 overflow-y-auto p-6 min-h-0 justify-between gap-5">
            {activeCanvasMode === 'contract' ? (
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/[0.08] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {canvasTitle}
                      </h3>
                      <p className="text-xs text-slate-700 dark:text-zinc-400 mt-0.5">
                        {isEn
                          ? 'Select a CRM deal to populate official B2B contract requisites'
                          : 'Выберите сделку CRM для автозаполнения реквизитов договора'}
                      </p>
                    </div>

                    <select
                      value={selectedContractLeadId}
                      onChange={(e) => setSelectedContractLeadId(e.target.value)}
                      className="h-9 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-slate-900 dark:text-zinc-100"
                    >
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.company_name} ({formatMoney(Number(l.value_amount || 0))})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Готовый бланк договора на холсте */}
                  <div className="tc-a4-paper rounded-xl border border-slate-300 p-6 shadow-sm space-y-4 text-xs">
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
                      <span className="tc-a4-badge px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold">
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
                          {selectedLeadForContract?.company_name || 'ООО «Северсталь Контур»'}
                        </div>
                        <div className="text-[11px] mt-0.5">
                          {selectedLeadForContract?.contact_person || 'Дирекция закупок'}
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
                          <td className="border border-slate-300 py-2.5 px-3">
                            {selectedLeadForContract?.notes ||
                              (isEn
                                ? 'Enterprise license & implementation package'
                                : 'Комплексная поставка и внедрение по спецификации')}
                          </td>
                          <td className="border border-slate-300 py-2.5 px-3 text-right font-semibold tabular-nums">
                            {formatMoney(Number(selectedLeadForContract?.value_amount || 450000))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-700 dark:text-zinc-400">
                    {isEn
                      ? 'Ready for A4 printing or registering an approval task'
                      : 'Готово к выгрузке на печать А4 или созданию задачи на визирование'}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedLeadForContract && onOpenLegalDocModal && (
                      <button
                        type="button"
                        onClick={() => onOpenLegalDocModal(selectedLeadForContract, 'contract')}
                        className="h-10 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{isEn ? 'Open Print A4' : 'Открыть печать А4'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const leadTitle =
                          selectedLeadForContract?.company_name || 'Контрагент';
                        setStagingRows([
                          {
                            id: `stg-doc-${Date.now()}`,
                            checked: true,
                            mode: 'create_task',
                            title: `Согласовать и подписать договор: ${leadTitle}`,
                            department: departments[2] || 'Финансы и Юр. отдел',
                            assignedTo: currentUser?.id || nodes[0]?.id || '',
                            priority: 'high',
                            dueDate: getIsoDateOffset(2),
                          },
                        ]);
                        setActiveCanvasMode('decompose');
                      }}
                      className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isEn ? 'Apply to Database' : 'Применить в базу данных'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Заголовок холста + кнопка Добавить строку */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {canvasTitle}
                      </h3>
                      <p className="text-xs text-slate-700 dark:text-zinc-400 mt-0.5">
                        {isEn
                          ? 'Review and edit rows directly before committing to Supabase'
                          : 'Отредактируйте строки таблицы перед пакетной записью в базу данных'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddBlankRow}
                      className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Add Row' : 'Добавить задачу'}</span>
                    </button>
                  </div>

                  {appliedSuccessBanner && (
                    <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{appliedSuccessBanner}</span>
                    </div>
                  )}

                  {/* Просторные карточки-строки таблицы задач без обрезания селектов */}
                  <div className="space-y-2.5">
                    {stagingRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#151821] p-3.5 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) =>
                              handleUpdateRow(row.id, { checked: e.target.checked })
                            }
                            className="w-4 h-4 rounded accent-indigo-600 shrink-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) =>
                              handleUpdateRow(row.id, { title: e.target.value })
                            }
                            className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-zinc-900 px-3 text-xs font-medium text-slate-900 dark:text-zinc-100 focus:border-indigo-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            title={isEn ? 'Remove row' : 'Удалить строку'}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pl-6">
                          {/* Ответственный сотрудник */}
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-400 mb-1">
                              {isEn ? 'Assignee' : 'Исполнитель'}
                            </label>
                            <select
                              value={row.assignedTo}
                              onChange={(e) =>
                                handleUpdateRow(row.id, { assignedTo: e.target.value })
                              }
                              className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2.5 text-xs text-slate-900 dark:text-zinc-100"
                            >
                              {nodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Приоритет — широкая ячейка min-w-[130px] без обрезания слова «Высокий» */}
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-400 mb-1">
                              {isEn ? 'Priority' : 'Приоритет'}
                            </label>
                            <select
                              value={row.priority}
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  priority: e.target.value as TaskPriority,
                                })
                              }
                              className="w-full min-w-[130px] h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2.5 pr-7 text-xs font-medium text-slate-900 dark:text-zinc-100"
                            >
                              <option value="high">
                                {isEn ? 'High Priority' : 'Высокий'}
                              </option>
                              <option value="medium">
                                {isEn ? 'Medium Priority' : 'Средний'}
                              </option>
                              <option value="low">
                                {isEn ? 'Low Priority' : 'Низкий'}
                              </option>
                            </select>
                          </div>

                          {/* Дедлайн — чистый шрифт Inter tabular-nums */}
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-400 mb-1">
                              {isEn ? 'Due Date (SLA)' : 'Срок исполнения'}
                            </label>
                            <input
                              type="date"
                              value={row.dueDate}
                              onChange={(e) =>
                                handleUpdateRow(row.id, { dueDate: e.target.value })
                              }
                              className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2.5 text-xs font-sans tabular-nums text-slate-900 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Нижний бар холста с контрастной кнопкой «Применить в базу данных» */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-medium text-slate-700 dark:text-zinc-300 tabular-nums">
                    {isEn
                      ? `Selected for database commit: ${checkedCount} of ${stagingRows.length}`
                      : `Выбрано к записи в БД: ${checkedCount} из ${stagingRows.length}`}
                  </div>

                  <button
                    type="button"
                    disabled={isApplyingDb || checkedCount === 0}
                    onClick={() => void handleCommitToDatabase()}
                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {isApplyingDb ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>
                      {isApplyingDb
                        ? isEn
                          ? 'Committing to DB...'
                          : 'Запись в базу данных...'
                        : isEn
                        ? 'Apply to Database'
                        : 'Применить в базу данных'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
