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
  Sparkles,
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
} from 'lucide-react';
import { Company, OrganizationNode } from '../types/database';
import { useLocale, SupportedLocale } from '../i18n/LocaleContext';
import { formatError } from '../utils/enterpriseLogic';

interface AuthGateProps {
  existingNodes: OrganizationNode[];
  existingCompany: Company | null;
  onAuthenticated: (profile: OrganizationNode, company: Company | null) => void;
}

type TopViewMode = 'auth' | 'showcase';
type AuthTabMode = 'signin' | 'register';
type LoginSubMode = 'invite' | 'credentials' | 'telegram';
type TelegramVerifyMethod = 'otp' | 'password';

export const AuthGate: React.FC<AuthGateProps> = ({
  existingNodes,
  existingCompany,
  onAuthenticated,
}) => {
  const { locale, setLocale, theme, toggleTheme, t } = useLocale();
  const isEn = locale === 'en';

  const [topView, setTopView] = useState<TopViewMode>('auth');
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

  // Showcase module preview tab
  const [activeShowcaseModule, setActiveShowcaseModule] = useState<
    'tasks' | 'crm' | 'shifts' | 'ai'
  >('tasks');

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
    <div className="min-h-screen bg-[#09090B] text-[#EDEDED] font-sans antialiased flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar: Brand, Top Switcher («Авторизация» / «О платформе и Тарифы»), Theme & Language */}
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
        <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-[#121215] p-1">
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
            <Sparkles className="w-3.5 h-3.5" />
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

      {/* =====================================================================
          VIEW 1: MULTI-TIER AUTHENTICATION & WORKSPACE REGISTRATION (БЛОК 3)
      ====================================================================== */}
      {topView === 'auth' ? (
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
            VIEW 2: PUBLIC PRODUCT SHOWCASE, COMPARISON & PRICING (БЛОК 4)
        ====================================================================== */
        <main className="my-auto py-6 w-full max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111115] p-6 sm:p-8 shadow-2xl">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {isEn
                    ? 'Next-Gen Enterprise Operating System'
                    : 'Операционная система управления бизнесом нового поколения'}
                </span>
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isEn
                  ? 'TedCloud vs Jira & Bitrix24: Zero Clutter, Native Telegram Sync & Real-Time Shifts'
                  : 'TedCloud вместо тяжеловесных Jira и Битрикс24: скорость Linear и двусторонняя синхронизация с Telegram'}
              </h1>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                {isEn
                  ? 'Unify task execution, CRM revenue pipeline, live employee attendance shifts, and corporate messaging in one ultra-fast workspace.'
                  : 'Единый контур поручений, воронки продаж CRM, учета рабочего времени (Time & Attendance) и корпоративного мессенджера с мгновенной доставкой в Telegram.'}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTopView('auth');
                    setMode('register');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>
                    {isEn ? 'Launch Free Company Workspace' : 'Создать пространство компании'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTopView('auth');
                    setMode('signin');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isEn ? 'Employee Sign In' : 'Войти по пропуску сотрудника'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Module Previews + Comparison vs Jira & Bitrix24 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Module Selector (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#111115] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
                <h2 className="text-sm font-semibold text-white">
                  {isEn ? 'Interactive Platform Modules' : 'Интерактивный обзор модулей платформы'}
                </h2>
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#16161B] p-1 border border-white/[0.06]">
                  {[
                    {
                      id: 'tasks' as const,
                      label: isEn ? 'Tasks & SLA' : 'Задачи и Канбан',
                      icon: CheckCircle2,
                    },
                    {
                      id: 'crm' as const,
                      label: isEn ? 'CRM & Deal Room' : 'CRM и Воронка',
                      icon: Briefcase,
                    },
                    {
                      id: 'shifts' as const,
                      label: isEn ? 'Shifts & Time' : 'Смены и Табель',
                      icon: Clock,
                    },
                    {
                      id: 'ai' as const,
                      label: isEn ? 'AI & Telegram' : 'ИИ и Telegram',
                      icon: Cpu,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveShowcaseModule(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
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

              {activeShowcaseModule === 'tasks' && (
                <div className="space-y-3">
                  <div className="text-xs text-[#A1A1AA] leading-relaxed">
                    {isEn
                      ? 'Inline task creation on Enter, Kanban & Timeline Gantt chart, 1-click AI decomposition into subtask checklists, and automatic SLA reminders in Telegram.'
                      : 'Мгновенное создание поручений по Enter, Канбан-доска и Диаграмма Ганта, ИИ-декомпозиция задач на чек-листы в 1 клик и контроль просрочек в Telegram.'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-indigo-400 font-semibold">
                        {isEn ? 'Speed' : 'Скорость интерфейса'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">&lt; 50 ms</div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Inline editing without modals' : 'Редактирование ячеек на месте'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        {isEn ? 'Views' : 'Режимы работы'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? 'Kanban · List · Gantt' : 'Канбан · Список · Гант'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Real-time status sync' : 'Синхронизация статусов с ботом'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-amber-400 font-semibold">
                        {isEn ? 'Approvals' : 'Согласования'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? '1-Click Sign-Off' : 'Визирование в 1 клик'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Budgets, contracts & vacations' : 'Счета, договоры и отпуска'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeShowcaseModule === 'crm' && (
                <div className="space-y-3">
                  <div className="text-xs text-[#A1A1AA] leading-relaxed">
                    {isEn
                      ? 'Auto-Pipeline triggers tasks when deals move to Negotiation or Closed Won, plus 1-click PDF Contract / Invoice generator and public Client Deal Rooms.'
                      : 'Авто-воронка сама ставит задачу юристам при переводе сделки в «Переговоры», генерирует Договор/Счет в 1 клик и создает внешнюю Комнату сделки для клиента.'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        {isEn ? 'Auto-Triggers' : 'Авто-триггеры'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">CRM → Tasks</div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Zero lost handoffs' : 'Бесшовная передача в продакшн'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-indigo-400 font-semibold">
                        {isEn ? 'Legal Docs' : 'Генератор документов'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? 'Contract & Invoice' : 'Договор, Счет и Акт'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Ready for PDF print' : 'Мгновенная печать в PDF'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-amber-400 font-semibold">
                        {isEn ? 'Client Portal' : 'Client Deal Room'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? 'External Link' : 'Внешняя витрина сделки'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'For VIP B2B clients' : 'Персональная ссылка для заказчика'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeShowcaseModule === 'shifts' && (
                <div className="space-y-3">
                  <div className="text-xs text-[#A1A1AA] leading-relaxed">
                    {isEn
                      ? 'Built-in Workday Shift Tracker in the top bar: live Who is Online roster, pause/break tracking, automatic daily report on shift completion, and CSV payroll export.'
                      : 'Учет рабочего времени (Time & Attendance): живое табло «Кто сейчас на смене», учет перерывов, авто-отчет за день при закрытии смены и выгрузка табеля в CSV для бухгалтерии.'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        {isEn ? 'Live Roster' : 'Живое табло'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? 'Online · Break · Offline' : 'На смене · Перерыв'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Real-time team presence' : 'Прозрачность дисциплины'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-indigo-400 font-semibold">
                        {isEn ? 'Shift Summary' : 'Авто-отчет смены'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? 'Hours + Completed Tasks' : 'Часы + Закрытые задачи'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Posted to company feed' : 'Публикация в инфополе'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-amber-400 font-semibold">
                        {isEn ? 'Payroll Export' : 'Экспорт для 1С / Excel'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">CSV / Excel</div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? '1-click timesheet export' : 'Выгрузка табеля в 1 клик'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeShowcaseModule === 'ai' && (
                <div className="space-y-3">
                  <div className="text-xs text-[#A1A1AA] leading-relaxed">
                    {isEn
                      ? 'Two-way Telegram Bot sync and TedCloud Intelligence executive copilot: turn chat messages into tasks in 1 click and receive 2FA login codes directly in Telegram.'
                      : 'Двусторонний Telegram-бот и ИИ-ассистент руководителя: превращайте сообщения чата в поручения в 1 клик, получайте 2FA-коды входа и управляйте задачами со смартфона.'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-indigo-400 font-semibold">
                        {isEn ? 'Telegram 2FA' : 'Telegram-бот'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? '2-Way Sync & OTP' : 'Уведомления и 2FA'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Instant mobile replies' : 'Ответы и задачи прямо из бота'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        {isEn ? 'Chat → Task' : 'Чат → Задача'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? '1-Click Action' : 'Конвертация в 1 клик'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Never lose a request in chat' : 'Ни одно поручение не теряется'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#16161B] p-3.5">
                      <div className="text-[11px] text-amber-400 font-semibold">
                        {isEn ? 'Unit Economics' : 'Юнит-экономика'}
                      </div>
                      <div className="text-sm font-bold text-white mt-1">
                        {isEn ? 'Executive Radar' : 'Радар рентабельности'}
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {isEn ? 'Revenue per employee' : 'Выручка на сотрудника и узкие места'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Why TedCloud vs Jira / Bitrix24 (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#111115] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white border-b border-white/[0.07] pb-3">
                {isEn
                  ? 'Why Companies Switch from Jira & Bitrix24'
                  : 'Почему компании переходят с Jira и Битрикс24'}
              </h2>
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    title: isEn
                      ? 'Onboarding in 60 seconds via Digital Pass'
                      : 'Онбординг сотрудников за 60 секунд по Цифровому пропуску',
                    vs: isEn
                      ? 'vs weeks of complex administration in Jira / Bitrix24'
                      : 'вместо недель сложного внедрения и обучения в Битрикс24',
                  },
                  {
                    title: isEn
                      ? 'Native 2-Way Telegram Sync & 2FA out of the box'
                      : 'Двусторонний Telegram-бот и 2FA из коробки без плагинов',
                    vs: isEn
                      ? 'vs paid third-party connectors that constantly break'
                      : 'вместо платных сторонних интеграций, которые постоянно отваливаются',
                  },
                  {
                    title: isEn
                      ? 'Tasks + CRM + Shifts + Vault in a clean Swiss UI'
                      : 'Задачи + CRM + Табель смен + База регламентов в одном окне',
                    vs: isEn
                      ? 'vs overloaded portals with 50+ unused menu items'
                      : 'вместо перегруженных порталов с десятками ненужных вкладок',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/[0.06] bg-[#16161B] p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-[#8E8E93] pl-5">{item.vs}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing Tiers Comparison (Trial / Business / Enterprise) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                tier: 'Trial',
                badge: isEn ? 'Free Start' : 'Бесплатный старт',
                price: isEn ? '$0 / mo' : '0 ₽ / мес',
                seats: isEn ? 'Up to 5 employees' : 'До 5 сотрудников',
                features: isEn
                  ? [
                      'Kanban, List & Timeline Tasks',
                      'Corporate Chat & Telegram Sync',
                      'Live Shift Tracker & Timesheets',
                    ]
                  : [
                      'Задачи: Канбан, Список и Таймлайн',
                      'Корпоративный чат и Telegram-бот',
                      'Учет смен и табель рабочего времени',
                    ],
                highlighted: false,
              },
              {
                tier: 'Business',
                badge: isEn ? 'Most Popular' : 'Стандарт бизнеса',
                price: isEn ? '$49 / mo' : '4 900 ₽ / мес',
                seats: isEn ? 'Up to 50 employees' : 'До 50 сотрудников',
                features: isEn
                  ? [
                      'Full CRM Pipeline & Auto-Triggers',
                      '1-Click Contract & Invoice Generator',
                      'Client Deal Rooms & RBAC Matrix',
                      'TedCloud Intelligence AI Copilot',
                    ]
                  : [
                      'Полная CRM-воронка и Авто-триггеры',
                      'Генератор договоров и счетов в 1 клик',
                      'Внешние комнаты сделок и RBAC-матрица',
                      'ИИ-ассистент TedCloud Intelligence',
                    ],
                highlighted: true,
              },
              {
                tier: 'Enterprise',
                badge: isEn ? 'Corporate Scale' : 'Корпоративный контур',
                price: isEn ? '$199 / mo' : '19 900 ₽ / мес',
                seats: isEn ? 'Up to 500+ employees' : 'До 500+ сотрудников',
                features: isEn
                  ? [
                      'Unlimited Departments & Audit Log',
                      'Executive Unit Economics Radar',
                      'Dedicated SLA & Priority Support',
                      'Custom Security & API Webhooks',
                    ]
                  : [
                      'Безлимит отделов и Журнал безопасности',
                      'Радар юнит-экономики руководителя',
                      'Персональный SLA и выделенный контур',
                      'Корпоративный SSO и Telegram 2FA',
                    ],
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-2xl border p-6 flex flex-col justify-between space-y-5 ${
                  plan.highlighted
                    ? 'border-indigo-500/50 bg-[#14141D] shadow-xl'
                    : 'border-white/[0.08] bg-[#111115]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{plan.tier}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        plan.highlighted
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/[0.06] text-[#A1A1AA]'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white tabular-nums">{plan.price}</div>
                  <div className="text-xs text-[#8E8E93]">{plan.seats}</div>
                  <ul className="space-y-2 pt-2 border-t border-white/[0.07]">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-zinc-200">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTopView('auth');
                    setMode('register');
                  }}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white'
                  }`}
                >
                  {isEn ? `Start with ${plan.tier}` : `Выбрать тариф ${plan.tier}`}
                </button>
              </div>
            ))}
          </div>

          {/* Desktop & Mobile App Banner (macOS / Windows / iOS / Android) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111115] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                    ? 'Install TedCloud directly to your macOS Dock or Windows taskbar with instant push notifications and offline resilience.'
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
          </div>
        </main>
      )}

      <footer className="max-w-6xl w-full mx-auto text-center text-[11px] text-[#71717A] pt-4">
        TedCloud Enterprise Platform — {t('auth.subtitle')}
      </footer>
    </div>
  );
};
