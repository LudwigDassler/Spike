import React, { useState, useMemo } from 'react';
import {
  X,
  Shield,
  KeyRound,
  Copy,
  Check,
  Send,
  Link2,
  Receipt,
  History,
  Save,
  Loader2,
  Printer,
  CheckSquare,
  Briefcase,
  Users,
  Lock,
  Search,
  Plus,
  Cpu,
  Columns3,
  Download,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react';
import {
  AccessLevel,
  AuditLogRecord,
  EmployeePermissions,
  OrganizationNode,
  PaymentGatewayRegion,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';
import {
  exportToCsvOrXlsx,
  getLocalImmutableAuditLogs,
} from '../utils/saasEnterpriseEngine';

export const PRIMARY_BTN_CLASS =
  'tc-btn-primary inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 !text-white font-medium text-xs shadow-sm shadow-indigo-500/20 transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer';

export const SECONDARY_BTN_CLASS =
  'tc-btn-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xs text-xs font-medium transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer';

/* ============================================================================
 * 1. МОДАЛЬНОЕ ОКНО: «Мои полномочия (Контур доступа)» — 4 чистые категории без дублей
 * ========================================================================== */
interface MyPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessLevel: AccessLevel;
  permissions: EmployeePermissions;
  employeeName: string;
}

export const MyPermissionsModal: React.FC<MyPermissionsModalProps> = ({
  isOpen,
  onClose,
  accessLevel,
  permissions,
  employeeName,
}) => {
  const { language, t } = useLocale();
  const isEn = language === 'en';

  if (!isOpen) return null;

  const categories = [
    {
      id: 'tasks',
      icon: CheckSquare,
      title: isEn ? 'Operational Tasks' : 'Операционные задачи',
      items: [
        {
          label: isEn
            ? 'View all company tasks & SLA deadlines'
            : 'Просмотр всех задач компании и контроль SLA',
          enabled: Boolean(permissions.tasks_view_all),
        },
        {
          label: isEn
            ? 'Create, edit, and decompose tasks with AI'
            : 'Создание, редактирование и ИИ-декомпозиция поручений',
          enabled:
            accessLevel === 'root' ||
            accessLevel === 'manager' ||
            Boolean(permissions.tasks_assign || permissions.tasks_view_all),
        },
        {
          label: isEn
            ? 'Assign tasks across employees and departments'
            : 'Делегирование поручений сотрудникам и отделам',
          enabled: Boolean(permissions.tasks_assign),
        },
      ],
    },
    {
      id: 'crm',
      icon: Briefcase,
      title: isEn ? 'Commercial CRM Pipeline' : 'Коммерческий контур CRM',
      items: [
        {
          label: isEn
            ? 'Access B2B deal pipeline & financial analytics'
            : 'Доступ к воронке B2B-сделок и финансовой аналитике',
          enabled: Boolean(permissions.crm_view),
        },
        {
          label: isEn
            ? 'Register contracts, edit stages, and run AI deal audits'
            : 'Регистрация контрактов, смена стадий и ИИ-аудит сделок',
          enabled: Boolean(permissions.crm_edit),
        },
      ],
    },
    {
      id: 'team',
      icon: Users,
      title: isEn ? 'Team & Organization' : 'Команда и структура',
      items: [
        {
          label: isEn
            ? 'Manage staff directory, departments & RBAC access matrix'
            : 'Управление штатом, отделами и матрицей прав доступа (RBAC)',
          enabled: Boolean(permissions.team_manage),
        },
        {
          label: isEn
            ? 'Corporate messenger, department channels & Telegram sync'
            : 'Корпоративный мессенджер, каналы отделов и синхронизация с Telegram',
          enabled: true,
        },
      ],
    },
    {
      id: 'billing',
      icon: Lock,
      title: isEn ? 'Billing & Security' : 'Биллинг и безопасность',
      items: [
        {
          label: isEn
            ? 'Manage corporate plan, B2B invoices & security audit log'
            : 'Управление тарифом, B2B-счетами и журналом безопасности',
          enabled: Boolean(permissions.billing_admin),
        },
        {
          label: isEn
            ? 'Export corporate registries to CSV'
            : 'Экспорт корпоративных реестров и отчетов в CSV',
          enabled: Boolean(permissions.data_export),
        },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#101014] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {isEn
                  ? 'My Permissions (Access Scope)'
                  : 'Мои полномочия (Контур доступа)'}
              </h3>
              <p className="text-[11px] text-[#8E8E93] truncate">
                {employeeName} · {t(`access.${accessLevel}`)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                className="rounded-xl border border-white/[0.07] bg-[#141419] p-4 space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
                  <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <h4 className="text-xs font-semibold text-white">{cat.title}</h4>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-2.5 text-xs"
                    >
                      <span
                        className={`leading-snug ${
                          item.enabled ? 'text-zinc-200' : 'text-zinc-500'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                          item.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-white/[0.03] border-white/[0.07] text-zinc-500'
                        }`}
                      >
                        {item.enabled
                          ? isEn
                            ? 'Active'
                            : 'Активно'
                          : isEn
                          ? 'Restricted'
                          : 'Закрыто'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-white/[0.07] bg-[#0c0c10] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#8E8E93]">
            {isEn
              ? 'Granular RBAC policy enforced at database & API level'
              : 'Матрица прав RBAC контролируется на уровне ядра БД и API'}
          </span>
          <button type="button" onClick={onClose} className={SECONDARY_BTN_CLASS}>
            {isEn ? 'Close' : 'Закрыть'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. МОДАЛЬНОЕ ОКНО: «Цифровой пропуск сотрудника» (БЛОК 1.1: без текстовых <input> со ссылками)
 * ========================================================================== */
interface MyAccessKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: OrganizationNode;
  botUsername: string;
  copiedToken: string | null;
  onCopy: (text: string, tokenKey: string) => void;
}

export const MyAccessKeysModal: React.FC<MyAccessKeysModalProps> = ({
  isOpen,
  onClose,
  profile,
  botUsername,
  copiedToken,
  onCopy,
}) => {
  const { language, theme, t, formatRole } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const inviteCode = profile.invite_code || 'TC-0000';
  const webPassUrl = `${window.location.origin}/?invite=${encodeURIComponent(inviteCode)}`;
  const cleanBot = String(botUsername || '').trim().replace(/^@/, '');
  const validBot = cleanBot && cleanBot !== 'TedCloudEnterpriseBot' ? cleanBot : '';
  const tgDeepLink = validBot ? `https://t.me/${validBot}?start=${inviteCode}` : '';
  const tgCmd = `/start ${inviteCode}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 sm:p-6 overflow-y-auto font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg my-auto rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#111115] text-slate-900 dark:text-zinc-100 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Employee Avatar, Full Name, Job Title */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#16181F] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {profile.name}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/[0.08] text-[10px] font-semibold text-slate-700 dark:text-zinc-300 shrink-0">
                  {isEn ? 'Digital Pass' : 'Цифровой пропуск'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                {formatRole(profile.role_type)}
                {profile.department ? ` · ${formatRole(profile.department)}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('invite.close')}
            className="p-1.5 rounded-xl text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Center: Large Interactive Invite Code Plate (TC-XXXX) */}
          <div className="bg-slate-100 dark:bg-zinc-900 border border-slate-200/90 dark:border-white/10 text-slate-900 dark:text-zinc-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                {isEn ? 'Personal Employee Invite Code' : 'Персональный инвайт-код сотрудника'}
              </div>
              <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100 tabular-nums">
                {inviteCode}
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                {isEn
                  ? 'Sign in without password or pair Telegram bot'
                  : 'Для быстрого входа без пароля и привязки бота'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCopy(inviteCode, 'modal-profile-code')}
              className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                copiedToken === 'modal-profile-code'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : isLight
                  ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                  : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {copiedToken === 'modal-profile-code' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('invite.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{isEn ? 'Copy Code' : 'Копировать код'}</span>
                </>
              )}
            </button>
          </div>

          {/* Bottom: 2 Handsome Card-Buttons in a 2-Column Grid (Zero Raw URLs, Monochrome Micro-blocks) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: 1-Click Web Pass */}
            <button
              type="button"
              onClick={() => onCopy(webPassUrl, 'modal-profile-web-link')}
              className={`group text-left rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                copiedToken === 'modal-profile-web-link'
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : isLight
                  ? 'border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300'
                  : 'border-white/[0.08] bg-zinc-900/70 hover:bg-zinc-800/80 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  {copiedToken === 'modal-profile-web-link' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                  {copiedToken === 'modal-profile-web-link'
                    ? t('invite.copied')
                    : isEn
                    ? 'Copy Link'
                    : 'Скопировать'}
                </span>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 leading-snug">
                  {isEn
                    ? 'Copy Web Pass (1-Click Login)'
                    : 'Скопировать веб-пропуск (Вход в 1 клик)'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {isEn
                    ? 'Direct sign-in link for desktop or smartphone browser'
                    : 'Прямая ссылка для браузера ПК или смартфона'}
                </p>
              </div>
            </button>

            {/* Card 2: Telegram Bot Synchronization */}
            <button
              type="button"
              onClick={() => {
                if (tgDeepLink) {
                  onCopy(tgDeepLink, 'modal-profile-tg-link');
                } else {
                  onCopy(tgCmd, 'modal-profile-tg-cmd');
                }
              }}
              className={`group text-left rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                copiedToken === 'modal-profile-tg-link' || copiedToken === 'modal-profile-tg-cmd'
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : isLight
                  ? 'border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300'
                  : 'border-white/[0.08] bg-zinc-900/70 hover:bg-zinc-800/80 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  {copiedToken === 'modal-profile-tg-link' ||
                  copiedToken === 'modal-profile-tg-cmd' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                  {copiedToken === 'modal-profile-tg-link' ||
                  copiedToken === 'modal-profile-tg-cmd'
                    ? t('invite.copied')
                    : profile.telegram_chat_id
                    ? `ID: ${profile.telegram_chat_id}`
                    : isEn
                    ? '1-Click Bind'
                    : 'Привязать'}
                </span>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 leading-snug">
                  {isEn
                    ? 'Synchronize with Telegram Bot'
                    : 'Синхронизация с Telegram-ботом'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {isEn
                    ? '1-click notification & 2FA binding'
                    : 'Привязка уведомлений в 1 клик'}
                </p>
              </div>
            </button>
          </div>

          {tgDeepLink && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] px-4 py-2.5 text-xs">
              <span className="text-slate-500 dark:text-zinc-400">
                {isEn
                  ? 'Need to launch Telegram directly on this device?'
                  : 'Открыть Telegram-бота прямо сейчас на этом устройстве?'}
              </span>
              <a
                href={tgDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-zinc-100 hover:opacity-80 transition-opacity"
              >
                <span>{isEn ? 'Open Bot' : 'Открыть бота'}</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-white/[0.07] bg-slate-50/90 dark:bg-[#0c0c10] flex justify-end">
          <button type="button" onClick={onClose} className={SECONDARY_BTN_CLASS}>
            {isEn ? 'Done' : 'Готово'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. МОДАЛЬНОЕ ОКНО: «Юридические реквизиты плательщика» (RU / GLOBAL)
 * ========================================================================== */
interface LegalRequisitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentRegion: 'RU' | 'GLOBAL';
  payerLegalName: string;
  setPayerLegalName: (v: string) => void;
  payerTaxId: string;
  setPayerTaxId: (v: string) => void;
  payerRegNumber: string;
  setPayerRegNumber: (v: string) => void;
  payerLegalAddress: string;
  setPayerLegalAddress: (v: string) => void;
  payerBillingEmail: string;
  setPayerBillingEmail: (v: string) => void;
  payerCountry: string;
  setPayerCountry: (v: string) => void;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGenerateInvoice: () => void;
}

export const LegalRequisitesModal: React.FC<LegalRequisitesModalProps> = ({
  isOpen,
  onClose,
  paymentRegion,
  payerLegalName,
  setPayerLegalName,
  payerTaxId,
  setPayerTaxId,
  payerRegNumber,
  setPayerRegNumber,
  payerLegalAddress,
  setPayerLegalAddress,
  payerBillingEmail,
  setPayerBillingEmail,
  payerCountry,
  setPayerCountry,
  isSaving,
  onSubmit,
  onGenerateInvoice,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#101014] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {isEn
                  ? `Legal Entity & Payer Details (${
                      paymentRegion === 'RU' ? 'RU & CIS' : 'Global'
                    })`
                  : `Юридические реквизиты плательщика (${
                      paymentRegion === 'RU' ? 'РФ и СНГ' : 'Global'
                    })`}
              </h3>
              <p className="text-[11px] text-[#8E8E93]">
                {isEn
                  ? 'Automatically populated into official B2B invoices and closing documents'
                  : 'Автоматически подставляются в официальные B2B-счета и закрывающие акты'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {paymentRegion === 'RU' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                  {isEn
                    ? 'Legal Entity Name (LLC / JSC / Sole Proprietor)'
                    : 'Наименование юрлица (ООО / АО / ИП)'}
                </label>
                <input
                  type="text"
                  required
                  value={payerLegalName}
                  onChange={(e) => setPayerLegalName(e.target.value)}
                  placeholder={isEn ? 'Sigma Technologies LLC' : 'ООО «Сигма Технологии»'}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                  {isEn ? 'Tax ID (INN)' : 'ИНН'}
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
                  {isEn ? 'Registration Code (KPP)' : 'КПП'}
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
                  {isEn ? 'Registered Legal Address' : 'Юридический адрес'}
                </label>
                <input
                  type="text"
                  value={payerLegalAddress}
                  onChange={(e) => setPayerLegalAddress(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Moscow, Presnenskaya Emb., 12'
                      : 'г. Москва, Пресненская наб., д. 12'
                  }
                  className="w-full rounded-lg border border-white/[0.08] bg-[#17171B] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-white/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                  {isEn ? 'Billing & Invoicing Email' : 'Email для счетов и ЭДО'}
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

          <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onGenerateInvoice();
              }}
              className={SECONDARY_BTN_CLASS}
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isEn ? 'Generate B2B Invoice' : 'Сформировать B2B-счет'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className={SECONDARY_BTN_CLASS}>
                {isEn ? 'Cancel' : 'Отмена'}
              </button>
              <button type="submit" disabled={isSaving} className={PRIMARY_BTN_CLASS}>
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? 'Save Details' : 'Сохранить реквизиты'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. МОДАЛЬНОЕ ОКНО: «Журнал аудита безопасности (Security Audit Log)»
 * ========================================================================== */
interface SecurityAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  auditLogs: AuditLogRecord[];
}

function formatAuditLogEntry(
  log: AuditLogRecord,
  isEn: boolean
): {
  actionLabel: string;
  badgeClass: string;
  entityLabel: string;
  cleanDetails: string;
} {
  const rawAction = String(log.action_type || (log as any).action || '')
    .trim()
    .toUpperCase();
  const rawEntity = String(log.entity_type || '')
    .trim()
    .toLowerCase();
  const rawDetails = String(log.details || '').trim();
  const detailsLower = rawDetails.toLowerCase();

  // 1. Determine human-readable Entity (ОБЪЕКТ)
  let entityCategory: 'tasks' | 'crm' | 'team' | 'billing' | 'approvals' = 'tasks';
  if (
    rawEntity === 'tasks' ||
    rawEntity === 'task' ||
    rawAction.includes('TASK') ||
    detailsLower.includes('задач') ||
    detailsLower.includes('поручен') ||
    detailsLower.includes('(tasks)')
  ) {
    entityCategory = 'tasks';
  } else if (
    rawEntity === 'crm_leads' ||
    rawEntity === 'deal' ||
    rawEntity === 'lead' ||
    rawAction.includes('DEAL') ||
    rawAction.includes('LEAD') ||
    detailsLower.includes('сделк') ||
    detailsLower.includes('(crm_leads)')
  ) {
    entityCategory = 'crm';
  } else if (
    rawEntity === 'organization_nodes' ||
    rawEntity === 'employee' ||
    rawEntity === 'team' ||
    rawAction.includes('EMPLOYEE') ||
    rawAction.includes('PERMISSION') ||
    rawAction.includes('NODE') ||
    detailsLower.includes('сотрудник') ||
    detailsLower.includes('прав') ||
    detailsLower.includes('(organization_nodes)')
  ) {
    entityCategory = 'team';
  } else if (
    rawEntity === 'billing_invoices' ||
    rawEntity === 'companies' ||
    rawEntity === 'billing' ||
    rawAction.includes('INVOICE') ||
    rawAction.includes('BILLING') ||
    rawAction.includes('PLAN') ||
    detailsLower.includes('счет') ||
    detailsLower.includes('реквизит') ||
    detailsLower.includes('тариф') ||
    detailsLower.includes('подписк')
  ) {
    entityCategory = 'billing';
  } else if (rawAction.includes('APPROVAL') || detailsLower.includes('заявк')) {
    entityCategory = 'approvals';
  }

  const entityLabel =
    entityCategory === 'tasks'
      ? isEn
        ? 'Tasks'
        : 'Задачи'
      : entityCategory === 'crm'
      ? isEn
        ? 'CRM Deals'
        : 'Сделки CRM'
      : entityCategory === 'team'
      ? isEn
        ? 'Team & Access'
        : 'Штат и Доступы'
      : entityCategory === 'billing'
      ? isEn
        ? 'Billing'
        : 'Биллинг'
      : isEn
      ? 'Tasks'
      : 'Задачи';

  // 2. Determine Action Label & Semantic Badge Color (ДЕЙСТВИЕ)
  let actionLabel = isEn ? 'System Event' : 'Системное событие';
  let badgeClass = 'bg-slate-500/10 text-slate-500 border-slate-500/25';

  if (rawAction.includes('DELETE') || rawAction.includes('REMOVED')) {
    actionLabel = isEn ? 'Record Deleted' : 'Удаление записи';
    badgeClass = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  } else if (rawAction === 'APPROVAL_REJECTED' || rawAction.includes('REJECT')) {
    actionLabel = isEn ? 'Approval Rejected' : 'Отклонение заявки';
    badgeClass = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  } else if (rawAction === 'TASK_CREATED' || rawAction === 'AI_TASK_CREATED' || (rawAction === 'CREATE' && entityCategory === 'tasks')) {
    actionLabel = isEn ? 'Task Created' : 'Создание задачи';
    badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
  } else if (rawAction === 'DEAL_CREATED' || rawAction === 'AI_DEAL_CREATED' || (rawAction === 'CREATE' && entityCategory === 'crm')) {
    actionLabel = isEn ? 'Deal Created' : 'Создание сделки';
    badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
  } else if (rawAction === 'EMPLOYEE_ADDED' || (rawAction === 'CREATE' && entityCategory === 'team')) {
    actionLabel = isEn ? 'Employee Added' : 'Добавление сотрудника';
    badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
  } else if (rawAction === 'APPROVAL_APPROVED') {
    actionLabel = isEn ? 'Approval Granted' : 'Утверждение заявки';
    badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
  } else if (rawAction === 'INVOICE_ISSUED' || rawAction === 'INVOICE_PAID') {
    actionLabel = isEn ? 'Invoice Issued' : 'Выставление счета';
    badgeClass = 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25';
  } else if (
    rawAction === 'BILLING_DETAILS_UPDATED' ||
    rawAction === 'COMPANY_PLAN_UPDATED' ||
    (rawAction === 'UPDATE' && entityCategory === 'billing')
  ) {
    actionLabel = isEn ? 'Billing Details Updated' : 'Обновление реквизитов';
    badgeClass = 'bg-amber-500/10 text-amber-600 border-amber-500/25';
  } else if (rawAction === 'PERMISSIONS_UPDATED' || rawAction === 'PERMISSIONS_CHANGED') {
    actionLabel = isEn ? 'Permissions Changed' : 'Изменение прав доступа';
    badgeClass = 'bg-purple-500/10 text-purple-600 border-purple-500/25';
  } else if (rawAction === 'UPDATE' || rawAction.includes('UPDATE')) {
    actionLabel =
      entityCategory === 'billing'
        ? isEn
          ? 'Billing Details Updated'
          : 'Обновление реквизитов'
        : entityCategory === 'team'
        ? isEn
          ? 'Permissions Changed'
          : 'Изменение прав доступа'
        : isEn
        ? 'Record Updated'
        : 'Обновление данных';
    badgeClass =
      entityCategory === 'team'
        ? 'bg-purple-500/10 text-purple-600 border-purple-500/25'
        : 'bg-amber-500/10 text-amber-600 border-amber-500/25';
  } else if (rawAction === 'CREATE') {
    actionLabel = isEn ? 'Task Created' : 'Создание задачи';
    badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
  }

  // 3. Clean up Details (ДЕТАЛИ) from technical table names and raw brackets
  let cleanDetails = rawDetails
    .replace(
      /Удален объект\s*\(tasks\)\s*:\s*(.+)$/i,
      (_, title) => `Удалена задача «${String(title).trim().replace(/^[«"']|[»"']$/g, '')}»`
    )
    .replace(
      /Удалена запись из\s*«tasks»\s*:\s*(.+)$/i,
      (_, title) => `Удалена задача «${String(title).trim().replace(/^[«"']|[»"']$/g, '')}»`
    )
    .replace(
      /Удален объект\s*\(crm_leads\)\s*:\s*(.+)$/i,
      (_, title) => `Удалена сделка CRM «${String(title).trim().replace(/^[«"']|[»"']$/g, '')}»`
    )
    .replace(
      /Удалена запись из\s*«crm_leads»\s*:\s*(.+)$/i,
      (_, title) => `Удалена сделка CRM «${String(title).trim().replace(/^[«"']|[»"']$/g, '')}»`
    )
    .replace(
      /Удален объект\s*\(organization_nodes\)\s*:\s*(.+)$/i,
      (_, title) => `Удален профиль сотрудника «${String(title).trim().replace(/^[«"']|[»"']$/g, '')}»`
    )
    .replace(
      /Удалена запись из\s*«organization_nodes»\s*:\s*(.+)$/i,
      (_, title) => `Удален профиль сотрудника «${String(title).trim().replace(/^[«"']|[»"']$/g, '')}»`
    )
    .replace(/\((tasks|crm_leads|organization_nodes|billing_invoices|companies|workspace)\)/gi, '')
    .replace(
      /\[High\]/gi,
      isEn ? '(Priority: High)' : '(Приоритет: Высокий)'
    )
    .replace(
      /\[Medium\]/gi,
      isEn ? '(Priority: Medium)' : '(Приоритет: Средний)'
    )
    .replace(
      /\[Low\]/gi,
      isEn ? '(Priority: Low)' : '(Приоритет: Низкий)'
    )
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    actionLabel,
    badgeClass,
    entityLabel,
    cleanDetails,
  };
}

export const SecurityAuditLogModal: React.FC<SecurityAuditLogModalProps> = ({
  isOpen,
  onClose,
  companyName,
  auditLogs,
}) => {
  const { language, theme, formatRole } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';
  const [query, setQuery] = useState('');

  const enrichedLogs = useMemo(() => {
    const serverLogs = Array.isArray(auditLogs) ? auditLogs : [];
    const companyId = serverLogs[0]?.company_id || 'default';
    const localLogs = getLocalImmutableAuditLogs(companyId);
    const seenIds = new Set<string>();
    const combined: AuditLogRecord[] = [];
    for (const item of [...localLogs, ...serverLogs]) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        combined.push(item);
      }
    }
    return combined.map((log) => ({
      raw: log,
      formatted: formatAuditLogEntry(log, isEn),
    }));
  }, [auditLogs, isEn, isOpen]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrichedLogs;
    return enrichedLogs.filter(
      ({ raw, formatted }) =>
        String(raw.actor_name || '').toLowerCase().includes(q) ||
        formatted.actionLabel.toLowerCase().includes(q) ||
        formatted.entityLabel.toLowerCase().includes(q) ||
        formatted.cleanDetails.toLowerCase().includes(q)
    );
  }, [enrichedLogs, query]);

  if (!isOpen) return null;

  const handleExportAuditCsv = () => {
    const rows = filteredLogs.map(({ raw, formatted }) => ({
      Timestamp: raw.created_at || new Date().toISOString(),
      Actor: raw.actor_name || 'System',
      Role: formatRole(raw.actor_role || 'member'),
      Action: formatted.actionLabel,
      Entity: formatted.entityLabel,
      Details: formatted.cleanDetails,
    }));
    exportToCsvOrXlsx(`TedCloud_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <History className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {isEn
                  ? 'Security & Action Audit Log'
                  : 'Журнал безопасности и аудита действий (Audit Log)'}
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {isEn
                  ? `Immutable ledger of security events and record mutations in ${companyName}`
                  : `Неизменяемый реестр критически важных событий безопасности в ${companyName}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEn ? 'Filter events...' : 'Поиск по событиям...'}
                className="w-44 sm:w-56 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-xs font-semibold text-[var(--text-primary)] hover:border-indigo-500/40 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV / Excel</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#71717A]">
              {isEn
                ? 'No matching security events found in the audit ledger.'
                : 'Записи в журнале безопасности не найдены.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className={
                    isLight
                      ? 'border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-100'
                      : 'border-b border-white/[0.07] text-[11px] font-medium text-[#71717A] uppercase tracking-wider bg-[#131318]'
                  }
                >
                  <th className="py-3 px-5">{isEn ? 'Time' : 'Время'}</th>
                  <th className="py-3 px-5">{isEn ? 'Actor' : 'Сотрудник'}</th>
                  <th className="py-3 px-5">{isEn ? 'Action' : 'Действие'}</th>
                  <th className="py-3 px-5">{isEn ? 'Entity' : 'Объект'}</th>
                  <th className="py-3 px-5">{isEn ? 'Details' : 'Детали'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {filteredLogs.slice(0, 80).map(({ raw: log, formatted }) => {
                  const timeFormatted = log.created_at
                    ? new Date(log.created_at).toLocaleString(isEn ? 'en-US' : 'ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-5 tabular-nums text-[11px] text-[#8E8E93] whitespace-nowrap">
                        {timeFormatted}
                      </td>
                      <td className="py-3 px-5">
                        <div className="font-medium text-white">{log.actor_name}</div>
                        {log.actor_role && (
                          <div className="text-[10px] text-[#71717A]">
                            {formatRole(log.actor_role)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${formatted.badgeClass}`}
                        >
                          {formatted.actionLabel}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-[#A1A1AA] text-[11px] font-medium whitespace-nowrap">
                        {formatted.entityLabel}
                      </td>
                      <td className="py-3 px-5 text-[#D4D4D8]">{formatted.cleanDetails}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-white/[0.07] bg-[#0c0c10] flex items-center justify-between">
          <span className="text-[11px] text-[#8E8E93] tabular-nums">
            {filteredLogs.length} {isEn ? 'recorded events' : 'событий в реестре'}
          </span>
          <button type="button" onClick={onClose} className={SECONDARY_BTN_CLASS}>
            {isEn ? 'Close' : 'Закрыть'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. КОМПОНЕНТ НАСЫЩЕННЫХ ПУСТЫХ СОСТОЯНИЙ (RichEmptyState — БЛОК 3)
 *    - Фоновый радиальный паттерн точек
 *    - Многослойная полупрозрачная стеклянная мини-иллюстрация с мягким свечением
 *    - 3 интерактивные карточки быстрого старта в ряд (БЕЗ дублирования белой кнопки!)
 * ========================================================================== */
export interface QuickStartCardItem {
  step: string;
  title: string;
  subtitle: string;
  icon: 'plus' | 'ai' | 'kanban' | 'csv' | 'chat';
  onClick: () => void;
}

interface RichEmptyStateProps {
  variant: 'tasks' | 'crm' | 'chat';
  title: string;
  description: string;
  quickCards?: QuickStartCardItem[];
  compact?: boolean;
}

export const RichEmptyState: React.FC<RichEmptyStateProps> = ({
  variant,
  title,
  description,
  quickCards = [],
  compact = false,
}) => {
  const renderCardIcon = (iconType: QuickStartCardItem['icon']) => {
    switch (iconType) {
      case 'plus':
        return <Plus className="w-3.5 h-3.5 text-indigo-400" />;
      case 'ai':
        return <Cpu className="w-3.5 h-3.5 text-violet-400" />;
      case 'kanban':
        return <Columns3 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'csv':
        return <Download className="w-3.5 h-3.5 text-sky-400" />;
      case 'chat':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center text-center ${
        compact ? 'py-10 px-5' : 'py-14 px-6'
      } bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:20px_20px]`}
    >
      {/* Мягкий фоновый ореол (Ambient Halo) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-32 rounded-full bg-indigo-500/10 blur-2xl"
      />

      {/* Многослойная полупрозрачная стеклянная мини-иллюстрация */}
      <div className="relative mb-5 flex items-center justify-center">
        <div className="w-44 h-16 rounded-xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-md p-2.5 flex flex-col justify-between shadow-xl -rotate-2">
          <div className="flex items-center justify-between">
            <span className="w-16 h-2 rounded-full bg-white/15" />
            <span className="w-8 h-3.5 rounded bg-indigo-500/20 border border-indigo-400/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/30" />
            <span className="w-24 h-2 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="absolute -bottom-2 -right-3 w-10 h-10 rounded-xl border border-white/[0.12] bg-[#15151C]/90 backdrop-blur-md shadow-lg flex items-center justify-center rotate-3">
          {variant === 'tasks' && <CheckSquare className="w-4 h-4 text-indigo-400" />}
          {variant === 'crm' && <Briefcase className="w-4 h-4 text-emerald-400" />}
          {variant === 'chat' && <MessageSquare className="w-4 h-4 text-sky-400" />}
        </div>
      </div>

      {/* Заголовок и подзаголовок */}
      <h3 className="relative text-sm font-semibold text-white tracking-tight max-w-md">
        {title}
      </h3>
      <p className="relative text-xs text-[#8E8E93] max-w-lg mt-1.5 leading-relaxed">
        {description}
      </p>

      {/* 3 интерактивные карточки быстрого старта в ряд */}
      {quickCards.length > 0 && (
        <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl text-left">
          {quickCards.map((card) => (
            <button
              key={card.step}
              type="button"
              onClick={card.onClick}
              className="group rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.16] p-3.5 transition-all flex flex-col justify-between gap-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                  {card.step}
                </span>
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center group-hover:scale-105 transition-transform">
                  {renderCardIcon(card.icon)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors leading-snug">
                  {card.title}
                </div>
                <div className="text-[11px] text-[#8E8E93] mt-0.5 leading-snug">
                  {card.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
