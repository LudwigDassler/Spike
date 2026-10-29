import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  Play,
  Pause,
  Square,
  Check,
  Plus,
  FileText,
  Printer,
  ExternalLink,
  Copy,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Briefcase,
  UserPlus,
  X,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Building2,
  Download,
  Users,
  Coffee,
  Activity,
  ArrowRight,
} from 'lucide-react';
import {
  AccessLevel,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkShiftRecord,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

// ============================================================================
// 1. LIVE WORKDAY SHIFT TRACKER (Трекер рабочей смены в шапке с авто-отчетом и БД)
// ============================================================================
interface WorkdayShiftWidgetProps {
  companyId: string;
  currentProfile: OrganizationNode | null;
  tasks: TaskRecord[];
  onPostShiftSummary?: (summaryText: string) => Promise<void>;
  onSyncShiftState?: (status: 'online' | 'break' | 'offline', startedAt: string | null) => Promise<void>;
  onCreateWorkShift?: (shift: Partial<WorkShiftRecord>) => Promise<void>;
  showToast?: (msg: string) => void;
}

export const WorkdayShiftWidget: React.FC<WorkdayShiftWidgetProps> = ({
  companyId,
  currentProfile,
  tasks,
  onPostShiftSummary,
  onSyncShiftState,
  onCreateWorkShift,
  showToast,
}) => {
  const { language, theme } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';
  const storageKey = `tedcloud_workday_shift_${companyId}_${currentProfile?.id || 'root'}`;

  const [shiftState, setShiftState] = useState<{
    status: 'idle' | 'active' | 'break';
    startedAt: number | null;
  }>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.status === 'active' || parsed.status === 'break') && parsed.startedAt) {
          return parsed;
        }
      }
    } catch {}
    return { status: 'idle', startedAt: null };
  });

  const [elapsedSec, setElapsedSec] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(shiftState));
    } catch {}
  }, [shiftState, storageKey]);

  useEffect(() => {
    if (shiftState.status === 'idle' || !shiftState.startedAt) {
      setElapsedSec(0);
      return;
    }
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((Date.now() - (shiftState.startedAt || Date.now())) / 1000));
      setElapsedSec(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [shiftState]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  // Sync with DB shift_status if changed remotely
  useEffect(() => {
    const dbStatus = currentProfile?.shift_status;
    const dbStarted = currentProfile?.shift_started_at
      ? new Date(currentProfile.shift_started_at).getTime()
      : null;
    if (dbStatus === 'online' && dbStarted && !Number.isNaN(dbStarted)) {
      setShiftState((prev) =>
        prev.status === 'active' ? prev : { status: 'active', startedAt: dbStarted }
      );
    } else if (dbStatus === 'break' && dbStarted && !Number.isNaN(dbStarted)) {
      setShiftState((prev) =>
        prev.status === 'break' ? prev : { status: 'break', startedAt: dbStarted }
      );
    }
  }, [currentProfile?.shift_status, currentProfile?.shift_started_at]);

  const handleStartShift = () => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    setShiftState({ status: 'active', startedAt: nowMs });
    setMenuOpen(false);
    if (onSyncShiftState) {
      void onSyncShiftState('online', nowIso);
    }
    showToast?.(
      isEn
        ? 'Workday shift started · Status: Online'
        : 'Рабочая смена открыта · Статус: На линии'
    );
  };

  const handleToggleBreak = () => {
    const nextIsBreak = shiftState.status !== 'break';
    const startedIso = new Date(shiftState.startedAt || Date.now()).toISOString();
    setShiftState((prev) => ({
      ...prev,
      status: nextIsBreak ? 'break' : 'active',
    }));
    setMenuOpen(false);
    if (onSyncShiftState) {
      void onSyncShiftState(nextIsBreak ? 'break' : 'online', startedIso);
    }
    showToast?.(
      nextIsBreak
        ? isEn
          ? 'Shift paused · Status: On Break'
          : 'Перерыв включен · Статус обновлен в табеле'
        : isEn
        ? 'Shift resumed · Status: Online'
        : 'Вы вернулись на линию · Смена продолжается'
    );
  };

  const handleFinishShift = async () => {
    const startedAtMs = shiftState.startedAt || Date.now() - 60000;
    const endedAtIso = new Date().toISOString();
    const durationMin = Math.max(1, Math.round(elapsedSec / 60));
    const hrs = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    const durationLabel =
      hrs > 0
        ? isEn
          ? `${hrs}h ${mins}m`
          : `${hrs} ч ${mins} мин`
        : isEn
        ? `${mins}m`
        : `${mins} мин`;

    const myTasks = tasks.filter(
      (t) =>
        !currentProfile?.id ||
        t.assigned_to === currentProfile.id ||
        t.owner_node_id === currentProfile.id
    );
    const doneTasks = myTasks.filter((t) => t.status === 'Done');
    const inProgressTasks = myTasks.filter((t) => t.status === 'In Progress' || t.status === 'Todo');

    const summary = isEn
      ? `Workday Shift Report (${durationLabel}): Completed ${doneTasks.length} tasks, In Progress: ${inProgressTasks.length}.`
      : `Отчет за смену (${durationLabel}): Выполнено задач — ${doneTasks.length}, В работе — ${inProgressTasks.length}.`;

    setShiftState({ status: 'idle', startedAt: null });
    setMenuOpen(false);

    if (onSyncShiftState) {
      await onSyncShiftState('offline', null);
    }
    if (onCreateWorkShift) {
      await onCreateWorkShift({
        company_id: companyId,
        employee_id: currentProfile?.id || 'root',
        employee_name: currentProfile?.name || 'Сотрудник',
        role_type: currentProfile?.role_type || 'Специалист',
        department: currentProfile?.department || null,
        started_at: new Date(startedAtMs).toISOString(),
        ended_at: endedAtIso,
        duration_minutes: durationMin,
        tasks_completed: doneTasks.length,
        summary,
      });
    }
    if (onPostShiftSummary) {
      await onPostShiftSummary(summary);
    }
    showToast?.(
      isEn
        ? 'Shift completed · Saved to Time & Attendance Roster'
        : 'Смена завершена · Запись сохранена в табеле рабочего времени'
    );
  };

  if (shiftState.status === 'idle') {
    return (
      <button
        type="button"
        onClick={handleStartShift}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
          isLight
            ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-xs'
            : 'border-white/[0.08] bg-[#111114] hover:bg-zinc-800/80 text-zinc-200'
        }`}
        title={
          isEn
            ? 'Start workday shift & attendance timer'
            : 'Открыть рабочую смену и включить учет времени'
        }
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <span className="hidden sm:inline">{isEn ? 'Start Shift' : 'Начать смену'}</span>
        <Play className="w-3 h-3 text-zinc-400 sm:hidden" />
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
          shiftState.status === 'break'
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
            : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            shiftState.status === 'break' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
          }`}
        />
        <span className="hidden md:inline">
          {shiftState.status === 'break'
            ? isEn
              ? 'Break'
              : 'Перерыв'
            : isEn
            ? 'On Shift'
            : 'На смене'}
          {' · '}
        </span>
        <span className="font-semibold tabular-nums">{formatTimer(elapsedSec)}</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-white/10 bg-[#121216] shadow-2xl p-1.5 z-50 space-y-1">
          <div className="px-2.5 py-1.5 border-b border-white/[0.06]">
            <div className="text-[11px] font-semibold text-white">
              {currentProfile?.name || (isEn ? 'Active Shift' : 'Активная смена')}
            </div>
            <div className="text-[10px] text-zinc-400 tabular-nums">
              {isEn ? 'Elapsed time:' : 'Время на линии:'} {formatTimer(elapsedSec)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleBreak}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-200 hover:bg-white/[0.06] transition-colors text-left"
          >
            <Pause className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {shiftState.status === 'break'
                ? isEn
                  ? 'Resume Active Shift'
                  : 'Вернуться на линию'
                : isEn
                ? 'Pause / In a Meeting'
                : 'На перерыве / Встреча'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleFinishShift()}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-emerald-300 hover:bg-emerald-500/15 transition-colors text-left font-medium"
          >
            <Square className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {isEn ? 'End Shift with Auto-Report' : 'Завершить смену с авто-отчетом'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. 1-CLICK INLINE EDITABLE CELL (Редактирование ячеек в 1 клик без модалок)
// ============================================================================
interface InlineEditableCellProps {
  value: string | number;
  type?: 'text' | 'number';
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  displayValue?: React.ReactNode;
  disabled?: boolean;
  onSave: (newValue: string) => Promise<any> | any;
}

export const InlineEditableCell: React.FC<InlineEditableCellProps> = ({
  value,
  type = 'text',
  placeholder = '—',
  className = '',
  inputClassName = '',
  displayValue,
  disabled = false,
  onSave,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value ?? ''));
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === String(value ?? '').trim()) return;
    if (type === 'text' && !trimmed && String(value ?? '').trim()) {
      setDraft(String(value ?? ''));
      return;
    }
    await onSave(trimmed);
  };

  if (disabled) {
    return <span className={className}>{displayValue ?? (value || placeholder)}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(String(value ?? ''));
            setEditing(false);
          }
        }}
        className={`rounded-md border border-indigo-500/60 bg-[#15151B] px-2 py-0.5 text-xs text-white focus:outline-none tabular-nums ${inputClassName}`}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          setEditing(true);
        }
      }}
      title="Нажмите для быстрого редактирования (Enter — сохранить)"
      className={`cursor-text rounded px-1 -mx-1 hover:bg-white/[0.06] transition-colors ${className}`}
    >
      {displayValue ?? (value !== '' && value !== null && value !== undefined ? value : placeholder)}
    </span>
  );
};

