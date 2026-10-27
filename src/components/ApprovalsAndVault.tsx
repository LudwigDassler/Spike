import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  X,
  FileCheck2,
  Paperclip,
  Loader2,
  ShieldCheck,
  FolderOpen,
  Search,
  Pin,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Briefcase,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  AttachmentItem,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  PinnedPlaybookItem,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  PendingAttachmentsStrip,
  processAttachmentFiles,
} from './AttachmentSystem';
import {
  formatAttachmentSize,
  isImageAttachment,
  normalizeAttachments,
} from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

export type ApprovalCategoryKey =
  | 'invoice_expense'
  | 'contract_legal'
  | 'vacation_leave'
  | 'access_procurement';

export const APPROVAL_CATEGORIES: {
  key: ApprovalCategoryKey;
  ru: string;
  en: string;
  placeholderRu: string;
  placeholderEn: string;
}[] = [
  {
    key: 'invoice_expense',
    ru: 'Оплата счета / Расход',
    en: 'Invoice Payment / Expense',
    placeholderRu: 'Оплата счета №45 за облачные серверы — 45 000 ₽',
    placeholderEn: 'Invoice #45 for cloud infrastructure — $1,250',
  },
  {
    key: 'contract_legal',
    ru: 'Согласование договора',
    en: 'Contract Approval',
    placeholderRu: 'Договор поставки № ДГ-2026/18 с ООО ТехноСнаб — 890 000 ₽',
    placeholderEn: 'Master Services Agreement #MSA-2026/18 with Acme Corp',
  },
  {
    key: 'vacation_leave',
    ru: 'Отпуск / Отгул',
    en: 'Time Off / Vacation',
    placeholderRu: 'Ежегодный оплачиваемый отпуск: 10.11.2026 – 24.11.2026 (14 дн.)',
    placeholderEn: 'Paid annual leave: Nov 10 – Nov 24 (14 days)',
  },
  {
    key: 'access_procurement',
    ru: 'Выдача доступа / Закупка',
    en: 'Access / Procurement Request',
    placeholderRu: 'Доступ к контуру аналитики CRM и закупка 5 лицензий — 25 000 ₽',
    placeholderEn: 'Production database access & 5 enterprise seat licenses',
  },
];

interface RequestApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currentProfile: OrganizationNode | null;
  nodes: OrganizationNode[];
  onCreated: () => Promise<void>;
  showToast: (msg: string) => void;
}

