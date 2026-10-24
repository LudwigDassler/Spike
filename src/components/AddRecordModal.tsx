import React, { useState } from 'react';
import {
  X,
  Loader2,
  UserPlus,
  CheckSquare,
  Briefcase,
  AlertCircle,
  Copy,
  Check,
  KeyRound,
  ExternalLink,
  Shield,
} from 'lucide-react';
import {
  AccessLevel,
  CrmLeadStatus,
  EmployeePermissions,
  OrganizationNode,
  TaskPriority,
  TaskStatus,
  generateCorporateInviteCode,
  getDefaultPermissionsForAccessLevel,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

export type ModalRecordType = 'tasks' | 'organization_nodes' | 'crm_leads' | null;

interface AddRecordModalProps {
  type: ModalRecordType;
  companyId: string;
  currentProfileId?: string | null;
  nodes: OrganizationNode[];
  botUsername?: string;
  onClose: () => void;
  onSuccess: (pushSent?: boolean) => Promise<void> | void;
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  type,
  companyId,
  currentProfileId,
  nodes,
  botUsername = 'TedCloudEnterpriseBot',
  onClose,
  onSuccess,
}) => {
  const { t, currency } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Task fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState('Task');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('Todo');
  const [taskAssignedTo, setTaskAssignedTo] = useState<string>(
    currentProfileId || nodes[0]?.id || ''
  );

  // Employee fields (БЛОК 1: свободная должность + свободный отдел + контур допуска + чекбоксы прав)
  const [empName, setEmpName] = useState('');
  const [empRoleTitle, setEmpRoleTitle] = useState('');
  const [empDepartment, setEmpDepartment] = useState('');
  const [empAccessLevel, setEmpAccessLevel] = useState<AccessLevel>('member');
  const [empPermissions, setEmpPermissions] = useState<EmployeePermissions>(() =>
    getDefaultPermissionsForAccessLevel('member')
  );
  const [empEmail, setEmpEmail] = useState('');
  const [empTelegramId, setEmpTelegramId] = useState('');

  // Created Employee Invite state
  const [createdEmployeeInvite, setCreatedEmployeeInvite] = useState<{
    name: string;
    roleTitle: string;
    inviteCode: string;
    deepLink: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);

  // CRM Lead fields
  const [leadTitle, setLeadTitle] = useState('');
  const [leadClientName, setLeadClientName] = useState('');
  const [leadAmount, setLeadAmount] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [leadStatus, setLeadStatus] = useState<CrmLeadStatus>('New');

  if (!type) return null;

  const handleAccessLevelChange = (nextLevel: AccessLevel) => {
    setEmpAccessLevel(nextLevel);
    setEmpPermissions(getDefaultPermissionsForAccessLevel(nextLevel));
  };

  const togglePermission = (key: keyof EmployeePermissions) => {
    setEmpPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyText = async (val: string, field: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      let payload: Record<string, any> = { company_id: companyId };

      if (type === 'tasks') {
        if (!taskTitle.trim()) {
          throw new Error(t('modal.taskTitleLabel'));
        }
        const resolvedAssignee = taskAssignedTo || currentProfileId || nodes[0]?.id || null;
        payload = {
          company_id: companyId,
          title: taskTitle.trim(),
          type: taskType,
          priority: taskPriority,
          status: taskStatus,
          assigned_to: resolvedAssignee,
          owner_node_id: resolvedAssignee,
          created_by: currentProfileId || resolvedAssignee,
        };
      } else if (type === 'organization_nodes') {
        if (!empName.trim() || !empRoleTitle.trim()) {
          throw new Error(t('modal.empRoleLabel'));
        }
        const inviteCode = generateCorporateInviteCode();
        payload = {
          company_id: companyId,
          name: empName.trim(),
          role_type: empRoleTitle.trim(),
          department: empDepartment.trim() || null,
          access_level: empAccessLevel,
          permissions: empPermissions,
          email: empEmail.trim() || null,
          telegram_chat_id: empTelegramId.trim() ? String(empTelegramId.trim()) : null,
          invite_code: inviteCode,
        };
      } else if (type === 'crm_leads') {
        if (!leadClientName.trim()) {
          throw new Error(t('modal.dealClientLabel'));
        }
        payload = {
          company_id: companyId,
          owner_node_id: currentProfileId || nodes[0]?.id || null,
          title: leadTitle.trim() || leadClientName.trim(),
          client_name: leadClientName.trim(),
          amount: Number(leadAmount) || 0,
          contact: leadContact.trim() || null,
          status: leadStatus,
        };
      }

      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: type, payload }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      const pushSent = Boolean(result.telegramPush?.pushed);
      await onSuccess(pushSent);

      if (type === 'organization_nodes') {
        const finalCode = result.data?.invite_code || payload.invite_code;
        const cleanBot = botUsername.replace(/^@/, '').trim() || 'TedCloudEnterpriseBot';
        setCreatedEmployeeInvite({
          name: payload.name,
          roleTitle: payload.role_type,
          inviteCode: finalCode,
          deepLink: `https://t.me/${cleanBot}?start=${finalCode}`,
        });
        return;
      }

      onClose();
    } catch (err: any) {
      console.error(`[AddRecordModal] Failed to insert into ${type}:`, err);
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdEmployeeInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans">
        <div className="w-full max-w-lg rounded-xl border border-[#262626] bg-[#121212] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1F1F1F] border border-[#2E2E2E] flex items-center justify-center">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {t('invite.modalTitle')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-[#8E8E93] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1F1F1F]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              {t('invite.modalSubtitle')}
            </p>

            <div className="rounded-lg border border-[#262626] bg-[#171717] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider">
                  {t('invite.codeLabel')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white font-semibold bg-[#242424] px-2.5 py-1 rounded border border-[#333333] whitespace-nowrap">
                    {createdEmployeeInvite.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(createdEmployeeInvite.inviteCode, 'code')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#242424] hover:bg-[#2E2E2E] text-xs text-white transition-colors"
                  >
                    {copiedField === 'code' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{t('invite.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t('invite.copyCode')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider mb-1.5">
                  {t('invite.deepLinkLabel')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdEmployeeInvite.deepLink}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-xs text-[#E4E4E7] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(createdEmployeeInvite.deepLink, 'link')}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white text-black hover:bg-[#E4E4E7] transition-colors whitespace-nowrap"
                  >
                    {copiedField === 'link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('invite.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('invite.copyLink')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#262626] bg-[#141414] p-3.5 space-y-1.5 text-xs text-[#A1A1AA]">
              <p>{t('invite.step1')}</p>
              <p>{t('invite.step2')}</p>
              <p className="text-[#E4E4E7] font-medium">{t('invite.step3')}</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={createdEmployeeInvite.deepLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#E4E4E7] transition-colors"
              >
                {t('invite.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl border border-[#262626] bg-[#121212] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            {type === 'tasks' && <CheckSquare className="w-4 h-4 text-[#EDEDED]" />}
            {type === 'organization_nodes' && <UserPlus className="w-4 h-4 text-[#EDEDED]" />}
            {type === 'crm_leads' && <Briefcase className="w-4 h-4 text-[#EDEDED]" />}
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {type === 'tasks' && t('modal.newTaskTitle')}
              {type === 'organization_nodes' && t('modal.newEmployeeTitle')}
              {type === 'crm_leads' && t('modal.newDealTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E8E93] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1F1F1F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {type === 'tasks' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.taskTitleLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={t('modal.taskTitlePlaceholder')}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.taskTypeLabel')}
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                  >
                    <option value="Task">{t('type.Task')}</option>
                    <option value="Bug">{t('type.Bug')}</option>
                    <option value="Epic">{t('type.Epic')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.taskPriorityLabel')}
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                  >
                    <option value="Low">{t('priority.Low')}</option>
                    <option value="Medium">{t('priority.Medium')}</option>
                    <option value="High">{t('priority.High')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.taskStatusLabel')}
                  </label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                  >
                    <option value="Todo">{t('status.Todo')}</option>
                    <option value="In Progress">{t('status.In Progress')}</option>
                    <option value="Done">{t('status.Done')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.taskAssigneeLabel')}
                  </label>
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                  >
                    <option value="">{t('tasks.unassigned')}</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} — {node.role_type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {type === 'organization_nodes' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.empNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder={t('modal.empNamePlaceholder')}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                />
              </div>

              {/* Свободный ввод должности и подразделения (БЛОК 1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.empRoleLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={empRoleTitle}
                    onChange={(e) => setEmpRoleTitle(e.target.value)}
                    placeholder={t('modal.empRolePlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.empDeptLabel')}
                  </label>
                  <input
                    type="text"
                    value={empDepartment}
                    onChange={(e) => setEmpDepartment(e.target.value)}
                    placeholder={t('modal.empDeptPlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Уровень системного допуска (access_level) */}
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.empAccessLabel')}
                </label>
                <select
                  value={empAccessLevel}
                  onChange={(e) => handleAccessLevelChange(e.target.value as AccessLevel)}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                >
                  <option value="root">{t('access.root')}</option>
                  <option value="manager">{t('access.manager')}</option>
                  <option value="member">{t('access.member')}</option>
                  <option value="viewer">{t('access.viewer')}</option>
                </select>
              </div>

              {/* Интерактивные чекбоксы индивидуальных прав (permissions JSON) */}
              <div className="rounded-lg border border-[#262626] bg-[#161618] p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('perm.title')}</span>
                </div>

                <div className="space-y-2 pt-1">
                  {(
                    [
                      ['canAssignTasks', t('perm.canAssignTasks')],
                      ['canManageCrm', t('perm.canManageCrm')],
                      ['canManageTeam', t('perm.canManageTeam')],
                      ['canDeleteAndSettings', t('perm.canDeleteAndSettings')],
                    ] as [keyof EmployeePermissions, string][]
                  ).map(([permKey, label]) => (
                    <label
                      key={permKey}
                      className="flex items-center gap-2.5 text-xs text-[#D4D4D8] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={empPermissions[permKey]}
                        onChange={() => togglePermission(permKey)}
                        className="w-4 h-4 rounded border-[#3F3F46] bg-[#0D0D0F] text-white focus:ring-0"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.empEmailLabel')}
                  </label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="user@company.ru"
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.empTgLabel')}
                  </label>
                  <input
                    type="text"
                    value={empTelegramId}
                    onChange={(e) => setEmpTelegramId(e.target.value)}
                    placeholder="ID"
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {type === 'crm_leads' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.dealClientLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={leadClientName}
                  onChange={(e) => setLeadClientName(e.target.value)}
                  placeholder={t('modal.dealClientPlaceholder')}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.dealTitleLabel')}
                </label>
                <input
                  type="text"
                  value={leadTitle}
                  onChange={(e) => setLeadTitle(e.target.value)}
                  placeholder={t('modal.dealTitlePlaceholder')}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.dealAmountLabel')} ({currency})
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={leadAmount}
                    onChange={(e) => setLeadAmount(e.target.value)}
                    placeholder="500000"
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.dealStageLabel')}
                  </label>
                  <select
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value as CrmLeadStatus)}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                  >
                    <option value="New">{t('stage.New')}</option>
                    <option value="Negotiation">{t('stage.Negotiation')}</option>
                    <option value="Won">{t('stage.Won')}</option>
                    <option value="Lost">{t('stage.Lost')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.dealContactLabel')}
                </label>
                <input
                  type="text"
                  value={leadContact}
                  onChange={(e) => setLeadContact(e.target.value)}
                  placeholder={t('modal.dealContactPlaceholder')}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-white hover:bg-[#1F1F1F] transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#E5E5E5] disabled:opacity-50 transition-colors"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? t('modal.saving') : t('modal.submit')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
