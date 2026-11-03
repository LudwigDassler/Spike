import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  Briefcase,
  Users,
  FileText,
  Layers,
  SlidersHorizontal,
  Plus,
  Check,
  Printer,
  AtSign,
  Hash,
  Terminal,
  Trash2,
} from 'lucide-react';
import { CrmLeadRecord, OrganizationNode, TaskPriority, TaskRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

export const TeddyAvatar: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7',
}) => (
  <div
    className={`rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0 ${className}`}
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

interface CopilotTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  commandType?: '/декомпозиция' | '/аудит-воронки' | '/балансировка' | '/договор' | 'analytics';
  stagingRows?: StagingRowItem[];
  executed?: boolean;
  executedCount?: number;
  analyticsRows?: Array<{
    id: string;
    label: string;
    meta: string;
    metric: string;
    targetSection: 'tasks' | 'crm' | 'team';
  }>;
  contractLeadId?: string;
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
  onNavigateToSection?: (section: 'overview' | 'tasks' | 'crm' | 'team' | 'workspace' | 'billing') => void;
  onOpenLegalDocModal?: (lead: CrmLeadRecord, docType?: 'contract' | 'invoice' | 'act') => void;
  showToast?: (msg: string) => void;
}

const SLASH_COMMANDS = [
  {
    cmd: '/декомпозиция' as const,
    labelRu: '/декомпозиция',
    labelEn: '/decompose',
    descRu: 'Разбить сложную цель на пакет готовых задач с назначением отделов и сроков',
    descEn: 'Break down a strategic goal into a batch of ready-to-assign tasks with departments and deadlines',
    icon: Layers,
  },
  {
    cmd: '/аудит-воронки' as const,
    labelRu: '/аудит-воронки',
    labelEn: '/pipeline-audit',
    descRu: 'Интерактивная таблица зависших сделок CRM с кнопкой автоматического создания задач на дожим',
    descEn: 'Interactive table of stalled CRM deals with automated follow-up task generation',
    icon: Briefcase,
  },
  {
    cmd: '/балансировка' as const,
    labelRu: '/балансировка',
    labelEn: '/rebalance',
    descRu: 'Перераспределение задач с перегруженных сотрудников на свободных в 1 клик',
    descEn: 'Rebalance active tasks from overloaded staff to available team members in 1 click',
    icon: SlidersHorizontal,
  },
  {
    cmd: '/договор' as const,
    labelRu: '/договор',
    labelEn: '/contract',
    descRu: 'Мгновенное заполнение и открытие печатного Договора / Счета А4 по выбранному клиенту',
    descEn: 'Instant population and printable A4 Contract / Invoice preview for a selected client',
    icon: FileText,
  },
];

