import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  CrmLeadRecord,
  CrmLeadStatus,
  OrganizationNode,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

export type DrawerRecord =
  | { kind: 'task'; record: TaskRecord }
  | { kind: 'deal'; record: CrmLeadRecord }
  | null;

interface SlideOverDrawerProps {
  item: DrawerRecord;
  nodeMap: Map<string, OrganizationNode>;
  nodes: OrganizationNode[];
  canEditTaskAssignee: boolean;
  canEditDeal: boolean;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Record<string, any>) => Promise<void>;
  onUpdateDeal: (dealId: string, updates: Record<string, any>) => Promise<void>;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  item,
  nodeMap,
  nodes,
  canEditTaskAssignee,
  canEditDeal,
  onClose,
  onUpdateTask,
  onUpdateDeal,
}) => {
  const { t, formatMoney } = useLocale();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNotes(item.record.description || item.record.notes || '');
  }, [item]);

  if (!item) return null;

  const isTask = item.kind === 'task';
  const record = item.record;

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

  const assigneeNode = isTask
    ? (record as TaskRecord).assigned_to
      ? nodeMap.get((record as TaskRecord).assigned_to!)
      : null
    : authorNode;

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isTask) {
        await onUpdateTask(record.id, { description: notes.trim(), notes: notes.trim() });
      } else {
        await onUpdateDeal(record.id, { description: notes.trim(), notes: notes.trim() });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-[#111113] border-l border-[#262626] h-full flex flex-col justify-between shadow-2xl overflow-y-auto">
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

              {isTask ? (
                <>
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.assignee')}</span>
                    {canEditTaskAssignee ? (
                      <select
                        value={(record as TaskRecord).assigned_to || ''}
                        onChange={(e) =>
                          void onUpdateTask(record.id, {
                            assigned_to: e.target.value || null,
                          })
                        }
                        className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white focus:outline-none"
                      >
                        <option value="">{t('tasks.unassigned')}</option>
                        {nodes.map((n) => (
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

                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.status')}</span>
                    <select
                      value={(record as TaskRecord).status || 'Todo'}
                      onChange={(e) =>
                        void onUpdateTask(record.id, {
                          status: e.target.value as TaskStatus,
                        })
                      }
                      className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="Todo">{t('status.Todo')}</option>
                      <option value="In Progress">{t('status.In Progress')}</option>
                      <option value="Done">{t('status.Done')}</option>
                    </select>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#8E8E93]">{t('drawer.priority')}</span>
                    <select
                      value={(record as TaskRecord).priority || 'Medium'}
                      onChange={(e) =>
                        void onUpdateTask(record.id, {
                          priority: e.target.value as TaskPriority,
                        })
                      }
                      className="rounded-md border border-[#2C2C30] bg-[#111113] px-2.5 py-1 text-xs text-white focus:outline-none"
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
                      disabled={!canEditDeal}
                      value={
                        ((record as CrmLeadRecord).status ||
                          (record as CrmLeadRecord).stage ||
                          'New') as CrmLeadStatus
                      }
                      onChange={(e) =>
                        void onUpdateDeal(record.id, {
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

            {/* Working Comment / Notes Form */}
            <form onSubmit={handleSaveNotes} className="space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-[#D4D4D8]">
                <FileText className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span>{t('drawer.notesLabel')}</span>
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!isTask && !canEditDeal}
                placeholder={t('drawer.notesPlaceholder')}
                className="w-full rounded-lg border border-[#262626] bg-[#161618] p-3 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none leading-relaxed disabled:opacity-60"
              />
              {(isTask || canEditDeal) && (
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
