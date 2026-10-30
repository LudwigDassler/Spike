import React, { useState, useEffect } from 'react';
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
  Sparkles,
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
} from 'lucide-react';
import {
  BillingCycle,
  Company,
  CurrencyCode,
  OrganizationNode,
  SubscriptionPlanTier,
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
type InteractivePreviewTab = 'kanban' | 'crm_docs' | 'chat_tg' | 'shifts';

interface SandboxTaskItem {
  id: string;
  code: string;
  titleRu: string;
  titleEn: string;
  deptRu: string;
  deptEn: string;
  priority: 'High' | 'Medium';
  done: boolean;
}

interface SandboxShiftMember {
  id: string;
  nameRu: string;
  nameEn: string;
  roleRu: string;
  roleEn: string;
  deptRu: string;
  deptEn: string;
  onShift: boolean;
  durationRu: string;
  durationEn: string;
  tasksClosed: number;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  existingNodes = [],
  nodes = [],
  existingCompany = null,
  company = null,
  showcaseOnly = false,
  onCloseShowcase,
  onSelectPlanFromWorkspace,
  onAuthenticated,
}) => {
  const { language, setLanguage } = useLocale();
  const isEn = language === 'en';

  const safeNodes =
    Array.isArray(nodes) && nodes.length > 0
      ? nodes
      : Array.isArray(existingNodes)
      ? existingNodes
      : [];
  const resolvedCompany = company || existingCompany || null;

  const [viewMode, setViewMode] = useState<'promo' | 'auth'>(
    showcaseOnly ? 'promo' : 'auth'
  );
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Showcase & Pricing Calculator State
  const [previewTab, setPreviewTab] = useState<InteractivePreviewTab>('kanban');
  const [pricingCurrency, setPricingCurrency] = useState<CurrencyCode>(
    language === 'en' ? 'USD' : 'RUB'
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [teamSizeCalc, setTeamSizeCalc] = useState<number>(28);
  const [preselectedPlan, setPreselectedPlan] = useState<SubscriptionPlanTier>('Business');

  // Sync currency automatically when user toggles RU / EN
  useEffect(() => {
    setPricingCurrency(language === 'en' ? 'USD' : 'RUB');
  }, [language]);

  useEffect(() => {
    if (showcaseOnly) {
      setViewMode('promo');
    }
  }, [showcaseOnly]);

  // ============================================================================
  // WIDGET 1 STATE: Interactive Live Sandbox (Tasks, Contract Preview, Shifts, Telegram Test)
  // ============================================================================
  const [sandboxTasks, setSandboxTasks] = useState<SandboxTaskItem[]>([
    {
      id: 'st-1',
      code: 'TC-104',
      titleRu: 'Подготовить медиаплан и КП для Газпром Нефть',
      titleEn: 'Prepare Media Plan & Proposal for Gazprom Neft',
      deptRu: 'Коммерческий блок',
      deptEn: 'Commercial Dept',
      priority: 'High',
      done: false,
    },
    {
      id: 'st-2',
      code: 'TC-108',
      titleRu: 'Проверить закрывающие акты за 3 квартал',
      titleEn: 'Audit Q3 Completion Acts & Invoices',
      deptRu: 'Финансы и Право',
      deptEn: 'Finance & Legal',
      priority: 'Medium',
      done: true,
    },
    {
      id: 'st-3',
      code: 'TC-112',
      titleRu: 'Запустить нагрузочный тест платежного шлюза',
      titleEn: 'Run Load Test on Payment Gateway',
      deptRu: 'Инженерный блок',
      deptEn: 'Engineering',
      priority: 'High',
      done: false,
    },
    {
      id: 'st-4',
      code: 'TC-115',
      titleRu: 'Согласовать годовой договор SLA с Альфа-Капитал',
      titleEn: 'Finalize Annual SLA Contract with Alfa Capital',
      deptRu: 'Юридический отдел',
      deptEn: 'Legal Counsel',
      priority: 'High',
      done: true,
    },
  ]);

  const [activeContractDeal, setActiveContractDeal] = useState<{
    client: string;
    inn: string;
    amount: number;
    contractNo: string;
  } | null>(null);

  const [sandboxShifts, setSandboxShifts] = useState<SandboxShiftMember[]>([
    {
      id: 'sh-1',
      nameRu: 'Александр Громов',
      nameEn: 'Alexander Gromov',
      roleRu: 'Исполнительный директор',
      roleEn: 'Chief Operating Officer',
      deptRu: 'Дирекция',
      deptEn: 'Executive Board',
      onShift: true,
      durationRu: '06 ч 42 м',
      durationEn: '06h 42m',
      tasksClosed: 5,
    },
    {
      id: 'sh-2',
      nameRu: 'Елена Соколова',
      nameEn: 'Elena Sokolova',
      roleRu: 'Руководитель продаж',
      roleEn: 'Head of Sales',
      deptRu: 'Коммерческий блок',
      deptEn: 'Commercial Dept',
      onShift: true,
      durationRu: '05 ч 18 м',
      durationEn: '05h 18m',
      tasksClosed: 4,
    },
    {
      id: 'sh-3',
      nameRu: 'Дмитрий Волков',
      nameEn: 'Dmitry Volkov',
      roleRu: 'Ведущий архитектор',
      roleEn: 'Principal Architect',
      deptRu: 'Инженерный блок',
      deptEn: 'Engineering',
      onShift: true,
      durationRu: '07 ч 05 м',
      durationEn: '07h 05m',
      tasksClosed: 6,
    },
    {
      id: 'sh-4',
      nameRu: 'Мария Белова',
      nameEn: 'Maria Belova',
      roleRu: 'Ведущий юрист',
      roleEn: 'Senior Legal Counsel',
      deptRu: 'Финансы и Право',
      deptEn: 'Finance & Legal',
      onShift: false,
      durationRu: '03 ч 50 м',
      durationEn: '03h 50m',
      tasksClosed: 2,
    },
  ]);

  const [tgTestStatus, setTgTestStatus] = useState<'idle' | 'encrypting' | 'routing' | 'delivered'>(
    'idle'
  );
  const [tgTestProgress, setTgTestProgress] = useState<number>(0);

  const handleRunTelegramPacketTest = () => {
    if (tgTestStatus === 'encrypting' || tgTestStatus === 'routing') return;
    setTgTestStatus('encrypting');
    setTgTestProgress(32);
    setTimeout(() => {
      setTgTestStatus('routing');
      setTgTestProgress(74);
    }, 320);
    setTimeout(() => {
      setTgTestStatus('delivered');
      setTgTestProgress(100);
    }, 680);
  };

  // ============================================================================
  // WIDGET 3 STATE: Interactive Teddy Demo on Marketing Page
  // ============================================================================
  const [activeTeddyScenarioIdx, setActiveTeddyScenarioIdx] = useState<number>(0);
  const [createdDemoTaskIds, setCreatedDemoTaskIds] = useState<string[]>([]);

  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginSecret, setLoginSecret] = useState<string>('');

  // 2FA Telegram OTP Challenge State
  const [otpModeActive, setOtpModeActive] = useState<boolean>(false);
  const [otpCodeInput, setOtpCodeInput] = useState<string>('');
  const [otpDeliveryHint, setOtpDeliveryHint] = useState<string>('');

  // Invite Code Login State
  const [inviteCode, setInviteCode] = useState<string>('');

  // Company Registration State
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [founderName, setFounderName] = useState<string>('');
  const [founderDepartment, setFounderDepartment] = useState<string>('Исполнительная дирекция');
  const [founderPassword, setFounderPassword] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-detect ?invite=CODE in URL
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
              (isEn ? 'Invalid credentials. Please verify your input.' : 'Ошибка проверки учетных данных.')
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
            ? `4-digit code generated (Demo mode: ${data.demoOtpHint})`
            : `Сгенерирован 4-значный код подтверждения (Демо-код: ${data.demoOtpHint})`
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
        isEn ? 'Enter your personal invite code (TC-XXXX).' : 'Введите ваш персональный инвайт-код (TC-XXXX).'
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
  // VIEW MODE 1: ENTERPRISE SHOWCASE & INTERACTIVE LANDING (data-surface="marketing")
  // ============================================================================
  if (viewMode === 'promo') {
    const recommendedPlanTier: SubscriptionPlanTier =
      teamSizeCalc <= 5 ? 'Trial' : teamSizeCalc <= 50 ? 'Business' : 'Enterprise';
    const recommendedPlanObj = PRICING_PLANS[recommendedPlanTier];

    // Widget 1 computed metrics
    const completedSandboxCount = sandboxTasks.filter((tItem) => tItem.done).length;
    const sandboxCompletionPct = Math.round(
      (completedSandboxCount / Math.max(1, sandboxTasks.length)) * 100
    );
    const activeShiftCount = sandboxShifts.filter((s) => s.onShift).length;

    // Widget 2 ROI & Cost Comparison calculations
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

    // Widget 3 Teddy Live Scenarios
    const teddyLiveScenarios = [
      {
        id: 'teddy-q1',
        questionRu: 'Какие сделки в воронке CRM требуют приоритетного контроля сегодня?',
        questionEn: 'Which deals in our CRM pipeline require priority executive focus today?',
        modeLabelRu: 'Финансовая аналитика',
        modeLabelEn: 'Financial Analytics',
        summaryRu:
          'В активной воронке 12 сделок на сумму 14,8 млн ₽. Наибольший финансовый рычаг — контракт с «Газпром Нефть» (4,2 млн ₽, стадия согласования договора). Рекомендуется сформировать финальную спецификацию и направить счет до 17:00.',
        summaryEn:
          'Active pipeline holds 12 deals totaling $162,000. Highest financial leverage is the Gazprom Neft agreement ($46,000, Contract Negotiation stage). Recommended action: finalize specification and issue invoice before 17:00.',
        stepsRu: [
          'Проверить реквизиты и спецификацию договора № TC-2026/084 («Газпром Нефть» — 4 200 000 ₽).',
          'Закрепить за руководителем отдела продаж контроль поступления авансового платежа.',
          'Перевести сделку «Альфа-Капитал» (1 850 000 ₽) на этап подписания закрывающего акта.',
        ],
        stepsEn: [
          'Verify legal details and specification for Agreement No. TC-2026/084 (Gazprom Neft — $46,000).',
          'Assign Head of Sales to confirm advance payment schedule.',
          'Advance Alfa Capital deal ($20,500) to completion act signature stage.',
        ],
        taskDraft: {
          id: 'demo-task-1',
          titleRu: 'Отправить финальный договор и счет для Газпром Нефть',
          titleEn: 'Send finalized contract and invoice to Gazprom Neft',
          deptRu: 'Коммерческий блок',
          deptEn: 'Commercial Dept',
          priorityRu: 'Высокий',
          priorityEn: 'High',
        },
      },
      {
        id: 'teddy-q2',
        questionRu: 'Где возникли узкие места и перегрузки по задачам в отделах?',
        questionEn: 'Where are the current workload bottlenecks across departments?',
        modeLabelRu: 'Операционный контроль',
        modeLabelEn: 'Operations Control',
        summaryRu:
          'Общий ритм исполнения по компании составляет 84%. В инженерном блоке обнаружена концентрация из 4 срочных задач у ведущего архитектора. Перераспределение 2 средних поручений ускорит релиз на 35%.',
        summaryEn:
          'Overall company SLA velocity stands at 84%. Engineering has 4 urgent tasks concentrated on the Principal Architect. Rebalancing 2 medium-priority items will accelerate delivery by 35%.',
        stepsRu: [
          'Передать задачу по ревизии тестового контура дежурному инженеру смены.',
          'Закрыть 2 выполненные задачи в реестре после проверки чек-листов.',
          'Синхронизировать статус смены в табеле рабочего времени.',
        ],
        stepsEn: [
          'Reassign staging environment audit to the on-duty systems engineer.',
          'Close 2 verified tasks in the registry after checklist validation.',
          'Synchronize active shift status in the live attendance timesheet.',
        ],
        taskDraft: {
          id: 'demo-task-2',
          titleRu: 'Перераспределить 2 задачи из очереди инженерного отдела',
          titleEn: 'Rebalance 2 tasks from the engineering queue',
          deptRu: 'Инженерный блок',
          deptEn: 'Engineering',
          priorityRu: 'Средний',
          priorityEn: 'Medium',
        },
      },
      {
        id: 'teddy-q3',
        questionRu: 'Как автоматизировать постановку поручений из переписки в Telegram?',
        questionEn: 'How can we automate task creation from Telegram client chats?',
        modeLabelRu: 'Автоматизация задач',
        modeLabelEn: 'Task Automation',
        summaryRu:
          'Двусторонний шлюз Telegram синхронизирует сообщения за 180 мс. Любое сообщение от клиента или сотрудника конвертируется в карточку задачи с сохранением вложений и автоматическим уведомлением исполнителя.',
        summaryEn:
          'Two-way Telegram gateway synchronizes messages in 180 ms. Any client or team message converts into a structured task card preserving attachments and notifying the owner automatically.',
        stepsRu: [
          'Нажать «В задачу» на сообщении в корпоративном мессенджере.',
          'Система автоматически заполнит заголовок, отдел и прикрепит файлы.',
          'Исполнитель мгновенно получит карточку поручения в свой Telegram.',
        ],
        stepsEn: [
          'Click "To Task" on any message inside the corporate messenger.',
          'The platform pre-fills title, department, and attached documents.',
          'The assignee immediately receives the task card in Telegram.',
        ],
        taskDraft: {
          id: 'demo-task-3',
          titleRu: 'Подключить уведомления Telegram для всех отделов',
          titleEn: 'Enable Telegram gateway notifications across all departments',
          deptRu: 'Операционный блок',
          deptEn: 'Operations',
          priorityRu: 'Высокий',
          priorityEn: 'High',
        },
      },
    ];

    const activeScenario = teddyLiveScenarios[activeTeddyScenarioIdx] || teddyLiveScenarios[0];

    return (
      <div
        data-surface="marketing"
        className="tc-dark-promo min-h-screen bg-[#07080c] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-white overflow-x-hidden relative"
      >
        {/* Ambient Radial Backlights */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[960px] h-[460px] bg-indigo-600/15 blur-[150px] rounded-full" />
          <div className="absolute top-[950px] -left-40 w-[520px] h-[520px] bg-violet-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-[1700px] -right-40 w-[560px] h-[560px] bg-sky-500/10 blur-[150px] rounded-full" />
        </div>

        {/* Sticky Glass Navigation Header */}
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07080c]/80 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm tracking-tight shadow-[0_0_25px_rgba(255,255,255,0.25)]">
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
                    ? 'Unified Corporate Workspace, CRM & Telegram Gateway'
                    : 'Единая система управления задачами, CRM и коммуникациями'}
                </p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
              <a href="#sandbox" className="hover:text-white transition-colors">
                {isEn ? 'Interactive Demo' : 'Живой симулятор'}
              </a>
              <a href="#teddy-demo" className="hover:text-white transition-colors">
                {isEn ? 'Teddy AI' : 'Ассистент Teddy'}
              </a>
              <a href="#roi-calculator" className="hover:text-white transition-colors">
                {isEn ? 'ROI Calculator' : 'Расчет выгоды'}
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
                    {isEn ? 'Sign In' : 'Войти'}
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
            HERO SECTION
        ================================================================== */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs font-medium mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {isEn
                ? 'Enterprise Operations · CRM & Legal · Two-Way Telegram Sync · Teddy AI'
                : 'Операционный контур · Сделки и Договоры · Двусторонний Telegram · ИИ Teddy'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
            {isEn ? (
              <>
                One Unified Platform for{' '}
                <span className="bg-gradient-to-r from-indigo-300 via-white to-sky-300 bg-clip-text text-transparent">
                  Tasks, CRM Deals, and Team Shifts
                </span>
              </>
            ) : (
              <>
                Единая операционная среда для{' '}
                <span className="bg-gradient-to-r from-indigo-300 via-white to-sky-300 bg-clip-text text-transparent">
                  задач, сделок CRM и контроля смен
                </span>
              </>
            )}
          </h1>

          <p className="mt-5 text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            {isEn
              ? 'Replace fragmented task trackers, CRM spreadsheets, and scattered chats with a single workspace synchronized with Telegram and powered by Teddy Executive AI.'
              : 'Замените разрозненные таск-трекеры, таблицы сделок и рабочие чаты единой платформой с прямой синхронизацией в Telegram и корпоративным ассистентом Teddy.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {onCloseShowcase ? (
              <button
                type="button"
                onClick={onCloseShowcase}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-sm font-semibold transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{isEn ? 'Back to Active Workspace' : 'Вернуться в рабочее пространство'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuthFlow('register_company', 'Trial')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-sm font-semibold transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isEn ? 'Launch Workspace (Free)' : 'Создать компанию бесплатно'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAuthFlow('register_invite')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-indigo-400/35 bg-indigo-500/15 hover:bg-indigo-500/25 text-sm font-semibold text-white transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-indigo-300" />
                  <span>{isEn ? 'Join by Invite Code' : 'Активировать инвайт-код'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAuthFlow('login')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.12] bg-zinc-900/70 hover:bg-zinc-800 text-sm font-semibold text-zinc-200 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-zinc-400" />
                  <span>{isEn ? 'Employee Sign In' : 'Вход для сотрудников'}</span>
                </button>
              </>
            )}
          </div>

          {/* =================================================================
              WIDGET 1: INTERACTIVE LIVE SANDBOX (ЖИВОЙ СИМУЛЯТОР РАБОЧЕГО КОНТУРА)
          ================================================================== */}
          <div id="sandbox" className="mt-12 text-left max-w-6xl mx-auto scroll-mt-20">
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {isEn
                    ? 'Interactive Live Sandbox — Click tasks, generate contracts, toggle shifts, and test Telegram delivery'
                    : 'Интерактивный симулятор контура — переключайте задачи, формируйте договоры и тестируйте шлюз Telegram'}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 tabular-nums">
                {isEn
                  ? `Completed: ${completedSandboxCount}/${sandboxTasks.length} (${sandboxCompletionPct}%) · Active Shifts: ${activeShiftCount}`
                  : `Выполнено задач: ${completedSandboxCount}/${sandboxTasks.length} (${sandboxCompletionPct}%) · На смене: ${activeShiftCount}`}
              </span>
            </div>

            <div className="rounded-2xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.09] shadow-[0_30px_100px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] overflow-hidden">
              {/* macOS Window Chrome + Interactive Mode Switcher */}
              <div className="px-4 py-3 border-b border-white/[0.08] bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-medium text-zinc-400 hidden sm:inline">
                    TedCloud Enterprise —{' '}
                    {isEn ? 'Live Interactive Contour' : 'Живой интерактивный контур'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      {
                        id: 'kanban',
                        label: isEn ? '1. Tasks & SLA' : '1. Задачи и SLA',
                        icon: CheckSquare,
                      },
                      {
                        id: 'crm_docs',
                        label: isEn ? '2. CRM & Contracts' : '2. CRM и Договоры',
                        icon: Briefcase,
                      },
                      {
                        id: 'chat_tg',
                        label: isEn ? '3. Telegram Gateway' : '3. Шлюз Telegram',
                        icon: MessageSquare,
                      },
                      {
                        id: 'shifts',
                        label: isEn ? '4. Shifts & Roster' : '4. Табель и Смены',
                        icon: Clock,
                      },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = previewTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPreviewTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white/[0.05] text-zinc-300 hover:text-white hover:bg-white/[0.1]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Sandbox Body */}
              <div className="p-5 sm:p-6 bg-[#090a10]/90">
                {previewTab === 'kanban' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Clickable Tasks with Live Progress Calculation */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                            {isEn
                              ? 'Interactive Task Registry (Click any task to toggle status)'
                              : 'Реестр поручений (нажмите на задачу для смены статуса)'}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                          {sandboxCompletionPct}% {isEn ? 'Completed' : 'Выполнено'}
                        </span>
                      </div>

                      {/* Live Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-white/[0.07] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                          style={{ width: `${sandboxCompletionPct}%` }}
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        {sandboxTasks.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setSandboxTasks((prev) =>
                                prev.map((tItem) =>
                                  tItem.id === item.id ? { ...tItem, done: !tItem.done } : tItem
                                )
                              )
                            }
                            className={`w-full rounded-xl border p-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                              item.done
                                ? '!bg-emerald-950/20 !border-emerald-500/30 text-zinc-200'
                                : '!bg-zinc-900/70 !border-white/[0.08] hover:!border-indigo-400/50 text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                                  item.done
                                    ? 'bg-emerald-500 border-emerald-400 text-black'
                                    : 'border-white/25 bg-white/[0.04]'
                                }`}
                              >
                                {item.done && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-indigo-300">
                                    {item.code}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold truncate ${
                                      item.done ? 'line-through text-zinc-400' : 'text-white'
                                    }`}
                                  >
                                    {isEn ? item.titleEn : item.titleRu}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">
                                  {isEn ? item.deptEn : item.deptRu}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                  item.done
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                }`}
                              >
                                {item.done
                                  ? isEn
                                    ? 'Done'
                                    : 'Готово'
                                  : isEn
                                  ? 'In Progress'
                                  : 'В работе'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right: Quick CRM Contract & Shift Controls inside Sandbox */}
                    <div className="lg:col-span-5 space-y-3">
                      <div className="rounded-xl !bg-zinc-900/70 border !border-white/[0.08] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {isEn ? 'Instant Contract Generator' : 'Генерация договора в 1 клик'}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold text-emerald-400">
                            4 200 000 ₽
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {isEn
                            ? 'Client: PJSC Gazprom Neft (Tax ID 7842390112) · Enterprise License'
                            : 'Контрагент: ПАО «Газпром Нефть» (ИНН 7842390112) · Лицензия Enterprise'}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveContractDeal(
                              activeContractDeal
                                ? null
                                : {
                                    client: isEn ? 'PJSC Gazprom Neft' : 'ПАО «Газпром Нефть»',
                                    inn: '7842390112',
                                    amount: 4200000,
                                    contractNo: 'TC-2026/084',
                                  }
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {activeContractDeal
                              ? isEn
                                ? 'Hide Contract Preview'
                                : 'Скрыть превью договора'
                              : isEn
                              ? 'Generate Contract'
                              : 'Сформировать договор'}
                          </span>
                        </button>

                        {activeContractDeal && (
                          <div className="tc-a4-paper rounded-xl !bg-white !text-slate-900 p-3.5 border border-slate-300 space-y-2 text-[11px] shadow-md">
                            <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                              <span className="font-bold !text-slate-900">
                                {isEn
                                  ? `AGREEMENT No. ${activeContractDeal.contractNo}`
                                  : `ДОГОВОР № ${activeContractDeal.contractNo}`}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 !text-emerald-800 font-semibold text-[10px]">
                                PDF / A4
                              </span>
                            </div>
                            <div className="!text-slate-700">
                              {isEn ? 'Customer:' : 'Заказчик:'}{' '}
                              <strong className="!text-slate-900">
                                {activeContractDeal.client}
                              </strong>{' '}
                              (ИНН {activeContractDeal.inn})
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                              <span className="!text-slate-600">
                                {isEn ? 'Total Contract Value:' : 'Сумма по договору:'}
                              </span>
                              <span className="font-extrabold !text-slate-900">4 200 000 ₽</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Live Telegram Gateway Test inside Sandbox */}
                      <div className="rounded-xl !bg-zinc-900/70 border !border-white/[0.08] p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-sky-400" />
                            <span>
                              {isEn ? 'Telegram Webhook Test' : 'Тест шлюза Telegram'}
                            </span>
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-400">
                            180 ms
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRunTelegramPacketTest}
                          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-sky-300" />
                          <span>
                            {isEn ? 'Send Test to Telegram' : 'Отправить тест в Telegram'}
                          </span>
                        </button>
                        {tgTestStatus !== 'idle' && (
                          <div className="space-y-1.5 pt-1">
                            <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full bg-sky-400 transition-all duration-300"
                                style={{ width: `${tgTestProgress}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-sky-300 font-medium">
                              {tgTestStatus === 'encrypting'
                                ? isEn
                                  ? 'Encrypting payload...'
                                  : 'Шифрование пакета...'
                                : tgTestStatus === 'routing'
                                ? isEn
                                  ? 'Routing via Telegram Bot API...'
                                  : 'Доставка через шлюз...'
                                : isEn
                                ? 'Delivered to Telegram in 180 ms'
                                : 'Доставлено в Telegram за 180 мс'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'crm_docs' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    <div className="lg:col-span-5 rounded-xl !bg-zinc-900/70 border !border-white/[0.08] p-4 space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            {isEn ? 'CRM Deal Card' : 'Карточка сделки CRM'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                            {isEn ? 'Contract Stage' : 'Согласование договора'}
                          </span>
                        </div>
                        <div>
                          <div className="text-base font-bold text-white">
                            {isEn ? 'PJSC Gazprom Neft' : 'ПАО «Газпром Нефть»'}
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {isEn
                              ? 'Tax ID: 7842390112 · Contract #TC-2026/084'
                              : 'ИНН: 7842390112 · Договор № TC-2026/084'}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] p-3 border border-white/[0.06] flex items-center justify-between">
                          <span className="text-xs text-zinc-400">
                            {isEn ? 'Deal Value:' : 'Сумма контракта:'}
                          </span>
                          <span className="text-sm font-extrabold text-emerald-400 tabular-nums">
                            4 200 000 ₽
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 flex items-center gap-2 text-xs text-indigo-300 font-medium">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>
                          {isEn
                            ? 'Auto-generates print-ready Contract, Proposal & Invoice'
                            : 'Авто-генерация Договора, КП и Счета-акта за 1 клик'}
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-7 tc-a4-paper rounded-xl !bg-white !text-slate-950 p-5 shadow-xl border border-slate-300 space-y-3 text-xs">
                      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                        <div>
                          <div className="font-extrabold text-sm !text-slate-950">
                            {isEn
                              ? 'MASTER B2B SERVICES AGREEMENT No. TC-2026/084'
                              : 'ДОГОВОР ОКАЗАНИЯ КОРПОРАТИВНЫХ УСЛУГ № TC-2026/084'}
                          </div>
                          <div className="text-[11px] !text-slate-600">
                            {isEn
                              ? 'Customer: PJSC Gazprom Neft (Tax ID 7842390112)'
                              : 'Заказчик: ПАО «Газпром Нефть» (ИНН 7842390112)'}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-900 !text-white text-[10px] font-bold">
                          A4 / PDF
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded-lg text-[11px]">
                        <div>
                          <div className="!text-slate-500">{isEn ? 'Service' : 'Предмет'}</div>
                          <div className="font-semibold !text-slate-900">
                            {isEn ? 'Enterprise License' : 'Лицензия TedCloud'}
                          </div>
                        </div>
                        <div>
                          <div className="!text-slate-500">{isEn ? 'Period' : 'Срок'}</div>
                          <div className="font-semibold !text-slate-900">
                            {isEn ? '12 Months' : '12 месяцев'}
                          </div>
                        </div>
                        <div>
                          <div className="!text-slate-500">{isEn ? 'Total' : 'Итого'}</div>
                          <div className="font-bold !text-slate-950">4 200 000 ₽</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 text-[11px] !text-slate-600">
                        <span>
                          {isEn ? 'Contractor: TedCloud LLC' : 'Исполнитель: ООО «ТедКлауд»'}
                        </span>
                        <span className="px-2 py-0.5 rounded border border-indigo-600 !text-indigo-700 font-bold">
                          {isEn ? 'DIGITAL SEAL VERIFIED' : 'ПЕЧАТЬ И ПОДПИСЬ'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'chat_tg' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                    <div className="rounded-xl !bg-zinc-900/70 border !border-white/[0.08] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {isEn ? 'Corporate Web Messenger' : 'Корпоративный веб-мессенджер'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold">
                          {isEn ? 'Two-Way Telegram Sync' : 'Синхронизация с Telegram'}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#161822] border border-white/[0.07] p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span className="font-semibold text-indigo-300">Елена Соколова</span>
                          <span>14:22</span>
                        </div>
                        <p className="text-xs text-zinc-100">
                          {isEn
                            ? 'Client approved the specification. Sending signed PDF contract.'
                            : 'Клиент согласовал спецификацию. Отправляю подписанный PDF-договор.'}
                        </p>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[11px] text-indigo-200">
                          <Paperclip className="w-3 h-3 text-indigo-300" />
                          <span>Contract_GazpromNeft_Signed.pdf (420 KB)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={handleRunTelegramPacketTest}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-xs font-semibold text-sky-200 transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {isEn ? 'Send Test to Telegram' : 'Отправить тест в Telegram'}
                          </span>
                        </button>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold">
                          {isEn ? 'Convert to Task' : 'В задачу'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl !bg-zinc-900/70 border border-sky-500/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Telegram Bot Gateway' : 'Бот-шлюз в Telegram'}</span>
                        </span>
                        <span className="text-[10px] text-zinc-400">Webhook Active</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {isEn
                          ? 'Files, voice notes, and PDF documents sent from the web chat arrive directly in the employee’s Telegram via sendDocument / sendPhoto — and replies return to the web workspace.'
                          : 'Файлы, фотографии и PDF-договоры из веб-чата доставляются напрямую в Telegram сотрудника через sendDocument / sendPhoto, а ответы из мессенджера мгновенно возвращаются в систему.'}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-white/[0.04] p-2.5 border border-white/[0.06]">
                          <div className="text-zinc-400">{isEn ? '2FA Login' : 'Вход 2FA'}</div>
                          <div className="font-semibold text-white mt-0.5">
                            {isEn ? '4-Digit OTP Code' : '4-значный код в TG'}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] p-2.5 border border-white/[0.06]">
                          <div className="text-zinc-400">{isEn ? 'Attachments' : 'Вложения'}</div>
                          <div className="font-semibold text-white mt-0.5">
                            PDF / DOCX / PNG
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === 'shifts' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        {isEn
                          ? 'Interactive Shift Roster (Click status button to toggle employee shift)'
                          : 'Интерактивный табель смен (нажмите на статус сотрудника для переключения)'}
                      </span>
                      <span className="text-xs text-zinc-300 font-semibold tabular-nums">
                        {isEn
                          ? `Online on Shift: ${activeShiftCount} / ${sandboxShifts.length}`
                          : `На смене онлайн: ${activeShiftCount} из ${sandboxShifts.length}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {sandboxShifts.map((emp) => (
                        <div
                          key={emp.id}
                          className="rounded-xl !bg-zinc-900/70 border !border-white/[0.08] p-3.5 space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white truncate">
                              {isEn ? emp.nameEn : emp.nameRu}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSandboxShifts((prev) =>
                                  prev.map((s) =>
                                    s.id === emp.id ? { ...s, onShift: !s.onShift } : s
                                  )
                                )
                              }
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
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
                                  ? isEn
                                    ? 'On Shift'
                                    : 'На смене'
                                  : isEn
                                  ? 'Break'
                                  : 'Перерыв'}
                              </span>
                            </button>
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {isEn ? emp.roleEn : emp.roleRu} · {isEn ? emp.deptEn : emp.deptRu}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                            <span className="text-indigo-300 font-mono">
                              {isEn ? emp.durationEn : emp.durationRu}
                            </span>
                            <span className="text-emerald-300 font-semibold">
                              {emp.tasksClosed} {isEn ? 'tasks' : 'задач'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            HOW TO LAUNCH IN 4 STEPS
        ================================================================== */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: '01',
                title: isEn ? 'Register Company' : 'Регистрация компании',
                desc: isEn
                  ? 'Create an isolated tenant contour and receive your Founder Master Key.'
                  : 'Создайте изолированный контур организации и получите Мастер-ключ Основателя.',
                badge: isEn ? '60 sec' : '60 сек',
              },
              {
                step: '02',
                title: isEn ? 'Structure & Invites' : 'Штат и инвайт-коды',
                desc: isEn
                  ? 'Add departments and send 1-click Telegram invite links to your team.'
                  : 'Сформируйте отделы и отправьте сотрудникам персональные ссылки-приглашения.',
                badge: 'RBAC',
              },
              {
                step: '03',
                title: isEn ? 'Connect Telegram Bot' : 'Привязка Telegram 2FA',
                desc: isEn
                  ? 'Link employee Telegram accounts for 4-digit OTP login and instant file delivery.'
                  : 'Подключите Telegram для защиты входа 4-значным кодом и мгновенной доставки файлов.',
                badge: '2FA OTP',
              },
              {
                step: '04',
                title: isEn ? 'Manage Operations & CRM' : 'Управление и аналитика',
                desc: isEn
                  ? 'Track tasks, generate B2B contracts, monitor shifts, and export Excel reports.'
                  : 'Контролируйте задачи, формируйте договоры из CRM и выгружайте сводные отчеты.',
                badge: 'Teddy AI',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.08] p-5 flex flex-col justify-between gap-3 hover:!border-indigo-500/40 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      STEP {item.step}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-semibold text-zinc-200">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =================================================================
            WIDGET 3: INTERACTIVE TEDDY AI DEMO RIGHT ON THE SHOWCASE PAGE
        ================================================================== */}
        <section
          id="teddy-demo"
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 scroll-mt-20"
        >
          <div className="rounded-3xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.09] p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <TeddyAvatar size="lg" />
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                      Teddy
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
                      {isEn ? 'Executive AI Assistant' : 'Корпоративный ИИ-ассистент'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {isEn
                      ? 'Select any real business question below to see how Teddy analyzes live company data and prepares actionable tasks.'
                      : 'Выберите любой рабочий вопрос ниже, чтобы увидеть, как Teddy разбирает показатели компании и формирует поручения.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  {isEn
                    ? 'Interactive Demo — Click a question'
                    : 'Интерактивное демо — выберите сценарий'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 items-start">
              {/* Left: 3 Clickable Business Questions */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                  {isEn ? '3 Real Executive Questions' : '3 реальных управленческих запроса'}
                </div>
                {teddyLiveScenarios.map((scen, idx) => {
                  const isSelected = activeTeddyScenarioIdx === idx;
                  return (
                    <button
                      key={scen.id}
                      type="button"
                      onClick={() => setActiveTeddyScenarioIdx(idx)}
                      className={`w-full text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                        isSelected
                          ? '!bg-indigo-600/20 !border-indigo-400/60 text-white shadow-sm'
                          : '!bg-zinc-950/60 !border-white/[0.07] hover:!border-white/20 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {isEn ? scen.modeLabelEn : scen.modeLabelRu}
                        </span>
                        <ArrowRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected ? 'text-indigo-300 translate-x-0.5' : 'text-zinc-500'
                          }`}
                        />
                      </div>
                      <div className="text-xs sm:text-sm font-semibold leading-snug text-white">
                        {isEn ? scen.questionEn : scen.questionRu}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right: Teddy Instant Breakdown & 1-Click Task Generation */}
              <div className="lg:col-span-7 rounded-2xl !bg-zinc-950/75 border !border-white/[0.09] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
                  <div className="flex items-center gap-2">
                    <TeddyAvatar size="xs" />
                    <span className="text-xs font-bold text-white">Teddy</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                      {isEn ? activeScenario.modeLabelEn : activeScenario.modeLabelRu}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {isEn ? 'Analyzed in 0.4s' : 'Расчет за 0.4 сек'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed font-medium">
                  {isEn ? activeScenario.summaryEn : activeScenario.summaryRu}
                </p>

                <div className="space-y-2 pt-1">
                  {(isEn ? activeScenario.stepsEn : activeScenario.stepsRu).map((stepText, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed"
                    >
                      <span className="w-4 h-4 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{stepText}</span>
                    </div>
                  ))}
                </div>

                {/* Recommended 1-Click Task Card */}
                <div className="pt-3 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300">
                        {isEn
                          ? activeScenario.taskDraft.priorityEn
                          : activeScenario.taskDraft.priorityRu}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {isEn ? activeScenario.taskDraft.deptEn : activeScenario.taskDraft.deptRu}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white">
                      {isEn ? activeScenario.taskDraft.titleEn : activeScenario.taskDraft.titleRu}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const taskId = activeScenario.taskDraft.id;
                      if (!createdDemoTaskIds.includes(taskId)) {
                        setCreatedDemoTaskIds((prev) => [...prev, taskId]);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      createdDemoTaskIds.includes(activeScenario.taskDraft.id)
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {createdDemoTaskIds.includes(activeScenario.taskDraft.id) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Added to Registry' : 'Добавлено в реестр'}</span>
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
            BENTO GRID: 6 CORE ENTERPRISE MODULES
        ================================================================== */}
        <section id="architecture" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isEn
                ? 'Enterprise Architecture Built for Speed & Clarity'
                : 'Архитектура корпоративного класса без визуального шума'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              {isEn
                ? 'Six tightly integrated contours that replace a patchwork of separate SaaS subscriptions.'
                : 'Шесть синхронизированных контуров управления, заменяющих набор разрозненных сервисов.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Layers,
                title: isEn ? 'Multi-View Task Engine' : 'Мульти-режимный трекер задач',
                desc: isEn
                  ? 'Switch between Kanban Board, Gantt Timeline, Calendar, and Registry Table with sub-tasks, checklists, and strict SLA deadlines.'
                  : 'Мгновенное переключение между Канбан-доской, Диаграммой Ганта, Календарем и Табличным реестром с чек-листами и дедлайнами.',
                accent: 'text-indigo-400',
              },
              {
                icon: FileText,
                title: isEn ? 'CRM & Legal Document Generator' : 'CRM и генератор договоров',
                desc: isEn
                  ? 'Manage B2B deals with Tax IDs and generate formatted Contracts, Commercial Proposals, and Completion Acts ready for PDF print.'
                  : 'Ведение сделок с ИНН и суммой контракта. Генерация готовых к печати Договоров, КП и Актов выполненных работ в 1 клик.',
                accent: 'text-amber-400',
              },
              {
                icon: Send,
                title: isEn ? 'Two-Way Telegram Gateway' : 'Двусторонний шлюз Telegram',
                desc: isEn
                  ? 'Send messages, photos, and PDF documents directly to employees in Telegram and convert incoming messages into tasks.'
                  : 'Доставка сообщений и вложенных файлов напрямую в Telegram сотрудников и создание поручений из переписки за 1 клик.',
                accent: 'text-sky-400',
              },
              {
                icon: Clock,
                title: isEn ? 'Workday Shift & Attendance' : 'Учет смен и рабочего времени',
                desc: isEn
                  ? 'Live shift timer in the top bar (On Shift / Break / Finish with Auto-Report) and full historical timesheet analytics.'
                  : 'Живой таймер смены в верхней панели (На смене / Перерыв / Авто-отчет) и полный табель отработанных часов по отделам.',
                accent: 'text-emerald-400',
              },
              {
                icon: BarChart3,
                title: isEn ? 'Teddy Executive AI' : 'Ассистент руководителя Teddy',
                desc: isEn
                  ? 'Context-aware executive assistant that audits tasks, CRM revenue, and team workload to propose 1-click actions.'
                  : 'Аналитический ИИ-ассистент, который проверяет задачи, сделки CRM и загрузку сотрудников, формируя готовые поручения.',
                accent: 'text-violet-400',
              },
              {
                icon: ShieldCheck,
                title: isEn ? 'Cryptographic Tenant Isolation' : 'Криптографическая изоляция и 2FA',
                desc: isEn
                  ? 'Strict data isolation by company_id, 4-tier RBAC permissions, Telegram 2FA login codes, and 1-click Excel export.'
                  : 'Жесткая изоляция данных по company_id, ролевой доступ RBAC, двухфакторный вход через Telegram и экспорт в Excel.',
                accent: 'text-rose-400',
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.08] p-6 space-y-3 hover:!border-white/20 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.09] flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${card.accent}`} />
                  </div>
                  <h3 className="text-base font-bold text-white">{card.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* =================================================================
            WIDGET 2 + PRICING SECTION: INTERACTIVE ROI CALCULATOR & 3 TIERS
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
                  {isEn ? 'Transparent B2B Licensing' : 'Прозрачное корпоративное лицензирование'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {isEn
                  ? 'Plans & Interactive ROI Calculator'
                  : 'Тарифы и калькулятор годовой экономии'}
              </h2>
            </div>

            {/* Currency & Billing Cycle Controls (100% High Contrast) */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Billing Cycle */}
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

              {/* Currency Switcher */}
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

          {/* =================================================================
              WIDGET 2: INTERACTIVE ROI & COST COMPARISON CALCULATOR
          ================================================================== */}
          <div
            id="roi-calculator"
            className="mb-8 rounded-3xl !bg-zinc-900/60 backdrop-blur-2xl border !border-white/[0.09] p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] scroll-mt-24"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left: Employee Slider */}
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
                <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
                  <span>5 ({isEn ? 'Starter' : 'Старт'})</span>
                  <span>25 ({isEn ? 'Department' : 'Отдел'})</span>
                  <span>50 ({isEn ? 'Company' : 'Компания'})</span>
                  <span>200+ ({isEn ? 'Holding' : 'Холдинг'})</span>
                </div>
              </div>

              {/* Right: Live Cost Comparison (Fragmented SaaS Bundle vs Unified TedCloud) */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Fragmented Tools Overpayment */}
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

                {/* 2. Unified TedCloud Subscription */}
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

                {/* 3. Net Annual Company Savings */}
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

          {/* =================================================================
              3 PRICING TIER CARDS (100% DARK GLASS ISOLATED IN BOTH THEMES)
          ================================================================== */}
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

        {/* =================================================================
            DESKTOP & PWA INSTALL BANNER (100% DARK GLASS ISOLATED)
        ================================================================== */}
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
                    : 'Десктопное приложение TedCloud для macOS и Windows (PWA)'}
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
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
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
                  ? 'Explore Interactive Platform Tour & Pricing'
                  : 'Смотреть интерактивный обзор платформы и тарифы'}
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
                          className="w-full rounded-xl border border-indigo-500/40 bg-[#141418] px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.4em] text-white placeholder-zinc-600 focus:border-indigo-400 focus:outline-none"
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
                              {isEn ? '— Select employee or type below —' : '— Выберите сотрудника из списка —'}
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
                            isEn ? 'e.g. TC-8492 or @username' : 'Например: TC-8492 или ФИО сотрудника'
                          }
                          className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-zinc-300">
                            {isEn ? 'Personal Password (if set)' : 'Личный пароль (если установлен)'}
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleSendTelegramOtp()}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>
                              {isEn ? 'Sign in via Telegram 2FA Code' : 'Войти по коду из Telegram (2FA)'}
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
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none"
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
                    <span>{isEn ? 'Activate Profile & Enter' : 'Активировать пропуск и войти'}</span>
                  </button>
                </form>
              )}

              {/* TAB 3: REGISTER NEW COMPANY */}
              {activeTab === 'register_company' && (
                <form onSubmit={handleCompanyRegisterSubmit} className="space-y-4">
                  {/* Plan Selector */}
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
                              <div className="text-[10px] font-normal text-zinc-400">
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
                      {isEn ? 'Create Isolated Company Contour' : 'Создать изолированный контур компании'}
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
