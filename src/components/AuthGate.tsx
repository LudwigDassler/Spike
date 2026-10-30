import React, { useState } from 'react';
import {
  Building2,
  KeyRound,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Send,
  Check,
  Clock,
  Briefcase,
  MessageSquare,
  Cpu,
  Monitor,
  Smartphone,
  CheckCircle2,
  Layers,
  Sun,
  Moon,
  X,
  FileText,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Company, CurrencyCode, OrganizationNode, SubscriptionPlanTier } from '../types/database';
import { useLocale, SupportedLocale } from '../i18n/LocaleContext';
import { formatError, getPlanPrice, PRICING_PLANS } from '../utils/enterpriseLogic';
import { TeddyAvatar } from './TedCloudAiDrawer';

interface AuthGateProps {
  existingNodes?: OrganizationNode[];
  nodes?: OrganizationNode[];
  existingCompany?: Company | null;
  company?: Company | null;
  currentUser?: OrganizationNode | null;
  botUsername?: string;
  onAuthenticated: (profile: OrganizationNode, company: Company | null) => void;
  showcaseOnly?: boolean;
  onCloseShowcase?: () => void;
  onSelectPlanFromWorkspace?: (
    plan: SubscriptionPlanTier,
    cycle: 'monthly' | 'yearly',
    currency: CurrencyCode
  ) => void;
}

type TopViewMode = 'auth' | 'showcase';
type AuthTabMode = 'signin' | 'register';
type LoginSubMode = 'invite' | 'credentials' | 'telegram';
type TelegramVerifyMethod = 'otp' | 'password';

