import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Clock,
  Users,
  Briefcase,
  Search,
  Send,
  Shield,
  TrendingUp,
  Trash2,
  LayoutList,
  Columns3,
  Loader2,
  Phone,
  BellRing,
  Building2,
  CreditCard,
  Download,
  KeyRound,
  Copy,
  Check,
  X,
  UserCircle,
  LogOut,
  Percent,
  Save,
} from 'lucide-react';
import {
  AccessLevel,
  Company,
  CrmLeadRecord,
  CrmLeadStatus,
  DashboardSection,
  EmployeePermissions,
  OrganizationNode,
  PaymentGatewayRegion,
  SubscriptionPlanTier,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  computeDashboardKpis,
  getDefaultPermissionsForAccessLevel,
  normalizeEmployeePermissions,
} from '../types/database';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AddRecordModal, ModalRecordType } from './AddRecordModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useLocale } from '../i18n/LocaleContext';

interface DashboardProps {
  company: Company | null;
  currentProfile: OrganizationNode | null;
  activeChatId: string | null;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  isSyncing: boolean;
  onRefresh: () => Promise<void> | void;
  onPatchRecord: (
    table: 'tasks' | 'crm_leads' | 'organization_nodes' | 'companies',
    id: string,
    updates: Record<string, any>
  ) => Promise<{ ok: boolean; pushSent?: boolean }>;
  onDeleteRecord: (
    table: 'tasks' | 'crm_leads' | 'organization_nodes',
    id: string
  ) => Promise<boolean>;
  onResetSession?: () => void;
}

interface PendingConfirmAction {
  title: string;
  description: string;
  variant: 'danger' | 'warning';
  confirmLabel?: string;
  execute: () => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({
  company,
  currentProfile,
  activeChatId,
  nodes,
  tasks,
  leads,
  isSyncing,
  onRefresh,
  onPatchRecord,
  onDeleteRecord,
  onResetSession,
}) => {
  const { t, formatMoney } = useLocale();

  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [modalType, setModalType] = useState<ModalRecordType>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Task Filters & View Mode
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'board'>('list');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL');
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Confirm Dialog state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  // Invite Modal for existing employee
  const [inspectInviteNode, setInspectInviteNode] = useState<OrganizationNode | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // My Profile editable state
  const [profileName, setProfileName] = useState(currentProfile?.name || '');
  const [profileRoleTitle, setProfileRoleTitle] = useState(currentProfile?.role_type || '');
  const [profileDepartment, setProfileDepartment] = useState(currentProfile?.department || '');
  const [profileEmail, setProfileEmail] = useState(currentProfile?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (currentProfile) {
      setProfileName(currentProfile.name || '');
      setProfileRoleTitle(currentProfile.role_type || '');
      setProfileDepartment(currentProfile.department || '');
      setProfileEmail(currentProfile.email || '');
    }
  }, [currentProfile]);

  // Workspace & Billing state
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanTier>(() => {
    const saved = localStorage.getItem('tedcloud_plan') as SubscriptionPlanTier | null;
    return saved || company?.plan || 'Business';
  });
  const [paymentRegion, setPaymentRegion] = useState<PaymentGatewayRegion>(() => {
    const saved = localStorage.getItem('tedcloud_payment_region') as PaymentGatewayRegion | null;
    return saved || company?.payment_region || 'RU';
  });
  const [botUsername, setBotUsername] = useState<string>(() => {
    return localStorage.getItem('tedcloud_bot_username') || 'TedCloudEnterpriseBot';
  });

  const companyId = company?.id || currentProfile?.company_id || '';
  const companyName = company?.name || 'TedCloud';