// ============================================================================
// 3. QUICK INLINE ROW CREATORS (Строки мгновенного создания по Enter / Alt+N)
// ============================================================================
interface QuickInlineTaskBarProps {
  nodes: OrganizationNode[];
  leads: CrmLeadRecord[];
  defaultAssigneeId?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onCreateTask: (payload: {
    title: string;
    assigned_to: string | null;
    priority: TaskPriority;
    due_date: string | null;
    lead_id?: string | null;
  }) => Promise<void>;
}

export const QuickInlineTaskBar: React.FC<QuickInlineTaskBarProps> = ({
  nodes,
  leads,
  defaultAssigneeId = '',
  inputRef,
  onCreateTask,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [leadId, setLeadId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreateTask({
        title: title.trim(),
        assigned_to: assigneeId || null,
        priority,
        due_date: dueDate || null,
        lead_id: leadId || null,
      });
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/[0.08] bg-[#111115] p-2.5 flex flex-wrap lg:flex-nowrap items-center gap-2 shadow-sm"
    >
      <div className="flex items-center gap-2 flex-1 min-w-[210px]">
        <Plus className="w-4 h-4 text-indigo-400 shrink-0 ml-1" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            isEn
              ? 'Quick task creation (Alt+N) — type title and press Enter...'
              : 'Быстрое создание задачи (Alt+N) — введите суть и нажмите Enter...'
          }
          className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none py-1"
        />
      </div>

      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        aria-label={isEn ? 'Assignee' : 'Исполнитель'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200 max-w-[160px]"
      >
        <option value="">{isEn ? 'Assignee: Auto' : 'Исполнитель: Авто'}</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <select
        value={leadId}
        onChange={(e) => setLeadId(e.target.value)}
        aria-label={isEn ? 'Link CRM Deal' : 'Сделка CRM'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200 max-w-[155px]"
      >
        <option value="">{isEn ? 'Deal: None' : 'Без привязки к сделке'}</option>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.client_name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label={isEn ? 'Due Date' : 'Дедлайн'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200 tabular-nums"
      />

      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
        aria-label={isEn ? 'Priority' : 'Приоритет'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200"
      >
        <option value="High">{isEn ? 'High' : 'Высокий'}</option>
        <option value="Medium">{isEn ? 'Medium' : 'Средний'}</option>
        <option value="Low">{isEn ? 'Low' : 'Низкий'}</option>
      </select>

      <button
        type="submit"
        disabled={!title.trim() || submitting}
        className="tc-btn-primary h-8 px-3 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold transition-colors shrink-0"
      >
        {isEn ? 'Add (Enter)' : 'Создать (Enter)'}
      </button>
    </form>
  );
};

interface QuickInlineDealBarProps {
  nodes: OrganizationNode[];
  defaultAssigneeId?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onCreateDeal: (payload: {
    client_name: string;
    title: string;
    amount: number;
    tax_id: string | null;
    assigned_to: string | null;
  }) => Promise<void>;
}

export const QuickInlineDealBar: React.FC<QuickInlineDealBarProps> = ({
  nodes,
  defaultAssigneeId = '',
  inputRef,
  onCreateDeal,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [clientName, setClientName] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [taxId, setTaxId] = useState('');
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreateDeal({
        client_name: clientName.trim(),
        title: dealTitle.trim() || clientName.trim(),
        amount: Number(amount) || 0,
        tax_id: taxId.trim() || null,
        assigned_to: assigneeId || null,
      });
      setClientName('');
      setDealTitle('');
      setAmount('');
      setTaxId('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/[0.08] bg-[#111115] p-2.5 flex flex-wrap lg:flex-nowrap items-center gap-2 shadow-sm"
    >
      <div className="flex items-center gap-2 flex-1 min-w-[180px]">
        <Plus className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
        <input
          ref={inputRef}
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder={
            isEn
              ? 'Quick CRM deal (Alt+N): Counterparty / Company...'
              : 'Быстрая сделка (Alt+N): Компания / Контрагент...'
          }
          className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none py-1"
        />
      </div>

      <input
        type="text"
        value={dealTitle}
        onChange={(e) => setDealTitle(e.target.value)}
        placeholder={isEn ? 'Subject / Contract' : 'Предмет договора'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-white placeholder-zinc-500 w-36 sm:w-44"
      />

      <input
        type="number"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={isEn ? 'Amount' : 'Сумма'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-white placeholder-zinc-500 w-28 tabular-nums"
      />

      <input
        type="text"
        value={taxId}
        onChange={(e) => setTaxId(e.target.value)}
        placeholder={isEn ? 'Tax ID / VAT' : 'ИНН / БИН'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-white placeholder-zinc-500 w-28 tabular-nums"
      />

      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        aria-label={isEn ? 'Manager' : 'Ответственный'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200 max-w-[150px]"
      >
        <option value="">{isEn ? 'Manager: Auto' : 'Менеджер: Авто'}</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={!clientName.trim() || submitting}
        className="tc-btn-primary h-8 px-3 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold transition-colors shrink-0"
      >
        {isEn ? 'Add Deal (Enter)' : 'В воронку (Enter)'}
      </button>
    </form>
  );
};

interface QuickInlineEmployeeBarProps {
  departments: string[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onCreateEmployee: (payload: {
    name: string;
    role_type: string;
    department: string | null;
    access_level: AccessLevel;
  }) => Promise<void>;
}

export const QuickInlineEmployeeBar: React.FC<QuickInlineEmployeeBarProps> = ({
  departments,
  inputRef,
  onCreateEmployee,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState('');
  const [department, setDepartment] = useState('');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('member');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreateEmployee({
        name: name.trim(),
        role_type: roleType.trim() || (isEn ? 'Specialist' : 'Специалист'),
        department: department.trim() || null,
        access_level: accessLevel,
      });
      setName('');
      setRoleType('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/[0.08] bg-[#111115] p-2.5 flex flex-wrap lg:flex-nowrap items-center gap-2 shadow-sm"
    >
      <div className="flex items-center gap-2 flex-1 min-w-[180px]">
        <UserPlus className="w-4 h-4 text-indigo-400 shrink-0 ml-1" />
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            isEn
              ? 'Quick hire (Alt+N): Full Name (e.g. Alexey Smirnov)...'
              : 'Быстрый найм (Alt+N): ФИО сотрудника (Enter — выдать TC-код)...'
          }
          className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none py-1"
        />
      </div>

      <input
        type="text"
        value={roleType}
        onChange={(e) => setRoleType(e.target.value)}
        placeholder={isEn ? 'Role / Position' : 'Должность'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-white placeholder-zinc-500 w-40"
      />

      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        aria-label={isEn ? 'Department' : 'Отдел'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200 max-w-[160px]"
      >
        <option value="">{isEn ? 'Department: General' : 'Отдел: Общий'}</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        value={accessLevel}
        onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
        aria-label={isEn ? 'Access Level' : 'Уровень доступа'}
        className="h-8 rounded-lg border border-white/[0.08] bg-[#16161C] px-2.5 text-xs text-zinc-200"
      >
        <option value="member">{isEn ? 'Member' : 'Сотрудник'}</option>
        <option value="manager">{isEn ? 'Manager' : 'Руководитель'}</option>
        <option value="observer">{isEn ? 'Observer' : 'Наблюдатель'}</option>
        <option value="root">{isEn ? 'Root Admin' : 'Суперадмин'}</option>
      </select>

      <button
        type="submit"
        disabled={!name.trim() || submitting}
        className="tc-btn-primary h-8 px-3 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold transition-colors shrink-0"
      >
        {isEn ? 'Add Employee (Enter)' : 'Добавить в штат (Enter)'}
      </button>
    </form>
  );
};

// ============================================================================
// 4. TASK TIMELINE VIEW (Таймлайн сроков: Просрочено / Сегодня / Неделя / В планах)
// ============================================================================
interface TaskTimelineViewProps {
  tasks: TaskRecord[];
  nodes: OrganizationNode[];
  leads: CrmLeadRecord[];
  onSelectTask: (task: TaskRecord) => void;
  onStatusChange: (taskId: string, nextStatus: TaskStatus) => Promise<void>;
  onInlineTitleSave: (taskId: string, newTitle: string) => Promise<void>;
}

export const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({
  tasks,
  nodes,
  leads,
  onSelectTask,
  onStatusChange,
  onInlineTitleSave,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';

  const nodeMap = useMemo(() => {
    const map = new Map<string, OrganizationNode>();
    nodes.forEach((n) => map.set(String(n.id), n));
    return map;
  }, [nodes]);

  const leadMap = useMemo(() => {
    const map = new Map<string, CrmLeadRecord>();
    leads.forEach((l) => map.set(String(l.id), l));
    return map;
  }, [leads]);

  const buckets = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const overdue: TaskRecord[] = [];
    const today: TaskRecord[] = [];
    const thisWeek: TaskRecord[] = [];
    const upcoming: TaskRecord[] = [];

    tasks.forEach((t) => {
      const due = t.due_date ? String(t.due_date).slice(0, 10) : '';
      if (t.status !== 'Done' && ((due && due < todayStr) || t.priority === 'High')) {
        overdue.push(t);
      } else if (due === todayStr) {
        today.push(t);
      } else if (due && due > todayStr && due <= weekAhead) {
        thisWeek.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return [
      {
        id: 'overdue',
        title: isEn ? 'Overdue & Urgent SLA' : 'Просрочено / Горит SLA',
        badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
        items: overdue,
      },
      {
        id: 'today',
        title: isEn ? 'Due Today' : 'Сегодня по графику',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        items: today,
      },
      {
        id: 'week',
        title: isEn ? 'This Week (7 Days)' : 'На этой неделе (7 дней)',
        badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        items: thisWeek,
      },
      {
        id: 'upcoming',
        title: isEn ? 'Upcoming & Backlog' : 'В планах и Текущий поток',
        badgeClass: 'bg-zinc-500/15 text-zinc-300 border-white/10',
        items: upcoming,
      },
    ];
  }, [tasks, isEn]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {buckets.map((bucket) => (
        <div
          key={bucket.id}
          className="rounded-xl border border-white/[0.08] bg-[#111115] p-4 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <h4 className="text-xs font-semibold text-white tracking-tight">{bucket.title}</h4>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums ${bucket.badgeClass}`}
            >
              {bucket.items.length}
            </span>
          </div>

          {bucket.items.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              {isEn ? 'No tasks in this horizon' : 'Нет задач в этом временном горизонте'}
            </div>
          ) : (
            <div className="space-y-2">
              {bucket.items.map((task) => {
                const assignee = task.assigned_to ? nodeMap.get(String(task.assigned_to)) : null;
                const linkedDeal = task.lead_id ? leadMap.get(String(task.lead_id)) : null;
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="rounded-lg border border-white/[0.07] bg-[#16161C] hover:border-white/20 p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs font-medium text-white truncate">
                        <InlineEditableCell
                          value={task.title}
                          onSave={(nextVal) => onInlineTitleSave(task.id, nextVal)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span>{assignee?.name || (isEn ? 'Unassigned' : 'Не назначен')}</span>
                        {linkedDeal && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-[10px] text-indigo-300">
                            {linkedDeal.client_name}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="tabular-nums text-zinc-300">
                            · {String(task.due_date).slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>

                    <select
                      value={task.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        void onStatusChange(task.id, e.target.value as TaskStatus)
                      }
                      className="h-7 rounded-lg border border-white/10 bg-[#111115] px-2 text-[11px] text-zinc-200 shrink-0"
                    >
                      <option value="Todo">{isEn ? 'To Do' : 'К выполнению'}</option>
                      <option value="In Progress">{isEn ? 'In Progress' : 'В работе'}</option>
                      <option value="Done">{isEn ? 'Done' : 'Выполнено'}</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 5. 1-CLICK LEGAL DOCUMENT GENERATOR FROM CRM DEALS (Договор / КП / Акт-Счет)
// ============================================================================
interface LegalDocumentGeneratorModalProps {
  deal: CrmLeadRecord | null;
  company: Company | null;
  onClose: () => void;
}

export const LegalDocumentGeneratorModal: React.FC<LegalDocumentGeneratorModalProps> = ({
  deal,
  company,
  onClose,
}) => {
  const { language, formatMoney } = useLocale();
  const isEn = language === 'en';
  const [docType, setDocType] = useState<'contract' | 'proposal' | 'invoice'>('contract');

  useEffect(() => {
    if (!deal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deal, onClose]);

  if (!deal) return null;

  const vendorName = company?.billing_details?.legal_name || company?.name || 'ООО «ТедКлауд Энтерпрайз»';
  const vendorTaxId = company?.billing_details?.tax_id || '7701234567';
  const vendorAddress =
    company?.billing_details?.legal_address || 'г. Москва, Пресненская наб., 12';
  const vendorAccount = company?.billing_details?.iban_swift || '40702810900000012345 в АО «Т-Банк»';

  const clientName = deal.client_name || deal.full_name || 'Контрагент';
  const clientTaxId = deal.tax_id || '7709876543';
  const contractNo =
    deal.contract_number || `TC-${new Date().getFullYear()}-${String(deal.id).slice(0, 4).toUpperCase()}`;
  const dateStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'ru-RU');
  const amountFormatted = formatMoney(deal.amount || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111115] shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {isEn
                  ? '1-Click B2B Legal Document Generator'
                  : 'Авто-генератор юридических документов по сделке'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {clientName} · № {contractNo} · <span className="tabular-nums">{amountFormatted}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="tc-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isEn ? 'Print / Save PDF' : 'Печать / Сохранить в PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 py-2.5 border-b border-white/[0.07] bg-[#15151B] flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDocType('contract')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              docType === 'contract'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-300 hover:bg-white/[0.06]'
            }`}
          >
            {isEn ? 'B2B Master Contract' : 'Договор оказания услуг (B2B)'}
          </button>
          <button
            type="button"
            onClick={() => setDocType('proposal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              docType === 'proposal'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-300 hover:bg-white/[0.06]'
            }`}
          >
            {isEn ? 'Commercial Proposal (CP)' : 'Коммерческое предложение (КП)'}
          </button>
          <button
            type="button"
            onClick={() => setDocType('invoice')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              docType === 'invoice'
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-300 hover:bg-white/[0.06]'
            }`}
          >
            {isEn ? 'Completion Act & Invoice' : 'Счет-договор и Акт выполненных работ'}
          </button>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-6 max-h-[70dvh] overflow-y-auto bg-[#0D0D11]">
          <div className="rounded-xl border border-white/10 bg-white text-slate-900 p-6 sm:p-8 space-y-5 shadow-inner text-xs leading-relaxed">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="text-base font-bold text-slate-900 tracking-tight">
                  {docType === 'contract'
                    ? isEn
                      ? `MASTER B2B SERVICES AGREEMENT No. ${contractNo}`
                      : `ДОГОВОР ОКАЗАНИЯ КОРПОРАТИВНЫХ УСЛУГ № ${contractNo}`
                    : docType === 'proposal'
                    ? isEn
                      ? `COMMERCIAL PROPOSAL FOR ${clientName.toUpperCase()}`
                      : `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ ДЛЯ «${clientName}»`
                    : isEn
                    ? `INVOICE & COMPLETION ACT No. ${contractNo}`
                    : `СЧЕТ НА ОПЛАТУ И АКТ СДАЧИ-ПРИЕМКИ РАБОТ № ${contractNo}`}
                </div>
                <div className="text-slate-500 mt-0.5">
                  {isEn ? `Date of issue: ${dateStr}` : `Дата формирования: ${dateStr} г.`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900">{vendorName}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {isEn ? 'Tax ID:' : 'ИНН:'} {vendorTaxId}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  {isEn ? 'Contractor / Vendor:' : 'Исполнитель (Поставщик):'}
                </div>
                <div className="font-bold text-slate-900">{vendorName}</div>
                <div className="text-slate-600 tabular-nums">
                  {isEn ? 'Tax ID:' : 'ИНН / КПП:'} {vendorTaxId}
                </div>
                <div className="text-slate-600">{vendorAddress}</div>
                <div className="text-slate-600 tabular-nums">
                  {isEn ? 'Bank / IBAN:' : 'Р/с:'} {vendorAccount}
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  {isEn ? 'Customer / Counterparty:' : 'Заказчик (Плательщик):'}
                </div>
                <div className="font-bold text-slate-900">{clientName}</div>
                <div className="text-slate-600 tabular-nums">
                  {isEn ? 'Tax ID / VAT:' : 'ИНН / БИН:'} {clientTaxId}
                </div>
                <div className="text-slate-600">
                  {isEn ? 'Contract ref:' : 'Основание:'} № {contractNo}
                </div>
                {deal.contact && <div className="text-slate-600">{deal.contact}</div>}
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 text-left w-10">#</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">
                    {isEn ? 'Description of Services / Deliverables' : 'Наименование работ / услуг по проекту'}
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right w-36">
                    {isEn ? 'Total Amount' : 'Сумма к оплате'}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-2.5 tabular-nums">1</td>
                  <td className="border border-slate-300 px-3 py-2.5 font-medium text-slate-900">
                    {deal.title || deal.client_name}
                    {deal.notes ? ` — ${deal.notes}` : ''}
                  </td>
                  <td className="border border-slate-300 px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                    {amountFormatted}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="space-y-2 text-slate-700">
              {docType === 'contract' && (
                <>
                  <p>
                    <strong>1. {isEn ? 'Subject of Agreement:' : 'Предмет договора:'}</strong>{' '}
                    {isEn
                      ? `The Contractor undertakes to deliver the project "${deal.title || clientName}" in accordance with the agreed SLA, and the Customer undertakes to accept and pay ${amountFormatted}.`
                      : `Исполнитель обязуется выполнить комплекс работ по проекту «${deal.title || clientName}», а Заказчик обязуется принять и оплатить работы в размере ${amountFormatted}.`}
                  </p>
                  <p>
                    <strong>2. {isEn ? 'Settlement & Acceptance:' : 'Порядок расчетов и сдачи-приемки:'}</strong>{' '}
                    {isEn
                      ? 'Payment is made within 5 business days upon invoice issuance. Electronic document exchange (EDO) is recognized as legally binding.'
                      : 'Оплата производится по безналичному расчету в течение 5 (пяти) рабочих дней. Стороны признают юридическую силу электронного документооборота (ЭДО).'}
                  </p>
                </>
              )}
              {docType === 'proposal' && (
                <p>
                  {isEn
                    ? `This Commercial Proposal includes dedicated enterprise onboarding, SLA 99.9% guarantee, and full project execution for ${clientName}. Valid for 14 calendar days.`
                    : `Настоящее коммерческое предложение включает полное сопровождение проекта для «${clientName}», выделенный контур безопасности и гарантию соблюдения сроков SLA. Предложение действительно в течение 14 календарных дней.`}
                </p>
              )}
              {docType === 'invoice' && (
                <p>
                  {isEn
                    ? 'The above services have been rendered in full and on time. The Customer has no claims regarding volume, quality, or deadlines.'
                    : 'Вышеперечисленные работы (услуги) выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500">
                  {isEn ? 'For Contractor:' : 'От Исполнителя:'}
                </div>
                <div className="font-semibold text-slate-900 mt-1">{vendorName}</div>
                <div className="mt-5 border-b border-slate-400 w-48" />
                <div className="text-[10px] text-slate-400 mt-1">
                  {isEn ? 'Authorized Signature & Seal' : 'Подпись / М.П.'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">
                  {isEn ? 'For Customer:' : 'От Заказчика:'}
                </div>
                <div className="font-semibold text-slate-900 mt-1">{clientName}</div>
                <div className="mt-5 border-b border-slate-400 w-48" />
                <div className="text-[10px] text-slate-400 mt-1">
                  {isEn ? 'Authorized Signature & Seal' : 'Подпись / М.П.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. CLIENT DEAL ROOM — SHAREABLE EXTERNAL PORTAL (?deal_room=<ID>)
// ============================================================================
interface ClientDealRoomViewProps {
  deal: CrmLeadRecord;
  company: Company | null;
  tasks: TaskRecord[];
  onCloseRoom: () => void;
  onOpenLegalDocs?: (deal: CrmLeadRecord) => void;
}

export const ClientDealRoomView: React.FC<ClientDealRoomViewProps> = ({
  deal,
  company,
  tasks,
  onCloseRoom,
  onOpenLegalDocs,
}) => {
  const { language, formatMoney } = useLocale();
  const isEn = language === 'en';
  const [copiedLink, setCopiedLink] = useState(false);

  const dealTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.lead_id && String(t.lead_id) === String(deal.id)) ||
          t.title.toLowerCase().includes((deal.client_name || '').toLowerCase())
      ),
    [tasks, deal]
  );

  const stageOrder: Array<CrmLeadRecord['status']> = ['New', 'Negotiation', 'Won'];
  const currentIdx = Math.max(0, stageOrder.indexOf(deal.status === 'Lost' ? 'New' : deal.status));

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?deal_room=${encodeURIComponent(
    deal.id
  )}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs">
              TC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white tracking-tight">
                  {company?.name || 'TedCloud Enterprise'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-medium text-emerald-300">
                  {isEn ? 'Verified Client Deal Room' : 'Клиентский портал сделки (Deal Room)'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {isEn
                  ? 'Real-time project status, contract requisites & milestone tracker'
                  : 'Актуальный статус договора, этапы работ и закрывающие документы'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyShareLink()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#141419] hover:bg-zinc-800 text-xs font-medium text-white transition-colors"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>
                {copiedLink
                  ? isEn
                    ? 'Link Copied'
                    : 'Ссылка скопирована'
                  : isEn
                  ? 'Copy Client Link'
                  : 'Скопировать ссылку клиенту'}
              </span>
            </button>

            <button
              type="button"
              onClick={onCloseRoom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isEn ? 'Back to Workspace' : 'Вернуться в систему'}</span>
            </button>
          </div>
        </div>

        {/* Hero Deal Summary Card */}
        <div className="rounded-2xl border border-white/10 bg-[#111116] p-6 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-zinc-400">
                {isEn ? 'Counterparty / Client' : 'Заказчик / Контрагент'}
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight mt-0.5">
                {deal.client_name}
              </h1>
              <div className="text-xs text-zinc-400 mt-1">
                {deal.title || deal.client_name}
                {deal.tax_id ? ` · ИНН/VAT: ${deal.tax_id}` : ''}
                {deal.contract_number ? ` · № ${deal.contract_number}` : ''}
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-xs text-zinc-400">
                {isEn ? 'Contract Value' : 'Сумма контракта'}
              </div>
              <div className="text-2xl font-bold text-white tabular-nums mt-0.5">
                {formatMoney(deal.amount || 0)}
              </div>
              {onOpenLegalDocs && (
                <button
                  type="button"
                  onClick={() => onOpenLegalDocs(deal)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-medium text-indigo-300 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {isEn ? 'Open Contract / Invoice (PDF)' : 'Скачать Договор / Счет (PDF)'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Pipeline Progress Stepper */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              { key: 'New', label: isEn ? '1. Qualification & Spec' : '1. Инициация и ТЗ' },
              {
                key: 'Negotiation',
                label: isEn ? '2. Contract & Approval' : '2. Согласование и Договор',
              },
              {
                key: 'Won',
                label: isEn ? '3. Active Execution & Act' : '3. Реализация и Закрытие',
              },
            ].map((step, idx) => {
              const active = idx <= currentIdx;
              return (
                <div
                  key={step.key}
                  className={`rounded-xl border p-3 ${
                    active
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/[0.07] bg-[#16161C] text-zinc-400'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        active ? 'text-emerald-400' : 'text-zinc-600'
                      }`}
                    />
                    <span>{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linked Project Milestones / Tasks */}
        <div className="rounded-2xl border border-white/10 bg-[#111116] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {isEn ? 'Project Roadmap & Milestones' : 'Дорожная карта и этапы работ по проекту'}
            </h2>
            <span className="text-xs text-zinc-400 tabular-nums">
              {dealTasks.filter((t) => t.status === 'Done').length} / {dealTasks.length}{' '}
              {isEn ? 'completed' : 'выполнено'}
            </span>
          </div>

          {dealTasks.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#16161C] p-4 text-xs text-zinc-400">
              {isEn
                ? 'Project stages are currently being scheduled by your dedicated account manager.'
                : 'Этапы работ формируются персональным менеджером проекта и отобразятся здесь автоматически.'}
            </div>
          ) : (
            <div className="space-y-2">
              {dealTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-white/[0.07] bg-[#16161C] px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        t.status === 'Done' ? 'text-emerald-400' : 'text-indigo-400'
                      }`}
                    />
                    <span className="text-xs font-medium text-white truncate">{t.title}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium shrink-0 ${
                      t.status === 'Done'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-indigo-500/15 text-indigo-300'
                    }`}
                  >
                    {t.status === 'Done'
                      ? isEn
                        ? 'Completed'
                        : 'Выполнено'
                      : isEn
                      ? 'In Progress'
                      : 'В работе'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. EXECUTIVE UNIT ECONOMICS & SLA RADAR (Финансовая эффективность и SLA)
// ============================================================================
interface ExecutiveUnitEconomicsRadarProps {
  leads: CrmLeadRecord[];
  tasks: TaskRecord[];
  nodes: OrganizationNode[];
  onOpenCrm?: () => void;
  onOpenTasks?: () => void;
}

export const ExecutiveUnitEconomicsRadar: React.FC<ExecutiveUnitEconomicsRadarProps> = ({
  leads,
  tasks,
  nodes,
  onOpenCrm,
  onOpenTasks,
}) => {
  const { language, formatMoney } = useLocale();
  const isEn = language === 'en';

  const metrics = useMemo(() => {
    const wonAndActiveRevenue = leads
      .filter((l) => l.status !== 'Lost')
      .reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const staffCount = Math.max(1, nodes.length);
    const revenuePerEmployee = Math.round(wonAndActiveRevenue / staffCount);

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueCount = tasks.filter(
      (t) => t.status !== 'Done' && t.due_date && String(t.due_date).slice(0, 10) < todayStr
    ).length;
    const totalTasks = Math.max(1, tasks.length);
    const slaCompliance = Math.max(
      0,
      Math.min(100, Math.round(((totalTasks - overdueCount) / totalTasks) * 100))
    );

    const activeLeads = leads.filter((l) => l.status === 'New' || l.status === 'Negotiation');
    const stalledDealsCount = activeLeads.filter((lead) => {
      const hasTask = tasks.some(
        (t) =>
          t.status !== 'Done' &&
          ((t.lead_id && String(t.lead_id) === String(lead.id)) ||
            t.title.toLowerCase().includes((lead.client_name || '').toLowerCase()))
      );
      return !hasTask;
    }).length;

    const overloadedCount = nodes.filter((n) => {
      const activeForEmp = tasks.filter(
        (t) => t.status !== 'Done' && (t.assigned_to === n.id || t.owner_node_id === n.id)
      ).length;
      return activeForEmp >= 5;
    }).length;

    return {
      revenuePerEmployee,
      slaCompliance,
      overdueCount,
      stalledDealsCount,
      overloadedCount,
    };
  }, [leads, tasks, nodes]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white tracking-tight">
            {isEn
              ? 'Unit Economics & Operational SLA Radar'
              : 'Финансовая эффективность и Радар SLA'}
          </h3>
        </div>
        <span className="text-[11px] text-zinc-400">
          {isEn ? 'Real-time executive control' : 'Контроль рентабельности штата и воронки'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-[#16161C] p-3.5 space-y-1">
          <div className="text-[11px] text-zinc-400">
            {isEn ? 'Pipeline per Employee' : 'Выручка на сотрудника'}
          </div>
          <div className="text-base font-bold text-white tabular-nums">
            {formatMoney(metrics.revenuePerEmployee)}
          </div>
          <div className="text-[11px] text-emerald-400">
            {isEn ? `Across ${nodes.length} staff members` : `Штат: ${nodes.length} сотр.`}
          </div>
        </div>

        <div
          onClick={onOpenTasks}
          className="rounded-xl border border-white/[0.07] bg-[#16161C] hover:border-white/20 p-3.5 space-y-1 cursor-pointer transition-colors"
        >
          <div className="text-[11px] text-zinc-400">
            {isEn ? 'SLA Deadline Compliance' : 'Соблюдение дедлайнов (SLA)'}
          </div>
          <div className="text-base font-bold text-white tabular-nums">
            {metrics.slaCompliance}%
          </div>
          <div className="text-[11px] text-zinc-400 tabular-nums">
            {metrics.overdueCount > 0
              ? isEn
                ? `${metrics.overdueCount} overdue tasks`
                : `Просрочено задач: ${metrics.overdueCount}`
              : isEn
              ? 'Zero overdue tasks'
              : 'Просрочек нет'}
          </div>
        </div>

        <div
          onClick={onOpenCrm}
          className="rounded-xl border border-white/[0.07] bg-[#16161C] hover:border-white/20 p-3.5 space-y-1 cursor-pointer transition-colors"
        >
          <div className="text-[11px] text-zinc-400">
            {isEn ? 'Deals Without Next Step' : 'Сделки без движения (Риск)'}
          </div>
          <div
            className={`text-base font-bold tabular-nums ${
              metrics.stalledDealsCount > 0 ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {metrics.stalledDealsCount}
          </div>
          <div className="text-[11px] text-zinc-400">
            {metrics.stalledDealsCount > 0
              ? isEn
                ? 'Require assigned action step'
                : 'Требуют назначения задачи'
              : isEn
              ? 'All deals have active tasks'
              : 'По всем сделкам назначены шаги'}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#16161C] p-3.5 space-y-1">
          <div className="text-[11px] text-zinc-400">
            {isEn ? 'Workload Balance (5+ Tasks)' : 'Индикатор перегруза (5+ задач)'}
          </div>
          <div className="text-base font-bold text-white tabular-nums">
            {metrics.overloadedCount}{' '}
            <span className="text-xs font-normal text-zinc-400">
              {isEn ? 'employees' : 'сотр.'}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400">
            {metrics.overloadedCount === 0
              ? isEn
                ? 'Optimal team load'
                : 'Нагрузка распределена ровно'
              : isEn
              ? 'Redistribute tasks recommended'
              : 'Рекомендуется делегирование'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. DASHBOARD SHIFTS OVERVIEW WIDGET (БЛОК 1.3: Заполнение пустоты на Дашборде слева)
// ============================================================================
interface DashboardShiftsOverviewWidgetProps {
  nodes: OrganizationNode[];
  workShifts: WorkShiftRecord[];
  onOpenShiftsSection: () => void;
}

export const DashboardShiftsOverviewWidget: React.FC<DashboardShiftsOverviewWidgetProps> = ({
  nodes,
  workShifts,
  onOpenShiftsSection,
}) => {
  const { language, formatRole } = useLocale();
  const isEn = language === 'en';

  const onlineNodes = useMemo(
    () =>
      nodes.filter(
        (n) => n.shift_status === 'online' || n.shift_status === 'active'
      ),
    [nodes]
  );
  const breakNodes = useMemo(
    () => nodes.filter((n) => n.shift_status === 'break'),
    [nodes]
  );

  const totalHoursToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const completedMins = workShifts
      .filter((ws) => String(ws.started_at || ws.created_at || '').startsWith(todayStr))
      .reduce((acc, ws) => acc + Math.max(0, Number(ws.duration_minutes || 0)), 0);
    const activeMins = [...onlineNodes, ...breakNodes].reduce((acc, n) => {
      if (!n.shift_started_at) return acc + 15;
      const diff = Math.max(
        1,
        Math.round((Date.now() - new Date(n.shift_started_at).getTime()) / 60000)
      );
      return acc + (Number.isFinite(diff) ? diff : 15);
    }, 0);
    return ((completedMins + activeMins) / 60).toFixed(1);
  }, [workShifts, onlineNodes, breakNodes]);

  const rosterPreview = useMemo(() => {
    const activeFirst = [...nodes].sort((a, b) => {
      const score = (st?: string | null) =>
        st === 'online' || st === 'active' ? 2 : st === 'break' ? 1 : 0;
      return score(b.shift_status) - score(a.shift_status);
    });
    return activeFirst.slice(0, 4);
  }, [nodes]);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#121215] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white tracking-tight truncate">
            {isEn ? 'Active Shifts & Attendance Today' : 'Активные смены и табель сегодня'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenShiftsSection}
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors shrink-0"
        >
          <span>{isEn ? 'Open Roster' : 'Табель смен'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mini KPI Strip */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06] bg-white/[0.01]">
        <div className="px-4 py-2.5">
          <div className="text-[11px] text-[#8E8E93]">
            {isEn ? 'Online Now' : 'На линии'}
          </div>
          <div className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{onlineNodes.length}</span>
          </div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[11px] text-[#8E8E93]">
            {isEn ? 'On Break' : 'На перерыве'}
          </div>
          <div className="text-sm font-bold text-amber-400 tabular-nums mt-0.5">
            {breakNodes.length}
          </div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[11px] text-[#8E8E93]">
            {isEn ? 'Hours Today' : 'Часов за день'}
          </div>
          <div className="text-sm font-bold text-white tabular-nums mt-0.5">
            {totalHoursToday} {isEn ? 'h' : 'ч'}
          </div>
        </div>
      </div>

      {/* Compact Live Roster */}
      <div className="divide-y divide-white/[0.05]">
        {rosterPreview.map((emp) => {
          const isOnline = emp.shift_status === 'online' || emp.shift_status === 'active';
          const isBreak = emp.shift_status === 'break';
          const startedTime = emp.shift_started_at
            ? new Date(emp.shift_started_at).toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null;
          return (
            <div
              key={emp.id}
              onClick={onOpenShiftsSection}
              className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar name={emp.name} avatarUrl={emp.avatar_url} size="sm" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{emp.name}</div>
                  <div className="text-[11px] text-[#8E8E93] truncate">
                    {formatRole(emp.role_type)}
                    {emp.department ? ` · ${formatRole(emp.department)}` : ''}
                  </div>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0 ${
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isBreak
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-[#8E8E93]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline
                      ? 'bg-emerald-400'
                      : isBreak
                      ? 'bg-amber-400'
                      : 'bg-zinc-500'
                  }`}
                />
                <span>
                  {isOnline
                    ? startedTime
                      ? isEn
                        ? `On shift since ${startedTime}`
                        : `На смене с ${startedTime}`
                      : isEn
                      ? 'Online'
                      : 'На линии'
                    : isBreak
                    ? isEn
                      ? 'On Break'
                      : 'Перерыв'
                    : isEn
                    ? 'Offline'
                    : 'Не в сети'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 8. TIME & ATTENDANCE ROSTER PAGE (БЛОК 2: ОТДЕЛЬНАЯ СТРАНИЦА «СМЕНЫ И ВРЕМЯ»)
// ============================================================================
interface TimeAndAttendanceViewProps {
  company: Company | null;
  currentProfile: OrganizationNode | null;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  workShifts: WorkShiftRecord[];
  onSyncShiftState?: (status: 'online' | 'break' | 'offline', startedAt: string | null) => Promise<void>;
  onCreateWorkShift?: (shift: Partial<WorkShiftRecord>) => Promise<void>;
  showToast?: (msg: string) => void;
}

export const TimeAndAttendanceView: React.FC<TimeAndAttendanceViewProps> = ({
  company,
  currentProfile,
  nodes,
  tasks,
  workShifts,
  onSyncShiftState,
  onCreateWorkShift,
  showToast,
}) => {
  const { language, theme, formatRole } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';

  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const onlineEmployees = useMemo(
    () =>
      nodes.filter(
        (n) => n.shift_status === 'online' || n.shift_status === 'active'
      ),
    [nodes]
  );

  const breakEmployees = useMemo(
    () => nodes.filter((n) => n.shift_status === 'break'),
    [nodes]
  );

  const weeklyHours = useMemo(() => {
    const weekAgoMs = Date.now() - 7 * 24 * 3600 * 1000;
    const completedMins = workShifts
      .filter((ws) => {
        const ts = new Date(ws.started_at || ws.created_at || Date.now()).getTime();
        return !Number.isNaN(ts) && ts >= weekAgoMs;
      })
      .reduce((acc, ws) => acc + Math.max(0, Number(ws.duration_minutes || 0)), 0);

    const liveMins = [...onlineEmployees, ...breakEmployees].reduce((acc, emp) => {
      if (!emp.shift_started_at) return acc + 20;
      const diff = Math.max(
        1,
        Math.round((nowTick - new Date(emp.shift_started_at).getTime()) / 60000)
      );
      return acc + (Number.isFinite(diff) ? diff : 20);
    }, 0);

    return ((completedMins + liveMins) / 60).toFixed(1);
  }, [workShifts, onlineEmployees, breakEmployees, nowTick]);

  const completedTasksCount = useMemo(() => {
    const fromShifts = workShifts.reduce(
      (acc, ws) => acc + Math.max(0, Number(ws.tasks_completed || 0)),
      0
    );
    const doneTasks = tasks.filter((t) => t.status === 'Done').length;
    return Math.max(fromShifts, doneTasks);
  }, [workShifts, tasks]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach((n) => {
      if (n.department && n.department.trim()) set.add(n.department.trim());
    });
    return Array.from(set);
  }, [nodes]);

  const filteredRoster = useMemo(() => {
    return nodes.filter((n) => {
      if (selectedEmployeeFilter !== 'ALL' && n.id !== selectedEmployeeFilter) return false;
      if (departmentFilter !== 'ALL' && (n.department || '') !== departmentFilter) return false;
      return true;
    });
  }, [nodes, selectedEmployeeFilter, departmentFilter]);

  const filteredShiftsHistory = useMemo(() => {
    return workShifts.filter((ws) => {
      if (selectedEmployeeFilter !== 'ALL' && ws.employee_id !== selectedEmployeeFilter) {
        return false;
      }
      if (departmentFilter !== 'ALL' && (ws.department || '') !== departmentFilter) {
        return false;
      }
      return true;
    });
  }, [workShifts, selectedEmployeeFilter, departmentFilter]);

  const formatDurationLabel = (minsRaw: number) => {
    const mins = Math.max(1, Math.round(minsRaw || 1));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
      return isEn ? `${h}h ${m}m` : `${h} ч ${m} мин`;
    }
    return isEn ? `${m}m` : `${m} мин`;
  };

  const formatElapsedSince = (startedAtIso?: string | null) => {
    if (!startedAtIso) return isEn ? 'Active' : 'На линии';
    const ts = new Date(startedAtIso).getTime();
    if (Number.isNaN(ts)) return isEn ? 'Active' : 'На линии';
    const diffMins = Math.max(1, Math.round((nowTick - ts) / 60000));
    return formatDurationLabel(diffMins);
  };

  const handleExportShiftsCsv = () => {
    const headers = isEn
      ? ['Date', 'Employee', 'Role', 'Department', 'Start Time', 'End Time', 'Duration (min)', 'Tasks Completed', 'Shift Summary']
      : ['Дата', 'Сотрудник', 'Должность', 'Подразделение', 'Начало смены', 'Окончание смены', 'Длительность (мин)', 'Закрыто задач', 'Итоговый отчет за смену'];

    const rows = filteredShiftsHistory.map((ws) => {
      const startDt = ws.started_at ? new Date(ws.started_at) : new Date();
      const endDt = ws.ended_at ? new Date(ws.ended_at) : new Date();
      return [
        startDt.toLocaleDateString(isEn ? 'en-US' : 'ru-RU'),
        ws.employee_name || 'Сотрудник',
        ws.role_type || 'Специалист',
        ws.department || '—',
        startDt.toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }),
        endDt.toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }),
        String(ws.duration_minutes || 1),
        String(ws.tasks_completed ?? 0),
        String(ws.summary || '').replace(/\r?\n/g, ' '),
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `tedcloud_timesheet_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast?.(
      isEn
        ? 'Time & Attendance CSV exported'
        : 'Табель рабочего времени выгружен в CSV'
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. ВЕРХНИЕ 4 KPI КАРТОЧКИ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8E8E93]">
            <span>{isEn ? 'Online Now' : 'Сейчас на линии (Online)'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {onlineEmployees.length}{' '}
            <span className="text-xs font-normal text-[#8E8E93]">
              / {nodes.length} {isEn ? 'staff' : 'сотр.'}
            </span>
          </div>
          <div className="text-[11px] text-emerald-400">
            {isEn ? 'Real-time shift telemetry' : 'Живой мониторинг присутствия'}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8E8E93]">
            <span>{isEn ? 'On Break / Meeting' : 'На перерыве'}</span>
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums">
            {breakEmployees.length}
          </div>
          <div className="text-[11px] text-[#8E8E93]">
            {isEn ? 'Paused timer or in meeting' : 'Таймер смены на паузе'}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8E8E93]">
            <span>{isEn ? 'Hours Worked (Week)' : 'Отработано часов за неделю'}</span>
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {weeklyHours}{' '}
            <span className="text-xs font-normal text-[#8E8E93]">{isEn ? 'hrs' : 'ч'}</span>
          </div>
          <div className="text-[11px] text-[#8E8E93]">
            {isEn
              ? `${workShifts.length} completed shifts in log`
              : `Зафиксировано смен в базе: ${workShifts.length}`}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#8E8E93]">
            <span>{isEn ? 'Tasks Closed in Shifts' : 'Выполнено задач за смену'}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {completedTasksCount}
          </div>
          <div className="text-[11px] text-[#8E8E93]">
            {isEn ? 'Verified deliverables' : 'Подтвержденный результат по задачам'}
          </div>
        </div>
      </div>

      {/* 2. ПАНЕЛЬ ФИЛЬТРАЦИИ И ВЫГРУЗКИ CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#121215] p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedEmployeeFilter}
            onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
            className="h-9 rounded-xl border border-white/10 bg-[#18181D] px-3 text-xs text-white focus:border-white/25 focus:outline-none"
          >
            <option value="ALL">
              {isEn ? 'All Employees' : 'Все сотрудники компании'} ({nodes.length})
            </option>
            {nodes.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} — {formatRole(emp.role_type)}
              </option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-9 rounded-xl border border-white/10 bg-[#18181D] px-3 text-xs text-white focus:border-white/25 focus:outline-none"
          >
            <option value="ALL">
              {isEn ? 'All Departments' : 'Все подразделения'}
            </option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {formatRole(dept)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportShiftsCsv}
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isEn ? 'Export Timesheet CSV' : 'Выгрузить табель в CSV'}</span>
          </button>
        </div>
      </div>

      {/* 3. ЖИВОЕ ТАБЛО ПРИСУТСТВИЯ (LIVE ROSTER) */}
      <div className="rounded-xl border border-white/[0.07] bg-[#121215] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {isEn ? 'Live Attendance Roster' : 'Живое табло присутствия сотрудников'}
            </h3>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              {isEn
                ? 'Real-time employee shift status, start timestamp, and elapsed work time'
                : 'Текущий статус каждого сотрудника, время открытия смены и живой таймер на линии'}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-medium text-emerald-300">
            <Activity className="w-3.5 h-3.5" />
            <span>
              {isEn
                ? `${onlineEmployees.length} Active`
                : `На смене: ${onlineEmployees.length}`}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredRoster.map((emp) => {
            const isOnline = emp.shift_status === 'online' || emp.shift_status === 'active';
            const isBreak = emp.shift_status === 'break';
            const startedClock = emp.shift_started_at
              ? new Date(emp.shift_started_at).toLocaleTimeString(
                  isEn ? 'en-US' : 'ru-RU',
                  { hour: '2-digit', minute: '2-digit' }
                )
              : null;
            const empActiveTasks = tasks.filter(
              (t) =>
                (t.assigned_to === emp.id || t.owner_node_id === emp.id) &&
                t.status !== 'Done' &&
                t.status !== 'Cancelled'
            ).length;
            const empDoneTasks = tasks.filter(
              (t) =>
                (t.assigned_to === emp.id || t.owner_node_id === emp.id) &&
                t.status === 'Done'
            ).length;

            return (
              <div
                key={emp.id}
                className="rounded-xl border border-white/[0.08] bg-[#16161B] p-4 flex flex-col justify-between gap-3 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={emp.name} avatarUrl={emp.avatar_url} size="md" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {emp.name}
                      </div>
                      <div className="text-[11px] text-[#8E8E93] truncate">
                        {formatRole(emp.role_type)}
                      </div>
                      {emp.department && (
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {formatRole(emp.department)}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0 ${
                      isOnline
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : isBreak
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-[#8E8E93]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOnline
                          ? 'bg-emerald-400 animate-pulse'
                          : isBreak
                          ? 'bg-amber-400'
                          : 'bg-zinc-500'
                      }`}
                    />
                    <span>
                      {isOnline
                        ? startedClock
                          ? isEn
                            ? `Since ${startedClock}`
                            : `На смене с ${startedClock}`
                          : isEn
                          ? 'Online'
                          : 'На смене'
                        : isBreak
                        ? isEn
                          ? 'Break'
                          : 'Перерыв'
                        : isEn
                        ? 'Offline'
                        : 'Не в сети'}
                    </span>
                  </span>
                </div>

                <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#8E8E93]">
                  <span className="tabular-nums">
                    {isOnline || isBreak ? (
                      <>
                        {isEn ? 'Duration: ' : 'В смене: '}
                        <strong className="text-white font-semibold">
                          {formatElapsedSince(emp.shift_started_at)}
                        </strong>
                      </>
                    ) : (
                      <span>{isEn ? 'Shift closed' : 'Смена не открыта'}</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {isEn
                      ? `Tasks: ${empActiveTasks} open · ${empDoneTasks} done`
                      : `Задач: ${empActiveTasks} в раб. · ${empDoneTasks} закр.`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ЖУРНАЛ И ТАБЕЛЬ ЗАВЕРШЕННЫХ СМЕН (WORK_SHIFTS TABLE) */}
      <div className="rounded-xl border border-white/[0.07] bg-[#121215] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {isEn ? 'Completed Shifts & Timesheet Log' : 'Журнал и Табель отработанных смен'}
            </h3>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              {isEn
                ? 'Archive of completed employee shifts with duration, closed tasks, and shift reports'
                : 'Архив завершенных рабочих смен с точным временем, длительностью и итоговым отчетом сотрудника'}
            </p>
          </div>
          <span className="text-xs text-[#8E8E93] tabular-nums">
            {isEn
              ? `Records: ${filteredShiftsHistory.length}`
              : `Записей: ${filteredShiftsHistory.length}`}
          </span>
        </div>

        {filteredShiftsHistory.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Clock className="w-6 h-6 text-indigo-400 mx-auto" />
            <div className="text-xs font-semibold text-white">
              {isEn
                ? 'No completed shift records yet'
                : 'Завершенных смен в табеле пока нет'}
            </div>
            <p className="text-[11px] text-[#8E8E93] max-w-md mx-auto">
              {isEn
                ? 'Start a shift using the timer in the top bar and click "End Shift with Auto-Report" to record your first timesheet entry.'
                : 'Нажмите «Начать смену» в верхней панели управления и завершите ее с авто-отчетом — запись мгновенно появится в этом табеле.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] font-semibold text-[#8E8E93] bg-white/[0.02]">
                  <th className="py-3 px-4">{isEn ? 'Date' : 'Дата'}</th>
                  <th className="py-3 px-4">{isEn ? 'Employee' : 'Сотрудник'}</th>
                  <th className="py-3 px-4">{isEn ? 'Department' : 'Отдел'}</th>
                  <th className="py-3 px-4">{isEn ? 'Shift Window' : 'Начало и окончание'}</th>
                  <th className="py-3 px-4">{isEn ? 'Duration' : 'Длительность'}</th>
                  <th className="py-3 px-4">{isEn ? 'Closed Tasks' : 'Закрыто задач'}</th>
                  <th className="py-3 px-4">{isEn ? 'Shift Report' : 'Итоговый отчет за смену'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {filteredShiftsHistory.map((ws) => {
                  const startDt = ws.started_at ? new Date(ws.started_at) : new Date();
                  const endDt = ws.ended_at ? new Date(ws.ended_at) : new Date();
                  const dateFormatted = startDt.toLocaleDateString(
                    isEn ? 'en-US' : 'ru-RU',
                    { day: '2-digit', month: 'short', year: 'numeric' }
                  );
                  const startClock = startDt.toLocaleTimeString(
                    isEn ? 'en-US' : 'ru-RU',
                    { hour: '2-digit', minute: '2-digit' }
                  );
                  const endClock = endDt.toLocaleTimeString(
                    isEn ? 'en-US' : 'ru-RU',
                    { hour: '2-digit', minute: '2-digit' }
                  );

                  return (
                    <tr key={ws.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-zinc-300 whitespace-nowrap tabular-nums">
                        {dateFormatted}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{ws.employee_name}</div>
                        <div className="text-[11px] text-[#8E8E93]">
                          {formatRole(ws.role_type || 'Специалист')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {ws.department ? formatRole(ws.department) : '—'}
                      </td>
                      <td className="py-3 px-4 text-zinc-300 whitespace-nowrap tabular-nums">
                        {startClock} — {endClock}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-300 tabular-nums">
                          {formatDurationLabel(ws.duration_minutes)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white font-semibold tabular-nums">
                        {ws.tasks_completed ?? 0}
                      </td>
                      <td className="py-3 px-4 text-zinc-300 max-w-md">
                        <div className="line-clamp-2 leading-snug">
                          {ws.summary || (isEn ? 'Standard shift completed' : 'Плановая смена завершена')}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 9. SUPERADMIN E2E QA & SECURITY SELF-DIAGNOSTICS PANEL (ЭТАП 1)
// ============================================================================
interface QaSuiteReport {
  ok: boolean;
  suiteName: string;
  executedAt: string;
  totalDurationMs: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  tearDown: {
    cleanedTables: number;
    removedRecordsCount: number;
    remainingSandboxArtifacts: number;
    cleanupVerified: boolean;
  };
  results: Array<{
    id: number;
    code: string;
    title: string;
    status: 'passed' | 'failed';
    durationMs: number;
    assertions: string[];
    error?: string;
  }>;
}

interface SuperadminQaAuditPanelProps {
  onRefresh?: () => Promise<void> | void;
  showToast?: (msg: string) => void;
}

export const SuperadminQaAuditPanel: React.FC<SuperadminQaAuditPanelProps> = ({
  onRefresh,
  showToast,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<QaSuiteReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunQaSuite = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'run_qa_suite',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setErrorMsg(
          payload?.error ||
            (isEn
              ? 'Failed to execute QA self-diagnostics suite.'
              : 'Ошибка запуска E2E и Security самодиагностики.')
        );
        return;
      }
      setReport(payload as QaSuiteReport);
      if (onRefresh) {
        await onRefresh();
      }
      if (showToast) {
        showToast(
          isEn
            ? `E2E & Security Audit passed (${payload.passedTests}/${payload.totalTests}) · Sandbox cleaned`
            : `E2E и Security аудит пройден (${payload.passedTests}/${payload.totalTests}) · Тестовый контур очищен`
        );
      }
    } catch (err: any) {
      setErrorMsg(String(err?.message || err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-[#111115] shadow-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
              {isEn
                ? 'Automated E2E, RBAC, Multi-Tenancy & Security Diagnostics'
                : 'Автоматический E2E, RBAC, Multi-Tenancy и Security Аудит (QA Runner)'}
            </h3>
            <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-semibold text-indigo-300">
              __QA_SANDBOX_
            </span>
          </div>
          <p className="text-xs text-[#8E8E93]">
            {isEn
              ? 'Executes 8 live integration & security checks with isolated synthetic data and guaranteed transactional tear-down in finally.'
              : 'Последовательно выполняет 8 сквозных проверок изоляции компаний, матрицы прав RBAC, 3 контуров входа, CRM/Задач, XSS/SQLi-защиты и гарантированно очищает БД в блоке finally.'}
          </p>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => void handleRunQaSuite()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors shrink-0 shadow-sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>
                {isEn
                  ? 'Running 8 E2E & Security Checks...'
                  : 'Выполнение 8 проверок и очистка песочницы...'}
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {isEn
                  ? 'Run Full E2E & Security Self-Diagnostics'
                  : 'Запустить полный E2E и Security самодиагностику'}
              </span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="m-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {report && (
        <div className="p-5 space-y-4">
          {/* Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-white/[0.07] bg-[#16161C] p-3">
              <div className="text-[11px] text-[#8E8E93]">
                {isEn ? 'Suite Status' : 'Статус прогона'}
              </div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  report.allPassed ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {report.allPassed
                  ? isEn
                    ? 'ALL 8 PASSED'
                    : '8 ИЗ 8 УСПЕШНО'
                  : `${report.passedTests} / ${report.totalTests}`}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-[#16161C] p-3">
              <div className="text-[11px] text-[#8E8E93]">
                {isEn ? 'Execution Time' : 'Время выполнения'}
              </div>
              <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                {report.totalDurationMs} ms
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-[#16161C] p-3">
              <div className="text-[11px] text-[#8E8E93]">
                {isEn ? 'Transactional Tear-Down' : 'Очистка песочницы (finally)'}
              </div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5">
                {report.tearDown.cleanupVerified
                  ? isEn
                    ? `Verified (${report.tearDown.cleanedTables} tables)`
                    : `Очищено (${report.tearDown.cleanedTables} табл.)`
                  : 'Warning'}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-[#16161C] p-3">
              <div className="text-[11px] text-[#8E8E93]">
                {isEn ? 'Remaining Sandbox Trash' : 'Остаток тестового мусора'}
              </div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5">
                {report.tearDown.remainingSandboxArtifacts} {isEn ? 'records' : 'записей'}
              </div>
            </div>
          </div>

          {/* 8 Detailed Test Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.results.map((step) => {
              const isPassed = step.status === 'passed';
              return (
                <div
                  key={step.id}
                  className={`rounded-xl border p-3.5 space-y-2 ${
                    isPassed
                      ? 'border-emerald-500/25 bg-[#141419]'
                      : 'border-red-500/35 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          isPassed ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white truncate">
                        {step.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8E8E93] tabular-nums shrink-0">
                      {step.durationMs} ms
                    </span>
                  </div>

                  <ul className="space-y-1 pl-6 text-[11px] text-zinc-300 list-disc">
                    {step.assertions.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>

                  {step.error && (
                    <div className="text-[11px] text-red-400 font-medium pl-6">
                      {step.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


