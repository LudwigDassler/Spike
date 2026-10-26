import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  User,
  FileText,
  Save,
  Loader2,
  CheckSquare,
  Briefcase,
  History,
  Phone,
  Building2,
  MessageSquare,
  Send,
} from 'lucide-react';
import {
  CounterpartyJurisdiction,
  CrmLeadRecord,
  CrmLeadStatus,
  OrganizationNode,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkspaceMessageRecord,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

export type DrawerTarget =
  | { type: 'task'; record: TaskRecord }
  | { type: 'deal'; record: CrmLeadRecord }
  | null;

interface SlideOverDrawerProps {
  target: DrawerTarget;
  nodes: OrganizationNode[];
  departments?: string[];
  messages?: WorkspaceMessageRecord[];
  currentProfile?: OrganizationNode | null;
  canEditTasks: boolean;
  canAssignTasks: boolean;
  canEditCrm: boolean;
  onClose: () => void;
  onPatchRecord: (
    table: 'tasks' | 'crm_leads',
    id: string,
    updates: Record<string, any>
  ) => Promise<void>;
  onSendMessage?: (payload: Record<string, any>) => Promise<void>;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  target,
  nodes,
  departments = [],
  messages = [],
  currentProfile,
  canEditTasks,
  canAssignTasks,
  canEditCrm,
  onClose,
  onPatchRecord,
  onSendMessage,
}) => {
  const { t, formatMoney } = useLocale();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Deal legal requisites state
  const [jurisdiction, setJurisdiction] = useState<CounterpartyJurisdiction>('RU');
  const [taxId, setTaxId] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  // Comment stream state
  const [commentText, setCommentText] = useState('');
  const [commentUrgent, setCommentUrgent] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  const nodeMap = useMemo(() => {
    const map = new Map<string, OrganizationNode>();
    safeNodes.forEach((n) => {
      if (n && n.id) map.set(n.id, n);
    });
    return map;
  }, [safeNodes]);

  useEffect(() => {
    if (!target || !target.record) return;
    setNotes(target.record.description || target.record.notes || '');
    if (target.type === 'deal') {
      const lead = target.record as CrmLeadRecord;
      setJurisdiction(lead.jurisdiction === 'GLOBAL' ? 'GLOBAL' : 'RU');
      setTaxId(lead.tax_id || '');
      setRegNumber(lead.reg_number || '');
      setContractNumber(lead.contract_number || '');
    }
  }, [target]);

  if (!target || !target.record) return null;

  const isTask = target.type === 'task';
  const record = target.record;
  const table = isTask ? 'tasks' : 'crm_leads';

  const entityComments = safeMessages.filter((m) => {
    if (!m) return false;
    if (isTask) {
      return (
        m.task_id === record.id ||
        m.entity_id === record.id ||
        (m.target_type === 'task' && m.target_id === record.id)
      );
    }
    return (
      m.lead_id === record.id ||
      m.entity_id === record.id ||
      ((m.target_type === 'deal' || m.target_type === 'lead') && m.target_id === record.id)
    );
  });

  const createdAtFormatted = record.created_at
    ? new Date(record.created_at).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const authorNode = isTask
    ? (record as TaskRecord).created_by
      ? nodeMap.get((record as TaskRecord).created_by!)
      : (record as TaskRecord).owner_node_id
      ? nodeMap.get((record as TaskRecord).owner_node_id!)
      : null
    : (record as CrmLeadRecord).owner_node_id
    ? nodeMap.get((record as CrmLeadRecord).owner_node_id!)
    : null;

  const currentAssigneeId = isTask
    ? (record as TaskRecord).assigned_to
    : (record as CrmLeadRecord).assigned_to || (record as CrmLeadRecord).owner_node_id;

  const assigneeNode = currentAssigneeId ? nodeMap.get(currentAssigneeId) : null;

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isTask) {
        await onPatchRecord('tasks', record.id, {
          description: notes.trim(),
        });
      } else {
        await onPatchRecord('crm_leads', record.id, {
          description: notes.trim(),
          jurisdiction,
          tax_id: taxId.trim() || null,
          reg_number: regNumber.trim() || null,
          contract_number: contractNumber.trim() || null,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !onSendMessage) return;
    setIsSendingComment(true);
    try {
      const recipientId = currentAssigneeId || authorNode?.id || null;
      const entityTitle = isTask
        ? (record as TaskRecord).title
        : (record as CrmLeadRecord).client_name || (record as CrmLeadRecord).title || 'Сделка CRM';
      const cleanComment = commentText.trim();
      await onSendMessage({
        company_id: record.company_id,
        sender_id: currentProfile?.id || null,
        sender_name: currentProfile?.name || 'TedCloud',
        sender_role: currentProfile?.role_type || '',
        target_type: isTask ? 'task' : 'deal',
        target_id: record.id,
        target_label: entityTitle,
        recipient_id: recipientId,
        target_department: record.department || null,
        scope_type: isTask ? 'task' : 'deal',
        task_id: isTask ? record.id : null,
        lead_id: !isTask ? record.id : null,
        entity_id: record.id,
        entity_title: entityTitle,
        message_text: cleanComment,
        text: cleanComment,
        is_urgent: commentUrgent,
      });
      setCommentText('');
      setCommentUrgent(false);
    } finally {
      setIsSendingComment(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-[#111113] border-l border-[#262626] h-full flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div>
          {/* Drawer Header */}
          <div className="px-6 py-4 border-b border-[#222225] flex items-center justify-between sticky top-0 bg-[#111113] z-10">
            <div className="flex items-center gap-2.5">
              {isTask ? (
                <CheckSquare className="w-4 h-4 text-[#A1A1AA]" />
              ) : (
                <Briefcase className="w-4 h-4 text-[#A1A1AA]" />
              )}
              <span className="text-xs font-semibold text-[#D4D4D8] tracking-tight">
                {isTask ? t('drawer.taskHeader') : t('drawer.dealHeader')}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('drawer.close')}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#1C1C1F] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-base font-semibold text-white leading-snug">
                {isTask
                  ? (record as TaskRecord).title
                  : (record as CrmLeadRecord).client_name ||
                    (record as CrmLeadRecord).full_name ||
                    (record as CrmLeadRecord).title}
              </h2>
              {!isTask && (record as CrmLeadRecord).title && (
                <p className="text-xs text-[#8E8E93] mt-1">{(record as CrmLeadRecord).title}</p>
              )}
            </div>

            {/* Key Properties Grid */}
            <div className="rounded-lg border border-[#222225] bg-[#161618] divide-y divide-[#222225] text-xs">
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93] flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
                  {t('drawer.createdAt')}
                </span>
                <span className="text-white font-mono tabular-nums">{createdAtFormatted}</span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93] flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#71717A]" />
                  {t('drawer.author')}
                </span>
                <span className="text-white font-medium truncate">
                  {authorNode ? `${authorNode.name} (${authorNode.role_type})` : 'Система TedCloud'}
                </span>
              </div>

              {/* Department selector for both Task and Deal */}
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93] flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[#71717A]" />
                  {t('drawer.department')}
                </span>
                {(isTask && canAssignTasks) || (!isTask && canEditCrm) ? (
                  <select
                    value={record.department || ''}
                    onChange={(e) =>
                      void onPatchRecord(table, record.id, {
                        department: e.target.value || null,
                      })
                    }
                    className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white focus:outline-none max-w-[220px]"
                  >
                    <option value="">{t('dept.noneOption')}</option>
                    {safeDepartments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-white font-medium">
                    {record.department || t('dept.noneOption')}
                  </span>
                )}
              </div>

              {/* Assignee / Responsible Manager */}
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93]">{t('drawer.assignee')}</span>
                {(isTask && canAssignTasks) || (!isTask && canEditCrm) ? (
                  <select
                    value={currentAssigneeId || ''}
                    onChange={(e) =>
                      void onPatchRecord(table, record.id, {
                        assigned_to: e.target.value || null,
                      })
                    }
                    className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white focus:outline-none max-w-[220px]"
                  >
                    <option value="">{t('tasks.unassigned')}</option>
                    {safeNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} — {n.role_type}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-white font-medium">
                    {assigneeNode
                      ? `${assigneeNode.name} (${assigneeNode.role_type})`
                      : t('tasks.unassigned')}
                  </span>
                )}
              </div>

              {isTask ? (
                <>
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.status')}</span>
                    <select
                      disabled={!canEditTasks}
                      value={(record as TaskRecord).status || 'Todo'}
                      onChange={(e) =>
                        void onPatchRecord('tasks', record.id, {
                          status: e.target.value as TaskStatus,
                        })
                      }
                      className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white disabled:opacity-50 focus:outline-none"
                    >
                      <option value="Todo">{t('status.Todo')}</option>
                      <option value="In Progress">{t('status.In Progress')}</option>
                      <option value="Done">{t('status.Done')}</option>
                    </select>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.priority')}</span>
                    <select
                      disabled={!canEditTasks}
                      value={(record as TaskRecord).priority || 'Medium'}
                      onChange={(e) =>
                        void onPatchRecord('tasks', record.id, {
                          priority: e.target.value as TaskPriority,
                        })
                      }
                      className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white disabled:opacity-50 focus:outline-none"
                    >
                      <option value="Low">{t('priority.Low')}</option>
                      <option value="Medium">{t('priority.Medium')}</option>
                      <option value="High">{t('priority.High')}</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.dealAmount')}</span>
                    <span className="text-white font-semibold font-mono tabular-nums">
                      {formatMoney(
                        Number(
                          (record as CrmLeadRecord).amount ??
                            (record as CrmLeadRecord).deal_value ??
                            0
                        )
                      )}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93] flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#71717A]" />
                      {t('drawer.dealContact')}
                    </span>
                    <span className="text-white">
                      {(record as CrmLeadRecord).contact || (record as CrmLeadRecord).phone || '—'}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.status')}</span>
                    <select
                      disabled={!canEditCrm}
                      value={
                        ((record as CrmLeadRecord).status ||
                          (record as CrmLeadRecord).stage ||
                          'New') as CrmLeadStatus
                      }
                      onChange={(e) =>
                        void onPatchRecord('crm_leads', record.id, {
                          status: e.target.value as CrmLeadStatus,
                        })
                      }
                      className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white disabled:opacity-50 focus:outline-none"
                    >
                      <option value="New">{t('stage.New')}</option>
                      <option value="Negotiation">{t('stage.Negotiation')}</option>
                      <option value="Won">{t('stage.Won')}</option>
                      <option value="Lost">{t('stage.Lost')}</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* БЛОК 3: Юридические реквизиты контрагента в карточке сделки */}
            {!isTask && (
              <div className="rounded-lg border border-[#222225] bg-[#151518] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">
                    {t('drawer.dealRequisites')}
                  </span>
                  <div className="inline-flex rounded-md border border-[#2C2C30] bg-[#111113] p-0.5">
                    <button
                      type="button"
                      disabled={!canEditCrm}
                      onClick={() => setJurisdiction('RU')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        jurisdiction === 'RU'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      РФ / СНГ
                    </button>
                    <button
                      type="button"
                      disabled={!canEditCrm}
                      onClick={() => setJurisdiction('GLOBAL')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        jurisdiction === 'GLOBAL'
                          ? 'bg-white text-black font-semibold'
                          : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      Global
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[#8E8E93] mb-1">
                      {jurisdiction === 'RU' ? t('modal.taxIdRu') : t('modal.taxIdGlobal')}
                    </label>
                    <input
                      type="text"
                      disabled={!canEditCrm}
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="—"
                      className="w-full rounded-md border border-[#262626] bg-[#111113] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8E8E93] mb-1">
                      {jurisdiction === 'RU' ? t('modal.regNumRu') : t('modal.regNumGlobal')}
                    </label>
                    <input
                      type="text"
                      disabled={!canEditCrm}
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      placeholder="—"
                      className="w-full rounded-md border border-[#262626] bg-[#111113] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8E8E93] mb-1">
                      {t('modal.contractNumberLabel')}
                    </label>
                    <input
                      type="text"
                      disabled={!canEditCrm}
                      value={contractNumber}
                      onChange={(e) => setContractNumber(e.target.value)}
                      placeholder="—"
                      className="w-full rounded-md border border-[#262626] bg-[#111113] px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Working Description / Notes Form */}
            <form onSubmit={handleSaveNotes} className="space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-[#D4D4D8]">
                <FileText className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('drawer.notesLabel')}</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isTask ? !canEditTasks : !canEditCrm}
                placeholder={t('drawer.notesPlaceholder')}
                className="w-full rounded-lg border border-[#262626] bg-[#161618] p-3 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none leading-relaxed disabled:opacity-60"
              />
              {((isTask && canEditTasks) || (!isTask && canEditCrm)) && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{t('drawer.saveNotesBtn')}</span>
                  </button>
                </div>
              )}
            </form>

            {/* БЛОК 4: Поток комментариев (Инфополе) внутри задачи и сделки */}
            <div className="rounded-lg border border-[#222225] bg-[#141417] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('drawer.threadTitle')}</span>
                </div>
                <span className="text-[11px] font-mono text-[#71717A]">
                  {entityComments.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {entityComments.length === 0 ? (
                  <p className="text-xs text-[#71717A] py-2">{t('drawer.threadEmpty')}</p>
                ) : (
                  entityComments.map((msg) => {
                    const sender = msg.sender_id ? nodeMap.get(msg.sender_id) : null;
                    const senderLabel =
                      sender?.name || msg.sender_name || 'Сотрудник TedCloud';
                    const roleLabel = sender?.role_type || msg.sender_role || '';
                    const timeStr = msg.created_at
                      ? new Date(msg.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    return (
                      <div
                        key={msg.id}
                        className="rounded-lg border border-[#242428] bg-[#19191D] p-3 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">
                            {senderLabel}
                            {roleLabel ? (
                              <span className="text-[#8E8E93] font-normal"> · {roleLabel}</span>
                            ) : null}
                          </span>
                          <span className="text-[10px] font-mono text-[#71717A] shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                          {msg.message_text || msg.text || msg.content}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {onSendMessage && (
                <form onSubmit={handlePostComment} className="space-y-2 pt-1">
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t('drawer.threadPlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#111113] p-2.5 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-[#A1A1AA] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={commentUrgent}
                        onChange={(e) => setCommentUrgent(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-[#3F3F46] bg-[#0D0D0F]"
                      />
                      <span>Telegram Push</span>
                    </label>
                    <button
                      type="submit"
                      disabled={isSendingComment || !commentText.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      {isSendingComment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{t('drawer.threadSendBtn')}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Status History Log */}
            <div className="rounded-lg border border-[#222225] bg-[#141416] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#D4D4D8]">
                <History className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('drawer.historyTitle')}</span>
              </div>
              <div className="space-y-2.5 text-xs text-[#8E8E93] border-l border-[#2C2C30] pl-3 ml-1.5">
                <div>
                  <div className="text-white font-medium">{t('drawer.historyCreated')}</div>
                  <div className="text-[11px] font-mono tabular-nums text-[#71717A]">
                    {createdAtFormatted}
                  </div>
                </div>
                <div>
                  <div className="text-white font-medium">
                    {t('drawer.historyCurrent')}{' '}
                    <span className="text-emerald-400">
                      {isTask
                        ? t(`status.${(record as TaskRecord).status || 'Todo'}`)
                        : t(
                            `stage.${
                              (record as CrmLeadRecord).status ||
                              (record as CrmLeadRecord).stage ||
                              'New'
                            }`
                          )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#222225] bg-[#111113] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#2C2C30] bg-[#18181B] hover:bg-[#222226] text-xs font-medium text-white transition-colors whitespace-nowrap"
          >
            {t('drawer.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
