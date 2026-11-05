import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  Plus,
  Check,
  Printer,
  Trash2,
  Calendar,
  ChevronDown,
  Mic,
  MicOff,
  CornerDownLeft,
  ArrowRight,
  FileText,
  Briefcase,
  Users,
  Clock,
} from 'lucide-react';
import { CrmLeadRecord, OrganizationNode, TaskPriority, TaskRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

export const TeddyPrismIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Incoming pure light beam */}
    <path
      d="M1.5 13.8L7.3 11.3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Internal optical refraction */}
    <path
      d="M7.3 11.3L14.7 11.6"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    {/* 4 Diverging Spectral Rays */}
    <path
      d="M14.2 9.8L22.5 6.8"
      stroke="#F59E0B"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14.8 11.2L22.5 10.3"
      stroke="#10B981"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M15.4 12.6L22.5 13.8"
      stroke="#3B82F6"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M16.0 14.0L22.5 17.3"
      stroke="#8B5CF6"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Equilateral Optical Prism */}
    <path
      d="M11 3.5L19 18.5H3L11 3.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const TeddyAvatar: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => (
  <div
    className={`rounded-lg bg-slate-900 dark:bg-white/[0.06] border border-slate-800 dark:border-white/[0.12] text-white flex items-center justify-center shrink-0 shadow-xs ${className}`}
  >
    <TeddyPrismIcon className="w-4 h-4" />
  </div>
);

export type SpectralStreamType = 'amber' | 'emerald' | 'sapphire' | 'violet';

