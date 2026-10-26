import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Clock,
  Users,
  Briefcase,
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
  Percent,
  Save,
  SlidersHorizontal,
  Lock,
  Globe,
  FileText,
  MessageSquare,
  Hash,
  Radio,
  AlertCircle,
  Camera,
  Zap,
  Cpu,
  Calendar,
  Network,
  ListChecks,
  Receipt,
  Printer,
  History,
  ShieldCheck,
  Search,
} from 'lucide-react';
import {
  AccessLevel,
  AuditLogRecord,
  BillingCycle,
  BillingInvoiceRecord,
  BillingPaymentMethod,
  Company,
  CompanyBillingDetails,
  CrmLeadRecord,
  CrmLeadStatus,
  CurrencyCode,
  DashboardSection,
  EmployeePermissions,
  LanguageCode,
  OrganizationNode,
  PERMISSION_KEYS,
  PaymentGatewayRegion,
  SubscriptionPlanTier,
  TaskChecklistItem,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkspaceMessageRecord,
  computeDashboardKpis,
  extractCompanyDepartments,
  normalizeEmployeePermissions,
} from '../types/database';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AddRecordModal, InitialTaskDraft, ModalRecordType } from './AddRecordModal';
import { ConfirmDialog } from './ConfirmDialog';
import { PermissionsMatrixModal } from './PermissionsMatrixModal';
import { SlideOverDrawer, DrawerTarget } from './SlideOverDrawer';
import { UserAvatar, cropAndCompressAvatarToDataUrl } from './UserAvatar';
import { TedCloudAiDrawer } from './TedCloudAiDrawer';
import { CommandBarModal } from './CommandBarModal';
import { TeamworkGraphView } from './TeamworkGraphView';
import { SubscriptionCheckoutModal, PrintableInvoiceModal } from './BillingModals';
import { buildBuiltInChecklistForTask } from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';
import {
  ActiveMessengerThread,
  canUserSeeWorkspaceMessage,
  extractMessageText,
  filterMessagesForActiveThread,
  isDirectMessageBetweenUsers,
} from '../utils/messengerLogic';

interface DashboardProps {
  company: Company | null;
  currentProfile: OrganizationNode | null;
  activeChatId: string | null;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  messages?: WorkspaceMessageRecord[];
  invoices?: BillingInvoiceRecord[];
  auditLogs?: AuditLogRecord[];
  isSyncing: boolean;
  onRefresh: () => Promise<void> | void;
  onPatchRecord: (
    table: 'tasks' | 'crm_leads' | 'organization_nodes' | 'companies' | 'billing_invoices',
    id: string,
    updates: Record<string, any>
  ) => Promise<{ ok: boolean; pushSent?: boolean }>;
  onDeleteRecord: (
    table: 'tasks' | 'crm_leads' | 'organization_nodes',
    id: string
  ) => Promise<boolean>;
  onSendMessage?: (
    payload: Record<string, any>
  ) => Promise<{ ok: boolean; pushSent?: boolean }>;
  onCreateInvoice?: (
    payload: Record<string, any>
  ) => Promise<{ ok: boolean; invoice?: BillingInvoiceRecord }>;
  onResetSession?: () => void;
}

interface PendingConfirmAction {
  title: string;
  description: string;
  variant: 'danger' | 'warning';
  confirmLabel?: string;
  execute: () => Promise<void>;
}

const CUSTOM_DEPTS_STORAGE_PREFIX = 'tedcloud_custom_departments_';