function buildDueDateIso(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().slice(0, 10);
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
  onNavigateToSection,
  onOpenLegalDocModal,
  showToast,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';

  const safeNodes = useMemo(() => (Array.isArray(nodes) ? nodes : []), [nodes]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const safeLeads = useMemo(() => (Array.isArray(leads) ? leads : []), [leads]);

  const [inputValue, setInputValue] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [mentionPicker, setMentionPicker] = useState<'none' | 'staff' | 'deal'>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [executingTurnId, setExecutingTurnId] = useState<string | null>(null);
  const [selectedContractLeadId, setSelectedContractLeadId] = useState<string>('');
  const [selectedDocKind, setSelectedDocKind] = useState<'contract' | 'invoice'>('contract');
  const [inlineA4PreviewLead, setInlineA4PreviewLead] = useState<CrmLeadRecord | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const pickEmployeeIdByKeyword = (deptHint: string, indexFallback: number): string => {
    if (safeNodes.length === 0) return currentUser.id;
    const lowerHint = deptHint.toLowerCase();
    const matched = safeNodes.find(
      (n) =>
        String(n.department || '').toLowerCase().includes(lowerHint) ||
        String(n.role_type || '').toLowerCase().includes(lowerHint)
    );
    if (matched) return matched.id;
    return safeNodes[indexFallback % safeNodes.length]?.id || currentUser.id;
  };

  const generateDecompositionStaging = (goalTitle: string): StagingRowItem[] => {
    const cleanGoal =
      goalTitle
        .replace(/^\/декомпозиция\s*/i, '')
        .replace(/^\/decompose\s*/i, '')
        .trim() || (isEn ? 'Severstal Enterprise Rollout' : 'Запуск проекта Северсталь');

    const blueprint = [
      {
        title: isEn
          ? `[Architecture] Technical specification & contour audit: ${cleanGoal}`
          : `[Архитектура] Техническое задание и аудит контура: ${cleanGoal}`,
        dept: isEn ? 'IT & Architecture' : 'ИТ и Архитектура',
        priority: 'high' as TaskPriority,
        days: 2,
      },
      {
        title: isEn
          ? `[Legal] Contract clearance & SLA specification: ${cleanGoal}`
          : `[Юр. отдел] Согласование договора и приложения SLA: ${cleanGoal}`,
        dept: isEn ? 'Legal' : 'Юридический отдел',
        priority: 'high' as TaskPriority,
        days: 3,
      },
      {
        title: isEn
          ? `[Commercial] Invoice issue & milestone schedule: ${cleanGoal}`
          : `[Коммерция] Выставление счета и график траншей: ${cleanGoal}`,
        dept: isEn ? 'Sales' : 'Коммерческий отдел',
        priority: 'medium' as TaskPriority,
        days: 4,
      },
      {
        title: isEn
          ? `[Operations] Production launch & Telegram 2FA onboarding: ${cleanGoal}`
          : `[Операции] Ввод в эксплуатацию и подключение сотрудников: ${cleanGoal}`,
        dept: isEn ? 'Operations' : 'Операционный блок',
        priority: 'medium' as TaskPriority,
        days: 6,
      },
    ];

    return blueprint.map((b, idx) => ({
      id: `stg-dec-${Date.now()}-${idx}`,
      checked: true,
      mode: 'create_task',
      title: b.title,
      department: b.dept,
      assignedTo: pickEmployeeIdByKeyword(b.dept, idx),
      priority: b.priority,
      dueDate: buildDueDateIso(b.days),
    }));
  };

  const generatePipelineAuditStaging = (): StagingRowItem[] => {
    const activeLeads = safeLeads.filter(
      (l) => !['closed_won', 'closed_lost'].includes(String(l.stage || '').toLowerCase())
    );
    const sourceLeads =
      activeLeads.length > 0
        ? activeLeads.slice(0, 5)
        : [
            {
              id: 'sample-lead-1',
              company_name: 'ПАО «Северсталь»',
              contact_person: 'Соколов А.В.',
              value: 2400000,
              stage: 'Negotiation',
            } as any,
          ];

    return sourceLeads.map((lead, idx) => ({
      id: `stg-crm-${Date.now()}-${idx}`,
      checked: true,
      mode: 'followup_lead',
      title: isEn
        ? `Follow-up & commercial closing: ${lead.company_name}`
        : `Дожим сделки и отправка КП / Договора: ${lead.company_name}`,
      department: isEn ? 'Commercial Department' : 'Коммерческий отдел',
      assignedTo: lead.assigned_to || pickEmployeeIdByKeyword('коммерч', idx),
      priority: Number(lead.value || 0) >= 500000 ? 'high' : 'medium',
      dueDate: buildDueDateIso(2 + idx),
      leadId: lead.id,
      dealValue: Number(lead.value || 0),
    }));
  };

  const generateRebalanceStaging = (): StagingRowItem[] => {
    const openTasks = safeTasks.filter((t) => t.status !== 'Done');
    const loadMap = new Map<string, number>();
    safeNodes.forEach((n) => loadMap.set(n.id, 0));
    openTasks.forEach((t) => {
      const uid = t.assigned_to || t.owner_node_id;
      if (uid) loadMap.set(uid, (loadMap.get(uid) || 0) + 1);
    });

    const sortedByLeastLoad = [...safeNodes].sort(
      (a, b) => (loadMap.get(a.id) || 0) - (loadMap.get(b.id) || 0)
    );

    const tasksToRebalance = openTasks.slice(0, 4);
    if (tasksToRebalance.length === 0) {
      return generateDecompositionStaging('Оптимизация нагрузки подразделений');
    }

    return tasksToRebalance.map((task, idx) => {
      const targetAssignee =
        sortedByLeastLoad[idx % Math.max(1, sortedByLeastLoad.length)]?.id || currentUser.id;
      const targetNode = safeNodes.find((n) => n.id === targetAssignee);
      return {
        id: `stg-reb-${Date.now()}-${idx}`,
        checked: true,
        mode: 'reassign_task',
        existingTaskId: task.id,
        title: task.title,
        department:
          targetNode?.department ||
          task.department ||
          (isEn ? 'Operations' : 'Операционный контур'),
        assignedTo: targetAssignee,
        priority: (task.priority as TaskPriority) || 'medium',
        dueDate: task.due_date ? String(task.due_date).slice(0, 10) : buildDueDateIso(3),
      };
    });
  };

  const [turns, setTurns] = useState<CopilotTurn[]>([]);

  useEffect(() => {
    if (isOpen && turns.length === 0) {
      const defaultLead = safeLeads[0]?.id || '';
      setSelectedContractLeadId(defaultLead);
      const initialStaging = generateDecompositionStaging('Запуск проекта Северсталь');
      setTurns([
        {
          id: 'initial-copilot-turn',
          role: 'assistant',
          text: isEn
            ? 'Teddy Command & Staging Console ready. Select a slash command (/decompose, /pipeline-audit, /rebalance, /contract) or edit the live task staging table below to commit records directly to Supabase.'
            : 'Консоль управления Teddy AI готова. Используйте команды (/декомпозиция, /аудит-воронки, /балансировка, /договор), упоминания @сотрудник и #сделка, или отредактируйте черновик пакета задач ниже перед записью в БД.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          commandType: '/декомпозиция',
          stagingRows: initialStaging,
          executed: false,
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inlineA4PreviewLead) {
          setInlineA4PreviewLead(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, inlineA4PreviewLead]);

  if (!isOpen) return null;

  const updateStagingRow = (
    turnId: string,
    rowId: string,
    patch: Partial<StagingRowItem>
  ) => {
    setTurns((prev) =>
      prev.map((turn) => {
        if (turn.id !== turnId || !turn.stagingRows) return turn;
        return {
          ...turn,
          stagingRows: turn.stagingRows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
        };
      })
    );
  };

  const addStagingRow = (turnId: string) => {
    const fallbackAssignee = safeNodes[0]?.id || currentUser.id;
    const newRow: StagingRowItem = {
      id: `stg-custom-${Date.now()}`,
      checked: true,
      mode: 'create_task',
      title: isEn ? 'New operational task' : 'Новая операционная задача',
      department: safeNodes[0]?.department || (isEn ? 'General' : 'Основное подразделение'),
      assignedTo: fallbackAssignee,
      priority: 'medium',
      dueDate: buildDueDateIso(3),
    };
    setTurns((prev) =>
      prev.map((turn) => {
        if (turn.id !== turnId) return turn;
        return {
          ...turn,
          stagingRows: [...(turn.stagingRows || []), newRow],
        };
      })
    );
  };

  const removeStagingRow = (turnId: string, rowId: string) => {
    setTurns((prev) =>
      prev.map((turn) => {
        if (turn.id !== turnId || !turn.stagingRows) return turn;
        return {
          ...turn,
          stagingRows: turn.stagingRows.filter((r) => r.id !== rowId),
        };
      })
    );
  };

  const handleExecuteStagingBatch = async (turn: CopilotTurn) => {
    const selectedRows = (turn.stagingRows || []).filter((r) => r.checked && r.title.trim());
    if (selectedRows.length === 0) {
      if (showToast) {
        showToast(isEn ? 'Select at least one row to commit' : 'Отметьте хотя бы одну запись для выполнения');
      }
      return;
    }

    setExecutingTurnId(turn.id);
    const createdOptimisticTasks: TaskRecord[] = [];

    try {
      for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        const assigneeNode = safeNodes.find((n) => n.id === row.assignedTo);

        if (row.mode === 'reassign_task' && row.existingTaskId) {
          await fetch('/api/db', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'tasks',
              id: row.existingTaskId,
              company_id: companyId,
              updates: {
                title: row.title.trim(),
                assigned_to: row.assignedTo,
                owner_node_id: row.assignedTo,
                department: assigneeNode?.department || row.department,
                priority: row.priority,
                due_date: new Date(row.dueDate).toISOString(),
              },
            }),
          });
        } else {
          const payload = {
            company_id: companyId,
            title: row.title.trim(),
            description:
              row.mode === 'followup_lead'
                ? `Сформировано через Teddy AI (/аудит-воронки) · Исполнитель: ${assigneeNode?.name || 'Сотрудник'}`
                : `Пакетная декомпозиция Teddy AI · Отдел: ${row.department}`,
            status: 'To Do' as const,
            priority: row.priority,
            assigned_to: row.assignedTo,
            owner_node_id: row.assignedTo,
            department: assigneeNode?.department || row.department,
            due_date: new Date(row.dueDate).toISOString(),
          };

          const optimisticTask: TaskRecord = {
            id: `opt-teddy-${Date.now()}-${i}`,
            ...payload,
            created_at: new Date().toISOString(),
          };
          createdOptimisticTasks.push(optimisticTask);

          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'tasks',
              company_id: companyId,
              record: payload,
            }),
          });
        }

        if (assigneeNode?.telegram_chat_id) {
          fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_telegram_notification',
              chat_id: assigneeNode.telegram_chat_id,
              text: `Teddy AI (${companyName}): Назначена задача «${row.title.trim()}» · Срок: ${row.dueDate}`,
            }),
          }).catch(() => {});
        }
      }

      if (createdOptimisticTasks.length > 0 && onOptimisticTasksAdded) {
        onOptimisticTasksAdded(createdOptimisticTasks);
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turn.id
            ? { ...t, executed: true, executedCount: selectedRows.length }
            : t
        )
      );

      await onRefreshData();

      if (showToast) {
        showToast(
          isEn
            ? `Committed ${selectedRows.length} records to database & notified assignees`
            : `Выполнено в БД: создано/обновлено записей (${selectedRows.length}) с синхронизацией в Telegram`
        );
      }
    } finally {
      setExecutingTurnId(null);
    }
  };

  const executeSlashOrPrompt = async (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    setShowSlashMenu(false);
    setMentionPicker('none');
    setInputValue('');

    const userTurn: CopilotTurn = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setIsProcessing(true);

    await new Promise((r) => setTimeout(r, 180));

    const lower = trimmed.toLowerCase();
    let assistantTurn: CopilotTurn;

    if (
      lower.startsWith('/декомпозиция') ||
      lower.startsWith('/decompose') ||
      lower.includes('план') ||
      lower.includes('задач') ||
      lower.includes('северстал') ||
      lower.includes('запуск') ||
      lower.includes('создай')
    ) {
      const staging = generateDecompositionStaging(trimmed);
      assistantTurn = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: isEn
          ? `Prepared an interactive task staging package (${staging.length} items). Review titles, assignees, priorities, and deadlines before committing to the database.`
          : `Сформирован интерактивный черновик декомпозиции (${staging.length} задач). Проверьте названия, ответственных сотрудников, приоритеты и дедлайны перед записью в базу данных.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandType: '/декомпозиция',
        stagingRows: staging,
        executed: false,
      };
    } else if (
      lower.startsWith('/аудит-воронки') ||
      lower.startsWith('/pipeline-audit') ||
      lower.includes('воронк') ||
      lower.includes('сделк') ||
      lower.includes('crm')
    ) {
      const staging = generatePipelineAuditStaging();
      assistantTurn = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: isEn
          ? `Audited ${safeLeads.length} CRM deals. Generated follow-up tasks for active pipeline bottlenecks:`
          : `Проведен аудит воронки CRM (${safeLeads.length} сделок). Сформирован пакет задач на дожим зависших контрактов:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandType: '/аудит-воронки',
        stagingRows: staging,
        executed: false,
      };
    } else if (
      lower.startsWith('/балансировка') ||
      lower.startsWith('/rebalance') ||
      lower.includes('баланс') ||
      lower.includes('перегруз') ||
      lower.includes('нагрузк')
    ) {
      const staging = generateRebalanceStaging();
      assistantTurn = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: isEn
          ? 'Calculated optimal workload distribution across staff members. Confirm task reassignment below:'
          : 'Рассчитана оптимальная балансировка нагрузки между сотрудниками. Подтвердите перераспределение задач в таблице:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandType: '/балансировка',
        stagingRows: staging,
        executed: false,
      };
    } else if (
      lower.startsWith('/договор') ||
      lower.startsWith('/contract') ||
      lower.includes('договор') ||
      lower.includes('счет') ||
      lower.includes('акт')
    ) {
      const matchedLead =
        safeLeads.find((l) =>
          lower.includes(String(l.company_name || '').toLowerCase())
        ) || safeLeads[0];

      if (matchedLead) {
        setSelectedContractLeadId(matchedLead.id);
      }

      assistantTurn = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: isEn
          ? 'Select the counterparty deal below to immediately populate and print an official A4 Contract or Invoice:'
          : 'Выберите сделку контрагента ниже для мгновенного заполнения и открытия печатного Договора или Счета А4:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandType: '/договор',
        contractLeadId: matchedLead?.id || '',
      };
    } else {
      const openTasksCount = safeTasks.filter((t) => t.status !== 'Done').length;
      const doneTasksCount = safeTasks.filter((t) => t.status === 'Done').length;
      const totalPipelineRub = safeLeads.reduce((acc, l) => acc + Number(l.value || 0), 0);

      assistantTurn = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: isEn
          ? `Live operational slice for "${companyName}": ${openTasksCount} active tasks (${doneTasksCount} completed), ${safeLeads.length} CRM deals totaling ${totalPipelineRub.toLocaleString('ru-RU')} RUB across ${safeNodes.length} staff members.`
          : `Аналитический срез по компании «${companyName}»: в работе ${openTasksCount} задач (завершено ${doneTasksCount}), в воронке CRM ${safeLeads.length} сделок на сумму ${totalPipelineRub.toLocaleString('ru-RU')} ₽, штат: ${safeNodes.length} сотр.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commandType: 'analytics',
        analyticsRows: [
          {
            id: 'an-tasks',
            label: isEn ? 'Active Operational Tasks' : 'Операционные задачи в работе',
            meta: isEn ? `${doneTasksCount} completed on SLA` : `Завершено в срок: ${doneTasksCount}`,
            metric: `${openTasksCount}`,
            targetSection: 'tasks',
          },
          {
            id: 'an-crm',
            label: isEn ? 'Commercial Pipeline Volume' : 'Объем коммерческой воронки CRM',
            meta: isEn ? `${safeLeads.length} active B2B deals` : `Активных B2B-сделок: ${safeLeads.length}`,
            metric: `${totalPipelineRub.toLocaleString('ru-RU')} ₽`,
            targetSection: 'crm',
          },
          {
            id: 'an-team',
            label: isEn ? 'Organization Staff & RBAC' : 'Штатное расписание и контур RBAC',
            meta: isEn ? 'Active contour members' : 'Сотрудники в контуре',
            metric: `${safeNodes.length}`,
            targetSection: 'team',
          },
        ],
      };
    }

    setTurns((prev) => [...prev, assistantTurn]);
    setIsProcessing(false);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 60);
  };

  const handleOpenContractA4 = (leadId: string, kind: 'contract' | 'invoice') => {
    const targetLead =
      safeLeads.find((l) => l.id === leadId) ||
      safeLeads[0] ||
      ({
        id: 'default-a4-lead',
        company_id: companyId,
        company_name: 'ПАО «Северсталь»',
        contact_person: 'Соколов Алексей Викторович',
        value: 1450000,
        stage: 'Contract',
        probability: 90,
        created_at: new Date().toISOString(),
      } as CrmLeadRecord);

    if (onOpenLegalDocModal) {
      onOpenLegalDocModal(targetLead, kind);
      return;
    }
    setSelectedDocKind(kind);
    setInlineA4PreviewLead(targetLead);
  };

  const insertContextMention = (token: string) => {
    setInputValue((prev) => `${prev.replace(/[@#]\S*$/, '').trim()} ${token} `.trimStart());
    setMentionPicker('none');
    inputRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Teddy AI Command & Staging Console"
      onClick={onClose}
    >
      {/* Floating Command & Staging Console (БЛОК 3.1: max-w-2xl w-full rounded-xl bg-white dark:bg-[#111318] border border-slate-200/90 dark:border-white/[0.09] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden) */}
      <div
        className="max-w-2xl w-full rounded-xl bg-white dark:bg-[#111318] border border-slate-200/90 dark:border-white/[0.09] text-slate-900 dark:text-zinc-100 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Command Bar Header */}
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#151821] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                  Teddy Copilot
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                  {companyName}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {isEn
                  ? 'Command Bar · Type / for actions, @ for staff, # for deals'
                  : 'Командная консоль · Введите / для команд, @ для сотрудника, # для сделки'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Command Bar Input in Top Section */}
        <div className="p-3.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111318] relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void executeSlashOrPrompt(inputValue);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onFocus={() => {
                  if (!inputValue.trim() || inputValue.startsWith('/')) {
                    setShowSlashMenu(true);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputValue(val);
                  if (val.startsWith('/') || val === '') {
                    setShowSlashMenu(true);
                    setMentionPicker('none');
                  } else if (val.endsWith('@')) {
                    setMentionPicker('staff');
                    setShowSlashMenu(false);
                  } else if (val.endsWith('#')) {
                    setMentionPicker('deal');
                    setShowSlashMenu(false);
                  } else {
                    setShowSlashMenu(false);
                  }
                }}
                placeholder={
                  isEn
                    ? 'Enter command (/decompose, /pipeline-audit, /rebalance, /contract) or goal...'
                    : 'Введите цель (напр. «Создай план запуска проекта Северсталь») или / для меню...'
                }
                className="w-full h-10 rounded-lg border border-slate-200/90 dark:border-white/[0.09] bg-slate-50 dark:bg-zinc-900/90 px-3.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:border-slate-400 dark:focus:border-zinc-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setMentionPicker((p) => (p === 'staff' ? 'none' : 'staff'));
                setShowSlashMenu(false);
              }}
              title={isEn ? 'Mention Employee (@)' : 'Упомянуть сотрудника (@)'}
              className="h-10 w-10 rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <AtSign className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMentionPicker((p) => (p === 'deal' ? 'none' : 'deal'));
                setShowSlashMenu(false);
              }}
              title={isEn ? 'Mention Deal (#)' : 'Упомянуть сделку CRM (#)'}
              className="h-10 w-10 rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Hash className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={isProcessing || !inputValue.trim()}
              className="h-10 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isEn ? 'Run' : 'Выполнить'}</span>
            </button>
          </form>

          {/* Quick Slash Command Chips */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {SLASH_COMMANDS.map((sc) => {
              const Icon = sc.icon;
              return (
                <button
                  key={sc.cmd}
                  type="button"
                  onClick={() => void executeSlashOrPrompt(sc.cmd)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <span>{isEn ? sc.labelEn : sc.labelRu}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Slash Menu Popover (БЛОК 3.2) */}
          {showSlashMenu && (
            <div className="mt-2 rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#161922] shadow-xl divide-y divide-slate-100 dark:divide-white/[0.06] overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900/70 flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                <span>
                  {isEn ? 'SLASH COMMANDS (DIRECT DB ACTIONS)' : 'КОМАНДЫ УПРАВЛЕНИЯ (ПРЯМЫЕ ДЕЙСТВИЯ С БД)'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSlashMenu(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                >
                  Esc
                </button>
              </div>
              {SLASH_COMMANDS.map((sc) => {
                const Icon = sc.icon;
                return (
                  <button
                    key={sc.cmd}
                    type="button"
                    onClick={() => void executeSlashOrPrompt(sc.cmd)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                          {isEn ? sc.labelEn : sc.labelRu}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {isEn ? sc.descEn : sc.descRu}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* @Employee or #Deal Context Picker */}
          {mentionPicker !== 'none' && (
            <div className="mt-2 rounded-xl border border-slate-200/90 dark:border-white/[0.09] bg-white dark:bg-[#161922] shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
              {mentionPicker === 'staff'
                ? safeNodes.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => insertContextMention(`@${emp.name}`)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-900 dark:text-zinc-100">
                        @{emp.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {emp.department || emp.role_type}
                      </span>
                    </button>
                  ))
                : safeLeads.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => insertContextMention(`#${deal.company_name}`)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-900 dark:text-zinc-100">
                        #{deal.company_name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                        {Number(deal.value || 0).toLocaleString('ru-RU')} ₽
                      </span>
                    </button>
                  ))}
            </div>
          )}
        </div>

        {/* Main Interactive Staging & Dialogue Stream */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-[#0D0F14]"
        >
          {turns.map((turn) => {
            if (turn.role === 'user') {
              return (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 px-3.5 py-2 text-xs">
                    <div>{turn.text}</div>
                  </div>
                </div>
              );
            }

            const checkedCount = (turn.stagingRows || []).filter((r) => r.checked).length;

            return (
              <div
                key={turn.id}
                className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#14171F] p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed">
                    {turn.text}
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums shrink-0">
                    {turn.timestamp}
                  </span>
                </div>

                {/* INTERACTIVE STAGING PREVIEW TABLE (БЛОК 3.3) */}
                {turn.stagingRows && turn.stagingRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-white/[0.08]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                            <th className="py-2 px-2.5 w-8 text-center">#</th>
                            <th className="py-2 px-2.5">
                              {isEn ? 'Task / Action Title' : 'Задача / Поручение (редактируемо)'}
                            </th>
                            <th className="py-2 px-2.5 w-40">
                              {isEn ? 'Assignee' : 'Исполнитель'}
                            </th>
                            <th className="py-2 px-2.5 w-24">
                              {isEn ? 'Priority' : 'Приоритет'}
                            </th>
                            <th className="py-2 px-2.5 w-32">
                              {isEn ? 'Deadline' : 'Дедлайн'}
                            </th>
                            <th className="py-2 px-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                          {turn.stagingRows.map((row) => (
                            <tr
                              key={row.id}
                              className={
                                row.checked
                                  ? 'bg-white dark:bg-zinc-900/40'
                                  : 'bg-slate-50/60 dark:bg-zinc-950/40 opacity-60'
                              }
                            >
                              <td className="py-2 px-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.checked}
                                  onChange={(e) =>
                                    updateStagingRow(turn.id, row.id, {
                                      checked: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-2.5">
                                <input
                                  type="text"
                                  value={row.title}
                                  onChange={(e) =>
                                    updateStagingRow(turn.id, row.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900 px-2.5 text-xs text-slate-900 dark:text-zinc-100"
                                />
                              </td>
                              <td className="py-2 px-2.5">
                                <select
                                  value={row.assignedTo}
                                  onChange={(e) => {
                                    const emp = safeNodes.find((n) => n.id === e.target.value);
                                    updateStagingRow(turn.id, row.id, {
                                      assignedTo: e.target.value,
                                      department: emp?.department || row.department,
                                    });
                                  }}
                                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900 px-2 text-xs text-slate-900 dark:text-zinc-100"
                                >
                                  {safeNodes.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2.5">
                                <select
                                  value={row.priority}
                                  onChange={(e) =>
                                    updateStagingRow(turn.id, row.id, {
                                      priority: e.target.value as TaskPriority,
                                    })
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900 px-2 text-xs text-slate-900 dark:text-zinc-100"
                                >
                                  <option value="high">{isEn ? 'High' : 'Высокий'}</option>
                                  <option value="medium">{isEn ? 'Medium' : 'Средний'}</option>
                                  <option value="low">{isEn ? 'Low' : 'Низкий'}</option>
                                </select>
                              </td>
                              <td className="py-2 px-2.5">
                                <input
                                  type="date"
                                  value={row.dueDate}
                                  onChange={(e) =>
                                    updateStagingRow(turn.id, row.id, {
                                      dueDate: e.target.value,
                                    })
                                  }
                                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900 px-2 text-xs text-slate-900 dark:text-zinc-100 tabular-nums"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeStagingRow(turn.id, row.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 transition"
                                  title={isEn ? 'Remove row' : 'Удалить строку'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => addStagingRow(turn.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isEn ? 'Add Row' : 'Добавить строку'}</span>
                      </button>

                      {turn.executed ? (
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isEn
                              ? `Committed to DB (${turn.executedCount} records)`
                              : `Выполнено в БД: создано записей (${turn.executedCount})`}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={executingTurnId === turn.id || checkedCount === 0}
                          onClick={() => void handleExecuteStagingBatch(turn)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50 text-xs font-semibold transition cursor-pointer"
                        >
                          {executingTurnId === turn.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>
                            {isEn
                              ? `Execute Batch in DB (Create ${checkedCount} Selected Records)`
                              : `Выполнить пакет в БД (Создать выбранные записи: ${checkedCount})`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* CONTRACT / INVOICE A4 GENERATOR (/договор) */}
                {turn.commandType === '/договор' && (
                  <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/70 p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
                          {isEn ? 'Select CRM Counterparty' : 'Контрагент из воронки CRM'}
                        </label>
                        <select
                          value={selectedContractLeadId}
                          onChange={(e) => setSelectedContractLeadId(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-950 px-2.5 text-xs text-slate-900 dark:text-zinc-100"
                        >
                          {safeLeads.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.company_name} — {Number(l.value || 0).toLocaleString('ru-RU')} ₽
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenContractA4(selectedContractLeadId, 'contract')}
                          className="flex-1 h-9 px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>{isEn ? 'Open Contract A4' : 'Открыть Договор А4'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenContractA4(selectedContractLeadId, 'invoice')}
                          className="flex-1 h-9 px-3 rounded-lg border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>{isEn ? 'Open Invoice A4' : 'Открыть Счет А4'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ANALYTICS TABLE SLICE */}
                {turn.analyticsRows && turn.analyticsRows.length > 0 && (
                  <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] divide-y divide-slate-200/70 dark:divide-white/[0.06] overflow-hidden">
                    {turn.analyticsRows.map((ar) => (
                      <div
                        key={ar.id}
                        className="px-3.5 py-2.5 bg-slate-50/70 dark:bg-zinc-900/50 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-zinc-100">
                            {ar.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {ar.meta}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                            {ar.metric}
                          </span>
                          {onNavigateToSection && (
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToSection(ar.targetSection);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-[11px] font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 cursor-pointer"
                            >
                              {isEn ? 'Open' : 'Перейти'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline Printable A4 Document Modal if opened directly from Teddy */}
      {inlineA4PreviewLead && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setInlineA4PreviewLead(null)}
        >
          <div
            className="max-w-3xl w-full rounded-xl bg-white text-slate-900 border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-900">
                {selectedDocKind === 'contract'
                  ? `Договор оказания услуг А4 — ${inlineA4PreviewLead.company_name}`
                  : `Счет на оплату А4 — ${inlineA4PreviewLead.company_name}`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isEn ? 'Print A4' : 'Печать А4'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInlineA4PreviewLead(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-8 tc-a4-paper space-y-5 text-xs leading-relaxed">
              <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                <div>
                  <h2 className="text-base font-bold uppercase">
                    {selectedDocKind === 'contract'
                      ? `ДОГОВОР № ТК-${new Date().getFullYear()}/08`
                      : `СЧЕТ НА ОПЛАТУ № СЧ-${new Date().getFullYear()}/08`}
                  </h2>
                  <p className="text-xs mt-1">
                    Поставщик (Исполнитель): {companyName}
                  </p>
                  <p className="text-xs">
                    Заказчик: {inlineA4PreviewLead.company_name} ({inlineA4PreviewLead.contact_person})
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <div>Дата: {new Date().toLocaleDateString('ru-RU')}</div>
                  <div className="font-bold mt-1">
                    Сумма: {Number(inlineA4PreviewLead.value || 0).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>
              <table className="w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr>
                    <th className="border border-slate-900 p-2 text-left">Наименование работ / услуг</th>
                    <th className="border border-slate-900 p-2 text-right w-36">Сумма, ₽</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-900 p-2">
                      Комплексное сопровождение и поставка по проекту «{inlineA4PreviewLead.company_name}»
                    </td>
                    <td className="border border-slate-900 p-2 text-right tabular-nums font-semibold">
                      {Number(inlineA4PreviewLead.value || 0).toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