export const RequestApprovalModal: React.FC<RequestApprovalModalProps> = ({
  isOpen,
  onClose,
  companyId,
  currentProfile,
  nodes,
  onCreated,
  showToast,
}) => {
  const { language, formatRole } = useLocale();
  const isEn = language === 'en';

  const defaultApproverId = useMemo(() => {
    const rootOrMgr = nodes.find(
      (n) =>
        (n.access_level === 'root' || n.access_level === 'manager') &&
        n.id !== currentProfile?.id
    );
    if (rootOrMgr) return rootOrMgr.id;
    const anyRoot = nodes.find((n) => n.access_level === 'root');
    return anyRoot?.id || nodes[0]?.id || '';
  }, [nodes, currentProfile]);

  const [category, setCategory] = useState<ApprovalCategoryKey>('invoice_expense');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [approverId, setApproverId] = useState<string>(defaultApproverId);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const activeCategoryMeta =
    APPROVAL_CATEGORIES.find((c) => c.key === category) || APPROVAL_CATEGORIES[0];

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingFile(true);
    try {
      const uploaded = await processAttachmentFiles(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      showToast(err?.message || (isEn ? 'Failed to attach file' : 'Ошибка прикрепления файла'));
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSubject = subject.trim();
    if (!cleanSubject || isSubmitting) return;

    const categoryLabel = isEn ? activeCategoryMeta.en : activeCategoryMeta.ru;
    const fullTitle = cleanSubject.startsWith('[')
      ? cleanSubject
      : `[${categoryLabel}] ${cleanSubject}`;

    const targetApprover = approverId || defaultApproverId || currentProfile?.id || null;
    const approverNode = nodes.find((n) => n.id === targetApprover);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          payload: {
            company_id: companyId,
            title: fullTitle,
            description:
              details.trim() ||
              (isEn
                ? `Approval category: ${categoryLabel}. Requested by ${
                    currentProfile?.name || 'Employee'
                  }.`
                : `Категория согласования: ${categoryLabel}. Инициатор: ${
                    currentProfile?.name || 'Сотрудник'
                  }.`),
            type: 'approval',
            priority: 'High',
            status: 'Todo',
            department: approverNode?.department || currentProfile?.department || null,
            assigned_to: targetApprover,
            owner_node_id: targetApprover,
            created_by: currentProfile?.id || targetApprover,
            actor_name: currentProfile?.name || 'Сотрудник',
            attachments,
          },
        }),
      });

      if (res.ok) {
        setSubject('');
        setDetails('');
        setAttachments([]);
        await onCreated();
        onClose();
        showToast(
          isEn
            ? 'Approval request sent to manager and pushed to Telegram'
            : 'Запрос на согласование отправлен руководителю и доставлен в Telegram'
        );
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || (isEn ? 'Error creating request' : 'Ошибка создания заявки'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111115] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {isEn ? 'New Corporate Approval Request' : 'Новый запрос на согласование'}
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {isEn
                  ? '1-Click manager decision in Web & Telegram with Audit Log record'
                  : 'Решение руководителя в 1 клик на сайте и в Telegram с записью в Audit Log'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 1. Тип запроса */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {isEn ? '1. Request Type' : '1. Тип запроса'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {APPROVAL_CATEGORIES.map((item) => {
                const isSelected = category === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCategory(item.key)}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all truncate ${
                      isSelected
                        ? 'bg-white text-black border-white font-semibold shadow-sm'
                        : 'bg-[#17171C] text-zinc-300 border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    {isEn ? item.en : item.ru}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Предмет и сумма / период */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {isEn ? '2. Subject & Amount / Period' : '2. Предмет и сумма / период'}
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                isEn ? activeCategoryMeta.placeholderEn : activeCategoryMeta.placeholderRu
              }
              className="w-full rounded-xl border border-white/10 bg-[#17171C] px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/30"
            />
          </div>

          {/* 3. Согласующий руководитель */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {isEn ? '3. Approving Executive / Manager' : '3. Согласующий руководитель'}
            </label>
            <select
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#17171C] px-3.5 py-2 text-xs text-white focus:border-white/30"
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name} — {formatRole(node.role_type)}
                  {node.access_level === 'root'
                    ? isEn
                      ? ' (Superadmin)'
                      : ' (Суперадмин)'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Дополнительные реквизиты / обоснование */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {isEn ? 'Justification / Payment Requisites (optional)' : 'Обоснование / реквизиты (необязательно)'}
            </label>
            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                isEn
                  ? 'Counterparty, invoice number, budget line, or comment for approver...'
                  : 'Контрагент, номер счета, статья бюджета или комментарий для руководителя...'
              }
              className="w-full rounded-xl border border-white/10 bg-[#17171C] px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-white/30 resize-none"
            />
          </div>

          {/* 4. Вложение (Счет / Документ) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                {isEn ? '4. Attachment (Invoice / Contract / Scan)' : '4. Вложение (Счет / Документ)'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_ATTACHMENT_TYPES}
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                disabled={isProcessingFile}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#17171C] hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors"
              >
                {isProcessingFile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>{isEn ? 'Attach File / Invoice' : 'Прикрепить счет / документ'}</span>
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-[#15151A]">
                <PendingAttachmentsStrip
                  attachments={attachments}
                  onRemove={(id) =>
                    setAttachments((prev) => prev.filter((item) => item.id !== id))
                  }
                />
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-white/10 bg-[#17171C] hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
            >
              {isEn ? 'Cancel' : 'Отмена'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim()}
              className="tc-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-xs font-semibold transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCheck2 className="w-3.5 h-3.5" />
              )}
              <span>
                {isSubmitting
                  ? isEn
                    ? 'Submitting...'
                    : 'Отправка...'
                  : isEn
                  ? 'Submit for Approval'
                  : 'Отправить на согласование'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ApprovalDecisionBarProps {
  task: TaskRecord;
  currentProfile?: OrganizationNode | null;
  isBusy?: boolean;
  canDecide?: boolean;
  onDecide?: (task: TaskRecord, approved: boolean) => void;
  onDecision?: (taskId: string, decision: 'approve' | 'reject') => void;
}

export const ApprovalDecisionBar: React.FC<ApprovalDecisionBarProps> = ({
  task,
  currentProfile,
  isBusy,
  canDecide,
  onDecide,
  onDecision,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const isApproval =
    String(task.type || '').trim().toLowerCase() === 'approval' ||
    (task.title || '').startsWith('[СОГЛАСОВАНИЕ:');
  if (!isApproval) return null;

  const effectiveCanDecide =
    typeof canDecide === 'boolean'
      ? canDecide
      : Boolean(
          currentProfile &&
            (currentProfile.access_level === 'root' ||
              currentProfile.access_level === 'lead' ||
              task.assigned_to === currentProfile.id)
        );

  if (task.status === 'Done') {
    return (
      <div className="mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
          <Check className="w-3 h-3" />
          <span>{isEn ? 'Approved' : 'Утверждено'}</span>
        </span>
      </div>
    );
  }

  if (task.status === 'Cancelled') {
    return (
      <div className="mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] font-semibold text-red-400 whitespace-nowrap">
          <X className="w-3 h-3" />
          <span>{isEn ? 'Rejected' : 'Отклонено'}</span>
        </span>
      </div>
    );
  }

  if (!effectiveCanDecide) {
    return (
      <div className="mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium text-amber-300 whitespace-nowrap">
          <span>{isEn ? 'Pending Approval' : 'На согласовании'}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="mt-2 inline-flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={isBusy}
        onClick={() => {
          if (onDecision) onDecision(task.id, 'approve');
          else if (onDecide) onDecide(task, true);
        }}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-[11px] font-semibold text-emerald-400 transition-colors whitespace-nowrap"
      >
        <Check className="w-3.5 h-3.5" />
        <span>{isEn ? 'Approve' : 'Утвердить'}</span>
      </button>
      <button
        type="button"
        disabled={isBusy}
        onClick={() => {
          if (onDecision) onDecision(task.id, 'reject');
          else if (onDecide) onDecide(task, false);
        }}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-[11px] font-semibold text-red-400 transition-colors whitespace-nowrap"
      >
        <X className="w-3.5 h-3.5" />
        <span>{isEn ? 'Reject' : 'Отклонить'}</span>
      </button>
    </div>
  );
};

// ============================================================================
// БЛОК 4: ЕДИНЫЙ РЕЕСТР ДОКУМЕНТОВ И РЕГЛАМЕНТЫ (SMART DOCUMENT VAULT)
// ============================================================================

export type VaultSourceCategory = 'all' | 'deals' | 'tasks' | 'chat';

export interface IndexedVaultDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  sourceCategory: 'deals' | 'tasks' | 'chat';
  sourceEntityId: string;
  sourceTitle: string;
  authorName: string;
  createdAt: string;
  isApprovalAttachment?: boolean;
}

interface SmartDocumentVaultProps {
  company: Company | null;
  companyId?: string;
  currentProfile: OrganizationNode | null;
  isRootAdmin?: boolean;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  messages: WorkspaceMessageRecord[];
  onPatchRecord?: (
    table: string,
    id: string,
    updates: Record<string, any>
  ) => Promise<{ ok: boolean; pushSent?: boolean }>;
  onUpdateCompanyBillingDetails?: (nextDetails: any) => Promise<void>;
  onOpenTask?: (taskId: string) => void;
  onOpenLead?: (leadId: string) => void;
  onOpenTaskDrawer?: (taskId: string) => void;
  onOpenDealDrawer?: (dealId: string) => void;
  showToast?: (msg: string) => void;
}

const DEFAULT_CORPORATE_PLAYBOOKS: PinnedPlaybookItem[] = [
  {
    id: 'pb_default_1',
    title: 'Регламент согласования договоров, счетов и закупок (SLA 24ч)',
    category: 'Финансы и Договоры',
    url: 'data:text/plain;charset=utf-8,' +
      encodeURIComponent(
        'РЕГЛАМЕНТ СОГЛАСОВАНИЯ ДОГОВОРОВ И СЧЕТОВ TEDCLOUD ENTERPRISE\n\n1. Все счета от 15 000 ₽ проходят согласование через раздел «Задачи -> Согласования и Заявки».\n2. Срок рассмотрения руководителем (SLA) — до 24 часов.\n3. При нажатии «Утвердить» запись автоматически фиксируется в Audit Log и автору отправляется уведомление в Telegram.'
      ),
    mimeType: 'text/plain',
    size: 4200,
    pinned_at: '2026-10-01T09:00:00.000Z',
    pinned_by: 'Администрация компании',
  },
  {
    id: 'pb_default_2',
    title: 'Стандарт информационной безопасности и матрицы RBAC (7 контуров)',
    category: 'Безопасность (RBAC)',
    url: 'data:text/plain;charset=utf-8,' +
      encodeURIComponent(
        'СТАНДАРТ ИНФОРМАЦИОННОЙ БЕЗОПАСНОСТИ И ДОСТУПА TEDCLOUD\n\n1. Доступ сотрудников разграничивается по 4 пресетам (Root, Manager, Member, Observer) и 7 гранулярным флагам.\n2. Персональный инвайт-код TC-XXXX используется для привязки Telegram-бота и веб-сессии.\n3. Все критические операции фиксируются в неизменяемом журнале аудита.'
      ),
    mimeType: 'text/plain',
    size: 3850,
    pinned_at: '2026-10-05T10:00:00.000Z',
    pinned_by: 'Служба безопасности',
  },
];

export const SmartDocumentVault: React.FC<SmartDocumentVaultProps> = ({
  company,
  companyId: companyIdProp,
  currentProfile,
  isRootAdmin: isRootAdminProp,
  nodes,
  tasks,
  leads,
  messages,
  onPatchRecord,
  onUpdateCompanyBillingDetails,
  onOpenTask: onOpenTaskProp,
  onOpenLead: onOpenLeadProp,
  onOpenTaskDrawer,
  onOpenDealDrawer,
  showToast,
}) => {
  const { language, theme } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';
  const companyId = companyIdProp || company?.id || 'default';
  const isRootAdmin =
    typeof isRootAdminProp === 'boolean'
      ? isRootAdminProp
      : currentProfile?.access_level === 'root';
  const onOpenTask = onOpenTaskProp || onOpenTaskDrawer;
  const onOpenLead = onOpenLeadProp || onOpenDealDrawer;

  const [activeTab, setActiveTab] = useState<VaultSourceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddPlaybookOpen, setIsAddPlaybookOpen] = useState(false);
  const [newPlaybookTitle, setNewPlaybookTitle] = useState('');
  const [newPlaybookCategory, setNewPlaybookCategory] = useState(
    isEn ? 'Corporate Policy' : 'Регламент компании'
  );
  const [newPlaybookAttachments, setNewPlaybookAttachments] = useState<AttachmentItem[]>([]);
  const [isSavingPlaybook, setIsSavingPlaybook] = useState(false);
  const playbookFileRef = useRef<HTMLInputElement | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, OrganizationNode>();
    nodes.forEach((n) => map.set(String(n.id), n));
    return map;
  }, [nodes]);

  const localStoragePlaybooksKey = `tedcloud_pinned_playbooks_${companyId || 'default'}`;

  const [localPlaybooks, setLocalPlaybooks] = useState<PinnedPlaybookItem[]>(() => {
    try {
      const raw = localStorage.getItem(localStoragePlaybooksKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_CORPORATE_PLAYBOOKS;
  });

  const pinnedPlaybooks: PinnedPlaybookItem[] = useMemo(() => {
    const fromCompany = company?.billing_details?.pinned_playbooks;
    if (Array.isArray(fromCompany) && fromCompany.length > 0) {
      return fromCompany;
    }
    return localPlaybooks;
  }, [company, localPlaybooks]);

  const persistPlaybooks = async (nextList: PinnedPlaybookItem[]) => {
    setLocalPlaybooks(nextList);
    try {
      localStorage.setItem(localStoragePlaybooksKey, JSON.stringify(nextList));
    } catch {}

    if (company?.id) {
      await onPatchRecord('companies', company.id, {
        billing_details: {
          ...(company.billing_details || {}),
          pinned_playbooks: nextList,
        },
      });
    }
  };

  // Автоматическая индексация всех вложений компании (Сделки CRM, Задачи, Согласования, Чат)
  const indexedDocuments: IndexedVaultDocument[] = useMemo(() => {
    const docs: IndexedVaultDocument[] = [];

    // 1. Вложения из сделок CRM
    leads.forEach((lead) => {
      const list = normalizeAttachments((lead as any).attachments);
      const author =
        (lead.assigned_to && nodeMap.get(String(lead.assigned_to))?.name) ||
        (lead.owner_node_id && nodeMap.get(String(lead.owner_node_id))?.name) ||
        (isEn ? 'CRM Manager' : 'Менеджер CRM');
      const dealLabel = lead.client_name || lead.full_name || lead.title || 'CRM';

      list.forEach((att) => {
        docs.push({
          id: `lead_${lead.id}_${att.id}`,
          name: att.name,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
          sourceCategory: 'deals',
          sourceEntityId: lead.id,
          sourceTitle: dealLabel,
          authorName: author,
          createdAt: lead.created_at || new Date().toISOString(),
        });
      });
    });

    // 2. Вложения из задач и заявок на согласование
    tasks.forEach((task) => {
      const list = normalizeAttachments(task.attachments);
      const author =
        (task.created_by && nodeMap.get(String(task.created_by))?.name) ||
        (task.assigned_to && nodeMap.get(String(task.assigned_to))?.name) ||
        (isEn ? 'Employee' : 'Сотрудник');
      const isApproval = String(task.type || '').toLowerCase() === 'approval';

      list.forEach((att) => {
        docs.push({
          id: `task_${task.id}_${att.id}`,
          name: att.name,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
          sourceCategory: 'tasks',
          sourceEntityId: task.id,
          sourceTitle: task.title,
          authorName: author,
          createdAt: task.created_at || new Date().toISOString(),
          isApprovalAttachment: isApproval,
        });
      });
    });

    // 3. Вложения из корпоративного чата
    messages.forEach((msg) => {
      const list = normalizeAttachments(msg.attachments);
      const author =
        (msg.sender_id && nodeMap.get(String(msg.sender_id))?.name) ||
        msg.sender_name ||
        (isEn ? 'Employee' : 'Сотрудник');
      const channelTitle =
        msg.target_label ||
        msg.target_department ||
        (isEn ? 'Corporate Chat' : 'Корпоративный чат');

      list.forEach((att) => {
        docs.push({
          id: `msg_${msg.id}_${att.id}`,
          name: att.name,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
          sourceCategory: 'chat',
          sourceEntityId: msg.id,
          sourceTitle: channelTitle,
          authorName: author,
          createdAt: msg.created_at || new Date().toISOString(),
        });
      });
    });

    return docs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [leads, tasks, messages, nodeMap, isEn]);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return indexedDocuments.filter((doc) => {
      const matchesTab = activeTab === 'all' || doc.sourceCategory === activeTab;
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.sourceTitle.toLowerCase().includes(q) ||
        doc.authorName.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [indexedDocuments, activeTab, searchQuery]);

  const counts = useMemo(
    () => ({
      all: indexedDocuments.length,
      deals: indexedDocuments.filter((d) => d.sourceCategory === 'deals').length,
      tasks: indexedDocuments.filter((d) => d.sourceCategory === 'tasks').length,
      chat: indexedDocuments.filter((d) => d.sourceCategory === 'chat').length,
    }),
    [indexedDocuments]
  );

  const handlePinDocumentAsPlaybook = async (doc: IndexedVaultDocument) => {
    if (!isRootAdmin) return;
    const exists = pinnedPlaybooks.some((p) => p.title === doc.name);
    if (exists) {
      showToast(isEn ? 'Document is already pinned' : 'Документ уже закреплен в регламентах');
      return;
    }
    const newItem: PinnedPlaybookItem = {
      id: `pb_${Date.now()}`,
      title: doc.name,
      category: doc.sourceTitle,
      url: doc.url,
      mimeType: doc.mimeType,
      size: doc.size,
      pinned_at: new Date().toISOString(),
      pinned_by: currentProfile?.name || 'Суперадмин',
    };
    await persistPlaybooks([newItem, ...pinnedPlaybooks]);
    showToast(
      isEn
        ? 'Document pinned to Company Playbooks'
        : 'Документ закреплен в регламентах компании'
    );
  };

  const handleRemovePlaybook = async (id: string) => {
    if (!isRootAdmin) return;
    const next = pinnedPlaybooks.filter((p) => p.id !== id);
    await persistPlaybooks(next);
    showToast(isEn ? 'Playbook unpinned' : 'Регламент откреплен');
  };

  const handlePlaybookFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const uploaded = await processAttachmentFiles(files);
      setNewPlaybookAttachments(uploaded);
      if (!newPlaybookTitle.trim() && uploaded[0]?.name) {
        setNewPlaybookTitle(uploaded[0].name);
      }
    } catch (err: any) {
      showToast(err?.message || (isEn ? 'Error reading file' : 'Ошибка чтения файла'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleCreatePlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaybookTitle.trim() || isSavingPlaybook) return;
    setIsSavingPlaybook(true);
    try {
      const firstAtt = newPlaybookAttachments[0];
      const newPb: PinnedPlaybookItem = {
        id: `pb_${Date.now()}`,
        title: newPlaybookTitle.trim(),
        category: newPlaybookCategory.trim() || (isEn ? 'Regulation' : 'Регламент'),
        url:
          firstAtt?.url ||
          'data:text/plain;charset=utf-8,' + encodeURIComponent(newPlaybookTitle.trim()),
        mimeType: firstAtt?.mimeType || 'application/pdf',
        size: firstAtt?.size || 2400,
        pinned_at: new Date().toISOString(),
        pinned_by: currentProfile?.name || 'Суперадмин',
      };
      await persistPlaybooks([newPb, ...pinnedPlaybooks]);
      setNewPlaybookTitle('');
      setNewPlaybookAttachments([]);
      setIsAddPlaybookOpen(false);
      showToast(
        isEn
          ? 'Corporate playbook published for all employees'
          : 'Регламент закреплен для всех сотрудников компании'
      );
    } finally {
      setIsSavingPlaybook(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111114] shadow-2xl overflow-hidden p-5 space-y-6">
      {/* 1. БЛОК ЗАКРЕПЛЕННЫХ РЕГЛАМЕНТОВ КОМПАНИИ (Pinned Company Playbooks) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/[0.07] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Pin className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                {isEn
                  ? 'Pinned Company Playbooks & Regulations'
                  : 'Закрепленные регламенты компании'}
              </h3>
              <p className="text-[11px] text-[#8E8E93]">
                {isEn
                  ? 'Mandatory corporate standards, onboarding guides, and approval policies in 1-click access'
                  : 'Корпоративные стандарты, инструкции и шаблоны документов в 1 клик для всех сотрудников'}
              </p>
            </div>
          </div>

          {isRootAdmin && (
            <button
              type="button"
              onClick={() => setIsAddPlaybookOpen((prev) => !prev)}
              className="tc-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#17171C] hover:bg-zinc-800 text-xs font-medium text-white transition-colors self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isEn ? '+ Pin Regulation' : '+ Закрепить регламент'}</span>
            </button>
          )}
        </div>

        {isAddPlaybookOpen && isRootAdmin && (
          <form
            onSubmit={handleCreatePlaybook}
            className="rounded-xl border border-white/10 bg-[#16161C] p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {isEn ? 'Regulation / Playbook Title' : 'Название регламента или документа'}
                </label>
                <input
                  type="text"
                  required
                  value={newPlaybookTitle}
                  onChange={(e) => setNewPlaybookTitle(e.target.value)}
                  placeholder={
                    isEn
                      ? 'e.g. Commercial Deal Approval Policy 2026'
                      : 'Например: Регламент финансового контроля и оплаты счетов'
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111115] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {isEn ? 'Department / Category' : 'Категория / Отдел'}
                </label>
                <input
                  type="text"
                  value={newPlaybookCategory}
                  onChange={(e) => setNewPlaybookCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111115] px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  ref={playbookFileRef}
                  type="file"
                  accept={ACCEPTED_ATTACHMENT_TYPES}
                  onChange={handlePlaybookFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => playbookFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#111115] hover:bg-zinc-800 text-xs text-zinc-300"
                >
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {newPlaybookAttachments[0]
                      ? newPlaybookAttachments[0].name
                      : isEn
                      ? 'Upload File (PDF / Doc / Image)'
                      : 'Загрузить файл регламента'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPlaybookOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  {isEn ? 'Cancel' : 'Отмена'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlaybook || !newPlaybookTitle.trim()}
                  className="tc-btn-primary px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-semibold"
                >
                  {isEn ? 'Pin to Vault' : 'Закрепить в реестре'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pinnedPlaybooks.map((pb) => (
            <div
              key={pb.id}
              className="rounded-xl border border-white/[0.08] bg-[#15151A] p-3.5 flex items-center justify-between gap-3 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{pb.title}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[#8E8E93]">
                    <span className="px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-[10px] text-zinc-300">
                      {pb.category}
                    </span>
                    <span className="tabular-nums">{formatAttachmentSize(pb.size)}</span>
                    {pb.pinned_by && <span>· {pb.pinned_by}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={pb.url}
                  download={pb.title}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#1C1C22] hover:bg-zinc-800 text-[11px] font-medium text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">{isEn ? 'Open' : 'Открыть'}</span>
                </a>
                {isRootAdmin && (
                  <button
                    type="button"
                    onClick={() => void handleRemovePlaybook(pb.id)}
                    title={isEn ? 'Unpin playbook' : 'Открепить регламент'}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. АВТОМАТИЧЕСКИЙ РЕЕСТР ВСЕХ ВЛОЖЕНИЙ КОМПАНИИ (Smart Attachment Registry) */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Вкладки фильтрации по источнику */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'all' as VaultSourceCategory,
                  label: isEn ? 'All Files' : 'Все файлы',
                  count: counts.all,
                },
                {
                  id: 'deals' as VaultSourceCategory,
                  label: isEn ? 'From Deals & Invoices' : 'Из сделок и счетов',
                  count: counts.deals,
                },
                {
                  id: 'tasks' as VaultSourceCategory,
                  label: isEn ? 'From Tasks & Approvals' : 'Из задач и согласований',
                  count: counts.tasks,
                },
                {
                  id: 'chat' as VaultSourceCategory,
                  label: isEn ? 'From Chat' : 'Из чата',
                  count: counts.chat,
                },
              ]
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    active
                      ? isLight
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-sm'
                        : 'bg-white text-black border-white font-semibold'
                      : isLight
                      ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      : 'bg-[#16161B] text-[#A1A1AA] border-white/[0.08] hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                      active
                        ? isLight
                          ? 'bg-white/20 text-white'
                          : 'bg-black/15 text-black'
                        : isLight
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-white/[0.06] text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Поиск по названию файла или карточке-источнику */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isEn
                  ? 'Search files, invoices, contracts...'
                  : 'Поиск по имени файла, сделке или задаче...'
              }
              className="w-full h-9 rounded-xl border border-white/10 bg-[#16161B] pl-9 pr-3 text-xs text-white placeholder:text-zinc-500"
            />
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#141418] p-8 text-center space-y-2">
            <FolderOpen className="w-6 h-6 text-indigo-400 mx-auto" />
            <div className="text-xs font-semibold text-white">
              {isEn
                ? 'No indexed attachments in this filter yet'
                : 'В выбранной категории пока нет прикрепленных файлов'}
            </div>
            <p className="text-[11px] text-[#8E8E93] max-w-md mx-auto">
              {isEn
                ? 'Any file or screenshot attached to a Task, Approval Request, CRM Deal, or Corporate Chat message automatically appears here.'
                : 'Все файлы, счета и скриншоты, прикрепленные к задачам, заявкам на согласование, сделкам CRM и сообщениям чата, автоматически индексируются в этом реестре.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#141418] overflow-hidden">
            {filteredDocuments.map((doc) => {
              const isImg = isImageAttachment(doc);
              return (
                <div
                  key={doc.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                      {isImg ? (
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {doc.name}
                        </span>
                        <span className="text-[10px] tabular-nums text-zinc-400">
                          {formatAttachmentSize(doc.size)}
                        </span>
                        {doc.isApprovalAttachment && (
                          <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-medium text-indigo-300">
                            {isEn ? 'Approval Doc' : 'Документ согласования'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[#8E8E93]">
                        <span className="inline-flex items-center gap-1 text-zinc-300">
                          {doc.sourceCategory === 'deals' ? (
                            <Briefcase className="w-3 h-3 text-amber-400" />
                          ) : doc.sourceCategory === 'tasks' ? (
                            <CheckSquare className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <MessageSquare className="w-3 h-3 text-emerald-400" />
                          )}
                          <span className="truncate max-w-[240px]">{doc.sourceTitle}</span>
                        </span>
                        <span>· {doc.authorName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {doc.sourceCategory === 'tasks' && onOpenTask && (
                      <button
                        type="button"
                        onClick={() => onOpenTask(doc.sourceEntityId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#1A1A20] hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{isEn ? 'Open Task' : 'К задаче'}</span>
                      </button>
                    )}

                    {doc.sourceCategory === 'deals' && onOpenLead && (
                      <button
                        type="button"
                        onClick={() => onOpenLead(doc.sourceEntityId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#1A1A20] hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{isEn ? 'Open Deal' : 'К сделке'}</span>
                      </button>
                    )}

                    {isRootAdmin && (
                      <button
                        type="button"
                        onClick={() => void handlePinDocumentAsPlaybook(doc)}
                        title={
                          isEn
                            ? 'Pin to Company Playbooks'
                            : 'Закрепить в регламентах компании'
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#1A1A20] hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors"
                      >
                        <Pin className="w-3 h-3 text-indigo-400" />
                        <span className="hidden md:inline">
                          {isEn ? 'Pin' : 'В регламенты'}
                        </span>
                      </button>
                    )}

                    <a
                      href={doc.url}
                      download={doc.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-[11px] font-semibold transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>{isEn ? 'Download' : 'Скачать'}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
