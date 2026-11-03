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
  Lock,
  Link2,
  Send,
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
  const [newPassword, setNewPassword] = useState('');

  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>('member');
  const [permissions, setPermissions] = useState<EmployeePermissions>(() =>
    getDefaultPermissionsForAccessLevel('member')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'code' | 'web' | 'tg' | null>(null);
  const [autoSavedFlash, setAutoSavedFlash] = useState(false);

  useEffect(() => {
    if (node) {
      setName(node.name || '');
      setRoleType(node.role_type || '');
      setDepartment(node.department || '');
      setCustomDept('');
      setIsCustomDept(false);
      setEmail(node.email || '');
      setTelegramChatId(node.telegram_chat_id ? String(node.telegram_chat_id) : '');
      setNewPassword('');

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
        ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md font-sans transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-matrix-title"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#14161C] text-slate-900 dark:text-zinc-100 shadow-2xl no-scrollbar transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#181B22] sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar name={name || node.name} avatarUrl={node.avatar_url} size="md" />
            <div className="min-w-0">
              <h3
                id="perm-matrix-title"
                className="text-sm font-semibold text-slate-900 dark:text-zinc-100 tracking-tight truncate"
              >
                {isEn
                  ? 'Employee Card & Access Controls'
                  : 'Карточка сотрудника и Права доступа'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {name || node.name} · {formatRole(roleType || node.role_type)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {autoSavedFlash && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <Check className="w-4 h-4" />
                <span>{isEn ? 'Saved' : 'Сохранено'}</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('invite.close')}
              className="text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 pt-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#181B22] flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-zinc-100 font-semibold'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <User
              className={`w-4 h-4 ${
                activeTab === 'profile'
                  ? 'text-slate-900 dark:text-zinc-100'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}
            />
            <span>{isEn ? 'Profile & Role' : 'Профиль и Должность'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rbac')}
            className={`inline-flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'rbac'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-zinc-100 font-semibold'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <Shield
              className={`w-4 h-4 ${
                activeTab === 'rbac'
                  ? 'text-slate-900 dark:text-zinc-100'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}
            />
            <span>{isEn ? 'Access Matrix (RBAC)' : 'Матрица прав (RBAC)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`inline-flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'access'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-zinc-100 font-semibold'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            <KeyRound
              className={`w-4 h-4 ${
                activeTab === 'access'
                  ? 'text-slate-900 dark:text-zinc-100'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}
            />
            <span>{isEn ? 'Access & Invites' : 'Доступ и Инвайты'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* TAB 1: PROFILE & ROLE */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              {/* Employee Task KPIs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/60 p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {isEn ? 'Active Tasks' : 'Активные задачи'}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums mt-0.5">
                      {activeTasksCount}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50 dark:bg-zinc-900/60 p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {isEn ? 'Completed Tasks' : 'Завершено задач'}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums mt-0.5">
                      {completedTasksCount}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  {t('modal.empNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 px-3.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    {isEn ? 'Job Title / Position' : 'Должность'}
                  </label>
                  <input
                    type="text"
                    required
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value)}
                    placeholder={isEn ? 'e.g. Head of Legal' : 'Напр. Руководитель отдела'}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 px-3.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
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
                      className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 px-3 text-sm text-slate-900 dark:text-zinc-100 focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
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
                        className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 px-3 text-sm text-slate-900 dark:text-zinc-100 focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomDept(false);
                          setCustomDept('');
                        }}
                        className="p-2 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                  {isEn ? 'Corporate Email' : 'Корпоративный Email'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 px-3.5 text-sm text-slate-900 dark:text-zinc-100 focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: RBAC ACCESS MATRIX */}
          {activeTab === 'rbac' && (
            <div className="space-y-3.5">
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                {t('permModal.subtitle')}
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
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
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-black font-semibold'
                            : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        {t(`accessShort.${lvl}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isRootLocked && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  {t('permModal.rootNotice')}
                </div>
              )}

              <div className="rounded-xl border border-slate-200/90 dark:border-white/10 bg-slate-50/70 dark:bg-zinc-900/60 divide-y divide-slate-200/80 dark:divide-white/[0.06] max-h-[300px] overflow-y-auto no-scrollbar">
                {PERMISSION_KEYS.map((permKey) => {
                  const enabled = isRootLocked ? true : Boolean(permissions[permKey]);
                  return (
                    <div
                      key={permKey}
                      onClick={() => handleToggleKey(permKey)}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-colors ${
                        isRootLocked
                          ? 'opacity-80 cursor-not-allowed'
                          : 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-900 dark:text-zinc-100 font-sans">
                          {t(`perm.${permKey}`)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-sans leading-snug mt-0.5">
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
                          enabled ? 'bg-slate-900 dark:bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
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

          {/* TAB 3: ACCESS & INVITES (Цифровой пропуск сотрудника + Пароль) */}
          {activeTab === 'access' && (
            <div className="space-y-3.5">
              {/* Digital Employee Pass Plate (БЛОК 1.2: bg-slate-50 border-slate-200/90 in Light, bg-zinc-900/90 border-white/[0.08] in Dark) */}
              <div className="bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-white/[0.08] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    {isEn ? 'Personal Invite Code' : 'Персональный инвайт-код сотрудника'}
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100 tabular-nums">
                    {inviteCode}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    {isEn
                      ? 'Instant login without password or bot pairing'
                      : 'Быстрый вход без пароля и синхронизация с ботом'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(inviteCode, 'code')}
                  className="h-10 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-2 transition shrink-0 cursor-pointer"
                >
                  {copiedKey === 'code' ? (
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

              {/* 2 Handsome Card-Buttons in a 2-Column Grid (БЛОК 2.2: Strict Monochrome Micro-blocks, Zero Text Arrows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleCopy(webLoginUrl, 'web')}
                  className="group text-left rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900/70 hover:bg-slate-50 dark:hover:bg-zinc-800/80 p-4 transition-all flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center">
                      {copiedKey === 'web' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                      {copiedKey === 'web'
                        ? t('invite.copied')
                        : isEn
                        ? 'Copy'
                        : 'Скопировать'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 leading-snug">
                      {isEn
                        ? 'Copy Web Pass (1-Click Login)'
                        : 'Скопировать веб-пропуск (Вход в 1 клик)'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      {isEn
                        ? 'Direct link for PC or smartphone browser'
                        : 'Прямая ссылка для браузера ПК или смартфона'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(tgDeepLink || tgStartCmd, 'tg')}
                  className="group text-left rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-zinc-900/70 hover:bg-slate-50 dark:hover:bg-zinc-800/80 p-4 transition-all flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.07] text-slate-700 dark:text-zinc-300 flex items-center justify-center">
                      {copiedKey === 'tg' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                      {copiedKey === 'tg'
                        ? t('invite.copied')
                        : telegramChatId
                        ? `ID: ${telegramChatId}`
                        : isEn
                        ? '1-Click'
                        : 'В 1 клик'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 leading-snug">
                      {isEn
                        ? 'Synchronize with Telegram Bot'
                        : 'Синхронизация с Telegram-ботом'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      {isEn
                        ? '1-click notification & 2FA binding'
                        : 'Привязка уведомлений в 1 клик'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Password & Telegram Chat ID Management */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-zinc-900/60 p-3.5">
                <div>
                  <label className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      <span>{isEn ? 'Account Password' : 'Пароль сотрудника'}</span>
                    </span>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-zinc-300">
                      {node.has_password || node.password
                        ? isEn
                          ? 'Password set'
                          : 'Установлен'
                        : isEn
                        ? 'Set on 1st login'
                        : 'Не задан'}
                    </span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={
                      isEn ? 'Set or change password...' : 'Задать или сменить пароль...'
                    }
                    className="w-full h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">
                    <span>{isEn ? 'Telegram Chat ID' : 'Telegram Chat ID сотрудника'}</span>
                    {tgDeepLink && (
                      <a
                        href={tgDeepLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        <span>{isEn ? 'Open Bot' : 'Открыть бота'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder={isEn ? 'e.g. 6432521579' : 'Напр. 6432521579'}
                    className="w-full h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 tabular-nums focus:border-slate-500 dark:focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Danger Zone: Delete Employee */}
              {canManageTeam && onDeleteNode && !isRootLocked && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-zinc-500">
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
                    className="h-9 px-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/25 text-xs font-medium text-rose-700 dark:text-rose-300 inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isEn ? 'Delete Employee' : 'Удалить сотрудника'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 px-4 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors whitespace-nowrap"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-10 inline-flex items-center gap-2 px-4 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isEn ? 'Save Changes' : 'Сохранить изменения'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
