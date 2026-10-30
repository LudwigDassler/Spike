import React, { useState } from 'react';
import {
  Building2,
  KeyRound,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
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
} from 'lucide-react';
import { Company, CurrencyCode, OrganizationNode, SubscriptionPlanTier } from '../types/database';
import { useLocale, SupportedLocale } from '../i18n/LocaleContext';
import { formatError, getPlanPrice, PRICING_PLANS } from '../utils/enterpriseLogic';

interface AuthGateProps {
  existingNodes: OrganizationNode[];
  existingCompany: Company | null;
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
  existingCompany,
  onAuthenticated,
  showcaseOnly = false,
  onCloseShowcase,
  onSelectPlanFromWorkspace,
}) => {
  const { locale, setLocale, theme, toggleTheme, t } = useLocale();
  const isEn = locale === 'en';

  const [topView, setTopView] = useState<TopViewMode>(showcaseOnly ? 'showcase' : 'auth');
  const [mode, setMode] = useState<AuthTabMode>(
    existingNodes.length === 0 ? 'register' : 'signin'
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
      const matchedNode = existingNodes.find(
        (node) => String(node.invite_code || '').trim().toLowerCase() === q
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
        existingCompany && existingCompany.id === matchedNode.company_id
          ? existingCompany
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

  return (
    <div
      className={`${
        showcaseOnly ? 'min-h-full' : 'min-h-screen'
      } bg-[#0b0d13] text-[#EDEDED] font-sans antialiased flex flex-col justify-between p-4 sm:p-6`}
    >
      {/* Top Bar: Brand, Top Switcher («Авторизация» / «О платформе и Тарифы»), Theme & Language */}
      {!showcaseOnly && (
        <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-sm">
              TC
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">TedCloud</span>
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
            VIEW 2: HIGH-CONVERTING STANDALONE MARKETING WEBSITE (БЛОК 5)
            Linear.app / Stripe.com / Attio Enterprise Standard
        ====================================================================== */
        <main className="my-auto py-4 w-full max-w-6xl mx-auto space-y-10">
          {/* 1. Dedicated Sticky Marketing Navigation Bar */}
          <nav className="sticky top-3 z-40 rounded-2xl border border-white/[0.1] bg-[#111115]/95 backdrop-blur-xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  TC
                </div>
                <div>
                  <div className="text-sm font-bold text-white leading-none tracking-tight">
                    TedCloud OS
                  </div>
                  <div className="text-[10px] text-[#8E8E93] mt-0.5">
                    {isEn ? 'Enterprise B2B Platform' : 'Операционная система бизнеса'}
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-5 text-xs font-medium text-[#A1A1AA]">
                <a href="#features" className="hover:text-white transition-colors">
                  {isEn ? 'Features' : 'Возможности'}
                </a>
                <a href="#interactive-demo" className="hover:text-white transition-colors">
                  {isEn ? 'Interactive Demo' : 'Интерактивное демо'}
                </a>
                <a href="#comparison" className="hover:text-white transition-colors">
                  {isEn ? 'vs Jira & Bitrix24' : 'Сравнение с Jira и Битрикс24'}
                </a>
                <a href="#pricing" className="hover:text-white transition-colors">
                  {isEn ? 'Pricing' : 'Тарифы'}
                </a>
                <a href="#desktop-app" className="hover:text-white transition-colors">
                  Desktop App
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showcaseOnly && onCloseShowcase ? (
                <button
                  type="button"
                  onClick={onCloseShowcase}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Back to Workspace' : 'Вернуться в систему'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setTopView('auth');
                      setMode('signin');
                    }}
                    className="px-3.5 py-2 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white transition-colors"
                  >
                    {isEn ? 'Sign In' : 'Войти'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTopView('auth');
                      setMode('register');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    <span>{isEn ? 'Start Free' : 'Запустить бесплатно'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </nav>

          {/* 2. Hero Section with Live Visual Mockup */}
          <section
            id="interactive-demo"
            className="rounded-3xl border border-white/[0.09] bg-[#111115] p-6 sm:p-10 shadow-2xl space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {isEn
                      ? 'Linear Speed · Two-Way Telegram · Built-in CRM & Shifts'
                      : 'Скорость Linear · Двусторонний Telegram · CRM и Табель смен'}
                  </span>
                </span>

                <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-[1.15]">
                  {isEn ? (
                    <>
                      Run Your Entire Company in{' '}
                      <span className="text-indigo-400">One Ultra-Fast OS</span>
                    </>
                  ) : (
                    <>
                      Управляйте поручениями, продажами и сменами в{' '}
                      <span className="text-indigo-400">едином контуре</span>
                    </>
                  )}
                </h1>

                <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                  {isEn
                    ? 'Replace bloated Jira and Bitrix24 portals with a precision workspace. Instant task delegation, automated CRM deal pipelines, real-time employee shift attendance, and native 2-way Telegram synchronization.'
                    : 'Замените перегруженные Jira и Битрикс24 на быструю операционную систему. Мгновенная постановка задач за 2 секунды, авто-воронка CRM с генерацией договоров и счетов, живой учет смен и двусторонний Telegram-бот.'}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (showcaseOnly && onCloseShowcase) {
                        onCloseShowcase();
                      } else {
                        setTopView('auth');
                        setMode('register');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>
                      {showcaseOnly
                        ? isEn
                          ? 'Return to Active Workspace'
                          : 'Продолжить работу в пространстве'
                        : isEn
                        ? 'Launch Free Company Workspace'
                        : 'Запустить бесплатно за 60 секунд'}
                    </span>
                  </button>
                  {!showcaseOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setTopView('auth');
                        setMode('signin');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-indigo-400" />
                      <span>
                        {isEn ? 'Sign In with Employee Pass' : 'Войти по пропуску сотрудника'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] text-[#8E8E93]">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isEn ? 'Free up to 5 employees' : 'Бесплатно до 5 сотрудников'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isEn ? 'Telegram 2FA & Push Sync' : 'Синхронизация с Telegram за 1 клик'}</span>
                  </span>
                </div>
              </div>

              {/* Live Interactive UI Preview Window */}
              <div className="lg:col-span-6 rounded-2xl border border-white/[0.1] bg-[#16161C] p-4 shadow-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-[11px] font-semibold text-[#A1A1AA]">
                      TedCloud Live Preview
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#111115] p-1 border border-white/[0.07]">
                    {[
                      {
                        id: 'tasks' as const,
                        label: isEn ? 'Kanban' : 'Канбан',
                        icon: CheckCircle2,
                      },
                      {
                        id: 'crm' as const,
                        label: isEn ? 'CRM Deal' : 'Воронка CRM',
                        icon: Briefcase,
                      },
                      {
                        id: 'shifts' as const,
                        label: isEn ? 'Shifts' : 'Смены',
                        icon: Clock,
                      },
                      {
                        id: 'ai' as const,
                        label: 'Telegram',
                        icon: Send,
                      },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveShowcaseModule(tab.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            activeShowcaseModule === tab.id
                              ? 'bg-indigo-600 text-white'
                              : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Interactive Mockup Content */}
                {activeShowcaseModule === 'tasks' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] px-1">
                      <span>{isEn ? 'ACTIVE SPRINT · SLA CONTROL' : 'АКТИВНЫЙ СПРИНТ · КОНТРОЛЬ ПОРУЧЕНИЙ'}</span>
                      <span className="text-emerald-400 font-semibold">● Live Sync</span>
                    </div>
                    {[
                      {
                        title: isEn
                          ? 'Prepare Enterprise Q4 Contract & SLA Annex'
                          : 'Согласовать договор поставки и спецификацию Q4',
                        assignee: 'А. Лытнев',
                        dept: isEn ? 'Legal' : 'Юр. отдел',
                        status: isEn ? 'In Progress' : 'В работе',
                        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                      },
                      {
                        title: isEn
                          ? 'Deploy Telegram Webhook & 2FA Passwords'
                          : 'Провести аудит конверсии CRM и закрыть акты',
                        assignee: 'Е. Соколова',
                        dept: isEn ? 'Sales' : 'Отдел продаж',
                        status: isEn ? 'Approved' : 'Согласовано',
                        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      },
                      {
                        title: isEn
                          ? 'Export Monthly Payroll Shift Timesheet (CSV)'
                          : 'Выгрузить табель смен сотрудников в CSV для бухгалтерии',
                        assignee: 'М. Волков',
                        dept: 'HR & Ops',
                        status: isEn ? 'Done' : 'Выполнено',
                        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      },
                    ].map((card, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/[0.08] bg-[#111115] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{card.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8E8E93]">
                            <span className="inline-flex items-center gap-1 text-zinc-200 font-medium">
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] inline-flex items-center justify-center font-bold">
                                {card.assignee[0]}
                              </span>
                              {card.assignee}
                            </span>
                            <span>·</span>
                            <span>{card.dept}</span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${card.badgeClass}`}
                        >
                          {card.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeShowcaseModule === 'crm' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] px-1">
                      <span>{isEn ? 'B2B REVENUE PIPELINE' : 'ВОРОНКА B2B ПРОДАЖ И ДОКУМЕНТЫ'}</span>
                      <span className="text-indigo-400 font-semibold">4 850 000 ₽</span>
                    </div>
                    {[
                      {
                        client: 'ПАО «Северсталь Инжиниринг»',
                        value: '2 400 000 ₽',
                        stage: isEn ? 'Contract & Invoice Ready' : 'Договор и Счет сформированы',
                        action: isEn ? 'PDF A4 in 0.1s' : 'Печать PDF A4 за 0.1с',
                      },
                      {
                        client: 'ООО «Альфа Логистика Групп»',
                        value: '1 650 000 ₽',
                        stage: isEn ? 'Negotiation → Legal Task Auto-Created' : 'Переговоры → Авто-задача юристам',
                        action: isEn ? 'Deal Room Active' : 'Витрина клиента',
                      },
                      {
                        client: 'АО «Технопром Холдинг»',
                        value: '800 000 ₽',
                        stage: isEn ? 'Closed Won · Paid' : 'Успешно закрыта · Оплачено',
                        action: isEn ? 'Act Signed' : 'Акт подписан',
                      },
                    ].map((deal, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/[0.08] bg-[#111115] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{deal.client}</div>
                          <div className="text-[11px] text-[#8E8E93] mt-0.5 truncate">{deal.stage}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-emerald-400 tabular-nums">{deal.value}</div>
                          <div className="text-[10px] text-indigo-300 mt-0.5">{deal.action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeShowcaseModule === 'shifts' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] px-1">
                      <span>{isEn ? 'LIVE ATTENDANCE ROSTER' : 'ТАБЛО СМЕН В РЕАЛЬНОМ ВРЕМЕНИ'}</span>
                      <span className="text-emerald-400 font-semibold">
                        {isEn ? '18 Online · 2 Break' : '18 на смене · 2 перерыв'}
                      </span>
                    </div>
                    {[
                      {
                        name: 'Лытнев Артем Олегович',
                        role: isEn ? 'Chief Executive' : 'Генеральный директор',
                        status: isEn ? 'On Shift · 06h 42m' : 'На смене · 06ч 42м',
                        dot: 'bg-emerald-400',
                      },
                      {
                        name: 'Соколова Елена Викторовна',
                        role: isEn ? 'Head of Sales' : 'Руководитель отдела продаж',
                        status: isEn ? 'On Shift · 05h 18m' : 'На смене · 05ч 18м',
                        dot: 'bg-emerald-400',
                      },
                      {
                        name: 'Волков Максим Игоревич',
                        role: isEn ? 'Lead Engineer' : 'Ведущий инженер',
                        status: isEn ? 'Break · 14m' : 'Перерыв · 14м',
                        dot: 'bg-amber-400',
                      },
                    ].map((emp, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/[0.08] bg-[#111115] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${emp.dot}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{emp.name}</div>
                            <div className="text-[11px] text-[#8E8E93] truncate">{emp.role}</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-[11px] font-semibold text-zinc-200 tabular-nums shrink-0">
                          {emp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeShowcaseModule === 'ai' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] px-1">
                      <span>{isEn ? 'TELEGRAM BOT & FILE BRIDGE' : 'СИНХРОНИЗАЦИЯ ЧАТА И ФАЙЛОВ С TELEGRAM'}</span>
                      <span className="text-indigo-400 font-semibold">@TedCloudBot</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-[#111115] p-3 space-y-2">
                      <div className="text-[11px] text-indigo-300 font-semibold">
                        {isEn ? 'Web Chat ➔ Telegram Delivery (0.2s)' : 'Веб-чат ➔ Мгновенная доставка в Telegram (0.2с)'}
                      </div>
                      <p className="text-xs text-zinc-200">
                        {isEn
                          ? 'Attached PDF contracts, invoices, and photos are delivered directly to employee Telegram chats via native binary stream.'
                          : 'Прикрепленные PDF-договоры, счета и изображения мгновенно приходят сотруднику прямо в Telegram без потери качества.'}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                          {isEn ? '✓✓ Delivered to Telegram' : '✓✓ Доставлено в Telegram'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-semibold text-indigo-300">
                          {isEn ? '1-Click Message → Task' : '1 клик: Сообщение → Задача'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. Visual Workflow Bento Cards (3-Step Pipeline) */}
          <section id="features" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {isEn
                    ? 'End-to-End Corporate Execution Flow'
                    : 'Бесшовный цикл работы компании без потери контекста'}
                </h2>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  {isEn
                    ? 'From task creation to Telegram execution and automated B2B document generation'
                    : 'От постановки задачи за 2 секунды до ответа из Telegram и авто-генерации договора'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: '01',
                  title: isEn
                    ? '1. Create Task in 2 Seconds'
                    : '1. Постановка задачи за 2 сек',
                  desc: isEn
                    ? 'Type a task inline or convert any chat message into an assigned task with SLA deadline and AI checklist decomposition.'
                    : 'Создавайте поручения прямо в строке по Enter или превращайте любое сообщение чата в задачу с дедлайном и ИИ-декомпозицией на чек-лист.',
                  metric: isEn ? '< 50ms UI Response' : 'Мгновенный отклик < 50 мс',
                },
                {
                  step: '02',
                  title: isEn
                    ? '2. Instant Push & Reply in Telegram'
                    : '2. Мгновенный пуш и ответ в Telegram',
                  desc: isEn
                    ? 'The assignee receives the task and attached files in Telegram, updates status in 1 tap, or replies straight from their phone.'
                    : 'Сотрудник мгновенно получает пуш и прикрепленные PDF-файлы в Telegram, меняет статус в 1 клик или отвечает прямо со смартфона.',
                  metric: isEn ? '2-Way Native Sync' : 'Двусторонняя синхронизация',
                },
                {
                  step: '03',
                  title: isEn
                    ? '3. Auto-Contract & Invoice from Deal'
                    : '3. Авто-генерация договора и счета из сделки',
                  desc: isEn
                    ? 'Move a CRM deal to Negotiation and generate a print-ready white A4 Contract, Invoice, or Act in 0.1 seconds.'
                    : 'Переведите сделку в CRM на следующий этап и распечатайте готовый белый лист А4 (Договор, Счет с НДС или Акт) за 0.1 секунды.',
                  metric: isEn ? 'Instant PDF A4 Print' : 'Печать А4 в PDF за 0.1 сек',
                },
              ].map((bento) => (
                <div
                  key={bento.step}
                  className="rounded-2xl border border-white/[0.08] bg-[#111115] p-6 flex flex-col justify-between space-y-4 shadow-xl"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-xs font-bold text-indigo-400 tabular-nums">
                        STEP {bento.step}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {bento.metric}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{bento.title}</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">{bento.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Comparison vs Jira & Bitrix24 */}
          <section
            id="comparison"
            className="rounded-2xl border border-white/[0.08] bg-[#111115] p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-base font-bold text-white border-b border-white/[0.07] pb-3">
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
                    ? 'vs weeks of complex setup and training in Jira / Bitrix24'
                    : 'вместо недель сложного внедрения и обучения в Битрикс24',
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
                    ? 'Tasks + CRM + Shifts + Vault in One Clean Window'
                    : 'Задачи + CRM + Табель смен + Регламенты в одном окне',
                  vs: isEn
                    ? 'vs overloaded portals with 50+ unused menu tabs'
                    : 'вместо перегруженных порталов с десятками ненужных вкладок',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.06] bg-[#16161B] p-4 space-y-1.5"
                >
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] pl-6">{item.vs}</p>
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
                            'TedCloud Intelligence AI Studio',
                          ]
                        : [
                            'До 50 сотрудников включено',
                            'Полная CRM-воронка и Авто-триггеры',
                            'Генератор договоров и счетов А4 в 1 клик',
                            'Внешние комнаты сделок и RBAC-матрица',
                            'Центральная ИИ-студия TedCloud Intelligence',
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
      )}

      <footer className="max-w-6xl w-full mx-auto text-center text-[11px] text-[#71717A] pt-4">
        TedCloud Enterprise Platform — {t('auth.subtitle')}
      </footer>
    </div>
  );
};
