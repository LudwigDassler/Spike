import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Loader2,
  Check,
  User,
  KeyRound,
  Copy,
  Trash2,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  AccessLevel,
  EmployeePermissions,
  OrganizationNode,
  PERMISSION_KEYS,
  TaskRecord,
  getDefaultPermissionsForAccessLevel,
  normalizeEmployeePermissions,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

export type EmployeeInspectorTab = 'profile' | 'rbac' | 'access';

interface PermissionsMatrixModalProps {
  node: OrganizationNode | null;
  departments?: string[];
  tasks?: TaskRecord[];
  botUsername?: string | null;
  canManageTeam?: boolean;
  onClose: () => void;
  onSave: (
    nodeId: string,
    accessLevel: AccessLevel,
    permissions: EmployeePermissions,
    profileUpdates?: Partial<OrganizationNode>
  ) => Promise<void>;
  onDeleteNode?: (node: OrganizationNode) => Promise<void> | void;
  onAddCompanyDepartment?: (deptName: string) => Promise<void> | void;
}

export const PermissionsMatrixModal: React.FC<PermissionsMatrixModalProps> = ({
  node,
  departments = [],
  tasks = [],
  botUsername = null,
  canManageTeam = true,
  onClose,
  onSave,
  onDeleteNode,
  onAddCompanyDepartment,
}) => {
  const { t, language, formatRole } = useLocale();
  const isEn = language === 'en';

  const [activeTab, setActiveTab] = useState<EmployeeInspectorTab>('profile');
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState('');
  const [department, setDepartment] = useState('');
  const [customDept, setCustomDept] = useState('');
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>('member');
  const [permissions, setPermissions] = useState<EmployeePermissions>(() =>
    getDefaultPermissionsForAccessLevel('member')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'code' | 'web' | 'tg' | null>(null);

  useEffect(() => {
    if (node) {
      setName(node.name || '');
      setRoleType(node.role_type || '');
      setDepartment(node.department || '');
      setCustomDept('');
      setIsCustomDept(false);
      setEmail(node.email || '');
      setTelegramChatId(node.telegram_chat_id ? String(node.telegram_chat_id) : '');

      const normalized = normalizeEmployeePermissions(
        node.access_level,
        node.permissions,
        node.role_type
      );
      setSelectedLevel(normalized.access_level);
      setPermissions(normalized.permissions);
    }
  }, [node]);

  useEffect(() => {
    if (!node) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [node, onClose]);

  if (!node) return null;

  const isRootLocked =
    selectedLevel === 'root' || String(node.role_type || '').trim().toUpperCase() === 'SUPERADMIN';

  const employeeTasks = (Array.isArray(tasks) ? tasks : []).filter(
    (tk) => tk.assigned_to === node.id || tk.owner_node_id === node.id
  );
  const activeTasksCount = employeeTasks.filter((tk) => tk.status !== 'Done').length;
  const completedTasksCount = employeeTasks.filter((tk) => tk.status === 'Done').length;

  const inviteCode =
    node.invite_code || `TC-${String(node.id || '0000').slice(0, 4).toUpperCase()}`;
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://tedcloud.vercel.app';
  const webLoginUrl = `${origin}/?invite=${encodeURIComponent(inviteCode)}`;

  const cleanBot = String(botUsername || '')
    .replace(/^@/, '')
    .trim();
  const validBot =
    cleanBot && cleanBot !== 'TedCloudEnterpriseBot' ? cleanBot : null;
  const tgDeepLink = validBot ? `https://t.me/${validBot}?start=${inviteCode}` : null;
  const tgStartCmd = `/start ${inviteCode}`;

  const handleCopy = async (text: string, key: 'code' | 'web' | 'tg') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const [autoSavedFlash, setAutoSavedFlash] = useState(false);

  const triggerInstantRbacSave = async (
    nextLevel: AccessLevel,
    nextPermissions: EmployeePermissions
  ) => {
    setAutoSavedFlash(true);
    try {
      const resolvedDept = isCustomDept ? customDept.trim() : department.trim();
      await onSave(
        node.id,
        nextLevel,
        nextPermissions,
        {
          name: name.trim() || node.name,
          role_type: roleType.trim() || node.role_type,
          department: resolvedDept || null,
          email: email.trim() || null,
          telegram_chat_id: telegramChatId.trim() ? telegramChatId.trim() : null,
        }
      );
    } finally {
      setTimeout(() => setAutoSavedFlash(false), 1800);
    }
  };

  const handlePresetChange = (nextLevel: AccessLevel) => {
    const nextPerms = getDefaultPermissionsForAccessLevel(nextLevel);
    setSelectedLevel(nextLevel);
    setPermissions(nextPerms);
    void triggerInstantRbacSave(nextLevel, nextPerms);
  };

  const handleToggleKey = (key: keyof EmployeePermissions) => {
    if (isRootLocked) return;
    const nextPerms: EmployeePermissions = {
      ...permissions,
      [key]: !permissions[key],
    };
    setPermissions(nextPerms);
    void triggerInstantRbacSave(selectedLevel, nextPerms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const resolvedDept = isCustomDept ? customDept.trim() : department.trim();
      if (isCustomDept && resolvedDept && onAddCompanyDepartment) {
        await onAddCompanyDepartment(resolvedDept);
      }

      const finalPermissions = isRootLocked
        ? getDefaultPermissionsForAccessLevel('root')
        : permissions;

      const profileUpdates: Partial<OrganizationNode> = {
        name: name.trim() || node.name,
        role_type: roleType.trim() || node.role_type,
        department: resolvedDept || null,
        email: email.trim() || null,
        telegram_chat_id: telegramChatId.trim() ? telegramChatId.trim() : null,
      };

      await onSave(
        node.id,
        isRootLocked ? 'root' : selectedLevel,
        finalPermissions,
        profileUpdates
      );
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans overflow-y-auto no-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-matrix-title"
    >
      <div className="w-[calc(100vw-24px)] max-w-xl rounded-2xl border border-white/10 bg-[#121214] shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar name={name || node.name} avatarUrl={node.avatar_url} size="md" />
            <div className="min-w-0">
              <h3
                id="perm-matrix-title"
                className="text-sm font-semibold text-white tracking-tight truncate"
              >
                {isEn
                  ? 'Employee Card & Access Controls'
                  : 'Карточка сотрудника и Права доступа'}
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                {name || node.name} · {formatRole(roleType || node.role_type)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {autoSavedFlash && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-medium text-emerald-300">
                <Check className="w-3 h-3" />
                <span>{isEn ? 'Saved' : 'Сохранено'}</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('invite.close')}
              className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Switchable Tabs */}
        <div className="px-5 pt-3 border-b border-white/[0.08] bg-zinc-950/40 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{isEn ? 'Profile & Role' : 'Профиль и Должность'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rbac')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'rbac'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEn ? 'Access Matrix (RBAC)' : 'Матрица прав (RBAC)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'access'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'Access & Invites' : 'Доступ и Инвайты'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* TAB 1: PROFILE & ROLE */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              {/* Employee Task KPIs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/[0.08] bg-zinc-900/60 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">
                      {isEn ? 'Active Tasks' : 'Активные задачи'}
                    </div>
                    <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                      {activeTasksCount}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-zinc-900/60 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">
                      {isEn ? 'Completed Tasks' : 'Завершено задач'}
                    </div>
                    <div className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
                      {completedTasksCount}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  {t('modal.empNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    {isEn ? 'Job Title / Position' : 'Должность'}
                  </label>
                  <input
                    type="text"
                    required
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value)}
                    placeholder={isEn ? 'e.g. Head of Legal' : 'Напр. Руководитель отдела'}
                    className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    {isEn ? 'Department' : 'Подразделение (Отдел)'}
                  </label>
                  {!isCustomDept ? (
                    <select
                      value={department}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomDept(true);
                          setDepartment('');
                        } else {
                          setDepartment(e.target.value);
                        }
                      }}
                      className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    >
                      <option value="">{t('dept.noneOption')}</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      {department && !departments.includes(department) && (
                        <option value={department}>{department}</option>
                      )}
                      <option value="__custom__">{t('dept.customOption')}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        placeholder={t('dept.customInputPlaceholder')}
                        className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomDept(false);
                          setCustomDept('');
                        }}
                        className="p-2 text-zinc-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  {isEn ? 'Corporate Email' : 'Корпоративный Email'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: RBAC ACCESS MATRIX */}
          {activeTab === 'rbac' && (
            <div className="space-y-3.5">
              <p className="text-xs text-zinc-400 leading-relaxed">{t('permModal.subtitle')}</p>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  {t('permModal.presetLabel')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['root', 'manager', 'member', 'observer'] as AccessLevel[]).map((lvl) => {
                    const isSelected = selectedLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handlePresetChange(lvl)}
                        className={`h-10 text-xs font-medium px-3 text-center truncate rounded-xl border transition-colors ${
                          isSelected
                            ? 'border-white bg-white text-black font-semibold'
                            : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {t(`accessShort.${lvl}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isRootLocked && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
                  {t('permModal.rootNotice')}
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-zinc-900/60 divide-y divide-white/[0.06] max-h-[300px] overflow-y-auto no-scrollbar">
                {PERMISSION_KEYS.map((permKey) => {
                  const enabled = isRootLocked ? true : Boolean(permissions[permKey]);
                  return (
                    <div
                      key={permKey}
                      onClick={() => handleToggleKey(permKey)}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-colors ${
                        isRootLocked
                          ? 'opacity-80 cursor-not-allowed'
                          : 'cursor-pointer hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-white font-sans">
                          {t(`perm.${permKey}`)}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-sans leading-snug mt-0.5">
                          {t(`permDesc.${permKey}`)}
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        disabled={isRootLocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleKey(permKey);
                        }}
                        className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                          enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ACCESS & INVITES */}
          {activeTab === 'access' && (
            <div className="space-y-3.5">
              {/* Personal Login Code + 1-Click Web Link */}
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {isEn ? 'Personal Access Code' : 'Персональный код входа'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {isEn
                        ? 'Used for instant browser login or Telegram bot pairing'
                        : 'Для входа с браузера или привязки Telegram-бота'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-xs font-bold text-white tabular-nums">
                      {inviteCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(inviteCode, 'code')}
                      className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white inline-flex items-center gap-1.5 transition"
                    >
                      {copiedKey === 'code' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'code' ? t('invite.copied') : t('invite.copyCode')}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => handleCopy(webLoginUrl, 'web')}
                    className="w-full h-10 px-3.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-2 transition"
                  >
                    {copiedKey === 'web' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>
                          {isEn ? 'Direct Web Login Link Copied!' : 'Прямая веб-ссылка скопирована!'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>
                          {isEn
                            ? 'Copy Direct Web Login Link for Employee'
                            : 'Скопировать прямую веб-ссылку для входа сотрудника'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Telegram Bot Binding */}
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white">
                    {isEn ? 'Telegram Synchronization' : 'Привязка Telegram-бота'}
                  </div>
                  {telegramChatId ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ID: {telegramChatId}
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500">
                      {isEn ? 'Not linked yet' : 'Ожидает привязки'}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isEn ? 'Telegram Chat ID (optional manual override)' : 'Telegram Chat ID сотрудника'}
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder={isEn ? 'e.g. 6432521579' : 'Напр. 6432521579'}
                    className="w-full h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-zinc-100 tabular-nums focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(tgDeepLink || tgStartCmd, 'tg')}
                    className="flex-1 h-10 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-100 inline-flex items-center justify-center gap-2 transition"
                  >
                    {copiedKey === 'tg' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('invite.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {tgDeepLink
                            ? isEn
                              ? 'Copy Telegram Bot Link'
                              : 'Скопировать ссылку привязки Telegram-бота'
                            : isEn
                            ? `Copy "${tgStartCmd}" Command`
                            : `Скопировать команду ${tgStartCmd}`}
                        </span>
                      </>
                    )}
                  </button>
                  {tgDeepLink && (
                    <a
                      href={tgDeepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="h-10 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 inline-flex items-center justify-center"
                      title="Open Telegram"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Danger Zone: Delete Employee */}
              {canManageTeam && onDeleteNode && !isRootLocked && (
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {isEn
                      ? 'Remove employee from workspace'
                      : 'Удаление карточки сотрудника из штата'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDeleteNode(node);
                    }}
                    className="h-9 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-medium text-rose-300 inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Delete Employee' : 'Удалить сотрудника'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 px-4 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-10 inline-flex items-center gap-2 px-4 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isEn ? 'Save Changes' : 'Сохранить изменения'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