export const AuthGate: React.FC<AuthGateProps> = ({
  existingNodes,
  nodes,
  existingCompany,
  company,
  currentUser = null,
  onAuthenticated,
  showcaseOnly = false,
  onCloseShowcase,
  onSelectPlanFromWorkspace,
}) => {
  const { locale, setLocale, theme, toggleTheme, t } = useLocale();
  const isEn = locale === 'en';

  const safeExistingNodes: OrganizationNode[] = Array.isArray(existingNodes)
    ? existingNodes
    : Array.isArray(nodes)
    ? nodes
    : [];
  const safeExistingCompany: Company | null = existingCompany ?? company ?? null;
  const isAuthenticatedUser = Boolean(showcaseOnly || currentUser);

  const [topView, setTopView] = useState<TopViewMode>(showcaseOnly ? 'showcase' : 'auth');
  const [mode, setMode] = useState<AuthTabMode>(
    (safeExistingNodes || []).length === 0 ? 'register' : 'signin'
  );
  const [loginMethod, setLoginMethod] = useState<LoginSubMode>('invite');
  const [telegramMethod, setTelegramMethod] = useState<TelegramVerifyMethod>('otp');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // 1. Invite code login state
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  // 2. Email / Full Name + Password login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 3. Telegram ID + Password OR 4-digit OTP code state
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [telegramPassword, setTelegramPassword] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [otpSentToName, setOtpSentToName] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Create Workspace state
  const [companyName, setCompanyName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderTitle, setLeaderTitle] = useState('');
  const [leaderDepartment, setLeaderDepartment] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderPassword, setLeaderPassword] = useState('');

  // Showcase module preview tab & interactive pricing calculator state
  const [activeShowcaseModule, setActiveShowcaseModule] = useState<
    'tasks' | 'crm' | 'shifts' | 'ai'
  >('tasks');
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [pricingCurrency, setPricingCurrency] = useState<CurrencyCode>(isEn ? 'USD' : 'RUB');
  const [employeeSliderCount, setEmployeeSliderCount] = useState<number>(28);

  const locales: SupportedLocale[] = ['ru', 'en'];

  // Handler 1: Invite Key (Passwordless 1-click access)
  const handleInviteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const code = inviteCodeInput.trim();
    if (!code) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'login',
          loginMode: 'invite',
          input: code,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.profile) {
        onAuthenticated(payload.profile, payload.company || null);
        return;
      }

      const q = code.toLowerCase();
      const matchedNode = (safeExistingNodes || []).find(
        (node) => String(node?.invite_code || '').trim().toLowerCase() === q
      );

      if (!matchedNode) {
        setErrorMessage(
          formatError(
            payload?.error ||
              (isEn
                ? 'Employee with this invite key (TC-XXXX) was not found.'
                : 'Сотрудник с таким инвайт-ключом (TC-XXXX) не найден.')
          )
        );
        return;
      }

      onAuthenticated(
        matchedNode,
        safeExistingCompany && safeExistingCompany.id === matchedNode.company_id
          ? safeExistingCompany
          : null
      );
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handler 2: Login (Email or Full Name) + Password (sets password on first login if unset)
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const identifier = loginIdentifier.trim();
    const pwd = loginPassword.trim();
    if (!identifier || !pwd) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'login',
          loginMode: 'credentials',
          input: identifier,
          password: pwd,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.profile) {
        onAuthenticated(payload.profile, payload.company || null);
        return;
      }

      setErrorMessage(
        formatError(
          payload?.error ||
            (isEn
              ? 'Invalid login or password.'
              : 'Неверный логин (Email / ФИО) или пароль.')
        )
      );
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handler 3A: Send 4-digit OTP code to Telegram Bot
  const handleSendTelegramOtp = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    const tgId = telegramIdInput.trim();
    if (!tgId) {
      setErrorMessage(
        isEn ? 'Please enter your Telegram ID first.' : 'Сначала укажите ваш Telegram ID.'
      );
      return;
    }

    setIsSendingOtp(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'send_telegram_otp',
          telegramId: tgId,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.error) {
        setErrorMessage(
          formatError(
            payload?.error ||
              (isEn
                ? 'Could not send 2FA code to Telegram.'
                : 'Не удалось отправить код подтверждения в Telegram.')
          )
        );
        return;
      }

      setOtpSentToName(payload.employeeName || tgId);
      setInfoMessage(
        isEn
          ? `4-digit code sent to Telegram bot for ${payload.employeeName || tgId}.`
          : `4-значный код подтверждения отправлен в Telegram-бот для ${
              payload.employeeName || tgId
            }.`
      );
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handler 3B: Verify Telegram Login (via 4-digit OTP or Password)
  const handleTelegramLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const tgId = telegramIdInput.trim();
    if (!tgId) return;

    setIsLoading(true);
    try {
      if (telegramMethod === 'otp') {
        const otp = otpCodeInput.trim();
        if (!otp) {
          setErrorMessage(
            isEn
              ? 'Enter the 4-digit code from Telegram.'
              : 'Введите 4-значный код из Telegram-бота.'
          );
          setIsLoading(false);
          return;
        }
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            action: 'verify_telegram_otp',
            telegramId: tgId,
            otpCode: otp,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.profile) {
          onAuthenticated(payload.profile, payload.company || null);
          return;
        }
        setErrorMessage(
          formatError(
            payload?.error ||
              (isEn
                ? 'Invalid 4-digit confirmation code.'
                : 'Неверный 4-значный код подтверждения.')
          )
        );
      } else {
        const pwd = telegramPassword.trim();
        if (!pwd) {
          setErrorMessage(isEn ? 'Enter your password.' : 'Введите ваш пароль.');
          setIsLoading(false);
          return;
        }
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            action: 'login',
            loginMode: 'telegram_password',
            input: tgId,
            password: pwd,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.profile) {
          onAuthenticated(payload.profile, payload.company || null);
          return;
        }
        setErrorMessage(
          formatError(
            payload?.error ||
              (isEn ? 'Invalid Telegram ID or password.' : 'Неверный Telegram ID или пароль.')
          )
        );
      }
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handler 4: Register New Company Workspace
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!companyName.trim() || !leaderName.trim() || !leaderTitle.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_workspace',
          companyName: companyName.trim(),
          leaderName: leaderName.trim(),
          leaderTitle: leaderTitle.trim(),
          leaderDepartment: leaderDepartment.trim() || null,
          leaderEmail: leaderEmail.trim() || null,
          leaderPassword: leaderPassword.trim() || null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error || !result.profile) {
        throw new Error(formatError(result?.error || `HTTP ${response.status}`));
      }

      onAuthenticated(result.profile, result.company || null);
    } catch (err: any) {
      setErrorMessage(formatError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const isShowcaseMode = showcaseOnly || topView === 'showcase';

  return (
    <div
      className={
        isShowcaseMode
          ? 'tc-dark-promo min-h-screen w-full bg-[#060609] !text-white font-sans antialiased overflow-x-hidden relative flex flex-col justify-between'
          : 'min-h-screen bg-[#0b0d13] text-[#EDEDED] font-sans antialiased flex flex-col justify-between p-4 sm:p-6'
      }
    >
      {/* Top Bar: Shown ONLY on Auth login screen (hidden on full-bleed Showcase promo website) */}
      {!isShowcaseMode && (
        <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-indigo-600 !text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-sm">
              TC
            </div>
            <span className="text-sm font-semibold !text-white tracking-tight">TedCloud</span>
            <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded bg-[#18181B] text-[#A1A1AA] border border-white/[0.08] whitespace-nowrap">
              {t('brand.edition')}
            </span>
          </div>

          {/* Central Top Switcher: Workspace Sign-In vs Product Tour & Pricing (БЛОК 4) */}
          <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-[#12151e] p-1">
            <button
              type="button"
              onClick={() => setTopView('auth')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                topView === 'auth'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isEn ? 'Workspace Sign In' : 'Вход и Регистрация'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTopView('showcase')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                topView === 'showcase'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isEn ? 'Product Tour & Pricing' : 'О платформе и Тарифы'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md border border-white/[0.08] bg-[#141418] text-[#A1A1AA] hover:text-white transition-colors"
              title={
                theme === 'dark'
                  ? isEn
                    ? 'Switch to Light Mode'
                    : 'Светлая тема'
                  : isEn
                  ? 'Switch to Dark Mode'
                  : 'Темная тема'
              }
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
            </button>

            <div className="inline-flex items-center rounded-md border border-white/[0.08] bg-[#141418] p-0.5">
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                    locale === loc
                      ? 'bg-indigo-600 text-white'
                      : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </header>
      )}

      {/* =====================================================================
          VIEW 1: MULTI-TIER AUTHENTICATION & WORKSPACE REGISTRATION (БЛОК 3)
      ====================================================================== */}
      {!showcaseOnly && topView === 'auth' ? (
        <main className="my-auto py-6 w-full max-w-lg mx-auto">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121215] shadow-2xl overflow-hidden">
            {/* Top Mode Tabs: Sign In vs Create Workspace */}
            <div className="grid grid-cols-2 border-b border-white/[0.08] bg-[#0D0D10]">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-3.5 px-4 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border-b-2 ${
                  mode === 'signin'
                    ? 'border-indigo-500 text-white bg-[#141418]'
                    : 'border-transparent text-[#8E8E93] hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span className="whitespace-nowrap">{t('auth.tabSignIn')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-3.5 px-4 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border-b-2 ${
                  mode === 'register'
                    ? 'border-indigo-500 text-white bg-[#141418]'
                    : 'border-transparent text-[#8E8E93] hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="whitespace-nowrap">{t('auth.tabRegister')}</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {infoMessage && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{infoMessage}</div>
                </div>
              )}

              {mode === 'signin' ? (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-base font-semibold text-white tracking-tight">
                      {isEn
                        ? 'Sign In to Corporate Workspace'
                        : 'Вход в рабочее пространство компании'}
                    </h1>
                    <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                      {isEn
                        ? 'Choose a convenient verification method: digital pass, login with password, or Telegram 2FA.'
                        : 'Выберите способ авторизации: цифровой инвайт-пропуск, логин с паролем или двухфакторный вход через Telegram.'}
                    </p>
                  </div>

                  {/* 3 Sub-Mode Selector Tabs (БЛОК 3) */}
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.08] bg-[#0D0D10] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('invite');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                        loginMethod === 'invite'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span className="truncate max-w-full">
                        {isEn ? 'Invite Key' : 'Инвайт TC-XXXX'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('credentials');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                        loginMethod === 'credentials'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="truncate max-w-full">
                        {isEn ? 'Login + Password' : 'Логин + Пароль'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('telegram');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                        loginMethod === 'telegram'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="truncate max-w-full">
                        {isEn ? 'Telegram 2FA' : 'Telegram ID / 2FA'}
                      </span>
                    </button>
                  </div>

                  {/* SUB-MODE 1: Вход по Инвайт-ключу (TC-XXXX) — Без пароля */}
                  {loginMethod === 'invite' && (
                    <form onSubmit={handleInviteLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                          {isEn
                            ? 'Personal Employee Invite Key (Passwordless)'
                            : 'Персональный инвайт-ключ сотрудника (Без пароля)'}
                        </label>
                        <input
                          type="text"
                          required
                          value={inviteCodeInput}
                          onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                          placeholder="TC-HSGX"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2.5 text-sm font-semibold tracking-wider text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none uppercase"
                        />
                        <p className="text-[11px] text-[#71717A] mt-1.5">
                          {isEn
                            ? 'Issued by your workspace administrator in the Digital Employee Pass.'
                            : 'Быстрый вход для сотрудников по персональному коду из Цифрового пропуска.'}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors shadow-sm"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t('auth.signingIn')}</span>
                          </>
                        ) : (
                          <>
                            <span>
                              {isEn ? 'Sign In with Invite Key' : 'Войти по инвайт-пропуску'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* SUB-MODE 2: Вход по Логину (Email или ФИО) + Пароль */}
                  {loginMethod === 'credentials' && (
                    <form onSubmit={handleCredentialsLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                          {isEn
                            ? 'Corporate Email or Full Name'
                            : 'Корпоративный Email или ФИО сотрудника'}
                        </label>
                        <input
                          type="text"
                          required
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          placeholder={
                            isEn
                              ? 'name@company.com or Full Name'
                              : 'name@company.com или Иванов Иван'
                          }
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2.5 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                          {isEn ? 'Personal Password' : 'Персональный пароль'}
                        </label>
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder={
                            isEn
                              ? 'Enter password (or set on first login)'
                              : 'Введите пароль (при первом входе он закрепится за вами)'
                          }
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2.5 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                        />
                        <p className="text-[11px] text-[#71717A] mt-1.5">
                          {isEn
                            ? 'If no password is set on your profile yet, the password you enter will be saved automatically.'
                            : 'Если пароль еще не был задан в профиле, введенный пароль автоматически сохранится как ваш постоянный.'}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors shadow-sm"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t('auth.signingIn')}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                              {isEn ? 'Sign In with Password' : 'Войти по логину и паролю'}
                            </span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* SUB-MODE 3: Вход по Telegram ID (Одноразовый 4-значный код в бот ИЛИ Пароль) */}
                  {loginMethod === 'telegram' && (
                    <form onSubmit={handleTelegramLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                          {isEn ? 'Your Telegram Chat ID' : 'Ваш Telegram ID'}
                        </label>
                        <input
                          type="text"
                          required
                          value={telegramIdInput}
                          onChange={(e) => setTelegramIdInput(e.target.value)}
                          placeholder="6460224715"
                          className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2.5 text-sm tabular-nums text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Switch between 4-digit Bot OTP vs Permanent Password */}
                      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/[0.07] bg-[#151519] p-1">
                        <button
                          type="button"
                          onClick={() => setTelegramMethod('otp')}
                          className={`py-1.5 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                            telegramMethod === 'otp'
                              ? 'bg-indigo-600 text-white'
                              : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {isEn ? '4-Digit Code in Bot' : '4-значный код в Telegram'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTelegramMethod('password')}
                          className={`py-1.5 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                            telegramMethod === 'password'
                              ? 'bg-indigo-600 text-white'
                              : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {isEn ? 'Permanent Password' : 'Постоянный пароль'}
                        </button>
                      </div>

                      {telegramMethod === 'otp' ? (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <button
                              type="button"
                              disabled={isSendingOtp || !telegramIdInput.trim()}
                              onClick={() => void handleSendTelegramOtp()}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-indigo-500/35 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              {isSendingOtp ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                              <span>
                                {isEn
                                  ? 'Send 4-Digit Code to Telegram'
                                  : 'Отправить 4-значный код в Telegram-бот'}
                              </span>
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                              {isEn
                                ? '4-Digit Confirmation Code from Telegram'
                                : '4-значный код подтверждения из Telegram'}
                            </label>
                            <input
                              type="text"
                              maxLength={6}
                              value={otpCodeInput}
                              onChange={(e) =>
                                setOtpCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                              }
                              placeholder="1234"
                              className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2.5 text-base font-bold tracking-[0.25em] tabular-nums text-center text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                            />
                            {otpSentToName && (
                              <p className="text-[11px] text-emerald-400 mt-1">
                                {isEn
                                  ? `Code dispatched to ${otpSentToName}`
                                  : `Код отправлен сотруднику: ${otpSentToName}`}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                            {isEn ? 'Account Password' : 'Постоянный пароль сотрудника'}
                          </label>
                          <input
                            type="password"
                            value={telegramPassword}
                            onChange={(e) => setTelegramPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2.5 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors shadow-sm"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t('auth.signingIn')}</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>
                              {telegramMethod === 'otp'
                                ? isEn
                                  ? 'Verify Code & Sign In'
                                  : 'Подтвердить код и войти'
                                : isEn
                                ? 'Sign In with Telegram + Password'
                                : 'Войти по Telegram ID и паролю'}
                            </span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <h1 className="text-base font-semibold text-white tracking-tight">
                      {t('auth.registerTitle')}
                    </h1>
                    <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                      {t('auth.registerDesc')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('auth.companyNameLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={t('auth.companyNamePlaceholder')}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('auth.leaderNameLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      placeholder={t('auth.leaderNamePlaceholder')}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        {t('auth.leaderTitleLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={leaderTitle}
                        onChange={(e) => setLeaderTitle(e.target.value)}
                        placeholder={t('auth.leaderTitlePlaceholder')}
                        className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        {t('auth.leaderDeptLabel')}
                      </label>
                      <input
                        type="text"
                        value={leaderDepartment}
                        onChange={(e) => setLeaderDepartment(e.target.value)}
                        placeholder={t('auth.leaderDeptPlaceholder')}
                        className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        {t('auth.leaderEmailLabel')}
                      </label>
                      <input
                        type="email"
                        required
                        value={leaderEmail}
                        onChange={(e) => setLeaderEmail(e.target.value)}
                        placeholder={t('auth.leaderEmailPlaceholder')}
                        className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        {isEn ? 'Admin Password' : 'Пароль руководителя'}
                      </label>
                      <input
                        type="password"
                        value={leaderPassword}
                        onChange={(e) => setLeaderPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors shadow-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('auth.registering')}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t('auth.registerBtn')}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* =====================================================================
            VIEW 2: MASTERPIECE FULL-BLEED PROMO WEBSITE (БЛОК 2)
            Linear.app / Stripe.com / Raycast Enterprise Aesthetic
        ====================================================================== */
        <div className="relative w-full flex-1">
          {/* Multi-layered Aurora Mesh & Perspective Grid Background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.22),rgba(16,185,129,0.05),transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-32 left-1/2 -translate-x-1/2 w-[920px] h-[420px] rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(99,102,241,0.16)_0deg,rgba(245,158,11,0.10)_140deg,rgba(16,185,129,0.12)_260deg,rgba(99,102,241,0.16)_360deg)] blur-3xl opacity-75"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"
          />

          {/* 1. Sticky Glassmorphic Capsule Navbar */}
          <header className="sticky top-4 z-50 px-4 sm:px-8 pt-4">
            <nav className="max-w-7xl mx-auto rounded-2xl backdrop-blur-2xl bg-white/[0.03] border border-white/[0.08] px-4 sm:px-6 py-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 !text-white flex items-center justify-center font-extrabold text-xs shadow-[0_0_24px_rgba(99,102,241,0.5)] border border-white/20">
                    TC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold !text-white leading-none tracking-tight">
                        TedCloud
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 !text-indigo-200">
                        OS 4.0
                      </span>
                    </div>
                    <div className="text-[11px] !text-zinc-400 mt-0.5">
                      {isEn
                        ? 'Enterprise Operating System & Teddy AI'
                        : 'Операционная система бизнеса и Советник Teddy'}
                    </div>
                  </div>
                </div>

                <div className="hidden xl:flex items-center gap-6 text-xs font-medium !text-zinc-300">
                  <a href="#interactive-demo" className="hover:!text-white transition-colors">
                    {isEn ? '3D Live Demo' : '3D-Демо продукта'}
                  </a>
                  <a href="#features" className="hover:!text-white transition-colors">
                    {isEn ? 'Process Conveyor' : 'Конвейер процессов'}
                  </a>
                  <a href="#industries" className="hover:!text-white transition-colors">
                    {isEn ? 'Industries & ROI' : 'Индустрии и Кейсы'}
                  </a>
                  <a href="#comparison" className="hover:!text-white transition-colors">
                    {isEn ? 'vs Jira & Bitrix24' : 'Сравнение'}
                  </a>
                  <a href="#pricing" className="hover:!text-white transition-colors">
                    {isEn ? 'Pricing' : 'Тарифы'}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Language Switcher */}
                <div className="hidden sm:inline-flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5">
                  {locales.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocale(loc)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                        locale === loc
                          ? 'bg-indigo-600 !text-white'
                          : '!text-zinc-400 hover:!text-white'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>

                {isAuthenticatedUser && onCloseShowcase ? (
                  <button
                    type="button"
                    onClick={onCloseShowcase}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 !text-white text-xs font-semibold shadow-[0_0_25px_rgba(99,102,241,0.45)] border border-indigo-400/30 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>
                      {isEn ? '← Back to Workspace' : '← Вернуться в рабочее пространство'}
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setTopView('auth');
                        setMode('signin');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.09] text-xs font-semibold !text-white transition-colors cursor-pointer"
                    >
                      {isEn ? 'Sign In' : 'Войти в систему'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTopView('auth');
                        setMode('register');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs font-semibold transition-all shadow-[0_0_24px_rgba(99,102,241,0.45)] cursor-pointer"
                    >
                      <span>{isEn ? 'Start Free' : 'Запустить бесплатно'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </nav>
          </header>

          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-20 space-y-20">
            {/* 2. Hero Section + Interactive 3D Product Showcase */}
            <section id="interactive-demo" className="space-y-10">
              {/* Centered High-Impact Hero Copy */}
              <div className="max-w-4xl mx-auto text-center space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-semibold !text-indigo-200 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                  <TeddyAvatar size="xs" />
                  <span>
                    {isEn
                      ? 'Linear Speed · Two-Way Telegram · Built-in CRM & Teddy AI Advisor'
                      : 'Скорость Linear · Двусторонний Telegram · Авто-CRM и Советник Teddy AI'}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold !text-white tracking-tight leading-[1.08]">
                  {isEn ? (
                    <>
                      Run Your Entire Company in{' '}
                      <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-emerald-300 bg-clip-text text-transparent">
                        One Ultra-Fast OS
                      </span>
                    </>
                  ) : (
                    <>
                      Операционная система бизнеса{' '}
                      <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-emerald-300 bg-clip-text text-transparent">
                        сверхзвуковой скорости
                      </span>
                    </>
                  )}
                </h1>

                <p className="max-w-2xl mx-auto text-sm sm:text-base !text-zinc-300 leading-relaxed">
                  {isEn
                    ? 'Replace bloated Jira and Bitrix24 portals with an obsidian-grade workspace. Delegate tasks in 2 seconds, generate print-ready white A4 contracts in 0.1s, track shifts live, and consult Teddy AI.'
                    : 'Замените тяжеловесные Jira и Битрикс24 на кристаллическую операционную систему. Поручения за 2 секунды, авто-генерация договоров А4 за 0.1с, двусторонний мост с Telegram и стратегический советник Teddy AI.'}
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (isAuthenticatedUser && onCloseShowcase) {
                        onCloseShowcase();
                      } else {
                        setTopView('auth');
                        setMode('register');
                      }
                    }}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 !text-white text-xs sm:text-sm font-bold transition-all shadow-[0_0_35px_rgba(99,102,241,0.5)] border border-indigo-400/30 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>
                      {isAuthenticatedUser
                        ? isEn
                          ? '← Return to Active Workspace'
                          : '← Вернуться в рабочее пространство'
                        : isEn
                        ? 'Launch Free Company Workspace (60s)'
                        : 'Запустить контур компании за 60 секунд'}
                    </span>
                  </button>

                  {!isAuthenticatedUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setTopView('auth');
                        setMode('signin');
                      }}
                      className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.09] !text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-indigo-400" />
                      <span>
                        {isEn ? 'Sign In with Employee Pass' : 'Войти по цифровому пропуску'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive 3D Product Showcase Stage */}
              <div className="relative pt-4">
                {/* Floating Glass Badges around the 3D Frame */}
                <div className="hidden lg:flex items-center gap-2.5 absolute -top-3 left-6 z-20 px-3.5 py-2 rounded-xl backdrop-blur-xl bg-[#11131f]/90 border border-indigo-500/35 shadow-2xl animate-float">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold !text-white">
                    {isEn ? '⚡ Core Latency < 40 ms' : '⚡ Отклик ядра < 40 мс'}
                  </span>
                </div>

                <div className="hidden lg:flex items-center gap-2.5 absolute -top-3 right-6 z-20 px-3.5 py-2 rounded-xl backdrop-blur-xl bg-[#11131f]/90 border border-amber-500/35 shadow-2xl animate-float-delayed">
                  <TeddyAvatar size="xs" />
                  <span className="text-xs font-bold !text-white">
                    {isEn
                      ? '🐻 Teddy AI: +38% Deal Win-Rate'
                      : '🐻 Teddy AI: +38% к закрытию сделок'}
                  </span>
                </div>

                <div className="hidden lg:flex items-center gap-2.5 absolute -bottom-4 right-14 z-20 px-3.5 py-2 rounded-xl backdrop-blur-xl bg-[#11131f]/90 border border-emerald-500/35 shadow-2xl animate-float">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold !text-white">
                    {isEn ? '📄 White A4 Contract in 0.1s' : '📄 Договор А4 за 0.1 сек'}
                  </span>
                </div>

                {/* 3D Glassmorphic Application Window */}
                <div className="rounded-3xl border border-white/[0.12] bg-[#0B0C14]/95 backdrop-blur-2xl shadow-[0_30px_100px_-20px_rgba(99,102,241,0.32)] overflow-hidden">
                  {/* Window Top Chrome & 4 Interactive Scene Switchers */}
                  <div className="px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#10121d] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      <span className="ml-2 text-xs font-semibold !text-zinc-300">
                        TedCloud Enterprise Workspace — Live Interactive Scene
                      </span>
                    </div>

                    {/* 4 Interactive Product Showcase Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#090A10] p-1 border border-white/[0.08]">
                      {[
                        {
                          id: 'tasks' as const,
                          label: isEn ? 'Kanban Wall' : 'Канбан-стена',
                          icon: CheckCircle2,
                        },
                        {
                          id: 'crm' as const,
                          label: isEn ? 'CRM & A4 Contracts' : 'Воронка CRM и Договоры',
                          icon: Briefcase,
                        },
                        {
                          id: 'ai' as const,
                          label: isEn ? 'Advisor Teddy AI' : 'Советник Teddy AI',
                          icon: Sparkles,
                        },
                        {
                          id: 'shifts' as const,
                          label: isEn ? '2-Way Telegram Bridge' : 'Двусторонний Telegram-мост',
                          icon: Send,
                        },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const active = activeShowcaseModule === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveShowcaseModule(tab.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              active
                                ? 'bg-indigo-600 !text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]'
                                : '!text-zinc-400 hover:!text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scene Body */}
                  <div className="p-5 sm:p-7 bg-gradient-to-b from-[#0D0F18] to-[#08090F]">
                    {/* TAB 1: KANBAN WALL */}
                    {activeShowcaseModule === 'tasks' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {[
                          {
                            colTitle: isEn ? 'TO DO · SLA QUEUE' : 'К ВЫПОЛНЕНИЮ · ОЧЕРЕДЬ SLA',
                            colCount: 3,
                            accent: 'border-amber-500/30 text-amber-300',
                            cards: [
                              {
                                tag: 'SLA 4h',
                                title: isEn
                                  ? 'Approve Q4 Enterprise Supply Contract'
                                  : 'Согласовать договор поставки и спецификацию Q4',
                                assignee: 'А. Лытнев',
                                dept: isEn ? 'Executive' : 'Дирекция',
                                progress: 35,
                              },
                              {
                                tag: 'CRM Auto',
                                title: isEn
                                  ? 'Prepare Technical Annex for Severstal'
                                  : 'Подготовить ТЗ и смету для ПАО «Северсталь»',
                                assignee: 'М. Волков',
                                dept: isEn ? 'Engineering' : 'Инжиниринг',
                                progress: 20,
                              },
                            ],
                          },
                          {
                            colTitle: isEn ? 'IN PROGRESS · ACTIVE SPRINT' : 'В РАБОТЕ · АКТИВНЫЙ СПРИНТ',
                            colCount: 4,
                            accent: 'border-indigo-500/30 text-indigo-300',
                            cards: [
                              {
                                tag: 'Telegram Sync',
                                title: isEn
                                  ? 'Audit Conversion Funnel & Sign Acts'
                                  : 'Провести аудит конверсии CRM и закрыть акты',
                                assignee: 'Е. Соколова',
                                dept: isEn ? 'Sales' : 'Отдел продаж',
                                progress: 75,
                              },
                              {
                                tag: 'Teddy AI',
                                title: isEn
                                  ? 'Automate Shift Timesheet Export (CSV)'
                                  : 'Выгрузить табель смен сотрудников в CSV для бухгалтерии',
                                assignee: 'И. Громов',
                                dept: 'HR & Ops',
                                progress: 90,
                              },
                            ],
                          },
                          {
                            colTitle: isEn ? 'COMPLETED · VERIFIED' : 'ГОТОВО · ПРОВЕРЕНО',
                            colCount: 18,
                            accent: 'border-emerald-500/30 text-emerald-300',
                            cards: [
                              {
                                tag: '0.1s PDF',
                                title: isEn
                                  ? 'Invoice #TC-409 Sent via Telegram Bridge'
                                  : 'Счет-договор №TC-409 отправлен клиенту в Telegram',
                                assignee: 'Е. Соколова',
                                dept: isEn ? 'Sales' : 'Отдел продаж',
                                progress: 100,
                              },
                              {
                                tag: 'Security 98%',
                                title: isEn
                                  ? 'Multi-Tenant Isolation & 2FA Verified'
                                  : 'Криптографическая изоляция контура и 2FA подтверждены',
                                assignee: 'А. Лытнев',
                                dept: 'SecOps',
                                progress: 100,
                              },
                            ],
                          },
                        ].map((col, cIdx) => (
                          <div
                            key={cIdx}
                            className="rounded-2xl border border-white/[0.08] bg-[#11131E] p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold tracking-wider uppercase !text-zinc-300">
                                {col.colTitle}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${col.accent}`}
                              >
                                {col.colCount}
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {col.cards.map((card, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl border border-white/[0.07] bg-[#171926] p-3.5 space-y-2.5 hover:border-indigo-500/40 transition-all"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-semibold !text-indigo-200">
                                      {card.tag}
                                    </span>
                                    <span className="text-[10px] font-mono !text-emerald-400">
                                      {card.progress}%
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold !text-white leading-snug">
                                    {card.title}
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                                      style={{ width: `${card.progress}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] !text-zinc-400 pt-0.5">
                                    <span className="inline-flex items-center gap-1.5 !text-zinc-200 font-medium">
                                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 !text-white text-[10px] inline-flex items-center justify-center font-bold">
                                        {card.assignee[0]}
                                      </span>
                                      {card.assignee}
                                    </span>
                                    <span>{card.dept}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TAB 2: CRM PIPELINE & A4 CONTRACTS */}
                    {activeShowcaseModule === 'crm' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                        <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#11131E] p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
                            <span className="text-xs font-bold uppercase tracking-wider !text-zinc-200">
                              {isEn
                                ? 'B2B Revenue Pipeline · Auto-Triggers'
                                : 'Воронка B2B-сделок · Авто-триггеры задач'}
                            </span>
                            <span className="text-xs font-bold !text-emerald-400 tabular-nums">
                              4 850 000 ₽
                            </span>
                          </div>
                          {[
                            {
                              client: 'ПАО «Северсталь Инжиниринг»',
                              inn: 'ИНН 7701234560 · КПП 770101001',
                              amount: '2 400 000 ₽',
                              stage: isEn ? 'Contract & Invoice Ready' : 'Договор и Счет сформированы',
                            },
                            {
                              client: 'ООО «Альфа Логистика Групп»',
                              inn: 'ИНН 7810987654 · НДС 20%',
                              amount: '1 650 000 ₽',
                              stage: isEn
                                ? 'Negotiation → Task Assigned to Legal'
                                : 'Переговоры → Авто-задача юристам',
                            },
                            {
                              client: 'АО «Технопром Холдинг»',
                              inn: 'ИНН 5024112233 · Оплачено',
                              amount: '800 000 ₽',
                              stage: isEn ? 'Closed Won · Act Signed' : 'Успешно закрыта · Акт подписан',
                            },
                          ].map((deal, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-white/[0.07] bg-[#171926] p-3.5 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold !text-white truncate">
                                  {deal.client}
                                </div>
                                <div className="text-[11px] !text-zinc-400 mt-0.5">{deal.inn}</div>
                                <div className="text-[11px] !text-indigo-300 mt-1 font-medium">
                                  {deal.stage}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-extrabold !text-emerald-400 tabular-nums">
                                  {deal.amount}
                                </div>
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-indigo-500/20 text-[10px] font-semibold !text-indigo-200">
                                  <FileText className="w-3 h-3" />
                                  PDF A4
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Live White A4 Document Sheet Preview */}
                        <div className="lg:col-span-5 rounded-2xl border border-indigo-500/30 bg-[#141726] p-4 flex flex-col justify-between space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold !text-indigo-200">
                              {isEn
                                ? '1-Click White A4 Generator (0.1s)'
                                : 'Генератор белого листа А4 за 0.1 сек'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold !text-emerald-300">
                              ГОСТ / Печать и Подпись
                            </span>
                          </div>

                          <div className="rounded-xl bg-white text-slate-900 p-4 shadow-xl space-y-2 text-[11px]">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-extrabold text-slate-900 uppercase">
                                ДОГОВОР-СЧЕТ № TC-2026/09
                              </span>
                              <span className="text-[10px] font-semibold text-indigo-700">
                                С НДС 20%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600">
                              Заказчик: ПАО «Северсталь Инжиниринг» (ИНН 7701234560)
                            </div>
                            <div className="rounded border border-slate-200 p-2 bg-slate-50 flex items-center justify-between font-semibold text-slate-900">
                              <span>Лицензия и внедрение контура</span>
                              <span>2 400 000 ₽</span>
                            </div>
                            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                              <span>М.П. Подпись руководителя</span>
                              <span className="font-bold text-emerald-700">✓ Готово к печати</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: ADVISOR TEDDY AI (ROOSEVELT x KACZYNSKI) */}
                    {activeShowcaseModule === 'ai' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                        <div className="lg:col-span-5 rounded-2xl border border-amber-500/30 bg-[#121320] p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <TeddyAvatar size="lg" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-extrabold !text-white">
                                  {isEn ? 'Advisor Teddy AI' : 'Советник Teddy AI'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] font-bold !text-amber-300">
                                  ROOSEVELT × MATH
                                </span>
                              </div>
                              <p className="text-xs !text-zinc-400 mt-0.5">
                                {isEn
                                  ? 'Strategic clarity & anti-bureaucratic systems engineering'
                                  : 'Доктрина Рузвельта и математическая зачистка бюрократии'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs !text-zinc-200 leading-relaxed rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
                            <p className="font-semibold !text-amber-200">
                              «Говори мягко, но держи в руках большую дубинку дисциплины».
                            </p>
                            <p className="!text-zinc-300">
                              Teddy не пишет банальные отписки — он анализирует живую базу компании,
                              находит зависшие сделки, узкие места по SLA и в 1 клик назначает задачи
                              исполнителям.
                            </p>
                          </div>
                        </div>

                        <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#11131E] p-5 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold !text-indigo-300">
                              {isEn
                                ? 'LIVE EXECUTIVE BRIEFING FROM TEDDY'
                                : 'ЖИВОЙ ДОКЛАД СОВЕТНИКА ТЕДДИ РУКОВОДИТЕЛЮ'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-[11px] font-semibold !text-emerald-300">
                              Actionable AI
                            </span>
                          </div>
                          <div className="rounded-xl border border-white/[0.07] bg-[#171926] p-4 space-y-2.5 text-xs !text-zinc-200">
                            <div className="font-bold !text-white">
                              Приветствую! Я Тедди — ваш стратегический советник.
                            </div>
                            <p className="!text-zinc-300 leading-relaxed">
                              Математически: каждое лишнее совещание снижает КПД отдела на 14%. В вашем
                              контуре сейчас 3 высокоприоритетные сделки на 4,85 млн ₽. Предлагаю
                              немедленно дожать договор по «Северстали» и срезать 2 дублирующих
                              согласования.
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <span className="px-3 py-1 rounded-lg bg-indigo-600/30 border border-indigo-400/30 text-[11px] font-semibold !text-indigo-200">
                                ⚡ Декомпозировать спринт в 1 клик
                              </span>
                              <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 text-[11px] font-semibold !text-amber-200">
                                📊 Рассчитать юнит-экономику отдела
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: TWO-WAY TELEGRAM BRIDGE */}
                    {activeShowcaseModule === 'shifts' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#11131E] p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider !text-indigo-300">
                              1. TedCloud Web Workspace
                            </span>
                            <span className="text-[11px] font-semibold !text-emerald-400">
                              Binary Stream 0.2s
                            </span>
                          </div>
                          <div className="rounded-xl border border-white/[0.07] bg-[#171926] p-4 space-y-2">
                            <div className="text-xs font-bold !text-white">
                              Отправка PDF-договора и задачи из веб-чата
                            </div>
                            <p className="text-xs !text-zinc-300">
                              Вы прикрепляете договор, счет или фото в корпоративном чате TedCloud —
                              файл мгновенно улетает сотруднику в Telegram через нативный multipart
                              поток.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-emerald-500/30 bg-[#111820] p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider !text-emerald-300">
                              2. Telegram Smartphone Bot (@TedCloudBot)
                            </span>
                            <span className="text-[11px] font-semibold !text-emerald-400">
                              ✓✓ Delivered
                            </span>
                          </div>
                          <div className="rounded-xl border border-white/[0.08] bg-[#15202B] p-4 space-y-2">
                            <div className="text-xs font-bold !text-white">
                              Мгновенный пуш, смена статуса и 2FA-код
                            </div>
                            <p className="text-xs !text-zinc-200">
                              Сотрудник нажимает «Взять в работу» или «Выполнено» прямо в Telegram,
                              отмечает смену и получает 4-значный 2FA-код входа за 1 секунду.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Animated Process Conveyor (Вместо плоских карточек STEP 01/02/03) */}
            <section id="features" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest !text-indigo-400">
                    {isEn ? 'AUTOMATED EXECUTION CONVEYOR' : 'АВТОМАТИЗИРОВАННЫЙ КОНВЕЙЕР ИСПОЛНЕНИЯ'}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold !text-white tracking-tight mt-1">
                    {isEn
                      ? 'From Chat Message to Signed A4 Contract in 3 Steps'
                      : 'От сообщения в чате до подписанного договора А4 за 3 шага'}
                  </h2>
                </div>
                <span className="text-xs !text-zinc-400">
                  {isEn
                    ? 'Zero context switching · Real-time impulse across contours'
                    : 'Единый световой маршрут данных без потери контекста'}
                </span>
              </div>

              <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Connecting glowing route line on desktop */}
                <div
                  aria-hidden="true"
                  className="hidden md:block pointer-events-none absolute top-1/2 left-[12%] right-[12%] h-[2px] -translate-y-1/2 bg-gradient-to-r from-indigo-500/20 via-indigo-400/70 to-emerald-400/40 animate-shimmer"
                />

                {[
                  {
                    step: '01',
                    badge: isEn ? '< 40ms Response' : 'Отклик < 40 мс',
                    title: isEn
                      ? 'Instant Task & AI Decomposition'
                      : 'Постановка задачи и ИИ-декомпозиция',
                    desc: isEn
                      ? 'Press Enter or convert any chat message into an SLA task with automatic sub-steps generated by Teddy AI.'
                      : 'Нажмите Enter или превратите сообщение чата в поручение с дедлайном и авто-декомпозицией от советника Teddy AI.',
                    preview: (
                      <div className="rounded-xl border border-white/[0.08] bg-[#0B0D16] p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold !text-white">
                            + В задачу: Согласовать смету
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 !text-indigo-300 text-[10px]">
                            SLA 18:00
                          </span>
                        </div>
                        <div className="flex items-center gap-2 !text-emerald-400 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Teddy AI создал 4 подпункта чек-листа</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    step: '02',
                    badge: isEn ? '2-Way Telegram' : 'Двусторонний Telegram',
                    title: isEn
                      ? 'Native Push & Binary File Delivery'
                      : 'Мгновенный пуш и доставка файлов в Telegram',
                    desc: isEn
                      ? 'Assignees receive tasks and attached PDFs straight in Telegram and update progress in 1 tap from their phone.'
                      : 'Исполнитель за 0.2с получает пуш и PDF-вложения в Telegram, меняет статус в 1 тап или отвечает голосом/текстом.',
                    preview: (
                      <div className="rounded-xl border border-white/[0.08] bg-[#0B0D16] p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold !text-indigo-300">@TedCloudBot</span>
                          <span className="text-[10px] !text-emerald-400">✓✓ Доставлено</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-white/[0.06] !text-zinc-200 text-[10px]">
                            📎 Спецификация_Q4.pdf
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 !text-emerald-300 text-[10px]">
                            ✓ Принято в работу
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    step: '03',
                    badge: isEn ? 'A4 PDF in 0.1s' : 'Белый А4 за 0.1 сек',
                    title: isEn
                      ? 'Auto-Contract, Invoice & Shift Analytics'
                      : 'Авто-договор А4, счет с НДС и юнит-экономика',
                    desc: isEn
                      ? 'Move the deal in CRM and print a white A4 contract or VAT invoice while executive radar tracks margin.'
                      : 'Переведите сделку на следующий этап и распечатайте готовый белый лист А4 (Договор, Счет с НДС или Акт) в 1 клик.',
                    preview: (
                      <div className="rounded-xl border border-white/[0.08] bg-[#0B0D16] p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold !text-white">Договор №TC-2026</span>
                          <span className="font-bold !text-emerald-400">2 400 000 ₽</span>
                        </div>
                        <div className="text-[10px] !text-zinc-400">
                          Авто-заполнение по ИНН · Печать в PDF за 0.1с
                        </div>
                      </div>
                    ),
                  },
                ].map((node) => (
                  <div
                    key={node.step}
                    className="relative z-10 rounded-2xl border border-white/[0.09] bg-[#10121C]/95 p-6 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)] transition-all duration-300"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-xs font-extrabold !text-indigo-300 tabular-nums">
                          STEP {node.step}
                        </span>
                        <span className="text-[11px] font-semibold !text-emerald-400">
                          {node.badge}
                        </span>
                      </div>
                      <h3 className="text-base font-bold !text-white">{node.title}</h3>
                      <p className="text-xs !text-zinc-300 leading-relaxed">{node.desc}</p>
                    </div>
                    {node.preview}
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Секция «Индустрии и результаты внедрения» (БЛОК 2.5) */}
            <section id="industries" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest !text-emerald-400">
                    {isEn ? 'PROVEN ENTERPRISE IMPACT' : 'ИНДУСТРИИ И РЕЗУЛЬТАТЫ ВНЕДРЕНИЯ'}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold !text-white tracking-tight mt-1">
                    {isEn
                      ? 'Measurable Efficiency Across Key B2B Sectors'
                      : 'Измеримый рост скорости и маржинальности в реальном секторе'}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold !text-indigo-300">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>
                    {isEn ? 'Verified across 4 core industries' : 'Подтверждено в 4 ключевых отраслях'}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  {
                    sector: isEn
                      ? 'IT Companies & Digital Agencies'
                      : 'IT-компании и Digital-агентства',
                    metric: '-42%',
                    metricLabel: isEn ? 'fewer missed deadlines' : 'снижение просрочек по спринтам',
                    desc: isEn
                      ? 'Instant task creation from client chats, transparent shift tracking, and zero Jira lag.'
                      : 'Мгновенная постановка задач из переписки, контроль загрузки разработчиков и 0 секунд ожидания.',
                    accent: 'from-indigo-500/20 to-violet-500/5 border-indigo-500/30',
                  },
                  {
                    sector: isEn
                      ? 'Engineering & Construction Bureaus'
                      : 'Проектные и строительные бюро',
                    metric: '60 сек',
                    metricLabel: isEn ? 'spec & contract approval' : 'согласование смет и договоров',
                    desc: isEn
                      ? 'Field engineers receive drawings and PDF specs directly in Telegram and report shift completion.'
                      : 'Главные инженеры получают чертежи и PDF-акты прямо в Telegram на объекте и закрывают смены в 1 клик.',
                    accent: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/30',
                  },
                  {
                    sector: isEn
                      ? 'B2B Sales & Wholesale Distribution'
                      : 'Отделы B2B-продаж и дистрибуции',
                    metric: '+38%',
                    metricLabel: isEn ? 'conversion to paid invoice' : 'рост конверсии в оплату счета',
                    desc: isEn
                      ? 'Auto-generated white A4 contracts with VAT 20% and automated follow-up tasks from Teddy AI.'
                      : 'Авто-генерация договоров и счетов А4 с НДС 20% за 0.1с + жесткий контроль дожима сделок от Teddy AI.',
                    accent: 'from-amber-500/20 to-orange-500/5 border-amber-500/30',
                  },
                  {
                    sector: isEn
                      ? 'Logistics & Manufacturing Plants'
                      : 'Логистика и производственные холдинги',
                    metric: '100%',
                    metricLabel: isEn ? 'shift discipline & 2FA' : 'прозрачность табеля смен и 2FA',
                    desc: isEn
                      ? 'Real-time attendance roster, cryptographic multi-tenant isolation, and 7-contour Excel export.'
                      : 'Живое табло присутствия на смене, криптографическая изоляция контура и выгрузка 7 реестров в Excel.',
                    accent: 'from-sky-500/20 to-indigo-500/5 border-sky-500/30',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border bg-gradient-to-b ${item.accent} bg-[#10121C] p-5 flex flex-col justify-between space-y-4 hover:shadow-[0_0_35px_-10px_rgba(99,102,241,0.3)] transition-all`}
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-bold !text-zinc-200">{item.sector}</div>
                      <div className="pt-1">
                        <div className="text-3xl font-extrabold !text-white tracking-tight tabular-nums">
                          {item.metric}
                        </div>
                        <div className="text-[11px] font-semibold !text-emerald-300 mt-0.5">
                          {item.metricLabel}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs !text-zinc-300 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Comparison vs Jira & Bitrix24 */}
            <section
              id="comparison"
              className="rounded-3xl border border-white/[0.09] bg-[#10121C]/95 p-6 sm:p-8 space-y-5 shadow-2xl"
            >
              <h2 className="text-lg sm:text-xl font-extrabold !text-white border-b border-white/[0.08] pb-3.5">
                {isEn
                  ? 'Why High-Performing Teams Switch from Jira & Bitrix24 to TedCloud'
                  : 'Почему компании переходят с тяжеловесных Jira и Битрикс24 на TedCloud'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {[
                  {
                    title: isEn
                      ? 'Onboarding in 60 seconds via Digital Pass'
                      : 'Онбординг за 60 секунд по Цифровому пропуску',
                    vs: isEn
                      ? 'vs weeks of complex setup and costly integrators in Jira / Bitrix24'
                      : 'вместо недель сложного внедрения и платных интеграторов в Битрикс24',
                  },
                  {
                    title: isEn
                      ? 'Native 2-Way Telegram Sync & File Delivery'
                      : 'Двусторонний Telegram-бот и доставка PDF из коробки',
                    vs: isEn
                      ? 'vs paid third-party plugins that constantly disconnect'
                      : 'вместо платных сторонних коннекторов, которые постоянно отваливаются',
                  },
                  {
                    title: isEn
                      ? 'Tasks + CRM + Shifts + Teddy AI in One Window'
                      : 'Задачи + CRM + Табель смен + Советник Teddy в одном окне',
                    vs: isEn
                      ? 'vs overloaded portals with 50+ unused menu tabs'
                      : 'вместо перегруженных порталов с десятками ненужных вкладок',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/[0.07] bg-[#161826] p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2 font-bold !text-white">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-xs !text-zinc-400 pl-6">{item.vs}</p>
                  </div>
                ))}
              </div>
            </section>

          {/* 5. Interactive Pricing Calculator + Unified Pricing Matrix (PRICING_PLANS) */}
          <section id="pricing" className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111115] p-6 space-y-5 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isEn
                      ? 'Transparent Corporate Pricing & ROI Calculator'
                      : 'Единая тарифная сетка и интерактивный калькулятор'}
                  </h2>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    {isEn
                      ? 'Fixed predictable pricing per company workspace — no hidden per-seat surcharges'
                      : 'Фиксированная стоимость за всё пространство компании без доплат за каждого пользователя'}
                  </p>
                </div>

                {/* Billing Cycle Toggle (Monthly / Yearly -20%) + Currency Switcher */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center rounded-xl bg-[#16161B] p-1 border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setPricingCycle('monthly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        pricingCycle === 'monthly'
                          ? 'bg-indigo-600 text-white'
                          : 'text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      {isEn ? 'Monthly' : 'Помесячно'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingCycle('yearly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        pricingCycle === 'yearly'
                          ? 'bg-indigo-600 text-white'
                          : 'text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <span>{isEn ? 'Yearly' : 'На год'}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        -20%
                      </span>
                    </button>
                  </div>

                  <div className="inline-flex items-center rounded-xl bg-[#16161B] p-1 border border-white/[0.08]">
                    {(['RUB', 'USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setPricingCurrency(curr)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          pricingCurrency === curr
                            ? 'bg-white/15 text-white'
                            : 'text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Team Size Slider */}
              {(() => {
                const recommendedTier: SubscriptionPlanTier =
                  employeeSliderCount <= 5
                    ? 'Trial'
                    : employeeSliderCount <= 50
                    ? 'Business'
                    : 'Enterprise';
                const recPrice = getPlanPrice(recommendedTier, pricingCurrency, pricingCycle);
                const sym = pricingCurrency === 'RUB' ? '₽' : pricingCurrency === 'EUR' ? '€' : '$';
                const formattedPrice =
                  pricingCurrency === 'RUB'
                    ? `${recPrice.toLocaleString('ru-RU')} ${sym}`
                    : `${sym}${recPrice.toLocaleString('en-US')}`;

                return (
                  <div className="rounded-xl border border-white/[0.07] bg-[#16161C] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#A1A1AA] font-medium">
                          {isEn ? 'Company Headcount:' : 'Численность вашей команды:'}
                        </span>
                        <span className="text-sm font-bold text-white tabular-nums">
                          {employeeSliderCount >= 200
                            ? isEn
                              ? '200+ employees'
                              : '200+ сотрудников'
                            : isEn
                            ? `${employeeSliderCount} employees`
                            : `${employeeSliderCount} сотр.`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={200}
                        value={employeeSliderCount}
                        onChange={(e) => setEmployeeSliderCount(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-[#71717A] tabular-nums">
                        <span>1–5 (Trial)</span>
                        <span>6–50 (Business)</span>
                        <span>51–200+ (Enterprise)</span>
                      </div>
                    </div>

                    <div className="md:border-l border-white/[0.08] md:pl-6 flex items-center justify-between md:justify-end gap-4 shrink-0">
                      <div>
                        <div className="text-[11px] text-[#8E8E93]">
                          {isEn ? 'Recommended Plan:' : 'Рекомендуемый тариф:'}
                        </div>
                        <div className="text-base font-bold text-indigo-400">
                          {recommendedTier} · {formattedPrice}{' '}
                          <span className="text-xs font-normal text-[#8E8E93]">
                            / {isEn ? 'mo' : 'мес'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (showcaseOnly && onSelectPlanFromWorkspace) {
                            onSelectPlanFromWorkspace(
                              recommendedTier,
                              pricingCycle,
                              pricingCurrency
                            );
                          } else if (showcaseOnly && onCloseShowcase) {
                            onCloseShowcase();
                          } else {
                            setTopView('auth');
                            setMode('register');
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                      >
                        {isEn ? 'Select' : 'Выбрать'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 3 Unified Pricing Cards (Trial / Business / Enterprise) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(['Trial', 'Business', 'Enterprise'] as SubscriptionPlanTier[]).map((tierKey) => {
                  const planSpec = PRICING_PLANS?.[tierKey] ?? PRICING_PLANS.Trial;
                  const isHighlighted = tierKey === 'Business';
                  const displayMonthlyPrice = getPlanPrice(
                    tierKey,
                    pricingCurrency,
                    pricingCycle
                  );
                  const sym =
                    pricingCurrency === 'RUB' ? '₽' : pricingCurrency === 'EUR' ? '€' : '$';
                  const priceLabel =
                    pricingCurrency === 'RUB'
                      ? `${displayMonthlyPrice.toLocaleString('ru-RU')} ${sym} / ${
                          isEn ? 'mo' : 'мес'
                        }`
                      : `${sym}${displayMonthlyPrice.toLocaleString('en-US')} / ${
                          isEn ? 'mo' : 'мес'
                        }`;

                  const features =
                    tierKey === 'Trial'
                      ? isEn
                        ? [
                            'Up to 5 employees included',
                            'Kanban, List & Timeline Tasks',
                            'Corporate Chat & Telegram Sync',
                            'Live Shift Tracker & Timesheets',
                          ]
                        : [
                            'До 5 сотрудников включено',
                            'Задачи: Канбан, Список и Таймлайн',
                            'Корпоративный чат и Telegram-бот',
                            'Учет смен и табель рабочего времени',
                          ]
                      : tierKey === 'Business'
                      ? isEn
                        ? [
                            'Up to 50 employees included',
                            'Full CRM Pipeline & Auto-Triggers',
                            '1-Click White A4 Contract & Invoice PDF',
                            'Client Deal Rooms & RBAC Matrix',
                            'Advisor Teddy AI (Roosevelt × Math)',
                          ]
                        : [
                            'До 50 сотрудников включено',
                            'Полная CRM-воронка и Авто-триггеры',
                            'Генератор договоров и счетов А4 в 1 клик',
                            'Внешние комнаты сделок и RBAC-матрица',
                            'Советник руководителя Teddy AI (Рузвельт × Качинский)',
                          ]
                      : isEn
                      ? [
                          'Unlimited employees & departments',
                          'Executive Unit Economics Radar',
                          '7-Contour Master CSV / Excel Export',
                          'Dedicated 99.9% SLA & Security Audit',
                          'Corporate SSO & Telegram 2FA',
                        ]
                      : [
                          'Безлимит сотрудников и отделов',
                          'Радар юнит-экономики руководителя',
                          'Полный экспорт 7 контуров (CSV / Excel)',
                          'Выделенный контур и SLA 99.9%',
                          'Журнал безопасности и Telegram 2FA',
                        ];

                  return (
                    <div
                      key={tierKey}
                      className={`rounded-2xl border p-6 flex flex-col justify-between space-y-5 transition-all ${
                        isHighlighted
                          ? 'tc-pricing-featured border-indigo-500 bg-[#151525] !text-white shadow-2xl'
                          : 'border-white/[0.08] bg-[#111115]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-bold ${
                              isHighlighted ? '!text-white' : 'text-white'
                            }`}
                          >
                            {isEn
                              ? planSpec?.titleEn ?? planSpec?.nameEn ?? tierKey
                              : planSpec?.titleRu ?? planSpec?.nameRu ?? tierKey}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isHighlighted
                                ? 'bg-indigo-600 !text-white'
                                : 'bg-white/[0.06] text-[#A1A1AA]'
                            }`}
                          >
                            {isEn ? planSpec?.badgeEn : planSpec?.badgeRu}
                          </span>
                        </div>

                        <div
                          className={`text-2xl font-bold tabular-nums ${
                            isHighlighted ? '!text-white' : 'text-white'
                          }`}
                        >
                          {priceLabel}
                        </div>

                        <div
                          className={`text-xs ${
                            isHighlighted ? '!text-indigo-200' : 'text-[#8E8E93]'
                          }`}
                        >
                          {isEn
                            ? planSpec?.seatsLabelEn ?? planSpec?.maxEmployeesLabelEn
                            : planSpec?.seatsLabelRu ?? planSpec?.maxEmployeesLabelRu}
                          {pricingCycle === 'yearly' && tierKey !== 'Trial'
                            ? isEn
                              ? ' · Billed annually (-20%)'
                              : ' · При оплате на год (-20%)'
                            : ''}
                        </div>

                        <ul className="space-y-2 pt-2 border-t border-white/[0.08]">
                          {features.map((f, i) => (
                            <li
                              key={i}
                              className={`flex items-center gap-2 text-xs ${
                                isHighlighted ? '!text-white' : 'text-zinc-200'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (showcaseOnly && onSelectPlanFromWorkspace) {
                            onSelectPlanFromWorkspace(tierKey, pricingCycle, pricingCurrency);
                          } else if (showcaseOnly && onCloseShowcase) {
                            onCloseShowcase();
                          } else {
                            setTopView('auth');
                            setMode('register');
                          }
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors ${
                          isHighlighted
                            ? 'bg-indigo-600 hover:bg-indigo-500 !text-white shadow-md'
                            : 'border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white'
                        }`}
                      >
                        {isEn ? `Start with ${tierKey}` : `Выбрать тариф ${tierKey}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 6. Desktop & Mobile App Banner (macOS / Windows / iOS / Android) */}
          <section
            id="desktop-app"
            className="rounded-2xl border border-white/[0.08] bg-[#111115] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Monitor className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {isEn
                    ? 'TedCloud Desktop & Mobile App (macOS · Windows · iOS · Android)'
                    : 'Приложение TedCloud для macOS, Windows и смартфонов'}
                </h3>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  {isEn
                    ? 'Install TedCloud directly to your macOS Dock or Windows taskbar with Cmd+K Spotlight and instant Telegram sync.'
                    : 'Работайте в выделенном окне на macOS (Apple Silicon / Intel) и Windows 11 с горячими клавишами Cmd+K и мгновенной синхронизацией с Telegram.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#17171C] text-xs font-medium text-zinc-200">
                <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                <span>macOS & Windows</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#17171C] text-xs font-medium text-zinc-200">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Telegram Native</span>
              </span>
            </div>
          </section>
          </main>
        </div>
      )}

      <footer className="max-w-6xl w-full mx-auto text-center text-[11px] text-[#71717A] py-4">
        TedCloud Enterprise Platform — {t('auth.subtitle')}
      </footer>
    </div>
  );
};
