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
  ArrowLeft,
  Sun,
  Moon,
  LayoutDashboard,
  UserCircle,
  LogOut,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Paperclip,
  Link2,
  ExternalLink,
  Smile,
  Reply,
  CheckCheck,
  CheckSquare,
} from 'lucide-react';
import {
  AccessLevel,
  AttachmentItem,
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
  WorkShiftRecord,
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
import {
  MyPermissionsModal,
  MyAccessKeysModal,
  LegalRequisitesModal,
  SecurityAuditLogModal,
  RichEmptyState,
  PRIMARY_BTN_CLASS,
  SECONDARY_BTN_CLASS,
} from './ProgressiveModals';
import {
  buildBuiltInChecklistForTask,
  getPlanPrice,
  normalizeAttachments,
  PRICING_PLANS,
} from '../utils/enterpriseLogic';
import {
  AttachmentListRenderer,
  PendingAttachmentsStrip,
  processAttachmentFiles,
} from './AttachmentSystem';
import { useLocale } from '../i18n/LocaleContext';
import {
  ActiveMessengerThread,
  canUserSeeWorkspaceMessage,
  extractMessageText,
  filterMessagesForActiveThread,
  isDirectMessageBetweenUsers,
} from '../utils/messengerLogic';
import {
  ApprovalDecisionBar,
  RequestApprovalModal,
  SmartDocumentVault,
} from './ApprovalsAndVault';
import {
  InlineEditableCell,
  QuickInlineTaskBar,
  QuickInlineDealBar,
  QuickInlineEmployeeBar,
  TaskTimelineView,
  LegalDocumentGeneratorModal,
  ClientDealRoomView,
  ExecutiveUnitEconomicsRadar,
  DashboardShiftsOverviewWidget,
  TimeAndAttendanceView,
  CorporateDataExportCenter,
  SuperadminQaAuditPanel,
  useDesignLinter,
} from './EnterpriseB2BFeatures';

interface DashboardProps {
  company: Company | null;
  currentProfile: OrganizationNode | null;
  activeChatId: string | null;
  botUsername?: string;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  messages?: WorkspaceMessageRecord[];
  invoices?: BillingInvoiceRecord[];
  auditLogs?: AuditLogRecord[];
  workShifts?: WorkShiftRecord[];
  isSyncing: boolean;
  onRefresh: () => Promise<void> | void;
  onPatchRecord: (
    table:
      | 'tasks'
      | 'crm_leads'
      | 'organization_nodes'
      | 'companies'
      | 'billing_invoices'
      | 'workspace_messages',
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
  onCreateWorkShift?: (shift: Partial<WorkShiftRecord>) => Promise<void>;
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

interface ChatComposerBarProps {
  theme: 'dark' | 'light';
  isEn: boolean;
  commUrgent: boolean;
  setCommUrgent: React.Dispatch<React.SetStateAction<boolean>>;
  commAttachmentsCount: number;
  isProcessingCommAttachment: boolean;
  isSendingComm: boolean;
  onOpenFilePicker: () => void;
  onSubmitMessage: (text: string) => void;
}

const ChatComposerBar: React.FC<ChatComposerBarProps> = React.memo(
  ({
    theme,
    isEn,
    commUrgent,
    setCommUrgent,
    commAttachmentsCount,
    isProcessingCommAttachment,
    isSendingComm,
    onOpenFilePicker,
    onSubmitMessage,
  }) => {
    const [text, setText] = useState<string>('');
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (isSendingComm || (!trimmed && commAttachmentsCount === 0)) return;
      setText('');
      setShowEmojiPicker(false);
      onSubmitMessage(trimmed);
    };

    return (
      <div
        className={`relative shrink-0 sticky bottom-0 p-3 border-t transition-colors ${
          theme === 'light'
            ? 'border-[#E2DFD7] bg-[#FAF9F5]'
            : 'border-white/[0.07] bg-[#111115]'
        }`}
      >
        {showEmojiPicker && (
          <div
            className={`absolute bottom-16 left-4 z-30 p-2.5 rounded-2xl shadow-xl flex flex-col gap-2 max-w-xs border ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-zinc-900 border-white/10 text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {(['👍', '🔥', '❤️', '✅', '👏', '👀'] as const).map((emojiChar) => (
                <button
                  key={emojiChar}
                  type="button"
                  onClick={() => {
                    setText((prev) => (prev ? `${prev} ${emojiChar}` : emojiChar));
                    setShowEmojiPicker(false);
                  }}
                  className={`w-8 h-8 rounded-full inline-flex items-center justify-center text-base hover:scale-110 transition-transform cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  {emojiChar}
                </button>
              ))}
            </div>
            <div
              className={`flex flex-wrap gap-1.5 pt-1 border-t ${
                theme === 'light' ? 'border-slate-200/60' : 'border-white/10'
              }`}
            >
              {[
                isEn ? 'Accepted in work' : 'Принято в работу',
                isEn ? 'Approved' : 'Согласовано',
                isEn ? 'Completed' : 'Выполнено',
                isEn ? 'On Review' : 'На проверке',
              ].map((quickPhrase) => (
                <button
                  key={quickPhrase}
                  type="button"
                  onClick={() => {
                    setText((prev) => (prev ? `${prev} ${quickPhrase}` : quickPhrase));
                    setShowEmojiPicker(false);
                  }}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-700'
                      : 'bg-white/[0.06] hover:bg-indigo-500/20 border-white/10 text-zinc-200'
                  }`}
                >
                  {quickPhrase}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleFormSubmit}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1.5 shadow-lg transition-colors ${
            theme === 'light'
              ? 'bg-white border-[#D6D3CD] text-[#18181B]'
              : 'bg-zinc-900/90 border-white/10 text-white'
          }`}
        >
          <button
            type="button"
            disabled={isProcessingCommAttachment || isSendingComm}
            onClick={onOpenFilePicker}
            title={isEn ? 'Attach file or photo' : 'Прикрепить файл или фото'}
            aria-label={isEn ? 'Attach file or photo' : 'Прикрепить файл или фото'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
              theme === 'light'
                ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            {isProcessingCommAttachment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            title={isEn ? 'Insert emoji' : 'Добавить эмодзи'}
            aria-label={isEn ? 'Insert emoji' : 'Добавить эмодзи'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
              showEmojiPicker
                ? 'bg-indigo-500/20 text-indigo-400'
                : theme === 'light'
                ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isEn ? 'Write a message...' : 'Написать сообщение...'}
            className={`tc-composer-input !bg-transparent border-0 focus:ring-0 outline-none flex-1 min-w-0 w-full h-8 px-2 text-sm ${
              theme === 'light'
                ? 'text-[#18181B] placeholder:text-zinc-400'
                : 'text-white placeholder:text-zinc-500'
            }`}
          />

          <button
            type="button"
            onClick={() => setCommUrgent((prev) => !prev)}
            aria-label={isEn ? 'Urgent Telegram Push' : 'Срочный Push в Telegram'}
            title={
              commUrgent
                ? isEn
                  ? 'Urgent push enabled'
                  : 'Срочный Push-статус включен'
                : isEn
                ? 'Mark message as Urgent'
                : 'Отметить сообщение как «Срочно»'
            }
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
              commUrgent
                ? 'bg-amber-500/20 text-amber-400'
                : theme === 'light'
                ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={isSendingComm || (!text.trim() && commAttachmentsCount === 0)}
            aria-label={isEn ? 'Send message' : 'Отправить сообщение'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors shrink-0 shadow-sm cursor-pointer"
          >
            {isSendingComm ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    );
  }
);

export const Dashboard: React.FC<DashboardProps> = ({
  company,
  currentProfile,
  botUsername: serverBotUsername,
  nodes,
  tasks,
  leads,
  messages = [],
  invoices = [],
  auditLogs = [],
  workShifts = [],
  isSyncing,
  onRefresh,
  onPatchRecord,
  onDeleteRecord,
  onSendMessage,
  onCreateInvoice,
  onCreateWorkShift,
  onResetSession,
}) => {
  const {
    language,
    currency,
    theme,
    setLanguage,
    setCurrency,
    toggleTheme,
    t,
    formatMoney,
    formatRole,
  } = useLocale();
  const isEn = language === 'en';

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
  const safeWorkShifts = useMemo(
    () =>
      (Array.isArray(workShifts) ? workShifts : []).filter(
        (sh) => !companyId || !sh?.company_id || String(sh.company_id) === String(companyId)
      ),
    [workShifts, companyId]
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

  // Mobile Responsive Navigation & Master-Detail Messenger states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Bento Dashboard Quick Add Task & Expandable Subtasks states
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isCreatingQuickTask, setIsCreatingQuickTask] = useState(false);
  const [expandedChecklistTaskIds, setExpandedChecklistTaskIds] = useState<Record<string, boolean>>(
    {}
  );

  const [isMyPermissionsModalOpen, setIsMyPermissionsModalOpen] = useState(false);
  const [isMyAccessKeysModalOpen, setIsMyAccessKeysModalOpen] = useState(false);
  const [isLegalRequisitesModalOpen, setIsLegalRequisitesModalOpen] = useState(false);
  const [isSecurityAuditModalOpen, setIsSecurityAuditModalOpen] = useState(false);

  const quickTaskInputRef = React.useRef<HTMLInputElement | null>(null);
  const quickDealInputRef = React.useRef<HTMLInputElement | null>(null);
  const quickEmployeeInputRef = React.useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lastScrolledThreadKeyRef = React.useRef<string>('');
  const lastScrolledMsgCountRef = React.useRef<number>(0);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [optimisticReactionsMap, setOptimisticReactionsMap] = useState<
    Record<string, Record<string, string[]>>
  >({});

  // Task & CRM View Modes + Approvals & Document Vault + B2B Enterprise states
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'board' | 'timeline'>('board');
  const [taskSliceFilter, setTaskSliceFilter] = useState<
    'all' | 'mine' | 'delegated' | 'approvals' | 'urgent_overdue'
  >('all');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [autoPipelineEnabled, setAutoPipelineEnabled] = useState<boolean>(true);
  const [legalDocModalDeal, setLegalDocModalDeal] = useState<CrmLeadRecord | null>(null);
  const [dealRoomPreviewId, setDealRoomPreviewId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('deal_room') || null;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandBarOpen((prev) => !prev);
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (activeSection === 'tasks') {
          quickTaskInputRef.current?.focus();
        } else if (activeSection === 'crm') {
          quickDealInputRef.current?.focus();
        } else if (activeSection === 'team') {
          quickEmployeeInputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setDrawerSelection(null);
        setModalType(null);
        setLegalDocModalDeal(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeSection]);

  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | 'approvals'>('all');
  const [isRequestApprovalModalOpen, setIsRequestApprovalModalOpen] = useState(false);
  const [commViewMode, setCommViewMode] = useState<'messenger' | 'vault'>('messenger');
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
  const [commAttachments, setCommAttachments] = useState<AttachmentItem[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [replyingToMessage, setReplyingToMessage] = useState<{
    id: string;
    sender_name: string;
    text: string;
  } | null>(null);
  const [isProcessingCommAttachment, setIsProcessingCommAttachment] = useState<boolean>(false);
  const [isSendingComm, setIsSendingComm] = useState<boolean>(false);
  const [initialTaskDraft, setInitialTaskDraft] = useState<InitialTaskDraft | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const avatarFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const commFileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  useDesignLinter(
    theme,
    `${activeSection}-${permissionsModalNode?.id || ''}-${drawerSelection?.id || ''}-${isAiDrawerOpen}`
  );

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
  const [profilePassword, setProfilePassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (currentProfile) {
      setProfileName(currentProfile.name || '');
      setProfileRoleTitle(currentProfile.role_type || '');
      setProfileDepartment(currentProfile.department || '');
      setProfileEmail(currentProfile.email || '');
      setProfilePassword('');
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
    const stored = (localStorage.getItem('tedcloud_bot_username') || '').replace(/^@/, '').trim();
    return stored === 'TedCloudEnterpriseBot' ? '' : stored;
  });

  useEffect(() => {
    const cleanServerBot = (serverBotUsername || '').replace(/^@/, '').trim();
    if (cleanServerBot && cleanServerBot !== 'TedCloudEnterpriseBot') {
      setBotUsername(cleanServerBot);
      localStorage.setItem('tedcloud_bot_username', cleanServerBot);
    }
  }, [serverBotUsername]);

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

  const visibleMessages = useMemo(() => {
    return safeMessages
      .filter((msg) => canUserSeeWorkspaceMessage(msg, currentProfile))
      .map((msg) => {
        const localReactions = optimisticReactionsMap[String(msg.id)];
        return localReactions ? { ...msg, reactions: localReactions } : msg;
      });
  }, [safeMessages, currentProfile, optimisticReactionsMap]);

  const activeThreadMessages = useMemo(() => {
    const list = filterMessagesForActiveThread(visibleMessages, activeCommThread, currentProfile);
    const getSafeTime = (m: any): number => {
      const raw = m?.created_at || m?.timestamp || m?.inserted_at;
      if (!raw) return 0;
      const t = new Date(raw).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const getDayRank = (m: any): number => {
      const ts = getSafeTime(m);
      if (!ts) return 0;
      const d = new Date(ts);
      return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    };
    return [...list].sort((a, b) => {
      const dayDiff = getDayRank(a) - getDayRank(b);
      if (dayDiff !== 0) return dayDiff;
      const timeDiff = getSafeTime(a) - getSafeTime(b);
      if (timeDiff !== 0) return timeDiff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }, [visibleMessages, activeCommThread, currentProfile]);

  useEffect(() => {
    if (activeSection !== 'communications' || commViewMode !== 'messenger') return;
    const threadKey = `${activeCommThread.type}:${activeCommThread.id}`;
    const currentCount = activeThreadMessages.length;
    const isThreadSwitch = lastScrolledThreadKeyRef.current !== threadKey;
    const isNewMessageAdded = currentCount > lastScrolledMsgCountRef.current;

    lastScrolledThreadKeyRef.current = threadKey;
    lastScrolledMsgCountRef.current = currentCount;

    if (!isThreadSwitch && !isNewMessageAdded) return;

    const timer = setTimeout(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      try {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: isThreadSwitch ? 'auto' : 'smooth',
        });
      } catch {
        container.scrollTop = container.scrollHeight;
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [
    activeSection,
    commViewMode,
    activeCommThread.type,
    activeCommThread.id,
    activeThreadMessages.length,
  ]);

  const broadcastMessagesCount = useMemo(
    () =>
      filterMessagesForActiveThread(
        visibleMessages,
        { type: 'broadcast', id: 'general', label: 'Общий поток' },
        currentProfile
      ).length,
    [visibleMessages, currentProfile]
  );

  const deptMessageCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const dept of companyDepartments) {
      map.set(
        dept,
        filterMessagesForActiveThread(
          visibleMessages,
          { type: 'department', id: dept, label: dept },
          currentProfile
        ).length
      );
    }
    return map;
  }, [companyDepartments, visibleMessages, currentProfile]);

  const directMessageCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!currentProfile) return map;
    for (const col of colleagueNodes) {
      const cnt = visibleMessages.filter((m) =>
        isDirectMessageBetweenUsers(
          m,
          currentProfile.id,
          currentProfile.name,
          col.id,
          col.name
        )
      ).length;
      map.set(String(col.id), cnt);
    }
    return map;
  }, [colleagueNodes, visibleMessages, currentProfile]);

  const kpis = useMemo(
    () => computeDashboardKpis(visibleLeads, visibleTasks, safeNodes),
    [visibleLeads, visibleTasks, safeNodes]
  );

  const showToast = (msg: string) => {
    const normalized =
      !isEn && msg === 'Organization subscription plan updated.'
        ? 'Тарифный план организации обновлен.'
        : msg;
    setToastBanner(normalized);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastBanner(null);
    }, 3000);
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
        showToast(
          isEn ? 'Payer billing details saved' : 'Реквизиты плательщика сохранены'
        );
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
          showToast(
            isEn
              ? `Invoice ${params.invoiceNumber} generated and ready to print`
              : `Инвойс ${params.invoiceNumber} сформирован и готов к печати`
          );
        } else {
          showToast(
            isEn
              ? `${params.plan} plan paid and activated`
              : `Тариф ${params.plan} успешно оплачен и активирован`
          );
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
      showToast(
        isEn ? 'Invoice status updated: Paid' : 'Статус счета обновлен: Оплачен'
      );
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
            lang: language,
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
        const builtIn = buildBuiltInChecklistForTask(
          task.title,
          task.description || task.notes,
          language
        );
        nextChecklist = builtIn.checklist;
        nextSummary = builtIn.summary;
      }

      await onPatchRecord('tasks', task.id, {
        checklist: nextChecklist,
        ai_summary: nextSummary,
      });
      setExpandedChecklistTaskIds((prev) => ({ ...prev, [task.id]: true }));
      showToast(
        isEn
          ? `AI decomposition complete: ${nextChecklist.length} subtasks created`
          : `ИИ-декомпозиция выполнена: создано ${nextChecklist.length} подзадач`
      );
    } finally {
      setDecomposingTaskId(null);
    }
  };

  const onCreateRecord = async (
    table: 'tasks' | 'crm_leads' | 'organization_nodes',
    payload: Record<string, any>
  ): Promise<{ ok: boolean; pushSent?: boolean }> => {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          payload: {
            company_id: companyId,
            actor_id: currentProfile?.id || undefined,
            actor_name: currentProfile?.name || undefined,
            ...payload,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && !data?.error) {
        await onRefresh();
        return { ok: true, pushSent: Boolean(data?.pushSent) };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  };

  const handleQuickCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTaskTitle.trim();
    if (!title || !canCreateOrEditTasks || isCreatingQuickTask) return;
    setIsCreatingQuickTask(true);
    try {
      const assigneeId = currentProfile?.id || safeNodes[0]?.id || null;
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          payload: {
            company_id: companyId,
            title,
            type: 'Task',
            priority: 'Medium',
            status: 'Todo',
            department: currentProfile?.department || null,
            assigned_to: assigneeId,
            owner_node_id: assigneeId,
            created_by: currentProfile?.id || assigneeId,
          },
        }),
      });
      if (response.ok) {
        setQuickTaskTitle('');
        await onRefresh();
        showToast(
          isEn ? 'Task created and added to queue' : 'Задача создана и добавлена в очередь'
        );
      }
    } finally {
      setIsCreatingQuickTask(false);
    }
  };

  const handleToggleDashboardSubtask = async (
    task: TaskRecord,
    subtaskId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!canCreateOrEditTasks) return;
    const currentList = Array.isArray(task.checklist) ? task.checklist : [];
    const nextList = currentList.map((item) =>
      item.id === subtaskId ? { ...item, done: !item.done } : item
    );
    await onPatchRecord('tasks', task.id, { checklist: nextList });
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

  // Filtered Lists & Slice Counters (Block 2)
  const isApprovalTaskHelper = (tItem: TaskRecord) =>
    String(tItem?.type || '').toLowerCase() === 'approval' ||
    (tItem?.title || '').startsWith('[СОГЛАСОВАНИЕ:') ||
    tItem?.status === 'Review';

  const isUrgentOrOverdueTaskHelper = (tItem: TaskRecord) => {
    if (!tItem || tItem.status === 'Done' || tItem.status === 'Cancelled') return false;
    if (tItem.priority === 'High') return true;
    if (tItem.due_date) {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (tItem.due_date < todayIso) return true;
    }
    return false;
  };

  const approvalsCount = useMemo(
    () => visibleTasks.filter((tItem) => isApprovalTaskHelper(tItem)).length,
    [visibleTasks]
  );

  const myTasksSliceCount = useMemo(
    () =>
      visibleTasks.filter(
        (tItem) =>
          currentProfile &&
          (tItem.assigned_to === currentProfile.id || tItem.owner_node_id === currentProfile.id)
      ).length,
    [visibleTasks, currentProfile]
  );

  const delegatedSliceCount = useMemo(
    () =>
      visibleTasks.filter(
        (tItem) =>
          currentProfile &&
          tItem.created_by === currentProfile.id &&
          tItem.assigned_to &&
          tItem.assigned_to !== currentProfile.id
      ).length,
    [visibleTasks, currentProfile]
  );

  const urgentOverdueSliceCount = useMemo(
    () => visibleTasks.filter((tItem) => isUrgentOrOverdueTaskHelper(tItem)).length,
    [visibleTasks]
  );

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((item) => {
      if (!item) return false;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || item.notes || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q) ||
        (item.id || '').toLowerCase().includes(q);

      const matchesMyTasks =
        !onlyMyTasks ||
        (currentProfile &&
          (item.assigned_to === currentProfile.id || item.owner_node_id === currentProfile.id));

      const matchesPriority =
        priorityFilter === 'ALL' || (item.priority || 'Medium') === priorityFilter;

      const isApproval = isApprovalTaskHelper(item);
      const matchesCategory = taskCategoryFilter === 'all' || isApproval;

      let matchesSlice = true;
      if (taskSliceFilter === 'mine') {
        matchesSlice = Boolean(
          currentProfile &&
            (item.assigned_to === currentProfile.id || item.owner_node_id === currentProfile.id)
        );
      } else if (taskSliceFilter === 'delegated') {
        matchesSlice = Boolean(
          currentProfile &&
            item.created_by === currentProfile.id &&
            item.assigned_to &&
            item.assigned_to !== currentProfile.id
        );
      } else if (taskSliceFilter === 'approvals') {
        matchesSlice = isApproval;
      } else if (taskSliceFilter === 'urgent_overdue') {
        matchesSlice = isUrgentOrOverdueTaskHelper(item);
      }

      return (
        matchesQuery &&
        matchesMyTasks &&
        matchesPriority &&
        matchesCategory &&
        matchesSlice
      );
    });
  }, [
    visibleTasks,
    searchQuery,
    onlyMyTasks,
    currentProfile,
    priorityFilter,
    taskCategoryFilter,
    taskSliceFilter,
  ]);

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

  const handleApprovalDecision = async (taskId: string, decision: 'approve' | 'reject') => {
    setBusyRecordId(taskId);
    try {
      const nextStatus: TaskStatus = decision === 'approve' ? 'Done' : 'Cancelled';
      const res = await onPatchRecord('tasks', taskId, {
        status: nextStatus,
        decided_by_name: currentProfile?.name || 'Руководитель',
      });
      if (res.ok) {
        showToast(
          decision === 'approve'
            ? isEn
              ? 'Request approved & notification sent'
              : 'Заявка утверждена, автору отправлено уведомление'
            : isEn
            ? 'Request rejected & notification sent'
            : 'Заявка отклонена, автору отправлено уведомление'
        );
      }
    } finally {
      setBusyRecordId(null);
    }
  };

  const handleLeadStatusChange = async (lead: CrmLeadRecord, nextStatus: CrmLeadStatus) => {
    if (!perms.crm_edit) return;
    const currentStatus = (lead.status || lead.stage || 'New') as CrmLeadStatus;
    if (currentStatus === nextStatus) return;

    setBusyRecordId(lead.id);
    try {
      const res = await onPatchRecord('crm_leads', lead.id, { status: nextStatus });
      if (res.ok && autoPipelineEnabled) {
        const clientLabel = lead.client_name || lead.full_name || lead.title || 'Контрагент';
        const managerId = lead.assigned_to || lead.owner_node_id || currentProfile?.id || null;
        const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

        if (nextStatus === 'Negotiation') {
          await onCreateRecord('tasks', {
            company_id: companyId,
            title: isEn
              ? `Prepare Commercial Proposal & agree terms: ${clientLabel}`
              : `Подготовить КП и согласовать условия: ${clientLabel}`,
            type: 'Task',
            priority: 'High',
            status: 'Todo',
            assigned_to: managerId,
            owner_node_id: managerId,
            department: lead.department || null,
            lead_id: lead.id,
            due_date: tomorrowIso,
          });
          showToast(
            isEn
              ? `Auto-Pipeline: Task created for "${clientLabel}"`
              : `Авто-воронка: создана задача по сделке «${clientLabel}»`
          );
        } else if (nextStatus === 'Won') {
          await onCreateRecord('tasks', {
            company_id: companyId,
            title: isEn
              ? `Issue invoice & launch project: ${clientLabel}`
              : `Выставить счет и запустить проект: ${clientLabel}`,
            type: 'Task',
            priority: 'High',
            status: 'Todo',
            assigned_to: managerId,
            owner_node_id: managerId,
            department: lead.department || null,
            lead_id: lead.id,
            due_date: tomorrowIso,
          });
          showToast(
            isEn
              ? `Auto-Pipeline: Onboarding task created for "${clientLabel}"`
              : `Авто-воронка: назначена задача на запуск проекта «${clientLabel}»`
          );
        }
      }
    } finally {
      setBusyRecordId(null);
    }
  };

  const handleSaveNodePermissionsMatrix = async (
    nodeId: string,
    accessLevel: AccessLevel,
    permissions: EmployeePermissions,
    profileUpdates?: {
      name?: string;
      role_type?: string;
      department?: string | null;
      email?: string | null;
    }
  ) => {
    setBusyRecordId(nodeId);
    try {
      const res = await onPatchRecord('organization_nodes', nodeId, {
        ...(profileUpdates || {}),
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
      if (profilePassword.trim()) {
        updates.password = profilePassword.trim();
      }
      if (perms.team_manage && profileRoleTitle.trim()) {
        updates.role_type = profileRoleTitle.trim();
        updates.department = profileDepartment.trim() || null;
      }

      const res = await onPatchRecord('organization_nodes', currentProfile.id, updates);
      if (res.ok) {
        setProfilePassword('');
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
        showToast(isEn ? 'Profile photo updated' : 'Фотография профиля обновлена');
      }
    } catch (err: any) {
      showToast(
        err?.message || (isEn ? 'Error processing photo' : 'Ошибка при обработке фотографии')
      );
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
        showToast(isEn ? 'Profile photo removed' : 'Фотография профиля удалена');
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCommFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingCommAttachment(true);
    try {
      const processed = await processAttachmentFiles(files);
      setCommAttachments((prev) => [...prev, ...processed]);
    } catch (err: any) {
      showToast(
        err?.message || (isEn ? 'Failed to attach file' : 'Ошибка прикрепления файла')
      );
    } finally {
      setIsProcessingCommAttachment(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleToggleMessageReaction = (
    msg: WorkspaceMessageRecord,
    emoji: string
  ) => {
    const msgId = String(msg.id);
    const actorId = String(currentProfile?.id || 'root');
    const baseReactions =
      optimisticReactionsMap[msgId] ||
      (msg.reactions && typeof msg.reactions === 'object' ? msg.reactions : {});
    const currentReactions: Record<string, string[]> = { ...baseReactions };
    const existingList = Array.isArray(currentReactions[emoji])
      ? [...currentReactions[emoji]]
      : [];
    const hasReacted = existingList.includes(actorId);
    const nextList = hasReacted
      ? existingList.filter((id) => id !== actorId)
      : [...existingList, actorId];

    if (nextList.length > 0) {
      currentReactions[emoji] = nextList;
    } else {
      delete currentReactions[emoji];
    }

    setOptimisticReactionsMap((prev) => ({
      ...prev,
      [msgId]: currentReactions,
    }));

    void onPatchRecord('workspace_messages', msg.id, {
      reactions: currentReactions,
    });
  };

  const submitCurrentCommMessage = async (overrideText?: string) => {
    const msgBody = (typeof overrideText === 'string' ? overrideText : commText).trim();
    if ((!msgBody && commAttachments.length === 0) || !onSendMessage) return;

    const finalText =
      msgBody ||
      (isEn
        ? `Attached: ${commAttachments.map((a) => a.name).join(', ')}`
        : `Вложение: ${commAttachments.map((a) => a.name).join(', ')}`);

    const pendingReply = replyingToMessage;
    const pendingFiles = [...commAttachments];
    const pendingUrgent = commUrgent;

    if (commText) setCommText('');
    if (commAttachments.length > 0) setCommAttachments([]);
    if (commUrgent) setCommUrgent(false);
    if (replyingToMessage) setReplyingToMessage(null);
    if (showEmojiPicker) setShowEmojiPicker(false);

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
      message_text: finalText,
      text: finalText,
      is_urgent: pendingUrgent,
      is_read: false,
      attachments: pendingFiles,
      reply_to: pendingReply || null,
    };

    void onSendMessage(payload);
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
        formatted = new Date(y, m - 1, d).toLocaleDateString(isEn ? 'en-US' : 'ru-RU', {
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
        <span>
          {isEn ? 'Due:' : 'Срок:'} {formatted}
        </span>
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
            className={SECONDARY_BTN_CLASS}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
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

  if (dealRoomPreviewId) {
    const dealForRoom =
      safeLeads.find((l) => String(l.id) === String(dealRoomPreviewId)) || safeLeads[0];
    if (dealForRoom) {
      return (
        <>
          <ClientDealRoomView
            deal={dealForRoom}
            company={company}
            tasks={safeTasks}
            onCloseRoom={() => {
              setDealRoomPreviewId(null);
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('deal_room');
                window.history.replaceState({}, '', url.toString());
              }
            }}
            onOpenLegalDocs={(d) => setLegalDocModalDeal(d)}
          />
          <LegalDocumentGeneratorModal
            deal={legalDocModalDeal}
            company={company}
            onClose={() => setLegalDocModalDeal(null)}
          />
        </>
      );
    }
  }

  return (
    <div
      className={`flex h-dvh w-full max-w-full overflow-hidden font-sans antialiased ${
        theme === 'light'
          ? 'theme-light bg-[#F3F2EE] text-[#18181B]'
          : 'theme-dark bg-[#0E1015] text-[#EDEDED]'
      }`}
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

      <div className="flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto flex flex-col lg:m-2.5 lg:rounded-2xl bg-[#14161C] border border-white/[0.07] shadow-[0_0_50px_-12px_rgba(0,0,0,0.65)] relative">
        <TopBar
          companyId={companyId}
          companyName={companyName}
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={
            !perms.crm_view && !perms.team_manage
              ? isEn
                ? 'Search tasks and messages...'
                : 'Поиск по задачам и сообщениям...'
              : t('actions.searchPlaceholder')
          }
          isSyncing={isSyncing}
          onRefresh={onRefresh}
          onOpenCommandBar={() => setIsCommandBarOpen(true)}
          onOpenAiCopilot={() => setIsAiDrawerOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          currentProfile={currentProfile}
          tasks={visibleTasks}
          onSyncShiftState={async (status, startedAt) => {
            if (currentProfile) {
              await onPatchRecord('organization_nodes', currentProfile.id, {
                shift_status: status,
                shift_started_at: startedAt,
              });
            }
          }}
          onCreateWorkShift={onCreateWorkShift}
          onPostShiftSummary={async (summaryText) => {
            if (onSendMessage) {
              await onSendMessage({
                company_id: companyId,
                sender_id: currentProfile?.id || 'root',
                sender_name: currentProfile?.name || 'Сотрудник',
                sender_role: currentProfile?.role_type || 'Специалист',
                target_type: 'broadcast',
                target_label: 'Всем сотрудникам',
                message_text: summaryText,
                text: summaryText,
                is_urgent: false,
              });
            }
          }}
          showToast={showToast}
        />

        {toastBanner && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed top-4 right-4 z-50 max-w-sm flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium transition-all duration-200 ${
              theme === 'light'
                ? 'bg-[#FAF9F5] border-[#D6D3CD] text-[#18181B] shadow-[0_10px_30px_-5px_rgba(24,24,27,0.14)]'
                : 'bg-[#14161C] border-white/12 text-zinc-100 shadow-2xl'
            }`}
          >
            {/(ошибк|error|fail|не удал)/i.test(toastBanner) ? (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span className="leading-snug">{toastBanner}</span>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5 pb-24 lg:pb-8 max-w-7xl w-full max-w-full overflow-x-hidden mx-auto space-y-5">
          {/* Page Header & Contextual Controls (Zero Boilerplate Subtitles — Swiss / Linear Standard) */}
          <div
            className={`${
              activeSection === 'communications' && mobileChatOpen ? 'hidden lg:flex' : 'flex'
            } flex-col sm:flex-row sm:items-center justify-between gap-3`}
          >
            <div>
              <h1 className="text-lg font-semibold text-white tracking-[-0.02em]">
                {activeSection === 'overview' && t('header.overviewTitle')}
                {activeSection === 'tasks' && t('header.tasksTitle')}
                {activeSection === 'crm' && t('header.crmTitle')}
                {activeSection === 'communications' && t('header.communicationsTitle')}
                {activeSection === 'shifts' && t('header.shiftsTitle')}
                {activeSection === 'team' && t('header.teamTitle')}
                {activeSection === 'profile' && t('header.profileTitle')}
                {activeSection === 'workspace' && t('header.workspaceTitle')}
              </h1>
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
                    <span>{isEn ? 'Overview' : 'Обзор'}</span>
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
                    <span>{isEn ? 'Teamwork Graph' : 'Карта связей (Teamwork Graph)'}</span>
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
                    <span>{isEn ? 'Staff Directory' : 'Реестр штата'}</span>
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
                    <span>{isEn ? 'Teamwork Graph' : 'Карта связей (Teamwork Graph)'}</span>
                  </button>
                </div>
              )}

              {/* Switcher: Мессенджер и Каналы / Реестр документов и Регламенты on Communications */}
              {activeSection === 'communications' && (
                <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#141418] p-0.5">
                  <button
                    type="button"
                    onClick={() => setCommViewMode('messenger')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      commViewMode === 'messenger'
                        ? 'bg-zinc-800 text-white border border-white/10'
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isEn ? 'Messenger & Channels' : 'Мессенджер и Каналы'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommViewMode('vault')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      commViewMode === 'vault'
                        ? 'bg-zinc-800 text-white border border-white/10'
                        : 'text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {isEn
                        ? 'Document Vault & Playbooks'
                        : 'Реестр документов и Регламенты'}
                    </span>
                  </button>
                </div>
              )}

              {activeSection === 'tasks' && (
                <button
                  type="button"
                  onClick={() => setIsRequestApprovalModalOpen(true)}
                  className={SECONDARY_BTN_CLASS}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isEn ? '+ Request Approval' : '+ Запрос на согласование'}</span>
                </button>
              )}

              {(activeSection === 'overview' || activeSection === 'tasks') &&
                canCreateOrEditTasks && (
                  <button
                    onClick={() => setModalType('tasks')}
                    className={PRIMARY_BTN_CLASS}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('actions.newTask').replace(/^\+\s*/, '')}</span>
                  </button>
                )}

              {activeSection === 'crm' && perms.crm_edit && (
                <button
                  onClick={() => setModalType('crm_leads')}
                  className={PRIMARY_BTN_CLASS}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('actions.newDeal').replace(/^\+\s*/, '')}</span>
                </button>
              )}

              {activeSection === 'team' && perms.team_manage && (
                <button
                  onClick={() => setModalType('organization_nodes')}
                  className={PRIMARY_BTN_CLASS}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('actions.newEmployee').replace(/^\+\s*/, '')}</span>
                </button>
              )}
            </div>
          </div>

          {/* =================================================================
              TAB 1: ДАШБОРД / EXECUTIVE BENTO OVERVIEW (БЛОК 3)
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
                  onSelectEmployee={
                    perms.team_manage ? (emp) => setPermissionsModalNode(emp) : undefined
                  }
                />
              ) : (
                <>
                  {/* ВЕРХНИЙ РЯД: 4 МНОГОСЛОЙНЫЕ KPI-КАРТОЧКИ С МИКРО-ВИЗУАЛИЗАЦИЕЙ */}
                  {(() => {
                    const totalTaskCount = visibleTasks.length;
                    const taskCompletionPct =
                      totalTaskCount > 0
                        ? Math.round((completedTasksCount / totalTaskCount) * 100)
                        : 0;
                    const tgConnectedCount = safeNodes.filter((n) =>
                      Boolean(n.telegram_chat_id)
                    ).length;
                    const tgConnectedPct =
                      safeNodes.length > 0
                        ? Math.round((tgConnectedCount / safeNodes.length) * 100)
                        : 0;
                    const wonSharePct =
                      totalPipelineValue > 0
                        ? Math.round((wonPipelineValue / totalPipelineValue) * 100)
                        : 0;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* KPI 1: Активные задачи + прогресс-бар выполнения */}
                        <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 shadow-xl flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-[#8E8E93] mb-2">
                              <span className="text-xs font-medium">{t('kpi.totalTasks')}</span>
                              <Clock className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-2xl font-semibold text-white tracking-tight tabular-nums">
                                {kpis.activeTasksCount}
                              </div>
                              {highPriorityOpenCount > 0 && (
                                <span className="text-[11px] text-red-400 font-medium whitespace-nowrap">
                                  {highPriorityOpenCount} {t('kpi.highPriority')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#71717A] tabular-nums">
                              <span>
                                {t('kpi.completed')}: {completedTasksCount}/{totalTaskCount}
                              </span>
                              <span>{taskCompletionPct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(4, taskCompletionPct)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* KPI 2: Штат и узлы + индикатор синхронизации Telegram */}
                        <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 shadow-xl flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between text-[#8E8E93] mb-2">
                              <span className="text-xs font-medium">{t('kpi.orgStructure')}</span>
                              <Users className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-2xl font-semibold text-white tracking-tight tabular-nums">
                                {safeNodes.length}
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-medium text-emerald-400 tabular-nums">
                                <Send className="w-2.5 h-2.5" />
                                <span>{tgConnectedPct}% TG</span>
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#71717A] tabular-nums">
                              <span>
                                {t('kpi.telegramConnected')}: {tgConnectedCount}/{safeNodes.length}
                              </span>
                              <span>{companyDepartments.length} {isEn ? 'depts' : 'отд.'}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(4, tgConnectedPct)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {perms.crm_view ? (
                          <>
                            {/* KPI 3: Конверсия в закрытие */}
                            <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 shadow-xl flex flex-col justify-between space-y-3">
                              <div>
                                <div className="flex items-center justify-between text-[#8E8E93] mb-2">
                                  <span className="text-xs font-medium">
                                    {t('kpi.conversionRate')}
                                  </span>
                                  <Percent className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="text-2xl font-semibold text-white tracking-tight tabular-nums">
                                  {kpis.conversionRatePercent}%
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-[#71717A] tabular-nums">
                                  <span>
                                    {t('kpi.wonDeals')}:{' '}
                                    {
                                      visibleLeads.filter((l) => (l.status || l.stage) === 'Won')
                                        .length
                                    }{' '}
                                    / {visibleLeads.length}
                                  </span>
                                  <span>{kpis.conversionRatePercent}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.max(4, kpis.conversionRatePercent)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* KPI 4: Объем воронки */}
                            <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 shadow-xl flex flex-col justify-between space-y-3">
                              <div>
                                <div className="flex items-center justify-between text-[#8E8E93] mb-2">
                                  <span className="text-xs font-medium">
                                    {t('kpi.pipelineVolume')}
                                  </span>
                                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="text-2xl font-semibold text-white tracking-tight tabular-nums truncate">
                                  {formatMoney(totalPipelineValue)}
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-emerald-400/90 tabular-nums">
                                  <span className="truncate">
                                    {t('kpi.closedWon')}: {formatMoney(wonPipelineValue)}
                                  </span>
                                  <span>{wonSharePct}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.max(6, wonSharePct)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 shadow-xl flex flex-col justify-between space-y-3">
                              <div>
                                <div className="flex items-center justify-between text-[#8E8E93] mb-2">
                                  <span className="text-xs font-medium">
                                    {isEn ? 'Urgent Assignments' : 'Срочные поручения'}
                                  </span>
                                  <AlertCircle className="w-4 h-4 text-amber-400" />
                                </div>
                                <div className="text-2xl font-semibold text-white tracking-tight tabular-nums">
                                  {highPriorityOpenCount}
                                </div>
                              </div>
                              <div className="text-[11px] text-[#71717A]">
                                {isEn ? 'In progress now:' : 'В работе сейчас:'}{' '}
                                {
                                  visibleTasks.filter((tItem) => tItem.status === 'In Progress')
                                    .length
                                }
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-4 shadow-xl flex flex-col justify-between space-y-3">
                              <div>
                                <div className="flex items-center justify-between text-[#8E8E93] mb-2">
                                  <span className="text-xs font-medium">
                                    {isEn ? 'Corporate Feed & Messages' : 'Инфополе и сообщения'}
                                  </span>
                                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="text-2xl font-semibold text-white tracking-tight tabular-nums">
                                  {visibleMessages.length}
                                </div>
                              </div>
                              <div className="text-[11px] text-emerald-400/90">
                                <button
                                  type="button"
                                  onClick={() => setActiveSection('communications')}
                                  className="hover:underline"
                                >
                                  {isEn
                                    ? 'Open corporate messenger →'
                                    : 'Открыть корпоративный чат →'}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Персональная сводка продуктивности для сотрудников без доступа к CRM (!perms.crm_view) */}
                  {!perms.crm_view && (
                    <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.07] pb-3.5">
                        <div>
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                            {isEn
                              ? 'Personal Productivity Summary'
                              : 'Персональная сводка продуктивности'}
                          </h2>
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            {isEn
                              ? 'Your active tasks, urgent assignments, and latest corporate feed messages'
                              : 'Ваши активные задачи, срочные поручения и последние сообщения из корпоративного инфополя'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveSection('tasks')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Go to Tasks' : 'Перейти к задачам'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSection('communications')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#17171A] hover:bg-[#222226] text-xs font-medium text-white transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('nav.communications')}</span>
                          </button>
                        </div>
                      </div>

                      {visibleMessages.length === 0 ? (
                        <div className="text-xs text-[#71717A] py-2">
                          {isEn
                            ? 'No new messages in your corporate feed yet.'
                            : 'В вашем инфополе пока нет новых сообщений.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {visibleMessages.slice(0, 3).map((msg) => {
                            const senderNode = msg.sender_id
                              ? nodeMap.get(String(msg.sender_id))
                              : null;
                            const sName =
                              senderNode?.name ||
                              msg.sender_name ||
                              (isEn ? 'TedCloud Employee' : 'Сотрудник TedCloud');
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
                                      {isEn ? 'Urgent' : 'Срочно'}
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

                  {/* НИЖНИЙ РЯД BENTO-СЕТКИ: 7 КОЛОНОК СЛЕВА (ЗАДАЧИ + АКТИВНЫЕ СМЕНЫ) И 5 КОЛОНОК СПРАВА (ВОРОНКА + ПУЛЬС КОМАНДЫ) */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    {/* ЛЕВАЯ КОЛОНКА (xl:col-span-7): Приоритетные задачи + Активные смены и табель сегодня */}
                    <div className="xl:col-span-7 space-y-6">
                      <div className="rounded-xl border border-white/[0.08] bg-[#111114] shadow-xl overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                            {isEn
                              ? 'Priority Tasks & Assignments'
                              : 'Приоритетные задачи и поручения'}
                          </h2>
                          <span className="text-[11px] font-medium tabular-nums text-[#71717A] bg-[#1A1A1C] px-2 py-0.5 rounded whitespace-nowrap">
                            {visibleTasks.length}
                          </span>
                        </div>
                        <button
                          onClick={() => setActiveSection('tasks')}
                          className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors whitespace-nowrap"
                        >
                          {isEn ? 'All Tasks →' : 'Все задачи →'}
                        </button>
                      </div>

                      {/* Строка мгновенного создания задачи (Quick Add Task на Enter) */}
                      {canCreateOrEditTasks && (
                        <form
                          onSubmit={handleQuickCreateTask}
                          className="px-4 py-2.5 border-b border-white/[0.06] bg-[#141418] flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4 text-[#71717A] shrink-0" />
                          <input
                            type="text"
                            value={quickTaskTitle}
                            onChange={(e) => setQuickTaskTitle(e.target.value)}
                            placeholder={
                              isEn
                                ? 'Quickly create a task and press Enter...'
                                : 'Быстро создать задачу и нажать Enter...'
                            }
                            className="flex-1 bg-transparent border-0 text-xs text-white placeholder-[#71717A] focus:outline-none py-1"
                          />
                          {quickTaskTitle.trim() && (
                            <button
                              type="submit"
                              disabled={isCreatingQuickTask}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-black hover:bg-[#E4E4E7] text-[11px] font-semibold transition-colors shrink-0"
                            >
                              {isCreatingQuickTask ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              <span>{isEn ? 'Add' : 'Создать'}</span>
                            </button>
                          )}
                        </form>
                      )}

                      {visibleTasks.length === 0 ? (
                        <RichEmptyState
                          variant="tasks"
                          compact
                          title={t('tasks.emptyTitle')}
                          description={t('tasks.empty')}
                          quickCards={[
                            {
                              step: isEn ? 'Step 1' : 'Шаг 1',
                              title: isEn
                                ? 'Create First Assignment'
                                : '1. Создать первое поручение',
                              subtitle: isEn
                                ? 'Set priority, SLA deadline & assignee'
                                : 'Назначьте ответственного и срок SLA',
                              icon: 'plus',
                              onClick: () => setModalType('tasks'),
                            },
                            {
                              step: isEn ? 'Step 2' : 'Шаг 2',
                              title: isEn
                                ? 'Generate Plan via TedCloud Intelligence'
                                : '2. Сгенерировать план через TedCloud Intelligence',
                              subtitle: isEn
                                ? 'Decompose goals into actionable steps'
                                : 'ИИ-декомпозиция целей на подзадачи',
                              icon: 'ai',
                              onClick: () => setIsAiDrawerOpen(true),
                            },
                            {
                              step: isEn ? 'Step 3' : 'Шаг 3',
                              title: isEn
                                ? 'Switch to Kanban Board'
                                : '3. Переключить на Канбан-доску',
                              subtitle: isEn
                                ? 'Visual workflow across stages'
                                : 'Визуальный контроль статусов выполнения',
                              icon: 'kanban',
                              onClick: () => {
                                setActiveSection('tasks');
                                setTaskViewMode('board');
                              },
                            },
                          ]}
                        />
                      ) : (
                        <div className="divide-y divide-white/[0.06]">
                          {visibleTasks.slice(0, 8).map((task) => {
                            const assignee = task.assigned_to
                              ? nodeMap.get(task.assigned_to)
                              : null;
                            const checklist = Array.isArray(task.checklist) ? task.checklist : [];
                            const doneSubtasks = checklist.filter((c) => c.done).length;
                            const isDecomposing = decomposingTaskId === task.id;
                            const isChecklistExpanded = Boolean(
                              expandedChecklistTaskIds[task.id]
                            );

                            return (
                              <div
                                key={task.id}
                                onClick={() => setDrawerSelection({ kind: 'task', id: task.id })}
                                className="px-5 py-3.5 hover:bg-[#16161A] transition-colors cursor-pointer space-y-2.5"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      {renderPriorityBadge(task.priority)}
                                      {renderTaskStatusBadge(task.status)}
                                      {renderDueDateBadge(task.due_date, task.status)}
                                      {task.department && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[11px] text-[#D4D4D8]">
                                          {formatRole(task.department)}
                                        </span>
                                      )}
                                      {checklist.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedChecklistTaskIds((prev) => ({
                                              ...prev,
                                              [task.id]: !prev[task.id],
                                            }));
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] tabular-nums text-zinc-200 transition-colors"
                                          title={
                                            isEn
                                              ? 'Toggle AI subtask checklist'
                                              : 'Развернуть чек-лист подзадач'
                                          }
                                        >
                                          <ListChecks className="w-3 h-3 text-indigo-400" />
                                          <span>
                                            {doneSubtasks}/{checklist.length}
                                          </span>
                                          {isChecklistExpanded ? (
                                            <ChevronUp className="w-3 h-3 text-zinc-400" />
                                          ) : (
                                            <ChevronDown className="w-3 h-3 text-zinc-400" />
                                          )}
                                        </button>
                                      )}
                                      {assignee ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                                          <UserAvatar
                                            name={assignee.name}
                                            avatarUrl={assignee.avatar_url}
                                            size="xs"
                                          />
                                          <span>
                                            {assignee.name} ({formatRole(assignee.role_type)})
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-xs text-[#71717A]">
                                          {t('tasks.unassigned')}
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
                                        title={
                                          isEn
                                            ? 'Decompose task into AI subtask checklist'
                                            : 'ИИ-декомпозиция задачи на чек-лист подзадач'
                                        }
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors whitespace-nowrap"
                                      >
                                        {isDecomposing ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Cpu className="w-3 h-3 text-indigo-400" />
                                        )}
                                        <span>{isEn ? 'AI Subtasks' : 'ИИ-декомпозиция'}</span>
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
                                      <option value="In Progress">
                                        {t('status.In Progress')}
                                      </option>
                                      <option value="Done">{t('status.Done')}</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Раскрывающийся интерактивный чек-лист подзадач прямо в карточке на дашборде */}
                                {checklist.length > 0 && isChecklistExpanded && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-lg border border-white/[0.07] bg-[#151519] p-2.5 space-y-1.5"
                                  >
                                    {checklist.map((subItem) => (
                                      <button
                                        key={subItem.id}
                                        type="button"
                                        onClick={(e) =>
                                          void handleToggleDashboardSubtask(task, subItem.id, e)
                                        }
                                        className="w-full flex items-center gap-2 text-left text-xs px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
                                      >
                                        <span
                                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                            subItem.done
                                              ? 'bg-emerald-500 border-emerald-500 text-black'
                                              : 'border-zinc-600'
                                          }`}
                                        >
                                          {subItem.done && <Check className="w-2.5 h-2.5" />}
                                        </span>
                                        <span
                                          className={
                                            subItem.done
                                              ? 'text-[#71717A] line-through'
                                              : 'text-zinc-200'
                                          }
                                        >
                                          {subItem.title}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      </div>

                      {/* Виджет «Активные смены и табель сегодня» под блоком Приоритетные задачи — выравнивает высоту левой и правой колонок */}
                      <DashboardShiftsOverviewWidget
                        nodes={safeNodes}
                        workShifts={safeWorkShifts}
                        onOpenShiftsSection={() => setActiveSection('shifts')}
                      />
                    </div>

                    {/* ПРАВАЯ КОЛОНКА (xl:col-span-5): 2 АНАЛИТИЧЕСКИХ EXECUTIVE-БЛОКА */}
                    <div className="xl:col-span-5 space-y-6">
                      {/* 1. Структура воронки CRM (Pipeline Breakdown) */}
                      {perms.crm_view && (
                        <div className="rounded-xl border border-white/[0.08] bg-[#111114] shadow-xl p-5 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-emerald-400" />
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                {isEn ? 'CRM Pipeline Breakdown' : 'Структура воронки CRM'}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSection('crm')}
                              className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                            >
                              {isEn ? 'Open CRM →' : 'Воронка →'}
                            </button>
                          </div>

                          <div className="space-y-3.5">
                            {(
                              [
                                {
                                  stage: 'New' as CrmLeadStatus,
                                  label: t('stage.New'),
                                  barColor: 'bg-blue-500',
                                },
                                {
                                  stage: 'Negotiation' as CrmLeadStatus,
                                  label: t('stage.Negotiation'),
                                  barColor: 'bg-amber-500',
                                },
                                {
                                  stage: 'Won' as CrmLeadStatus,
                                  label: t('stage.Won'),
                                  barColor: 'bg-emerald-500',
                                },
                              ] as const
                            ).map((row) => {
                              const stageLeads = visibleLeads.filter(
                                (l) => (l.status || l.stage || 'New') === row.stage
                              );
                              const stageSum = stageLeads.reduce(
                                (acc, l) => acc + Number(l.amount ?? l.deal_value ?? 0),
                                0
                              );
                              const sharePct =
                                totalPipelineValue > 0
                                  ? Math.round((stageSum / totalPipelineValue) * 100)
                                  : 0;

                              return (
                                <div key={row.stage} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-white">{row.label}</span>
                                      <span className="text-[11px] tabular-nums text-[#71717A]">
                                        ({stageLeads.length})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 tabular-nums">
                                      <span className="font-semibold text-white">
                                        {formatMoney(stageSum)}
                                      </span>
                                      <span className="text-[11px] text-[#8E8E93] w-9 text-right">
                                        {sharePct}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                                    <div
                                      className={`h-full ${row.barColor} rounded-full transition-all duration-300`}
                                      style={{ width: `${Math.max(4, sharePct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Загрузка подразделений и пульс команды (Team Workload & Organization Pulse) */}
                      <div className="rounded-xl border border-white/[0.08] bg-[#111114] shadow-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                              {isEn
                                ? 'Team Workload & Organization Pulse'
                                : 'Загрузка подразделений и пульс команды'}
                            </h3>
                          </div>
                          {perms.team_manage && (
                            <button
                              type="button"
                              onClick={() => setActiveSection('team')}
                              className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                            >
                              {isEn ? 'Manage →' : 'Штат →'}
                            </button>
                          )}
                        </div>

                        <div className="divide-y divide-white/[0.06]">
                          {safeNodes.slice(0, 6).map((member) => {
                            const memberActiveTasks = visibleTasks.filter(
                              (tItem) =>
                                tItem.status !== 'Done' &&
                                (tItem.assigned_to === member.id ||
                                  tItem.owner_node_id === member.id)
                            ).length;
                            const hasTg = Boolean(member.telegram_chat_id);

                            return (
                              <div
                                key={member.id}
                                onClick={() => {
                                  if (perms.team_manage) {
                                    setPermissionsModalNode(member);
                                  }
                                }}
                                className={`py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 ${
                                  perms.team_manage
                                    ? 'cursor-pointer hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <UserAvatar
                                    name={member.name}
                                    avatarUrl={member.avatar_url}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-white truncate">
                                      {member.name}
                                    </div>
                                    <div className="text-[11px] text-[#8E8E93] truncate">
                                      {formatRole(member.role_type)}
                                      {member.department
                                        ? ` · ${formatRole(member.department)}`
                                        : ''}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded bg-[#18181B] border border-white/[0.08] text-[11px] font-medium tabular-nums text-white"
                                    title={isEn ? 'Active tasks' : 'Активных задач'}
                                  >
                                    {memberActiveTasks} {isEn ? 'tasks' : 'задач'}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                      hasTg
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-zinc-900 border-white/[0.07] text-[#71717A]'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        hasTg ? 'bg-emerald-400' : 'bg-zinc-500'
                                      }`}
                                    />
                                    <span>{hasTg ? 'TG' : isEn ? 'Offline' : 'Ожид.'}</span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Виджет финансовой эффективности и SLA (Unit Economics & SLA Radar) */}
                  <ExecutiveUnitEconomicsRadar
                    leads={visibleLeads}
                    tasks={visibleTasks}
                    nodes={safeNodes}
                    onOpenCrm={perms.crm_view ? () => setActiveSection('crm') : undefined}
                    onOpenTasks={() => setActiveSection('tasks')}
                  />
                </>
              )}
            </div>
          )}

            {/* =================================================================
                TAB 2: ЗАДАЧИ / TASKS — ПОЛНОЭКРАННАЯ «СТЕНА ЗАДАЧ» (4-КОЛОНОЧНЫЙ КАНБАН С DRAG & DROP + ГРУППЫ LINEAR + ТАЙМЛАЙН)
            ================================================================== */}
            {activeSection === 'tasks' && (
              <div className="space-y-4">
                {canCreateOrEditTasks && (
                  <QuickInlineTaskBar
                    nodes={safeNodes}
                    leads={visibleLeads}
                    defaultAssigneeId={currentProfile?.id || ''}
                    inputRef={quickTaskInputRef}
                    onCreateTask={async (payload) => {
                      await onCreateRecord('tasks', {
                        company_id: companyId,
                        title: payload.title,
                        type: 'Task',
                        priority: payload.priority,
                        status: 'Todo',
                        assigned_to: payload.assigned_to || currentProfile?.id || null,
                        owner_node_id: payload.assigned_to || currentProfile?.id || null,
                        created_by: currentProfile?.id || null,
                        due_date: payload.due_date,
                        lead_id: payload.lead_id || null,
                      });
                    }}
                  />
                )}

                <section className="rounded-xl border border-white/[0.07] bg-[#111114] overflow-hidden shadow-2xl">
                  {/* ВЕРХНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ (БЛОК 2): Быстрые вкладки-срезы слева + Переключатель Стена/Группы/Таймлайн справа */}
                  <div className="px-4 sm:px-5 py-3.5 border-b border-white/[0.07] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                    {/* Слева: Быстрые вкладки-срезы */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          {
                            id: 'all' as const,
                            label: isEn ? 'All Tasks' : 'Все задачи',
                            count: visibleTasks.length,
                          },
                          {
                            id: 'mine' as const,
                            label: isEn ? 'My Assignments' : 'Мои поручения',
                            count: myTasksSliceCount,
                          },
                          {
                            id: 'delegated' as const,
                            label: isEn ? 'Delegated by Me' : 'Делегировано мной',
                            count: delegatedSliceCount,
                          },
                          {
                            id: 'approvals' as const,
                            label: isEn ? 'Approvals' : 'Согласования',
                            count: approvalsCount,
                          },
                          {
                            id: 'urgent_overdue' as const,
                            label: isEn ? 'Urgent / Overdue' : 'Горящие / Просроченные',
                            count: urgentOverdueSliceCount,
                          },
                        ]
                      ).map((tab) => {
                        const isActive = taskSliceFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setTaskSliceFilter(tab.id);
                              setTaskCategoryFilter('all');
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border ${
                              isActive
                                ? 'bg-white text-black border-white shadow-xs'
                                : 'bg-[#16161A] text-[#A1A1AA] border-white/[0.08] hover:text-white hover:bg-[#1C1C22]'
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold tabular-nums ${
                                isActive
                                  ? 'bg-black/15 text-current'
                                  : tab.id === 'urgent_overdue' && tab.count > 0
                                  ? 'bg-red-500/20 text-red-300'
                                  : tab.id === 'approvals' && tab.count > 0
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : 'bg-zinc-800/80 text-zinc-400'
                              }`}
                            >
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Справа: Действия, фильтр приоритета и переключатель режимов Стена (Канбан) / Группы (Список Linear) / Таймлайн */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRequestApprovalModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-medium text-indigo-300 transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Request Approval' : 'Запрос на согласование'}</span>
                      </button>

                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'ALL')}
                        className="rounded-lg border border-white/10 bg-[#161618] px-2.5 py-1.5 text-xs text-[#D4D4D8] focus:outline-none"
                      >
                        <option value="ALL">{t('tasks.allPriorities')}</option>
                        <option value="High">{t('priority.High')}</option>
                        <option value="Medium">{t('priority.Medium')}</option>
                        <option value="Low">{t('priority.Low')}</option>
                      </select>

                      {perms.data_export && (
                        <button
                          onClick={handleExportTasksCsv}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#161618] text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                      )}

                      <div className="inline-flex rounded-lg border border-white/10 bg-[#16161A] p-0.5">
                        <button
                          type="button"
                          onClick={() => setTaskViewMode('board')}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                            taskViewMode === 'board'
                              ? 'bg-zinc-800 text-white border border-white/10'
                              : 'text-[#8E8E93] hover:text-white'
                          }`}
                        >
                          <Columns3 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{isEn ? 'Wall (Kanban)' : 'Стена (Канбан)'}</span>
                        </button>
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
                          <span>{isEn ? 'Groups (Linear List)' : 'Группы (Список Linear)'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskViewMode('timeline')}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                            taskViewMode === 'timeline'
                              ? 'bg-zinc-800 text-white border border-white/10'
                              : 'text-[#8E8E93] hover:text-white'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{isEn ? 'Timeline' : 'Таймлайн сроков'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredTasks.length === 0 ? (
                    <RichEmptyState
                      variant="tasks"
                      title={t('tasks.emptyTitle')}
                      description={t('tasks.empty')}
                      quickCards={[
                        {
                          step: isEn ? 'Step 1' : 'Шаг 1',
                          title: isEn
                            ? '1. Create First Assignment'
                            : '1. Создать первое поручение',
                          subtitle: isEn
                            ? 'Assign owner, department & SLA deadline'
                            : 'Укажите исполнителя, подразделение и дедлайн',
                          icon: 'plus',
                          onClick: () => setModalType('tasks'),
                        },
                        {
                          step: isEn ? 'Step 2' : 'Шаг 2',
                          title: isEn
                            ? '2. Generate Plan via TedCloud Intelligence'
                            : '2. Сгенерировать план через TedCloud Intelligence',
                          subtitle: isEn
                            ? 'Automated AI breakdown & executive summary'
                            : 'Автоматическая декомпозиция и сводка по задачам',
                          icon: 'ai',
                          onClick: () => setIsAiDrawerOpen(true),
                        },
                        {
                          step: isEn ? 'Step 3' : 'Шаг 3',
                          title: isEn
                            ? '3. Open 4-Column Task Wall'
                            : '3. Переключить на Стену задач',
                          subtitle: isEn
                            ? 'Track tasks across Queue, In Progress, Review & Done'
                            : 'Управляйте потоком поручений по 4 колонкам стадий',
                          icon: 'kanban',
                          onClick: () => {
                            setTaskSliceFilter('all');
                            setTaskViewMode('board');
                          },
                        },
                      ]}
                    />
                  ) : taskViewMode === 'board' ? (
                    /* РЕЖИМ 1: ПОЛНОШИРИННАЯ 4-КОЛОНОЧНАЯ КАНБАН-СТЕНА (grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4) */
                    <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                      {(
                        [
                          {
                            status: 'Todo' as TaskStatus,
                            title: isEn ? 'Queue / To Do' : 'Очередь / К выполнению',
                            dotClass: 'bg-sky-400',
                            badgeClass: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
                            nextStatus: 'In Progress' as TaskStatus,
                            nextLabel: isEn ? 'Start →' : 'В работу →',
                          },
                          {
                            status: 'In Progress' as TaskStatus,
                            title: isEn ? 'In Active Progress' : 'В активной работе',
                            dotClass: 'bg-amber-400',
                            badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
                            nextStatus: 'Review' as TaskStatus,
                            nextLabel: isEn ? 'To Review' : 'На проверку',
                          },
                          {
                            status: 'Review' as TaskStatus,
                            title: isEn ? 'In Review / Approval' : 'На проверке / Согласовании',
                            dotClass: 'bg-purple-400',
                            badgeClass: 'border-purple-500/25 bg-purple-500/10 text-purple-300',
                            nextStatus: 'Done' as TaskStatus,
                            nextLabel: isEn ? 'Complete' : 'Завершить',
                          },
                          {
                            status: 'Done' as TaskStatus,
                            title: isEn ? 'Completed' : 'Завершено',
                            dotClass: 'bg-emerald-400',
                            badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
                            nextStatus: 'Todo' as TaskStatus,
                            nextLabel: isEn ? 'Reopen' : 'Вернуть',
                          },
                        ]
                      ).map((col) => {
                        const getEffectiveBoardColumn = (tk: TaskRecord): TaskStatus => {
                          if (tk.status === 'Done') return 'Done';
                          if (tk.status === 'Review') return 'Review';
                          const isAppr =
                            String(tk.type || '').toLowerCase() === 'approval' ||
                            (tk.title || '').startsWith('[СОГЛАСОВАНИЕ:');
                          if (isAppr && tk.status !== 'In Progress') return 'Review';
                          if (tk.status === 'In Progress') return 'In Progress';
                          return 'Todo';
                        };

                        const colTasks = filteredTasks.filter(
                          (tItem) => getEffectiveBoardColumn(tItem) === col.status
                        );
                        const isDragTarget = dragOverColumn === col.status;

                        return (
                          <div
                            key={col.status}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragOverColumn !== col.status) {
                                setDragOverColumn(col.status);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverColumn === col.status) {
                                setDragOverColumn(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverColumn(null);
                              const droppedId =
                                draggedTaskId || e.dataTransfer.getData('text/plain');
                              setDraggedTaskId(null);
                              if (droppedId && canCreateOrEditTasks) {
                                void handleTaskUpdate(droppedId, { status: col.status });
                              }
                            }}
                            className={`rounded-xl border p-3.5 flex flex-col gap-3 transition-colors min-h-[420px] ${
                              isDragTarget
                                ? 'border-indigo-500/60 bg-indigo-950/15'
                                : 'border-white/[0.07] bg-[#0D0D10]'
                            }`}
                          >
                            {/* Шапка колонки: Цветной индикатор, Название стадии, Счетчик карточек и кнопка + */}
                            <div className="flex items-center justify-between px-1 pb-2 border-b border-white/[0.06]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dotClass}`}
                                />
                                <span className="text-xs font-semibold text-white truncate">
                                  {col.title}
                                </span>
                                <span className="text-[11px] font-semibold tabular-nums text-zinc-400 bg-zinc-900 border border-white/[0.08] px-1.5 py-0.5 rounded shrink-0">
                                  {colTasks.length}
                                </span>
                              </div>

                              {canCreateOrEditTasks && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (col.status === 'Review') {
                                      setIsRequestApprovalModalOpen(true);
                                    } else {
                                      setInitialTaskDraft({
                                        title: '',
                                        description: '',
                                        assigned_to: currentProfile?.id || '',
                                        department: currentProfile?.department || '',
                                        priority: 'Medium',
                                      });
                                      setModalType('tasks');
                                    }
                                  }}
                                  title={
                                    isEn
                                      ? `Add task to "${col.title}"`
                                      : `Быстро создать поручение в колонке «${col.title}»`
                                  }
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-white/[0.08] bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {colTasks.length === 0 ? (
                              <div className="flex-1 flex flex-col items-center justify-center py-10 px-3 text-center text-xs text-zinc-500 border border-dashed border-white/[0.06] rounded-xl">
                                <span>
                                  {isEn
                                    ? 'Drag a card here or click + to add'
                                    : 'Перетащите карточку сюда или нажмите +'}
                                </span>
                              </div>
                            ) : (
                              colTasks.map((task, idx) => {
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
                                const taskAttachments = normalizeAttachments(task.attachments);
                                const isDecomposing = decomposingTaskId === task.id;
                                const shortCode = `#TC-${String(
                                  task.id.replace(/\D/g, '').slice(-3) || 101 + idx
                                ).padStart(3, '0')}`;
                                const descPreview = (task.description || task.notes || '').trim();

                                return (
                                  <div
                                    key={task.id}
                                    draggable={canCreateOrEditTasks}
                                    onDragStart={(e) => {
                                      setDraggedTaskId(task.id);
                                      e.dataTransfer.setData('text/plain', task.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedTaskId(null);
                                      setDragOverColumn(null);
                                    }}
                                    onClick={() =>
                                      setDrawerSelection({ kind: 'task', id: task.id })
                                    }
                                    className="group rounded-xl border border-white/[0.08] bg-[#141418] p-3.5 space-y-2.5 hover:border-white/25 transition-all cursor-pointer shadow-lg"
                                  >
                                    {/* Верхняя строка карточки: Код задачи и тип (#TC-104 · Поручение), бейдж приоритета и индикатор дедлайна */}
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-medium text-[#8E8E93] tabular-nums">
                                        {shortCode} · {t(`type.${task.type || 'Task'}`)}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        {renderPriorityBadge(task.priority)}
                                        {renderDueDateBadge(task.due_date, task.status)}
                                      </div>
                                    </div>

                                    {/* Центр карточки: Четкий заголовок задачи + краткое превью описания/комментария (line-clamp-2) */}
                                    <div className="space-y-1">
                                      <h3
                                        className={`text-[13px] font-semibold leading-snug ${
                                          task.status === 'Done'
                                            ? 'text-[#71717A] line-through'
                                            : 'text-white'
                                        }`}
                                      >
                                        {task.title}
                                      </h3>
                                      {descPreview && (
                                        <p className="text-xs text-[#8E8E93] line-clamp-2 leading-relaxed">
                                          {descPreview}
                                        </p>
                                      )}
                                    </div>

                                    {/* Мини-прогресс чек-листа подзадач (2/4 выполнено с полоской прогресса) и иконка вложений */}
                                    {(checklist.length > 0 || taskAttachments.length > 0) && (
                                      <div className="space-y-1.5 pt-0.5">
                                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 tabular-nums">
                                          {checklist.length > 0 ? (
                                            <span className="inline-flex items-center gap-1">
                                              <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
                                              <span>
                                                {doneSubtasks}/{checklist.length}{' '}
                                                {isEn ? 'completed' : 'выполнено'}
                                              </span>
                                            </span>
                                          ) : (
                                            <span />
                                          )}

                                          {taskAttachments.length > 0 && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-white/[0.08] text-[10px] text-zinc-300">
                                              <Paperclip className="w-3 h-3 text-indigo-400" />
                                              <span>{taskAttachments.length}</span>
                                            </span>
                                          )}
                                        </div>

                                        {checklist.length > 0 && (
                                          <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                                            <div
                                              className="h-full bg-indigo-500 transition-all duration-200"
                                              style={{ width: `${progressPct}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {(String(task.type || '').toLowerCase() === 'approval' ||
                                      (task.title || '').startsWith('[СОГЛАСОВАНИЕ:')) && (
                                      <ApprovalDecisionBar
                                        task={task}
                                        currentProfile={currentProfile}
                                        isBusy={busyRecordId === task.id}
                                        onDecision={handleApprovalDecision}
                                      />
                                    )}

                                    {/* Подвал карточки: Аватар и имя исполнителя, отдел, кнопка ИИ-шаги и быстрая кнопка перевода в следующий этап в 1 клик */}
                                    <div
                                      className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {assignee ? (
                                          <>
                                            <UserAvatar
                                              name={assignee.name}
                                              avatarUrl={assignee.avatar_url}
                                              size="xs"
                                            />
                                            <div className="min-w-0">
                                              <div className="text-[11px] font-medium text-zinc-200 truncate">
                                                {assignee.name}
                                              </div>
                                              {task.department && (
                                                <div className="text-[10px] text-[#71717A] truncate">
                                                  {formatRole(task.department)}
                                                </div>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-[11px] text-zinc-500 truncate">
                                            {task.department
                                              ? formatRole(task.department)
                                              : t('tasks.unassigned')}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {canCreateOrEditTasks && (
                                          <button
                                            type="button"
                                            disabled={isDecomposing}
                                            onClick={(e) => void handleQuickAiDecomposeTask(task, e)}
                                            title={
                                              isEn
                                                ? 'AI Subtask Breakdown'
                                                : 'Разбить на ИИ-шаги чек-листа'
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/[0.08] bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 hover:text-white transition-colors whitespace-nowrap"
                                          >
                                            {isDecomposing ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Cpu className="w-3 h-3 text-indigo-400" />
                                            )}
                                            <span>{isEn ? 'AI Steps' : 'ИИ-шаги'}</span>
                                          </button>
                                        )}

                                        {canCreateOrEditTasks && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void handleTaskUpdate(task.id, {
                                                status: col.nextStatus,
                                              })
                                            }
                                            className="px-2 py-1 rounded-md bg-white text-black hover:bg-zinc-200 text-[10px] font-semibold transition-colors whitespace-nowrap"
                                          >
                                            {col.nextLabel}
                                          </button>
                                        )}

                                        {canCreateOrEditTasks && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestDeleteRecord('tasks', task.id, task.title)
                                            }
                                            className="p-1 rounded-md text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                                            title={isEn ? 'Delete task' : 'Удалить поручение'}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : taskViewMode === 'list' ? (
                    /* РЕЖИМ 2: СГРУППИРОВАННЫЙ СПИСОК LINEAR (Linear Grouped List View) */
                    <div className="divide-y divide-white/[0.07]">
                      {(
                        [
                          {
                            status: 'In Progress' as TaskStatus,
                            title: isEn ? 'In Active Progress' : 'В активной работе',
                            dotClass: 'bg-amber-400',
                          },
                          {
                            status: 'Review' as TaskStatus,
                            title: isEn ? 'In Review / Approval' : 'На проверке / Согласовании',
                            dotClass: 'bg-purple-400',
                          },
                          {
                            status: 'Todo' as TaskStatus,
                            title: isEn ? 'Queue / To Do' : 'К выполнению',
                            dotClass: 'bg-sky-400',
                          },
                          {
                            status: 'Done' as TaskStatus,
                            title: isEn ? 'Completed' : 'Завершено',
                            dotClass: 'bg-emerald-400',
                          },
                        ]
                      ).map((group) => {
                        const getEffectiveListGroup = (tk: TaskRecord): TaskStatus => {
                          if (tk.status === 'Done') return 'Done';
                          if (tk.status === 'Review') return 'Review';
                          const isAppr =
                            String(tk.type || '').toLowerCase() === 'approval' ||
                            (tk.title || '').startsWith('[СОГЛАСОВАНИЕ:');
                          if (isAppr && tk.status !== 'In Progress') return 'Review';
                          if (tk.status === 'In Progress') return 'In Progress';
                          return 'Todo';
                        };

                        const groupTasks = filteredTasks.filter(
                          (tItem) => getEffectiveListGroup(tItem) === group.status
                        );

                        return (
                          <div key={group.status} className="bg-[#111114]">
                            {/* Заголовок секции группы Linear */}
                            <div className="px-5 py-2.5 bg-[#151519] border-b border-white/[0.05] flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full ${group.dotClass}`} />
                                <span className="text-xs font-semibold text-white">
                                  {group.title}
                                </span>
                                <span className="text-[11px] font-medium tabular-nums text-[#8E8E93] bg-zinc-900 border border-white/[0.07] px-1.5 py-0.2 rounded">
                                  {groupTasks.length}
                                </span>
                              </div>
                            </div>

                            {groupTasks.length === 0 ? (
                              <div className="px-5 py-3 text-xs text-[#71717A]">
                                {isEn ? 'No tasks in this stage' : 'Нет задач на данном этапе'}
                              </div>
                            ) : (
                              <div className="divide-y divide-[#1A1A1C]">
                                {groupTasks.map((task, idx) => {
                                  const isBusy = busyRecordId === task.id;
                                  const assignee = task.assigned_to
                                    ? nodeMap.get(task.assigned_to)
                                    : null;
                                  const checklist = Array.isArray(task.checklist)
                                    ? task.checklist
                                    : [];
                                  const doneSubtasks = checklist.filter((c) => c.done).length;
                                  const isDecomposing = decomposingTaskId === task.id;
                                  const shortCode = `#TC-${String(
                                    task.id.replace(/\D/g, '').slice(-3) || 101 + idx
                                  ).padStart(3, '0')}`;

                                  return (
                                    <div
                                      key={task.id}
                                      onClick={() =>
                                        setDrawerSelection({ kind: 'task', id: task.id })
                                      }
                                      className="px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#16161A] transition-colors cursor-pointer"
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
                                          {task.status === 'Done' && (
                                            <CheckCircle2 className="w-3 h-3" />
                                          )}
                                        </button>

                                        <span className="text-[11px] font-medium text-[#71717A] tabular-nums shrink-0">
                                          {shortCode}
                                        </span>

                                        <div className="min-w-0">
                                          <div
                                            className={`text-sm font-medium truncate ${
                                              task.status === 'Done'
                                                ? 'text-[#71717A] line-through'
                                                : 'text-white'
                                            }`}
                                          >
                                            <InlineEditableCell
                                              value={task.title}
                                              disabled={!canCreateOrEditTasks}
                                              onSave={(nextTitle) =>
                                                handleTaskUpdate(task.id, { title: nextTitle })
                                              }
                                            />
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#1C1C1F] text-[#A1A1AA] border border-[#2C2C30] whitespace-nowrap">
                                              {t(`type.${task.type || 'Task'}`)}
                                            </span>
                                            {renderPriorityBadge(task.priority)}
                                            {renderDueDateBadge(task.due_date, task.status)}
                                            {task.department && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[11px] text-[#D4D4D8] whitespace-nowrap">
                                                {formatRole(task.department)}
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
                                                  {assignee.name}
                                                </strong>
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
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors whitespace-nowrap"
                                          >
                                            {isDecomposing ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Cpu className="w-3 h-3 text-indigo-400" />
                                            )}
                                            <span>{isEn ? 'AI Steps' : 'ИИ-шаги'}</span>
                                          </button>
                                        )}

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
                                          <option value="Review">{t('status.Review')}</option>
                                          <option value="Done">{t('status.Done')}</option>
                                          <option value="Cancelled">{t('status.Cancelled')}</option>
                                        </select>

                                        {canCreateOrEditTasks && (
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() =>
                                              requestDeleteRecord('tasks', task.id, task.title)
                                            }
                                            className="p-1.5 rounded-md text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5">
                      <TaskTimelineView
                        tasks={filteredTasks}
                        nodes={safeNodes}
                        leads={visibleLeads}
                        onSelectTask={(tk) => setDrawerSelection({ kind: 'task', id: tk.id })}
                        onStatusChange={async (taskId, nextStatus) => {
                          await handleTaskUpdate(taskId, { status: nextStatus });
                        }}
                        onInlineTitleSave={async (taskId, newTitle) => {
                          await handleTaskUpdate(taskId, { title: newTitle });
                        }}
                      />
                    </div>
                  )}
                </section>
              </div>
            )}

          {/* =================================================================
              TAB 3: СДЕЛКИ / CRM DEALS (Inline Deal Bar + Auto-Pipeline + Документы + Deal Room)
          ================================================================== */}
          {activeSection === 'crm' && perms.crm_view && (
            <div className="space-y-4">
              {perms.crm_edit && (
                <QuickInlineDealBar
                  nodes={safeNodes}
                  defaultAssigneeId={currentProfile?.id || ''}
                  inputRef={quickDealInputRef}
                  onCreateDeal={async (payload) => {
                    await onCreateRecord('crm_leads', {
                      company_id: companyId,
                      client_name: payload.client_name,
                      full_name: payload.client_name,
                      title: payload.title,
                      amount: payload.amount,
                      deal_value: payload.amount,
                      tax_id: payload.tax_id,
                      status: 'New',
                      stage: 'New',
                      assigned_to: payload.assigned_to || currentProfile?.id || null,
                      owner_node_id: payload.assigned_to || currentProfile?.id || null,
                    });
                  }}
                />
              )}
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
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Переключатель Авто-задач воронки (CRM Pipeline Automation) */}
                    <button
                      type="button"
                      onClick={() => setAutoPipelineEnabled((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                        autoPipelineEnabled
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 bg-[#16161A] text-zinc-400 hover:text-white'
                      }`}
                      title={
                        isEn
                          ? 'Automatically create follow-up tasks when moving deals to Negotiation or Won'
                          : 'Автоматически создавать задачи менеджеру при переводе сделки в Переговоры или Выиграна'
                      }
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        {isEn
                          ? `Auto-Pipeline: ${autoPipelineEnabled ? 'ON' : 'OFF'}`
                          : `Авто-задачи воронки: ${autoPipelineEnabled ? 'ВКЛ' : 'ВЫКЛ'}`}
                      </span>
                    </button>

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
                        <span>{isEn ? 'Pipeline (Kanban)' : 'Воронка (Канбан)'}</span>
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
                        <span>{isEn ? 'Registry (Table)' : 'Реестр (Таблица)'}</span>
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
                <RichEmptyState
                  variant="crm"
                  title={t('crm.emptyTitle')}
                  description={t('crm.empty')}
                  quickCards={[
                    {
                      step: isEn ? 'Step 1' : 'Шаг 1',
                      title: isEn
                        ? '1. Register B2B Contract'
                        : '1. Зарегистрировать B2B-контракт',
                      subtitle: isEn
                        ? 'Add counterparty INN/VAT, contract # & deal value'
                        : 'Укажите контрагента, ИНН/VAT, договор и сумму сделки',
                      icon: 'plus',
                      onClick: () => setModalType('crm_leads'),
                    },
                    {
                      step: isEn ? 'Step 2' : 'Шаг 2',
                      title: isEn
                        ? '2. Run AI Pipeline Audit'
                        : '2. Запустить ИИ-аудит воронки',
                      subtitle: isEn
                        ? 'Analyze conversion bottlenecks & revenue forecast'
                        : 'Оценка конверсии, рисков и прогноз выручки',
                      icon: 'ai',
                      onClick: () => setIsAiDrawerOpen(true),
                    },
                    {
                      step: isEn ? 'Step 3' : 'Шаг 3',
                      title: isEn
                        ? '3. Import / Export CSV Template'
                        : '3. Импорт / Выгрузка шаблона CSV',
                      subtitle: isEn
                        ? 'Download structured B2B deal registry'
                        : 'Выгрузите структурированный реестр сделок в CSV',
                      icon: 'csv',
                      onClick: handleExportDealsCsv,
                    },
                  ]}
                />
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
                              {isEn ? 'No deals in stage' : 'Нет сделок на стадии'}
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
                                      {isEn ? 'Contract #' : 'Договор №'} {lead.contract_number}
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
                                        {formatRole(lead.department)}
                                      </span>
                                    )}
                                  </div>

                                  {(() => {
                                    const hasActiveStep = visibleTasks.some(
                                      (tk) =>
                                        tk.status !== 'Done' &&
                                        ((tk.lead_id && String(tk.lead_id) === String(lead.id)) ||
                                          tk.title
                                            .toLowerCase()
                                            .includes(displayName.toLowerCase()))
                                    );
                                    const isRotRisk =
                                      (col.status === 'New' || col.status === 'Negotiation') &&
                                      !hasActiveStep;

                                    return (
                                      <div
                                        className="pt-2 border-t border-white/[0.05] space-y-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isRotRisk && (
                                          <div className="flex items-center justify-between gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/25 px-2 py-1">
                                            <span className="text-[10px] font-medium text-amber-300 truncate">
                                              {isEn
                                                ? 'Needs next step'
                                                : 'Без движения (нет задачи)'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void onCreateRecord('tasks', {
                                                  company_id: companyId,
                                                  title: isEn
                                                    ? `Follow up & next step: ${displayName}`
                                                    : `Связаться и назначить следующий шаг: ${displayName}`,
                                                  type: 'Task',
                                                  priority: 'High',
                                                  status: 'Todo',
                                                  assigned_to:
                                                    managerId || currentProfile?.id || null,
                                                  owner_node_id:
                                                    managerId || currentProfile?.id || null,
                                                  lead_id: lead.id,
                                                });
                                              }}
                                              className="text-[10px] font-semibold text-white bg-amber-500/25 hover:bg-amber-500/40 px-1.5 py-0.5 rounded shrink-0"
                                            >
                                              {isEn ? '+ Step' : '+ Шаг'}
                                            </button>
                                          </div>
                                        )}

                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => setLegalDocModalDeal(lead)}
                                            className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.07] text-[10px] font-medium text-zinc-200 transition-colors"
                                          >
                                            <FileText className="w-3 h-3 text-indigo-400" />
                                            <span>{isEn ? 'Docs / PDF' : 'Документы'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDealRoomPreviewId(lead.id)}
                                            className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.07] text-[10px] font-medium text-emerald-300 transition-colors"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                            <span>Deal Room</span>
                                          </button>
                                        </div>

                                        {perms.crm_edit && (
                                          <div className="flex items-center justify-between gap-1">
                                            {(
                                              [
                                                'New',
                                                'Negotiation',
                                                'Won',
                                                'Lost',
                                              ] as CrmLeadStatus[]
                                            )
                                              .filter((s) => s !== col.status)
                                              .map((targetStage) => (
                                                <button
                                                  key={targetStage}
                                                  type="button"
                                                  onClick={() =>
                                                    void handleLeadStatusChange(lead, targetStage)
                                                  }
                                                  className="flex-1 py-1 px-1.5 rounded bg-white/[0.03] hover:bg-white/[0.09] border border-white/[0.06] text-[10px] font-medium text-[#A1A1AA] hover:text-white transition-colors truncate"
                                                >
                                                  → {t(`stage.${targetStage}` as any)}
                                                </button>
                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
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
                              <div className="font-medium text-white">
                                <InlineEditableCell
                                  value={displayName}
                                  disabled={!perms.crm_edit}
                                  onSave={(nextName) =>
                                    onPatchRecord('crm_leads', lead.id, {
                                      client_name: nextName,
                                      full_name: nextName,
                                    })
                                  }
                                />
                              </div>
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
                              <div className="space-y-0.5">
                                <div className="text-white tabular-nums text-[11px]">
                                  <span className="text-[#71717A]">
                                    {isGlobal ? 'VAT/Tax:' : 'ИНН:'}
                                  </span>{' '}
                                  <InlineEditableCell
                                    value={lead.tax_id || ''}
                                    placeholder="—"
                                    disabled={!perms.crm_edit}
                                    onSave={(nextTax) =>
                                      onPatchRecord('crm_leads', lead.id, {
                                        tax_id: nextTax || null,
                                      })
                                    }
                                  />
                                </div>
                                {lead.contract_number && (
                                  <div className="text-[11px] text-[#A1A1AA] tabular-nums">
                                    № {lead.contract_number}
                                  </div>
                                )}
                              </div>
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
                                    {formatRole(lead.department)}
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
                              <InlineEditableCell
                                value={displayValue}
                                type="number"
                                disabled={!perms.crm_edit}
                                displayValue={formatMoney(displayValue)}
                                onSave={(nextVal) =>
                                  onPatchRecord('crm_leads', lead.id, {
                                    amount: Number(nextVal) || 0,
                                    deal_value: Number(nextVal) || 0,
                                  })
                                }
                              />
                            </td>
                            {perms.crm_edit && (
                              <td
                                className="py-3.5 px-5 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setLegalDocModalDeal(lead)}
                                    title={
                                      isEn
                                        ? 'Generate Contract / CP / Invoice (PDF)'
                                        : 'Сформировать Договор / КП / Счет-Акт (PDF)'
                                    }
                                    className="px-2 py-1 rounded-md border border-white/10 bg-[#18181B] hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors"
                                  >
                                    {isEn ? 'Docs' : 'Документы'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDealRoomPreviewId(lead.id)}
                                    title={
                                      isEn
                                        ? 'Open Shareable Client Deal Room'
                                        : 'Открыть клиентский портал сделки (Deal Room)'
                                    }
                                    className="px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-medium text-emerald-300 transition-colors whitespace-nowrap"
                                  >
                                    Deal Room
                                  </button>
                                  <select
                                    value={displayStatus}
                                    onChange={(e) =>
                                      void handleLeadStatusChange(
                                        lead,
                                        e.target.value as CrmLeadStatus
                                      )
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
            </div>
          )}

          {/* =================================================================
              TAB 4: ИНФОПОЛЕ И СВЯЗЬ / SPLIT-VIEW CORPORATE MESSENGER + SMART DOCUMENT VAULT (БЛОК 4)
          ================================================================== */}
          {activeSection === 'communications' &&
            (commViewMode === 'vault' ? (
              <SmartDocumentVault
                company={company}
                currentProfile={currentProfile}
                nodes={safeNodes}
                tasks={visibleTasks}
                leads={visibleLeads}
                messages={safeMessages}
                onPatchRecord={onPatchRecord as any}
                showToast={showToast}
                onOpenTaskDrawer={(taskId) => setDrawerSelection({ kind: 'task', id: taskId })}
                onOpenDealDrawer={(dealId) => setDrawerSelection({ kind: 'lead', id: dealId })}
                onUpdateCompanyBillingDetails={
                  perms.billing_admin && company
                    ? async (nextDetails) => {
                        await onPatchRecord('companies', company.id, {
                          billing_details: nextDetails,
                        });
                      }
                    : undefined
                }
              />
            ) : (
            <div className="w-full max-w-full min-w-0 h-[calc(100dvh-210px)] min-h-[480px] max-h-[calc(100dvh-210px)] rounded-2xl border border-white/[0.08] bg-[#111114] overflow-hidden flex flex-col lg:flex-row shadow-2xl">
              {/* ЛЕВАЯ ПАНЕЛЬ (Ширина 300px на десктопе, 100% на мобильных при !mobileChatOpen): Каналы и Личные диалоги */}
              <aside
                className={`${
                  mobileChatOpen ? 'hidden lg:flex' : 'flex'
                } w-full lg:w-[300px] h-full shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.07] bg-[#0D0D0F] flex-col overflow-hidden`}
              >
                <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                      {isEn ? 'Channels & Direct Messages' : 'Каналы и Диалоги'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-5">
                  {/* Блок 1: Корпоративные каналы */}
                  <div className="space-y-1">
                    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                      {isEn ? 'Corporate Channels' : 'Корпоративные каналы'}
                    </div>

                    {/* Общий поток (Циркуляры компании) */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCommThread({
                          type: 'broadcast',
                          id: 'general',
                          label: isEn
                            ? 'General Stream (Company Broadcasts)'
                            : 'Общий поток (Циркуляры компании)',
                        });
                        setMobileChatOpen(true);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-lg text-left transition-colors ${
                        activeCommThread.type === 'broadcast'
                          ? 'bg-[#1C1C21] text-white border border-[#2E2E36]'
                          : 'text-[#A1A1AA] hover:bg-[#151518] hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-medium truncate">
                          {isEn
                            ? 'General Stream (Company Broadcasts)'
                            : 'Общий поток (Циркуляры компании)'}
                        </span>
                      </div>
                      {broadcastMessagesCount > 0 && (
                        <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#18181C] px-1.5 py-0.5 rounded shrink-0">
                          {broadcastMessagesCount}
                        </span>
                      )}
                    </button>

                    {/* Список отделов компании */}
                    {companyDepartments.map((dept) => {
                      const isSelected =
                        activeCommThread.type === 'department' &&
                        activeCommThread.id.toLowerCase() === dept.toLowerCase();
                      const deptMsgCount = deptMessageCountsMap.get(dept) ?? 0;

                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => {
                            setActiveCommThread({
                              type: 'department',
                              id: dept,
                              label: dept,
                            });
                            setMobileChatOpen(true);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'bg-[#1C1C21] text-white border border-[#2E2E36]'
                              : 'text-[#A1A1AA] hover:bg-[#151518] hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Hash className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                            <span className="text-xs font-medium truncate">
                              {formatRole(dept)}
                            </span>
                          </div>
                          {deptMsgCount > 0 && (
                            <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#18181C] px-1.5 py-0.5 rounded shrink-0">
                              {deptMsgCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Блок 2: Личные диалоги (Сотрудники) */}
                  <div className="space-y-1">
                    <div className="px-2 pb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                        {isEn ? 'Direct Messages (Team)' : 'Личные диалоги (Сотрудники)'}
                      </span>
                      <span className="text-[10px] tabular-nums text-[#71717A]">
                        {colleagueNodes.length}
                      </span>
                    </div>

                    {colleagueNodes.length === 0 ? (
                      <div className="px-2.5 py-3 rounded-lg border border-[#1C1C1F] bg-[#121215] text-[11px] text-[#71717A]">
                        {isEn
                          ? 'No other employees in the directory yet for direct messages.'
                          : 'В штате пока нет других сотрудников для личного диалога.'}
                      </div>
                    ) : (
                      colleagueNodes.map((colleague) => {
                        const isSelected =
                          activeCommThread.type === 'direct' &&
                          String(activeCommThread.id) === String(colleague.id);
                        const hasTelegram = Boolean(colleague.telegram_chat_id);
                        const dialogCount =
                          directMessageCountsMap.get(String(colleague.id)) ?? 0;

                        return (
                          <button
                            key={colleague.id}
                            type="button"
                            onClick={() => {
                              setActiveCommThread({
                                type: 'direct',
                                id: String(colleague.id),
                                label: colleague.name,
                                subtitle: colleague.role_type,
                                telegramConnected: hasTelegram,
                              });
                              setMobileChatOpen(true);
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2.5 rounded-lg text-left transition-colors ${
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
                                    title={isEn ? 'Telegram connected' : 'Telegram подключен'}
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0"
                                  >
                                    TG
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#71717A] truncate">
                                {formatRole(colleague.role_type)}
                                {colleague.department
                                  ? ` · ${formatRole(colleague.department)}`
                                  : ''}
                              </div>
                            </div>

                            {dialogCount > 0 && (
                              <span className="text-[10px] tabular-nums text-[#8E8E93] bg-[#18181C] px-1.5 py-0.5 rounded shrink-0">
                                {dialogCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </aside>

              {/* ПРАВАЯ ПАНЕЛЬ: Окно выбранного чата / канала (100% на мобильных при mobileChatOpen) */}
              <section
                className={`${
                  mobileChatOpen ? 'flex' : 'hidden lg:flex'
                } flex-1 flex-col h-full min-w-0 max-w-full overflow-hidden bg-[#111113]`}
              >
                {/* Чистая 1-строчная шапка диалога (Linear / Telegram iOS standard) */}
                {(() => {
                  const selectedColleague =
                    activeCommThread.type === 'direct'
                      ? safeNodes.find((n) => String(n.id) === String(activeCommThread.id)) || null
                      : null;
                  const headerTitle =
                    activeCommThread.type === 'direct'
                      ? selectedColleague?.name || activeCommThread.label
                      : activeCommThread.type === 'department'
                      ? `# ${formatRole(activeCommThread.label)}`
                      : isEn
                      ? 'General Stream (Company Broadcasts)'
                      : 'Общий поток (Циркуляры компании)';
                  const headerSubtitle =
                    activeCommThread.type === 'direct'
                      ? [
                          formatRole(selectedColleague?.role_type),
                          formatRole(selectedColleague?.department),
                        ]
                          .filter(Boolean)
                          .join(' · ') ||
                        (isEn ? 'Direct Message' : 'Личный диалог')
                      : activeCommThread.type === 'department'
                      ? isEn
                        ? 'Department channel'
                        : 'Канал подразделения'
                      : isEn
                      ? 'Company-wide broadcast stream'
                      : 'Корпоративный поток компании';

                  const tgActive =
                    activeCommThread.type === 'direct'
                      ? Boolean(selectedColleague?.telegram_chat_id)
                      : safeNodes.some((n) => Boolean(n.telegram_chat_id));

                  return (
                    <div
                      className={`shrink-0 z-10 px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-2.5 transition-colors ${
                        theme === 'light'
                          ? 'bg-[#FAF9F5] border-[#E2DFD7] text-[#18181B]'
                          : 'bg-[#14161C] border-white/[0.07] text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Компактная круглая/квадратная иконка возврата ← (w-8 h-8) на мобильном */}
                        <button
                          type="button"
                          onClick={() => setMobileChatOpen(false)}
                          aria-label={isEn ? 'Back to dialogs' : 'Назад к диалогам'}
                          className={`lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 transition-colors ${
                            theme === 'light'
                              ? 'border-[#D6D3CD] bg-white hover:bg-zinc-100 text-[#18181B]'
                              : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white'
                          }`}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        {activeCommThread.type === 'direct' ? (
                          <UserAvatar
                            name={headerTitle}
                            avatarUrl={selectedColleague?.avatar_url}
                            size="md"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                              theme === 'light'
                                ? 'bg-white border-[#D6D3CD]'
                                : 'bg-white/[0.05] border-white/[0.08]'
                            }`}
                          >
                            {activeCommThread.type === 'department' ? (
                              <Hash
                                className={`w-4 h-4 ${
                                  theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'
                                }`}
                              />
                            ) : (
                              <Radio className="w-4 h-4 text-emerald-500" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h2
                            className={`text-sm font-semibold truncate ${
                              theme === 'light' ? 'text-[#18181B]' : 'text-white'
                            }`}
                          >
                            {headerTitle}
                          </h2>
                          <div
                            className={`flex items-center gap-2 text-[11px] truncate mt-0.5 ${
                              theme === 'light' ? 'text-[#52525B]' : 'text-[#8E8E93]'
                            }`}
                          >
                            <span className="truncate">{headerSubtitle}</span>
                            {tgActive && (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>TG Online</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div
                  ref={messagesContainerRef}
                  className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar px-6 py-5 space-y-3"
                >
                  {activeThreadMessages.length === 0 ? (
                    <RichEmptyState
                      variant="chat"
                      compact
                      title={
                        isEn
                          ? 'No messages in this thread yet'
                          : 'В выбранном потоке пока нет сообщений'
                      }
                      description={
                        activeCommThread.type === 'direct'
                          ? isEn
                            ? 'Send a direct message to this colleague. It is visible only to you and the recipient and delivered directly to Telegram.'
                            : 'Отправьте личное сообщение сотруднику. Оно будет видно исключительно вам и получателю, а также мгновенно доставлено в Telegram.'
                          : activeCommThread.type === 'department'
                          ? isEn
                            ? `Post a message to #${formatRole(activeCommThread.label)}. All department members will be notified.`
                            : `Напишите сообщение в подразделение «${activeCommThread.label}». Все сотрудники отдела получат уведомление.`
                          : isEn
                          ? 'Post a company-wide broadcast or operational update for the entire team.'
                          : 'Опубликуйте циркуляр или оперативное сообщение для всей команды компании.'
                      }
                    />
                  ) : (
                    <>
                      {activeThreadMessages.map((msg, idx) => {
                        const isOutgoing =
                          Boolean(currentProfile?.id) &&
                          String(msg.sender_id || '') === String(currentProfile?.id || '');
                        const senderNode = msg.sender_id
                          ? nodeMap.get(String(msg.sender_id))
                          : null;

                        const senderName =
                          senderNode?.name ||
                          msg.sender_name ||
                          (isEn ? 'TedCloud Employee' : 'Сотрудник TedCloud');
                        const senderRole = formatRole(
                          senderNode?.role_type || msg.sender_role || ''
                        );
                        const senderAvatarUrl =
                          senderNode?.avatar_url ||
                          (isOutgoing ? currentProfile?.avatar_url : null);

                        const isDirectThread = activeCommThread.type === 'direct';
                        const prevMsg = idx > 0 ? activeThreadMessages[idx - 1] : null;
                        const isFirstInSequence =
                          !prevMsg ||
                          String(prevMsg.sender_id || prevMsg.sender_name || '') !==
                            String(msg.sender_id || msg.sender_name || '');

                        const msgDateObj = msg.created_at ? new Date(msg.created_at) : null;
                        const prevDateObj = prevMsg?.created_at ? new Date(prevMsg.created_at) : null;
                        const msgDayKey =
                          msgDateObj && !Number.isNaN(msgDateObj.getTime())
                            ? `${msgDateObj.getFullYear()}-${msgDateObj.getMonth()}-${msgDateObj.getDate()}`
                            : '';
                        const prevDayKey =
                          prevDateObj && !Number.isNaN(prevDateObj.getTime())
                            ? `${prevDateObj.getFullYear()}-${prevDateObj.getMonth()}-${prevDateObj.getDate()}`
                            : '';
                        const showDateDivider = Boolean(msgDayKey && msgDayKey !== prevDayKey);

                        const formatDateDividerLabel = (d: Date): string => {
                          const now = new Date();
                          const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
                          const yesterday = new Date(now.getTime() - 86400000);
                          const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
                          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                          if (key === todayKey) return isEn ? 'Today' : 'Сегодня';
                          if (key === yesterdayKey) return isEn ? 'Yesterday' : 'Вчера';
                          return d.toLocaleDateString(isEn ? 'en-US' : 'ru-RU', {
                            day: 'numeric',
                            month: 'long',
                          });
                        };

                        const messageBody =
                          msg.message_text || msg.text || msg.content || '';
                        const msgAttachments = normalizeAttachments(msg.attachments);

                        const shortTime = msg.created_at
                          ? new Date(msg.created_at).toLocaleTimeString(
                              isEn ? 'en-US' : 'ru-RU',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )
                          : '';

                        const reactionEntries =
                          msg.reactions && typeof msg.reactions === 'object'
                            ? Object.entries(msg.reactions).filter(
                                ([, users]) => Array.isArray(users) && users.length > 0
                              )
                            : [];

                        const stableMsgKey = String((msg as any)._clientKey || msg.id);

                        return (
                          <React.Fragment key={stableMsgKey}>
                            {showDateDivider && msgDateObj && (
                              <div className="flex justify-center my-3 select-none">
                                <span className="tc-date-pill px-3 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900/80 border border-white/[0.07] text-[#8E8E93]">
                                  {formatDateDividerLabel(msgDateObj)}
                                </span>
                              </div>
                            )}

                            <div
                              className={`flex flex-col w-full ${
                                isOutgoing ? 'items-end' : 'items-start'
                              } ${isFirstInSequence && idx > 0 ? 'mt-3' : 'mt-1'}`}
                            >
                              <div
                                className={`relative flex items-end gap-2.5 w-full ${
                                  isOutgoing ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                {!isDirectThread && !isOutgoing && (
                                  <div className="w-7 shrink-0 flex justify-center">
                                    {isFirstInSequence ? (
                                      <UserAvatar
                                        name={senderName}
                                        avatarUrl={senderAvatarUrl}
                                        size="sm"
                                        className="mb-0.5"
                                      />
                                    ) : null}
                                  </div>
                                )}

                                <div
                                  className={`relative group w-fit max-w-[75%] px-4 py-2.5 text-[14px] leading-[1.4] break-words rounded-2xl transition-colors ${
                                    isOutgoing
                                      ? theme === 'light'
                                        ? 'ml-auto tc-bubble-outgoing bg-indigo-600 text-white border border-indigo-600 shadow-xs rounded-br-sm'
                                        : 'ml-auto tc-bubble-outgoing bg-indigo-600/90 border border-indigo-500/30 text-white shadow-xs rounded-br-sm'
                                      : theme === 'light'
                                      ? 'mr-auto bg-white border border-slate-200/90 text-slate-900 shadow-2xs rounded-bl-sm'
                                      : 'mr-auto bg-zinc-900/90 border border-white/[0.07] text-zinc-100 shadow-2xs rounded-bl-sm'
                                  }`}
                                >
                                  <div
                                    className={`tc-reaction-pill absolute z-30 -top-9 ${
                                      isOutgoing ? 'right-0' : 'left-0'
                                    } hidden group-hover:flex focus-within:flex items-center gap-1 px-2 py-1 rounded-full w-max whitespace-nowrap shadow-lg transition-all duration-150 ${
                                      theme === 'light'
                                        ? 'bg-white border border-slate-200 text-slate-900'
                                        : 'bg-zinc-900 border border-white/10 text-zinc-100'
                                    }`}
                                  >
                                    {(['👍', '🔥', '❤️', '✅', '👏', '👀'] as const).map(
                                      (reactionEmoji) => (
                                        <button
                                          key={reactionEmoji}
                                          type="button"
                                          onClick={() =>
                                            void handleToggleMessageReaction(msg, reactionEmoji)
                                          }
                                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-sm hover:scale-110 transition-transform shrink-0 cursor-pointer ${
                                            theme === 'light'
                                              ? 'hover:bg-slate-100'
                                              : 'hover:bg-white/10'
                                          }`}
                                          title={reactionEmoji}
                                        >
                                          {reactionEmoji}
                                        </button>
                                      )
                                    )}

                                    <span
                                      className={`w-px h-3.5 mx-0.5 shrink-0 ${
                                        theme === 'light' ? 'bg-slate-200' : 'bg-white/15'
                                      }`}
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReplyingToMessage({
                                          id: msg.id,
                                          sender_name: senderName,
                                          text: messageBody.slice(0, 140),
                                        })
                                      }
                                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                        theme === 'light'
                                          ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                                          : 'hover:bg-white/15 text-zinc-300 hover:text-white'
                                      }`}
                                      title={isEn ? 'Reply' : 'Ответить'}
                                      aria-label={isEn ? 'Reply' : 'Ответить'}
                                    >
                                      <Reply className="w-3 h-3" />
                                    </button>

                                    {canCreateOrEditTasks && (
                                      <button
                                        type="button"
                                        onClick={() => handleConvertMessageToTask(msg)}
                                        className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                          theme === 'light'
                                            ? 'hover:bg-indigo-50 text-indigo-600'
                                            : 'hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200'
                                        }`}
                                        title={isEn ? 'Create Task' : 'Создать задачу'}
                                        aria-label={isEn ? 'Create Task' : 'Создать задачу'}
                                      >
                                        <CheckSquare className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>

                                  {!isDirectThread && !isOutgoing && isFirstInSequence && (
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-xs font-semibold text-indigo-400 truncate">
                                        {senderName}
                                      </span>
                                      {senderRole && (
                                        <span className="text-[10px] text-zinc-400 truncate">
                                          · {senderRole}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {msg.is_urgent && (
                                    <div className="mb-1">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-400/30 text-[10px] font-semibold text-red-200">
                                        <AlertCircle className="w-2.5 h-2.5" />
                                        <span>{isEn ? 'Urgent' : 'Срочно'}</span>
                                      </span>
                                    </div>
                                  )}

                                  {msg.reply_to && msg.reply_to.text && (
                                    <div
                                      className={`mb-1 px-2.5 py-1 rounded-lg border-l-2 text-xs ${
                                        isOutgoing
                                          ? 'tc-outgoing-quote bg-white/15 border-white/70 text-white/95'
                                          : 'border-indigo-400 bg-white/[0.05] text-zinc-300'
                                      }`}
                                    >
                                      <div className="font-semibold text-[11px] truncate">
                                        {(() => {
                                          const rawReplySender = String(
                                            msg.reply_to.sender_name || ''
                                          ).trim();
                                          if (msg.reply_to.id) {
                                            const orig = activeThreadMessages.find(
                                              (m) => String(m.id) === String(msg.reply_to?.id)
                                            );
                                            if (orig) {
                                              const origNode = orig.sender_id
                                                ? nodeMap.get(String(orig.sender_id))
                                                : null;
                                              if (origNode?.name && origNode.name !== 'Page') {
                                                return origNode.name;
                                              }
                                              if (
                                                orig.sender_name &&
                                                orig.sender_name !== 'Page'
                                              ) {
                                                return orig.sender_name;
                                              }
                                            }
                                          }
                                          if (!rawReplySender || rawReplySender === 'Page') {
                                            return currentProfile?.name || 'Сотрудник TedCloud';
                                          }
                                          return rawReplySender;
                                        })()}
                                      </div>
                                      <div className="truncate opacity-90 text-[11px]">
                                        {msg.reply_to.text}
                                      </div>
                                    </div>
                                  )}

                                  <div className="inline-flex flex-wrap items-end gap-x-2.5 gap-y-0.5 max-w-full">
                                    <span className="whitespace-pre-wrap break-words">
                                      {messageBody}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-0.5 text-[11px] leading-none select-none ml-auto shrink-0 translate-y-[1px] ${
                                        isOutgoing
                                          ? 'text-indigo-100'
                                          : theme === 'light'
                                          ? 'text-slate-400'
                                          : 'text-zinc-400'
                                      }`}
                                    >
                                      {shortTime && <span className="tabular-nums">{shortTime}</span>}
                                      {isOutgoing && (
                                        <CheckCheck className="w-3.5 h-3.5 inline-block ml-1 text-indigo-200 shrink-0" />
                                      )}
                                    </span>
                                  </div>

                                  {msgAttachments.length > 0 && (
                                    <div className="pt-2">
                                      <AttachmentListRenderer
                                        attachments={msgAttachments}
                                        compact
                                      />
                                    </div>
                                  )}

                                  {!isDirectThread && activeCommThread.type === 'broadcast' && (
                                    <div className="pt-2 mt-1.5 border-t border-white/10 flex items-center justify-between gap-2">
                                      {(() => {
                                        const ackList = Array.isArray(msg.acknowledged_by)
                                          ? msg.acknowledged_by
                                          : [];
                                        const myId = currentProfile?.id || 'root';
                                        const isAcked = ackList.includes(myId);
                                        return (
                                          <>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const nextAck = isAcked
                                                  ? ackList.filter((id) => id !== myId)
                                                  : [...ackList, myId];
                                                await onPatchRecord('workspace_messages', msg.id, {
                                                  acknowledged_by: nextAck,
                                                });
                                              }}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                                                isAcked
                                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                                                  : 'bg-black/20 border-white/15 text-white/80 hover:text-white'
                                              }`}
                                            >
                                              <Check className="w-2.5 h-2.5 text-emerald-300" />
                                              <span>
                                                {isAcked
                                                  ? isEn
                                                    ? 'Acknowledged'
                                                    : 'Ознакомлен'
                                                  : isEn
                                                  ? 'Acknowledge'
                                                  : 'Ознакомиться'}
                                              </span>
                                            </button>
                                            {ackList.length > 0 && (
                                              <span className="text-[10px] opacity-75 tabular-nums">
                                                {isEn
                                                  ? `Read by: ${ackList.length}`
                                                  : `Ознакомились: ${ackList.length} сотр.`}
                                              </span>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {reactionEntries.length > 0 && (
                                <div
                                  className={`flex flex-wrap items-center gap-1 mt-1.5 ${
                                    isOutgoing
                                      ? 'justify-end'
                                      : isDirectThread
                                      ? 'justify-start'
                                      : 'pl-9'
                                  }`}
                                >
                                  {reactionEntries.map(([emoji, userIds]) => {
                                    const myId = String(currentProfile?.id || 'root');
                                    const isMine =
                                      Array.isArray(userIds) && userIds.includes(myId);
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() =>
                                          void handleToggleMessageReaction(msg, emoji)
                                        }
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                                          isMine
                                            ? theme === 'light'
                                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                              : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                                            : theme === 'light'
                                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                                            : 'bg-zinc-900/90 border-white/10 text-zinc-300 hover:bg-zinc-800'
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        <span className="tabular-nums text-[10px]">
                                          {Array.isArray(userIds) ? userIds.length : 1}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </div>

                {replyingToMessage && (
                  <div
                    className={`tc-reply-banner shrink-0 px-4 py-2 flex items-center justify-between gap-3 ${
                      theme === 'light'
                        ? 'bg-indigo-50/90 border-t border-indigo-200 text-slate-800'
                        : 'bg-zinc-900/95 border-t border-white/10 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Reply
                        className={`w-3.5 h-3.5 shrink-0 ${
                          theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'
                        }`}
                      />
                      <div className="min-w-0 border-l-2 border-indigo-500 pl-2">
                        <div
                          className={`text-[11px] font-semibold truncate ${
                            theme === 'light' ? 'text-indigo-600' : 'text-indigo-300'
                          }`}
                        >
                          {isEn ? 'Reply to' : 'В ответ'} {replyingToMessage.sender_name}
                        </div>
                        <div
                          className={`text-xs truncate ${
                            theme === 'light' ? 'text-slate-600' : 'text-zinc-400'
                          }`}
                        >
                          {replyingToMessage.text}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className={`p-1 rounded-lg transition-colors shrink-0 ${
                        theme === 'light'
                          ? 'text-slate-500 hover:text-slate-900 hover:bg-indigo-100/80'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                      aria-label={isEn ? 'Cancel reply' : 'Отменить ответ'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {commAttachments.length > 0 && (
                  <div
                    className={`shrink-0 px-4 py-2 ${
                      theme === 'light'
                        ? 'bg-slate-100 border-t border-slate-200 text-slate-800'
                        : 'bg-zinc-900 border-t border-white/10 text-zinc-200'
                    }`}
                  >
                    <PendingAttachmentsStrip
                      attachments={commAttachments}
                      onRemove={(id) =>
                        setCommAttachments((prev) => prev.filter((item) => item.id !== id))
                      }
                    />
                  </div>
                )}

                <input
                  ref={commFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                  onChange={handleCommFilesSelected}
                  className="hidden"
                />

                <ChatComposerBar
                  theme={theme}
                  isEn={isEn}
                  commUrgent={commUrgent}
                  setCommUrgent={setCommUrgent}
                  commAttachmentsCount={commAttachments.length}
                  isProcessingCommAttachment={isProcessingCommAttachment}
                  isSendingComm={isSendingComm}
                  onOpenFilePicker={() => commFileInputRef.current?.click()}
                  onSubmitMessage={(msgText) => {
                    void submitCurrentCommMessage(msgText);
                  }}
                />
              </section>
            </div>
            ))}

          {/* =================================================================
              TAB 5: ШТАТ И ДОСТУПЫ / TEAM & ACCESS (БЛОК 2: Конструктор отделов + таблица штата / Карта связей)
          ================================================================== */}
          {activeSection === 'team' && perms.team_manage && (
            <div className="space-y-5">
              <QuickInlineEmployeeBar
                departments={companyDepartments}
                inputRef={quickEmployeeInputRef}
                onCreateEmployee={async (payload) => {
                  await onCreateRecord('organization_nodes', {
                    company_id: companyId,
                    name: payload.name,
                    role_type: payload.role_type,
                    department: payload.department,
                    access_level: payload.access_level,
                  });
                }}
              />
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
                  onSelectEmployee={(emp) => setPermissionsModalNode(emp)}
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
                    <>
                      {/* Мобильный список кликабельных карточек сотрудников (< 768px) */}
                      <div className="md:hidden divide-y divide-white/[0.06]">
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
                            <div
                              key={node.id}
                              onClick={() => setPermissionsModalNode(node)}
                              className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <UserAvatar
                                  name={node.name}
                                  avatarUrl={node.avatar_url}
                                  size="md"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white truncate">
                                      {node.name}
                                    </span>
                                    {node.telegram_chat_id && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-semibold text-emerald-400 shrink-0">
                                        TG
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#8E8E93] truncate">
                                    {formatRole(node.role_type)}
                                    {node.department
                                      ? ` · ${formatRole(node.department)}`
                                      : ''}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[10px] text-[#E4E4E7] font-medium tabular-nums">
                                      {t(`accessShort.${access_level}`)} ({activeFlagsCount}/7)
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[10px] text-zinc-300 font-semibold tabular-nums">
                                      {node.invite_code || 'TC-0000'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#71717A] group-hover:text-white shrink-0 transition-colors" />
                            </div>
                          );
                        })}
                      </div>

                      {/* Десктопная таблица со 100% кликабельными строками сотрудников */}
                      <div className="hidden md:block overflow-x-auto">
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
                                <tr
                                  key={node.id}
                                  onClick={() => setPermissionsModalNode(node)}
                                  className="cursor-pointer hover:bg-white/[0.04] transition-colors group"
                                >
                                  <td className="py-4 px-5">
                                    <div className="flex items-center gap-3">
                                      <UserAvatar
                                        name={node.name}
                                        avatarUrl={node.avatar_url}
                                        size="md"
                                      />
                                      <div className="min-w-0">
                                        <div className="font-semibold text-white truncate">
                                          <InlineEditableCell
                                            value={node.name}
                                            onSave={(nextName) =>
                                              onPatchRecord('organization_nodes', node.id, {
                                                name: nextName,
                                              })
                                            }
                                          />
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
                                      <InlineEditableCell
                                        value={node.role_type}
                                        displayValue={formatRole(node.role_type)}
                                        onSave={(nextRole) =>
                                          onPatchRecord('organization_nodes', node.id, {
                                            role_type: nextRole,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="text-[11px] text-[#8E8E93] mt-1">
                                      <InlineEditableCell
                                        value={node.department || ''}
                                        placeholder={t('team.noDepartment')}
                                        displayValue={
                                          node.department
                                            ? formatRole(node.department)
                                            : t('team.noDepartment')
                                        }
                                        onSave={(nextDept) =>
                                          onPatchRecord('organization_nodes', node.id, {
                                            department: nextDept || null,
                                          })
                                        }
                                      />
                                    </div>
                                  </td>

                                  <td className="py-4 px-5">
                                    <div className="flex flex-col items-start gap-1.5">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[#E4E4E7] font-medium whitespace-nowrap tabular-nums">
                                        {t(`accessShort.${access_level}`)} ({activeFlagsCount}/7)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPermissionsModalNode(node);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/[0.08] bg-[#16161A] hover:bg-white/[0.08] text-[11px] font-medium text-white transition-colors whitespace-nowrap"
                                      >
                                        <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                                        <span>{t('permModal.btnLabel')}</span>
                                      </button>
                                    </div>
                                  </td>

                                  <td
                                    className="py-4 px-5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
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

                                  <td
                                    className="py-4 px-5 text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="inline-flex items-center justify-end gap-2">
                                      <button
                                        onClick={() =>
                                          requestDeleteRecord('organization_nodes', node.id, node.name)
                                        }
                                        className="p-1.5 rounded-md text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPermissionsModalNode(node)}
                                        aria-label={isEn ? 'Open employee card' : 'Открыть карточку сотрудника'}
                                        className="p-1.5 rounded-md text-[#71717A] group-hover:text-white hover:bg-white/[0.06] transition-colors"
                                      >
                                        <ChevronRight className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
              )}
            </div>
          )}

          {/* =================================================================
              TAB: СМЕНЫ И ТАБЕЛЬ ВРЕМЕНИ / TIME & ATTENDANCE (БЛОК 2)
          ================================================================== */}
          {activeSection === 'shifts' && (
            <TimeAndAttendanceView
              company={company}
              currentProfile={currentProfile}
              nodes={safeNodes}
              tasks={visibleTasks}
              workShifts={safeWorkShifts}
              onSyncShiftState={async (status, startedAt) => {
                if (currentProfile) {
                  await onPatchRecord('organization_nodes', currentProfile.id, {
                    shift_status: status,
                    shift_started_at: startedAt,
                  });
                }
              }}
              onCreateWorkShift={onCreateWorkShift}
              showToast={showToast}
            />
          )}

          {/* =================================================================
              TAB 6: ЛИЧНЫЙ КАБИНЕТ / MY PROFILE (БЛОК 1: Progressive Disclosure — Чистая единая центральная композиция без перегруза)
          ================================================================== */}
          {activeSection === 'profile' && currentProfile && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Верхний презентабельный блок (Header): Крупный градиентный аватар, ФИО, бейджи в одну горизонтальную линию и 2 вторичные кнопки-триггеры модалок */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111115] shadow-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
                  <div className="relative group shrink-0">
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarFileInputRef.current?.click()}
                      title={
                        isEn
                          ? 'Click to update profile photo'
                          : 'Нажмите, чтобы обновить фотографию профиля'
                      }
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
                      aria-label={
                        isEn ? 'Choose profile photo file' : 'Выбрать файл фотографии профиля'
                      }
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-white tracking-tight truncate">
                        {currentProfile.name}
                      </h2>

                      {/* Чистая панель из 2 вторичных кнопок-триггеров (Progressive Disclosure) */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsMyPermissionsModalOpen(true)}
                          className={SECONDARY_BTN_CLASS}
                        >
                          <Shield className="w-3.5 h-3.5 text-indigo-400" />
                          <span>
                            {isEn
                              ? 'My Permissions (Access Scope)'
                              : 'Мои полномочия (Контур доступа)'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsMyAccessKeysModalOpen(true)}
                          className={SECONDARY_BTN_CLASS}
                        >
                          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {isEn ? 'Login Keys & Telegram' : 'Ключи входа и Telegram'}
                          </span>
                        </button>

                        {currentProfile.avatar_url && (
                          <button
                            type="button"
                            disabled={isUploadingAvatar}
                            onClick={() => void handleRemoveAvatar()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs font-medium text-[#A1A1AA] transition-colors whitespace-nowrap"
                            title={isEn ? 'Remove Photo' : 'Удалить фото'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] font-medium text-white whitespace-nowrap">
                        {formatRole(currentProfile.role_type)}
                      </span>
                      {currentProfile.department && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.07] text-[#A1A1AA] whitespace-nowrap">
                          {formatRole(currentProfile.department)}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 font-medium whitespace-nowrap">
                        <Shield className="w-3 h-3 text-indigo-400" />
                        <span>{t(`access.${currentAccessLevel}`)}</span>
                      </span>

                      {currentProfile.telegram_chat_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium tabular-nums whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>
                            {isEn
                              ? `Telegram Synchronized (${currentProfile.telegram_chat_id})`
                              : `Telegram синхронизирован (${currentProfile.telegram_chat_id})`}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-[#8E8E93] whitespace-nowrap">
                          <span>{isEn ? 'Telegram not linked' : 'Telegram не привязан'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Нижний основной блок: Чистая просторная форма реквизитов сотрудника с ОДНОЙ кнопкой сохранения */}
              <form
                onSubmit={handleSaveMyProfile}
                className="rounded-2xl border border-white/[0.08] bg-[#111115] shadow-2xl p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.07] pb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {isEn
                        ? 'Personal Details & Contact Information'
                        : 'Личные реквизиты и контакты'}
                    </h3>
                    <p className="text-xs text-[#8E8E93] mt-0.5">
                      {isEn
                        ? `Employee profile record in the ${companyName} corporate directory`
                        : `Учетная карточка сотрудника в корпоративном реестре ${companyName}`}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-xs font-medium text-zinc-300 tabular-nums self-start sm:self-auto">
                    ID: {currentProfile.invite_code || 'TC-0000'}
                  </span>
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

                  {perms.team_manage ? (
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
                          placeholder={
                            isEn ? 'e.g., Executive Management' : 'Например: Дирекция'
                          }
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg border border-white/[0.07] bg-[#15151A] p-3.5 text-xs">
                        <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>{t('profile.jobTitle')}</span>
                        </div>
                        <div className="font-semibold text-white mt-1">
                          {formatRole(currentProfile.role_type)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/[0.07] bg-[#15151A] p-3.5 text-xs">
                        <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>{t('profile.department')}</span>
                        </div>
                        <div className="font-semibold text-white mt-1">
                          {currentProfile.department
                            ? formatRole(currentProfile.department)
                            : isEn
                            ? 'Unassigned'
                            : 'Не назначено'}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Персональный пароль для входа по Email / ФИО или Telegram ID */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {isEn
                        ? 'Personal Account Password (for Email / Name or Telegram ID login)'
                        : 'Персональный пароль для входа (по Email / ФИО или Telegram ID)'}
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <input
                        type="password"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                        placeholder={
                          currentProfile.has_password || currentProfile.password
                            ? isEn
                              ? '•••••••• (Password set — enter new to change)'
                              : '•••••••• (Пароль установлен — введите новый для смены)'
                            : isEn
                            ? 'Set a password for secure login...'
                            : 'Задайте пароль для защищенного входа...'
                        }
                        className="flex-1 rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                      />
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#A1A1AA] whitespace-nowrap">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          {currentProfile.has_password || currentProfile.password
                            ? isEn
                              ? 'Password Protected'
                              : 'Пароль активен'
                            : isEn
                            ? 'No Password Set'
                            : 'Пароль еще не задан'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8E8E93]">
                    {isEn
                      ? 'Changes are immediately synchronized across corporate tasks & Telegram'
                      : 'Изменения мгновенно синхронизируются во всех поручениях и Telegram'}
                  </span>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className={PRIMARY_BTN_CLASS}
                  >
                    {isSavingProfile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isSavingProfile
                        ? t('profile.savingBtn')
                        : isEn
                        ? 'Save Profile Changes'
                        : 'Сохранить изменения профиля'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =================================================================
              TAB 7: ОРГАНИЗАЦИЯ И БИЛЛИНГ / WORKSPACE & BILLING
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
                            {isEn
                              ? `Corporate Plan Quotas & Limits (${selectedPlan})`
                              : `Квоты и лимиты корпоративного тарифа (${selectedPlan})`}
                          </h3>
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            {isEn
                              ? 'Monitoring employee seat licenses, AI quotas, and secure API gateway'
                              : 'Мониторинг лицензий сотрудников, AI-квот и защищенного API-шлюза компании'}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>
                          {isEn
                            ? 'Storage & API Gateway: Active'
                            : 'Хранилище и API-шлюз: Активно'}
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="rounded-lg border border-white/[0.07] bg-[#151519] p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#A1A1AA] font-medium">
                            {isEn
                              ? `Active Employees (${selectedPlan} Plan)`
                              : `Активные сотрудники (Тариф ${selectedPlan})`}
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
                            {isEn
                              ? 'Cloud Storage, Telegram Webhook & TedCloud Intelligence'
                              : 'Хранилище, Telegram Webhook и TedCloud Intelligence'}
                          </span>
                          <span className="tabular-nums font-semibold text-emerald-400">
                            {isEn ? 'Active · 99.98% SLA' : 'Активно · 99.98% SLA'}
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

                {/* Subscription Plan Selector */}
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
                          priceRub: getPlanPrice('Trial', 'RUB', 'monthly'),
                          desc: isEn
                            ? `${PRICING_PLANS.Trial.seatsLabelEn} · Kanban, Chat & Shift Tracker`
                            : `${PRICING_PLANS.Trial.seatsLabelRu} · Задачи, Чат и Табель смен`,
                        },
                        {
                          tier: 'Business' as SubscriptionPlanTier,
                          priceRub: getPlanPrice('Business', 'RUB', 'monthly'),
                          desc: isEn
                            ? `${PRICING_PLANS.Business.seatsLabelEn} · Full CRM, PDF Docs & AI Studio (-20% yearly: $79/mo)`
                            : `${PRICING_PLANS.Business.seatsLabelRu} · Полная CRM, Договоры А4 и ИИ (-20% на год: 7 920 ₽/мес)`,
                        },
                        {
                          tier: 'Enterprise' as SubscriptionPlanTier,
                          priceRub: getPlanPrice('Enterprise', 'RUB', 'monthly'),
                          desc: isEn
                            ? `${PRICING_PLANS.Enterprise.seatsLabelEn} · SLA 99.9%, Dedicated Contour (-20% yearly: $239/mo)`
                            : `${PRICING_PLANS.Enterprise.seatsLabelRu} · SLA 99.9%, Выделенный контур (-20% на год: 23 920 ₽/мес)`,
                        },
                      ] as const
                    ).map((planItem) => {
                      const isCurrent = selectedPlan === planItem.tier;
                      const isFeatured = planItem.tier === 'Business';
                      return (
                        <div
                          key={planItem.tier}
                          className={`rounded-lg border p-4 flex flex-col justify-between transition-colors ${
                            isFeatured
                              ? 'tc-pricing-featured border-indigo-500/60 bg-[#151525] !text-white'
                              : isCurrent
                              ? 'border-white/80 bg-white/[0.04]'
                              : 'border-white/[0.07] bg-[#141418] hover:border-white/[0.18]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-sm font-semibold ${
                                  isFeatured ? '!text-white' : 'text-white'
                                }`}
                              >
                                {planItem.tier}
                              </span>
                              <span
                                className={`text-xs font-semibold whitespace-nowrap tabular-nums ${
                                  isFeatured ? '!text-white' : 'text-[#D4D4D8]'
                                }`}
                              >
                                {formatMoney(planItem.priceRub)} / {isEn ? 'mo' : 'мес'}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] leading-relaxed mt-2 ${
                                isFeatured ? '!text-indigo-100' : 'text-[#8E8E93]'
                              }`}
                            >
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
                            className={`mt-4 w-full py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
                              isFeatured
                                ? 'bg-indigo-600 hover:bg-indigo-500 !text-white border-indigo-500'
                                : isCurrent
                                ? 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30 hover:bg-indigo-500/25'
                                : 'bg-white/[0.04] text-[#D4D4D8] border-white/[0.08] hover:bg-white/[0.09] hover:text-white'
                            }`}
                          >
                            {planItem.tier === 'Trial'
                              ? isCurrent
                                ? t('workspace.activeTier')
                                : t('workspace.upgradeBtn')
                              : isCurrent
                              ? isEn
                                ? 'Renew / Issue Invoice'
                                : 'Продлить / Выставить счет'
                              : isEn
                              ? 'Select Plan'
                              : 'Выбрать тариф'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Платежный шлюз, Локализация и Модальные триггеры (Реквизиты юрлица + Журнал безопасности) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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

              {/* Компактная панель корпоративных реквизитов, экспорта и аудита безопасности (Progressive Disclosure) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-white truncate">
                        {isEn
                          ? 'Legal Entity & Payer Details'
                          : 'Юридические реквизиты плательщика'}
                      </h3>
                    </div>
                    <p className="text-xs text-[#8E8E93] truncate">
                      {payerLegalName || companyName}
                      {payerTaxId ? ` · ${paymentRegion === 'RU' ? 'ИНН' : 'VAT'} ${payerTaxId}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLegalRequisitesModalOpen(true)}
                    className={SECONDARY_BTN_CLASS}
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {isEn
                        ? 'Configure Legal Entity Details'
                        : 'Настроить реквизиты юрлица'}
                    </span>
                  </button>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-400 shrink-0" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-white truncate">
                        {isEn
                          ? 'Security Audit Log'
                          : 'Журнал аудита безопасности'}
                      </h3>
                      {safeAuditLogs.length > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-300 tabular-nums">
                          {safeAuditLogs.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8E8E93] truncate">
                      {isEn
                        ? 'Immutable ledger of access & billing mutations'
                        : 'Неизменяемый реестр событий безопасности и биллинга'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSecurityAuditModalOpen(true)}
                    className={SECONDARY_BTN_CLASS}
                  >
                    <History className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {isEn
                        ? 'Open Security Audit Log'
                        : 'Открыть журнал безопасности'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 4. Таблица «История счетов и платежей» (billing_invoices) — с ЕДИНСТВЕННОЙ Primary CTA на экране биллинга */}
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      {isEn
                        ? 'Billing & Payment History (B2B Invoices)'
                        : 'История счетов и платежей (B2B Invoices)'}
                    </h3>
                    {safeInvoices.length > 0 && (
                      <span className="text-[11px] font-medium text-[#71717A] bg-white/[0.04] px-2 py-0.5 rounded tabular-nums">
                        {safeInvoices.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {perms.data_export && (
                      <button
                        type="button"
                        onClick={handleExportDealsCsv}
                        className={SECONDARY_BTN_CLASS}
                      >
                        <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
                        <span>{isEn ? 'Export CSV' : 'Выгрузить CSV'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setCheckoutModalPlan(selectedPlan === 'Trial' ? 'Business' : selectedPlan)
                      }
                      className={PRIMARY_BTN_CLASS}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Issue New Invoice' : 'Выставить новый счет'}</span>
                    </button>
                  </div>
                </div>

                {safeInvoices.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="text-xs font-medium text-white">
                      {isEn
                        ? 'No invoices issued for your organization yet'
                        : 'По вашей организации пока нет выставленных счетов'}
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      {isEn
                        ? 'Select the Business or Enterprise plan to generate an official B2B invoice or pay by card.'
                        : 'Выберите тариф «Business» или «Enterprise», чтобы сформировать официальный B2B-счет на оплату или оплатить подписку картой.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] font-medium text-[#71717A] uppercase tracking-wider">
                          <th className="py-3 px-5">{isEn ? 'Invoice #' : '№ счета'}</th>
                          <th className="py-3 px-5">{isEn ? 'Date' : 'Дата'}</th>
                          <th className="py-3 px-5">
                            {isEn ? 'Plan & Cycle' : 'Тариф и период'}
                          </th>
                          <th className="py-3 px-5">{isEn ? 'Amount' : 'Сумма'}</th>
                          <th className="py-3 px-5">{isEn ? 'Status' : 'Статус'}</th>
                          <th className="py-3 px-5 text-right">
                            {isEn ? 'Document' : 'Документ'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-xs">
                        {safeInvoices.map((inv) => {
                          const isPaid = inv.status === 'Paid';
                          const dateStr = inv.created_at
                            ? new Date(inv.created_at).toLocaleDateString(
                                isEn ? 'en-US' : 'ru-RU'
                              )
                            : '—';
                          return (
                            <tr key={inv.id} className="hover:bg-[#16161A] transition-colors">
                              <td className="py-3.5 px-5 tabular-nums font-semibold text-white">
                                {inv.invoice_number}
                              </td>
                              <td className="py-3.5 px-5 text-[#A1A1AA] tabular-nums">{dateStr}</td>
                              <td className="py-3.5 px-5">
                                <span className="font-medium text-white">
                                  {isEn ? `${inv.plan} Plan` : `Тариф ${inv.plan}`}
                                </span>
                                <span className="text-[11px] text-[#71717A] ml-1.5">
                                  (
                                  {inv.billing_cycle === 'yearly'
                                    ? isEn
                                      ? '12 months, -20%'
                                      : '12 месяцев, -20%'
                                    : isEn
                                    ? '1 month'
                                    : '1 месяц'}
                                  )
                                </span>
                              </td>
                              <td className="py-3.5 px-5 tabular-nums font-semibold text-white">
                                {formatMoney(Number(inv.amount || 0))}
                              </td>
                              <td className="py-3.5 px-5">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-medium text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{isEn ? 'Paid' : 'Оплачен'}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium text-amber-300">
                                    <Clock className="w-3 h-3" />
                                    <span>{isEn ? 'Pending' : 'Ожидает оплаты'}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setPrintableInvoice(inv)}
                                  className={SECONDARY_BTN_CLASS}
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>
                                    {isEn ? 'Open Invoice (Print / PDF)' : 'Открыть счет (Печать / PDF)'}
                                  </span>
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

              {/* 5. РАСШИРЕННЫЙ ЦЕНТР ЭКСПОРТА ДАННЫХ КОМПАНИИ (7 КОНТУРОВ CSV / EXCEL UTF-8 BOM) */}
              <CorporateDataExportCenter
                company={company}
                tasks={safeTasks}
                leads={safeLeads}
                nodes={safeNodes}
                workShifts={safeWorkShifts}
                invoices={safeInvoices}
                messages={safeMessages}
                auditLogs={safeAuditLogs}
                showToast={showToast}
              />

              {/* 6. ЦЕНТР БЕЗОПАСНОСТИ И ЗДОРОВЬЯ КОНТУРА + РЕЖИМ ТЕСТИРОВЩИКА (E2E SANDBOX 8/8) */}
              <SuperadminQaAuditPanel
                company={company}
                nodes={safeNodes}
                tasks={safeTasks}
                leads={safeLeads}
                onSendMessage={onSendMessage}
                onNavigateToSection={(sec) => setActiveSection(sec)}
                onRefresh={onRefresh}
                showToast={showToast}
              />
            </div>
          )}
        </main>
      </div>

      {/* =================================================================
          БЛОК 4: МОБИЛЬНЫЙ SLIDE-OVER DRAWER МЕНЮ (< 1024px)
      ================================================================== */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[82vw] h-full bg-[#09090B] border-r border-white/[0.08] flex flex-col justify-between p-4 overflow-y-auto no-scrollbar shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-semibold text-xs">
                    TC
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-none">TedCloud</div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">{companyName}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {currentProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left rounded-xl border border-white/[0.08] bg-[#121216] p-3 flex items-center gap-2.5"
                >
                  <UserAvatar
                    name={currentProfile.name}
                    avatarUrl={currentProfile.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">
                      {currentProfile.name}
                    </div>
                    <div className="text-[11px] text-[#8E8E93] truncate">
                      {formatRole(currentProfile.role_type)}
                    </div>
                  </div>
                </button>
              )}

              <nav className="space-y-1">
                {(
                  [
                    {
                      id: 'overview' as DashboardSection,
                      label: t('nav.overview'),
                      icon: LayoutDashboard,
                      visible: true,
                    },
                    {
                      id: 'tasks' as DashboardSection,
                      label: t('nav.tasks'),
                      icon: CheckCircle2,
                      visible: true,
                    },
                    {
                      id: 'crm' as DashboardSection,
                      label: t('nav.crm'),
                      icon: Briefcase,
                      visible: perms.crm_view,
                    },
                    {
                      id: 'communications' as DashboardSection,
                      label: t('nav.communications'),
                      icon: MessageSquare,
                      visible: true,
                    },
                    {
                      id: 'team' as DashboardSection,
                      label: t('nav.team'),
                      icon: Users,
                      visible: perms.team_manage,
                    },
                    {
                      id: 'profile' as DashboardSection,
                      label: t('nav.profile'),
                      icon: UserCircle,
                      visible: true,
                    },
                    {
                      id: 'workspace' as DashboardSection,
                      label: t('nav.workspace'),
                      icon: Building2,
                      visible: perms.billing_admin,
                    },
                  ] as const
                )
                  .filter((item) => item.visible)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-zinc-800/90 text-white'
                            : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
              </nav>
            </div>

            <div className="pt-4 border-t border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#141418] p-0.5">
                  {(['ru', 'en'] as LanguageCode[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase ${
                        language === lang ? 'bg-white text-black' : 'text-[#8E8E93]'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-[#141418] text-xs font-medium text-white"
                >
                  {theme === 'light' ? (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-700" />
                      <span>{isEn ? 'Dark' : 'Темная'}</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isEn ? 'Light' : 'Светлая'}</span>
                    </>
                  )}
                </button>
              </div>

              {onResetSession && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    requestSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-[#141418] text-xs font-medium text-[#A1A1AA] hover:text-white"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('sidebar.switchAccount')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          БЛОК 4: МОБИЛЬНАЯ НИЖНЯЯ ПАНЕЛЬ НАВИГАЦИИ (< 1024px, Telegram Mini App)
      ================================================================== */}
      <nav
        aria-label="Mobile bottom navigation"
        className={`fixed bottom-0 inset-x-0 z-40 lg:hidden backdrop-blur-xl border-t pb-[env(safe-area-inset-bottom)] ${
          theme === 'light'
            ? 'bg-white/95 border-[#e2e8f0]'
            : 'bg-[#09090B]/95 border-white/[0.08]'
        }`}
      >
        <div className="grid grid-cols-5 h-14">
          {(
            [
              {
                id: 'overview' as DashboardSection,
                label: isEn ? 'Overview' : 'Дашборд',
                icon: LayoutDashboard,
              },
              {
                id: 'tasks' as DashboardSection,
                label: isEn ? 'Tasks' : 'Задачи',
                icon: CheckCircle2,
              },
              perms.crm_view
                ? {
                    id: 'crm' as DashboardSection,
                    label: isEn ? 'Deals' : 'Сделки',
                    icon: Briefcase,
                  }
                : {
                    id: 'workspace' as DashboardSection,
                    label: isEn ? 'Billing' : 'Тариф',
                    icon: Building2,
                  },
              {
                id: 'communications' as DashboardSection,
                label: isEn ? 'Chat' : 'Чат',
                icon: MessageSquare,
              },
              {
                id: 'profile' as DashboardSection,
                label: isEn ? 'Profile' : 'Профиль',
                icon: UserCircle,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? theme === 'light'
                      ? 'text-[#0f172a] font-semibold'
                      : 'text-white font-semibold'
                    : 'text-[#71717A]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-[64px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

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

      {/* Employee Inspector & Granular Permissions Matrix Modal (БЛОК 3) */}
      <PermissionsMatrixModal
        node={permissionsModalNode}
        tasks={safeTasks}
        departments={companyDepartments}
        botUsername={botUsername}
        canManageTeam={perms.team_manage}
        onAddCompanyDepartment={handleAddDepartment}
        onClose={() => setPermissionsModalNode(null)}
        onSave={handleSaveNodePermissionsMatrix}
        onDeleteNode={(nodeToDelete) => {
          requestDeleteRecord('organization_nodes', nodeToDelete.id, nodeToDelete.name);
        }}
      />

      {/* Central Task Modal & CRM Deal Drawer */}
      <SlideOverDrawer
        target={activeDrawerTarget}
        nodes={safeNodes}
        leads={visibleLeads}
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
        onDeleteTask={(taskId, taskTitle) => {
          setDrawerSelection(null);
          requestDeleteRecord('tasks', taskId, taskTitle);
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

      {currentProfile && (
        <TedCloudAiDrawer
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          companyId={companyId}
          companyName={companyName}
          currentUser={currentProfile}
          nodes={safeNodes}
          tasks={visibleTasks}
          leads={visibleLeads}
          onRefreshData={async () => {
            await onRefresh();
          }}
          onNavigateToSection={(sec) => {
            if (sec === 'crm' && !perms.crm_view) return;
            setActiveSection(sec as any);
          }}
          onOpenLegalDocModal={(lead) => {
            setIsAiDrawerOpen(false);
            setLegalDocModalDeal(lead);
          }}
          showToast={showToast}
        />
      )}

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

      {/* Цифровой пропуск сотрудника (Digital Employee Pass — Единый компонент без сырых <input> URL) */}
      {inspectInviteNode && (
        <MyAccessKeysModal
          isOpen={Boolean(inspectInviteNode)}
          onClose={() => setInspectInviteNode(null)}
          profile={inspectInviteNode}
          botUsername={botUsername}
          copiedToken={copiedToken}
          onCopy={copyToClipboard}
        />
      )}

      {/* Progressive Disclosure Modals (БЛОК 1: Полномочия, Ключи входа, Реквизиты плательщика, Аудит безопасности) */}
      {currentProfile && (
        <>
          <MyPermissionsModal
            isOpen={isMyPermissionsModalOpen}
            onClose={() => setIsMyPermissionsModalOpen(false)}
            accessLevel={currentAccessLevel}
            permissions={perms}
            employeeName={currentProfile.name}
          />
          <MyAccessKeysModal
            isOpen={isMyAccessKeysModalOpen}
            onClose={() => setIsMyAccessKeysModalOpen(false)}
            profile={currentProfile}
            botUsername={botUsername}
            copiedToken={copiedToken}
            onCopy={copyToClipboard}
          />
        </>
      )}

      <LegalRequisitesModal
        isOpen={isLegalRequisitesModalOpen}
        onClose={() => setIsLegalRequisitesModalOpen(false)}
        paymentRegion={paymentRegion}
        payerLegalName={payerLegalName}
        setPayerLegalName={setPayerLegalName}
        payerTaxId={payerTaxId}
        setPayerTaxId={setPayerTaxId}
        payerRegNumber={payerRegNumber}
        setPayerRegNumber={setPayerRegNumber}
        payerLegalAddress={payerLegalAddress}
        setPayerLegalAddress={setPayerLegalAddress}
        payerBillingEmail={payerBillingEmail}
        setPayerBillingEmail={setPayerBillingEmail}
        payerCountry={payerCountry}
        setPayerCountry={setPayerCountry}
        isSaving={isSavingBillingDetails}
        onSubmit={async (e) => {
          await handleSaveBillingDetails(e);
          setIsLegalRequisitesModalOpen(false);
        }}
        onGenerateInvoice={() =>
          setCheckoutModalPlan(selectedPlan === 'Trial' ? 'Business' : selectedPlan)
        }
      />

      <SecurityAuditLogModal
        isOpen={isSecurityAuditModalOpen}
        onClose={() => setIsSecurityAuditModalOpen(false)}
        companyName={companyName}
        auditLogs={safeAuditLogs}
      />

      <RequestApprovalModal
        isOpen={isRequestApprovalModalOpen}
        onClose={() => setIsRequestApprovalModalOpen(false)}
        nodes={safeNodes}
        currentProfile={currentProfile}
        companyId={companyId}
        onCreated={async () => {
          await onRefresh();
        }}
        showToast={showToast}
      />

      <LegalDocumentGeneratorModal
        deal={legalDocModalDeal}
        company={company}
        onClose={() => setLegalDocModalDeal(null)}
      />

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