  const nodeMap = useMemo(() => {
    const map = new Map<string, OrganizationNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const kpis = useMemo(() => computeDashboardKpis(leads, tasks, nodes), [leads, tasks, nodes]);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handlePlanChange = (plan: SubscriptionPlanTier) => {
    setSelectedPlan(plan);
    localStorage.setItem('tedcloud_plan', plan);
    if (company?.id) {
      void onPatchRecord('companies', company.id, { plan });
    }
    showToast(t('toast.planUpdated'));
  };

  const handleRegionChange = (region: PaymentGatewayRegion) => {
    setPaymentRegion(region);
    localStorage.setItem('tedcloud_payment_region', region);
    if (company?.id) {
      void onPatchRecord('companies', company.id, { payment_region: region });
    }
    showToast(t('toast.gatewayUpdated'));
  };

  const handleBotUsernameChange = (val: string) => {
    const clean = val.replace(/^@/, '').trim();
    setBotUsername(clean);
    localStorage.setItem('tedcloud_bot_username', clean);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(key);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {}
  };

  // Filtered Lists
  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const matchesQuery =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (item.type || '').toLowerCase().includes(searchQuery.trim().toLowerCase());

      const matchesMyTasks =
        !onlyMyTasks || (currentProfile && item.assigned_to === currentProfile.id);

      const matchesPriority =
        priorityFilter === 'ALL' || (item.priority || 'Medium') === priorityFilter;

      return matchesQuery && matchesMyTasks && matchesPriority;
    });
  }, [tasks, searchQuery, onlyMyTasks, currentProfile, priorityFilter]);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.role_type.toLowerCase().includes(q) ||
        (n.department || '').toLowerCase().includes(q) ||
        (n.email || '').toLowerCase().includes(q) ||
        (n.invite_code || '').toLowerCase().includes(q)
    );
  }, [nodes, searchQuery]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const name = (l.client_name || l.full_name || '').toLowerCase();
      const title = (l.title || '').toLowerCase();
      const contact = (l.contact || l.phone || '').toLowerCase();
      return name.includes(q) || title.includes(q) || contact.includes(q);
    });
  }, [leads, searchQuery]);

  const completedTasksCount = useMemo(
    () => tasks.filter((tItem) => tItem.status === 'Done').length,
    [tasks]
  );

  const highPriorityOpenCount = useMemo(
    () => tasks.filter((tItem) => tItem.priority === 'High' && tItem.status !== 'Done').length,
    [tasks]
  );

  const totalPipelineValue = useMemo(
    () =>
      leads
        .filter((l) => (l.status || l.stage) !== 'Lost')
        .reduce((acc, item) => acc + (Number(item.amount ?? item.deal_value) || 0), 0),
    [leads]
  );

  const wonPipelineValue = useMemo(
    () =>
      leads
        .filter((l) => (l.status || l.stage) === 'Won')
        .reduce((acc, item) => acc + (Number(item.amount ?? item.deal_value) || 0), 0),
    [leads]
  );

  // Mutations
  const handleTaskUpdate = async (taskId: string, updates: Record<string, any>) => {
    setBusyRecordId(taskId);
    try {
      const res = await onPatchRecord('tasks', taskId, updates);
      if (res.pushSent) {
        showToast(t('toast.pushSent'));
      }
    } finally {
      setBusyRecordId(null);
    }
  };

  const handleLeadStatusChange = (lead: CrmLeadRecord, nextStatus: CrmLeadStatus) => {
    const currentStatus = (lead.status || lead.stage || 'New') as CrmLeadStatus;
    if (currentStatus === nextStatus) return;

    if (nextStatus === 'Lost') {
      const dealName = lead.client_name || lead.full_name || lead.title || '';
      setPendingConfirm({
        title: t('confirm.criticalStatusTitle'),
        description: `${t('confirm.criticalStatusDesc')} (${dealName} — ${t('stage.Lost')})`,
        variant: 'warning',
        execute: async () => {
          setBusyRecordId(lead.id);
          try {
            await onPatchRecord('crm_leads', lead.id, { status: nextStatus });
          } finally {
            setBusyRecordId(null);
          }
        },
      });
      return;
    }

    setBusyRecordId(lead.id);
    onPatchRecord('crm_leads', lead.id, { status: nextStatus }).finally(() =>
      setBusyRecordId(null)
    );
  };

  const handleAccessLevelUpdate = (node: OrganizationNode, nextLevel: AccessLevel) => {
    const currentLevel = node.access_level || 'member';
    if (currentLevel === nextLevel) return;

    const nextPermissions = getDefaultPermissionsForAccessLevel(nextLevel);

    setPendingConfirm({
      title: t('confirm.criticalStatusTitle'),
      description: `${node.name} (${node.role_type}): ${t(`accessShort.${currentLevel}`)} -> ${t(
        `accessShort.${nextLevel}`
      )}`,
      variant: 'warning',
      execute: async () => {
        setBusyRecordId(node.id);
        try {
          await onPatchRecord('organization_nodes', node.id, {
            access_level: nextLevel,
            permissions: nextPermissions,
          });
          showToast(t('toast.permissionsUpdated'));
        } finally {
          setBusyRecordId(null);
        }
      },
    });
  };

  const handleToggleNodePermission = async (
    node: OrganizationNode,
    permKey: keyof EmployeePermissions
  ) => {
    const { access_level, permissions } = normalizeEmployeePermissions(
      node.access_level,
      node.permissions
    );
    const updatedPermissions: EmployeePermissions = {
      ...permissions,
      [permKey]: !permissions[permKey],
    };

    setBusyRecordId(node.id);
    try {
      await onPatchRecord('organization_nodes', node.id, {
        access_level,
        permissions: updatedPermissions,
      });
      showToast(t('toast.permissionsUpdated'));
    } finally {
      setBusyRecordId(null);
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    if (!profileName.trim() || !profileRoleTitle.trim()) return;

    setIsSavingProfile(true);
    try {
      const res = await onPatchRecord('organization_nodes', currentProfile.id, {
        name: profileName.trim(),
        role_type: profileRoleTitle.trim(),
        department: profileDepartment.trim() || null,
        email: profileEmail.trim() || null,
      });
      if (res.ok) {
        showToast(t('profile.savedToast'));
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const requestDeleteRecord = (
    table: 'tasks' | 'crm_leads' | 'organization_nodes',
    id: string,
    recordLabel: string
  ) => {
    const titleKey =
      table === 'tasks'
        ? 'confirm.deleteTaskTitle'
        : table === 'crm_leads'
        ? 'confirm.deleteDealTitle'
        : 'confirm.deleteEmployeeTitle';
    const descKey =
      table === 'tasks'
        ? 'confirm.deleteTaskDesc'
        : table === 'crm_leads'
        ? 'confirm.deleteDealDesc'
        : 'confirm.deleteEmployeeDesc';

    setPendingConfirm({
      title: `${t(titleKey)}: ${recordLabel}`,
      description: t(descKey),
      variant: 'danger',
      execute: async () => {
        setBusyRecordId(id);
        try {
          await onDeleteRecord(table, id);
        } finally {
          setBusyRecordId(null);
        }
      },
    });
  };

  const requestSignOut = () => {
    if (!onResetSession) return;
    setPendingConfirm({
      title: t('confirm.signOutTitle'),
      description: t('confirm.signOutDesc'),
      variant: 'warning',
      execute: async () => {
        onResetSession();
      },
    });
  };

  // CSV Export Helper
  const downloadCsv = (
    filename: string,
    headers: string[],
    rows: (string | number | null | undefined)[][]
  ) => {
    const escapeCell = (val: string | number | null | undefined) => {
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t('toast.csvExported'));
  };

  const handleExportDealsCsv = () => {
    downloadCsv(
      `tedcloud-deals-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Client', 'Subject', 'Amount (RUB)', 'Stage', 'Contact', 'Created'],
      leads.map((l) => [
        l.id,
        l.client_name || l.full_name || '',
        l.title || '',
        Number(l.amount ?? l.deal_value ?? 0),
        l.status || l.stage || 'New',
        l.contact || l.phone || '',
        l.created_at || '',
      ])
    );
  };

  const handleExportTasksCsv = () => {
    downloadCsv(
      `tedcloud-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Title', 'Type', 'Priority', 'Status', 'Assignee', 'Position', 'Created'],
      tasks.map((task) => {
        const assignee = task.assigned_to ? nodeMap.get(task.assigned_to) : null;
        return [
          task.id,
          task.title,
          task.type || 'Task',
          task.priority || 'Medium',
          task.status || 'Todo',
          assignee ? assignee.name : '',
          assignee ? assignee.role_type : '',
          task.created_at || '',
        ];
      })
    );
  };

  const handleExportTeamCsv = () => {
    downloadCsv(
      `tedcloud-team-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Full Name', 'Job Title', 'Department', 'Access Level', 'Email', 'Invite Code', 'Telegram ID'],
      nodes.map((n) => [
        n.id,
        n.name,
        n.role_type,
        n.department || '',
        n.access_level || 'member',
        n.email || '',
        n.invite_code || '',
        n.telegram_chat_id || '',
      ])
    );
  };

  // Single-language, non-wrapping badges (БЛОК 4)
  const renderPriorityBadge = (priority?: TaskPriority) => {
    const p = priority || 'Medium';
    if (p === 'High') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap">
          {t('priority.High')}
        </span>
      );
    }
    if (p === 'Low') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded bg-[#1F1F1F] text-[#A1A1AA] border border-[#2C2C2E] whitespace-nowrap">
          {t('priority.Low')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
        {t('priority.Medium')}
      </span>
    );
  };

  const renderLeadStatusBadge = (status?: string) => {
    const s = (status || 'New') as CrmLeadStatus;
    if (s === 'Won') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
          {t('stage.Won')}
        </span>
      );
    }
    if (s === 'Lost') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 whitespace-nowrap">
          {t('stage.Lost')}
        </span>
      );
    }
    if (s === 'Negotiation') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 whitespace-nowrap">
          {t('stage.Negotiation')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 whitespace-nowrap">
        {t('stage.New')}
      </span>
    );
  };

  const renderTaskStatusBadge = (status?: TaskStatus) => {
    const st = status || 'Todo';
    if (st === 'Done') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
          {t('status.Done')}
        </span>
      );
    }
    if (st === 'In Progress') {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 whitespace-nowrap">
          {t('status.In Progress')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded border border-[#2C2C2E] bg-[#1C1C1F] text-[#A1A1AA] whitespace-nowrap">
        {t('status.Todo')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#EDEDED] flex font-sans antialiased">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentProfile={currentProfile}
        counts={{
          tasks: tasks.length,
          nodes: nodes.length,
          leads: leads.length,
        }}
        onRequestSignOut={onResetSession ? requestSignOut : undefined}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          companyName={companyName}
          currentProfile={currentProfile}
          activeChatId={activeChatId}
          isSyncing={isSyncing}
          onRefresh={onRefresh}
        />

        {toastBanner && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <BellRing className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{toastBanner}</span>
            </div>
            <button
              onClick={() => setToastBanner(null)}
              className="text-emerald-400 hover:text-white text-[11px] font-semibold"
            >
              OK
            </button>
          </div>
        )}

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Page Header & Contextual Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                {activeSection === 'overview' && t('header.overviewTitle')}
                {activeSection === 'tasks' && t('header.tasksTitle')}
                {activeSection === 'crm' && t('header.crmTitle')}
                {activeSection === 'team' && t('header.teamTitle')}
                {activeSection === 'profile' && t('header.profileTitle')}
                {activeSection === 'workspace' && t('header.workspaceTitle')}
              </h1>
              <p className="text-xs text-[#8E8E93] mt-1">
                {activeSection === 'overview' && t('header.overviewSubtitle')}
                {activeSection === 'tasks' && t('header.tasksSubtitle')}
                {activeSection === 'crm' && t('header.crmSubtitle')}
                {activeSection === 'team' && t('header.teamSubtitle')}
                {activeSection === 'profile' && t('header.profileSubtitle')}
                {activeSection === 'workspace' && t('header.workspaceSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {(activeSection === 'tasks' ||
                activeSection === 'crm' ||
                activeSection === 'team') && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('actions.searchPlaceholder')}
                    className="w-52 sm:w-64 rounded-lg border border-[#262626] bg-[#121212] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>
              )}

              <button
                onClick={() => setModalType('tasks')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('actions.newTask')}</span>
              </button>

              <button
                onClick={() => setModalType('organization_nodes')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1F1F1F] text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('actions.newEmployee')}</span>
              </button>

              <button
                onClick={() => setModalType('crm_leads')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1F1F1F] text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('actions.newDeal')}</span>
              </button>
            </div>
          </div>

          {/* =================================================================
              TAB 1: ДАШБОРД / OVERVIEW (Ключевые метрики, конверсия, сводка задач)
          ================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-4">
                  <div className="flex items-center justify-between text-[#8E8E93] mb-3">
                    <span className="text-xs font-medium">{t('kpi.totalTasks')}</span>
                    <Clock className="w-4 h-4 text-[#71717A]" />
                  </div>
                  <div className="text-2xl font-semibold text-white tracking-tight">
                    {kpis.activeTasksCount}
                  </div>
                  <div className="text-[11px] text-[#71717A] mt-1 flex items-center justify-between">
                    <span>
                      {t('kpi.completed')}: {completedTasksCount}
                    </span>
                    {highPriorityOpenCount > 0 && (
                      <span className="text-red-400 font-medium whitespace-nowrap">
                        {highPriorityOpenCount} {t('kpi.highPriority')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-4">
                  <div className="flex items-center justify-between text-[#8E8E93] mb-3">
                    <span className="text-xs font-medium">{t('kpi.orgStructure')}</span>
                    <Users className="w-4 h-4 text-[#71717A]" />
                  </div>
                  <div className="text-2xl font-semibold text-white tracking-tight">
                    {nodes.length}
                  </div>
                  <div className="text-[11px] text-[#71717A] mt-1">
                    {t('kpi.telegramConnected')}:{' '}
                    {nodes.filter((n) => Boolean(n.telegram_chat_id)).length}
                  </div>
                </div>

                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-4">
                  <div className="flex items-center justify-between text-[#8E8E93] mb-3">
                    <span className="text-xs font-medium">{t('kpi.conversionRate')}</span>
                    <Percent className="w-4 h-4 text-[#71717A]" />
                  </div>
                  <div className="text-2xl font-semibold text-white tracking-tight">
                    {kpis.conversionRatePercent}%
                  </div>
                  <div className="text-[11px] text-[#71717A] mt-1">
                    {t('kpi.wonDeals')}:{' '}
                    {leads.filter((l) => (l.status || l.stage) === 'Won').length} / {leads.length}
                  </div>
                </div>

                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-4">
                  <div className="flex items-center justify-between text-[#8E8E93] mb-3">
                    <span className="text-xs font-medium">{t('kpi.pipelineVolume')}</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-semibold text-white tracking-tight">
                    {formatMoney(totalPipelineValue)}
                  </div>
                  <div className="text-[11px] text-emerald-400/90 mt-1">
                    {t('kpi.closedWon')}: {formatMoney(wonPipelineValue)}
                  </div>
                </div>
              </div>

              {/* Сводка активных задач на Дашборде */}
              <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#1F1F1F] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#A1A1AA]" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                      {t('tasks.sectionTitle')}
                    </h2>
                    <span className="text-[11px] font-medium text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                      {tasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSection('tasks')}
                    className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                  >
                    {t('nav.tasks')}
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="text-sm font-medium text-white">{t('tasks.emptyTitle')}</div>
                    <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('tasks.empty')}</p>
                    <button
                      onClick={() => setModalType('tasks')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('tasks.addBtn')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#1A1A1C]">
                    {tasks.slice(0, 8).map((task) => {
                      const assignee = task.assigned_to ? nodeMap.get(task.assigned_to) : null;
                      return (
                        <div
                          key={task.id}
                          className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#161618] transition-colors"
                        >
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                task.status === 'Done'
                                  ? 'text-[#71717A] line-through'
                                  : 'text-white'
                              }`}
                            >
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {renderPriorityBadge(task.priority)}
                              {renderTaskStatusBadge(task.status)}
                              {assignee ? (
                                <span className="text-xs text-[#A1A1AA]">
                                  {assignee.name} ({assignee.role_type})
                                </span>
                              ) : (
                                <span className="text-xs text-[#71717A]">
                                  {t('tasks.unassigned')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={task.status || 'Todo'}
                              onChange={(e) =>
                                handleTaskUpdate(task.id, {
                                  status: e.target.value as TaskStatus,
                                })
                              }
                              className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none"
                            >
                              <option value="Todo">{t('status.Todo')}</option>
                              <option value="In Progress">{t('status.In Progress')}</option>
                              <option value="Done">{t('status.Done')}</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: ЗАДАЧИ / TASKS (Таблица и канбан задач, реальные должности)
          ================================================================== */}
          {activeSection === 'tasks' && (
            <section className="rounded-xl border border-[#1F1F1F] bg-[#111113] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1F1F1F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#A1A1AA]" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                    {t('tasks.sectionTitle')}
                  </h2>
                  <span className="text-[11px] font-medium text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                    {filteredTasks.length}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setOnlyMyTasks((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                      onlyMyTasks
                        ? 'bg-white text-black border-white'
                        : 'bg-[#161618] text-[#A1A1AA] border-[#262626] hover:text-white'
                    }`}
                  >
                    {t('tasks.myTasks')}
                  </button>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'ALL')}
                    className="rounded-md border border-[#262626] bg-[#161618] px-2.5 py-1 text-xs text-[#D4D4D8] focus:outline-none"
                  >
                    <option value="ALL">{t('tasks.allPriorities')}</option>
                    <option value="High">{t('priority.High')}</option>
                    <option value="Medium">{t('priority.Medium')}</option>
                    <option value="Low">{t('priority.Low')}</option>
                  </select>

                  <div className="inline-flex rounded-md border border-[#262626] bg-[#161618] p-0.5">
                    <button
                      onClick={() => setTaskViewMode('list')}
                      className={`p-1 rounded ${
                        taskViewMode === 'list'
                          ? 'bg-[#262629] text-white'
                          : 'text-[#71717A] hover:text-white'
                      }`}
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTaskViewMode('board')}
                      className={`p-1 rounded ${
                        taskViewMode === 'board'
                          ? 'bg-[#262629] text-white'
                          : 'text-[#71717A] hover:text-white'
                      }`}
                    >
                      <Columns3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-sm font-medium text-white">{t('tasks.emptyTitle')}</div>
                  <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('tasks.empty')}</p>
                  <button
                    onClick={() => setModalType('tasks')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('tasks.addBtn')}</span>
                  </button>
                </div>
              ) : taskViewMode === 'list' ? (
                <div className="divide-y divide-[#1A1A1C]">
                  {filteredTasks.map((task) => {
                    const isBusy = busyRecordId === task.id;
                    const assignee = task.assigned_to ? nodeMap.get(task.assigned_to) : null;

                    return (
                      <div
                        key={task.id}
                        className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#161618] transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleTaskUpdate(task.id, {
                                status: task.status === 'Done' ? 'Todo' : 'Done',
                              })
                            }
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              task.status === 'Done'
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'border-[#3F3F46] hover:border-white'
                            }`}
                          >
                            {task.status === 'Done' && <CheckCircle2 className="w-3 h-3" />}
                          </button>

                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                task.status === 'Done'
                                  ? 'text-[#71717A] line-through'
                                  : 'text-white'
                              }`}
                            >
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#1C1C1F] text-[#A1A1AA] border border-[#2C2C30] whitespace-nowrap">
                                {t(`type.${task.type || 'Task'}`)}
                              </span>
                              {renderPriorityBadge(task.priority)}
                              {assignee && (
                                <span className="text-xs text-[#8E8E93]">
                                  {t('tasks.assignee')}:{' '}
                                  <strong className="text-[#D4D4D8] font-medium">
                                    {assignee.name} ({assignee.role_type})
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <select
                            disabled={isBusy}
                            value={task.assigned_to || ''}
                            onChange={(e) =>
                              handleTaskUpdate(task.id, {
                                assigned_to: e.target.value || null,
                              })
                            }
                            className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none"
                          >
                            <option value="">{t('tasks.unassigned')}</option>
                            {nodes.map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.name} — {node.role_type}
                              </option>
                            ))}
                          </select>

                          <select
                            disabled={isBusy}
                            value={task.priority || 'Medium'}
                            onChange={(e) =>
                              handleTaskUpdate(task.id, {
                                priority: e.target.value as TaskPriority,
                              })
                            }
                            className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none"
                          >
                            <option value="Low">{t('priority.Low')}</option>
                            <option value="Medium">{t('priority.Medium')}</option>
                            <option value="High">{t('priority.High')}</option>
                          </select>

                          <select
                            disabled={isBusy}
                            value={task.status || 'Todo'}
                            onChange={(e) =>
                              handleTaskUpdate(task.id, {
                                status: e.target.value as TaskStatus,
                              })
                            }
                            className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none"
                          >
                            <option value="Todo">{t('status.Todo')}</option>
                            <option value="In Progress">{t('status.In Progress')}</option>
                            <option value="Done">{t('status.Done')}</option>
                          </select>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => requestDeleteRecord('tasks', task.id, task.title)}
                            className="p-1.5 rounded-md text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['Todo', 'In Progress', 'Done'] as TaskStatus[]).map((columnStatus) => {
                    const colTasks = filteredTasks.filter(
                      (tItem) => (tItem.status || 'Todo') === columnStatus
                    );
                    return (
                      <div
                        key={columnStatus}
                        className="rounded-lg border border-[#222225] bg-[#0D0D0F] p-3 flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-semibold text-[#D4D4D8]">
                            {t(`status.${columnStatus}`)}
                          </span>
                          <span className="text-xs font-medium text-[#71717A]">
                            {colTasks.length}
                          </span>
                        </div>

                        {colTasks.length === 0 ? (
                          <div className="py-8 text-center text-xs text-[#52525B] border border-dashed border-[#1F1F22] rounded-md">
                            —
                          </div>
                        ) : (
                          colTasks.map((task) => {
                            const assignee = task.assigned_to
                              ? nodeMap.get(task.assigned_to)
                              : null;
                            return (
                              <div
                                key={task.id}
                                className="rounded-lg border border-[#242428] bg-[#141417] p-3 space-y-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium text-white leading-snug">
                                    {task.title}
                                  </p>
                                  <button
                                    onClick={() => requestDeleteRecord('tasks', task.id, task.title)}
                                    className="text-[#52525B] hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  {renderPriorityBadge(task.priority)}
                                  <span className="text-[11px] text-[#8E8E93] truncate">
                                    {assignee
                                      ? `${assignee.name} (${assignee.role_type})`
                                      : t('tasks.unassigned')}
                                  </span>
                                </div>

                                <div className="pt-1 flex items-center justify-between gap-1.5 border-t border-[#1F1F23]">
                                  {(['Todo', 'In Progress', 'Done'] as TaskStatus[]).map((st) => (
                                    <button
                                      key={st}
                                      onClick={() => handleTaskUpdate(task.id, { status: st })}
                                      className={`flex-1 py-1 rounded text-[11px] transition-colors whitespace-nowrap ${
                                        (task.status || 'Todo') === st
                                          ? 'bg-white text-black font-semibold'
                                          : 'bg-[#1C1C20] text-[#8E8E93] hover:text-white'
                                      }`}
                                    >
                                      {t(`status.${st}`)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* =================================================================
              TAB 3: СДЕЛКИ / CRM DEALS
          ================================================================== */}
          {activeSection === 'crm' && (
            <section className="rounded-xl border border-[#1F1F1F] bg-[#111113] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1F1F1F] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-[#A1A1AA]" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                    {t('crm.sectionTitle')}
                  </h2>
                  <span className="text-[11px] font-medium text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                    {filteredLeads.length}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportDealsCsv}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-sm font-medium text-white">{t('crm.emptyTitle')}</div>
                  <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('crm.empty')}</p>
                  <button
                    onClick={() => setModalType('crm_leads')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('crm.addBtn')}</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1F1F1F] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                        <th className="py-3 px-5">{t('crm.colClient')}</th>
                        <th className="py-3 px-5">{t('crm.colContact')}</th>
                        <th className="py-3 px-5">{t('crm.colStage')}</th>
                        <th className="py-3 px-5 text-right">{t('crm.colAmount')}</th>
                        <th className="py-3 px-5 text-right">{t('crm.colControl')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1A1C] text-xs">
                      {filteredLeads.map((lead) => {
                        const displayName =
                          lead.client_name || lead.full_name || lead.title || '';
                        const displayContact = lead.contact || lead.phone || '—';
                        const displayStatus = (lead.status || lead.stage || 'New') as CrmLeadStatus;
                        const displayValue = Number(lead.amount ?? lead.deal_value ?? 0);

                        return (
                          <tr key={lead.id} className="hover:bg-[#161618] transition-colors">
                            <td className="py-3.5 px-5">
                              <div className="font-medium text-white">{displayName}</div>
                              {lead.title && lead.title !== displayName && (
                                <div className="text-[11px] text-[#71717A]">{lead.title}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-[#A1A1AA]">
                              <span className="inline-flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-[#71717A]" />
                                {displayContact}
                              </span>
                            </td>
                            <td className="py-3.5 px-5">{renderLeadStatusBadge(displayStatus)}</td>
                            <td className="py-3.5 px-5 text-right text-white font-semibold whitespace-nowrap">
                              {formatMoney(displayValue)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center gap-2">
                                <select
                                  value={displayStatus}
                                  onChange={(e) =>
                                    handleLeadStatusChange(lead, e.target.value as CrmLeadStatus)
                                  }
                                  className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none"
                                >
                                  <option value="New">{t('stage.New')}</option>
                                  <option value="Negotiation">{t('stage.Negotiation')}</option>
                                  <option value="Won">{t('stage.Won')}</option>
                                  <option value="Lost">{t('stage.Lost')}</option>
                                </select>

                                <button
                                  onClick={() =>
                                    requestDeleteRecord('crm_leads', lead.id, displayName)
                                  }
                                  className="p-1.5 rounded-md text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* =================================================================
              TAB 4: ШТАТ И ДОСТУПЫ / TEAM & ACCESS (Свободные должности + матрица прав)
          ================================================================== */}
          {activeSection === 'team' && (
            <section className="rounded-xl border border-[#1F1F1F] bg-[#111113] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#1F1F1F] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-[#A1A1AA]" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                    {t('team.sectionTitle')}
                  </h2>
                  <span className="text-[11px] font-medium text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                    {filteredNodes.length}
                  </span>
                </div>
                <button
                  onClick={() => setModalType('organization_nodes')}
                  className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                >
                  + {t('team.addBtn')}
                </button>
              </div>

              {filteredNodes.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-sm font-medium text-white">{t('team.emptyTitle')}</div>
                  <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('team.empty')}</p>
                  <button
                    onClick={() => setModalType('organization_nodes')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('team.addBtn')}</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1F1F1F] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                        <th className="py-3 px-5">{t('team.colEmployee')}</th>
                        <th className="py-3 px-5">{t('team.colJobTitle')}</th>
                        <th className="py-3 px-5">{t('team.colAccess')}</th>
                        <th className="py-3 px-5">{t('team.colInviteCode')}</th>
                        <th className="py-3 px-5">{t('team.colTelegram')}</th>
                        <th className="py-3 px-5 text-right">{t('team.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1A1C] text-xs">
                      {filteredNodes.map((node) => {
                        const { access_level, permissions } = normalizeEmployeePermissions(
                          node.access_level,
                          node.permissions
                        );

                        return (
                          <tr key={node.id} className="hover:bg-[#161618] transition-colors align-top">
                            <td className="py-4 px-5">
                              <div className="font-semibold text-white">{node.name}</div>
                              {node.email && (
                                <div className="text-[11px] text-[#71717A] mt-0.5">
                                  {node.email}
                                </div>
                              )}
                            </td>

                            {/* Свободная должность и подразделение */}
                            <td className="py-4 px-5">
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded bg-[#1C1C1F] text-white border border-[#2C2C30] font-medium whitespace-nowrap">
                                {node.role_type}
                              </div>
                              <div className="text-[11px] text-[#8E8E93] mt-1">
                                {node.department || t('team.noDepartment')}
                              </div>
                            </td>

                            {/* Уровень допуска + Интерактивные чекбоксы полномочий */}
                            <td className="py-4 px-5 space-y-2.5 min-w-[280px]">
                              <select
                                value={access_level}
                                onChange={(e) =>
                                  handleAccessLevelUpdate(node, e.target.value as AccessLevel)
                                }
                                className="w-full rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1.5 text-xs text-white focus:border-[#52525B] focus:outline-none"
                              >
                                <option value="root">{t('access.root')}</option>
                                <option value="manager">{t('access.manager')}</option>
                                <option value="member">{t('access.member')}</option>
                                <option value="viewer">{t('access.viewer')}</option>
                              </select>

                              <div className="grid grid-cols-1 gap-1.5 pt-1">
                                {(
                                  [
                                    ['canAssignTasks', t('perm.canAssignTasks')],
                                    ['canManageCrm', t('perm.canManageCrm')],
                                    ['canManageTeam', t('perm.canManageTeam')],
                                    ['canDeleteAndSettings', t('perm.canDeleteAndSettings')],
                                  ] as [keyof EmployeePermissions, string][]
                                ).map(([permKey, label]) => (
                                  <label
                                    key={permKey}
                                    className="flex items-center gap-2 text-[11px] text-[#A1A1AA] hover:text-white cursor-pointer select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={permissions[permKey]}
                                      onChange={() => void handleToggleNodePermission(node, permKey)}
                                      className="w-3.5 h-3.5 rounded border-[#3F3F46] bg-[#0D0D0F] text-white focus:ring-0"
                                    />
                                    <span>{label}</span>
                                  </label>
                                ))}
                              </div>
                            </td>

                            <td className="py-4 px-5">
                              <div className="flex flex-col items-start gap-1.5">
                                <span className="text-xs px-2.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-white font-semibold whitespace-nowrap">
                                  {node.invite_code || 'TC-0000'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setInspectInviteNode(node)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#A1A1AA] hover:text-white bg-[#1C1C1F] hover:bg-[#27272A] transition-colors whitespace-nowrap"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>{t('team.inviteLinkBtn')}</span>
                                </button>
                              </div>
                            </td>

                            <td className="py-4 px-5">
                              {node.telegram_chat_id ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium whitespace-nowrap">
                                  <Send className="w-3 h-3" />
                                  {t('team.connected')} ({node.telegram_chat_id})
                                </span>
                              ) : (
                                <span className="text-[#71717A] whitespace-nowrap">
                                  {t('team.pendingInvite')}
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-5 text-right">
                              <button
                                onClick={() =>
                                  requestDeleteRecord('organization_nodes', node.id, node.name)
                                }
                                className="p-1.5 rounded-md text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* =================================================================
              TAB 5: ЛИЧНЫЙ КАБИНЕТ / MY PROFILE
          ================================================================== */}
          {activeSection === 'profile' && currentProfile && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Редактирование личных данных и должности */}
              <form
                onSubmit={handleSaveMyProfile}
                className="lg:col-span-2 rounded-xl border border-[#1F1F1F] bg-[#111113] p-6 space-y-5"
              >
                <div className="flex items-center gap-3 border-b border-[#1F1F1F] pb-4">
                  <div className="w-9 h-9 rounded-lg bg-[#1C1C1F] border border-[#2C2C30] flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{t('profile.cardTitle')}</h2>
                    <p className="text-xs text-[#8E8E93]">{t('profile.cardSubtitle')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('profile.fullName')}
                    </label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('profile.jobTitle')}
                    </label>
                    <input
                      type="text"
                      required
                      value={profileRoleTitle}
                      onChange={(e) => setProfileRoleTitle(e.target.value)}
                      className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('profile.department')}
                    </label>
                    <input
                      type="text"
                      value={profileDepartment}
                      onChange={(e) => setProfileDepartment(e.target.value)}
                      className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('profile.email')}
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors"
                  >
                    {isSavingProfile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isSavingProfile ? t('profile.savingBtn') : t('profile.saveBtn')}
                    </span>
                  </button>
                </div>
              </form>

              {/* Права доступа, синхронизация Telegram и выход */}
              <div className="space-y-6">
                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      {t('profile.securityTitle')}
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-[#71717A] mb-1">{t('profile.accessLevelLabel')}</div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#1C1C1F] border border-[#2C2C30] text-white font-medium whitespace-nowrap">
                        {t(`access.${currentProfile.access_level || 'member'}`)}
                      </span>
                    </div>

                    <div>
                      <div className="text-[#71717A] mb-1">{t('profile.telegramStatusLabel')}</div>
                      {currentProfile.telegram_chat_id ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {t('profile.telegramConnectedId')} {currentProfile.telegram_chat_id})
                          </span>
                        </div>
                      ) : (
                        <div className="text-[#A1A1AA]">{t('profile.telegramNotConnected')}</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[#71717A] mb-1.5">{t('profile.syncLinkLabel')}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`https://t.me/${
                            botUsername || 'TedCloudEnterpriseBot'
                          }?start=${currentProfile.invite_code || 'TC-0000'}`}
                          className="w-full rounded-lg border border-[#262626] bg-[#0D0D0F] px-3 py-2 text-xs text-[#D4D4D8] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              `https://t.me/${
                                botUsername || 'TedCloudEnterpriseBot'
                              }?start=${currentProfile.invite_code || 'TC-0000'}`,
                              'profile-link'
                            )
                          }
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          {copiedToken === 'profile-link' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('invite.copied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{t('invite.copyLink')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {onResetSession && (
                  <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      {t('profile.sessionTitle')}
                    </h3>
                    <p className="text-xs text-[#8E8E93] leading-relaxed">
                      {t('profile.sessionDesc')}
                    </p>
                    <button
                      type="button"
                      onClick={requestSignOut}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-300 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('profile.signOutBtn')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 6: ОРГАНИЗАЦИЯ И БИЛЛИНГ / WORKSPACE & BILLING
          ================================================================== */}
          {activeSection === 'workspace' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-[#A1A1AA]" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      {t('workspace.orgSection')}
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-[#71717A] mb-1">{t('workspace.companyName')}</div>
                      <div className="font-semibold text-white text-sm">{companyName}</div>
                    </div>

                    <div>
                      <div className="text-[#71717A] mb-1">{t('workspace.botConfigTitle')}</div>
                      <p className="text-[11px] text-[#71717A] mb-2">
                        {t('workspace.botConfigDesc')}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#71717A]">@</span>
                        <input
                          type="text"
                          value={botUsername}
                          onChange={(e) => handleBotUsernameChange(e.target.value)}
                          className="w-full rounded-lg border border-[#262626] bg-[#171717] px-2.5 py-1.5 text-xs text-white focus:border-[#52525B] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Plan Selector */}
                <div className="lg:col-span-2 rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                        {t('workspace.currentPlan')}
                      </h3>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                      {selectedPlan}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(
                      [
                        {
                          tier: 'Trial' as SubscriptionPlanTier,
                          priceRub: 0,
                          desc: t('workspace.planTrialDesc'),
                        },
                        {
                          tier: 'Business' as SubscriptionPlanTier,
                          priceRub: 24900,
                          desc: t('workspace.planBusinessDesc'),
                        },
                        {
                          tier: 'Enterprise' as SubscriptionPlanTier,
                          priceRub: 89000,
                          desc: t('workspace.planEnterpriseDesc'),
                        },
                      ] as const
                    ).map((planItem) => {
                      const isCurrent = selectedPlan === planItem.tier;
                      return (
                        <div
                          key={planItem.tier}
                          className={`rounded-lg border p-4 flex flex-col justify-between transition-colors ${
                            isCurrent
                              ? 'border-white bg-[#18181B]'
                              : 'border-[#262626] bg-[#141416] hover:border-[#3F3F46]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-white">
                                {planItem.tier}
                              </span>
                              <span className="text-xs font-medium text-[#D4D4D8] whitespace-nowrap">
                                {formatMoney(planItem.priceRub)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8E8E93] leading-relaxed mt-2">
                              {planItem.desc}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePlanChange(planItem.tier)}
                            className={`mt-4 w-full py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                              isCurrent
                                ? 'bg-white text-black'
                                : 'bg-[#222226] text-[#D4D4D8] hover:bg-[#2C2C30]'
                            }`}
                          >
                            {isCurrent ? t('workspace.activeTier') : t('workspace.upgradeBtn')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Payment Gateway Contour & CSV Export */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-[#A1A1AA]" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      {t('workspace.billingSection')}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleRegionChange('RU')}
                      className={`text-left rounded-lg border p-3.5 transition-colors ${
                        paymentRegion === 'RU'
                          ? 'border-white bg-[#18181B]'
                          : 'border-[#262626] bg-[#141416] hover:border-[#3F3F46]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white mb-1">
                        {t('workspace.gatewayRu')}
                      </div>
                      <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                        {t('workspace.gatewayRuDesc')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRegionChange('GLOBAL')}
                      className={`text-left rounded-lg border p-3.5 transition-colors ${
                        paymentRegion === 'GLOBAL'
                          ? 'border-white bg-[#18181B]'
                          : 'border-[#262626] bg-[#141416] hover:border-[#3F3F46]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white mb-1">
                        {t('workspace.gatewayGlobal')}
                      </div>
                      <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                        {t('workspace.gatewayGlobalDesc')}
                      </p>
                    </button>
                  </div>
                </div>

                {/* CSV Export Center */}
                <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Download className="w-4 h-4 text-[#A1A1AA]" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      {t('workspace.exportSection')}
                    </h3>
                  </div>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    {t('workspace.exportDesc')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleExportDealsCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#262626] bg-[#161618] hover:bg-[#1F1F23] text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t('workspace.exportDealsCsv')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTasksCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#262626] bg-[#161618] hover:bg-[#1F1F23] text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t('workspace.exportTasksCsv')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTeamCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#262626] bg-[#161618] hover:bg-[#1F1F23] text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t('workspace.exportTeamCsv')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Record Modal */}
      <AddRecordModal
        type={modalType}
        companyId={companyId}
        currentProfileId={currentProfile?.id || null}
        nodes={nodes}
        botUsername={botUsername}
        onClose={() => setModalType(null)}
        onSuccess={async (pushSent) => {
          await onRefresh();
          if (pushSent) {
            showToast(t('toast.pushSent'));
          }
        }}
      />

      {/* Inspect Employee Invite Deep-Link Modal */}
      {inspectInviteNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-lg rounded-xl border border-[#262626] bg-[#121212] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  {t('invite.modalTitle')} — {inspectInviteNode.name}
                </h3>
              </div>
              <button
                onClick={() => setInspectInviteNode(null)}
                className="text-[#8E8E93] hover:text-white p-1 rounded-lg hover:bg-[#1F1F1F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                {t('invite.modalSubtitle')}
              </p>
              <div className="rounded-lg border border-[#262626] bg-[#171717] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider">
                    {t('invite.codeLabel')}
                  </span>
                  <span className="text-xs text-white font-semibold bg-[#242424] px-2.5 py-1 rounded border border-[#333333] whitespace-nowrap">
                    {inspectInviteNode.invite_code || 'TC-0000'}
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider mb-1.5">
                    {t('invite.deepLinkLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`https://t.me/${botUsername || 'TedCloudEnterpriseBot'}?start=${
                        inspectInviteNode.invite_code || 'TC-0000'
                      }`}
                      className="w-full rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-xs text-[#E4E4E7] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `https://t.me/${botUsername || 'TedCloudEnterpriseBot'}?start=${
                            inspectInviteNode.invite_code || 'TC-0000'
                          }`,
                          'modal-deep-link'
                        )
                      }
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white text-black hover:bg-[#E4E4E7] transition-colors whitespace-nowrap"
                    >
                      {copiedToken === 'modal-deep-link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('invite.copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t('invite.copyLink')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectInviteNode(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#E4E4E7] transition-colors"
                >
                  {t('invite.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        variant={pendingConfirm?.variant || 'danger'}
        confirmLabel={pendingConfirm?.confirmLabel || t('confirm.confirm')}
        cancelLabel={t('confirm.cancel')}
        isLoading={isConfirmLoading}
        onCancel={() => {
          if (!isConfirmLoading) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setIsConfirmLoading(true);
          try {
            await pendingConfirm.execute();
            setPendingConfirm(null);
          } finally {
            setIsConfirmLoading(false);
          }
        }}
      />
    </div>
  );
};