export interface StagingRowItem {
  id: string;
  checked: boolean;
  spectrum: SpectralStreamType;
  mode: 'create_task' | 'reassign_task' | 'followup_lead' | 'create_lead' | 'prepare_contract' | 'telegram_broadcast';
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

type TeddyCanvasMode = 'decompose' | 'deals_audit' | 'rebalance' | 'contract';

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

function getSpectrumBorderClass(spectrum: SpectralStreamType): string {
  switch (spectrum) {
    case 'amber':
      return 'border-l-2 border-l-[#F59E0B]';
    case 'emerald':
      return 'border-l-2 border-l-[#10B981]';
    case 'sapphire':
      return 'border-l-2 border-l-[#3B82F6]';
    case 'violet':
      return 'border-l-2 border-l-[#8B5CF6]';
  }
}

function getSpectrumBadgeMeta(spectrum: SpectralStreamType, isEn: boolean) {
  switch (spectrum) {
    case 'amber':
      return {
        label: isEn ? 'Tasks & SLA' : 'Задачи и SLA',
        dot: 'bg-[#F59E0B]',
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-500/10 border-amber-500/25',
      };
    case 'emerald':
      return {
        label: isEn ? 'Revenue & CRM' : 'Деньги и CRM',
        dot: 'bg-[#10B981]',
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      };
    case 'sapphire':
      return {
        label: isEn ? 'A4 Documents' : 'Документы А4',
        dot: 'bg-[#3B82F6]',
        text: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-500/10 border-blue-500/25',
      };
    case 'violet':
      return {
        label: isEn ? 'Team & Telegram' : 'Команда и TG',
        dot: 'bg-[#8B5CF6]',
        text: 'text-violet-700 dark:text-violet-300',
        bg: 'bg-violet-500/10 border-violet-500/25',
      };
  }
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
  const [stagingRows, setStagingRows] = useState<StagingRowItem[]>([]);
  const [selectedContractLeadId, setSelectedContractLeadId] = useState<string>(
    leads[0]?.id || ''
  );
  const [isApplyingDb, setIsApplyingDb] = useState<boolean>(false);
  const [appliedSuccessBanner, setAppliedSuccessBanner] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>('');
  const [openAssigneePopoverRowId, setOpenAssigneePopoverRowId] = useState<string | null>(null);
  const [openDeptPopoverRowId, setOpenDeptPopoverRowId] = useState<string | null>(null);
  const [editingTitleRowId, setEditingTitleRowId] = useState<string | null>(null);

  // Voice Terminal State (Web Speech API)
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

  // Real-time Executive Insights (3 Proactive Cards calculated from live tasks, leads, nodes)
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
    };
  }, [tasks, leads, nodes, currentUser]);

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
        spectrum: 'amber',
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
        spectrum: 'emerald',
        mode: 'create_task',
        title: `${prefix}${isEn ? 'Approve B2B contract & issue invoice' : 'Согласовать договор поставки и выставить счет'}`,
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
        title: `${prefix}${isEn ? 'Configure production pipeline & team handoff' : 'Настроить контур исполнения и передать в работу команде'}`,
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
        spectrum: 'emerald',
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
    const leastBusyNode = executiveInsights.leastBusy?.node || nodes[0] || currentUser;

    if (openTasks.length === 0) {
      return buildDecompositionRows(isEn ? 'Sprint Rebalance' : 'Балансировка спринта');
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

  // Multi-Intent Spotlight Natural Command Parser (Tasks + Deadlines + Deals + Contracts + Team)
  const parseComplexCommandToRows = (rawCommand: string): StagingRowItem[] => {
    const text = rawCommand.trim();
    const lower = text.toLowerCase();
    const results: StagingRowItem[] = [];

    // 1. Target date detection ("на пятницу", "на понедельник", "завтра", etc.)
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

    // 2. Employee match (e.g., "Лытнева" -> matches "Лытнев Артем Олегович")
    const matchedEmployee = nodes.find((emp) => {
      const parts = (emp.name || '').toLowerCase().split(/\s+/).filter(Boolean);
      return parts.some((part) => {
        if (part.length < 3) return false;
        const stem = part.slice(0, Math.max(3, part.length - 1));
        return lower.includes(stem);
      });
    });

    // 3. Check if command asks to move/reschedule/reassign tasks
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

      if (targetTasks.length > 0 && (lower.includes('перенес') || lower.includes('сдвин') || matchedEmployee)) {
        targetTasks.slice(0, 3).forEach((t, idx) => {
          results.push({
            id: `stg-shift-${t.id}-${Date.now()}-${idx}`,
            checked: true,
            spectrum: 'amber',
            mode: 'reassign_task',
            title: t.title,
            department: t.department || matchedEmployee?.department || departments[0] || 'Отдел продаж',
            assignedTo: matchedEmployee?.id || t.assigned_to || currentUser?.id || '',
            priority: (t.priority as TaskPriority) || 'High',
            dueDate: targetDueDate,
            existingTaskId: t.id,
          });
        });
      }
    }

    // 4. Check if command asks to create a CRM deal (e.g., "создай сделку Северсталь на 1.2 млн")
    if (lower.includes('сделк') || lower.includes('лид') || lower.includes('deal') || lower.includes('контракт')) {
      const parsedAmount = parseRussianAmount(text) || 1_200_000;
      let clientName = 'Северсталь';
      const dealNameMatch = text.match(/(?:сделк[ауи]|клиент[а]?|контрагент[а]?|deal)\s+([А-Яа-яA-Za-z0-9«»"'\-]+(?:\s+[А-Яа-яA-Za-z0-9«»"'\-]+)?)/i);
      if (dealNameMatch && dealNameMatch[1]) {
        clientName = dealNameMatch[1]
          .replace(/\s+(?:на|суммой|за|по|в)\b.*$/i, '')
          .trim();
      }
      results.push({
        id: `stg-newlead-${Date.now()}`,
        checked: true,
        spectrum: 'emerald',
        mode: 'create_lead',
        clientName,
        dealValue: parsedAmount,
        title: `${isEn ? 'New CRM Deal:' : 'Создать сделку CRM:'} ${clientName} — ${formatMoney(parsedAmount)}`,
        department: departments[0] || 'Отдел продаж',
        assignedTo: matchedEmployee?.id || currentUser?.id || nodes[0]?.id || '',
        priority: 'High',
        dueDate: targetDueDate,
      });
    }

    // 5. Fallback: if no specific existing task shift or deal creation matched, decompose command into actionable spectral cards
    if (results.length === 0) {
      return buildDecompositionRows(text);
    }

    return results;
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
          ? `Optical Prism ready · ${tasks.length} tasks, ${leads.length} deals, ${nodes.length} employees`
          : `Оптический контур активен · Задач: ${tasks.length}, сделок: ${leads.length}, штат: ${nodes.length}`
      );
    }
    if (!selectedContractLeadId && leads[0]?.id) {
      setSelectedContractLeadId(leads[0].id);
    }
    setTimeout(() => {
      spotlightInputRef.current?.focus();
    }, 60);
  }, [isOpen]);

  // Voice Terminal Handler (Web Speech API + Graceful Dictation Fallback)
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
            ? `Voice command refracted into ${rows.length} action cards`
            : `Голосовой импульс преломлен в пакет из ${rows.length} действий`
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
                ? `Voice command refracted into ${rows.length} action cards`
                : `Голосовая команда преломлена в пакет из ${rows.length} действий`
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

  const triggerQuickAction = (mode: TeddyCanvasMode, customTopic?: string) => {
    setAppliedSuccessBanner(null);
    setOpenAssigneePopoverRowId(null);
    setOpenDeptPopoverRowId(null);

    if (mode === 'decompose') {
      const rows = customTopic
        ? parseComplexCommandToRows(customTopic)
        : buildDecompositionRows();
      setStagingRows(rows);
      setActiveCanvasMode('decompose');
      setStatusLine(
        customTopic
          ? `${isEn ? 'Refracted command:' : 'Преломление команды:'} «${customTopic}» (${rows.length})`
          : isEn
          ? `Prepared ${rows.length} action cards`
          : `Сформировано карточек прямого действия: ${rows.length}`
      );
    } else if (mode === 'deals_audit') {
      const rows = buildDealsAuditRows();
      setStagingRows(rows);
      setActiveCanvasMode('deals_audit');
      setStatusLine(
        isEn
          ? `Emerald Spectrum · ${rows.length} CRM follow-up actions ready`
          : `Изумрудный спектр · Сформировано ${rows.length} поручения на дожим сделок CRM`
      );
    } else if (mode === 'rebalance') {
      const rows = buildRebalanceRows();
      setStagingRows(rows);
      setActiveCanvasMode('rebalance');
      setStatusLine(
        isEn
          ? `Violet Spectrum · Workload balanced across ${nodes.length} employees`
          : `Фиолетовый спектр · Оптимальное перераспределение ${rows.length} задач по штату`
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
          ? 'Sapphire Spectrum · Express A4 Contract & Invoice Generator'
          : 'Сапфировый спектр · Экспресс-генератор договора и счета А4'
      );
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
      (lower.includes('договор') || lower.includes('счет') || lower.includes('акт') || lower.includes('contract')) &&
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

  const handleCommitToDatabase = async (customRows?: StagingRowItem[]) => {
    const sourceRows = customRows || stagingRows;
    const selected = sourceRows.filter((r) => r.checked && r.title.trim());
    if (selected.length === 0 || isApplyingDb) return;

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
            notes: `Создано через оптический терминал Teddy`,
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
            description: `Создано через оптический терминал Teddy`,
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
        ? `Batch executed (${summaryParts.join(', ')}).`
        : `Пакет выполнен в БД (${summaryParts.join(', ')}).`;
      setAppliedSuccessBanner(msg);
      if (showToast) showToast(msg);
    } finally {
      setIsApplyingDb(false);
    }
  };

  const selectedLeadForContract =
    leads.find((l) => l.id === selectedContractLeadId) || leads[0] || null;
  const checkedCount = stagingRows.filter((r) => r.checked).length;
  const isBeamActive = isListening || isApplyingDb || inputText.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[88vh] rounded-2xl bg-white/95 dark:bg-[#090A0F]/95 backdrop-blur-3xl border border-slate-200/90 dark:border-white/[0.09] text-slate-900 dark:text-zinc-100 shadow-[0_32px_90px_-15px_rgba(15,23,42,0.18)] dark:shadow-[0_32px_90px_-15px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden relative"
        onClick={(e) => {
          e.stopPropagation();
          setOpenAssigneePopoverRowId(null);
          setOpenDeptPopoverRowId(null);
        }}
      >
        {/* =================================================================
            1. SPOTLIGHT COMMAND BAR + VOICE TERMINAL + OPTICAL REFRACTION LINE
        ================================================================== */}
        <form onSubmit={handleSendMessage} className="shrink-0 relative">
          <div className="px-5 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white/[0.05] border border-slate-800 dark:border-white/[0.12] text-white flex items-center justify-center shrink-0 shadow-xs">
              <TeddyPrismIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <input
                ref={spotlightInputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isEn
                    ? 'Teddy Spotlight: "Move Lytnev tasks to Friday and create Severstal deal for 1.2M"...'
                    : 'Команда Teddy: «Перенеси задачи Лытнева на пятницу и создай сделку Северсталь на 1.2 млн»...'
                }
                className="w-full !bg-transparent !border-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {/* Right Controls: Voice Microphone + Refract Submit + Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleVoiceRecognition}
                title={
                  isEn
                    ? 'Voice Terminal (Speech-to-Action)'
                    : 'Голосовой терминал (распознавание речи в задачи и сделки)'
                }
                className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                  isListening
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300 animate-pulse'
                    : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.08]'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline text-[11px]">
                      {isEn ? 'Listening...' : 'Слушаю...'}
                    </span>
                  </>
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>

              {inputText.trim() && (
                <button
                  type="submit"
                  className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span>{isEn ? 'Refract' : 'Преломить'}</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              )}

              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                Alt+Space
              </span>

              <button
                type="button"
                onClick={onClose}
                aria-label={isEn ? 'Close' : 'Закрыть'}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* OPTICAL REFRACTION LINE (h-[2px] w-full) */}
          <div
            className={`h-[2px] w-full transition-all duration-500 ${
              isBeamActive
                ? 'bg-gradient-to-r from-white via-amber-400 via-emerald-400 via-sky-500 to-violet-500 opacity-100 shadow-[0_0_12px_rgba(59,130,246,0.55)]'
                : 'bg-gradient-to-r from-slate-200 via-amber-400/50 via-emerald-400/50 via-sky-500/50 to-violet-500/50 dark:from-white/20 dark:via-amber-400/40 dark:via-emerald-400/40 dark:via-sky-500/40 dark:to-violet-500/40 opacity-75'
            }`}
          />
        </form>

        {/* =================================================================
            2. UNIFIED OPTICAL STREAM: 3 PROACTIVE EXECUTIVE INSIGHTS + STAGING CARDS
        ================================================================== */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* PROACTIVE EXECUTIVE DIRECTOR: 3 LIVE INSIGHTS (Calculated in Real Time) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {isEn
                  ? 'Proactive Executive Director · 3 Real-Time Decisions'
                  : 'Проактивный исполнительный аудит · 3 готовых решения в 1 клик'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[280px]">
                {statusLine}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Insight 1: Bottleneck & Deadlines (Amber / Violet Spectrum) */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] border-l-2 border-l-[#F59E0B] bg-slate-50/70 dark:bg-white/[0.02] p-3 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {isEn ? 'Bottleneck & SLA' : 'Узкое место и сроки'}
                    </span>
                    <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      {executiveInsights.busiest.count} {isEn ? 'tasks' : 'задач'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {executiveInsights.busiest.node?.name || 'Сотрудник'}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug">
                    {isEn
                      ? `Reassign load to ${executiveInsights.leastBusy.node?.name || 'available staff'} (${executiveInsights.leastBusy.count} active)`
                      : `Свободный ресурс: ${executiveInsights.leastBusy.node?.name || 'штат'} (${executiveInsights.leastBusy.count} в работе)`}
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
                  className="w-full h-7 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 !text-white dark:bg-white/10 dark:hover:bg-white/15 dark:!text-white text-[11px] font-semibold inline-flex items-center justify-between gap-1 transition cursor-pointer"
                >
                  <span className="truncate">
                    {isEn ? 'Rebalance in 1 Click' : 'Перераспределить в 1 клик'}
                  </span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              </div>

              {/* Insight 2: Money in CRM Pipeline (Emerald Spectrum) */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] border-l-2 border-l-[#10B981] bg-slate-50/70 dark:bg-white/[0.02] p-3 flex flex-col justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {isEn ? 'Money in CRM' : 'Деньги в воронке CRM'}
                    </span>
                    <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {formatMoney(Number(executiveInsights.topDeal?.amount || 450000))}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {executiveInsights.topDeal?.client_name ||
                      executiveInsights.topDeal?.title ||
                      'Ключевой контрагент'}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug">
                    {isEn
                      ? 'Requires commercial follow-up & invoice approval'
                      : 'Требует контрольного дожима ЛПР и выставления счета'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const auditRows = buildDealsAuditRows();
                    setStagingRows(auditRows);
                    setActiveCanvasMode('deals_audit');
                    void handleCommitToDatabase(auditRows.slice(0, 1));
                  }}
                  className="w-full h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 !text-white text-[11px] font-semibold inline-flex items-center justify-between gap-1 transition cursor-pointer"
                >
                  <span className="truncate">
                    {isEn ? 'Create Follow-Up Task' : 'Создать задачу на дожим'}
                  </span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              </div>

              {/* Insight 3: Express A4 Document (Sapphire Spectrum) */}
              <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] border-l-2 border-l-[#3B82F6] bg-slate-50/70 dark:bg-white/[0.02] p-3 flex flex-col justify-between gap-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {isEn ? 'Express A4 Document' : 'Экспресс-документ А4'}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                      0.1s
                    </span>
                  </div>
                  <select
                    value={selectedContractLeadId}
                    onChange={(e) => setSelectedContractLeadId(e.target.value)}
                    className="w-full h-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141C] px-2 text-[11px] font-medium text-slate-900 dark:text-white focus:outline-none"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.client_name || l.title} ({formatMoney(Number(l.amount || 0))})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLeadForContract && onOpenLegalDocModal) {
                      onOpenLegalDocModal(selectedLeadForContract, 'contract');
                    } else {
                      triggerQuickAction('contract');
                    }
                  }}
                  className="w-full h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 !text-white text-[11px] font-semibold inline-flex items-center justify-between gap-1 transition cursor-pointer"
                >
                  <span className="truncate">
                    {isEn ? 'Generate A4 Contract & Invoice' : 'Сформировать договор и счет А4'}
                  </span>
                  <Printer className="w-3 h-3 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {appliedSuccessBanner && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{appliedSuccessBanner}</span>
            </div>
          )}

          {/* =================================================================
              3. SPECTRAL ACTION STREAM (PRISM DISPERSION CARDS OR A4 SHEET)
          ================================================================== */}
          {activeCanvasMode === 'contract' ? (
            <div className="space-y-4">
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

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {selectedLeadForContract && onOpenLegalDocModal && (
                  <button
                    type="button"
                    onClick={() => onOpenLegalDocModal(selectedLeadForContract, 'contract')}
                    className="h-9 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#181B26] text-slate-900 dark:text-zinc-100 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Open Print A4' : 'Открыть печать А4'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => triggerQuickAction('decompose')}
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Back to Action Package' : 'К пакету поручений'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    {isEn
                      ? 'Refracted Action Package'
                      : 'Пакет прямого действия (кликните по любому полю для правки)'}
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                      {isEn ? 'SLA' : 'Задачи'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      CRM
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                      A4
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                      {isEn ? 'Team' : 'Штат'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-800 dark:text-zinc-200 text-[11px] font-medium inline-flex items-center gap-1 hover:bg-slate-200/70 dark:hover:bg-white/[0.08] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Add Card' : 'Добавить действие'}</span>
                </button>
              </div>

              <div className="space-y-2">
                {stagingRows.map((row) => {
                  const assigneeNode =
                    nodes.find((n) => String(n.id) === String(row.assignedTo)) ||
                    currentUser ||
                    nodes[0];
                  const prioMeta = getPriorityBadgeMeta(row.priority);
                  const spectrumMeta = getSpectrumBadgeMeta(row.spectrum, isEn);
                  const isAssigneeOpen = openAssigneePopoverRowId === row.id;
                  const isDeptOpen = openDeptPopoverRowId === row.id;
                  const isEditingTitle = editingTitleRowId === row.id;

                  return (
                    <div
                      key={row.id}
                      className={`group relative rounded-xl border ${getSpectrumBorderClass(
                        row.spectrum
                      )} transition px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 ${
                        row.checked
                          ? 'border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#12141E] shadow-2xs'
                          : 'border-slate-200/50 dark:border-white/[0.04] bg-slate-50/50 dark:bg-[#0E1018]/60 opacity-60'
                      }`}
                    >
                      {/* Left: Checkbox + Spectrum Tag + Editable Title */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { checked: e.target.checked })
                          }
                          className="w-4 h-4 rounded accent-indigo-600 shrink-0 cursor-pointer"
                        />

                        <span
                          className={`hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${spectrumMeta.bg} ${spectrumMeta.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${spectrumMeta.dot}`} />
                          <span>{spectrumMeta.label}</span>
                        </span>

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
                              isEn ? 'Click to edit title' : 'Нажмите для редактирования текста'
                            }
                            className="flex-1 text-left text-xs font-medium text-slate-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate cursor-text"
                          >
                            {row.title}
                          </button>
                        )}
                      </div>

                      {/* Right: Department Pill + Assignee Avatar Popover + Priority Pill + Date + Delete */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenAssigneePopoverRowId(null);
                              setOpenDeptPopoverRowId(isDeptOpen ? null : row.id);
                            }}
                            className="h-7 px-2.5 rounded-lg border border-slate-200/90 dark:border-white/10 bg-slate-100 dark:bg-zinc-800/90 text-[11px] font-medium text-slate-800 dark:text-zinc-100 inline-flex items-center gap-1 hover:bg-slate-200/70 transition cursor-pointer max-w-[130px]"
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

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDeptPopoverRowId(null);
                              setOpenAssigneePopoverRowId(isAssigneeOpen ? null : row.id);
                            }}
                            className="h-7 pl-1.5 pr-2.5 rounded-lg border border-slate-200/90 dark:border-white/10 bg-slate-100 dark:bg-zinc-800/90 text-[11px] font-medium text-slate-800 dark:text-zinc-100 inline-flex items-center gap-1.5 hover:bg-slate-200/70 transition cursor-pointer max-w-[150px]"
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

                        <label className="h-7 px-2 rounded-lg border border-slate-200/90 dark:border-white/10 bg-slate-100 dark:bg-zinc-800/90 text-[11px] font-medium text-slate-800 dark:text-zinc-100 inline-flex items-center gap-1 cursor-pointer">
                          <Calendar className="w-3 h-3 opacity-65 shrink-0" />
                          <input
                            type="date"
                            value={row.dueDate}
                            onChange={(e) =>
                              handleUpdateRow(row.id, { dueDate: e.target.value })
                            }
                            className="bg-transparent !border-0 text-[11px] tabular-nums text-slate-800 dark:text-zinc-100 focus:outline-none w-[92px] cursor-pointer"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          aria-label={isEn ? 'Remove card' : 'Удалить карточку'}
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================
            4. BOTTOM SPECTRAL BAR & EXECUTE PACKAGE BUTTON
        ================================================================== */}
        <div className="px-5 py-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#0D0F17] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => triggerQuickAction('decompose')}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeCanvasMode === 'decompose'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold'
                  : 'border-slate-200/90 dark:border-white/10 bg-white dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>{isEn ? 'Decompose Goal' : 'Разбить цель на задачи'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerQuickAction('deals_audit')}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeCanvasMode === 'deals_audit'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
                  : 'border-slate-200/90 dark:border-white/10 bg-white dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>{isEn ? 'Stalled CRM Deals' : 'Дожим сделок CRM'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerQuickAction('contract')}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeCanvasMode === 'contract'
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300 font-semibold'
                  : 'border-slate-200/90 dark:border-white/10 bg-white dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
              <span>{isEn ? 'A4 Contract' : 'Договор А4'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerQuickAction('rebalance')}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeCanvasMode === 'rebalance'
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-300 font-semibold'
                  : 'border-slate-200/90 dark:border-white/10 bg-white dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span>{isEn ? 'Team Balance' : 'Баланс штата'}</span>
            </button>
          </div>

          {activeCanvasMode !== 'contract' && (
            <button
              type="button"
              onClick={() => void handleCommitToDatabase()}
              disabled={isApplyingDb || checkedCount === 0}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 !text-white text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer shadow-sm shrink-0"
            >
              {isApplyingDb ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                {isEn
                  ? `Execute Package (${checkedCount}) · Enter`
                  : `Выполнить пакет (${checkedCount}) · Enter`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
