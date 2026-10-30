import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Building2,
  UserPlus,
  LogIn,
  KeyRound,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Send,
  Globe,
  PlusCircle,
  ArrowRight,
  ArrowLeft,
  Layers,
  MessageSquare,
  Briefcase,
  CheckSquare,
  FileText,
  Check,
  Users,
  Calculator,
  Download,
  Monitor,
  Clock,
  Activity,
  TrendingUp,
  Plus,
  BarChart3,
  Paperclip,
  Cpu,
  Command,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  LayoutDashboard,
  Hash,
  Smartphone,
} from 'lucide-react';
import {
  BillingCycle,
  Company,
  CrmLeadRecord,
  CurrencyCode,
  OrganizationNode,
  SubscriptionPlanTier,
  TaskRecord,
} from '../types/database';
import {
  PRICING_PLANS,
  getPlanPrice,
  formatCompanyCurrency,
  formatError,
} from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';
import { TeddyAvatar } from './TedCloudAiDrawer';

interface AuthGateProps {
  existingNodes?: OrganizationNode[];
  nodes?: OrganizationNode[];
  tasks?: TaskRecord[];
  leads?: CrmLeadRecord[];
  existingCompany?: Company | null;
  company?: Company | null;
  currentUser?: OrganizationNode | null;
  botUsername?: string;
  showcaseOnly?: boolean;
  onCloseShowcase?: () => void;
  onSelectPlanFromWorkspace?: (planTier: SubscriptionPlanTier) => void;
  onAuthenticated: (profile: OrganizationNode, company: Company | null) => Promise<void> | void;
}

type AuthTab = 'login' | 'register_invite' | 'register_company';
type HeroWorkspaceSection = 'dashboard' | 'tasks' | 'crm' | 'communications' | 'shifts' | 'team';
type KanbanStage = 'Todo' | 'In Progress' | 'Review' | 'Done';

interface ShowcaseKanbanCard {
  id: string;
  code: string;
  titleRu: string;
  titleEn: string;
  deptRu: string;
  deptEn: string;
  assigneeRu: string;
  assigneeEn: string;
  avatarGrad: string;
  priority: 'High' | 'Medium';
  stage: KanbanStage;
  checklistDone: number;
  checklistTotal: number;
  dueLabelRu: string;
  dueLabelEn: string;
}

interface ShowcaseCrmDeal {
  id: string;
  clientRu: string;
  clientEn: string;
  inn: string;
  stageRu: string;
  stageEn: string;
  stageTone: 'emerald' | 'indigo' | 'amber';
  amountRub: number;
  amountUsd: number;
  managerRu: string;
  managerEn: string;
  contractNo: string;
  subjectRu: string;
  subjectEn: string;
}

interface ShowcaseEmployeeItem {
  id: string;
  nameRu: string;
  nameEn: string;
  roleRu: string;
  roleEn: string;
  deptRu: string;
  deptEn: string;
  avatarGrad: string;
  initials: string;
  onShift: boolean;
  shiftTime: string;
  weeklyHours: number;
  weeklyTarget: number;
  tasksActive: number;
  tasksCompleted: number;
  inviteCode: string;
  tgConnected: boolean;
}

