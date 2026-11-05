import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Cpu,
  Plus,
  Trash2,
  Check,
  Clock,
  Paperclip,
} from 'lucide-react';
import {
  AttachmentItem,
  CounterpartyJurisdiction,
  CrmLeadRecord,
  CrmLeadStatus,
  OrganizationNode,
  TaskChecklistItem,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkspaceMessageRecord,
} from '../types/database';
import { buildBuiltInChecklistForTask, normalizeAttachments } from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  AttachmentListRenderer,
  PendingAttachmentsStrip,
  processFilesToAttachments,
} from './AttachmentSystem';
import { UserAvatar } from './UserAvatar';
import { TeddyPrismIcon } from './TedCloudAiDrawer';

export type DrawerTarget =
  | { type: 'task'; record: TaskRecord }
  | { type: 'deal'; record: CrmLeadRecord }
  | null;

interface SlideOverDrawerProps {
  target: DrawerTarget;
  nodes: OrganizationNode[];
  leads?: CrmLeadRecord[];
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
  onDeleteTask?: (taskId: string, taskTitle?: string) => Promise<void> | void;
  onOpenLegalDocs?: (deal: CrmLeadRecord) => void;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  target,
  nodes,
  leads = [],
  departments = [],
  messages = [],
  currentProfile,
  canEditTasks,
  canAssignTasks,
  canEditCrm,
  onClose,
  onPatchRecord,
  onSendMessage,
  onDeleteTask,
  onOpenLegalDocs,
}) => {
  const { t, language, formatRole, formatMoney } = useLocale();
  const isEn = language === 'en';
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dealRiskSummary, setDealRiskSummary] = useState<string>('');

  // Task checklist, attachments & AI decomposition state
  const [taskTitleDraft, setTaskTitleDraft] = useState<string>('');
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<AttachmentItem[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isDecomposing, setIsDecomposing] = useState(false);
  const taskAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  // Deal legal requisites state
  const [jurisdiction, setJurisdiction] = useState<CounterpartyJurisdiction>('RU');
  const [taxId, setTaxId] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  // Comment stream state
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<AttachmentItem[]>([]);
  const [commentUrgent, setCommentUrgent] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeLeads = Array.isArray(leads) ? leads : [];
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
    if (target.type === 'task') {
      const taskRec = target.record as TaskRecord;
      setTaskTitleDraft(taskRec.title || '');
      setChecklist(Array.isArray(taskRec.checklist) ? taskRec.checklist : []);
      setTaskAttachments(normalizeAttachments(taskRec.attachments));
      setAiSummary(taskRec.ai_summary || '');
    } else if (target.type === 'deal') {
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

  const handleUploadTaskAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !isTask) return;
    const { attachments } = await processFilesToAttachments(files, language);
    e.target.value = '';
    if (attachments.length > 0) {
      const next = [...taskAttachments, ...attachments];
      setTaskAttachments(next);
      await onPatchRecord('tasks', record.id, { attachments: next });
    }
  };

  const handleRemoveTaskAttachment = async (attId: string) => {
    if (!isTask || !canEditTasks) return;
    const next = taskAttachments.filter((a) => a.id !== attId);
    setTaskAttachments(next);
    await onPatchRecord('tasks', record.id, { attachments: next });
  };

  const handleCommentFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { attachments } = await processFilesToAttachments(files, language);
    e.target.value = '';
    if (attachments.length > 0) {
      setCommentAttachments((prev) => [...prev, ...attachments]);
    }
  };

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
    ? new Date(record.created_at).toLocaleString(isEn ? 'en-US' : 'ru-RU', {
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

  // ИИ-декомпозиция задачи (генерирует 4-5 подзадач и сохраняет в tasks.checklist)
  const handleAiDecomposeTask = async () => {
    if (!isTask || isDecomposing) return;
    const taskRec = record as TaskRecord;
    setIsDecomposing(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_assistant',
          mode: 'decompose_task',
          lang: language,
          task_id: taskRec.id,
          company_id: taskRec.company_id,
          taskTitle: taskRec.title,
          taskDescription: notes || taskRec.description || '',
        }),
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.checklist) && data.checklist.length > 0) {
        const nextChecklist: TaskChecklistItem[] = data.checklist;
        const nextSummary = data.aiSummary || '';
        setChecklist(nextChecklist);
        setAiSummary(nextSummary);
        await onPatchRecord('tasks', taskRec.id, {
          checklist: nextChecklist,
          ai_summary: nextSummary || null,
        });
        return;
      }
      throw new Error('Fallback to built-in decomposition');
    } catch {
      const builtIn = buildBuiltInChecklistForTask(
        taskRec.title,
        notes || taskRec.description,
        language
      );
      setChecklist(builtIn.checklist);
      setAiSummary(builtIn.summary);
      await onPatchRecord('tasks', taskRec.id, {
        checklist: builtIn.checklist,
        ai_summary: builtIn.summary,
      });
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    if (!isTask || !canEditTasks) return;
    const nextList = checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setChecklist(nextList);
    await onPatchRecord('tasks', record.id, { checklist: nextList });
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTask || !canEditTasks) return;
    const clean = newSubtaskTitle.trim();
    if (!clean) return;
    const nextItem: TaskChecklistItem = {
      id: `chk_${Date.now()}`,
      title: clean,
      done: false,
    };
    const nextList = [...checklist, nextItem];
    setChecklist(nextList);
    setNewSubtaskTitle('');
    await onPatchRecord('tasks', record.id, { checklist: nextList });
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!isTask || !canEditTasks) return;
    const nextList = checklist.filter((item) => item.id !== itemId);
    setChecklist(nextList);
    await onPatchRecord('tasks', record.id, { checklist: nextList });
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isTask) {
        await onPatchRecord('tasks', record.id, {
          description: notes.trim(),
          checklist,
          attachments: taskAttachments,
          ai_summary: aiSummary || null,
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
    if ((!commentText.trim() && commentAttachments.length === 0) || !onSendMessage) return;
    setIsSendingComment(true);
    try {
      const recipientId = currentAssigneeId || authorNode?.id || null;
      const entityTitle = isTask
        ? (record as TaskRecord).title
        : (record as CrmLeadRecord).client_name ||
          (record as CrmLeadRecord).title ||
          (isEn ? 'CRM Deal' : 'Сделка CRM');
      const cleanComment =
        commentText.trim() ||
        commentAttachments.map((a) => `[${a.name}]`).join(' ');
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
        attachments: commentAttachments,
        is_urgent: commentUrgent,
      });
      setCommentText('');
      setCommentAttachments([]);
      setCommentUrgent(false);
    } finally {
      setIsSendingComment(false);
    }
  };

  const doneCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // =========================================================================
  // CENTRAL 2-COLUMN ISSUE MODAL FOR TASKS (Linear / Jira Issue Modal Standard)
  // =========================================================================
  if (isTask) {
    const taskRec = record as TaskRecord;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md font-sans transition-opacity duration-200"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="max-w-2xl w-full max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#14161C] text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col no-scrollbar transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/90 dark:bg-[#181B22] sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/90 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight truncate">
                {t('drawer.taskHeader')}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.06] text-[10px] font-semibold text-slate-600 dark:text-[#8E8E93] tabular-nums">
                #{String(taskRec.id || '').slice(0, 6).toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('drawer.close')}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0">
            <div className="lg:col-span-8 p-6 space-y-5">
              <div>
                {canEditTasks ? (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                      {isEn ? 'Task Title (click to edit)' : 'Название поручения (редактируемое)'}
                    </label>
                    <input
                      type="text"
                      value={taskTitleDraft}
                      onChange={(e) => setTaskTitleDraft(e.target.value)}
                      onBlur={() => {
                        const clean = taskTitleDraft.trim();
                        if (clean && clean !== taskRec.title) {
                          void onPatchRecord('tasks', taskRec.id, { title: clean });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-full rounded-xl border border-white/10 bg-[#1A1D24] px-3.5 py-2.5 text-base font-semibold text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                ) : (
                  <h2 className="text-lg font-bold text-white leading-snug">{taskRec.title}</h2>
                )}
              </div>

              <form onSubmit={handleSaveNotes} className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-white">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t('drawer.notesLabel')}</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEditTasks}
                  placeholder={t('drawer.notesPlaceholder')}
                  className="w-full rounded-xl border border-white/10 bg-[#1A1D24] p-3 text-xs text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none leading-relaxed disabled:opacity-60"
                />
                {canEditTasks && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="tc-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
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

              <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">
                      {isEn
                        ? 'Checklist & AI Decomposition'
                        : 'Чек-лист и ИИ-декомпозиция'}{' '}
                      ({doneCount}/{totalCount})
                    </span>
                  </div>

                  {canEditTasks && (
                    <button
                      type="button"
                      disabled={isDecomposing}
                      onClick={() => void handleAiDecomposeTask()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200/90 dark:border-white/10 bg-slate-100 text-slate-800 hover:bg-slate-200/70 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      {isDecomposing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <TeddyPrismIcon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{isEn ? 'Break into Steps' : 'Разбить на шаги'}</span>
                    </button>
                  )}
                </div>

                {totalCount > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8E8E93] tabular-nums">
                      <span>
                        {isEn ? `Completed: ${progressPercent}%` : `Выполнено: ${progressPercent}%`}
                      </span>
                      <span>
                        {isEn ? `${doneCount} of ${totalCount}` : `${doneCount} из ${totalCount}`}
                      </span>
                    </div>
                  </div>
                )}

                {aiSummary && (
                  <div className="rounded-lg border border-white/10 bg-[#14161C] px-3 py-2 text-[11px] text-zinc-200 leading-relaxed">
                    <strong className="text-indigo-400">TedCloud Intelligence:</strong> {aiSummary}
                  </div>
                )}

                {checklist.length === 0 ? (
                  <p className="text-xs text-[#71717A]">
                    {isEn
                      ? 'No subtasks generated yet. Click "Break into steps" for an automated execution plan.'
                      : 'Подзадачи еще не сформированы. Нажмите «Разбить на шаги» для автоматической генерации плана работ.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-2.5 rounded-lg border border-white/[0.07] bg-[#14161C] px-3 py-2 text-xs"
                      >
                        <button
                          type="button"
                          disabled={!canEditTasks}
                          onClick={() => void handleToggleChecklistItem(item.id)}
                          className="flex items-start gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              item.done
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'border-[#3F3F46] hover:border-indigo-400'
                            }`}
                          >
                            {item.done && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          <span
                            className={`leading-snug break-words ${
                              item.done ? 'line-through text-[#71717A]' : 'text-zinc-100'
                            }`}
                          >
                            {item.title}
                          </span>
                        </button>

                        {canEditTasks && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteChecklistItem(item.id)}
                            className="text-[#52525B] hover:text-red-400 transition-colors p-0.5 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canEditTasks && (
                  <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Add checklist step manually...'
                          : 'Добавить шаг чек-листа вручную...'
                      }
                      className="flex-1 rounded-lg border border-white/10 bg-[#14161C] px-2.5 py-1.5 text-xs text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newSubtaskTitle.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Step' : 'Шаг'}</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-semibold text-white">
                      {isEn ? 'Attachments' : 'Вложения и документы'} ({taskAttachments.length})
                    </span>
                  </div>
                  {canEditTasks && (
                    <>
                      <input
                        ref={taskAttachmentInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_ATTACHMENT_TYPES}
                        onChange={handleUploadTaskAttachments}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => taskAttachmentInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-[#14161C] hover:bg-white/[0.08] text-[11px] font-medium text-zinc-200 transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isEn ? 'Attach file' : 'Прикрепить'}</span>
                      </button>
                    </>
                  )}
                </div>

                {taskAttachments.length === 0 ? (
                  <p className="text-xs text-[#71717A]">
                    {isEn
                      ? 'No files attached to this task yet.'
                      : 'К поручению еще не прикреплены файлы или фото.'}
                  </p>
                ) : (
                  <AttachmentListRenderer
                    attachments={taskAttachments}
                    lang={language}
                    onRemove={canEditTasks ? handleRemoveTaskAttachment : undefined}
                  />
                )}
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('drawer.threadTitle')}</span>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#71717A]">
                    {entityComments.length}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto no-scrollbar pr-1">
                  {entityComments.length === 0 ? (
                    <p className="text-xs text-[#71717A] py-2">{t('drawer.threadEmpty')}</p>
                  ) : (
                    entityComments.map((msg) => {
                      const sender = msg.sender_id ? nodeMap.get(msg.sender_id) : null;
                      const senderLabel =
                        sender?.name ||
                        msg.sender_name ||
                        (isEn ? 'Team Member' : 'Сотрудник TedCloud');
                      const roleLabel = sender?.role_type || msg.sender_role || '';
                      const timeStr = msg.created_at
                        ? new Date(msg.created_at).toLocaleString(isEn ? 'en-US' : 'ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '';
                      return (
                        <div
                          key={msg.id}
                          className="rounded-lg border border-white/[0.07] bg-[#14161C] p-3 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white truncate">
                              {senderLabel}
                              {roleLabel ? (
                                <span className="text-[#8E8E93] font-normal">
                                  {' '}
                                  · {formatRole(roleLabel)}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-[10px] tabular-nums text-[#71717A] shrink-0">
                              {timeStr}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                            {msg.message_text || msg.text || msg.content}
                          </p>
                          <AttachmentListRenderer
                            attachments={msg.attachments}
                            lang={language}
                            compact
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {onSendMessage && (
                  <form onSubmit={handlePostComment} className="space-y-2 pt-1">
                    {commentAttachments.length > 0 && (
                      <PendingAttachmentsStrip
                        attachments={commentAttachments}
                        onRemove={(id) =>
                          setCommentAttachments((prev) => prev.filter((a) => a.id !== id))
                        }
                        className="rounded-lg border border-white/[0.08]"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={commentFileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_ATTACHMENT_TYPES}
                        onChange={handleCommentFilesSelected}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => commentFileInputRef.current?.click()}
                        className="w-9 h-9 rounded-xl bg-[#14161C] hover:bg-white/[0.08] border border-white/10 text-zinc-300 flex items-center justify-center shrink-0 transition cursor-pointer"
                        title={isEn ? 'Attach file' : 'Прикрепить файл'}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={t('drawer.threadPlaceholder')}
                        className="flex-1 h-10 rounded-xl border border-white/10 bg-[#14161C] px-3 text-xs text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={
                          isSendingComment ||
                          (!commentText.trim() && commentAttachments.length === 0)
                        }
                        className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title={t('drawer.threadSendBtn')}
                      >
                        {isSendingComment ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 bg-[#181B22] border-t lg:border-t-0 lg:border-l border-white/[0.07] p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  {isEn ? 'Task Properties' : 'Свойства поручения'}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#8E8E93]">{t('drawer.status')}</label>
                  <select
                    disabled={!canEditTasks}
                    value={taskRec.status || 'Todo'}
                    onChange={(e) =>
                      void onPatchRecord('tasks', taskRec.id, {
                        status: e.target.value as TaskStatus,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#14161C] px-3 py-2 text-xs font-medium text-white disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Todo">{t('status.Todo')}</option>
                    <option value="In Progress">{t('status.In Progress')}</option>
                    <option value="Review">{t('status.Review')}</option>
                    <option value="Done">{t('status.Done')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#8E8E93]">{t('drawer.priority')}</label>
                  <select
                    disabled={!canEditTasks}
                    value={taskRec.priority || 'Medium'}
                    onChange={(e) =>
                      void onPatchRecord('tasks', taskRec.id, {
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#14161C] px-3 py-2 text-xs font-medium text-white disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Low">{t('priority.Low')}</option>
                    <option value="Medium">{t('priority.Medium')}</option>
                    <option value="High">{t('priority.High')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#8E8E93]">{t('drawer.assignee')}</label>
                  {assigneeNode && (
                    <div className="flex items-center gap-2 pb-1">
                      <UserAvatar
                        name={assigneeNode.name}
                        avatarUrl={assigneeNode.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {assigneeNode.name}
                        </div>
                        <div className="text-[10px] text-[#8E8E93] truncate">
                          {formatRole(assigneeNode.role_type)}
                        </div>
                      </div>
                    </div>
                  )}
                  {canAssignTasks ? (
                    <select
                      value={currentAssigneeId || ''}
                      onChange={(e) =>
                        void onPatchRecord('tasks', taskRec.id, {
                          assigned_to: e.target.value || null,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#14161C] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">{t('tasks.unassigned')}</option>
                      {safeNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} — {formatRole(n.role_type)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    !assigneeNode && (
                      <div className="text-xs font-medium text-white">
                        {t('tasks.unassigned')}
                      </div>
                    )
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-[#8E8E93]">{t('drawer.department')}</label>
                  {canAssignTasks ? (
                    <select
                      value={taskRec.department || ''}
                      onChange={(e) =>
                        void onPatchRecord('tasks', taskRec.id, {
                          department: e.target.value || null,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#14161C] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">{t('dept.noneOption')}</option>
                      {safeDepartments.map((d) => (
                        <option key={d} value={d}>
                          {formatRole(d)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-medium text-white">
                      {taskRec.department ? formatRole(taskRec.department) : t('dept.noneOption')}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                    <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>{isEn ? 'Target Due Date (SLA)' : 'Срок исполнения (SLA)'}</span>
                  </label>
                  <input
                    type="date"
                    disabled={!canEditTasks}
                    value={taskRec.due_date || ''}
                    onChange={(e) =>
                      void onPatchRecord('tasks', taskRec.id, {
                        due_date: e.target.value || null,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#14161C] px-3 py-2 text-xs text-white tabular-nums disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                    <Briefcase className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>{isEn ? 'Linked CRM Deal' : 'Связанная сделка CRM'}</span>
                  </label>
                  <select
                    disabled={!canEditTasks}
                    value={taskRec.lead_id || ''}
                    onChange={(e) =>
                      void onPatchRecord('tasks', taskRec.id, {
                        lead_id: e.target.value || null,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#14161C] px-3 py-2 text-xs text-white disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">
                      {isEn ? '— No linked deal —' : '— Без привязки к сделке —'}
                    </option>
                    {safeLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.client_name || l.title} ({formatMoney(Number(l.amount ?? l.deal_value ?? 0))})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-white/[0.07] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#8E8E93]">
                    <span>{t('drawer.author')}</span>
                    <span className="text-white font-medium truncate max-w-[150px]">
                      {authorNode
                        ? authorNode.name
                        : isEn
                        ? 'TedCloud System'
                        : 'Система TedCloud'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#8E8E93]">
                    <span>{t('drawer.createdAt')}</span>
                    <span className="text-white tabular-nums">{createdAtFormatted}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.07] space-y-2">
                {canEditTasks && onDeleteTask && (
                  <button
                    type="button"
                    onClick={() => {
                      void onDeleteTask(taskRec.id, taskRec.title);
                      onClose();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Delete Task' : 'Удалить задачу'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-4 py-2 rounded-xl border border-white/10 bg-[#14161C] hover:bg-white/[0.06] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  {t('drawer.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dealRec = record as CrmLeadRecord;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md font-sans transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#14161C] text-slate-900 dark:text-zinc-100 shadow-2xl flex flex-col justify-between no-scrollbar transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between sticky top-0 bg-slate-50/90 dark:bg-[#181B22] z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/90 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight truncate">
                {t('drawer.dealHeader')}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.06] text-[10px] font-semibold text-slate-600 dark:text-[#8E8E93] tabular-nums">
                #{String(dealRec.id || '').slice(0, 6).toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('drawer.close')}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {dealRec.client_name || dealRec.full_name || dealRec.title}
                </h2>
                {dealRec.title && (
                  <p className="text-xs text-[#8E8E93] mt-1">{dealRec.title}</p>
                )}
              </div>

              <button
                type="button"
                onClick={async () => {
                  const autoContractNum =
                    contractNumber.trim() ||
                    `TC-${new Date().getFullYear()}-${String(dealRec.id || '101')
                      .slice(0, 3)
                      .toUpperCase()}`;
                  const autoTax = taxId.trim() || (jurisdiction === 'RU' ? '7707083893' : 'EU-9920184');
                  const autoReg = regNumber.trim() || (jurisdiction === 'RU' ? '1027700132195' : 'REG-88412');
                  const val = Number(dealRec.amount ?? dealRec.deal_value ?? 0);
                  const riskNote = isEn
                    ? `Teddy Audit: Deal value ${formatMoney(val)}. Contract #${autoContractNum} pre-filled. Risk level: Low (standard B2B SLA recommended).`
                    : `Аудит Teddy: Сумма сделки ${formatMoney(val)}. Договор № ${autoContractNum} и реквизиты заполнены. Оценка риска: Низкий (рекомендован типовой SLA и счет А4).`;

                  setContractNumber(autoContractNum);
                  setTaxId(autoTax);
                  setRegNumber(autoReg);
                  setDealRiskSummary(riskNote);
                  const updatedNotes = notes.includes(autoContractNum)
                    ? notes
                    : `${notes ? notes + '\n\n' : ''}${riskNote}`;
                  setNotes(updatedNotes);

                  if (canEditCrm) {
                    await onPatchRecord('crm_leads', dealRec.id, {
                      contract_number: autoContractNum,
                      tax_id: autoTax,
                      reg_number: autoReg,
                      description: updatedNotes,
                    });
                  }
                  if (onOpenLegalDocs) {
                    onOpenLegalDocs({
                      ...dealRec,
                      contract_number: autoContractNum,
                      tax_id: autoTax,
                      reg_number: autoReg,
                      description: updatedNotes,
                    });
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-slate-100 text-slate-800 hover:bg-slate-200/70 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <TeddyPrismIcon className="w-4 h-4 shrink-0" />
                <span>
                  {isEn
                    ? 'Fill A4 Contract Draft & Assess Risks'
                    : 'Заполнить проект договора А4 и оценить риски'}
                </span>
              </button>
            </div>

            {dealRiskSummary && (
              <div className="rounded-xl border border-slate-200/90 dark:border-white/10 border-l-2 border-l-[#3B82F6] bg-slate-50 dark:bg-[#14161C] px-4 py-3 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                {dealRiskSummary}
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] divide-y divide-white/[0.06] text-xs">
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93]">{t('drawer.dealAmount')}</span>
                <span className="text-white font-semibold tabular-nums">
                  {formatMoney(Number(dealRec.amount ?? dealRec.deal_value ?? 0))}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#71717A]" />
                  {t('drawer.dealContact')}
                </span>
                <span className="text-white">
                  {dealRec.contact || dealRec.phone || '—'}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93]">{t('drawer.status')}</span>
                <select
                  disabled={!canEditCrm}
                  value={
                    (dealRec.status || dealRec.stage || 'New') as CrmLeadStatus
                  }
                  onChange={(e) =>
                    void onPatchRecord('crm_leads', dealRec.id, {
                      status: e.target.value as CrmLeadStatus,
                    })
                  }
                  className="rounded-lg border border-white/10 bg-[#14161C] px-3 py-1.5 text-xs text-white disabled:opacity-50 focus:outline-none"
                >
                  <option value="New">{t('stage.New')}</option>
                  <option value="Negotiation">{t('stage.Negotiation')}</option>
                  <option value="Won">{t('stage.Won')}</option>
                  <option value="Lost">{t('stage.Lost')}</option>
                </select>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93] flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[#71717A]" />
                  {t('drawer.department')}
                </span>
                {canEditCrm ? (
                  <select
                    value={dealRec.department || ''}
                    onChange={(e) =>
                      void onPatchRecord('crm_leads', dealRec.id, {
                        department: e.target.value || null,
                      })
                    }
                    className="rounded-lg border border-white/10 bg-[#14161C] px-3 py-1.5 text-xs text-white focus:outline-none max-w-[220px]"
                  >
                    <option value="">{t('dept.noneOption')}</option>
                    {safeDepartments.map((d) => (
                      <option key={d} value={d}>
                        {formatRole(d)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-white font-medium">
                    {dealRec.department ? formatRole(dealRec.department) : t('dept.noneOption')}
                  </span>
                )}
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93]">{t('drawer.assignee')}</span>
                {canEditCrm ? (
                  <select
                    value={currentAssigneeId || ''}
                    onChange={(e) =>
                      void onPatchRecord('crm_leads', dealRec.id, {
                        assigned_to: e.target.value || null,
                      })
                    }
                    className="rounded-lg border border-white/10 bg-[#14161C] px-3 py-1.5 text-xs text-white focus:outline-none max-w-[220px]"
                  >
                    <option value="">{t('tasks.unassigned')}</option>
                    {safeNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} — {formatRole(n.role_type)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-white font-medium">
                    {assigneeNode
                      ? `${assigneeNode.name} (${formatRole(assigneeNode.role_type)})`
                      : t('tasks.unassigned')}
                  </span>
                )}
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-[#8E8E93] flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
                  {t('drawer.createdAt')}
                </span>
                <span className="text-white tabular-nums">{createdAtFormatted}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  {t('drawer.dealRequisites')}
                </span>
                <div className="inline-flex rounded-lg border border-white/10 bg-[#14161C] p-0.5">
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
                    {isEn ? 'RU / CIS' : 'РФ / СНГ'}
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
                    className="w-full rounded-lg border border-white/10 bg-[#14161C] px-2.5 py-1.5 text-xs text-white tabular-nums focus:outline-none disabled:opacity-60"
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
                    className="w-full rounded-lg border border-white/10 bg-[#14161C] px-2.5 py-1.5 text-xs text-white tabular-nums focus:outline-none disabled:opacity-60"
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
                    className="w-full rounded-lg border border-white/10 bg-[#14161C] px-2.5 py-1.5 text-xs text-white tabular-nums focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveNotes} className="space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-[#D4D4D8]">
                <FileText className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('drawer.notesLabel')}</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEditCrm}
                placeholder={t('drawer.notesPlaceholder')}
                className="w-full rounded-xl border border-white/10 bg-[#1A1D24] p-3 text-xs text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none leading-relaxed disabled:opacity-60"
              />
              {canEditCrm && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="tc-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
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

            <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('drawer.threadTitle')}</span>
                </div>
                <span className="text-[11px] tabular-nums text-[#71717A]">
                  {entityComments.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto no-scrollbar pr-1">
                {entityComments.length === 0 ? (
                  <p className="text-xs text-[#71717A] py-2">{t('drawer.threadEmpty')}</p>
                ) : (
                  entityComments.map((msg) => {
                    const sender = msg.sender_id ? nodeMap.get(msg.sender_id) : null;
                    const senderLabel =
                      sender?.name ||
                      msg.sender_name ||
                      (isEn ? 'Team Member' : 'Сотрудник TedCloud');
                    const roleLabel = sender?.role_type || msg.sender_role || '';
                    const timeStr = msg.created_at
                      ? new Date(msg.created_at).toLocaleString(isEn ? 'en-US' : 'ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    return (
                      <div
                        key={msg.id}
                        className="rounded-lg border border-white/[0.07] bg-[#14161C] p-3 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">
                            {senderLabel}
                            {roleLabel ? (
                              <span className="text-[#8E8E93] font-normal">
                                {' '}
                                · {formatRole(roleLabel)}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[10px] tabular-nums text-[#71717A] shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                          {msg.message_text || msg.text || msg.content}
                        </p>
                        <AttachmentListRenderer
                          attachments={msg.attachments}
                          lang={language}
                          compact
                        />
                      </div>
                    );
                  })
                )}
              </div>

              {onSendMessage && (
                <form onSubmit={handlePostComment} className="space-y-2 pt-1">
                  {commentAttachments.length > 0 && (
                    <PendingAttachmentsStrip
                      attachments={commentAttachments}
                      onRemove={(id) =>
                        setCommentAttachments((prev) => prev.filter((a) => a.id !== id))
                      }
                      className="rounded-lg border border-white/[0.08]"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={commentFileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_ATTACHMENT_TYPES}
                      onChange={handleCommentFilesSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => commentFileInputRef.current?.click()}
                      className="w-9 h-9 rounded-xl bg-[#14161C] hover:bg-white/[0.08] border border-white/10 text-zinc-300 flex items-center justify-center shrink-0 transition"
                      title={isEn ? 'Attach file' : 'Прикрепить файл'}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t('drawer.threadPlaceholder')}
                      className="flex-1 h-10 rounded-xl border border-white/10 bg-[#14161C] px-3 text-xs text-white placeholder-[#52525B] focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={
                        isSendingComment ||
                        (!commentText.trim() && commentAttachments.length === 0)
                      }
                      className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors"
                      title={t('drawer.threadSendBtn')}
                    >
                      {isSendingComment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#1A1D24] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#D4D4D8]">
                <History className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('drawer.historyTitle')}</span>
              </div>
              <div className="space-y-2.5 text-xs text-[#8E8E93] border-l border-white/10 pl-3 ml-1.5">
                <div>
                  <div className="text-white font-medium">{t('drawer.historyCreated')}</div>
                  <div className="text-[11px] tabular-nums text-[#71717A]">
                    {createdAtFormatted}
                  </div>
                </div>
                <div>
                  <div className="text-white font-medium">
                    {t('drawer.historyCurrent')}{' '}
                    <span className="text-emerald-400">
                      {t(`stage.${dealRec.status || dealRec.stage || 'New'}`)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] bg-[#181B22] flex justify-end sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 bg-[#14161C] hover:bg-white/[0.06] text-xs font-medium text-white transition-colors whitespace-nowrap"
          >
            {t('drawer.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