export const Dashboard: React.FC<DashboardProps> = ({
  company,
  currentProfile,
  nodes,
  tasks,
  leads,
  messages = [],
  invoices = [],
  auditLogs = [],
  isSyncing,
  onRefresh,
  onPatchRecord,
  onDeleteRecord,
  onSendMessage,
  onCreateInvoice,
  onResetSession,
}) => {
  const { language, currency, setLanguage, setCurrency, t, formatMoney } = useLocale();

  const companyId = company?.id || currentProfile?.company_id || '';
  const companyName = company?.name || 'TedCloud';

  const safeNodes = useMemo(
    () =>
      (Array.isArray(nodes) ? nodes : []).filter(
        (n) => !companyId || !n?.company_id || String(n.company_id) === String(companyId)
      ),
    [nodes, companyId]
  );
  const safeTasks = useMemo(
    () =>
      (Array.isArray(tasks) ? tasks : []).filter(
        (tItem) =>
          !companyId || !tItem?.company_id || String(tItem.company_id) === String(companyId)
      ),
    [tasks, companyId]
  );
  const safeLeads = useMemo(
    () =>
      (Array.isArray(leads) ? leads : []).filter(
        (l) => !companyId || !l?.company_id || String(l.company_id) === String(companyId)
      ),
    [leads, companyId]
  );
  const safeMessages = useMemo(
    () =>
      (Array.isArray(messages) ? messages : []).filter(
        (m) => !companyId || !m?.company_id || String(m.company_id) === String(companyId)
      ),
    [messages, companyId]
  );
  const safeInvoices = useMemo(
    () =>
      (Array.isArray(invoices) ? invoices : []).filter(
        (inv) => !companyId || !inv?.company_id || String(inv.company_id) === String(companyId)
      ),
    [invoices, companyId]
  );
  const safeAuditLogs = useMemo(
    () =>
      (Array.isArray(auditLogs) ? auditLogs : []).filter(
        (log) => !companyId || !log?.company_id || String(log.company_id) === String(companyId)
      ),
    [auditLogs, companyId]
  );

  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [modalType, setModalType] = useState<ModalRecordType>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // TedCloud AI Copilot & Global Command Bar (Cmd+K)
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [overviewViewMode, setOverviewViewMode] = useState<'standard' | 'graph'>('standard');
  const [teamViewMode, setTeamViewMode] = useState<'table' | 'graph'>('table');
  const [decomposingTaskId, setDecomposingTaskId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Task & CRM View Modes
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'board'>('list');
  const [crmViewMode, setCrmViewMode] = useState<'board' | 'table'>('board');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL');
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Department Constructor state (Strictly scoped per companyId)
  const [localDepartments, setLocalDepartments] = useState<string[]>([]);
  const [newDeptName, setNewDeptName] = useState('');

  useEffect(() => {
    if (!companyId) {
      setLocalDepartments([]);
      return;
    }
    try {
      const raw = localStorage.getItem(`${CUSTOM_DEPTS_STORAGE_PREFIX}${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLocalDepartments(parsed.filter((x) => typeof x === 'string'));
          return;
        }
      }
    } catch {}
    setLocalDepartments([]);
  }, [companyId]);

  // Split-View Corporate Messenger state (Инфополе и Связь)
  const [activeCommThread, setActiveCommThread] = useState<ActiveMessengerThread>({
    type: 'broadcast',
    id: 'general',
    label: 'Общий поток (Циркуляры компании)',
  });
  const [commText, setCommText] = useState<string>('');
  const [commUrgent, setCommUrgent] = useState<boolean>(false);
  const [isSendingComm, setIsSendingComm] = useState<boolean>(false);
  const [initialTaskDraft, setInitialTaskDraft] = useState<InitialTaskDraft | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const avatarFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Confirm Dialog state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  // Invite Modal for existing employee
  const [inspectInviteNode, setInspectInviteNode] = useState<OrganizationNode | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Permissions Matrix Modal for Superadmin / Team Manager
  const [permissionsModalNode, setPermissionsModalNode] = useState<OrganizationNode | null>(null);

  // Slide-over Detail Drawer for Tasks & Deals
  const [drawerSelection, setDrawerSelection] = useState<{
    kind: 'task' | 'lead';
    id: string;
  } | null>(null);

  // Strict RBAC Permissions for Current User
  const { access_level: currentAccessLevel, permissions: perms } = useMemo(
    () =>
      normalizeEmployeePermissions(
        currentProfile?.access_level,
        currentProfile?.permissions,
        currentProfile?.role_type
      ),
    [currentProfile]
  );

  const canCreateOrEditTasks =
    currentAccessLevel !== 'observer' ||
    perms.tasks_assign ||
    perms.team_manage ||
    perms.billing_admin;

  // Guard activeSection if permissions change or user lacks access
  useEffect(() => {
    if (activeSection === 'crm' && !perms.crm_view) {
      setActiveSection('overview');
    } else if (activeSection === 'team' && !perms.team_manage) {
      setActiveSection('overview');
    } else if (activeSection === 'workspace' && !perms.billing_admin) {
      setActiveSection('overview');
    }
  }, [activeSection, perms.crm_view, perms.team_manage, perms.billing_admin]);

  // Unified Company Departments list (БЛОК 2)
  const companyDepartments = useMemo(() => {
    const extracted = extractCompanyDepartments(company, safeNodes, safeTasks, safeLeads);
    const set = new Set<string>(extracted);
    localDepartments.forEach((d) => {
      if (d && d.trim()) set.add(d.trim());
    });
    return Array.from(set);
  }, [company, safeNodes, safeTasks, safeLeads, localDepartments]);

  // Colleagues list for Direct Messages (excluding current user)
  const colleagueNodes = useMemo(
    () =>
      safeNodes.filter(
        (n) => n && n.id && String(n.id) !== String(currentProfile?.id || '')
      ),
    [safeNodes, currentProfile]
  );

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
    return company?.plan || (localStorage.getItem('tedcloud_plan') as SubscriptionPlanTier | null) || 'Business';
  });
  const [paymentRegion, setPaymentRegion] = useState<PaymentGatewayRegion>(() => {
    return company?.payment_region || (localStorage.getItem('tedcloud_payment_region') as PaymentGatewayRegion | null) || 'RU';
  });
  const [botUsername, setBotUsername] = useState<string>(() => {
    return localStorage.getItem('tedcloud_bot_username') || 'TedCloudEnterpriseBot';
  });

  // Payer Requisites (Реквизиты плательщика — companies.billing_details)
  const [payerLegalName, setPayerLegalName] = useState<string>(
    company?.billing_details?.legal_name || company?.name || ''
  );
  const [payerTaxId, setPayerTaxId] = useState<string>(
    company?.billing_details?.tax_id || ''
  );
  const [payerRegNumber, setPayerRegNumber] = useState<string>(
    company?.billing_details?.reg_number || ''
  );
  const [payerLegalAddress, setPayerLegalAddress] = useState<string>(
    company?.billing_details?.legal_address || ''
  );
  const [payerBillingEmail, setPayerBillingEmail] = useState<string>(
    company?.billing_details?.billing_email || currentProfile?.email || ''
  );
  const [payerCountry, setPayerCountry] = useState<string>(
    company?.billing_details?.country || ''
  );
  const [isSavingBillingDetails, setIsSavingBillingDetails] = useState(false);
  const [checkoutModalPlan, setCheckoutModalPlan] = useState<SubscriptionPlanTier | null>(null);
  const [printableInvoice, setPrintableInvoice] = useState<BillingInvoiceRecord | null>(null);

  useEffect(() => {
    if (company?.plan) {
      setSelectedPlan(company.plan);
    }
    if (company?.payment_region) {
      setPaymentRegion(company.payment_region);
    }
    if (company?.billing_details) {
      setPayerLegalName(company.billing_details.legal_name || company.name || '');
      setPayerTaxId(company.billing_details.tax_id || '');
      setPayerRegNumber(company.billing_details.reg_number || '');
      setPayerLegalAddress(company.billing_details.legal_address || '');
      setPayerBillingEmail(company.billing_details.billing_email || currentProfile?.email || '');
      setPayerCountry(company.billing_details.country || '');
    } else if (company?.name) {
      setPayerLegalName((prev) => prev || company.name);
    }
  }, [company, currentProfile?.email]);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch {}
  }, [activeSection]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, OrganizationNode>();
    safeNodes.forEach((n) => {
      if (n && n.id) map.set(n.id, n);
    });
    return map;
  }, [safeNodes]);

  // RBAC-filtered Tasks: if !perms.tasks_view_all, employee sees ONLY tasks assigned to them, their department, or created by them
  const visibleTasks = useMemo(() => {
    if (perms.tasks_view_all || !currentProfile) {
      return safeTasks;
    }
    return safeTasks.filter(
      (task) =>
        task.assigned_to === currentProfile.id ||
        task.owner_node_id === currentProfile.id ||
        task.created_by === currentProfile.id ||
        (currentProfile.department &&
          task.department &&
          task.department.toLowerCase() === currentProfile.department.toLowerCase())
    );
  }, [safeTasks, perms.tasks_view_all, currentProfile]);

  const visibleLeads = useMemo(() => {
    if (!perms.crm_view) return [];
    return safeLeads;
  }, [safeLeads, perms.crm_view]);

  // Strict Message Privacy: Direct messages are visible ONLY to sender and recipient
  const visibleMessages = useMemo(() => {
    return safeMessages.filter((msg) => canUserSeeWorkspaceMessage(msg, currentProfile));
  }, [safeMessages, currentProfile]);

  // Active thread messages in the Split-View Messenger (chronological order: oldest to newest or newest to oldest)
  const activeThreadMessages = useMemo(() => {
    return filterMessagesForActiveThread(visibleMessages, activeCommThread, currentProfile);
  }, [visibleMessages, activeCommThread, currentProfile]);

  const broadcastMessagesCount = useMemo(
    () =>
      filterMessagesForActiveThread(
        visibleMessages,
        { type: 'broadcast', id: 'general', label: 'Общий поток' },
        currentProfile
      ).length,
    [visibleMessages, currentProfile]
  );

  const kpis = useMemo(
    () => computeDashboardKpis(visibleLeads, visibleTasks, safeNodes),
    [visibleLeads, visibleTasks, safeNodes]
  );

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Department Constructor handlers (БЛОК 2 — изолировано по companyId)
  const handleAddDepartment = async (deptToAdd?: string) => {
    const raw = (deptToAdd ?? newDeptName).trim();
    if (!raw) return;
    if (companyDepartments.some((d) => d.toLowerCase() === raw.toLowerCase())) {
      setNewDeptName('');
      return;
    }
    const nextList = [...companyDepartments, raw];
    setLocalDepartments(nextList);
    if (companyId) {
      try {
        localStorage.setItem(
          `${CUSTOM_DEPTS_STORAGE_PREFIX}${companyId}`,
          JSON.stringify(nextList)
        );
      } catch {}
    }
    setNewDeptName('');
    if (company?.id) {
      await onPatchRecord('companies', company.id, { departments: nextList });
    }
    showToast(t('dept.addedToast'));
  };

  const handleRemoveDepartment = async (deptName: string) => {
    const nextList = companyDepartments.filter((d) => d !== deptName);
    setLocalDepartments(nextList);
    if (companyId) {
      try {
        localStorage.setItem(
          `${CUSTOM_DEPTS_STORAGE_PREFIX}${companyId}`,
          JSON.stringify(nextList)
        );
      } catch {}
    }
    if (company?.id) {
      await onPatchRecord('companies', company.id, { departments: nextList });
    }
    showToast(t('dept.removedToast'));
  };

  const handlePlanChange = (plan: SubscriptionPlanTier) => {
    if (!perms.billing_admin) return;
    setSelectedPlan(plan);
    localStorage.setItem('tedcloud_plan', plan);
    if (company?.id) {
      void onPatchRecord('companies', company.id, { plan });
    }
    showToast(t('toast.planUpdated'));
  };

  const handleRegionChange = (region: PaymentGatewayRegion) => {
    if (!perms.billing_admin) return;
    setPaymentRegion(region);
    localStorage.setItem('tedcloud_payment_region', region);
    if (company?.id) {
      void onPatchRecord('companies', company.id, { payment_region: region });
    }
    showToast(t('toast.gatewayUpdated'));
  };

  const handleSaveBillingDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perms.billing_admin || !company?.id) return;
    setIsSavingBillingDetails(true);
    try {
      const nextDetails: CompanyBillingDetails = {
        legal_name: payerLegalName.trim() || companyName,
        tax_id: payerTaxId.trim(),
        reg_number: payerRegNumber.trim(),
        legal_address: payerLegalAddress.trim(),
        billing_email: payerBillingEmail.trim(),
        country: payerCountry.trim(),
        region: paymentRegion,
      };
      const res = await onPatchRecord('companies', company.id, {
        billing_details: nextDetails,
        payment_region: paymentRegion,
      });
      if (res.ok) {
        showToast('Реквизиты плательщика сохранены');
      }
    } finally {
      setIsSavingBillingDetails(false);
    }
  };

  const handleConfirmSubscription = async (params: {
    plan: SubscriptionPlanTier;
    billingCycle: BillingCycle;
    paymentMethod: BillingPaymentMethod;
    amount: number;
    currency: CurrencyCode;
    region: PaymentGatewayRegion;
    payerDetails?: CompanyBillingDetails;
    invoiceNumber: string;
  }) => {
    if (!perms.billing_admin) return;
    const effectiveRegion = params.region || paymentRegion;
    const currentDetails: CompanyBillingDetails = {
      ...(params.payerDetails || {}),
      legal_name: params.payerDetails?.legal_name || payerLegalName.trim() || companyName,
      region: effectiveRegion,
    };

    const status =
      params.paymentMethod === 'card_sbp' || params.paymentMethod === 'stripe_card'
        ? 'Paid'
        : 'Pending';
    setSelectedPlan(params.plan);
    setPaymentRegion(effectiveRegion);
    localStorage.setItem('tedcloud_plan', params.plan);
    localStorage.setItem('tedcloud_payment_region', effectiveRegion);

    if (company?.id) {
      await onPatchRecord('companies', company.id, {
        plan: params.plan,
        payment_region: effectiveRegion,
        billing_cycle: params.billingCycle,
        billing_details: currentDetails,
      });
    }

    if (onCreateInvoice) {
      const created = await onCreateInvoice({
        company_id: companyId,
        invoice_number: params.invoiceNumber,
        plan: params.plan,
        billing_cycle: params.billingCycle,
        payment_method: params.paymentMethod,
        amount: params.amount,
        currency: params.currency,
        status,
        payer_details: currentDetails,
      });

      setCheckoutModalPlan(null);
      if (created.ok && created.invoice) {
        if (
          params.paymentMethod === 'b2b_invoice' ||
          params.paymentMethod === 'swift_wire' ||
          params.paymentMethod === 'crypto_usdt'
        ) {
          setPrintableInvoice(created.invoice);
          showToast(`Инвойс ${params.invoiceNumber} сформирован и готов к печати`);
        } else {
          showToast(`Тариф ${params.plan} успешно оплачен и активирован`);
        }
      }
    } else {
      setCheckoutModalPlan(null);
      showToast(t('toast.planUpdated'));
    }
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    if (!perms.billing_admin) return;
    const res = await onPatchRecord('billing_invoices', invoiceId, { status: 'Paid' });
    if (res.ok) {
      setPrintableInvoice((prev) =>
        prev && prev.id === invoiceId ? { ...prev, status: 'Paid' } : prev
      );
      showToast('Статус счета обновлен: Оплачен');
    }
  };

  const handleQuickAiDecomposeTask = async (task: TaskRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canCreateOrEditTasks || decomposingTaskId === task.id) return;
    setDecomposingTaskId(task.id);
    try {
      let nextChecklist: TaskChecklistItem[] = [];
      let nextSummary = '';
      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ai_assistant',
            mode: 'decompose_task',
            company_id: companyId,
            profile_id: currentProfile?.id,
            task_id: task.id,
            taskTitle: task.title,
            taskDescription: task.description || task.notes || '',
          }),
        });
        const data = await response.json();
        if (response.ok && Array.isArray(data.checklist) && data.checklist.length > 0) {
          nextChecklist = data.checklist;
          nextSummary = data.aiSummary || data.ai_summary || '';
        }
      } catch {}

      if (nextChecklist.length === 0) {
        const builtIn = buildBuiltInChecklistForTask(task.title, task.description || task.notes);
        nextChecklist = builtIn.checklist;
        nextSummary = builtIn.summary;
      }

      await onPatchRecord('tasks', task.id, {
        checklist: nextChecklist,
        ai_summary: nextSummary,
      });
      showToast(`ИИ-декомпозиция выполнена: создано ${nextChecklist.length} подзадач`);
    } finally {
      setDecomposingTaskId(null);
    }
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
    return visibleTasks.filter((item) => {
      if (!item) return false;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || item.notes || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q);

      const matchesMyTasks =
        !onlyMyTasks ||
        (currentProfile &&
          (item.assigned_to === currentProfile.id || item.owner_node_id === currentProfile.id));

      const matchesPriority =
        priorityFilter === 'ALL' || (item.priority || 'Medium') === priorityFilter;

      return matchesQuery && matchesMyTasks && matchesPriority;
    });
  }, [visibleTasks, searchQuery, onlyMyTasks, currentProfile, priorityFilter]);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return safeNodes;
    return safeNodes.filter(
      (n) =>
        (n.name || '').toLowerCase().includes(q) ||
        (n.role_type || '').toLowerCase().includes(q) ||
        (n.department || '').toLowerCase().includes(q) ||
        (n.email || '').toLowerCase().includes(q) ||
        (n.invite_code || '').toLowerCase().includes(q)
    );
  }, [safeNodes, searchQuery]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleLeads;
    return visibleLeads.filter((l) => {
      const name = (l.client_name || l.full_name || '').toLowerCase();
      const title = (l.title || '').toLowerCase();
      const contact = (l.contact || l.phone || '').toLowerCase();
      const taxId = (l.tax_id || '').toLowerCase();
      const contractNo = (l.contract_number || '').toLowerCase();
      const dept = (l.department || '').toLowerCase();
      return (
        name.includes(q) ||
        title.includes(q) ||
        contact.includes(q) ||
        taxId.includes(q) ||
        contractNo.includes(q) ||
        dept.includes(q)
      );
    });
  }, [visibleLeads, searchQuery]);

  const completedTasksCount = useMemo(
    () => visibleTasks.filter((tItem) => tItem.status === 'Done').length,
    [visibleTasks]
  );

  const highPriorityOpenCount = useMemo(
    () =>
      visibleTasks.filter((tItem) => tItem.priority === 'High' && tItem.status !== 'Done').length,
    [visibleTasks]
  );

  const totalPipelineValue = useMemo(
    () =>
      visibleLeads
        .filter((l) => (l.status || l.stage) !== 'Lost')
        .reduce((acc, item) => acc + (Number(item.amount ?? item.deal_value) || 0), 0),
    [visibleLeads]
  );

  const wonPipelineValue = useMemo(
    () =>
      visibleLeads
        .filter((l) => (l.status || l.stage) === 'Won')
        .reduce((acc, item) => acc + (Number(item.amount ?? item.deal_value) || 0), 0),
    [visibleLeads]
  );

  // Active target for Slide-over Detail Drawer
  const activeDrawerTarget: DrawerTarget = useMemo(() => {
    if (!drawerSelection) return null;
    if (drawerSelection.kind === 'task') {
      const foundTask = visibleTasks.find((item) => item.id === drawerSelection.id);
      return foundTask ? { type: 'task', record: foundTask } : null;
    }
    const foundLead = visibleLeads.find((item) => item.id === drawerSelection.id);
    return foundLead ? { type: 'deal', record: foundLead } : null;
  }, [drawerSelection, visibleTasks, visibleLeads]);

  // Mutations
  const handleTaskUpdate = async (taskId: string, updates: Record<string, any>) => {
    if (!canCreateOrEditTasks) return;
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
    if (!perms.crm_edit) return;
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

  const handleSaveNodePermissionsMatrix = async (
    nodeId: string,
    accessLevel: AccessLevel,
    permissions: EmployeePermissions
  ) => {
    setBusyRecordId(nodeId);
    try {
      const res = await onPatchRecord('organization_nodes', nodeId, {
        access_level: accessLevel,
        permissions,
      });
      if (res.ok) {
        showToast(t('toast.permissionsUpdated'));
      }
    } finally {
      setBusyRecordId(null);
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    if (!profileName.trim()) return;

    setIsSavingProfile(true);
    try {
      const updates: Record<string, any> = {
        name: profileName.trim(),
        email: profileEmail.trim() || null,
      };
      if (perms.team_manage && profileRoleTitle.trim()) {
        updates.role_type = profileRoleTitle.trim();
        updates.department = profileDepartment.trim() || null;
      }

      const res = await onPatchRecord('organization_nodes', currentProfile.id, updates);
      if (res.ok) {
        showToast(t('profile.savedToast'));
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) {
      e.target.value = '';
    }
    if (!file || !currentProfile) return;

    setIsUploadingAvatar(true);
    try {
      const compressedDataUrl = await cropAndCompressAvatarToDataUrl(file);
      const res = await onPatchRecord('organization_nodes', currentProfile.id, {
        avatar_url: compressedDataUrl,
      });
      if (res.ok) {
        showToast('Фотография профиля обновлена');
      }
    } catch (err: any) {
      showToast(err?.message || 'Ошибка при обработке фотографии');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentProfile || !currentProfile.avatar_url) return;
    setIsUploadingAvatar(true);
    try {
      const res = await onPatchRecord('organization_nodes', currentProfile.id, {
        avatar_url: null,
      });
      if (res.ok) {
        showToast('Фотография профиля удалена');
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Send Corporate Message from Split-View Messenger (Инфополе и Связь)
  const submitCurrentCommMessage = async () => {
    const msgBody = commText.trim();
    if (!msgBody || !onSendMessage || isSendingComm) return;

    setIsSendingComm(true);
    try {
      let targetType: 'direct' | 'department' | 'broadcast' = 'broadcast';
      let targetId = 'general';
      let targetLabel = 'Циркуляр по компании';
      let recipientId: string | null = null;
      let targetDepartment: string | null = null;

      if (activeCommThread.type === 'direct') {
        const recipientNode = safeNodes.find(
          (n) => String(n.id) === String(activeCommThread.id)
        );
        targetType = 'direct';
        targetId = String(recipientNode?.id || activeCommThread.id);
        targetLabel = recipientNode?.name || activeCommThread.label;
        recipientId = targetId;
      } else if (activeCommThread.type === 'department') {
        targetType = 'department';
        targetId = activeCommThread.id;
        targetLabel = activeCommThread.label;
        targetDepartment = activeCommThread.id;
      }

      const payload: Record<string, any> = {
        company_id: companyId,
        sender_id: currentProfile?.id ? String(currentProfile.id) : null,
        sender_name: currentProfile?.name || 'Сотрудник TedCloud',
        sender_role: currentProfile?.role_type || '',
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        scope_type: targetType,
        recipient_id: recipientId,
        target_department: targetDepartment,
        message_text: msgBody,
        text: msgBody,
        is_urgent: commUrgent,
        is_read: false,
      };

      const res = await onSendMessage(payload);
      if (res.ok) {
        setCommText('');
        showToast(t('comm.sentToast'));
      }
    } finally {
      setIsSendingComm(false);
    }
  };

  const handleSendCorporateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCurrentCommMessage();
  };

  const handleConvertMessageToTask = (msg: WorkspaceMessageRecord) => {
    const bodyText = extractMessageText(msg);
    const firstLine = bodyText.split('\n')[0]?.trim() || 'Поручение из Инфополя';
    const taskTitle =
      firstLine.length > 72 ? `${firstLine.slice(0, 72).trim()}...` : firstLine;

    let defaultAssigneeId = currentProfile?.id || '';
    if (activeCommThread.type === 'direct') {
      defaultAssigneeId = activeCommThread.id;
    } else if (
      msg.sender_id &&
      String(msg.sender_id) !== String(currentProfile?.id || '')
    ) {
      defaultAssigneeId = String(msg.sender_id);
    } else if (
      msg.target_type === 'direct' &&
      msg.target_id &&
      String(msg.target_id) !== String(currentProfile?.id || '')
    ) {
      defaultAssigneeId = String(msg.target_id);
    }

    const assigneeNode = defaultAssigneeId ? nodeMap.get(defaultAssigneeId) : null;
    const resolvedDept =
      activeCommThread.type === 'department'
        ? activeCommThread.id
        : assigneeNode?.department || currentProfile?.department || '';

    setInitialTaskDraft({
      title: taskTitle,
      description: bodyText,
      assigned_to: defaultAssigneeId,
      department: resolvedDept,
      priority: msg.is_urgent ? 'High' : 'Medium',
    });
    setModalType('tasks');
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
          if (drawerSelection?.id === id) {
            setDrawerSelection(null);
          }
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
    if (!perms.data_export) return;
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
      [
        'ID',
        'Client',
        'Subject',
        'Jurisdiction',
        'Tax ID (INN / VAT)',
        'Reg Number (KPP / CRN)',
        'Contract / PO #',
        'Department',
        'Responsible Manager',
        `Amount (${currency})`,
        'Stage',
        'Contact',
        'Notes',
        'Created',
      ],
      visibleLeads.map((l) => {
        const managerId = l.assigned_to || l.owner_node_id;
        const manager = managerId ? nodeMap.get(managerId) : null;
        return [
          l.id,
          l.client_name || l.full_name || '',
          l.title || '',
          l.jurisdiction || 'RU',
          l.tax_id || '',
          l.reg_number || '',
          l.contract_number || '',
          l.department || '',
          manager ? `${manager.name} (${manager.role_type})` : '',
          Number(l.amount ?? l.deal_value ?? 0),
          l.status || l.stage || 'New',
          l.contact || l.phone || '',
          l.description || l.notes || '',
          l.created_at || '',
        ];
      })
    );
  };

  const handleExportTasksCsv = () => {
    downloadCsv(
      `tedcloud-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'ID',
        'Title',
        'Department',
        'Type',
        'Priority',
        'Status',
        'Assignee',
        'Position',
        'Notes',
        'Created',
      ],
      visibleTasks.map((task) => {
        const assignee = task.assigned_to ? nodeMap.get(task.assigned_to) : null;
        return [
          task.id,
          task.title,
          task.department || '',
          task.type || 'Task',
          task.priority || 'Medium',
          task.status || 'Todo',
          assignee ? assignee.name : '',
          assignee ? assignee.role_type : '',
          task.description || task.notes || '',
          task.created_at || '',
        ];
      })
    );
  };

  const handleExportTeamCsv = () => {
    downloadCsv(
      `tedcloud-team-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'ID',
        'Full Name',
        'Job Title',
        'Department',
        'Access Level',
        'Email',
        'Invite Code',
        'Telegram ID',
      ],
      safeNodes.map((n) => [
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

  // Single-language, non-wrapping badges
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

  const renderDueDateBadge = (dueDate?: string | null, status?: TaskStatus) => {
    if (!dueDate) return null;
    const raw = String(dueDate).slice(0, 10);
    if (!raw) return null;
    const todayIso = new Date().toISOString().slice(0, 10);
    const isOverdue = status !== 'Done' && raw < todayIso;
    const isToday = status !== 'Done' && raw === todayIso;
    let formatted = raw;
    try {
      const [y, m, d] = raw.split('-').map(Number);
      if (y && m && d) {
        formatted = new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        });
      }
    } catch {}

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium tabular-nums border whitespace-nowrap ${
          isOverdue
            ? 'bg-red-500/15 text-red-300 border-red-500/30'
            : isToday
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : 'bg-zinc-900/90 text-zinc-400 border-white/[0.08]'
        }`}
      >
        <Calendar className="w-3 h-3 shrink-0" />
        <span>Срок: {formatted}</span>
      </span>
    );
  };

  // БЛОК 2: Конструктор отделов компании («Структура подразделений (Отделы)»)
  const renderDepartmentConstructorCard = () => (
    <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
              {t('dept.cardTitle')}
            </h3>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">{t('dept.cardSubtitle')}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddDepartment();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder={t('dept.inputPlaceholder')}
            className="w-full sm:w-64 rounded-lg border border-[#262626] bg-[#17171A] px-3 py-1.5 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newDeptName.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('dept.addBtn')}</span>
          </button>
        </form>
      </div>

      {companyDepartments.length === 0 ? (
        <div className="text-xs text-[#71717A] py-2">{t('dept.empty')}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {companyDepartments.map((dept) => {
            const deptMembersCount = safeNodes.filter(
              (n) => (n.department || '').toLowerCase() === dept.toLowerCase()
            ).length;
            return (
              <div
                key={dept}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#262629] bg-[#16161A] text-xs text-white"
              >
                <span className="font-medium">{dept}</span>
                <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#222226] px-1.5 py-0.5 rounded">
                  {deptMembersCount}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRemoveDepartment(dept)}
                  className="text-[#71717A] hover:text-red-400 transition-colors"
                  aria-label="Удалить отдел"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Language & Currency Selector Card
  const renderLocalizationCard = () => (
    <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Globe className="w-4 h-4 text-[#A1A1AA]" />
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            {t('profile.preferencesTitle')}
          </h3>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('profile.preferencesSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-medium text-[#8E8E93] mb-1.5">
            {t('profile.interfaceLang')}
          </label>
          <div className="inline-flex w-full rounded-lg border border-[#262626] bg-[#161618] p-0.5">
            {(['ru', 'en'] as LanguageCode[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold uppercase transition-colors ${
                  language === lang
                    ? 'bg-white text-black'
                    : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#8E8E93] mb-1.5">
            {t('profile.displayCurrency')}
          </label>
          <div className="inline-flex w-full rounded-lg border border-[#262626] bg-[#161618] p-0.5">
            {(['RUB', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setCurrency(curr)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  currency === curr
                    ? 'bg-white text-black'
                    : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[#09090B] text-[#EDEDED] flex font-sans antialiased"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 40% at 50% -15%, rgba(99,102,241,0.10), transparent)',
      }}
    >
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentProfile={currentProfile}
        counts={{
          tasks: visibleTasks.length,
          nodes: safeNodes.length,
          leads: visibleLeads.length,
          messages: visibleMessages.length,
        }}
        onRequestSignOut={onResetSession ? requestSignOut : undefined}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          companyName={companyName}
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={
            !perms.crm_view && !perms.team_manage
              ? language === 'en'
                ? 'Search tasks and messages...'
                : 'Поиск по задачам и сообщениям...'
              : t('actions.searchPlaceholder')
          }
          isSyncing={isSyncing}
          onRefresh={onRefresh}
          onOpenCommandBar={() => setIsCommandBarOpen(true)}
          onOpenAiCopilot={() => setIsAiDrawerOpen(true)}
        />

        {toastBanner && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-white/15 bg-zinc-900/90 px-4 py-2.5 text-xs text-zinc-200 shadow-lg">
            <div className="flex items-center gap-2">
              <BellRing className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{toastBanner}</span>
            </div>
            <button
              onClick={() => setToastBanner(null)}
              className="text-zinc-400 hover:text-white text-[11px] font-semibold"
            >
              OK
            </button>
          </div>
        )}

        <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Page Header & Contextual Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                {activeSection === 'overview' && t('header.overviewTitle')}
                {activeSection === 'tasks' && t('header.tasksTitle')}
                {activeSection === 'crm' && t('header.crmTitle')}
                {activeSection === 'communications' && t('header.communicationsTitle')}
                {activeSection === 'team' && t('header.teamTitle')}
                {activeSection === 'profile' && t('header.profileTitle')}
                {activeSection === 'workspace' && t('header.workspaceTitle')}
              </h1>
              <p className="text-xs text-[#8E8E93] mt-1">
                {activeSection === 'overview' && t('header.overviewSubtitle')}
                {activeSection === 'tasks' && t('header.tasksSubtitle')}
                {activeSection === 'crm' && t('header.crmSubtitle')}
                {activeSection === 'communications' && t('header.communicationsSubtitle')}
                {activeSection === 'team' && t('header.teamSubtitle')}
                {activeSection === 'profile' &&
                  (language === 'en'
                    ? 'Personal details, profile photo, Telegram synchronization, and active workspace capabilities'
                    : 'Персональные реквизиты, фотография профиля, синхронизация с Telegram и рабочий контур')}
                {activeSection === 'workspace' && t('header.workspaceSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Switcher: Стандартный вид / Карта связей (Teamwork Graph) on Overview */}
              {activeSection === 'overview' && (
                <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#141418] p-0.5">
                  <button
                    type="button"
                    onClick={() => setOverviewViewMode('standard')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      overviewViewMode === 'standard'
                        ? 'bg-zinc-800 text-white border border-white/10'
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Обзор</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewViewMode('graph')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      overviewViewMode === 'graph'
                        ? 'bg-zinc-800 text-white border border-white/10'
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Карта связей (Teamwork Graph)</span>
                  </button>
                </div>
              )}

              {/* Switcher: Таблица штата / Карта связей (Teamwork Graph) on Team */}
              {activeSection === 'team' && perms.team_manage && (
                <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#141418] p-0.5">
                  <button
                    type="button"
                    onClick={() => setTeamViewMode('table')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      teamViewMode === 'table'
                        ? 'bg-zinc-800 text-white border border-white/10'
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Реестр штата</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamViewMode('graph')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      teamViewMode === 'graph'
                        ? 'bg-zinc-800 text-white border border-white/10'
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Карта связей (Teamwork Graph)</span>
                  </button>
                </div>
              )}

              {(activeSection === 'overview' || activeSection === 'tasks') &&
                canCreateOrEditTasks && (
                  <button
                    onClick={() => setModalType('tasks')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('actions.newTask').replace(/^\+\s*/, '')}</span>
                  </button>
                )}

              {activeSection === 'crm' && perms.crm_edit && (
                <button
                  onClick={() => setModalType('crm_leads')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('actions.newDeal').replace(/^\+\s*/, '')}</span>
                </button>
              )}

              {activeSection === 'team' && perms.team_manage && (
                <button
                  onClick={() => setModalType('organization_nodes')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('actions.newEmployee').replace(/^\+\s*/, '')}</span>
                </button>
              )}
            </div>
          </div>

          {/* =================================================================
              TAB 1: ДАШБОРД / OVERVIEW
          ================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {overviewViewMode === 'graph' ? (
                <TeamworkGraphView
                  companyName={companyName}
                  departments={companyDepartments}
                  nodes={safeNodes}
                  tasks={visibleTasks}
                  leads={visibleLeads}
                  canViewCrm={perms.crm_view}
                  onSelectTask={(taskId) => setDrawerSelection({ kind: 'task', id: taskId })}
                  onSelectLead={(leadId) => setDrawerSelection({ kind: 'lead', id: leadId })}
                />
              ) : (
                <>
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
                        {safeNodes.length}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-1">
                        {t('kpi.telegramConnected')}:{' '}
                        {safeNodes.filter((n) => Boolean(n.telegram_chat_id)).length}
                      </div>
                    </div>

                    {perms.crm_view ? (
                      <>
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
                            {visibleLeads.filter((l) => (l.status || l.stage) === 'Won').length} /{' '}
                            {visibleLeads.length}
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
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-4">
                          <div className="flex items-center justify-between text-[#8E8E93] mb-3">
                            <span className="text-xs font-medium">Срочные поручения</span>
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="text-2xl font-semibold text-white tracking-tight">
                            {highPriorityOpenCount}
                          </div>
                          <div className="text-[11px] text-[#71717A] mt-1">
                            В работе сейчас:{' '}
                            {visibleTasks.filter((tItem) => tItem.status === 'In Progress').length}
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-4">
                          <div className="flex items-center justify-between text-[#8E8E93] mb-3">
                            <span className="text-xs font-medium">Инфополе и сообщения</span>
                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="text-2xl font-semibold text-white tracking-tight">
                            {visibleMessages.length}
                          </div>
                          <div className="text-[11px] text-emerald-400/90 mt-1">
                            <button
                              type="button"
                              onClick={() => setActiveSection('communications')}
                              className="hover:underline"
                            >
                              Открыть корпоративный чат →
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Персональная сводка продуктивности для сотрудников без доступа к CRM (!perms.crm_view) */}
                  {!perms.crm_view && (
                    <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F1F1F] pb-3.5">
                        <div>
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                            Персональная сводка продуктивности
                          </h2>
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            Ваши активные задачи, срочные поручения и последние сообщения из корпоративного инфополя
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveSection('tasks')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Перейти к задачам</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSection('communications')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#17171A] hover:bg-[#222226] text-xs font-medium text-white transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Инфополе</span>
                          </button>
                        </div>
                      </div>

                      {visibleMessages.length === 0 ? (
                        <div className="text-xs text-[#71717A] py-2">
                          В вашем инфополе пока нет новых сообщений.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {visibleMessages.slice(0, 3).map((msg) => {
                            const senderNode = msg.sender_id
                              ? nodeMap.get(String(msg.sender_id))
                              : null;
                            const sName =
                              senderNode?.name || msg.sender_name || 'Сотрудник TedCloud';
                            const sBody = extractMessageText(msg);
                            return (
                              <div
                                key={msg.id}
                                onClick={() => setActiveSection('communications')}
                                className="rounded-lg border border-[#222226] bg-[#151518] p-3 space-y-2 hover:border-[#3F3F46] transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <UserAvatar
                                      name={sName}
                                      avatarUrl={senderNode?.avatar_url}
                                      size="xs"
                                    />
                                    <span className="text-xs font-semibold text-white truncate">
                                      {sName}
                                    </span>
                                  </div>
                                  {msg.is_urgent && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                                      Срочно
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#D4D4D8] line-clamp-2 leading-relaxed">
                                  {sBody}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Сводка активных задач на Дашборде */}
                  <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#1F1F1F] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#A1A1AA]" />
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                          {t('tasks.sectionTitle')}
                        </h2>
                        <span className="text-[11px] font-medium text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                          {visibleTasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveSection('tasks')}
                        className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                      >
                        {t('nav.tasks')}
                      </button>
                    </div>

                    {visibleTasks.length === 0 ? (
                      <div className="p-10 text-center space-y-3">
                        <div className="text-sm font-medium text-white">{t('tasks.emptyTitle')}</div>
                        <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('tasks.empty')}</p>
                        {canCreateOrEditTasks && (
                          <button
                            onClick={() => setModalType('tasks')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('tasks.addBtn')}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1A1A1C]">
                        {visibleTasks.slice(0, 8).map((task) => {
                          const assignee = task.assigned_to ? nodeMap.get(task.assigned_to) : null;
                          const checklist = Array.isArray(task.checklist) ? task.checklist : [];
                          const doneSubtasks = checklist.filter((c) => c.done).length;
                          const isDecomposing = decomposingTaskId === task.id;

                          return (
                            <div
                              key={task.id}
                              onClick={() => setDrawerSelection({ kind: 'task', id: task.id })}
                              className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#161618] transition-colors cursor-pointer"
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
                                    {renderDueDateBadge(task.due_date, task.status)}
                                    {task.department && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[11px] text-[#D4D4D8]">
                                        {task.department}
                                      </span>
                                    )}
                                    {checklist.length > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[11px] tabular-nums text-zinc-300">
                                        <ListChecks className="w-3 h-3 text-indigo-400" />
                                        <span>
                                          {doneSubtasks}/{checklist.length}
                                        </span>
                                      </span>
                                    )}
                                    {assignee ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                                        <UserAvatar
                                          name={assignee.name}
                                          avatarUrl={assignee.avatar_url}
                                          size="xs"
                                        />
                                        <span>
                                          {assignee.name} ({assignee.role_type})
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-[#71717A]">
                                        {t('tasks.unassigned')}
                                      </span>
                                    )}
                                    {(task.description || task.notes) && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-[#71717A]">
                                        <FileText className="w-3 h-3" />
                                        <span>{t('drawer.openDetails')}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-2 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {canCreateOrEditTasks && (
                                    <button
                                      type="button"
                                      disabled={isDecomposing}
                                      onClick={(e) => void handleQuickAiDecomposeTask(task, e)}
                                      title="ИИ-декомпозиция задачи на чек-лист подзадач"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors whitespace-nowrap"
                                    >
                                      {isDecomposing ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Cpu className="w-3 h-3 text-indigo-400" />
                                      )}
                                      <span>ИИ-декомпозиция</span>
                                    </button>
                                  )}

                                  <select
                                    disabled={!canCreateOrEditTasks}
                                    value={task.status || 'Todo'}
                                    onChange={(e) =>
                                      handleTaskUpdate(task.id, {
                                        status: e.target.value as TaskStatus,
                                      })
                                    }
                                    className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none disabled:opacity-50"
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
                  </>
                )}
              </div>
            )}

            {/* =================================================================
                TAB 2: ЗАДАЧИ / TASKS (БЛОК 4: Полноценная Канбан-доска + Сроки due_date)
            ================================================================== */}
            {activeSection === 'tasks' && (
              <section className="rounded-xl border border-white/[0.07] bg-[#111114] overflow-hidden shadow-2xl">
                <div className="px-5 py-3.5 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#A1A1AA]" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                      {t('tasks.sectionTitle')}
                    </h2>
                    <span className="text-[11px] font-medium tabular-nums text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                      {filteredTasks.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {perms.tasks_view_all && (
                      <button
                        onClick={() => setOnlyMyTasks((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                          onlyMyTasks
                            ? 'bg-white text-black border-white'
                            : 'bg-[#161618] text-[#A1A1AA] border-white/10 hover:text-white'
                        }`}
                      >
                        {t('tasks.myTasks')}
                      </button>
                    )}

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'ALL')}
                      className="rounded-md border border-white/10 bg-[#161618] px-2.5 py-1 text-xs text-[#D4D4D8] focus:outline-none"
                    >
                      <option value="ALL">{t('tasks.allPriorities')}</option>
                      <option value="High">{t('priority.High')}</option>
                      <option value="Medium">{t('priority.Medium')}</option>
                      <option value="Low">{t('priority.Low')}</option>
                    </select>

                    {perms.data_export && (
                      <button
                        onClick={handleExportTasksCsv}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 bg-[#161618] text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    )}

                    <div className="inline-flex rounded-lg border border-white/10 bg-[#16161A] p-0.5">
                      <button
                        type="button"
                        onClick={() => setTaskViewMode('list')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                          taskViewMode === 'list'
                            ? 'bg-zinc-800 text-white border border-white/10'
                            : 'text-[#8E8E93] hover:text-white'
                        }`}
                      >
                        <LayoutList className="w-3.5 h-3.5" />
                        <span>Список</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskViewMode('board')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                          taskViewMode === 'board'
                            ? 'bg-zinc-800 text-white border border-white/10'
                            : 'text-[#8E8E93] hover:text-white'
                        }`}
                      >
                        <Columns3 className="w-3.5 h-3.5" />
                        <span>Канбан-доска</span>
                      </button>
                    </div>
                  </div>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="text-sm font-medium text-white">{t('tasks.emptyTitle')}</div>
                    <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('tasks.empty')}</p>
                    {canCreateOrEditTasks && (
                      <button
                        onClick={() => setModalType('tasks')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('tasks.addBtn')}</span>
                      </button>
                    )}
                  </div>
                ) : taskViewMode === 'list' ? (
                  <div className="divide-y divide-[#1A1A1C]">
                    {filteredTasks.map((task) => {
                      const isBusy = busyRecordId === task.id;
                      const assignee = task.assigned_to ? nodeMap.get(task.assigned_to) : null;
                      const checklist = Array.isArray(task.checklist) ? task.checklist : [];
                      const doneSubtasks = checklist.filter((c) => c.done).length;
                      const isDecomposing = decomposingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          onClick={() => setDrawerSelection({ kind: 'task', id: task.id })}
                          className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#16161A] transition-colors cursor-pointer"
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <button
                              type="button"
                              disabled={isBusy || !canCreateOrEditTasks}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTaskUpdate(task.id, {
                                  status: task.status === 'Done' ? 'Todo' : 'Done',
                                });
                              }}
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
                                {renderDueDateBadge(task.due_date, task.status)}
                                {task.department && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[11px] text-[#D4D4D8] whitespace-nowrap">
                                    {task.department}
                                  </span>
                                )}
                                {checklist.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[11px] tabular-nums text-zinc-300">
                                    <ListChecks className="w-3 h-3 text-indigo-400" />
                                    <span>
                                      {doneSubtasks}/{checklist.length}
                                    </span>
                                  </span>
                                )}
                                {assignee && (
                                  <span className="inline-flex items-center gap-1.5 text-xs text-[#8E8E93]">
                                    <UserAvatar
                                      name={assignee.name}
                                      avatarUrl={assignee.avatar_url}
                                      size="xs"
                                    />
                                    <strong className="text-[#D4D4D8] font-medium">
                                      {assignee.name} ({assignee.role_type})
                                    </strong>
                                  </span>
                                )}
                                {(task.description || task.notes) && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#71717A]">
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate max-w-[200px]">
                                      {task.description || task.notes}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canCreateOrEditTasks && (
                              <button
                                type="button"
                                disabled={isDecomposing}
                                onClick={(e) => void handleQuickAiDecomposeTask(task, e)}
                                title="ИИ-декомпозиция задачи на чек-лист подзадач"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors whitespace-nowrap"
                              >
                                {isDecomposing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Cpu className="w-3 h-3 text-indigo-400" />
                                )}
                                <span>ИИ-декомпозиция</span>
                              </button>
                            )}

                            {perms.tasks_assign && (
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
                                {safeNodes.map((node) => (
                                  <option key={node.id} value={node.id}>
                                    {node.name} — {node.role_type}
                                  </option>
                                ))}
                              </select>
                            )}

                            <select
                              disabled={isBusy || !canCreateOrEditTasks}
                              value={task.priority || 'Medium'}
                              onChange={(e) =>
                                handleTaskUpdate(task.id, {
                                  priority: e.target.value as TaskPriority,
                                })
                              }
                              className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none disabled:opacity-50"
                            >
                              <option value="Low">{t('priority.Low')}</option>
                              <option value="Medium">{t('priority.Medium')}</option>
                              <option value="High">{t('priority.High')}</option>
                            </select>

                            <select
                              disabled={isBusy || !canCreateOrEditTasks}
                              value={task.status || 'Todo'}
                              onChange={(e) =>
                                handleTaskUpdate(task.id, {
                                  status: e.target.value as TaskStatus,
                                })
                              }
                              className="rounded-md border border-[#262626] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none disabled:opacity-50"
                            >
                              <option value="Todo">{t('status.Todo')}</option>
                              <option value="In Progress">{t('status.In Progress')}</option>
                              <option value="Done">{t('status.Done')}</option>
                            </select>

                            {canCreateOrEditTasks && (
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
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {(['Todo', 'In Progress', 'Done'] as TaskStatus[]).map((columnStatus) => {
                      const colTasks = filteredTasks.filter(
                        (tItem) => (tItem.status || 'Todo') === columnStatus
                      );
                      return (
                        <div
                          key={columnStatus}
                          className="rounded-xl border border-white/[0.07] bg-[#0D0D10] p-3.5 flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between px-1 pb-1 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  columnStatus === 'Done'
                                    ? 'bg-emerald-400'
                                    : columnStatus === 'In Progress'
                                    ? 'bg-indigo-400'
                                    : 'bg-zinc-500'
                                }`}
                              />
                              <span className="text-xs font-semibold text-white">
                                {t(`status.${columnStatus}`)}
                              </span>
                            </div>
                            <span className="text-xs font-medium tabular-nums text-zinc-400 bg-zinc-900 border border-white/[0.07] px-2 py-0.5 rounded">
                              {colTasks.length}
                            </span>
                          </div>

                          {colTasks.length === 0 ? (
                            <div className="py-10 text-center text-xs text-zinc-600 border border-dashed border-white/[0.06] rounded-lg">
                              Нет задач в колонке
                            </div>
                          ) : (
                            colTasks.map((task) => {
                              const assignee = task.assigned_to
                                ? nodeMap.get(task.assigned_to)
                                : null;
                              const checklist = Array.isArray(task.checklist)
                                ? task.checklist
                                : [];
                              const doneSubtasks = checklist.filter((c) => c.done).length;
                              const progressPct =
                                checklist.length > 0
                                  ? Math.round((doneSubtasks / checklist.length) * 100)
                                  : 0;

                              return (
                                <div
                                  key={task.id}
                                  onClick={() => setDrawerSelection({ kind: 'task', id: task.id })}
                                  className="rounded-xl border border-white/[0.08] bg-[#141418] p-3.5 space-y-3 hover:border-white/25 transition-colors cursor-pointer shadow-lg"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-semibold text-white leading-snug">
                                      {task.title}
                                    </p>
                                    {canCreateOrEditTasks && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          requestDeleteRecord('tasks', task.id, task.title);
                                        }}
                                        className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {renderPriorityBadge(task.priority)}
                                    {renderDueDateBadge(task.due_date, task.status)}
                                    {task.department && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.08] text-[10px] text-zinc-300">
                                        {task.department}
                                      </span>
                                    )}
                                  </div>

                                  {checklist.length > 0 && (
                                    <div className="space-y-1.5 pt-0.5">
                                      <div className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
                                        <span className="inline-flex items-center gap-1">
                                          <ListChecks className="w-3 h-3 text-indigo-400" />
                                          <span>Чек-лист</span>
                                        </span>
                                        <span>
                                          {doneSubtasks}/{checklist.length} ({progressPct}%)
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-500 transition-all duration-200"
                                          style={{ width: `${progressPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-2 pt-0.5">
                                    {assignee ? (
                                      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300 truncate">
                                        <UserAvatar
                                          name={assignee.name}
                                          avatarUrl={assignee.avatar_url}
                                          size="xs"
                                        />
                                        <span className="truncate font-medium">{assignee.name}</span>
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-zinc-500 truncate">
                                        {t('tasks.unassigned')}
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    className="pt-2 flex items-center justify-between gap-1.5 border-t border-white/[0.06]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {(['Todo', 'In Progress', 'Done'] as TaskStatus[]).map((st) => (
                                      <button
                                        key={st}
                                        disabled={!canCreateOrEditTasks}
                                        onClick={() => handleTaskUpdate(task.id, { status: st })}
                                        className={`flex-1 py-1 rounded-md text-[11px] transition-colors whitespace-nowrap ${
                                          (task.status || 'Todo') === st
                                            ? 'bg-white text-black font-semibold'
                                            : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.06]'
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
              TAB 3: СДЕЛКИ / CRM DEALS (БЛОК 3: ИНН/КПП/VAT, Договор, Отдел, Менеджер)
          ================================================================== */}
          {activeSection === 'crm' && perms.crm_view && (
            <section className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-[#A1A1AA]" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                    {t('crm.sectionTitle')}
                  </h2>
                  <span className="text-[11px] font-medium text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded whitespace-nowrap tabular-nums">
                    {filteredLeads.length}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Переключатель режима отображения: Воронка (Канбан) | Реестр (Таблица) */}
                  <div className="inline-flex items-center rounded-lg border border-white/[0.07] bg-[#0B0B0E] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCrmViewMode('board')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        crmViewMode === 'board'
                          ? 'bg-white text-black'
                          : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      <Columns3 className="w-3.5 h-3.5" />
                      <span>Воронка (Канбан)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrmViewMode('table')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        crmViewMode === 'table'
                          ? 'bg-white text-black'
                          : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span>Реестр (Таблица)</span>
                    </button>
                  </div>

                  {/* Компактный переключатель валюты расчетов для сотрудников с доступом crm_view */}
                  <div
                    className="inline-flex items-center rounded-lg border border-white/[0.07] bg-[#0B0B0E] p-0.5"
                    aria-label="Currency switcher"
                  >
                    {(['RUB', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setCurrency(curr)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                          currency === curr
                            ? 'bg-white text-black'
                            : 'text-[#8E8E93] hover:text-white'
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>

                  {perms.data_export && (
                    <button
                      onClick={handleExportDealsCsv}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-sm font-medium text-white">{t('crm.emptyTitle')}</div>
                  <p className="text-xs text-[#71717A] max-w-md mx-auto">{t('crm.empty')}</p>
                  {perms.crm_edit && (
                    <button
                      onClick={() => setModalType('crm_leads')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('crm.addBtn')}</span>
                    </button>
                  )}
                </div>
              ) : crmViewMode === 'board' ? (
                /* 4 колонки стадий воронки CRM с автоподсчетом суммы в шапке каждой колонки */
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(
                    [
                      { status: 'New' as CrmLeadStatus, label: t('stage.New'), dot: 'bg-zinc-400' },
                      {
                        status: 'Negotiation' as CrmLeadStatus,
                        label: t('stage.Negotiation'),
                        dot: 'bg-indigo-400',
                      },
                      { status: 'Won' as CrmLeadStatus, label: t('stage.Won'), dot: 'bg-emerald-400' },
                      { status: 'Lost' as CrmLeadStatus, label: t('stage.Lost'), dot: 'bg-zinc-600' },
                    ]
                  ).map((col) => {
                    const colLeads = filteredLeads.filter(
                      (lead) => (lead.status || lead.stage || 'New') === col.status
                    );
                    const colTotal = colLeads.reduce(
                      (sum, lead) => sum + Number(lead.amount ?? lead.deal_value ?? 0),
                      0
                    );

                    return (
                      <div
                        key={col.status}
                        className="rounded-xl border border-white/[0.07] bg-[#0B0B0E] p-3.5 flex flex-col min-h-[340px]"
                      >
                        <div className="pb-3 mb-3 border-b border-white/[0.06] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                                {col.label}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded tabular-nums">
                              {colLeads.length}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-[#E4E4E7] tabular-nums">
                            {formatMoney(colTotal)}
                          </div>
                        </div>

                        <div className="space-y-2.5 flex-1">
                          {colLeads.length === 0 ? (
                            <div className="py-10 text-center text-xs text-[#52525B]">
                              Нет сделок на стадии
                            </div>
                          ) : (
                            colLeads.map((lead) => {
                              const displayName =
                                lead.client_name || lead.full_name || lead.title || '';
                              const displayValue = Number(lead.amount ?? lead.deal_value ?? 0);
                              const managerId = lead.assigned_to || lead.owner_node_id;
                              const manager = managerId ? nodeMap.get(managerId) : null;

                              return (
                                <div
                                  key={lead.id}
                                  onClick={() => setDrawerSelection({ kind: 'lead', id: lead.id })}
                                  className="rounded-lg border border-white/[0.07] bg-[#131317] hover:border-white/[0.18] p-3.5 space-y-2.5 transition-all cursor-pointer group"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-xs font-medium text-white group-hover:text-zinc-100 leading-snug">
                                      {displayName}
                                    </div>
                                    <div className="text-xs font-semibold text-white whitespace-nowrap tabular-nums">
                                      {formatMoney(displayValue)}
                                    </div>
                                  </div>

                                  {lead.contract_number && (
                                    <div className="text-[11px] text-[#A1A1AA] tabular-nums">
                                      Договор № {lead.contract_number}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.05]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {manager ? (
                                        <>
                                          <UserAvatar
                                            name={manager.name}
                                            avatarUrl={manager.avatar_url}
                                            size="xs"
                                          />
                                          <span className="text-[11px] text-[#A1A1AA] truncate">
                                            {manager.name}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#71717A]">
                                          {t('tasks.unassigned')}
                                        </span>
                                      )}
                                    </div>

                                    {lead.department && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[10px] text-[#D4D4D8] truncate max-w-[110px]">
                                        {lead.department}
                                      </span>
                                    )}
                                  </div>

                                  {perms.crm_edit && (
                                    <div
                                      className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {(['New', 'Negotiation', 'Won', 'Lost'] as CrmLeadStatus[])
                                        .filter((s) => s !== col.status)
                                        .map((targetStage) => (
                                          <button
                                            key={targetStage}
                                            type="button"
                                            onClick={() => handleLeadStatusChange(lead, targetStage)}
                                            className="flex-1 py-1 px-1.5 rounded bg-white/[0.03] hover:bg-white/[0.09] border border-white/[0.06] text-[10px] font-medium text-[#A1A1AA] hover:text-white transition-colors truncate"
                                          >
                                            → {t(`stage.${targetStage}` as any)}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.07] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                        <th className="py-3 px-5">{t('crm.colClient')}</th>
                        <th className="py-3 px-5">{t('crm.colRequisites')}</th>
                        <th className="py-3 px-5">{t('crm.colAssigneeDept')}</th>
                        <th className="py-3 px-5">{t('crm.colContact')}</th>
                        <th className="py-3 px-5">{t('crm.colStage')}</th>
                        <th className="py-3 px-5 text-right">{t('crm.colAmount')}</th>
                        {perms.crm_edit && (
                          <th className="py-3 px-5 text-right">{t('crm.colControl')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05] text-xs">
                      {filteredLeads.map((lead) => {
                        const displayName =
                          lead.client_name || lead.full_name || lead.title || '';
                        const displayContact = lead.contact || lead.phone || '—';
                        const displayStatus = (lead.status || lead.stage || 'New') as CrmLeadStatus;
                        const displayValue = Number(lead.amount ?? lead.deal_value ?? 0);
                        const managerId = lead.assigned_to || lead.owner_node_id;
                        const manager = managerId ? nodeMap.get(managerId) : null;
                        const isGlobal = lead.jurisdiction === 'GLOBAL';

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => setDrawerSelection({ kind: 'lead', id: lead.id })}
                            className="hover:bg-[#16161A] transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-5">
                              <div className="font-medium text-white">{displayName}</div>
                              {lead.title && lead.title !== displayName && (
                                <div className="text-[11px] text-[#71717A]">{lead.title}</div>
                              )}
                              {(lead.description || lead.notes) && (
                                <div className="text-[11px] text-[#71717A] mt-0.5 truncate max-w-xs">
                                  {lead.description || lead.notes}
                                </div>
                              )}
                            </td>

                            {/* Юридические реквизиты контрагента и номер договора */}
                            <td className="py-3.5 px-5">
                              {lead.tax_id || lead.contract_number || lead.reg_number ? (
                                <div className="space-y-0.5">
                                  {lead.tax_id && (
                                    <div className="text-white tabular-nums text-[11px]">
                                      <span className="text-[#71717A]">
                                        {isGlobal ? 'VAT/Tax:' : 'ИНН:'}
                                      </span>{' '}
                                      {lead.tax_id}
                                      {lead.reg_number ? ` · ${lead.reg_number}` : ''}
                                    </div>
                                  )}
                                  {lead.contract_number && (
                                    <div className="text-[11px] text-[#A1A1AA] tabular-nums">
                                      № {lead.contract_number}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#52525B]">—</span>
                              )}
                            </td>

                            {/* Ответственный менеджер и Профильный отдел */}
                            <td className="py-3.5 px-5">
                              <div className="space-y-1">
                                {manager ? (
                                  <div className="text-white font-medium truncate max-w-[180px]">
                                    {manager.name}
                                  </div>
                                ) : (
                                  <div className="text-[#71717A]">{t('tasks.unassigned')}</div>
                                )}
                                {lead.department && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[10px] text-[#D4D4D8] whitespace-nowrap">
                                    {lead.department}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-5 text-[#A1A1AA] tabular-nums">
                              <span className="inline-flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-[#71717A]" />
                                {displayContact}
                              </span>
                            </td>
                            <td className="py-3.5 px-5">{renderLeadStatusBadge(displayStatus)}</td>
                            <td className="py-3.5 px-5 text-right text-white font-semibold whitespace-nowrap tabular-nums">
                              {formatMoney(displayValue)}
                            </td>
                            {perms.crm_edit && (
                              <td
                                className="py-3.5 px-5 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-2">
                                  <select
                                    value={displayStatus}
                                    onChange={(e) =>
                                      handleLeadStatusChange(lead, e.target.value as CrmLeadStatus)
                                    }
                                    className="rounded-md border border-white/[0.08] bg-[#18181B] px-2.5 py-1 text-xs text-[#D4D4D8] focus:border-[#52525B] focus:outline-none"
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
                            )}
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
              TAB 4: ИНФОПОЛЕ И СВЯЗЬ / SPLIT-VIEW CORPORATE MESSENGER
          ================================================================== */}
          {activeSection === 'communications' && (
            <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] overflow-hidden flex flex-col lg:flex-row min-h-[640px]">
              {/* ЛЕВАЯ ПАНЕЛЬ (Ширина 300px на десктопе): Каналы и Личные диалоги */}
              <aside className="w-full lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#1F1F1F] bg-[#0D0D0F] flex flex-col">
                <div className="px-4 py-3.5 border-b border-[#1F1F1F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                      Каналы и Диалоги
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-5">
                  {/* Блок 1: Корпоративные каналы */}
                  <div className="space-y-1">
                    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                      Корпоративные каналы
                    </div>

                    {/* Общий поток (Циркуляры компании) */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveCommThread({
                          type: 'broadcast',
                          id: 'general',
                          label: 'Общий поток (Циркуляры компании)',
                        })
                      }
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        activeCommThread.type === 'broadcast'
                          ? 'bg-[#1C1C21] text-white border border-[#2E2E36]'
                          : 'text-[#A1A1AA] hover:bg-[#151518] hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-medium truncate">
                          Общий поток (Циркуляры компании)
                        </span>
                      </div>
                      <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#18181C] px-1.5 py-0.5 rounded shrink-0">
                        {broadcastMessagesCount}
                      </span>
                    </button>

                    {/* Список отделов компании */}
                    {companyDepartments.map((dept) => {
                      const isSelected =
                        activeCommThread.type === 'department' &&
                        activeCommThread.id.toLowerCase() === dept.toLowerCase();
                      const deptMsgCount = filterMessagesForActiveThread(
                        visibleMessages,
                        { type: 'department', id: dept, label: dept },
                        currentProfile
                      ).length;

                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() =>
                            setActiveCommThread({
                              type: 'department',
                              id: dept,
                              label: dept,
                            })
                          }
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'bg-[#1C1C21] text-white border border-[#2E2E36]'
                              : 'text-[#A1A1AA] hover:bg-[#151518] hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Hash className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                            <span className="text-xs font-medium truncate">{dept}</span>
                          </div>
                          <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#18181C] px-1.5 py-0.5 rounded shrink-0">
                            {deptMsgCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Блок 2: Личные диалоги (Сотрудники) */}
                  <div className="space-y-1">
                    <div className="px-2 pb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                        Личные диалоги (Сотрудники)
                      </span>
                      <span className="text-[10px] tabular-nums text-[#71717A]">
                        {colleagueNodes.length}
                      </span>
                    </div>

                    {colleagueNodes.length === 0 ? (
                      <div className="px-2.5 py-3 rounded-lg border border-[#1C1C1F] bg-[#121215] text-[11px] text-[#71717A]">
                        В штате пока нет других сотрудников для личного диалога.
                      </div>
                    ) : (
                      colleagueNodes.map((colleague) => {
                        const isSelected =
                          activeCommThread.type === 'direct' &&
                          String(activeCommThread.id) === String(colleague.id);
                        const hasTelegram = Boolean(colleague.telegram_chat_id);
                        const dialogCount = currentProfile
                          ? visibleMessages.filter((m) =>
                              isDirectMessageBetweenUsers(
                                m,
                                currentProfile.id,
                                currentProfile.name,
                                colleague.id,
                                colleague.name
                              )
                            ).length
                          : 0;

                        return (
                          <button
                            key={colleague.id}
                            type="button"
                            onClick={() =>
                              setActiveCommThread({
                                type: 'direct',
                                id: String(colleague.id),
                                label: colleague.name,
                                subtitle: colleague.role_type,
                                telegramConnected: hasTelegram,
                              })
                            }
                            className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'bg-[#1C1C21] text-white border border-[#2E2E36]'
                                : 'text-[#A1A1AA] hover:bg-[#151518] hover:text-white border border-transparent'
                            }`}
                          >
                            <UserAvatar
                              name={colleague.name}
                              avatarUrl={colleague.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-white truncate">
                                  {colleague.name}
                                </span>
                                {hasTelegram && (
                                  <span
                                    title="Telegram подключен"
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0"
                                  >
                                    TG
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#71717A] truncate">
                                {colleague.role_type}
                                {colleague.department ? ` · ${colleague.department}` : ''}
                              </div>
                            </div>

                            <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#18181C] px-1.5 py-0.5 rounded shrink-0">
                              {dialogCount}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </aside>

              {/* ПРАВАЯ ПАНЕЛЬ: Окно выбранного чата / канала */}
              <section className="flex-1 flex flex-col min-w-0 bg-[#111113]">
                {/* Шапка диалога */}
                {(() => {
                  const selectedColleague =
                    activeCommThread.type === 'direct'
                      ? safeNodes.find((n) => String(n.id) === String(activeCommThread.id)) || null
                      : null;
                  const headerTitle =
                    activeCommThread.type === 'direct'
                      ? selectedColleague?.name || activeCommThread.label
                      : activeCommThread.type === 'department'
                      ? `# ${activeCommThread.label}`
                      : 'Общий поток (Циркуляры компании)';
                  const headerSubtitle =
                    activeCommThread.type === 'direct'
                      ? [selectedColleague?.role_type, selectedColleague?.department]
                          .filter(Boolean)
                          .join(' · ') || 'Личный защищенный диалог (Direct)'
                      : activeCommThread.type === 'department'
                      ? 'Канал подразделения · Сообщения видны сотрудникам отдела и руководству'
                      : 'Публичный корпоративный поток · Виден всем сотрудникам компании';

                  const tgActive =
                    activeCommThread.type === 'direct'
                      ? Boolean(selectedColleague?.telegram_chat_id)
                      : safeNodes.some((n) => Boolean(n.telegram_chat_id));

                  return (
                    <div className="px-5 py-3.5 border-b border-[#1F1F1F] bg-[#131316] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {activeCommThread.type === 'direct' && (
                          <UserAvatar
                            name={headerTitle}
                            avatarUrl={selectedColleague?.avatar_url}
                            size="md"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-white truncate">
                              {headerTitle}
                            </h2>
                            {activeCommThread.type === 'direct' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1C1C22] text-[#A1A1AA] border border-[#2C2C35]">
                                <Lock className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Приватный диалог</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8E8E93] truncate mt-0.5">
                            {headerSubtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                            tgActive
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-[#18181B] text-[#71717A] border-[#27272A]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              tgActive ? 'bg-emerald-400' : 'bg-[#52525B]'
                            }`}
                          />
                          <span>
                            {tgActive
                              ? 'Доставка в Telegram активна'
                              : 'Telegram не привязан у получателя'}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Поток сообщений (Компактные баблы по тексту w-fit max-w-[75%]) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[520px]">
                  {activeThreadMessages.length === 0 ? (
                    <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <MessageSquare className="w-6 h-6 text-[#52525B]" />
                      <div className="text-sm font-medium text-white">
                        В выбранном потоке пока нет сообщений
                      </div>
                      <p className="text-xs text-[#71717A] max-w-md">
                        {activeCommThread.type === 'direct'
                          ? 'Отправьте личное сообщение сотруднику. Оно будет видно исключительно вам и получателю, а также мгновенно доставлено в Telegram.'
                          : activeCommThread.type === 'department'
                          ? `Напишите сообщение в подразделение «${activeCommThread.label}». Все сотрудники отдела получат уведомление.`
                          : 'Опубликуйте циркуляр или оперативное сообщение для всей команды компании.'}
                      </p>
                    </div>
                  ) : (
                    activeThreadMessages.map((msg) => {
                      const isOutgoing =
                        Boolean(currentProfile?.id) &&
                        String(msg.sender_id || '') === String(currentProfile?.id || '');
                      const senderNode = msg.sender_id
                        ? nodeMap.get(String(msg.sender_id))
                        : null;
                      const recipientNode = msg.target_id
                        ? nodeMap.get(String(msg.target_id))
                        : msg.recipient_id
                        ? nodeMap.get(String(msg.recipient_id))
                        : null;

                      const senderName =
                        senderNode?.name || msg.sender_name || 'Сотрудник TedCloud';
                      const senderRole = senderNode?.role_type || msg.sender_role || '';
                      const senderAvatarUrl =
                        senderNode?.avatar_url ||
                        (isOutgoing ? currentProfile?.avatar_url : null);

                      const isDirectMsg =
                        activeCommThread.type === 'direct' ||
                        msg.target_type === 'direct' ||
                        msg.scope_type === 'direct';

                      const recipientLabel =
                        msg.target_label ||
                        recipientNode?.name ||
                        msg.target_department ||
                        'Всем';

                      const messageBody =
                        msg.message_text || msg.text || msg.content || '';

                      const shortTime = msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '';

                      return (
                        <div
                          key={msg.id}
                          className={`group flex items-end gap-2.5 ${
                            isOutgoing ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isOutgoing && (
                            <UserAvatar
                              name={senderName}
                              avatarUrl={senderAvatarUrl}
                              size="sm"
                              className="mb-0.5"
                            />
                          )}

                          <div
                            className={`w-fit max-w-[75%] min-w-[180px] rounded-2xl border px-3.5 py-2.5 space-y-1 transition-colors ${
                              isOutgoing
                                ? 'bg-emerald-950/30 border-emerald-500/30 rounded-br-sm'
                                : 'bg-[#16161A] border-[#26262C] rounded-bl-sm'
                            }`}
                          >
                            {/* Компактная шапка внутри бабла: Имя, роль, опциональная плашка Срочно и полупрозрачная кнопка + В задачу по ховеру */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span className="text-xs font-semibold text-white truncate">
                                  {senderName}
                                </span>
                                {senderRole && (
                                  <span className="text-[11px] text-[#8E8E93] truncate">
                                    · {senderRole}
                                  </span>
                                )}
                                {!isDirectMsg &&
                                  activeCommThread.type === 'broadcast' &&
                                  recipientLabel &&
                                  recipientLabel !== 'Всем сотрудникам' &&
                                  recipientLabel !== 'Циркуляр по компании' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#1F1F26] border border-[#2E2E38] text-[10px] font-medium text-[#A1A1AA]">
                                      {recipientLabel}
                                    </span>
                                  )}
                                {msg.is_urgent && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-[10px] font-semibold text-red-300">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>Срочно</span>
                                  </span>
                                )}
                              </div>

                              {canCreateOrEditTasks && (
                                <button
                                  type="button"
                                  onClick={() => handleConvertMessageToTask(msg)}
                                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#202026]/90 hover:bg-white hover:text-black text-[10px] font-medium text-[#D4D4D8] border border-[#32323A] transition-all shrink-0"
                                  title="Создать поручение на основе этого сообщения"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>В задачу</span>
                                </button>
                              )}
                            </div>

                            {/* Текст сообщения + аккуратное время в правом нижнем углу бабла */}
                            <div className="flex items-end justify-between gap-3 pt-0.5">
                              <div className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">
                                {messageBody}
                              </div>
                              {shortTime && (
                                <span className="text-[10px] tabular-nums text-zinc-400/75 shrink-0 select-none leading-none pb-0.5">
                                  {shortTime}
                                </span>
                              )}
                            </div>
                          </div>

                          {isOutgoing && (
                            <UserAvatar
                              name={senderName}
                              avatarUrl={senderAvatarUrl}
                              size="sm"
                              className="mb-0.5"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Нижняя панель ввода (Composer): по умолчанию не срочно, иконка молнии рядом с кнопкой отправки */}
                <form
                  onSubmit={handleSendCorporateMessage}
                  className="p-3.5 border-t border-[#1F1F1F] bg-[#0E0E11] flex items-end gap-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <textarea
                      rows={2}
                      value={commText}
                      onChange={(e) => setCommText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void submitCurrentCommMessage();
                        }
                      }}
                      placeholder={
                        activeCommThread.type === 'direct'
                          ? `Написать личное сообщение для ${activeCommThread.label}... (Enter — отправить)`
                          : activeCommThread.type === 'department'
                          ? `Сообщение в отдел #${activeCommThread.label}... (Enter — отправить)`
                          : 'Опубликовать циркуляр по компании... (Enter — отправить)'
                      }
                      className="w-full rounded-xl border border-[#262626] bg-[#16161A] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pb-0.5">
                    <button
                      type="button"
                      onClick={() => setCommUrgent((prev) => !prev)}
                      aria-label="Срочный Push в Telegram"
                      title={
                        commUrgent
                          ? 'Срочный Push-статус включен (отметить как обычное)'
                          : 'Отметить сообщение как «Срочно»'
                      }
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
                        commUrgent
                          ? 'bg-red-500/15 border-red-500/40 text-red-400'
                          : 'bg-[#16161A] border-[#262626] text-[#71717A] hover:text-white hover:border-[#3F3F46]'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                    </button>

                    <button
                      type="submit"
                      disabled={isSendingComm || !commText.trim()}
                      className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      {isSendingComm ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isSendingComm ? t('comm.sendingBtn') : 'Отправить'}</span>
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* =================================================================
              TAB 5: ШТАТ И ДОСТУПЫ / TEAM & ACCESS (БЛОК 2: Конструктор отделов + таблица штата / Карта связей)
          ================================================================== */}
          {activeSection === 'team' && perms.team_manage && (
            <div className="space-y-6">
              {renderDepartmentConstructorCard()}

              {teamViewMode === 'graph' ? (
                <TeamworkGraphView
                  companyName={companyName}
                  departments={companyDepartments}
                  nodes={safeNodes}
                  tasks={visibleTasks}
                  leads={visibleLeads}
                  canViewCrm={perms.crm_view}
                  onSelectTask={(taskId) => setDrawerSelection({ kind: 'task', id: taskId })}
                  onSelectLead={(leadId) => setDrawerSelection({ kind: 'lead', id: leadId })}
                />
              ) : (
                <section className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-[#A1A1AA]" />
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#D4D4D8]">
                        {t('team.sectionTitle')}
                      </h2>
                      <span className="text-[11px] font-medium text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded whitespace-nowrap tabular-nums">
                        {filteredNodes.length}
                      </span>
                    </div>
                    {perms.data_export && (
                      <button
                        onClick={handleExportTeamCsv}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    )}
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
                          <tr className="border-b border-white/[0.07] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                            <th className="py-3 px-5">{t('team.colEmployee')}</th>
                            <th className="py-3 px-5">{t('team.colJobTitle')}</th>
                            <th className="py-3 px-5">{t('team.colAccess')}</th>
                            <th className="py-3 px-5">{t('team.colInviteCode')}</th>
                            <th className="py-3 px-5">{t('team.colTelegram')}</th>
                            <th className="py-3 px-5 text-right">{t('team.colActions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05] text-xs">
                          {filteredNodes.map((node) => {
                            const { access_level, permissions } = normalizeEmployeePermissions(
                              node.access_level,
                              node.permissions,
                              node.role_type
                            );
                            const activeFlagsCount = PERMISSION_KEYS.filter(
                              (k) => permissions[k]
                            ).length;

                            return (
                              <tr key={node.id} className="hover:bg-[#16161A] transition-colors">
                                <td className="py-4 px-5">
                                  <div className="flex items-center gap-3">
                                    <UserAvatar
                                      name={node.name}
                                      avatarUrl={node.avatar_url}
                                      size="md"
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-white truncate">
                                        {node.name}
                                      </div>
                                      {node.email && (
                                        <div className="text-[11px] text-[#71717A] mt-0.5 truncate">
                                          {node.email}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-4 px-5">
                                  <div className="inline-flex items-center px-2.5 py-0.5 rounded bg-white/[0.04] text-white border border-white/[0.08] font-medium whitespace-nowrap">
                                    {node.role_type}
                                  </div>
                                  <div className="text-[11px] text-[#8E8E93] mt-1">
                                    {node.department || t('team.noDepartment')}
                                  </div>
                                </td>

                                <td className="py-4 px-5">
                                  <div className="flex flex-col items-start gap-1.5">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[#E4E4E7] font-medium whitespace-nowrap tabular-nums">
                                      {t(`accessShort.${access_level}`)} ({activeFlagsCount}/7)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setPermissionsModalNode(node)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/[0.08] bg-[#16161A] hover:bg-white/[0.08] text-[11px] font-medium text-white transition-colors whitespace-nowrap"
                                    >
                                      <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                                      <span>{t('permModal.btnLabel')}</span>
                                    </button>
                                  </div>
                                </td>

                                <td className="py-4 px-5">
                                  <div className="flex flex-col items-start gap-1.5">
                                    <span className="text-xs px-2.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-white font-semibold whitespace-nowrap tabular-nums">
                                      {node.invite_code || 'TC-0000'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setInspectInviteNode(node)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#A1A1AA] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors whitespace-nowrap"
                                    >
                                      <KeyRound className="w-3 h-3" />
                                      <span>{t('team.inviteLinkBtn')}</span>
                                    </button>
                                  </div>
                                </td>

                                <td className="py-4 px-5">
                                  {node.telegram_chat_id ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium whitespace-nowrap tabular-nums">
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
            </div>
          )}

          {/* =================================================================
              TAB 6: ЛИЧНЫЙ КАБИНЕТ / MY PROFILE (БЛОК 3: Obsidian & Titanium standard)
          ================================================================== */}
          {activeSection === 'profile' && currentProfile && (
            <div className="space-y-6">
              {/* Верхняя карточка-баннер: Клик прямо по кружку аватара открывает выбор файла (без белой кнопки справа) */}
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative group shrink-0">
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarFileInputRef.current?.click()}
                      title="Нажмите, чтобы обновить фотографию профиля"
                      className="relative rounded-full focus:outline-none group"
                    >
                      <UserAvatar
                        name={currentProfile.name}
                        avatarUrl={currentProfile.avatar_url}
                        size="xl"
                      />
                      <span className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {isUploadingAvatar ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5 text-white" />
                        )}
                      </span>
                    </button>
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                      aria-label="Выбрать файл фотографии профиля"
                    />
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white tracking-tight truncate">
                        {currentProfile.name}
                      </h2>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-xs font-medium text-white whitespace-nowrap">
                        {currentProfile.role_type}
                      </span>
                      {currentProfile.department && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.07] text-xs text-[#A1A1AA] whitespace-nowrap">
                          {currentProfile.department}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[#D4D4D8] font-medium">
                        <Shield className="w-3 h-3 text-emerald-400" />
                        <span>{t(`access.${currentAccessLevel}`)}</span>
                      </span>

                      {currentProfile.telegram_chat_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium tabular-nums">
                          <Send className="w-3 h-3" />
                          <span>Telegram синхронизирован ({currentProfile.telegram_chat_id})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[#8E8E93]">
                          <span>Telegram не привязан</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {currentProfile.avatar_url && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => void handleRemoveAvatar()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-[#17171B] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs font-medium text-[#A1A1AA] transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Удалить фото</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Компактная сетка из 2 колонок */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Левая колонка: Редактируемый профиль + чистая карточка учетных идентификаторов */}
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveMyProfile}
                    className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Личные реквизиты и контакты
                        </h3>
                        <p className="text-xs text-[#8E8E93] mt-0.5">
                          Учетная карточка сотрудника в корпоративном реестре {companyName}
                        </p>
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
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
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
                          placeholder="name@company.com"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      {perms.team_manage && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                              {t('profile.jobTitle')}
                            </label>
                            <input
                              type="text"
                              required
                              value={profileRoleTitle}
                              onChange={(e) => setProfileRoleTitle(e.target.value)}
                              className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
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
                              placeholder="Например: Дирекция"
                              className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {!perms.team_manage && (
                      <div className="rounded-lg border border-white/[0.07] bg-[#141418] p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>{t('profile.jobTitle')}</span>
                          </div>
                          <div className="font-semibold text-white mt-1">
                            {currentProfile.role_type}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>{t('profile.department')}</span>
                          </div>
                          <div className="font-semibold text-white mt-1">
                            {currentProfile.department || 'Не назначено'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Компактная информационная панель системных идентификаторов */}
                    <div className="rounded-lg border border-white/[0.07] bg-[#141418] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-[11px] text-[#8E8E93]">Персональный код входа</div>
                          <div className="font-semibold text-white mt-0.5 tabular-nums">
                            {currentProfile.invite_code || 'TC-0000'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            currentProfile.invite_code || 'TC-0000',
                            'profile-invite-code'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors"
                      >
                        {copiedToken === 'profile-invite-code' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('invite.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#A1A1AA]" />
                            <span>{t('invite.copyCode')}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="pt-1 flex justify-end">
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
                </div>

                {/* Правая колонка: Синхронизация с Telegram-ботом + Активный рабочий контур */}
                <div className="space-y-6">
                  {/* Карточка синхронизации с Telegram-ботом (Без сырого инпута с URL и без плашки /start) */}
                  <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Send className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                          Синхронизация с Telegram-ботом
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium border ${
                          currentProfile.telegram_chat_id
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-white/[0.04] border-white/[0.08] text-[#A1A1AA]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            currentProfile.telegram_chat_id ? 'bg-emerald-400' : 'bg-zinc-500'
                          }`}
                        />
                        <span>
                          {currentProfile.telegram_chat_id ? 'Подключено' : 'Ожидает привязки'}
                        </span>
                      </span>
                    </div>

                    <p className="text-xs text-[#8E8E93] leading-relaxed">
                      Подключите личный аккаунт Telegram для мгновенного получения уведомлений о новых задачах и прямых сообщений от коллег.
                    </p>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <a
                        href={`https://t.me/${
                          botUsername || 'TedCloudEnterpriseBot'
                        }?start=${currentProfile.invite_code || 'TC-0000'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Открыть Telegram-бот</span>
                      </a>

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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors"
                      >
                        {copiedToken === 'profile-link' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('invite.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#A1A1AA]" />
                            <span>Скопировать ссылку привязки</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Компактная карточка «Активный рабочий контур» с полным спектром управленческих прав для Superadmin/Manager */}
                  <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                          Активный рабочий контур
                        </h3>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-medium text-emerald-300 whitespace-nowrap">
                        {t(`access.${currentAccessLevel}`)}
                      </span>
                    </div>

                    <p className="text-xs text-[#8E8E93] leading-relaxed">
                      Доступные вам рабочие модули и полномочия в пространстве компании:
                    </p>

                    <div className="space-y-2">
                      {Array.from(
                        new Set([
                          ...(currentAccessLevel === 'root' || currentAccessLevel === 'manager'
                            ? [
                                'Управление коммерческой воронкой CRM',
                                'Управление штатом и матрицей доступа',
                                'Международный биллинг и аудит безопасности',
                              ]
                            : []),
                          'Управление операционными задачами и SLA',
                          'Корпоративный мессенджер и каналы отделов',
                          'Прямая синхронизация с Telegram-ботом',
                          ...PERMISSION_KEYS.filter((k) => Boolean(perms[k])).map((k) =>
                            t(`perm.${k}`)
                          ),
                        ])
                      ).map((capabilityLabel) => (
                        <div
                          key={capabilityLabel}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-[#141418] px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-white font-medium truncate">
                              {capabilityLabel}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                            Активно
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 7: ОРГАНИЗАЦИЯ И БИЛЛИНГ / WORKSPACE & BILLING
              (БЛОК 1: без тегов отделов сверху; БЛОК 4: Квоты, Реквизиты, Счета; БЛОК 5: Audit Log)
          ================================================================== */}
          {activeSection === 'workspace' && perms.billing_admin && (
            <div className="space-y-6">
              {/* 1. Квоты и лимиты тарифа (Plan Quotas) */}
              {(() => {
                const maxSeats =
                  selectedPlan === 'Trial' ? 5 : selectedPlan === 'Business' ? 50 : 500;
                const seatsPercent = Math.min(
                  100,
                  Math.round((safeNodes.length / maxSeats) * 100)
                );
                return (
                  <div className="rounded-xl border border-[#1F1F1F] bg-[#111113] p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                            Квоты и лимиты корпоративного тарифа ({selectedPlan})
                          </h3>
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            Мониторинг лицензий сотрудников, AI-квот и защищенного API-шлюза компании
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Хранилище и API-шлюз: Активно</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="rounded-lg border border-white/[0.07] bg-[#151519] p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#A1A1AA] font-medium">
                            Активные сотрудники (Тариф {selectedPlan})
                          </span>
                          <span className="tabular-nums font-semibold text-white">
                            {safeNodes.length} / {selectedPlan === 'Enterprise' ? '∞' : maxSeats}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#24242A] overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${Math.max(8, seatsPercent)}%` }}
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/[0.07] bg-[#151519] p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#A1A1AA] font-medium">
                            Хранилище, Telegram Webhook и TedCloud Intelligence
                          </span>
                          <span className="tabular-nums font-semibold text-emerald-400">
                            Активно · 99.98% SLA
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#24242A] overflow-hidden">
                          <div className="h-full bg-emerald-500 w-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Параметры организации и Выбор тарифа */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4">
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
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-2.5 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Plan Selector (открывает модальное окно оформления подписки и B2B-счета) */}
                <div className="lg:col-span-2 rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4">
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
                              ? 'border-white/80 bg-white/[0.04]'
                              : 'border-white/[0.07] bg-[#141418] hover:border-white/[0.18]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-white">
                                {planItem.tier}
                              </span>
                              <span className="text-xs font-medium text-[#D4D4D8] whitespace-nowrap tabular-nums">
                                {formatMoney(planItem.priceRub)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8E8E93] leading-relaxed mt-2">
                              {planItem.desc}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (planItem.tier === 'Trial') {
                                handlePlanChange('Trial');
                              } else {
                                setCheckoutModalPlan(planItem.tier);
                              }
                            }}
                            className={`mt-4 w-full py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                              isCurrent
                                ? 'bg-white text-black hover:bg-[#E4E4E7]'
                                : 'bg-white/[0.06] text-[#D4D4D8] hover:bg-white hover:text-black'
                            }`}
                          >
                            {planItem.tier === 'Trial'
                              ? isCurrent
                                ? t('workspace.activeTier')
                                : t('workspace.upgradeBtn')
                              : isCurrent
                              ? 'Продлить / Выставить счет'
                              : 'Выбрать тариф'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Платежный шлюз и Форма «Реквизиты плательщика» (companies.billing_details) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4">
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
                            ? 'border-white/80 bg-white/[0.04]'
                            : 'border-white/[0.07] bg-[#141418] hover:border-white/[0.18]'
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
                            ? 'border-white/80 bg-white/[0.04]'
                            : 'border-white/[0.07] bg-[#141418] hover:border-white/[0.18]'
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

                  {renderLocalizationCard()}
                </div>

                {/* Форма «Реквизиты плательщика» (сохранение в companies.billing_details) */}
                <form
                  onSubmit={handleSaveBillingDetails}
                  className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                          Реквизиты плательщика ({paymentRegion === 'RU' ? 'РФ и СНГ' : 'Global'})
                        </h3>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          Юридические данные автоматически подставляются в закрывающие документы и B2B-счета
                        </p>
                      </div>
                    </div>
                  </div>

                  {paymentRegion === 'RU' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          Наименование юрлица (ООО / АО / ИП)
                        </label>
                        <input
                          type="text"
                          required
                          value={payerLegalName}
                          onChange={(e) => setPayerLegalName(e.target.value)}
                          placeholder='ООО «Сигма Технологии»'
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          ИНН
                        </label>
                        <input
                          type="text"
                          value={payerTaxId}
                          onChange={(e) => setPayerTaxId(e.target.value)}
                          placeholder="7701234567"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white tabular-nums placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          КПП
                        </label>
                        <input
                          type="text"
                          value={payerRegNumber}
                          onChange={(e) => setPayerRegNumber(e.target.value)}
                          placeholder="770101001"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white tabular-nums placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          Юридический адрес
                        </label>
                        <input
                          type="text"
                          value={payerLegalAddress}
                          onChange={(e) => setPayerLegalAddress(e.target.value)}
                          placeholder="г. Москва, Пресненская наб., д. 12"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          Email для счетов и ЭДО
                        </label>
                        <input
                          type="email"
                          value={payerBillingEmail}
                          onChange={(e) => setPayerBillingEmail(e.target.value)}
                          placeholder="finance@company.ru"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          Company Legal Name
                        </label>
                        <input
                          type="text"
                          required
                          value={payerLegalName}
                          onChange={(e) => setPayerLegalName(e.target.value)}
                          placeholder="Sigma Enterprise Holdings Inc."
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          VAT / Tax ID
                        </label>
                        <input
                          type="text"
                          value={payerTaxId}
                          onChange={(e) => setPayerTaxId(e.target.value)}
                          placeholder="EU-992018412"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white tabular-nums placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          Country / Jurisdiction
                        </label>
                        <input
                          type="text"
                          value={payerCountry}
                          onChange={(e) => setPayerCountry(e.target.value)}
                          placeholder="United Kingdom / Germany / UAE"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                          Billing Email
                        </label>
                        <input
                          type="email"
                          value={payerBillingEmail}
                          onChange={(e) => setPayerBillingEmail(e.target.value)}
                          placeholder="billing@company.com"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCheckoutModalPlan(selectedPlan === 'Trial' ? 'Business' : selectedPlan)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Сформировать B2B-счет</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingBillingDetails}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors"
                    >
                      {isSavingBillingDetails ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Сохранить реквизиты</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* 4. Таблица «История счетов и платежей» (billing_invoices) */}
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      История счетов и платежей (B2B Invoices)
                    </h3>
                    <span className="text-[11px] font-medium text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded tabular-nums">
                      {safeInvoices.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCheckoutModalPlan(selectedPlan === 'Trial' ? 'Business' : selectedPlan)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Выставить новый счет</span>
                  </button>
                </div>

                {safeInvoices.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="text-xs font-medium text-white">
                      По вашей организации пока нет выставленных счетов
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Выберите тариф «Business» или «Enterprise», чтобы сформировать официальный B2B-счет на оплату или оплатить подписку картой.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                          <th className="py-3 px-5">№ счета</th>
                          <th className="py-3 px-5">Дата</th>
                          <th className="py-3 px-5">Тариф и период</th>
                          <th className="py-3 px-5">Сумма</th>
                          <th className="py-3 px-5">Статус</th>
                          <th className="py-3 px-5 text-right">Документ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-xs">
                        {safeInvoices.map((inv) => {
                          const isPaid = inv.status === 'Paid';
                          const dateStr = inv.created_at
                            ? new Date(inv.created_at).toLocaleDateString('ru-RU')
                            : '—';
                          return (
                            <tr key={inv.id} className="hover:bg-[#16161A] transition-colors">
                              <td className="py-3.5 px-5 tabular-nums font-semibold text-white">
                                {inv.invoice_number}
                              </td>
                              <td className="py-3.5 px-5 text-[#A1A1AA] tabular-nums">{dateStr}</td>
                              <td className="py-3.5 px-5">
                                <span className="font-medium text-white">Тариф {inv.plan}</span>
                                <span className="text-[11px] text-[#71717A] ml-1.5">
                                  ({inv.billing_cycle === 'yearly' ? '12 месяцев, -20%' : '1 месяц'})
                                </span>
                              </td>
                              <td className="py-3.5 px-5 tabular-nums font-semibold text-white">
                                {formatMoney(Number(inv.amount || 0))}
                              </td>
                              <td className="py-3.5 px-5">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-medium text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Оплачен</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium text-amber-300">
                                    <Clock className="w-3 h-3" />
                                    <span>Ожидает оплаты</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setPrintableInvoice(inv)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white hover:text-black text-xs font-medium text-white transition-colors whitespace-nowrap"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Открыть счет (Печать / PDF)</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Экспорт реестров CSV */}
              {perms.data_export && (
                <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 space-y-4">
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
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t('workspace.exportDealsCsv')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTasksCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t('workspace.exportTasksCsv')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTeamCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>{t('workspace.exportTeamCsv')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. БЛОК 5: ЖУРНАЛ БЕЗОПАСНОСТИ И АУДИТА ДЕЙСТВИЙ (AUDIT LOG) */}
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                        Журнал безопасности и аудита действий (Audit Log)
                      </h3>
                      <p className="text-[11px] text-[#8E8E93] mt-0.5">
                        Неизменяемый реестр критически важных событий безопасности и изменений в {companyName}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded">
                    {safeAuditLogs.length} событий
                  </span>
                </div>

                {safeAuditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#71717A]">
                    Журнал аудита инициализирован. Все последующие операции создания/удаления задач, сделок, изменения прав и счетов фиксируются автоматически.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                          <th className="py-3 px-5">Время</th>
                          <th className="py-3 px-5">Сотрудник (Инициатор)</th>
                          <th className="py-3 px-5">Действие</th>
                          <th className="py-3 px-5">Объект</th>
                          <th className="py-3 px-5">Детали</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-xs">
                        {safeAuditLogs.slice(0, 40).map((log) => {
                          const timeFormatted = log.created_at
                            ? new Date(log.created_at).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—';
                          return (
                            <tr key={log.id} className="hover:bg-[#16161A] transition-colors">
                              <td className="py-3 px-5 tabular-nums text-[11px] text-[#8E8E93] whitespace-nowrap">
                                {timeFormatted}
                              </td>
                              <td className="py-3 px-5">
                                <div className="font-medium text-white">{log.actor_name}</div>
                                {log.actor_role && (
                                  <div className="text-[10px] text-[#71717A]">{log.actor_role}</div>
                                )}
                              </td>
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-emerald-300">
                                  {log.action_type || (log as any).action}
                                </span>
                              </td>
                              <td className="py-3 px-5 text-[#A1A1AA] text-[11px]">
                                {log.entity_type}
                              </td>
                              <td className="py-3 px-5 text-[#D4D4D8]">{log.details}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
        canAssignTasks={perms.tasks_assign}
        nodes={safeNodes}
        departments={companyDepartments}
        botUsername={botUsername}
        initialTaskDraft={initialTaskDraft}
        onAddCompanyDepartment={handleAddDepartment}
        onClose={() => {
          setModalType(null);
          setInitialTaskDraft(null);
        }}
        onSuccess={async (pushSent) => {
          setInitialTaskDraft(null);
          await onRefresh();
          if (pushSent) {
            showToast(t('toast.pushSent'));
          }
        }}
      />

      {/* Employee Granular Permissions Matrix Modal (БЛОК 1) */}
      <PermissionsMatrixModal
        node={permissionsModalNode}
        onClose={() => setPermissionsModalNode(null)}
        onSave={handleSaveNodePermissionsMatrix}
      />

      {/* Slide-over Detail Drawer for Tasks & Deals */}
      <SlideOverDrawer
        target={activeDrawerTarget}
        nodes={safeNodes}
        departments={companyDepartments}
        messages={safeMessages}
        currentProfile={currentProfile}
        canEditTasks={canCreateOrEditTasks}
        canAssignTasks={perms.tasks_assign}
        canEditCrm={perms.crm_edit}
        onClose={() => setDrawerSelection(null)}
        onPatchRecord={async (table, id, updates) => {
          const res = await onPatchRecord(table, id, updates);
          if (res.ok) {
            showToast(t('drawer.savedToast'));
          }
        }}
        onSendMessage={
          onSendMessage
            ? async (payload) => {
                const res = await onSendMessage(payload);
                if (res.ok) {
                  showToast(t('comm.sentToast'));
                }
              }
            : undefined
        }
      />

      {/* TedCloud Intelligence Drawer (БЛОК 1) */}
      <TedCloudAiDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        company={company}
        currentProfile={currentProfile}
        nodes={safeNodes}
        tasks={visibleTasks}
        leads={visibleLeads}
        messages={visibleMessages}
        onCreateFollowUpTask={(suggestedTitle) => {
          setInitialTaskDraft({
            title:
              suggestedTitle ||
              'Операционное поручение по итогам сводки TedCloud Intelligence',
            description:
              'Задача создана на основе аналитического отчета TedCloud Intelligence.',
            priority: 'High',
          });
          setModalType('tasks');
        }}
        onNavigateToCrm={() => {
          if (perms.crm_view) {
            setActiveSection('crm');
          }
        }}
        onNavigateToTasks={() => {
          setActiveSection('tasks');
          setTaskViewMode('board');
        }}
      />

      {/* Global Command Bar & Omnisearch (Cmd+K / БЛОК 3) */}
      <CommandBarModal
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        tasks={visibleTasks}
        leads={visibleLeads}
        nodes={safeNodes}
        messages={visibleMessages}
        canCreateTasks={canCreateOrEditTasks}
        canViewCrm={perms.crm_view}
        onSelectTask={(taskId) => {
          setDrawerSelection({ kind: 'task', id: taskId });
        }}
        onSelectLead={(leadId) => {
          setDrawerSelection({ kind: 'lead', id: leadId });
        }}
        onSelectSection={(sec) => {
          setActiveSection(sec);
        }}
        onCreateTask={() => {
          setModalType('tasks');
        }}
        onOpenAiCopilot={() => {
          setIsAiDrawerOpen(true);
        }}
      />

      {/* Subscription Checkout & B2B Invoice Generator Modal (БЛОК 4) */}
      <SubscriptionCheckoutModal
        isOpen={Boolean(checkoutModalPlan)}
        initialPlan={checkoutModalPlan || selectedPlan}
        paymentRegion={paymentRegion}
        companyName={companyName}
        billingDetails={{
          legal_name: payerLegalName || companyName,
          tax_id: payerTaxId,
          reg_number: payerRegNumber,
          legal_address: payerLegalAddress,
          billing_email: payerBillingEmail,
          country: payerCountry,
          region: paymentRegion,
        }}
        onClose={() => setCheckoutModalPlan(null)}
        onConfirmSubscription={handleConfirmSubscription}
      />

      {/* Printable Official B2B Invoice Modal (БЛОК 4) */}
      <PrintableInvoiceModal
        invoice={printableInvoice}
        companyName={companyName}
        paymentRegion={paymentRegion}
        fallbackBillingDetails={{
          legal_name: payerLegalName || companyName,
          tax_id: payerTaxId,
          reg_number: payerRegNumber,
          legal_address: payerLegalAddress,
          billing_email: payerBillingEmail,
          country: payerCountry,
          region: paymentRegion,
        }}
        onClose={() => setPrintableInvoice(null)}
        onMarkPaid={handleMarkInvoicePaid}
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
                  className="px-4 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                >
                  {t('invite.doneBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Enterprise Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        variant={pendingConfirm?.variant || 'danger'}
        confirmLabel={pendingConfirm?.confirmLabel}
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
