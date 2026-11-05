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
  Sun,
  Moon,
} from 'lucide-react';
import {
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
import { TeddyPrismIcon } from './TedCloudAiDrawer';

export interface AuthGateProps {
  existingNodes?: OrganizationNode[];
  nodes?: OrganizationNode[];
  tasks?: TaskRecord[];
  leads?: CrmLeadRecord[];
  existingCompany?: Company | null;
  company?: Company | null;
  currentUser?: OrganizationNode | null;
  botUsername?: string;
  onAuthenticated: (profile: OrganizationNode, company: Company | null) => Promise<void> | void;
}

type AuthTab = 'login' | 'register_invite' | 'register_company';

export const AuthGate: React.FC<AuthGateProps> = ({
  existingNodes = [],
  nodes = [],
  existingCompany = null,
  company = null,
  onAuthenticated,
}) => {
  const { language, setLanguage, theme, toggleTheme } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';

  const safeNodes = useMemo(() => {
    const raw =
      Array.isArray(nodes) && nodes.length > 0
        ? nodes
        : Array.isArray(existingNodes)
        ? existingNodes
        : [];
    return raw.filter(Boolean);
  }, [nodes, existingNodes]);

  const resolvedCompany = company || existingCompany || null;

  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [preselectedPlan, setPreselectedPlan] = useState<SubscriptionPlanTier>('Business');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginSecret, setLoginSecret] = useState('');
  const [otpModeActive, setOtpModeActive] = useState(false);
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [otpDeliveryHint, setOtpDeliveryHint] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [founderName, setFounderName] = useState('');
  const [founderDepartment, setFounderDepartment] = useState('Исполнительная дирекция');
  const [founderPassword, setFounderPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam && inviteParam.trim()) {
      setInviteCode(inviteParam.trim().toUpperCase());
      setActiveTab('register_invite');
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setErrorMessage(
        isEn
          ? 'Enter your full name, email, Telegram ID, or invite code.'
          : 'Укажите ФИО, Email, Telegram ID или инвайт-код сотрудника.'
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
          loginMode: 'credentials',
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

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 font-sans transition-colors ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#070709] text-zinc-100'
      }`}
    >
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white border border-slate-800 dark:bg-white/[0.08] dark:border-white/[0.14] flex items-center justify-center shadow-xs shrink-0">
            <TeddyPrismIcon className="w-4 h-4" />
          </div>
          <div>
            <span
              className={`text-sm font-bold tracking-tight ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              TedCloud
            </span>
            <span
              className={`ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-zinc-900 border-white/10 text-zinc-300'
              }`}
            >
              CloudCode Workspace
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isLight ? 'Dark mode' : 'Light mode'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer ${
              isLight
                ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                : 'border-white/[0.08] bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isLight
                ? 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                : 'border-white/[0.08] bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-500" />
            <span>{language === 'ru' ? 'RU' : 'EN'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-5 space-y-6">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              {isEn
                ? 'Isolated Multi-Tenant Architecture'
                : 'Изолированная корпоративная архитектура'}
            </span>
          </div>

          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            {isEn
              ? 'Unified Corporate Operations, Playbooks & CRM'
              : 'Единый контур задач, базы регламентов и сделок CRM'}
          </h1>

          <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
            {isEn
              ? 'Sign in with your employee profile, personal invite code TC-XXXX, or create an isolated workspace for your organization.'
              : 'Войдите по учетной записи сотрудника, персональному коду приглашения TC-XXXX или создайте изолированный контур для вашей компании.'}
          </p>

          <div
            className={`space-y-3 pt-4 border-t ${
              isLight ? 'border-slate-200' : 'border-white/[0.07]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-white/10'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div>
                <div
                  className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}
                >
                  {isEn ? 'Cryptographic Data Isolation' : 'Криптографическая изоляция компаний'}
                </div>
                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                  {isEn
                    ? 'Each company operates in a dedicated company_id scope.'
                    : 'Каждая организация работает в собственном изолированном контуре БД.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-white/10'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div>
                <div
                  className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}
                >
                  {isEn ? 'Granular 4-Tier RBAC' : 'Ролевая матрица доступов RBAC'}
                </div>
                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                  {isEn
                    ? 'Founder, Department Head, Senior Specialist, and Employee roles.'
                    : 'Гибкое разграничение полномочий для руководителей и специалистов.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-white/10'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div>
                <div
                  className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}
                >
                  {isEn ? 'Telegram 2FA & File Sync' : 'Двухфакторная защита Telegram 2FA'}
                </div>
                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                  {isEn
                    ? '4-digit OTP login confirmation and instant document delivery.'
                    : 'Подтверждение входа 4-значным кодом и мгновенная доставка файлов.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div
            className={`rounded-2xl border shadow-xl overflow-hidden ${
              isLight
                ? 'bg-white border-slate-200/90 text-slate-900'
                : 'bg-[#0E0E11] border-white/[0.08] text-zinc-100'
            }`}
          >
            <div
              className={`grid grid-cols-3 border-b p-1.5 gap-1 ${
                isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-[#121216] border-white/[0.07]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-white text-black shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
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
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'register_invite'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-white text-black shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
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
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'register_company'
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-white text-black shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isEn ? 'New Company' : 'Новая компания'}</span>
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-start gap-2.5 text-xs text-red-500 dark:text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {activeTab === 'login' && (
                <>
                  {otpModeActive ? (
                    <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                          <Send className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>
                            {isEn
                              ? 'Two-Factor Authentication (Telegram 2FA)'
                              : 'Двухфакторная защита входа (Telegram 2FA)'}
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-relaxed ${
                            isLight ? 'text-slate-700' : 'text-zinc-300'
                          }`}
                        >
                          {otpDeliveryHint}
                        </p>
                      </div>

                      <div>
                        <label
                          className={`block text-xs font-medium mb-1.5 ${
                            isLight ? 'text-slate-700' : 'text-zinc-300'
                          }`}
                        >
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
                          className={`w-full rounded-xl border border-indigo-500/40 px-4 py-3 text-center text-xl font-bold tracking-[0.4em] tabular-nums focus:border-indigo-500 focus:outline-none ${
                            isLight
                              ? 'bg-slate-50 text-slate-900 placeholder-slate-400'
                              : 'bg-[#141418] text-white placeholder-zinc-600'
                          }`}
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
                          className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                            isLight
                              ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {isEn ? 'Back' : 'Назад'}
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || otpCodeInput.length !== 4}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all cursor-pointer"
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
                      {(safeNodes || []).length > 0 && (
                        <div>
                          <label
                            className={`block text-xs font-medium mb-1.5 ${
                              isLight ? 'text-slate-700' : 'text-zinc-300'
                            }`}
                          >
                            {isEn
                              ? 'Quick Select Employee Profile'
                              : 'Быстрый выбор профиля сотрудника'}
                          </label>
                          <select
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                              isLight
                                ? 'border-slate-200 bg-slate-50 text-slate-900'
                                : 'border-white/[0.1] bg-[#141418] text-white'
                            }`}
                          >
                            <option value="">
                              {isEn
                                ? '— Select employee or type below —'
                                : '— Выберите сотрудника из списка —'}
                            </option>
                            {(safeNodes || []).map((member) => (
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
                        <label
                          className={`block text-xs font-medium mb-1.5 ${
                            isLight ? 'text-slate-700' : 'text-zinc-300'
                          }`}
                        >
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
                          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                            isLight
                              ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                              : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-500'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className={`block text-xs font-medium ${
                              isLight ? 'text-slate-700' : 'text-zinc-300'
                            }`}
                          >
                            {isEn
                              ? 'Personal Password (if set)'
                              : 'Личный пароль (если установлен)'}
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleSendTelegramOtp()}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-400 font-medium transition-colors cursor-pointer"
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
                          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                            isLight
                              ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                              : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-500'
                          }`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        <span>{isEn ? 'Enter Workspace' : 'Войти в рабочее пространство'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </>
              )}

              {activeTab === 'register_invite' && (
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div>
                    <label
                      className={`block text-xs font-medium mb-1.5 ${
                        isLight ? 'text-slate-700' : 'text-zinc-300'
                      }`}
                    >
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
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wider tabular-nums focus:outline-none ${
                        isLight
                          ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                          : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-600'
                      }`}
                    />
                  </div>

                  <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                    {isEn
                      ? 'Enter the personal access code issued by your company founder or department head to activate your workspace profile.'
                      : 'Введите персональный код доступа, выданный руководителем вашей компании в разделе «Штат и Доступы».'}
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all shadow-xs cursor-pointer"
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

              {activeTab === 'register_company' && (
                <form onSubmit={handleCompanyRegisterSubmit} className="space-y-4">
                  <div>
                    <label
                      className={`block text-xs font-medium mb-1.5 ${
                        isLight ? 'text-slate-700' : 'text-zinc-300'
                      }`}
                    >
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
                                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-white'
                                  : isLight
                                  ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
                                  : 'border-white/[0.08] bg-[#141418] text-zinc-400 hover:text-white'
                              }`}
                            >
                              <div>{isEn ? pObj.titleEn : pObj.titleRu}</div>
                              <div className="text-[10px] font-normal opacity-80 tabular-nums">
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
                    <label
                      className={`block text-xs font-medium mb-1.5 ${
                        isLight ? 'text-slate-700' : 'text-zinc-300'
                      }`}
                    >
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
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                        isLight
                          ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                          : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-500'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isLight ? 'text-slate-700' : 'text-zinc-300'
                        }`}
                      >
                        {isEn ? 'Founder / CEO Full Name' : 'ФИО Основателя / Руководителя'}
                      </label>
                      <input
                        type="text"
                        value={founderName}
                        onChange={(e) => setFounderName(e.target.value)}
                        placeholder={isEn ? 'Alexander Gromov' : 'Александр Громов'}
                        required
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                          isLight
                            ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                            : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isLight ? 'text-slate-700' : 'text-zinc-300'
                        }`}
                      >
                        {isEn ? 'Executive Department' : 'Подразделение руководства'}
                      </label>
                      <input
                        type="text"
                        value={founderDepartment}
                        onChange={(e) => setFounderDepartment(e.target.value)}
                        placeholder={isEn ? 'Executive Board' : 'Исполнительная дирекция'}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                          isLight
                            ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                            : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className={`block text-xs font-medium mb-1.5 ${
                        isLight ? 'text-slate-700' : 'text-zinc-300'
                      }`}
                    >
                      {isEn ? 'Founder Password' : 'Личный пароль руководителя'}
                    </label>
                    <input
                      type="password"
                      value={founderPassword}
                      onChange={(e) => setFounderPassword(e.target.value)}
                      placeholder={isEn ? 'Minimum 4 characters' : 'Минимум 4 символа'}
                      required
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none ${
                        isLight
                          ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'
                          : 'border-white/[0.1] bg-[#141418] text-white placeholder-zinc-500'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-2.5 px-4 text-xs font-semibold transition-all shadow-xs cursor-pointer"
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

      <footer
        className={`max-w-6xl w-full mx-auto py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] ${
          isLight ? 'border-slate-200 text-slate-500' : 'border-white/[0.06] text-zinc-500'
        }`}
      >
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