interface ShowcaseChatMessage {
  id: string;
  senderRu: string;
  senderEn: string;
  roleRu: string;
  roleEn: string;
  time: string;
  textRu: string;
  textEn: string;
  attachment?: {
    name: string;
    size: string;
  };
  isOwn?: boolean;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  existingNodes = [],
  nodes = [],
  tasks = [],
  leads = [],
  existingCompany = null,
  company = null,
  currentUser = null,
  showcaseOnly = false,
  onCloseShowcase,
  onSelectPlanFromWorkspace,
  onAuthenticated,
}) => {
  const { language, setLanguage } = useLocale();
  const isEn = language === 'en';

  const safeNodes = useMemo(
    () =>
      Array.isArray(nodes) && nodes.length > 0
        ? nodes
        : Array.isArray(existingNodes)
        ? existingNodes
        : [],
    [nodes, existingNodes]
  );
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const safeLeads = useMemo(() => (Array.isArray(leads) ? leads : []), [leads]);
  const resolvedCompany = company || existingCompany || null;

  const [viewMode, setViewMode] = useState<'promo' | 'auth'>(
    showcaseOnly ? 'promo' : 'auth'
  );
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // ============================================================================
  // HERO 1:1 WORKSPACE STATE (Rule 2)
  // ============================================================================
  const [heroSection, setHeroSection] = useState<HeroWorkspaceSection>('tasks');
  const [heroOnShift, setHeroOnShift] = useState<boolean>(true);
  const [heroSearchQuery, setHeroSearchQuery] = useState<string>('');
  const [addingToColumn, setAddingToColumn] = useState<KanbanStage | null>(null);
  const [newCardTitle, setNewCardTitle] = useState<string>('');

  const defaultKanbanCards: ShowcaseKanbanCard[] = useMemo(
    () => [
      {
        id: 'kc-1',
        code: 'TC-104',
        titleRu: 'Согласовать спецификацию и график поставки с ПАО «Газпром Нефть»',
        titleEn: 'Approve specification & delivery schedule with PJSC Gazprom Neft',
        deptRu: 'Коммерческий департамент',
        deptEn: 'Commercial Dept',
        assigneeRu: 'Елена Соколова',
        assigneeEn: 'Elena Sokolova',
        avatarGrad: 'from-indigo-500 to-violet-600',
        priority: 'High',
        stage: 'In Progress',
        checklistDone: 3,
        checklistTotal: 4,
        dueLabelRu: 'Сегодня, 18:00',
        dueLabelEn: 'Today, 18:00',
      },
      {
        id: 'kc-2',
        code: 'TC-108',
        titleRu: 'Провести ревизию закрывающих актов и счетов за 3 квартал',
        titleEn: 'Audit Q3 completion acts and corporate invoices',
        deptRu: 'Финансы и Право',
        deptEn: 'Finance & Legal',
        assigneeRu: 'Мария Белова',
        assigneeEn: 'Maria Belova',
        avatarGrad: 'from-emerald-500 to-teal-600',
        priority: 'Medium',
        stage: 'Review',
        checklistDone: 4,
        checklistTotal: 4,
        dueLabelRu: 'Завтра, 14:00',
        dueLabelEn: 'Tomorrow, 14:00',
      },
      {
        id: 'kc-3',
        code: 'TC-112',
        titleRu: 'Масштабировать кластер PostgreSQL и проверить резервные реплики',
        titleEn: 'Scale PostgreSQL cluster and verify standby replicas',
        deptRu: 'Инженерный блок',
        deptEn: 'Engineering',
        assigneeRu: 'Дмитрий Волков',
        assigneeEn: 'Dmitry Volkov',
        avatarGrad: 'from-sky-500 to-blue-600',
        priority: 'High',
        stage: 'Todo',
        checklistDone: 2,
        checklistTotal: 5,
        dueLabelRu: 'Через 2 дня',
        dueLabelEn: 'In 2 days',
      },
      {
        id: 'kc-4',
        code: 'TC-115',
        titleRu: 'Подписать годовой договор SLA с УК «Альфа-Капитал»',
        titleEn: 'Sign annual SLA contract with Alfa Capital Management',
        deptRu: 'Юридический отдел',
        deptEn: 'Legal Counsel',
        assigneeRu: 'Александр Громов',
        assigneeEn: 'Alexander Gromov',
        avatarGrad: 'from-amber-500 to-orange-600',
        priority: 'High',
        stage: 'Done',
        checklistDone: 3,
        checklistTotal: 3,
        dueLabelRu: 'Выполнено',
        dueLabelEn: 'Completed',
      },
      {
        id: 'kc-5',
        code: 'TC-119',
        titleRu: 'Настроить маршрутизацию PDF-договоров в Telegram-шлюз отделов',
        titleEn: 'Configure PDF contract routing to department Telegram gateway',
        deptRu: 'Операционный блок',
        deptEn: 'Operations',
        assigneeRu: 'Дмитрий Волков',
        assigneeEn: 'Dmitry Volkov',
        avatarGrad: 'from-sky-500 to-blue-600',
        priority: 'Medium',
        stage: 'In Progress',
        checklistDone: 2,
        checklistTotal: 3,
        dueLabelRu: 'Сегодня, 19:30',
        dueLabelEn: 'Today, 19:30',
      },
      {
        id: 'kc-6',
        code: 'TC-122',
        titleRu: 'Подготовить финансовый отчет по маржинальности проектов',
        titleEn: 'Prepare executive margin & EBITDA report across projects',
        deptRu: 'Финансы и Право',
        deptEn: 'Finance & Legal',
        assigneeRu: 'Елена Соколова',
        assigneeEn: 'Elena Sokolova',
        avatarGrad: 'from-indigo-500 to-violet-600',
        priority: 'Medium',
        stage: 'Todo',
        checklistDone: 1,
        checklistTotal: 4,
        dueLabelRu: 'Пятница, 16:00',
        dueLabelEn: 'Friday, 16:00',
      },
    ],
    []
  );

  const [kanbanCards, setKanbanCards] = useState<ShowcaseKanbanCard[]>(defaultKanbanCards);

  // Bonus Rule 2: If authenticated user has real tasks, merge them into the Hero Workspace preview
  useEffect(() => {
    if (safeTasks.length > 0) {
      const mappedReal: ShowcaseKanbanCard[] = safeTasks.slice(0, 6).map((t, idx) => {
        const st: KanbanStage =
          t.status === 'Done'
            ? 'Done'
            : t.status === 'Review'
            ? 'Review'
            : t.status === 'In Progress'
            ? 'In Progress'
            : 'Todo';
        const grads = [
          'from-indigo-500 to-violet-600',
          'from-emerald-500 to-teal-600',
          'from-sky-500 to-blue-600',
          'from-amber-500 to-orange-600',
        ];
        return {
          id: t.id || `real-t-${idx}`,
          code: `TC-${101 + idx}`,
          titleRu: t.title,
          titleEn: t.title,
          deptRu: t.department || 'Операционный блок',
          deptEn: t.department || 'Operations',
          assigneeRu: currentUser?.name || 'Александр Громов',
          assigneeEn: currentUser?.name || 'Alexander Gromov',
          avatarGrad: grads[idx % grads.length],
          priority: t.priority === 'High' ? 'High' : 'Medium',
          stage: st,
          checklistDone: st === 'Done' ? 4 : 3,
          checklistTotal: 4,
          dueLabelRu: t.due_date || 'Сегодня, 18:00',
          dueLabelEn: t.due_date || 'Today, 18:00',
        };
      });
      setKanbanCards(
        mappedReal.length >= 4
          ? mappedReal
          : [...mappedReal, ...defaultKanbanCards.slice(0, 4 - mappedReal.length)]
      );
    }
  }, [safeTasks, currentUser, defaultKanbanCards]);

  const showcaseDeals: ShowcaseCrmDeal[] = useMemo(() => {
    const baseDeals: ShowcaseCrmDeal[] = [
      {
        id: 'deal-1',
        clientRu: 'ПАО «Газпром Нефть»',
        clientEn: 'PJSC Gazprom Neft',
        inn: '7842390112',
        stageRu: 'Согласование договора',
        stageEn: 'Contract Review',
        stageTone: 'indigo',
        amountRub: 4200000,
        amountUsd: 46500,
        managerRu: 'Елена Соколова',
        managerEn: 'Elena Sokolova',
        contractNo: 'TC-2026/084',
        subjectRu: 'Развертывание корпоративного контура TedCloud Enterprise (150 лицензий)',
        subjectEn: 'Deployment of TedCloud Enterprise Corporate Contour (150 seats)',
      },
      {
        id: 'deal-2',
        clientRu: 'УК «Альфа-Капитал»',
        clientEn: 'Alfa Capital Management',
        inn: '7728142569',
        stageRu: 'Оплачено · Закрыто',
        stageEn: 'Closed Won · Paid',
        stageTone: 'emerald',
        amountRub: 2850000,
        amountUsd: 31200,
        managerRu: 'Александр Громов',
        managerEn: 'Alexander Gromov',
        contractNo: 'TC-2026/079',
        subjectRu: 'Годовая подписка Business + интеграция двустороннего шлюза Telegram',
        subjectEn: 'Annual Business Subscription + Two-Way Telegram Gateway Integration',
      },
      {
        id: 'deal-3',
        clientRu: 'АО «Северсталь Диджитал»',
        clientEn: 'Severstal Digital JSC',
        inn: '3528000597',
        stageRu: 'КП отправлено',
        stageEn: 'Proposal Sent',
        stageTone: 'amber',
        amountRub: 1950000,
        amountUsd: 21400,
        managerRu: 'Дмитрий Волков',
        managerEn: 'Dmitry Volkov',
        contractNo: 'TC-2026/091',
        subjectRu: 'Лицензирование модуля CRM, генератора договоров А4 и табеля смен',
        subjectEn: 'CRM Pipeline, A4 Contract Generator & Attendance Timesheet Licensing',
      },
      {
        id: 'deal-4',
        clientRu: 'ООО «Яндекс Вертикали»',
        clientEn: 'Yandex Verticals LLC',
        inn: '7704357909',
        stageRu: 'Согласование договора',
        stageEn: 'Contract Review',
        stageTone: 'indigo',
        amountRub: 3400000,
        amountUsd: 37500,
        managerRu: 'Мария Белова',
        managerEn: 'Maria Belova',
        contractNo: 'TC-2026/095',
        subjectRu: 'Корпоративный контур управления задачами и аналитика Teddy AI',
        subjectEn: 'Enterprise Task Management Contour & Teddy AI Executive Analytics',
      },
    ];

    if (safeLeads.length > 0) {
      const mappedLeads: ShowcaseCrmDeal[] = safeLeads.slice(0, 3).map((l, idx) => ({
        id: l.id || `real-lead-${idx}`,
        clientRu: l.client_name,
        clientEn: l.client_name,
        inn: l.company_inn || `77084920${11 + idx}`,
        stageRu:
          l.status === 'Won'
            ? 'Оплачено · Закрыто'
            : l.status === 'Negotiation'
            ? 'Согласование договора'
            : 'КП отправлено',
        stageEn:
          l.status === 'Won'
            ? 'Closed Won · Paid'
            : l.status === 'Negotiation'
            ? 'Contract Review'
            : 'Proposal Sent',
        stageTone:
          l.status === 'Won' ? 'emerald' : l.status === 'Negotiation' ? 'indigo' : 'amber',
        amountRub: l.amount || 2400000,
        amountUsd: Math.round((l.amount || 2400000) / 90),
        managerRu: currentUser?.name || 'Елена Соколова',
        managerEn: currentUser?.name || 'Elena Sokolova',
        contractNo: `TC-2026/10${idx + 1}`,
        subjectRu: l.notes || 'Корпоративное лицензирование и сопровождение контура TedCloud',
        subjectEn: l.notes || 'Enterprise workspace licensing and SLA support',
      }));
      return [...mappedLeads, ...baseDeals.slice(0, Math.max(1, 4 - mappedLeads.length))];
    }

    return baseDeals;
  }, [safeLeads, currentUser]);

  const [selectedA4Deal, setSelectedA4Deal] = useState<ShowcaseCrmDeal | null>(null);

  const initialEmployees: ShowcaseEmployeeItem[] = useMemo(() => {
    const defaults: ShowcaseEmployeeItem[] = [
      {
        id: 'emp-1',
        nameRu: 'Александр Громов',
        nameEn: 'Alexander Gromov',
        roleRu: 'Основатель / CEO',
        roleEn: 'Founder / CEO',
        deptRu: 'Исполнительная дирекция',
        deptEn: 'Executive Board',
        avatarGrad: 'from-indigo-500 to-violet-600',
        initials: 'АГ',
        onShift: true,
        shiftTime: '06:42',
        weeklyHours: 38.5,
        weeklyTarget: 40,
        tasksActive: 4,
        tasksCompleted: 19,
        inviteCode: 'TC-8401',
        tgConnected: true,
      },
      {
        id: 'emp-2',
        nameRu: 'Елена Соколова',
        nameEn: 'Elena Sokolova',
        roleRu: 'Руководитель отдела продаж',
        roleEn: 'Head of Commercial Sales',
        deptRu: 'Коммерческий департамент',
        deptEn: 'Commercial Dept',
        avatarGrad: 'from-emerald-500 to-teal-600',
        initials: 'ЕС',
        onShift: true,
        shiftTime: '05:18',
        weeklyHours: 36.0,
        weeklyTarget: 40,
        tasksActive: 5,
        tasksCompleted: 24,
        inviteCode: 'TC-8402',
        tgConnected: true,
      },
      {
        id: 'emp-3',
        nameRu: 'Дмитрий Волков',
        nameEn: 'Dmitry Volkov',
        roleRu: 'Главный системный архитектор',
        roleEn: 'Principal Systems Architect',
        deptRu: 'Инженерный блок',
        deptEn: 'Engineering',
        avatarGrad: 'from-sky-500 to-blue-600',
        initials: 'ДВ',
        onShift: true,
        shiftTime: '07:05',
        weeklyHours: 39.5,
        weeklyTarget: 40,
        tasksActive: 3,
        tasksCompleted: 27,
        inviteCode: 'TC-8403',
        tgConnected: true,
      },
      {
        id: 'emp-4',
        nameRu: 'Мария Белова',
        nameEn: 'Maria Belova',
        roleRu: 'Ведущий корпоративный юрист',
        roleEn: 'Senior Corporate Counsel',
        deptRu: 'Финансы и Право',
        deptEn: 'Finance & Legal',
        avatarGrad: 'from-amber-500 to-orange-600',
        initials: 'МБ',
        onShift: false,
        shiftTime: '04:10',
        weeklyHours: 32.0,
        weeklyTarget: 40,
        tasksActive: 2,
        tasksCompleted: 16,
        inviteCode: 'TC-8404',
        tgConnected: true,
      },
    ];

    if (safeNodes.length > 0) {
      const grads = [
        'from-indigo-500 to-violet-600',
        'from-emerald-500 to-teal-600',
        'from-sky-500 to-blue-600',
        'from-amber-500 to-orange-600',
      ];
      const mapped = safeNodes.slice(0, 4).map((n, i) => {
        const parts = (n.name || 'Сотрудник').trim().split(/\s+/);
        const init =
          parts.length >= 2
            ? `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
            : (n.name || 'TC').slice(0, 2).toUpperCase();
        return {
          id: n.id || `real-emp-${i}`,
          nameRu: n.name,
          nameEn: n.name,
          roleRu: n.role_type || 'Специалист',
          roleEn: n.role_type || 'Specialist',
          deptRu: n.department || 'Операционный блок',
          deptEn: n.department || 'Operations',
          avatarGrad: grads[i % grads.length],
          initials: init,
          onShift: n.shift_status !== 'offline',
          shiftTime: `0${5 + (i % 3)}:2${i} `,
          weeklyHours: 35 + i * 1.5,
          weeklyTarget: 40,
          tasksActive: 3 + (i % 3),
          tasksCompleted: 15 + i * 4,
          inviteCode: n.invite_code || `TC-840${i + 1}`,
          tgConnected: Boolean(n.telegram_chat_id) || true,
        };
      });
      return mapped.length >= 4 ? mapped : [...mapped, ...defaults.slice(0, 4 - mapped.length)];
    }

    return defaults;
  }, [safeNodes]);

  const [showcaseStaff, setShowcaseStaff] = useState<ShowcaseEmployeeItem[]>(initialEmployees);

  useEffect(() => {
    setShowcaseStaff(initialEmployees);
  }, [initialEmployees]);

  // Hero Communications Chat & Telegram Sync State
  const [activeChatChannel, setActiveChatChannel] = useState<'general' | 'commercial' | 'direct'>(
    'commercial'
  );
  const [chatComposerInput, setChatComposerInput] = useState<string>('');
  const [tgSyncPulse, setTgSyncPulse] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ShowcaseChatMessage[]>([
    {
      id: 'cm-1',
      senderRu: 'Елена Соколова',
      senderEn: 'Elena Sokolova',
      roleRu: 'Руководитель отдела продаж',
      roleEn: 'Head of Sales',
      time: '14:18',
      textRu:
        'Коллеги, юридический департамент ПАО «Газпром Нефть» подтвердил финальную редакцию договора № TC-2026/084 на сумму 4 200 000 ₽.',
      textEn:
        'Team, PJSC Gazprom Neft legal counsel approved the final revision of Agreement No. TC-2026/084 for $46,500.',
    },
    {
      id: 'cm-2',
      senderRu: 'Мария Белова',
      senderEn: 'Maria Belova',
      roleRu: 'Финансы и Право',
      roleEn: 'Finance & Legal',
      time: '14:21',
      textRu:
        'Прикрепляю подписанный PDF-экземпляр с печатью и спецификацией. Документ автоматически отправлен в Telegram руководителю проекта.',
      textEn:
        'Attaching the signed PDF copy with corporate seal and specification. Automatically delivered to the project lead in Telegram.',
      attachment: {
        name: 'Договор_поставки.pdf',
        size: '420 КБ',
      },
      isOwn: true,
    },
  ]);

  const handleSendHeroChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatComposerInput.trim();
    if (!text) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages((prev) => [
      ...prev,
      {
        id: `cm-${Date.now()}`,
        senderRu: currentUser?.name || 'Александр Громов',
        senderEn: currentUser?.name || 'Alexander Gromov',
        roleRu: 'Исполнительная дирекция',
        roleEn: 'Executive Board',
        time: nowTime,
        textRu: text,
        textEn: text,
        isOwn: true,
      },
    ]);
    setChatComposerInput('');
    setTgSyncPulse(true);
    setTimeout(() => setTgSyncPulse(false), 1200);
  };

  const handleMoveKanbanCard = (cardId: string, direction: 'prev' | 'next') => {
    const order: KanbanStage[] = ['Todo', 'In Progress', 'Review', 'Done'];
    setKanbanCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        const idx = order.indexOf(c.stage);
        const nextIdx =
          direction === 'next'
            ? Math.min(order.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        const nextStage = order[nextIdx];
        return {
          ...c,
          stage: nextStage,
          checklistDone: nextStage === 'Done' ? c.checklistTotal : c.checklistDone,
        };
      })
    );
  };

  const handleCreateKanbanCard = (stage: KanbanStage) => {
    const clean = newCardTitle.trim();
    if (!clean) return;
    const nextNum = 125 + kanbanCards.length;
    const created: ShowcaseKanbanCard = {
      id: `kc-custom-${Date.now()}`,
      code: `TC-${nextNum}`,
      titleRu: clean,
      titleEn: clean,
      deptRu: 'Операционный блок',
      deptEn: 'Operations',
      assigneeRu: currentUser?.name || 'Александр Громов',
      assigneeEn: currentUser?.name || 'Alexander Gromov',
      avatarGrad: 'from-indigo-500 to-violet-600',
      priority: 'High',
      stage,
      checklistDone: stage === 'Done' ? 3 : 1,
      checklistTotal: 3,
      dueLabelRu: 'Сегодня, 19:00',
      dueLabelEn: 'Today, 19:00',
    };
    setKanbanCards((prev) => [created, ...prev]);
    setNewCardTitle('');
    setAddingToColumn(null);
  };

  // ============================================================================
  // TEDDY AI LIVE GLASS CONSOLE STATE (Rule 4)
  // ============================================================================
  const [activeTeddyScenarioIdx, setActiveTeddyScenarioIdx] = useState<number>(0);
  const [teddyCustomQuery, setTeddyCustomQuery] = useState<string>('');
  const [customBriefResult, setCustomBriefResult] = useState<{
    query: string;
    modeLabelRu: string;
    modeLabelEn: string;
    summaryRu: string;
    summaryEn: string;
    metrics: Array<{ labelRu: string; labelEn: string; value: string; delta: string }>;
    funnelBars: Array<{ labelRu: string; labelEn: string; pct: number; amount: string }>;
    stepsRu: string[];
    stepsEn: string[];
    taskDraft: {
      id: string;
      titleRu: string;
      titleEn: string;
      deptRu: string;
      deptEn: string;
      priorityRu: string;
      priorityEn: string;
    };
  } | null>(null);
  const [createdDemoTaskIds, setCreatedDemoTaskIds] = useState<string[]>([]);

  // ============================================================================
  // ROI & PRICING STATE
  // ============================================================================
  const [pricingCurrency, setPricingCurrency] = useState<CurrencyCode>(
    language === 'en' ? 'USD' : 'RUB'
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [teamSizeCalc, setTeamSizeCalc] = useState<number>(28);
  const [preselectedPlan, setPreselectedPlan] = useState<SubscriptionPlanTier>('Business');

  useEffect(() => {
    setPricingCurrency(language === 'en' ? 'USD' : 'RUB');
  }, [language]);

  useEffect(() => {
    if (showcaseOnly) {
      setViewMode('promo');
    }
  }, [showcaseOnly]);

  // ============================================================================
  // AUTH GATE FORM STATES
  // ============================================================================
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginSecret, setLoginSecret] = useState<string>('');
  const [otpModeActive, setOtpModeActive] = useState<boolean>(false);
  const [otpCodeInput, setOtpCodeInput] = useState<string>('');
  const [otpDeliveryHint, setOtpDeliveryHint] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [founderName, setFounderName] = useState<string>('');
  const [founderDepartment, setFounderDepartment] = useState<string>('Исполнительная дирекция');
  const [founderPassword, setFounderPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || showcaseOnly) return;
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam && inviteParam.trim()) {
      setViewMode('auth');
      setInviteCode(inviteParam.trim().toUpperCase());
      setActiveTab('register_invite');
    }
  }, [showcaseOnly]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setErrorMessage(
        isEn
          ? 'Enter your full name, email, Telegram ID, or invite code.'
          : 'Введите ФИО, корпоративный Email, Telegram ID или инвайт-код.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'login',
          input: identifier,
          password: loginSecret.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok || !data?.profile) {
        setErrorMessage(
          formatError(
            data?.error ||
              (isEn
                ? 'Invalid credentials. Please verify your input.'
                : 'Ошибка проверки учетных данных.')
          )
        );
        return;
      }

      await onAuthenticated(data.profile, data.company || resolvedCompany);
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendTelegramOtp = async () => {
    setErrorMessage(null);
    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setErrorMessage(
        isEn
          ? 'Enter your Telegram ID or full name first to receive a 2FA code.'
          : 'Укажите ваш Telegram ID или ФИО для отправки 4-значного кода.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'send_telegram_otp',
          input: identifier,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        setErrorMessage(formatError(data?.error || 'Не удалось отправить код в Telegram.'));
        return;
      }
      setOtpModeActive(true);
      setOtpCodeInput('');
      setOtpDeliveryHint(
        data.demoOtpHint
          ? isEn
            ? `4-digit confirmation code generated (${data.demoOtpHint})`
            : `Сгенерирован 4-значный код подтверждения (${data.demoOtpHint})`
          : isEn
          ? `A 4-digit confirmation code was sent to Telegram for ${data.employeeName}.`
          : `4-значный код подтверждения отправлен в Telegram для сотрудника ${data.employeeName}.`
      );
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanCode = otpCodeInput.replace(/\D/g, '').trim();
    if (cleanCode.length !== 4) {
      setErrorMessage(
        isEn ? 'Enter the 4-digit code from Telegram.' : 'Введите 4-значный код из Telegram.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'verify_telegram_otp',
          input: loginIdentifier.trim(),
          otpCode: cleanCode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !data?.profile) {
        setErrorMessage(
          formatError(data?.error || (isEn ? 'Invalid 4-digit code.' : 'Неверный 4-значный код.'))
        );
        return;
      }
      setOtpModeActive(false);
      await onAuthenticated(data.profile, data.company || resolvedCompany);
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage(
        isEn
          ? 'Enter your personal invite code (TC-XXXX).'
          : 'Введите ваш персональный инвайт-код (TC-XXXX).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'login',
          loginMode: 'invite',
          input: cleanCode,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok || !data?.profile) {
        setErrorMessage(
          formatError(
            data?.error ||
              (isEn ? 'Invite code not found.' : 'Сотрудник с таким инвайт-кодом не найден.')
          )
        );
        return;
      }

      await onAuthenticated(data.profile, data.company || resolvedCompany);
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompanyRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newCompanyName.trim().length < 2 || founderName.trim().length < 2) {
      setErrorMessage(
        isEn
          ? 'Please enter a valid company name and executive full name.'
          : 'Укажите название организации и ФИО руководителя.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'register_workspace',
          companyName: newCompanyName.trim(),
          leaderName: founderName.trim(),
          leaderDepartment: founderDepartment.trim() || 'Исполнительная дирекция',
          leaderPassword: founderPassword.trim() || undefined,
          plan: preselectedPlan,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok || !data?.profile) {
        setErrorMessage(formatError(data?.error || 'Не удалось зарегистрировать компанию.'));
        return;
      }

      await onAuthenticated(data.profile, data.company || null);
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAuthFlow = (tab: AuthTab, plan?: SubscriptionPlanTier) => {
    if (plan) {
      setPreselectedPlan(plan);
    }
    if (showcaseOnly && plan && onSelectPlanFromWorkspace) {
      onSelectPlanFromWorkspace(plan);
      return;
    }
    if (showcaseOnly && onCloseShowcase) {
      onCloseShowcase();
      return;
    }
    setActiveTab(tab);
    setViewMode('auth');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const fmtPrice = (val: number) =>
    formatCompanyCurrency(val, pricingCurrency, isEn ? 'en' : 'ru');

  // ============================================================================
  // VIEW MODE 1: ENTERPRISE SHOWCASE & 1:1 WORKSPACE PLATFORM (data-surface="marketing")
  // ============================================================================
  if (viewMode === 'promo') {
    const recommendedPlanTier: SubscriptionPlanTier =
      teamSizeCalc <= 5 ? 'Trial' : teamSizeCalc <= 50 ? 'Business' : 'Enterprise';
    const recommendedPlanObj = PRICING_PLANS[recommendedPlanTier];

    // ROI & Cost Comparison calculations
    const perSeatFragmentedRate =
      pricingCurrency === 'RUB' ? 3900 : pricingCurrency === 'USD' ? 44 : 41;
    const fragmentedMonthlyTotal = teamSizeCalc * perSeatFragmentedRate;
    const tedCloudMonthlyTotal = getPlanPrice(
      recommendedPlanTier,
      pricingCurrency,
      billingCycle
    );
    const perEmployeeTedCloud =
      teamSizeCalc > 0 ? Math.round(tedCloudMonthlyTotal / teamSizeCalc) : 0;
    const monthlySavings = Math.max(0, fragmentedMonthlyTotal - tedCloudMonthlyTotal);
    const annualSavings = monthlySavings * 12;

    // Teddy Executive Console Scenarios (Rule 4)
    const teddyConsolePresets = [
      {
        id: 'teddy-case-1',
        tabLabelRu: 'Финансовая аналитика CRM',
        tabLabelEn: 'CRM Financial Analytics',
        questionRu: 'Какие сделки в воронке CRM требуют приоритетного контроля сегодня?',
        questionEn: 'Which deals in our CRM pipeline require priority executive focus today?',
        modeLabelRu: 'Финансовая аналитика',
        modeLabelEn: 'Financial Analytics',
        summaryRu:
          'В активной воронке 12 контрактов на сумму 12,4 млн ₽. Максимальный финансовый рычаг — сделка с ПАО «Газпром Нефть» (4 200 000 ₽, стадия согласования договора). Рекомендуется выпустить спецификацию А4 и направить счет на оплату до 17:00.',
        summaryEn:
          'Active pipeline holds 12 contracts totaling $136,600. Highest financial leverage is the PJSC Gazprom Neft deal ($46,500, Contract Review stage). Recommended action: generate A4 specification and issue invoice before 17:00.',
        metrics: [
          {
            labelRu: 'Активная воронка',
            labelEn: 'Active Pipeline',
            value: isEn ? '$136,600' : '12 400 000 ₽',
            delta: '+18.4%',
          },
          {
            labelRu: 'Конверсия в оплату',
            labelEn: 'Win Conversion',
            value: '64.2%',
            delta: '+6.1%',
          },
          {
            labelRu: 'Средний цикл сделки',
            labelEn: 'Sales Velocity',
            value: isEn ? '4.2 days' : '4.2 дня',
            delta: '-32%',
          },
        ],
        funnelBars: [
          {
            labelRu: 'Согласование договора',
            labelEn: 'Contract Review',
            pct: 82,
            amount: isEn ? '$84,000' : '7 600 000 ₽',
          },
          {
            labelRu: 'Оплачено и закрыто',
            labelEn: 'Closed Won',
            pct: 64,
            amount: isEn ? '$31,200' : '2 850 000 ₽',
          },
          {
            labelRu: 'КП отправлено',
            labelEn: 'Proposal Sent',
            pct: 48,
            amount: isEn ? '$21,400' : '1 950 000 ₽',
          },
        ],
        stepsRu: [
          'Сформировать лист договора № TC-2026/084 («Газпром Нефть» — 4 200 000 ₽) с печатью.',
          'Закрепить за руководителем отдела продаж контроль поступления авансового платежа.',
          'Перевести контракт УК «Альфа-Капитал» (2 850 000 ₽) в реестр закрывающих актов.',
        ],
        stepsEn: [
          'Generate A4 Agreement No. TC-2026/084 (Gazprom Neft — $46,500) with corporate seal.',
          'Assign Head of Sales to track advance invoice settlement.',
          'Move Alfa Capital contract ($31,200) to completion act registry.',
        ],
        taskDraft: {
          id: 'teddy-task-1',
          titleRu: 'Отправить финальный договор А4 и счет для ПАО «Газпром Нефть»',
          titleEn: 'Send finalized A4 contract and invoice to PJSC Gazprom Neft',
          deptRu: 'Коммерческий департамент',
          deptEn: 'Commercial Dept',
          priorityRu: 'Высокий',
          priorityEn: 'High',
        },
      },
      {
        id: 'teddy-case-2',
        tabLabelRu: 'Операционный контроль SLA',
        tabLabelEn: 'Operations & SLA Control',
        questionRu: 'Где возникли узкие места по задачам и сменам в подразделениях?',
        questionEn: 'Where are the current task and shift bottlenecks across departments?',
        modeLabelRu: 'Операционный контроль',
        modeLabelEn: 'Operations Control',
        summaryRu:
          'Ритм соблюдения дедлайнов SLA по компании составляет 91.4%. На смене находятся 3 из 4 ведущих специалистов. В инженерном блоке зафиксирована пиковая очередь у главного архитектора — перераспределение 1 поручения ускорит сдачу релиза на 28%.',
        summaryEn:
          'Company-wide SLA compliance stands at 91.4%. 3 of 4 senior specialists are currently on active shift. Engineering has a peak queue on the Principal Architect — rebalancing 1 task will accelerate release delivery by 28%.',
        metrics: [
          {
            labelRu: 'Ритм исполнения SLA',
            labelEn: 'SLA Compliance',
            value: '91.4%',
            delta: '+4.8%',
          },
          {
            labelRu: 'Штат на смене',
            labelEn: 'Active on Shift',
            value: `${showcaseStaff.filter((s) => s.onShift).length} / ${showcaseStaff.length}`,
            delta: '96.2%',
          },
          {
            labelRu: 'Просроченные задачи',
            labelEn: 'Overdue Tasks',
            value: '0',
            delta: '100% SLA',
          },
        ],
        funnelBars: [
          {
            labelRu: 'Коммерческий департамент',
            labelEn: 'Commercial Dept',
            pct: 94,
            amount: isEn ? '24 tasks' : '24 задачи',
          },
          {
            labelRu: 'Инженерный блок',
            labelEn: 'Engineering',
            pct: 88,
            amount: isEn ? '27 tasks' : '27 задач',
          },
          {
            labelRu: 'Финансы и Право',
            labelEn: 'Finance & Legal',
            pct: 92,
            amount: isEn ? '16 tasks' : '16 задач',
          },
        ],
        stepsRu: [
          'Передать задачу по проверке резервных реплик БД дежурному инженеру смены.',
          'Подтвердить закрытие задачи TC-108 после верификации чек-листа (4/4).',
          'Синхронизировать недельный табель часов подразделений для финансового блока.',
        ],
        stepsEn: [
          'Reassign database replica verification task to the on-duty systems engineer.',
          'Confirm closure of task TC-108 following checklist validation (4/4).',
          'Synchronize weekly department hours timesheet for finance review.',
        ],
        taskDraft: {
          id: 'teddy-task-2',
          titleRu: 'Сбалансировать очередь срочных задач инженерного блока',
          titleEn: 'Rebalance urgent task queue in the engineering department',
          deptRu: 'Инженерный блок',
          deptEn: 'Engineering',
          priorityRu: 'Средний',
          priorityEn: 'Medium',
        },
      },
      {
        id: 'teddy-case-3',
        tabLabelRu: 'Автоматизация и Telegram',
        tabLabelEn: 'Task & Telegram Automation',
        questionRu: 'Как ускорить согласование документов между веб-системой и Telegram?',
        questionEn: 'How can we accelerate document approvals between Web and Telegram?',
        modeLabelRu: 'Автоматизация задач',
        modeLabelEn: 'Task Automation',
        summaryRu:
          'Прямой мост Веб ⇄ Telegram доставляет PDF-договоры, счета и поручения за 0.18 сек. Включение автоматической конвертации входящих сообщений клиентов в карточки Канбана сокращает время реакции отдела продаж в 3.4 раза.',
        summaryEn:
          'Direct Web ⇄ Telegram bridge delivers PDF contracts, invoices, and tasks in 0.18 sec. Enabling automatic conversion of incoming client messages into Kanban cards reduces sales response time by 3.4x.',
        metrics: [
          {
            labelRu: 'Скорость доставки TG',
            labelEn: 'TG Delivery Speed',
            value: isEn ? '0.18 sec' : '0.18 сек',
            delta: 'TLS 1.3',
          },
          {
            labelRu: 'Авто-конверсия в задачи',
            labelEn: 'Task Auto-Conversion',
            value: '100%',
            delta: '1-Click',
          },
          {
            labelRu: 'Привязка 2FA по штату',
            labelEn: 'Staff 2FA Coverage',
            value: '100%',
            delta: 'Verified',
          },
        ],
        funnelBars: [
          {
            labelRu: 'Доставка PDF и счетов А4',
            labelEn: 'PDF & A4 Invoice Delivery',
            pct: 98,
            amount: '0.18s',
          },
          {
            labelRu: 'Конвертация чата в задачу',
            labelEn: 'Chat-to-Task Conversion',
            pct: 91,
            amount: '1-Click',
          },
          {
            labelRu: 'Авторизация Telegram 2FA',
            labelEn: 'Telegram 2FA Auth',
            pct: 100,
            amount: 'OTP 4-Digit',
          },
        ],
        stepsRu: [
          'Нажать кнопку «В задачу» на любом сообщении с файлом в корпоративном чате.',
          'Система автоматически прикрепит PDF-договор и назначит ответственного по отделу.',
          'Сотрудник мгновенно получит карточку поручения и файл прямо в Telegram.',
        ],
        stepsEn: [
          'Click "To Task" on any message with an attachment inside the corporate chat.',
          'The platform automatically attaches the PDF contract and assigns the department owner.',
          'The employee immediately receives the task card and file directly in Telegram.',
        ],
        taskDraft: {
          id: 'teddy-task-3',
          titleRu: 'Активировать маршрутизацию PDF-договоров во все отделы через Telegram',
          titleEn: 'Activate PDF contract routing across all departments via Telegram',
          deptRu: 'Операционный блок',
          deptEn: 'Operations',
          priorityRu: 'Высокий',
          priorityEn: 'High',
        },
      },
    ];

    const activePreset = customBriefResult || teddyConsolePresets[activeTeddyScenarioIdx] || teddyConsolePresets[0];

    const handleRunCustomTeddyQuery = (e: React.FormEvent) => {
      e.preventDefault();
      const q = teddyCustomQuery.trim();
      if (!q) return;
      const lower = q.toLowerCase();
      const isFin =
        lower.includes('сделк') ||
        lower.includes('договор') ||
        lower.includes('финанс') ||
        lower.includes('выруч') ||
        lower.includes('crm') ||
        lower.includes('счет') ||
        lower.includes('deal') ||
        lower.includes('revenue');

      setCustomBriefResult({
        query: q,
        modeLabelRu: isFin ? 'Финансовая аналитика' : 'Операционный контроль',
        modeLabelEn: isFin ? 'Financial Analytics' : 'Operations Control',
        summaryRu: `Аналитический разбор по запросу «${q}»: проанализировано ${kanbanCards.length} активных поручений, ${showcaseDeals.length} контракта CRM на сумму 12,4 млн ₽ и табель из ${showcaseStaff.length} сотрудников. Критических срывов SLA не обнаружено; подготовлено приоритетное поручение для исполнения.`,
        summaryEn: `Executive analysis for "${q}": evaluated ${kanbanCards.length} active tasks, ${showcaseDeals.length} CRM contracts totaling $136,600, and ${showcaseStaff.length} staff shift records. Zero critical SLA breaches detected; priority action item prepared below.`,
        metrics: [
          {
            labelRu: 'Исполнение задач',
            labelEn: 'Task Execution',
            value: `${Math.round(
              (kanbanCards.filter((c) => c.stage === 'Done').length / Math.max(1, kanbanCards.length)) * 100
            )}%`,
            delta: '+12%',
          },
          {
            labelRu: 'Объем контрактов CRM',
            labelEn: 'CRM Contract Volume',
            value: isEn ? '$136,600' : '12 400 000 ₽',
            delta: '+18.4%',
          },
          {
            labelRu: 'Сотрудники на смене',
            labelEn: 'Staff on Shift',
            value: `${showcaseStaff.filter((s) => s.onShift).length} / ${showcaseStaff.length}`,
            delta: 'Online',
          },
        ],
        funnelBars: [
          {
            labelRu: 'Контракты на согласовании',
            labelEn: 'Contracts in Review',
            pct: 84,
            amount: isEn ? '$84,000' : '7 600 000 ₽',
          },
          {
            labelRu: 'Готовность чек-листов SLA',
            labelEn: 'SLA Checklist Readiness',
            pct: 91,
            amount: '91.4%',
          },
          {
            labelRu: 'Синхронизация Telegram',
            labelEn: 'Telegram Gateway Sync',
            pct: 99,
            amount: '0.18s',
          },
        ],
        stepsRu: [
          `Зафиксировать контрольную точку по запросу «${q}» в реестре задач компании.`,
          'Проверить статус оплаты и подписания закрывающих документов А4 в модуле CRM.',
          'Отправить сводное уведомление ответственным руководителям подразделений в Telegram.',
        ],
        stepsEn: [
          `Record milestone for "${q}" inside the company task registry.`,
          'Verify payment status and A4 contract signatures inside the CRM module.',
          'Dispatch summary notification to department heads via Telegram gateway.',
        ],
        taskDraft: {
          id: `teddy-custom-${Date.now()}`,
          titleRu: `Исполнить поручение: ${q.slice(0, 68)}`,
          titleEn: `Execute directive: ${q.slice(0, 68)}`,
          deptRu: isFin ? 'Коммерческий департамент' : 'Исполнительная дирекция',
          deptEn: isFin ? 'Commercial Dept' : 'Executive Board',
          priorityRu: 'Высокий',
          priorityEn: 'High',
        },
      });
    };

    const filteredKanbanCards = heroSearchQuery.trim()
      ? kanbanCards.filter((c) =>
          `${c.code} ${c.titleRu} ${c.titleEn} ${c.deptRu} ${c.assigneeRu}`
            .toLowerCase()
            .includes(heroSearchQuery.toLowerCase())
        )
      : kanbanCards;

    return (
      <div
        data-surface="marketing"
        className="tc-dark-promo min-h-screen bg-[#07080c] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-white overflow-x-hidden relative"
      >
        {/* =================================================================
            RULE 5: STICKY GLASS NAVIGATION HEADER
            (Платформа, Архитектура, Teddy AI, Экономика, Тарифы)
        ================================================================== */}
        <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07080c]/85 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm tracking-tight shadow-[0_0_25px_rgba(255,255,255,0.22)]">
                TC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-white">TedCloud</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300">
                    Enterprise
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">
                  {isEn
                    ? 'Corporate Workspace · CRM & A4 Contracts · Telegram Gateway'
                    : 'Корпоративная платформа управления задачами, CRM и договорами'}
                </p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-400">
              <a href="#platform" className="hover:text-white transition-colors">
                {isEn ? 'Platform' : 'Платформа'}
              </a>
              <a href="#architecture" className="hover:text-white transition-colors">
                {isEn ? 'Architecture' : 'Архитектура'}
              </a>
              <a href="#teddy-ai" className="hover:text-white transition-colors">
                Teddy AI
              </a>
              <a href="#roi-calculator" className="hover:text-white transition-colors">
                {isEn ? 'Economics' : 'Экономика'}
              </a>
              <a href="#pricing" className="hover:text-white transition-colors">
                {isEn ? 'Pricing' : 'Тарифы'}
              </a>
            </nav>

            <div className="flex items-center gap-2">
              {onCloseShowcase && (
                <button
                  type="button"
                  onClick={onCloseShowcase}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-semibold text-indigo-200 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Back to Workspace' : 'Вернуться в рабочее пространство'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.1] bg-zinc-900/70 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>{language === 'ru' ? 'RU' : 'EN'}</span>
              </button>

              {!onCloseShowcase && (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthFlow('login')}
                    className="px-3.5 py-1.5 rounded-lg border border-white/[0.12] bg-zinc-900/70 hover:bg-zinc-800 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    {isEn ? 'Sign In' : 'Войти в систему'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuthFlow('register_company', 'Trial')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    <span>{isEn ? 'Create Company' : 'Создать компанию'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* =================================================================
            HERO SECTION + RULE 5 LIGHTING + RULE 2 100% REAL TEDCLOUD WINDOW
        ================================================================== */}
        <section className="relative z-10 pt-14 pb-16 overflow-hidden">
          {/* Intersecting Radial Beams & Architectural Grid with Edge Mask (Rule 5) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            <div
              className="absolute -top-36 left-1/2 -translate-x-[62%] w-[780px] h-[440px] rounded-full blur-[130px]"
              style={{
                background:
                  'radial-gradient(circle, rgba(99,102,241,0.26) 0%, rgba(79,70,229,0.06) 65%, transparent 100%)',
              }}
            />
            <div
              className="absolute -top-28 left-1/2 -translate-x-[15%] w-[720px] h-[420px] rounded-full blur-[140px]"
              style={{
                background:
                  'radial-gradient(circle, rgba(56,189,248,0.18) 0%, rgba(139,92,246,0.06) 65%, transparent 100%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse at center, black 40%, transparent 80%)',
              }}
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs font-medium mb-6 shadow-xs">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {isEn
                  ? 'Corporate Operations · CRM & A4 Contracts · Two-Way Telegram · Teddy AI'
                  : 'Управление задачами · Сделки и Договоры А4 · Мост с Telegram · Teddy AI'}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
              {isEn ? (
                <>
                  Unified Corporate Platform for{' '}
                  <span className="bg-gradient-to-r from-indigo-300 via-white to-sky-300 bg-clip-text text-transparent">
                    Tasks, CRM Deals, and Team Shifts
                  </span>
                </>
              ) : (
                <>
                  Единая операционная платформа для{' '}
                  <span className="bg-gradient-to-r from-indigo-300 via-white to-sky-300 bg-clip-text text-transparent">
                    задач, сделок CRM и контроля смен
                  </span>
                </>
              )}
            </h1>

            <p className="mt-5 text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
              {isEn
                ? 'Manage multi-department tasks, generate official A4 contracts in 0.1s, track active work shifts, and deliver PDF documents straight to employee Telegram accounts.'
                : 'Управляйте поручениями отделов на Канбан-стене, формируйте договоры и счета А4 за доли секунды, ведите живой табель смен и отправляйте документы напрямую в Telegram.'}
            </p>

            {/* Rule 5: Two High-Contrast Buttons based on Auth State */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              {onCloseShowcase ? (
                <>
                  <button
                    type="button"
                    onClick={onCloseShowcase}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-sm font-semibold transition-all shadow-[0_0_30px_rgba(255,255,255,0.22)] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>
                      {isEn ? 'Return to Workspace' : 'Вернуться в рабочее пространство'}
                    </span>
                  </button>
                  <a
                    href="#pricing"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/[0.15] bg-zinc-900/80 hover:bg-zinc-800 text-sm font-semibold text-white transition-colors"
                  >
                    <span>{isEn ? 'View Pricing Plans' : 'Перейти к тарифам'}</span>
                    <ArrowRight className="w-4 h-4 text-indigo-400" />
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthFlow('register_company', 'Trial')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-sm font-semibold transition-all shadow-[0_0_30px_rgba(255,255,255,0.22)] cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>
                      {isEn
                        ? 'Create Company Workspace'
                        : 'Создать пространство компании'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuthFlow('login')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/[0.15] bg-zinc-900/80 hover:bg-zinc-800 text-sm font-semibold text-white transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-indigo-400" />
                    <span>{isEn ? 'Sign In to System' : 'Войти в систему'}</span>
                  </button>
                </>
              )}
            </div>

            {/* =================================================================
                RULE 2: HERO SHOWCASE — 100% REAL TEDCLOUD WORKSPACE INTERFACE
            ================================================================== */}
            <div
              id="platform"
              className="mt-12 text-left max-w-6xl mx-auto rounded-2xl border border-white/[0.12] bg-[#090a0f]/90 shadow-[0_30px_100px_-15px_rgba(99,102,241,0.28),0_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden backdrop-blur-2xl scroll-mt-20"
            >
              {/* 1:1 Layout: Left Sidebar + Right Main Column (TopBar + Active Screen) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[610px]">
                {/* LEFT SIDEBAR OF TEDCLOUD (1:1 Fidelity) */}
                <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#07080d] p-4 flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Brand & Active Company Contour */}
                    <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-white/[0.07]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs tracking-tight shrink-0">
                          TC
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">
                              TedCloud
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-[9px] font-bold text-indigo-300">
                              PRO
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {resolvedCompany?.name ||
                              (isEn ? 'PJSC Gazprom Neft' : 'ПАО «Газпром Нефть»')}
                          </div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    </div>

                    {/* 6 Navigation Modules */}
                    <div className="space-y-1">
                      <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {isEn ? 'Workspace Contour' : 'Рабочий контур'}
                      </div>
                      {(
                        [
                          {
                            id: 'dashboard',
                            labelRu: 'Дашборд',
                            labelEn: 'Dashboard',
                            icon: LayoutDashboard,
                            badge: '',
                          },
                          {
                            id: 'tasks',
                            labelRu: 'Задачи',
                            labelEn: 'Tasks',
                            icon: CheckSquare,
                            badge: String(kanbanCards.length),
                          },
                          {
                            id: 'crm',
                            labelRu: 'Сделки CRM',
                            labelEn: 'CRM Deals',
                            icon: Briefcase,
                            badge: String(showcaseDeals.length),
                          },
                          {
                            id: 'communications',
                            labelRu: 'Инфополе и Связь',
                            labelEn: 'Feed & Comms',
                            icon: MessageSquare,
                            badge: 'TG',
                          },
                          {
                            id: 'shifts',
                            labelRu: 'Смены и Время',
                            labelEn: 'Shifts & Time',
                            icon: Clock,
                            badge: `${showcaseStaff.filter((s) => s.onShift).length}/${showcaseStaff.length}`,
                          },
                          {
                            id: 'team',
                            labelRu: 'Штат и Доступы',
                            labelEn: 'Team & Access',
                            icon: Users,
                            badge: 'RBAC',
                          },
                        ] as const
                      ).map((item) => {
                        const Icon = item.icon;
                        const active = heroSection === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setHeroSection(item.id);
                              setSelectedA4Deal(null);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              active
                                ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-xs'
                                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  active ? 'text-indigo-400' : 'text-zinc-500'
                                }`}
                              />
                              <span className="truncate">
                                {isEn ? item.labelEn : item.labelRu}
                              </span>
                            </div>
                            {item.badge && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                                  active
                                    ? 'bg-indigo-500/30 text-indigo-200'
                                    : 'bg-white/[0.06] text-zinc-400'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Executive Profile Card at Sidebar Bottom */}
                  <div className="hidden lg:flex items-center justify-between gap-2.5 pt-4 border-t border-white/[0.07]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {currentUser?.name
                          ? currentUser.name.slice(0, 2).toUpperCase()
                          : 'АГ'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {currentUser?.name ||
                            (isEn ? 'Alexander Gromov' : 'Александр Громов')}
                        </div>
                        <div className="text-[10px] text-emerald-400 truncate">
                          {isEn ? 'Founder · Master Key' : 'Основатель · Полный доступ'}
                        </div>
                      </div>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  </div>
                </aside>

                {/* RIGHT MAIN WORKSPACE COLUMN: TOPBAR + ACTIVE VIEW */}
                <div className="lg:col-span-9 flex flex-col bg-[#090a0f] min-w-0">
                  {/* Real TedCloud TopBar */}
                  <div className="px-4 sm:px-5 py-3 border-b border-white/[0.08] bg-[#0b0d14]/90 flex flex-wrap items-center justify-between gap-3">
                    {/* Search Bar ⌘K */}
                    <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-zinc-950/80 px-3 py-1.5 w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <input
                        type="text"
                        value={heroSearchQuery}
                        onChange={(e) => setHeroSearchQuery(e.target.value)}
                        placeholder={
                          isEn
                            ? 'Search tasks, deals, staff...'
                            : 'Поиск задач, сделок и штата...'
                        }
                        className="w-full !bg-transparent border-0 text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.07] text-[10px] font-semibold text-zinc-300 shrink-0">
                        <Command className="w-2.5 h-2.5" />
                        <span>K</span>
                      </span>
                    </div>

                    {/* Shift Status Pill + Teddy AI Trigger */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setHeroOnShift((prev) => !prev)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                          heroOnShift
                            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                            : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            heroOnShift ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <span>
                          {heroOnShift
                            ? isEn
                              ? 'On Shift · 04:18'
                              : 'На смене · 04:18'
                            : isEn
                            ? 'On Break · 04:18'
                            : 'Перерыв · 04:18'}
                        </span>
                      </button>

                      <a
                        href="#teddy-ai"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-semibold text-white transition-all"
                      >
                        <TeddyAvatar size="xs" />
                        <span>Teddy AI</span>
                      </a>
                    </div>
                  </div>

                  {/* ACTIVE SCREEN CONTENT */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between relative">
                    {/* SCREEN 1: DASHBOARD (4 KPI cards + Deal Funnel + Staff Workload Radar) */}
                    {heroSection === 'dashboard' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            {
                              labelRu: 'Исполнение SLA',
                              labelEn: 'SLA Velocity',
                              value: '91.4%',
                              subRu: 'Выполнено 24 из 26',
                              subEn: '24 of 26 completed',
                              bars: [45, 62, 78, 85, 92],
                              color: 'bg-emerald-400',
                            },
                            {
                              labelRu: 'Воронка сделок CRM',
                              labelEn: 'Active CRM Pipeline',
                              value: isEn ? '$136.6k' : '12,4 млн ₽',
                              subRu: '4 крупных контракта',
                              subEn: '4 enterprise deals',
                              bars: [50, 68, 74, 88, 96],
                              color: 'bg-indigo-400',
                            },
                            {
                              labelRu: 'Штат на смене',
                              labelEn: 'Staff on Shift',
                              value: `${showcaseStaff.filter((s) => s.onShift).length} / ${showcaseStaff.length}`,
                              subRu: '146 ч за неделю',
                              subEn: '146h this week',
                              bars: [70, 80, 85, 90, 95],
                              color: 'bg-sky-400',
                            },
                            {
                              labelRu: 'Доставка в Telegram',
                              labelEn: 'Telegram Gateway',
                              value: isEn ? '0.18 sec' : '0.18 сек',
                              subRu: '100% файлов доставлено',
                              subEn: '100% files delivered',
                              bars: [85, 90, 92, 96, 100],
                              color: 'bg-violet-400',
                            },
                          ].map((kpi, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-white/[0.08] bg-zinc-900/70 p-3.5 flex flex-col justify-between gap-2.5"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] text-zinc-400 font-medium truncate">
                                  {isEn ? kpi.labelEn : kpi.labelRu}
                                </span>
                                <div className="flex items-end gap-0.5 h-4">
                                  {kpi.bars.map((b, bIdx) => (
                                    <span
                                      key={bIdx}
                                      className={`w-1 rounded-t ${kpi.color}`}
                                      style={{ height: `${Math.round((b / 100) * 16)}px` }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-lg font-extrabold text-white tabular-nums">
                                  {kpi.value}
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                  {isEn ? kpi.subEn : kpi.subRu}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                          {/* CRM Deal Funnel */}
                          <div className="lg:col-span-7 rounded-xl border border-white/[0.08] bg-zinc-900/65 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">
                                {isEn
                                  ? 'CRM Revenue Funnel & Contract Stages'
                                  : 'Воронка сделок CRM и стадии договоров'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setHeroSection('crm')}
                                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                              >
                                {isEn ? 'Open CRM →' : 'Открыть CRM →'}
                              </button>
                            </div>
                            <div className="space-y-2.5">
                              {[
                                {
                                  stageRu: '1. Квалификация и ТЗ',
                                  stageEn: '1. Qualification & Spec',
                                  amount: isEn ? '$162,000' : '14 800 000 ₽',
                                  pct: 100,
                                  bar: 'from-indigo-500 to-sky-400',
                                },
                                {
                                  stageRu: '2. Коммерческое предложение (КП)',
                                  stageEn: '2. Commercial Proposal Sent',
                                  amount: isEn ? '$136,600' : '12 400 000 ₽',
                                  pct: 84,
                                  bar: 'from-indigo-500 to-violet-500',
                                },
                                {
                                  stageRu: '3. Согласование договора А4',
                                  stageEn: '3. A4 Contract Negotiation',
                                  amount: isEn ? '$84,000' : '7 600 000 ₽',
                                  pct: 62,
                                  bar: 'from-emerald-500 to-teal-400',
                                },
                                {
                                  stageRu: '4. Оплачено и закрыто актом',
                                  stageEn: '4. Paid & Closed Won',
                                  amount: isEn ? '$52,400' : '4 750 000 ₽',
                                  pct: 44,
                                  bar: 'from-emerald-400 to-lime-400',
                                },
                              ].map((st, i) => (
                                <div key={i} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-200 font-medium">
                                      {isEn ? st.stageEn : st.stageRu}
                                    </span>
                                    <span className="font-bold text-white tabular-nums">
                                      {st.amount}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full bg-gradient-to-r ${st.bar}`}
                                      style={{ width: `${st.pct}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Employee Workload Radar */}
                          <div className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-zinc-900/65 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">
                                {isEn ? 'Team Workload Radar' : 'Радар загрузки сотрудников'}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-400">
                                {isEn ? 'Balanced' : 'В норме'}
                              </span>
                            </div>
                            <div className="space-y-2.5">
                              {showcaseStaff.map((emp) => {
                                const loadPct = Math.min(
                                  100,
                                  Math.round((emp.weeklyHours / emp.weeklyTarget) * 100)
                                );
                                return (
                                  <div key={emp.id} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div
                                          className={`w-6 h-6 rounded-full bg-gradient-to-br ${emp.avatarGrad} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
                                        >
                                          {emp.initials}
                                        </div>
                                        <span className="text-xs font-semibold text-white truncate">
                                          {isEn ? emp.nameEn : emp.nameRu}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-zinc-400 tabular-nums shrink-0">
                                        {emp.tasksActive} {isEn ? 'active' : 'в работе'} · {loadPct}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-indigo-500"
                                        style={{ width: `${loadPct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SCREEN 2: TASKS (4-COLUMN KANBAN WALL WITH CARD MOVEMENT & INLINE ADD) */}
                    {heroSection === 'tasks' && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {isEn
                                ? 'Corporate Kanban Wall (4 Stages)'
                                : 'Канбан-стена поручений (4 колонки)'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-semibold text-indigo-300">
                              {isEn
                                ? 'Move cards across stages or add a new task'
                                : 'Переводите карточки по этапам или добавляйте задачи'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAddingToColumn('Todo')}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isEn ? 'New Task' : 'Новая задача'}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {(
                            [
                              {
                                stage: 'Todo',
                                labelRu: 'Очередь',
                                labelEn: 'Backlog',
                                dot: 'bg-zinc-400',
                              },
                              {
                                stage: 'In Progress',
                                labelRu: 'В работе',
                                labelEn: 'In Progress',
                                dot: 'bg-indigo-400',
                              },
                              {
                                stage: 'Review',
                                labelRu: 'На согласовании',
                                labelEn: 'In Review',
                                dot: 'bg-amber-400',
                              },
                              {
                                stage: 'Done',
                                labelRu: 'Завершено',
                                labelEn: 'Completed',
                                dot: 'bg-emerald-400',
                              },
                            ] as const
                          ).map((col) => {
                            const colCards = filteredKanbanCards.filter(
                              (c) => c.stage === col.stage
                            );
                            return (
                              <div
                                key={col.stage}
                                className="rounded-xl border border-white/[0.07] bg-zinc-950/70 p-2.5 flex flex-col justify-between space-y-2.5 min-h-[430px]"
                              >
                                <div className="space-y-2.5">
                                  {/* Column Header */}
                                  <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                      <span className="text-xs font-bold text-white">
                                        {isEn ? col.labelEn : col.labelRu}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-bold text-zinc-300 tabular-nums">
                                        {colCards.length}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setAddingToColumn(col.stage)}
                                        title={isEn ? 'Add task to column' : 'Добавить задачу в колонку'}
                                        className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inline New Task Creator */}
                                  {addingToColumn === col.stage && (
                                    <div className="rounded-xl border border-indigo-500/50 bg-zinc-900 p-2.5 space-y-2">
                                      <input
                                        type="text"
                                        value={newCardTitle}
                                        onChange={(e) => setNewCardTitle(e.target.value)}
                                        placeholder={
                                          isEn ? 'Enter task title...' : 'Введите название задачи...'
                                        }
                                        autoFocus
                                        className="w-full rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                                      />
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAddingToColumn(null);
                                            setNewCardTitle('');
                                          }}
                                          className="px-2 py-1 rounded text-[10px] text-zinc-400 hover:text-white cursor-pointer"
                                        >
                                          {isEn ? 'Cancel' : 'Отмена'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCreateKanbanCard(col.stage)}
                                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white cursor-pointer"
                                        >
                                          {isEn ? 'Add' : 'Создать'}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Cards List */}
                                  <div className="space-y-2">
                                    {colCards.map((card) => {
                                      const pct = Math.round(
                                        (card.checklistDone / Math.max(1, card.checklistTotal)) *
                                          100
                                      );
                                      return (
                                        <div
                                          key={card.id}
                                          className="rounded-xl border border-white/[0.08] bg-zinc-900/90 hover:border-indigo-500/40 p-3 space-y-2.5 transition-all shadow-sm"
                                        >
                                          <div className="flex items-center justify-between gap-1.5">
                                            <span className="text-[10px] font-bold text-indigo-300 tabular-nums">
                                              {card.code}
                                            </span>
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                card.priority === 'High'
                                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                              }`}
                                            >
                                              {card.priority === 'High'
                                                ? isEn
                                                  ? 'High'
                                                  : 'Высокий'
                                                : isEn
                                                ? 'Medium'
                                                : 'Средний'}
                                            </span>
                                          </div>

                                          <div className="text-xs font-semibold text-white leading-snug">
                                            {isEn ? card.titleEn : card.titleRu}
                                          </div>

                                          <div className="text-[10px] text-zinc-400 truncate">
                                            {isEn ? card.deptEn : card.deptRu}
                                          </div>

                                          {/* Checklist Progress Bar (3/4) */}
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[10px] text-zinc-400 tabular-nums">
                                              <span>{isEn ? 'Checklist' : 'Чек-лист'}</span>
                                              <span className="text-zinc-200 font-semibold">
                                                {card.checklistDone}/{card.checklistTotal}
                                              </span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all ${
                                                  card.stage === 'Done'
                                                    ? 'bg-emerald-400'
                                                    : 'bg-indigo-500'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                          </div>

                                          {/* Card Footer: Assignee + Stage Movement Arrows */}
                                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/[0.06]">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <div
                                                className={`w-5 h-5 rounded-full bg-gradient-to-br ${card.avatarGrad} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
                                              >
                                                {(isEn ? card.assigneeEn : card.assigneeRu).slice(
                                                  0,
                                                  2
                                                )}
                                              </div>
                                              <span className="text-[10px] text-zinc-400 truncate">
                                                {isEn ? card.dueLabelEn : card.dueLabelRu}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              {col.stage !== 'Todo' && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleMoveKanbanCard(card.id, 'prev')
                                                  }
                                                  title={isEn ? 'Previous stage' : 'На этап назад'}
                                                  className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white cursor-pointer"
                                                >
                                                  <ChevronLeft className="w-3 h-3" />
                                                </button>
                                              )}
                                              {col.stage !== 'Done' && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleMoveKanbanCard(card.id, 'next')
                                                  }
                                                  title={isEn ? 'Advance stage' : 'На следующий этап'}
                                                  className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 hover:text-white cursor-pointer"
                                                >
                                                  <ChevronRight className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SCREEN 3: CRM DEALS & WHITE A4 CONTRACT SLIDE-OVER */}
                    {heroSection === 'crm' && (
                      <div className="space-y-3 relative">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-bold text-white">
                              {isEn
                                ? 'Corporate B2B Deals Registry & A4 Legal Documents'
                                : 'Реестр сделок CRM и генерация договоров А4'}
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                              {isEn
                                ? 'Click "Open A4 Contract" on any deal to inspect the official print-ready agreement'
                                : 'Нажмите «Открыть Договор А4» в строке сделки для просмотра готового документа с печатью'}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 tabular-nums">
                            {isEn ? 'Pipeline: $136,600' : 'Воронка: 12 400 000 ₽'}
                          </span>
                        </div>

                        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-white/[0.08] text-[11px] text-zinc-400 bg-zinc-900/60">
                                <th className="py-2.5 px-3 font-semibold">
                                  {isEn ? 'Counterparty & Tax ID' : 'Контрагент и ИНН'}
                                </th>
                                <th className="py-2.5 px-3 font-semibold">
                                  {isEn ? 'Stage' : 'Стадия сделки'}
                                </th>
                                <th className="py-2.5 px-3 font-semibold">
                                  {isEn ? 'Contract Value' : 'Сумма договора'}
                                </th>
                                <th className="py-2.5 px-3 font-semibold">
                                  {isEn ? 'Owner' : 'Ответственный'}
                                </th>
                                <th className="py-2.5 px-3 text-right font-semibold">
                                  {isEn ? 'Document A4' : 'Документ А4'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {showcaseDeals.map((deal) => (
                                <tr
                                  key={deal.id}
                                  className="hover:bg-white/[0.03] transition-colors"
                                >
                                  <td className="py-3 px-3">
                                    <div className="font-bold text-white">
                                      {isEn ? deal.clientEn : deal.clientRu}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 tabular-nums">
                                      {isEn ? 'Tax ID' : 'ИНН'}: {deal.inn} · № {deal.contractNo}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                        deal.stageTone === 'emerald'
                                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                          : deal.stageTone === 'indigo'
                                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                      }`}
                                    >
                                      {isEn ? deal.stageEn : deal.stageRu}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 font-extrabold text-white tabular-nums">
                                    {isEn
                                      ? `$${deal.amountUsd.toLocaleString('en-US')}`
                                      : `${deal.amountRub.toLocaleString('ru-RU')} ₽`}
                                  </td>
                                  <td className="py-3 px-3 text-zinc-300">
                                    {isEn ? deal.managerEn : deal.managerRu}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedA4Deal(deal)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>
                                        {isEn ? 'Open A4 Contract' : 'Открыть Договор А4'}
                                      </span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Smooth White A4 Sheet Overlay when user clicks "Открыть Договор А4" */}
                        {selectedA4Deal && (
                          <div className="inset-0 z-20 rounded-xl bg-black/75 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center">
                            <div className="tc-a4-paper w-full max-w-2xl rounded-xl !bg-white !text-slate-950 p-6 shadow-2xl border border-slate-300 space-y-4">
                              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-wider !text-slate-500">
                                    {isEn
                                      ? 'OFFICIAL CORPORATE AGREEMENT (A4)'
                                      : 'ОФИЦИАЛЬНЫЙ ДОГОВОР НА ОКАЗАНИЕ УСЛУГ (ЛИСТ А4)'}
                                  </div>
                                  <h4 className="text-base font-extrabold !text-slate-950 mt-0.5">
                                    {isEn
                                      ? `AGREEMENT No. ${selectedA4Deal.contractNo}`
                                      : `ДОГОВОР № ${selectedA4Deal.contractNo} от ${new Date().toLocaleDateString('ru-RU')}`}
                                  </h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedA4Deal(null)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 !text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5 !text-white" />
                                  <span className="!text-white">
                                    {isEn ? 'Close A4' : 'Закрыть лист А4'}
                                  </span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-100 p-3 rounded-lg border border-slate-300">
                                <div>
                                  <div className="!text-slate-500 font-medium">
                                    {isEn ? 'Customer:' : 'Заказчик:'}
                                  </div>
                                  <div className="font-bold !text-slate-950">
                                    {isEn ? selectedA4Deal.clientEn : selectedA4Deal.clientRu}
                                  </div>
                                  <div className="!text-slate-700 tabular-nums">
                                    {isEn ? 'Tax ID' : 'ИНН'}: {selectedA4Deal.inn} · КПП 784201001
                                  </div>
                                </div>
                                <div>
                                  <div className="!text-slate-500 font-medium">
                                    {isEn ? 'Contractor:' : 'Исполнитель:'}
                                  </div>
                                  <div className="font-bold !text-slate-950">
                                    {resolvedCompany?.name ||
                                      (isEn ? 'TedCloud Enterprise LLC' : 'ООО «ТедКлауд Энтерпрайз»')}
                                  </div>
                                  <div className="!text-slate-700 tabular-nums">
                                    {isEn ? 'Tax ID' : 'ИНН'}: 7736207543 · Р/с 40702810900000104821
                                  </div>
                                </div>
                              </div>

                              <table className="w-full text-xs border border-slate-900 border-collapse">
                                <thead>
                                  <tr className="bg-slate-200 border-b border-slate-900">
                                    <th className="p-2 text-left border-r border-slate-900 !text-slate-950">
                                      №
                                    </th>
                                    <th className="p-2 text-left border-r border-slate-900 !text-slate-950">
                                      {isEn
                                        ? 'Specification & Scope of Work'
                                        : 'Наименование работ и лицензий'}
                                    </th>
                                    <th className="p-2 text-right !text-slate-950">
                                      {isEn ? 'Total Amount' : 'Сумма с НДС'}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="p-2 border-r border-slate-900 !text-slate-900">
                                      1
                                    </td>
                                    <td className="p-2 border-r border-slate-900 !text-slate-900 font-medium">
                                      {isEn ? selectedA4Deal.subjectEn : selectedA4Deal.subjectRu}
                                    </td>
                                    <td className="p-2 text-right font-extrabold !text-slate-950 tabular-nums">
                                      {isEn
                                        ? `$${selectedA4Deal.amountUsd.toLocaleString('en-US')}`
                                        : `${selectedA4Deal.amountRub.toLocaleString('ru-RU')} ₽`}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              <div className="flex items-center justify-between pt-2">
                                <div className="text-[11px] !text-slate-600">
                                  {isEn
                                    ? 'Authorized Executive Signature: A. Gromov'
                                    : 'Генеральный директор: _______________ / А. В. Громов /'}
                                </div>
                                <div className="tc-a4-badge px-3 py-1 rounded-md border-2 border-indigo-700 !text-indigo-800 font-extrabold text-[11px] uppercase tracking-wider">
                                  {isEn
                                    ? 'OFFICIAL SEAL · VERIFIED'
                                    : 'М.П. · ПОДПИСАНО ЭЦП'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SCREEN 4: COMMUNICATIONS & SYNCHRONIZED IPHONE TELEGRAM BOT */}
                    {heroSection === 'communications' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                        {/* Left Column: Channels & Direct Roster */}
                        <div className="lg:col-span-3 rounded-xl border border-white/[0.08] bg-zinc-950/75 p-2.5 space-y-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1.5">
                            {isEn ? 'Corporate Channels' : 'Каналы и отделы'}
                          </div>
                          {(
                            [
                              {
                                id: 'general',
                                labelRu: 'Генеральный штаб',
                                labelEn: 'Executive HQ',
                              },
                              {
                                id: 'commercial',
                                labelRu: 'Коммерческий блок',
                                labelEn: 'Commercial Dept',
                              },
                              {
                                id: 'direct',
                                labelRu: 'Елена Соколова (TG)',
                                labelEn: 'Elena Sokolova (TG)',
                              },
                            ] as const
                          ).map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => setActiveChatChannel(ch.id)}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                activeChatChannel === ch.id
                                  ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                              }`}
                            >
                              <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate">
                                {isEn ? ch.labelEn : ch.labelRu}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Middle Column: Web Chat Thread with Attached PDF */}
                        <div className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-zinc-950/75 p-3 flex flex-col justify-between space-y-3">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                              <span className="text-xs font-bold text-white">
                                # {isEn ? 'Commercial Dept' : 'Коммерческий блок'}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                {isEn ? 'Web ⇄ Telegram Live' : 'Веб ⇄ Telegram синхронно'}
                              </span>
                            </div>

                            <div className="space-y-2.5 max-h-[270px] overflow-y-auto pr-1">
                              {chatMessages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`rounded-xl p-2.5 border text-xs space-y-1.5 ${
                                    msg.isOwn
                                      ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                      : 'bg-zinc-900/90 border-white/[0.08] text-zinc-100'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                    <span className="font-bold text-indigo-300">
                                      {isEn ? msg.senderEn : msg.senderRu}
                                    </span>
                                    <span className="tabular-nums">{msg.time}</span>
                                  </div>
                                  <p className="text-xs leading-relaxed">
                                    {isEn ? msg.textEn : msg.textRu}
                                  </p>
                                  {msg.attachment && (
                                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px]">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span className="font-semibold text-white truncate">
                                          {msg.attachment.name}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-zinc-400 shrink-0">
                                        {msg.attachment.size}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <form
                            onSubmit={handleSendHeroChatMessage}
                            className="flex items-center gap-1.5 pt-2 border-t border-white/[0.07]"
                          >
                            <input
                              type="text"
                              value={chatComposerInput}
                              onChange={(e) => setChatComposerInput(e.target.value)}
                              placeholder={
                                isEn
                                  ? 'Send message to chat & Telegram...'
                                  : 'Написать в чат и Telegram...'
                              }
                              className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>

                        {/* Right Column: Synchronized iPhone Telegram Bot Mockup */}
                        <div className="lg:col-span-4 rounded-2xl border-2 border-sky-500/35 bg-[#0b101b] p-3.5 flex flex-col justify-between space-y-3 shadow-[0_12px_40px_rgba(14,165,233,0.18)]">
                          <div className="space-y-2.5">
                            {/* iPhone Dynamic Island Header */}
                            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white">
                                  <Send className="w-3 h-3" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-white">
                                    @TedCloudBot
                                  </div>
                                  <div className="text-[10px] text-sky-400">
                                    {isEn ? 'Telegram iOS · Connected' : 'Telegram iOS · На связи'}
                                  </div>
                                </div>
                              </div>
                              <Smartphone className="w-4 h-4 text-sky-400" />
                            </div>

                            {/* Synchronized Telegram Bubble */}
                            <div
                              className={`rounded-xl bg-[#162238] border p-3 space-y-2 transition-all ${
                                tgSyncPulse
                                  ? 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
                                  : 'border-sky-500/30'
                              }`}
                            >
                              <div className="text-[10px] font-bold text-sky-300">
                                {isEn
                                  ? 'Instant Document Delivery'
                                  : 'Мгновенная доставка из веб-чата'}
                              </div>
                              <div className="text-xs text-white leading-snug">
                                {chatMessages[chatMessages.length - 1]
                                  ? isEn
                                    ? chatMessages[chatMessages.length - 1].textEn
                                    : chatMessages[chatMessages.length - 1].textRu
                                  : ''}
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-sky-500/15 border border-sky-400/30 text-[11px] text-sky-100">
                                <FileText className="w-4 h-4 text-sky-300 shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">
                                    Договор_поставки.pdf
                                  </div>
                                  <div className="text-[10px] text-sky-300">
                                    420 КБ · Доставлено за 0.18 с
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400">
                              {isEn ? '2FA OTP Security:' : 'Код входа 2FA:'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold tabular-nums">
                              4829 · Active
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SCREEN 5 & 6: SHIFTS & TIMESHEET / TEAM & RBAC ACCESS */}
                    {(heroSection === 'shifts' || heroSection === 'team') && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-bold text-white">
                              {heroSection === 'shifts'
                                ? isEn
                                  ? 'Live Attendance Board & Weekly Hours Timesheet'
                                  : 'Живое табло сотрудников на смене и табель часов'
                                : isEn
                                ? 'Corporate Staff Directory, RBAC Roles & Invite Codes'
                                : 'Штатное расписание, матрица прав RBAC и коды доступа'}
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                              {isEn
                                ? 'Click any employee shift badge to toggle live shift status'
                                : 'Нажмите на индикатор смены сотрудника для переключения статуса'}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 tabular-nums">
                            {isEn
                              ? `Active on Shift: ${showcaseStaff.filter((s) => s.onShift).length}/${showcaseStaff.length}`
                              : `На смене: ${showcaseStaff.filter((s) => s.onShift).length} из ${showcaseStaff.length}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {showcaseStaff.map((emp) => {
                            const hoursPct = Math.min(
                              100,
                              Math.round((emp.weeklyHours / emp.weeklyTarget) * 100)
                            );
                            return (
                              <div
                                key={emp.id}
                                className="rounded-xl border border-white/[0.08] bg-zinc-950/75 p-3.5 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${emp.avatarGrad} flex items-center justify-center text-xs font-bold text-white shrink-0`}
                                    >
                                      {emp.initials}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white truncate">
                                        {isEn ? emp.nameEn : emp.nameRu}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 truncate">
                                        {isEn ? emp.roleEn : emp.roleRu} ·{' '}
                                        {isEn ? emp.deptEn : emp.deptRu}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowcaseStaff((prev) =>
                                        prev.map((s) =>
                                          s.id === emp.id ? { ...s, onShift: !s.onShift } : s
                                        )
                                      )
                                    }
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer shrink-0 tabular-nums ${
                                      emp.onShift
                                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                        : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        emp.onShift ? 'bg-emerald-400' : 'bg-amber-400'
                                      }`}
                                    />
                                    <span>
                                      {emp.onShift
                                        ? `${isEn ? 'On Shift' : 'На смене'} · ${emp.shiftTime}`
                                        : isEn
                                        ? 'Break'
                                        : 'Перерыв'}
                                    </span>
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
                                    <span>
                                      {isEn ? 'Weekly Timesheet:' : 'Отработано за неделю:'}
                                    </span>
                                    <span className="font-bold text-white">
                                      {emp.weeklyHours} / {emp.weeklyTarget} {isEn ? 'h' : 'ч'}
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                                      style={{ width: `${hoursPct}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                                  <span className="text-zinc-400 tabular-nums">
                                    {isEn ? 'Invite Code:' : 'Код пропуска:'}{' '}
                                    <strong className="text-indigo-300">{emp.inviteCode}</strong>
                                  </span>
                                  <span className="text-emerald-300 font-semibold tabular-nums">
                                    {emp.tasksCompleted} {isEn ? 'tasks closed' : 'задач закрыто'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bottom Status Footer inside the 1:1 Workspace Window */}
                    <div className="mt-4 pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>
                          {isEn
                            ? ' PostgreSQL Multi-Tenant Contour · Real-Time Telegram Webhook'
                            : 'Изолированный контур PostgreSQL · Прямая синхронизация с Telegram'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span>
                          {isEn
                            ? `Active Tasks: ${kanbanCards.length}`
                            : `Активных задач: ${kanbanCards.length}`}
                        </span>
                        <span>·</span>
                        <span>
                          {isEn
                            ? `CRM Contracts: ${showcaseDeals.length}`
                            : `Сделок CRM: ${showcaseDeals.length}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            RULE 3: ASYMMETRIC VISUAL BENTO ARCHITECTURE (75% GRAPHICAL UI)
        ================================================================== */}
        <section
          id="architecture"
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-14 scroll-mt-20"
        >
          <div className="max-w-3xl mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>
                {isEn ? 'Unified Enterprise Architecture' : 'Модульная архитектура платформы'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {isEn
                ? 'Four Synchronized Operational Contours in One System'
                : 'Четыре синхронизированных контура вместо десятка вкладок'}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* BENTO CARD 1 (lg:col-span-7, Indigo Glow): Cascading Kanban & SLA Control */}
            <div className="lg:col-span-7 rounded-3xl border border-white/[0.1] bg-zinc-900/65 backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <div className="pointer-events-none absolute -top-24 -left-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-[90px]" />

              {/* 75% Visual Graphical Composition */}
              <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#08090f]/90 p-4 sm:p-5 space-y-3.5 mb-6">
                {/* Floating Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-[11px] font-semibold text-indigo-200 shadow-sm">
                    <Activity className="w-3.5 h-3.5 text-indigo-300" />
                    <span>
                      {isEn
                        ? 'Real-Time SLA Deadline Control'
                        : 'Контроль сроков в реальном времени'}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-emerald-400 tabular-nums">
                    SLA 98.4%
                  </span>
                </div>

                {/* Cascading Multi-Layered Kanban Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-indigo-500/35 bg-zinc-900/95 p-3.5 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-300 tabular-nums">
                        TC-204 · В РАБОТЕ
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] font-bold">
                        {isEn ? 'High Priority' : 'Высокий'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white">
                      {isEn
                        ? 'Approve Enterprise Contract Specification'
                        : 'Согласование спецификации и графика поставок'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 tabular-nums">
                        <span>{isEn ? 'Subtasks completed' : 'Подзадачи чек-листа'}</span>
                        <span className="text-white font-semibold">3 / 4</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex -space-x-1.5">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 border border-zinc-950 flex items-center justify-center text-[9px] font-bold text-white">
                          ЕС
                        </span>
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 border border-zinc-950 flex items-center justify-center text-[9px] font-bold text-white">
                          АГ
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold tabular-nums">
                        {isEn ? 'Due 18:00' : 'Срок: 18:00'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-zinc-900/80 p-3.5 space-y-2.5 sm:translate-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-300 tabular-nums">
                        TC-209 · СОГЛАСОВАНО
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                        5 / 5
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white">
                      {isEn
                        ? 'Quarterly Financial Audit & Invoice Registry'
                        : 'Аудит закрывающих актов и реестра счетов'}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full w-full rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
                      <span>{isEn ? 'Finance & Legal' : 'Финансы и Право'}</span>
                      <span className="text-emerald-300 font-semibold">
                        {isEn ? 'Verified' : 'Подтверждено'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 space-y-1.5">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {isEn
                    ? 'End-to-End Task & Approval Management'
                    : 'Сквозное управление задачами и согласованиями'}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {isEn
                    ? 'Kanban wall, Gantt timeline, and tabular registry with multi-step checklists, department routing, and strict SLA deadline tracking.'
                    : 'Канбан-стена, диаграмма Ганта и табличный реестр с пошаговыми чек-листами, привязкой к отделам и контролем дедлайнов.'}
                </p>
              </div>
            </div>

            {/* BENTO CARD 2 (lg:col-span-5, Emerald Glow): Web ⇄ Telegram Bridge */}
            <div className="lg:col-span-5 rounded-3xl border border-white/[0.1] bg-zinc-900/65 backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-[90px]" />

              {/* 75% Visual Graphical Scene: Web ⇄ Telegram Bridge */}
              <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#08090f]/90 p-4 space-y-3 mb-6">
                {/* Web Chat Card */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-900/90 p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        Договор_поставки.pdf
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {isEn ? 'Sent from Web Workspace' : 'Отправлено из веб-чата · 420 КБ'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0 tabular-nums">
                    0.18s
                  </span>
                </div>

                {/* Glowing Trajectory Connector */}
                <div className="flex items-center justify-center gap-2 py-0.5">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-400/60 to-sky-400/60" />
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                    Web ⇄ Telegram API
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-sky-400/60 via-emerald-400/60 to-transparent" />
                </div>

                {/* Stylized Smartphone Frame with Telegram Notification & 4-Digit 2FA */}
                <div className="rounded-xl border border-sky-500/35 bg-[#0e1726] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-xs font-bold text-white">Telegram · @TedCloudBot</span>
                    </div>
                    <span className="text-[10px] text-sky-300 font-semibold">Delivered</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-black/35 px-2.5 py-1.5 border border-white/[0.06] text-[11px]">
                    <span className="text-zinc-300">
                      {isEn ? '2FA Login Code:' : 'Код подтверждения 2FA:'}
                    </span>
                    <span className="font-extrabold text-emerald-300 tracking-widest tabular-nums">
                      4 8 2 9
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 space-y-1.5">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {isEn
                    ? 'Direct File & Task Delivery to Telegram'
                    : 'Прямая доставка файлов и задач в Telegram'}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {isEn
                    ? 'Instant delivery of PDF contracts, attachments, and tasks straight to employee Telegram chats with 4-digit 2FA security.'
                    : 'Мгновенная отправка PDF-договоров, файлов и поручений в Telegram сотрудников и вход по 4-значному коду 2FA.'}
                </p>
              </div>
            </div>

            {/* BENTO CARD 3 (lg:col-span-5, Amber-Violet Glow): Isometric White A4 Contract */}
            <div className="lg:col-span-5 rounded-3xl border border-white/[0.1] bg-zinc-900/65 backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <div className="pointer-events-none absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-amber-500/15 blur-[95px]" />

              {/* 75% Visual Graphical Composition: Isometric White A4 Sheet Emerging from CRM Card */}
              <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#08090f]/90 p-4 mb-6">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-2 flex items-center justify-between">
                  <span>{isEn ? 'CRM Deal: PJSC Gazprom Neft' : 'Сделка CRM: ПАО «Газпром Нефть»'}</span>
                  <span className="tabular-nums">ИНН 7842390112</span>
                </div>

                {/* Isometric White A4 Document Sheet */}
                <div className="tc-a4-paper rounded-xl !bg-white !text-slate-950 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.75)] border border-slate-300 -rotate-1 hover:rotate-0 transition-transform duration-300 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <div>
                      <div className="text-[10px] font-bold !text-slate-500">
                        {isEn ? 'OFFICIAL CONTRACT A4' : 'ДОГОВОР И СЧЕТ-АКТ А4'}
                      </div>
                      <div className="text-xs font-extrabold !text-slate-950">
                        № TC-2026/084
                      </div>
                    </div>
                    <span className="tc-a4-badge px-2 py-0.5 rounded bg-emerald-600 !text-white text-[10px] font-extrabold uppercase tracking-wider">
                      {isEn ? 'PAID' : 'ОПЛАЧЕНО'}
                    </span>
                  </div>

                  <table className="w-full text-[11px] border border-slate-900 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-900">
                        <th className="p-1.5 text-left border-r border-slate-900 !text-slate-900">
                          {isEn ? 'Item' : 'Позиция'}
                        </th>
                        <th className="p-1.5 text-right !text-slate-900">
                          {isEn ? 'Amount' : 'Сумма'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-1.5 border-r border-slate-900 !text-slate-800 font-medium">
                          {isEn ? 'Enterprise License (12 mo)' : 'Лицензия Enterprise (12 мес.)'}
                        </td>
                        <td className="p-1.5 text-right font-extrabold !text-slate-950 tabular-nums">
                          4 200 000 ₽
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="relative z-10 space-y-1.5">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {isEn
                    ? 'Generate A4 Contracts, Invoices & Acts in 0.1 Seconds'
                    : 'Генерация договоров, счетов и актов А4 за 0.1 секунды'}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {isEn
                    ? 'Automatic population of counterparty Tax ID, bank requisites, specification tables, and corporate seal directly from CRM deals.'
                    : 'Автоматическая подстановка ИНН, реквизитов, таблиц спецификации и печати организации прямо из карточки сделки CRM.'}
                </p>
              </div>
            </div>

            {/* BENTO CARD 4 (lg:col-span-7, Sapphire Glow): Work Shifts & RBAC Matrix */}
            <div className="lg:col-span-7 rounded-3xl border border-white/[0.1] bg-zinc-900/65 backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <div className="pointer-events-none absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-sky-500/20 blur-[95px]" />

              {/* 75% Visual Graphical Composition: Shift Roster & RBAC Security Toggles */}
              <div className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#08090f]/90 p-4 sm:p-5 space-y-3.5 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {showcaseStaff.slice(0, 2).map((emp) => (
                    <div
                      key={emp.id}
                      className="rounded-xl border border-white/[0.08] bg-zinc-900/90 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.avatarGrad} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
                          >
                            {emp.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {isEn ? emp.nameEn : emp.nameRu}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate">
                              {isEn ? emp.roleEn : emp.roleRu}
                            </div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 tabular-nums">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{emp.shiftTime}</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-400 tabular-nums">
                          <span>{isEn ? 'Weekly Hours' : 'Часы за неделю'}</span>
                          <span className="text-white font-semibold">
                            {emp.weeklyHours} / {emp.weeklyTarget} ч
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                          <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* RBAC Security Contour Toggles */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    {
                      labelRu: 'Доступ к воронке CRM',
                      labelEn: 'CRM Pipeline Access',
                      active: true,
                    },
                    {
                      labelRu: 'Генерация счетов А4',
                      labelEn: 'A4 Invoice Generation',
                      active: true,
                    },
                    {
                      labelRu: 'Изоляция по отделам',
                      labelEn: 'Department Isolation',
                      active: true,
                    },
                  ].map((perm, pIdx) => (
                    <div
                      key={pIdx}
                      className="rounded-xl border border-white/[0.07] bg-zinc-900/75 px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-semibold text-zinc-200 truncate">
                        {isEn ? perm.labelEn : perm.labelRu}
                      </span>
                      <span className="w-7 h-4 rounded-full bg-indigo-600 flex items-center justify-end px-0.5 shrink-0">
                        <span className="w-3 h-3 rounded-full bg-white" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10 space-y-1.5">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {isEn
                    ? 'Attendance Timesheet, Live Shifts & RBAC Access Matrix'
                    : 'Табель рабочего времени, смены и матрица прав доступа'}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {isEn
                    ? 'Real-time shift timers, automated end-of-day shift reports, and granular 4-tier RBAC security permissions across departments.'
                    : 'Живые таймеры смен, автоматические отчеты при закрытии смены и четырехступенчатая матрица прав доступа для подразделений.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            RULE 4: TEDDY AI LIVE GLASS CONSOLE (CUSTOM INPUT + METRICS + FUNNEL)
        ================================================================== */}
        <section
          id="teddy-ai"
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-14 scroll-mt-20"
        >
          <div className="rounded-3xl backdrop-blur-3xl !bg-white/[0.03] border !border-white/[0.1] p-6 sm:p-8 shadow-[0_24px_90px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.14)] relative overflow-hidden">
            <div className="pointer-events-none absolute -top-28 left-1/3 w-96 h-96 rounded-full bg-indigo-500/15 blur-[110px]" />

            {/* Console Header */}
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <TeddyAvatar size="lg" />
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      Teddy AI
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
                      {isEn ? 'Executive AI Console' : 'Корпоративный ИИ-ассистент'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {isEn
                      ? 'Analyze CRM contracts, department SLA velocity, and shift capacity — or enter your own executive query below.'
                      : 'Анализируйте контракты CRM, ритм исполнения поручений и загрузку отделов — или введите собственный запрос в консоль.'}
                  </p>
                </div>
              </div>

              {/* Preset Mode Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                {teddyConsolePresets.map((preset, idx) => {
                  const active = !customBriefResult && activeTeddyScenarioIdx === idx;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCustomBriefResult(null);
                        setActiveTeddyScenarioIdx(idx);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                          : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {isEn ? preset.tabLabelEn : preset.tabLabelRu}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Custom Query Input Bar right on the page (Rule 4) */}
            <form
              onSubmit={handleRunCustomTeddyQuery}
              className="relative z-10 mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 rounded-2xl border border-white/[0.12] bg-zinc-950/80 p-2"
            >
              <div className="flex items-center gap-2.5 flex-1 px-2">
                <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
                <input
                  type="text"
                  value={teddyCustomQuery}
                  onChange={(e) => setTeddyCustomQuery(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Enter any management query (e.g. "Analyze Q4 revenue and overdue tasks")...'
                      : 'Введите любой управленческий запрос (например: «Проверить дебиторку и срочные задачи»)...'
                  }
                  className="w-full !bg-transparent border-0 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isEn ? 'Analyze Query' : 'Разобрать запрос'}</span>
              </button>
            </form>

            {/* Structured Executive Breakdown Output */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 items-stretch">
              {/* Left 5 Cols: Interactive Metric Cards + Funnel Bar Chart */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-950/75 p-5">
                <div className="space-y-4">
                  <div className="text-xs font-bold text-white flex items-center justify-between">
                    <span>
                      {isEn ? 'Key Operational Indicators' : 'Ключевые показатели контура'}
                    </span>
                    <span className="text-[11px] text-indigo-300 font-semibold">
                      {isEn ? activePreset.modeLabelEn : activePreset.modeLabelRu}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {activePreset.metrics.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 space-y-1"
                      >
                        <div className="text-[10px] text-zinc-400 truncate">
                          {isEn ? m.labelEn : m.labelRu}
                        </div>
                        <div className="text-sm font-extrabold text-white tabular-nums truncate">
                          {m.value}
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-400 tabular-nums">
                          {m.delta}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Visual Funnel / Velocity Chart */}
                  <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
                    <div className="text-[11px] font-semibold text-zinc-300">
                      {isEn ? 'Distribution & Conversion' : 'Распределение и конверсия по этапам'}
                    </div>
                    {activePreset.funnelBars.map((fb, fIdx) => (
                      <div key={fIdx} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-300">
                            {isEn ? fb.labelEn : fb.labelRu}
                          </span>
                          <span className="font-bold text-white tabular-nums">{fb.amount}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${fb.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    {isEn ? 'Data Source: Live Company DB' : 'Источник: Живая БД организации'}
                  </span>
                  <span className="text-emerald-400 font-semibold tabular-nums">0.12s</span>
                </div>
              </div>

              {/* Right 7 Cols: Executive Synthesis, Steps & 1-Click Action Button */}
              <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-zinc-950/75 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
                    <div className="flex items-center gap-2">
                      <TeddyAvatar size="xs" />
                      <span className="text-xs font-bold text-white">Teddy</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                        {isEn ? activePreset.modeLabelEn : activePreset.modeLabelRu}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 truncate max-w-[260px]">
                      {customBriefResult
                        ? customBriefResult.query
                        : isEn
                        ? (activePreset as any).questionEn
                        : (activePreset as any).questionRu}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed font-medium">
                    {isEn ? activePreset.summaryEn : activePreset.summaryRu}
                  </p>

                  <div className="space-y-2">
                    {(isEn ? activePreset.stepsEn : activePreset.stepsRu).map((stepText, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed"
                      >
                        <span className="w-4 h-4 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                          {idx + 1}
                        </span>
                        <span>{stepText}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 1-Click Actionable Task Creation Card */}
                <div className="pt-3 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
                        {isEn
                          ? activePreset.taskDraft.priorityEn
                          : activePreset.taskDraft.priorityRu}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {isEn ? activePreset.taskDraft.deptEn : activePreset.taskDraft.deptRu}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white">
                      {isEn ? activePreset.taskDraft.titleEn : activePreset.taskDraft.titleRu}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const taskId = activePreset.taskDraft.id;
                      if (!createdDemoTaskIds.includes(taskId)) {
                        setCreatedDemoTaskIds((prev) => [...prev, taskId]);
                        setKanbanCards((prev) => [
                          {
                            id: taskId,
                            code: `TC-${130 + prev.length}`,
                            titleRu: activePreset.taskDraft.titleRu,
                            titleEn: activePreset.taskDraft.titleEn,
                            deptRu: activePreset.taskDraft.deptRu,
                            deptEn: activePreset.taskDraft.deptEn,
                            assigneeRu: currentUser?.name || 'Александр Громов',
                            assigneeEn: currentUser?.name || 'Alexander Gromov',
                            avatarGrad: 'from-indigo-500 to-violet-600',
                            priority: 'High',
                            stage: 'Todo',
                            checklistDone: 1,
                            checklistTotal: 3,
                            dueLabelRu: 'Сегодня, 19:00',
                            dueLabelEn: 'Today, 19:00',
                          },
                          ...prev,
                        ]);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      createdDemoTaskIds.includes(activePreset.taskDraft.id)
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {createdDemoTaskIds.includes(activePreset.taskDraft.id) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Added to Kanban' : 'Добавлено в Канбан'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isEn ? 'To Work' : 'В работу'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            ECONOMICS & PRICING SECTION
        ================================================================== */}
        <section
          id="pricing"
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-14 scroll-mt-20"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                <Calculator className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? 'Corporate Economics & Licensing'
                    : 'Экономика платформы и лицензирование'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {isEn
                  ? 'Plans & Annual Savings Calculator'
                  : 'Тарифы и калькулятор годовой экономии'}
              </h2>
            </div>

            {/* Currency & Billing Cycle Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-xl !bg-zinc-900/80 border !border-white/[0.1] p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-black'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {isEn ? 'Monthly' : 'Помесячно'}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === 'yearly'
                      ? 'bg-white text-black'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <span>{isEn ? 'Annual' : 'На год'}</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    -20%
                  </span>
                </button>
              </div>

              <div className="inline-flex items-center rounded-xl !bg-zinc-900/80 border !border-white/[0.1] p-1">
                {(['RUB', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setPricingCurrency(curr)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      pricingCurrency === curr
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ROI & COST COMPARISON CALCULATOR */}
          <div
            id="roi-calculator"
            className="mb-8 rounded-3xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.09] p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] scroll-mt-24"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>
                      {isEn
                        ? 'Number of employees in your company:'
                        : 'Количество сотрудников в вашей компании:'}
                    </span>
                  </span>
                  <span className="text-base font-extrabold !text-white tabular-nums px-3 py-1 rounded-xl bg-indigo-500/20 border border-indigo-400/35">
                    {teamSizeCalc} {isEn ? 'employees' : 'сотрудников'}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={200}
                  step={1}
                  value={teamSizeCalc}
                  onChange={(e) => setTeamSizeCalc(Number(e.target.value))}
                  aria-label={isEn ? 'Company headcount slider' : 'Ползунок численности компании'}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-zinc-400 font-medium tabular-nums">
                  <span>5 ({isEn ? 'Starter' : 'Старт'})</span>
                  <span>25 ({isEn ? 'Department' : 'Отдел'})</span>
                  <span>50 ({isEn ? 'Company' : 'Компания'})</span>
                  <span>200+ ({isEn ? 'Holding' : 'Холдинг'})</span>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl !bg-zinc-950/70 border !border-white/[0.08] p-4 space-y-1.5">
                  <div className="text-[11px] font-medium text-zinc-400">
                    {isEn
                      ? 'Separate Tools (Jira + CRM + Chat + Shifts)'
                      : 'Разрозненные сервисы (Jira + Битрикс24 + Slack + Табель)'}
                  </div>
                  <div className="text-lg font-extrabold text-rose-300 tabular-nums line-through">
                    {fmtPrice(fragmentedMonthlyTotal)}
                    <span className="text-xs font-normal text-zinc-400">
                      {isEn ? ' / mo' : ' / мес'}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {isEn ? '4 separate bills & integrations' : '4 разных счета и базы данных'}
                  </div>
                </div>

                <div className="rounded-2xl !bg-zinc-950/70 border !border-indigo-500/35 p-4 space-y-1.5">
                  <div className="text-[11px] font-medium text-indigo-300">
                    {isEn
                      ? `Unified TedCloud (${recommendedPlanObj.titleEn})`
                      : `Единая подписка TedCloud (${recommendedPlanObj.titleRu})`}
                  </div>
                  <div className="text-lg font-extrabold !text-white tabular-nums">
                    {fmtPrice(tedCloudMonthlyTotal)}
                    <span className="text-xs font-normal text-zinc-400">
                      {isEn ? ' / mo' : ' / мес'}
                    </span>
                  </div>
                  <div className="text-[10px] text-indigo-300 tabular-nums">
                    {fmtPrice(perEmployeeTedCloud)}{' '}
                    {isEn ? 'per employee / mo' : 'за сотрудника / мес'}
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/35 p-4 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Net Annual Savings' : 'Чистая годовая экономия'}</span>
                  </div>
                  <div className="text-xl font-extrabold text-emerald-300 tabular-nums">
                    {fmtPrice(annualSavings)}
                  </div>
                  <div className="text-[10px] text-emerald-200/80">
                    {isEn ? 'Saved every 12 months' : 'Сохраняется в бюджете за год'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 PRICING TIER CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {(['Trial', 'Business', 'Enterprise'] as SubscriptionPlanTier[]).map((planKey) => {
              const plan = PRICING_PLANS[planKey];
              const isHighlighted = planKey === 'Business';
              const priceVal = getPlanPrice(planKey, pricingCurrency, billingCycle);
              const features = isEn ? plan.featuresEn : plan.featuresRu;
              const planTitle = isEn ? plan.titleEn : plan.titleRu;

              return (
                <div
                  key={planKey}
                  className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all backdrop-blur-2xl ${
                    isHighlighted
                      ? '!bg-zinc-900/85 border-2 !border-indigo-500/60 !text-zinc-100 shadow-[0_24px_70px_rgba(79,70,229,0.22),inset_0_1px_0_rgba(255,255,255,0.16)]'
                      : '!bg-zinc-900/60 border !border-white/[0.09] !text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                  }`}
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-extrabold !text-white">{planTitle}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {isEn ? plan.maxEmployeesLabelEn : plan.maxEmployeesLabelRu}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          isHighlighted
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/[0.08] text-zinc-200'
                        }`}
                      >
                        {isEn ? plan.badgeEn : plan.badgeRu}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/[0.08]">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-extrabold !text-white tabular-nums">
                          {fmtPrice(priceVal)}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {priceVal === 0
                            ? isEn
                              ? '/ 14 days'
                              : '/ 14 дней'
                            : isEn
                            ? '/ month'
                            : '/ мес'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {isEn ? plan.seatsLabelEn : plan.seatsLabelRu}
                      </div>
                    </div>

                    <ul className="space-y-2.5 pt-2">
                      {features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-200">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => openAuthFlow('register_company', planKey)}
                      className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isHighlighted
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                          : 'bg-white text-black hover:bg-zinc-200'
                      }`}
                    >
                      <span>
                        {showcaseOnly
                          ? isEn
                            ? `Select ${planTitle} Plan`
                            : `Выбрать тариф ${planTitle}`
                          : planKey === 'Trial'
                          ? isEn
                            ? 'Start Free 14-Day Trial'
                            : 'Начать бесплатный период (14 дней)'
                          : isEn
                          ? `Deploy ${planTitle} Contour`
                          : `Развернуть контур ${planTitle}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* DESKTOP & PWA INSTALL BANNER */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="rounded-3xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.09] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <Monitor className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold !text-white">
                  {isEn
                    ? 'TedCloud Desktop App for macOS & Windows (PWA)'
                    : 'Настольное приложение TedCloud для macOS и Windows (PWA)'}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
                  {isEn
                    ? 'Install TedCloud directly to your Dock or Windows Taskbar for instant 1-click launch, offline caching, and zero browser tab clutter.'
                    : 'Установите TedCloud в Dock на macOS или на панель задач Windows для мгновенного запуска в отдельном окне без лишних вкладок браузера.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onCloseShowcase) {
                  onCloseShowcase();
                } else {
                  openAuthFlow('login');
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isEn ? 'Open Web & Desktop App' : 'Открыть приложение'}</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ============================================================================
  // VIEW MODE 2: AUTHENTICATION & REGISTRATION GATE
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-white/20">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            TC
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-white">TedCloud</span>
            <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-400">
              Enterprise Security Gate
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('promo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-medium text-indigo-300 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isEn ? 'Platform Overview & Pricing' : 'О платформе и Тарифы'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.08] bg-[#111114] hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span>{language === 'ru' ? 'RU' : 'EN'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Value Prop & Multi-Tenant Architecture */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-300">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isEn
                ? 'Isolated Multi-Tenant Architecture'
                : 'Изолированная корпоративная архитектура'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            {isEn
              ? 'Unified Corporate Operations, CRM & Telegram Gateway'
              : 'Единый контур управления задачами, CRM и коммуникациями'}
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            {isEn
              ? 'Sign in with your employee profile, personal invite code TC-XXXX, or create an isolated workspace for your organization.'
              : 'Войдите по учетной записи сотрудника, персональному коду приглашения TC-XXXX или создайте изолированный контур для вашей компании.'}
          </p>

          <div className="space-y-3 pt-2 border-t border-white/[0.07]">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-300" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {isEn ? 'Cryptographic Data Isolation' : 'Криптографическая изоляция компаний'}
                </div>
                <div className="text-xs text-zinc-500">
                  {isEn
                    ? 'Each company operates in a dedicated company_id scope.'
                    : 'Каждая организация работает в собственном изолированном контуре БД.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {isEn ? 'Granular 4-Tier RBAC' : 'Ролевая матрица доступов RBAC'}
                </div>
                <div className="text-xs text-zinc-500">
                  {isEn
                    ? 'Founder, Department Head, Senior Specialist, and Employee roles.'
                    : 'Гибкое разграничение полномочий для руководителей и специалистов.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Send className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {isEn ? 'Telegram 2FA & File Sync' : 'Двухфакторная защита Telegram 2FA'}
                </div>
                <div className="text-xs text-zinc-500">
                  {isEn
                    ? '4-digit OTP login confirmation and instant document delivery.'
                    : 'Подтверждение входа 4-значным кодом и мгновенная доставка файлов.'}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setViewMode('promo')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <span>
                {isEn
                  ? 'Explore Platform Architecture & Pricing'
                  : 'Обзор архитектуры платформы и тарифы'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Auth Card */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] shadow-2xl overflow-hidden">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 border-b border-white/[0.07] bg-[#121216] p-1.5 gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white text-black shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isEn ? 'Sign In' : 'Вход в контур'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register_invite');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'register_invite'
                    ? 'bg-white text-black shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isEn ? 'Invite Code' : 'По инвайт-коду'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register_company');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'register_company'
                    ? 'bg-white text-black shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isEn ? 'New Company' : 'Новая компания'}</span>
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-2.5 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* TAB 1: LOGIN */}
              {activeTab === 'login' && (
                <>
                  {otpModeActive ? (
                    <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                          <Send className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>
                            {isEn
                              ? 'Two-Factor Authentication (Telegram 2FA)'
                              : 'Двухфакторная защита входа (Telegram 2FA)'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{otpDeliveryHint}</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          {isEn
                            ? '4-Digit Confirmation Code from Telegram'
                            : '4-значный код подтверждения из Telegram'}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={otpCodeInput}
                          onChange={(e) => setOtpCodeInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="0000"
                          autoFocus
                          className="w-full rounded-xl border border-indigo-500/40 bg-[#141418] px-4 py-3 text-center text-xl font-bold tracking-[0.4em] tabular-nums text-white placeholder-zinc-600 focus:border-indigo-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setOtpModeActive(false);
                            setOtpCodeInput('');
                            setErrorMessage(null);
                          }}
                          className="px-4 py-2.5 rounded-xl border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
                        >
                          {isEn ? 'Back' : 'Назад'}
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || otpCodeInput.length !== 4}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all cursor-pointer"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                          <span>
                            {isEn ? 'Verify & Enter Workspace' : 'Подтвердить код и войти'}
                          </span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      {safeNodes.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                            {isEn
                              ? 'Quick Select Employee Profile'
                              : 'Быстрый выбор профиля сотрудника'}
                          </label>
                          <select
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white focus:border-white/30 focus:outline-none"
                          >
                            <option value="">
                              {isEn
                                ? '— Select employee or type below —'
                                : '— Выберите сотрудника из списка —'}
                            </option>
                            {safeNodes.map((member) => (
                              <option
                                key={member.id}
                                value={member.invite_code || member.name}
                              >
                                {member.name} ({member.role_type})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          {isEn
                            ? 'Employee Name, Email, Telegram ID, or Invite Code'
                            : 'ФИО сотрудника, Email, Telegram ID или код TC-XXXX'}
                        </label>
                        <input
                          type="text"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          placeholder={
                            isEn
                              ? 'e.g. TC-8492 or @username'
                              : 'Например: TC-8492 или ФИО сотрудника'
                          }
                          className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-zinc-300">
                            {isEn
                              ? 'Personal Password (if set)'
                              : 'Личный пароль (если установлен)'}
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleSendTelegramOtp()}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>
                              {isEn
                                ? 'Sign in via Telegram 2FA Code'
                                : 'Войти по коду из Telegram (2FA)'}
                            </span>
                          </button>
                        </div>
                        <input
                          type="password"
                          value={loginSecret}
                          onChange={(e) => setLoginSecret(e.target.value)}
                          placeholder={
                            isEn
                              ? 'Enter password (optional for TC-XXXX invite login)'
                              : 'Введите пароль (необязательно при входе по коду TC-XXXX)'
                          }
                          className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>{isEn ? 'Enter Workspace' : 'Войти в рабочее пространство'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </>
              )}

              {/* TAB 2: REGISTER / SIGN IN BY INVITE CODE */}
              {activeTab === 'register_invite' && (
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {isEn
                        ? 'Personal Employee Invite Code (TC-XXXX)'
                        : 'Персональный инвайт-код сотрудника (TC-XXXX)'}
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="TC-XXXX"
                      required
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wider tabular-nums text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {isEn
                      ? 'Enter the personal access code issued by your company founder or department head to activate your workspace profile.'
                      : 'Введите персональный код доступа, выданный руководителем вашей компании в разделе «Штат и Доступы».'}
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>
                      {isEn ? 'Activate Profile & Enter' : 'Активировать пропуск и войти'}
                    </span>
                  </button>
                </form>
              )}

              {/* TAB 3: REGISTER NEW COMPANY */}
              {activeTab === 'register_company' && (
                <form onSubmit={handleCompanyRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {isEn ? 'Selected Subscription Plan' : 'Выбранный тарифный план'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Trial', 'Business', 'Enterprise'] as SubscriptionPlanTier[]).map(
                        (pKey) => {
                          const pObj = PRICING_PLANS[pKey];
                          const activeCurr: CurrencyCode = language === 'en' ? 'USD' : 'RUB';
                          return (
                            <button
                              key={pKey}
                              type="button"
                              onClick={() => setPreselectedPlan(pKey)}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer ${
                                preselectedPlan === pKey
                                  ? 'border-indigo-500 bg-indigo-500/15 text-white'
                                  : 'border-white/[0.08] bg-[#141418] text-zinc-400 hover:text-white'
                              }`}
                            >
                              <div>{isEn ? pObj.titleEn : pObj.titleRu}</div>
                              <div className="text-[10px] font-normal text-zinc-400 tabular-nums">
                                {pKey === 'Trial'
                                  ? isEn
                                    ? '14 days free'
                                    : '14 дней бесплатно'
                                  : formatCompanyCurrency(
                                      getPlanPrice(pKey, activeCurr, 'yearly'),
                                      activeCurr,
                                      isEn ? 'en' : 'ru'
                                    )}
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {isEn ? 'Company / Organization Name' : 'Название компании / организации'}
                    </label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder={
                        isEn ? 'e.g. Apex Logistics Group' : 'Например: ООО «Альфа Технологии»'
                      }
                      required
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        {isEn ? 'Founder / CEO Full Name' : 'ФИО Основателя / Руководителя'}
                      </label>
                      <input
                        type="text"
                        value={founderName}
                        onChange={(e) => setFounderName(e.target.value)}
                        placeholder={isEn ? 'Alexander Gromov' : 'Александр Громов'}
                        required
                        className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        {isEn ? 'Executive Department' : 'Подразделение руководства'}
                      </label>
                      <input
                        type="text"
                        value={founderDepartment}
                        onChange={(e) => setFounderDepartment(e.target.value)}
                        placeholder={isEn ? 'Executive Board' : 'Исполнительная дирекция'}
                        className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {isEn ? 'Founder Password' : 'Личный пароль руководителя'}
                    </label>
                    <input
                      type="password"
                      value={founderPassword}
                      onChange={(e) => setFounderPassword(e.target.value)}
                      placeholder={isEn ? 'Minimum 4 characters' : 'Минимум 4 символа'}
                      required
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                    <span>
                      {isEn
                        ? 'Create Isolated Company Contour'
                        : 'Создать изолированный контур компании'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto py-3 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>TedCloud Enterprise · Multi-Tenant RBAC & Telegram Gateway</span>
        <span>
          {isEn
            ? 'End-to-End Tenant Isolation · TLS 1.3'
            : 'Криптографическая изоляция данных по company_id'}
        </span>
      </footer>
    </div>
  );
};
