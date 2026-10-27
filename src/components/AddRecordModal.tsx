import React, { useState, useEffect, useRef } from 'react';
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
  Building2,
  Globe,
  Paperclip,
} from 'lucide-react';
import {
  AccessLevel,
  AttachmentItem,
  CounterpartyJurisdiction,
  CrmLeadStatus,
  EmployeePermissions,
  OrganizationNode,
  PERMISSION_KEYS,
  TaskPriority,
  TaskStatus,
  generateCorporateInviteCode,
  getDefaultPermissionsForAccessLevel,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { formatError } from '../utils/enterpriseLogic';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  PendingAttachmentsStrip,
  processFilesToAttachments,
} from './AttachmentSystem';

export type ModalRecordType = 'tasks' | 'organization_nodes' | 'crm_leads' | null;

export interface InitialTaskDraft {
  title?: string;
  description?: string;
  assigned_to?: string | null;
  department?: string | null;
  priority?: TaskPriority;
  attachments?: AttachmentItem[];
}

interface AddRecordModalProps {
  type: ModalRecordType;
  companyId: string;
  currentProfileId?: string | null;
  canAssignTasks?: boolean;
  nodes: OrganizationNode[];
  departments?: string[];
  botUsername?: string | null;
  initialTaskDraft?: InitialTaskDraft | null;
  onAddCompanyDepartment?: (deptName: string) => Promise<void> | void;
  onClose: () => void;
  onSuccess: (pushSent?: boolean) => Promise<void> | void;
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  type,
  companyId,
  currentProfileId,
  canAssignTasks = false,
  nodes,
  departments = [],
  botUsername = null,
  initialTaskDraft,
  onAddCompanyDepartment,
  onClose,
  onSuccess,
}) => {
  const { t, currency, language, formatRole } = useLocale();
  const isEn = language === 'en';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Task fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskType, setTaskType] = useState('Task');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('Todo');
  const [taskAssignedTo, setTaskAssignedTo] = useState<string>(
    currentProfileId || safeNodes[0]?.id || ''
  );
  const [taskDepartment, setTaskDepartment] = useState<string>('');
  const [taskCustomDept, setTaskCustomDept] = useState<string>('');
  const [isTaskCustomDept, setIsTaskCustomDept] = useState<boolean>(false);
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskAttachments, setTaskAttachments] = useState<AttachmentItem[]>([]);
  const taskFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (type === 'tasks' && initialTaskDraft) {
      setTaskTitle(initialTaskDraft.title || '');
      setTaskDescription(initialTaskDraft.description || '');
      if (initialTaskDraft.priority) {
        setTaskPriority(initialTaskDraft.priority);
      }
      if (initialTaskDraft.assigned_to !== undefined) {
        setTaskAssignedTo(initialTaskDraft.assigned_to || '');
      } else if (currentProfileId) {
        setTaskAssignedTo(currentProfileId);
      }
      if (initialTaskDraft.department !== undefined) {
        setTaskDepartment(initialTaskDraft.department || '');
      }
      if (Array.isArray(initialTaskDraft.attachments)) {
        setTaskAttachments(initialTaskDraft.attachments);
      }
      return;
    }

    if (currentProfileId) {
      setTaskAssignedTo(currentProfileId);
    }
  }, [currentProfileId, type, initialTaskDraft]);

  // Employee fields
  const [empName, setEmpName] = useState('');
  const [empRoleTitle, setEmpRoleTitle] = useState('');
  const [empDepartment, setEmpDepartment] = useState('');
  const [empCustomDept, setEmpCustomDept] = useState('');
  const [isEmpCustomDept, setIsEmpCustomDept] = useState(false);
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
    deepLink: string | null;
    tgStartCmd: string;
    webLoginLink: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'code' | 'link' | 'weblink' | null>(null);

  // CRM Lead fields (БЛОК 3: реквизиты РФ и Global + Ответственный + Отдел)
  const [leadTitle, setLeadTitle] = useState('');
  const [leadClientName, setLeadClientName] = useState('');
  const [leadAmount, setLeadAmount] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadStatus, setLeadStatus] = useState<CrmLeadStatus>('New');
  const [leadJurisdiction, setLeadJurisdiction] = useState<CounterpartyJurisdiction>('RU');
  const [leadTaxId, setLeadTaxId] = useState('');
  const [leadRegNumber, setLeadRegNumber] = useState('');
  const [leadContractNumber, setLeadContractNumber] = useState('');
  const [leadAssignedTo, setLeadAssignedTo] = useState<string>(
    currentProfileId || safeNodes[0]?.id || ''
  );
  const [leadDepartment, setLeadDepartment] = useState<string>('');
  const [leadCustomDept, setLeadCustomDept] = useState<string>('');
  const [isLeadCustomDept, setIsLeadCustomDept] = useState<boolean>(false);

  if (!type) return null;

  const handleAccessLevelChange = (nextLevel: AccessLevel) => {
    setEmpAccessLevel(nextLevel);
    setEmpPermissions(getDefaultPermissionsForAccessLevel(nextLevel));
  };

  const togglePermission = (key: keyof EmployeePermissions) => {
    if (empAccessLevel === 'root') return;
    setEmpPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTaskFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { attachments, error } = await processFilesToAttachments(files, language);
    if (error) {
      setErrorMessage(error);
    }
    if (attachments.length > 0) {
      setTaskAttachments((prev) => [...prev, ...attachments]);
    }
    e.target.value = '';
  };

  const copyText = async (val: string, field: 'code' | 'link' | 'weblink') => {
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
      let newlyCreatedDept = '';

      if (type === 'tasks') {
        if (!taskTitle.trim()) {
          throw new Error(t('modal.taskTitleLabel'));
        }
        const resolvedTaskDept = isTaskCustomDept
          ? taskCustomDept.trim()
          : taskDepartment.trim();

        if (isTaskCustomDept && resolvedTaskDept) {
          newlyCreatedDept = resolvedTaskDept;
        }

        let enforcedAssignee: string | null = null;
        if (!canAssignTasks) {
          enforcedAssignee = currentProfileId || safeNodes[0]?.id || null;
        } else if (taskAssignedTo) {
          enforcedAssignee = taskAssignedTo;
        } else if (resolvedTaskDept) {
          enforcedAssignee = null;
        } else {
          enforcedAssignee = currentProfileId || safeNodes[0]?.id || null;
        }

        payload = {
          company_id: companyId,
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          type: taskType,
          priority: taskPriority,
          status: taskStatus,
          department: resolvedTaskDept || null,
          assigned_to: enforcedAssignee,
          owner_node_id: enforcedAssignee || currentProfileId || safeNodes[0]?.id || null,
          created_by: currentProfileId || enforcedAssignee || null,
          due_date: taskDueDate.trim() || null,
          attachments: taskAttachments,
        };
      } else if (type === 'organization_nodes') {
        if (!empName.trim() || !empRoleTitle.trim()) {
          throw new Error(t('modal.empRoleLabel'));
        }
        const resolvedEmpDept = isEmpCustomDept
          ? empCustomDept.trim()
          : empDepartment.trim();

        if (isEmpCustomDept && resolvedEmpDept) {
          newlyCreatedDept = resolvedEmpDept;
        }

        const inviteCode = generateCorporateInviteCode();
        payload = {
          company_id: companyId,
          name: empName.trim(),
          role_type: empRoleTitle.trim(),
          department: resolvedEmpDept || null,
          access_level: empAccessLevel,
          permissions:
            empAccessLevel === 'root'
              ? getDefaultPermissionsForAccessLevel('root')
              : empPermissions,
          email: empEmail.trim() || null,
          telegram_chat_id: empTelegramId.trim() ? String(empTelegramId.trim()) : null,
          invite_code: inviteCode,
          tree_path: 'root',
        };
      } else if (type === 'crm_leads') {
        if (!leadClientName.trim()) {
          throw new Error(t('modal.dealClientLabel'));
        }
        const resolvedLeadDept = isLeadCustomDept
          ? leadCustomDept.trim()
          : leadDepartment.trim();

        if (isLeadCustomDept && resolvedLeadDept) {
          newlyCreatedDept = resolvedLeadDept;
        }

        const resolvedLeadAssignee = leadAssignedTo
          ? leadAssignedTo
          : resolvedLeadDept
          ? null
          : currentProfileId || safeNodes[0]?.id || null;

        payload = {
          company_id: companyId,
          owner_node_id: resolvedLeadAssignee || currentProfileId || safeNodes[0]?.id || null,
          assigned_to: resolvedLeadAssignee,
          department: resolvedLeadDept || null,
          title: leadTitle.trim() || leadClientName.trim(),
          client_name: leadClientName.trim(),
          amount: Number(leadAmount) || 0,
          contact: leadContact.trim() || null,
          description: leadNotes.trim() || null,
          status: leadStatus,
          jurisdiction: leadJurisdiction,
          tax_id: leadTaxId.trim() || null,
          reg_number: leadRegNumber.trim() || null,
          contract_number: leadContractNumber.trim() || null,
        };
      }

      if (newlyCreatedDept && onAddCompanyDepartment) {
        await onAddCompanyDepartment(newlyCreatedDept);
      }

      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: type, payload }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        throw new Error(formatError(result?.error || `HTTP ${response.status}`));
      }

      const pushSent = Boolean(result.telegramPush?.pushed);
      await onSuccess(pushSent);

      if (type === 'organization_nodes') {
        const finalCode = result.data?.invite_code || payload.invite_code;
        const cleanBot = String(botUsername || '')
          .replace(/^@/, '')
          .trim();
        const validBot =
          cleanBot && cleanBot !== 'TedCloudEnterpriseBot' ? cleanBot : null;
        const origin =
          typeof window !== 'undefined' ? window.location.origin : 'https://tedcloud.vercel.app';
        setCreatedEmployeeInvite({
          name: payload.name,
          roleTitle: payload.role_type,
          inviteCode: finalCode,
          deepLink: validBot ? `https://t.me/${validBot}?start=${finalCode}` : null,
          tgStartCmd: `/start ${finalCode}`,
          webLoginLink: `${origin}/?invite=${encodeURIComponent(finalCode)}`,
        });
        return;
      }

      onClose();
    } catch (err: any) {
      console.error(`[AddRecordModal] Failed to insert into ${type}:`, err);
      setErrorMessage(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdEmployeeInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans">
        <div className="w-full max-w-lg rounded-xl border border-[#262626] bg-[#121214] shadow-2xl overflow-hidden">
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

            <div className="rounded-lg border border-[#262626] bg-[#17171A] p-3.5 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#8E8E93]">
                  {t('invite.codeLabel')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white font-semibold tabular-nums bg-[#242428] px-2.5 py-1 rounded border border-[#333338] whitespace-nowrap">
                    {createdEmployeeInvite.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(createdEmployeeInvite.inviteCode, 'code')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#242428] hover:bg-[#2E2E34] text-xs text-white transition-colors whitespace-nowrap"
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
                <label className="block text-[11px] font-medium text-[#8E8E93] mb-1.5">
                  {isEn
                    ? '1-Click Web Portal Sign-In Link'
                    : 'Прямая веб-ссылка для входа сотрудника (1 клик)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdEmployeeInvite.webLoginLink}
                    className="w-full h-10 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] px-3 text-xs text-[#E4E4E7] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(createdEmployeeInvite.webLoginLink, 'weblink')}
                    className="shrink-0 h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-[#E4E4E7] transition-colors whitespace-nowrap"
                  >
                    {copiedField === 'weblink' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('invite.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Copy Web Link' : 'Скопировать'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8E8E93] mb-1.5">
                  {createdEmployeeInvite.deepLink
                    ? t('invite.deepLinkLabel')
                    : isEn
                    ? 'Telegram Bot Activation Command'
                    : 'Команда активации в Telegram-боте'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdEmployeeInvite.deepLink || createdEmployeeInvite.tgStartCmd}
                    className="w-full h-10 rounded-xl border border-[#2A2A2E] bg-[#0D0D0F] px-3 text-xs text-[#E4E4E7] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        createdEmployeeInvite.deepLink || createdEmployeeInvite.tgStartCmd,
                        'link'
                      )
                    }
                    className="shrink-0 h-10 inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-medium border border-[#2E2E34] bg-[#1F1F24] text-white hover:bg-[#2A2A32] transition-colors whitespace-nowrap"
                  >
                    {copiedField === 'link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('invite.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Copy' : 'Скопировать'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {createdEmployeeInvite.deepLink ? (
                <a
                  href={createdEmployeeInvite.deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Telegram</span>
                </a>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl text-xs font-semibold bg-white text-black hover:bg-[#E4E4E7] transition-colors"
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
    <div className="fixed inset-0 z-50 overflow-y-auto no-scrollbar bg-black/75 backdrop-blur-sm p-4 font-sans flex items-center justify-center">
      <div className="w-[calc(100vw-24px)] max-w-2xl rounded-xl border border-[#262626] bg-[#121214] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262626]">
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

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
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
                  className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.taskDescLabel')}
                </label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder={t('modal.taskDescPlaceholder')}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5 truncate">
                    {t('modal.taskTypeLabel')}
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="Task">{t('type.Task')}</option>
                    <option value="Bug">{t('type.Bug')}</option>
                    <option value="Epic">{t('type.Epic')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5 truncate">
                    {t('modal.taskPriorityLabel')}
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="Low">{t('priority.Low')}</option>
                    <option value="Medium">{t('priority.Medium')}</option>
                    <option value="High">{t('priority.High')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5 truncate">
                    {t('modal.taskStatusLabel')}
                  </label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="Todo">{t('status.Todo')}</option>
                    <option value="In Progress">{t('status.In Progress')}</option>
                    <option value="Done">{t('status.Done')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5 truncate">
                    {isEn ? 'Due Date' : 'Дедлайн (Срок)'}
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full min-w-0 h-10 px-3 rounded-xl bg-zinc-900 border border-white/10 text-sm text-zinc-100 appearance-none tabular-nums focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.taskDepartmentLabel')}
                  </label>
                  {!isTaskCustomDept ? (
                    <select
                      value={taskDepartment}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsTaskCustomDept(true);
                          setTaskDepartment('');
                        } else {
                          setTaskDepartment(e.target.value);
                        }
                      }}
                      className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                    >
                      <option value="">{t('dept.noneOption')}</option>
                      {safeDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value="__custom__">{t('dept.customOption')}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={taskCustomDept}
                        onChange={(e) => setTaskCustomDept(e.target.value)}
                        placeholder={t('dept.customInputPlaceholder')}
                        className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsTaskCustomDept(false);
                          setTaskCustomDept('');
                        }}
                        className="px-2 py-2 text-xs text-[#8E8E93] hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.taskAssigneeLabel')}
                  </label>
                  <select
                    disabled={!canAssignTasks}
                    value={canAssignTasks ? taskAssignedTo : currentProfileId || ''}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="w-full h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed focus:border-zinc-500 focus:outline-none"
                  >
                    {canAssignTasks && (
                      <option value="">{t('modal.unassignedDeptBroadcast')}</option>
                    )}
                    {safeNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} — {formatRole(node.role_type)}
                        {node.department ? ` (${formatRole(node.department)})` : ''}
                      </option>
                    ))}
                  </select>
                  {!canAssignTasks ? (
                    <p className="text-[11px] text-[#71717A] mt-1">{t('tasks.selfAssignedNote')}</p>
                  ) : (
                    <p className="text-[11px] text-[#71717A] mt-1">
                      {t('modal.taskDepartmentHint')}
                    </p>
                  )}
                </div>
              </div>

              {/* Вложения к задаче (Фото, PDF, Документы) */}
              <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">
                      {isEn ? 'Task Attachments' : 'Вложения к задаче'}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {isEn
                        ? 'Photos (PNG, JPG, WEBP) or documents (PDF, DOCX, XLSX, ZIP up to 2 MB)'
                        : 'Фото (PNG, JPG, WEBP) или документы (PDF, DOCX, XLSX, ZIP до 2 МБ)'}
                    </div>
                  </div>
                  <input
                    ref={taskFileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_ATTACHMENT_TYPES}
                    onChange={handleTaskFilesSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => taskFileInputRef.current?.click()}
                    className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-100 inline-flex items-center gap-1.5 transition shrink-0"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Attach file' : 'Прикрепить'}</span>
                  </button>
                </div>
                {taskAttachments.length > 0 && (
                  <div className="mt-2.5">
                    <PendingAttachmentsStrip
                      attachments={taskAttachments}
                      onRemove={(id) =>
                        setTaskAttachments((prev) => prev.filter((item) => item.id !== id))
                      }
                      className="rounded-xl border border-white/[0.08]"
                    />
                  </div>
                )}
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
                  {!isEmpCustomDept ? (
                    <select
                      value={empDepartment}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsEmpCustomDept(true);
                          setEmpDepartment('');
                        } else {
                          setEmpDepartment(e.target.value);
                        }
                      }}
                      className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white focus:border-[#52525B] focus:outline-none"
                    >
                      <option value="">{t('dept.noneOption')}</option>
                      {safeDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value="__custom__">{t('dept.customOption')}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={empCustomDept}
                        onChange={(e) => setEmpCustomDept(e.target.value)}
                        placeholder={t('dept.customInputPlaceholder')}
                        className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsEmpCustomDept(false);
                          setEmpCustomDept('');
                        }}
                        className="px-2 py-2 text-xs text-[#8E8E93] hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

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
                  <option value="observer">{t('access.observer')}</option>
                </select>
              </div>

              <div className="rounded-lg border border-[#262626] bg-[#151518] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('perm.title')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  {PERMISSION_KEYS.map((permKey) => {
                    const isRootLocked = empAccessLevel === 'root';
                    const enabled = isRootLocked ? true : Boolean(empPermissions[permKey]);
                    return (
                      <div
                        key={permKey}
                        onClick={() => togglePermission(permKey)}
                        className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2.5 text-xs transition-colors select-none ${
                          enabled
                            ? 'border-[#2E2E36] bg-[#1B1B20]'
                            : 'border-[#222226] bg-[#121215]'
                        } ${
                          isRootLocked
                            ? 'opacity-80 cursor-not-allowed'
                            : 'cursor-pointer hover:border-[#3F3F46]'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-medium text-white font-sans leading-snug">
                            {t(`perm.${permKey}`)}
                          </div>
                          <div className="text-[11px] text-[#8E8E93] font-sans leading-snug mt-0.5 line-clamp-2">
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
                            togglePermission(permKey);
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                            enabled ? 'bg-emerald-500' : 'bg-[#2C2C30]'
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>

              {/* БЛОК 3: Переключатель юрисдикции контрагента и профессиональные реквизиты */}
              <div className="rounded-lg border border-[#262626] bg-[#151518] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-[#D4D4D8] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span>{t('modal.jurisdictionLabel')}</span>
                  </span>
                  <div className="inline-flex rounded-lg border border-[#262626] bg-[#0D0D0F] p-0.5">
                    <button
                      type="button"
                      onClick={() => setLeadJurisdiction('RU')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        leadJurisdiction === 'RU'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      {t('modal.jurisdictionRU')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadJurisdiction('GLOBAL')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors inline-flex items-center gap-1 ${
                        leadJurisdiction === 'GLOBAL'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>{t('modal.jurisdictionGlobal')}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      {leadJurisdiction === 'RU' ? t('modal.taxIdRu') : t('modal.taxIdGlobal')}
                    </label>
                    <input
                      type="text"
                      value={leadTaxId}
                      onChange={(e) => setLeadTaxId(e.target.value)}
                      placeholder={
                        leadJurisdiction === 'RU'
                          ? t('modal.taxIdRuPlaceholder')
                          : t('modal.taxIdGlobalPlaceholder')
                      }
                      className="w-full rounded-lg border border-[#262626] bg-[#111113] px-2.5 py-1.5 text-xs text-white tabular-nums placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      {leadJurisdiction === 'RU' ? t('modal.regNumRu') : t('modal.regNumGlobal')}
                    </label>
                    <input
                      type="text"
                      value={leadRegNumber}
                      onChange={(e) => setLeadRegNumber(e.target.value)}
                      placeholder={
                        leadJurisdiction === 'RU'
                          ? t('modal.regNumRuPlaceholder')
                          : t('modal.regNumGlobalPlaceholder')
                      }
                      className="w-full rounded-lg border border-[#262626] bg-[#111113] px-2.5 py-1.5 text-xs text-white tabular-nums placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      {t('modal.contractNumberLabel')}
                    </label>
                    <input
                      type="text"
                      value={leadContractNumber}
                      onChange={(e) => setLeadContractNumber(e.target.value)}
                      placeholder={t('modal.contractNumberPlaceholder')}
                      className="w-full rounded-lg border border-[#262626] bg-[#111113] px-2.5 py-1.5 text-xs text-white tabular-nums placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                    />
                  </div>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.dealDepartmentLabel')}
                  </label>
                  {!isLeadCustomDept ? (
                    <select
                      value={leadDepartment}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsLeadCustomDept(true);
                          setLeadDepartment('');
                        } else {
                          setLeadDepartment(e.target.value);
                        }
                      }}
                      className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-xs text-white focus:border-[#52525B] focus:outline-none"
                    >
                      <option value="">{t('dept.noneOption')}</option>
                      {safeDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value="__custom__">{t('dept.customOption')}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={leadCustomDept}
                        onChange={(e) => setLeadCustomDept(e.target.value)}
                        placeholder={t('dept.customInputPlaceholder')}
                        className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsLeadCustomDept(false);
                          setLeadCustomDept('');
                        }}
                        className="px-2 py-2 text-xs text-[#8E8E93] hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('modal.dealAssigneeLabel')}
                  </label>
                  <select
                    value={leadAssignedTo}
                    onChange={(e) => setLeadAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-xs text-white focus:border-[#52525B] focus:outline-none"
                  >
                    <option value="">{t('modal.unassignedDeptBroadcast')}</option>
                    {safeNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} — {formatRole(node.role_type)}
                        {node.department ? ` (${formatRole(node.department)})` : ''}
                      </option>
                    ))}
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

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  {t('modal.dealNotesLabel')}
                </label>
                <textarea
                  rows={2}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder={t('modal.dealNotesPlaceholder')}
                  className="w-full rounded-lg border border-[#262626] bg-[#171717] px-3 py-2 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
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
