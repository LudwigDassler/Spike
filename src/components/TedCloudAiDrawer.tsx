import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Cpu,
  Send,
  Loader2,
  CheckCircle2,
  BarChart3,
  Briefcase,
  Plus,
  Check,
  Paperclip,
  ListChecks,
} from 'lucide-react';
import {
  AiAssistantMode,
  AttachmentItem,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import {
  AiAssistantMetric,
  AiAssistantSection,
  buildBuiltInChecklistForTask,
  runBuiltInAiAssistant,
} from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  AttachmentListRenderer,
  PendingAttachmentsStrip,
  processFilesToAttachments,
} from './AttachmentSystem';

interface AiChatEntry {
  id: string;
  role: 'user' | 'assistant';
  headline?: string;
  metrics?: AiAssistantMetric[];
  sections?: AiAssistantSection[];
  suggestedTaskTitle?: string;
  attachments?: AttachmentItem[];
  text: string;
  timestamp: string;
}

interface TedCloudAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  currentProfile: OrganizationNode | null;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  messages: WorkspaceMessageRecord[];
  onCreateFollowUpTask?: (suggestedTitle?: string) => void;
  onNavigateToCrm?: () => void;
  onNavigateToTasks?: () => void;
  onRefreshWorkspace?: () => Promise<void> | void;
}

export const TedCloudAiDrawer: React.FC<TedCloudAiDrawerProps> = ({
  isOpen,
  onClose,
  company,
  currentProfile,
  nodes,
  tasks,
  leads,
  messages,
  onNavigateToCrm,
  onRefreshWorkspace,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [entries, setEntries] = useState<AiChatEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [creatingTaskEntryId, setCreatingTaskEntryId] = useState<string | null>(null);
  const [createdTaskIds, setCreatedTaskIds] = useState<Record<string, boolean>>({});
  const [decomposingEntryId, setDecomposingEntryId] = useState<string | null>(null);
  const [decomposedEntryIds, setDecomposedEntryIds] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const companyId = company?.id || currentProfile?.company_id || '';
  const companyName = company?.name || 'TedCloud';

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { attachments } = await processFilesToAttachments(files, language);
    e.target.value = '';
    if (attachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...attachments]);
    }
  };

  const triggerAiAction = async (
    mode: AiAssistantMode,
    userPromptLabel: string,
    customPrompt?: string,
    attachedFiles?: AttachmentItem[]
  ) => {
    if (isLoading) return;
    const nowTime = new Date().toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: AiChatEntry = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: userPromptLabel,
      attachments: attachedFiles && attachedFiles.length > 0 ? attachedFiles : undefined,
      timestamp: nowTime,
    };

    setEntries((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const attachmentContextNote =
      attachedFiles && attachedFiles.length > 0
        ? ` [Attached files: ${attachedFiles.map((f) => f.name).join(', ')}]`
        : '';

    const effectivePrompt = `${customPrompt ?? userPromptLabel}${attachmentContextNote}`;

    const localBaseline = runBuiltInAiAssistant({
      mode,
      lang: language,
      prompt: effectivePrompt,
      companyName,
      currentUser: currentProfile,
      nodes,
      tasks,
      leads,
      messages,
    });

    const suggestedTaskTitle = isEn
      ? `Execute action plan: ${userPromptLabel.slice(0, 48)}`
      : `План мероприятий: ${userPromptLabel.slice(0, 48)}`;

    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_assistant',
          mode,
          lang: language,
          prompt: effectivePrompt,
          company_id: companyId,
          companyName,
          profile_id: currentProfile?.id || null,
        }),
      });

      const payload = await response.json();
      if (response.ok && payload?.reply) {
        setEntries((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            headline: payload.headline || localBaseline.headline,
            metrics:
              Array.isArray(payload.metrics) && payload.metrics.length > 0
                ? payload.metrics
                : localBaseline.metrics,
            sections:
              Array.isArray(payload.sections) && payload.sections.length > 0
                ? payload.sections
                : localBaseline.sections,
            suggestedTaskTitle,
            text: payload.reply,
            timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
        return;
      }
      throw new Error(payload?.error || 'Fallback');
    } catch {
      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          headline: localBaseline.headline,
          metrics: localBaseline.metrics,
          sections: localBaseline.sections,
          suggestedTaskTitle,
          text: localBaseline.reply,
          timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Прямое создание предложенной задачи в БД в 1 клик из ответа ИИ
  const handleDirectCreateSuggestedTask = async (entry: AiChatEntry) => {
    if (creatingTaskEntryId || createdTaskIds[entry.id]) return;
    setCreatingTaskEntryId(entry.id);
    try {
      const title =
        entry.suggestedTaskTitle ||
        (isEn
          ? 'Operational initiative from TedCloud Intelligence'
          : 'Операционное поручение по аналитике TedCloud');
      const { checklist, summary } = buildBuiltInChecklistForTask(title, entry.text, language);
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          payload: {
            company_id: companyId,
            title,
            description: entry.text.slice(0, 600),
            type: 'Task',
            priority: 'High',
            status: 'Todo',
            department: currentProfile?.department || null,
            assigned_to: currentProfile?.id || nodes[0]?.id || null,
            owner_node_id: currentProfile?.id || nodes[0]?.id || null,
            created_by: currentProfile?.id || null,
            checklist,
            ai_summary: summary,
          },
        }),
      });
      if (response.ok) {
        setCreatedTaskIds((prev) => ({ ...prev, [entry.id]: true }));
        if (onRefreshWorkspace) {
          await onRefreshWorkspace();
        }
      }
    } finally {
      setCreatingTaskEntryId(null);
    }
  };

  // Прямая декомпозиция активных задач компании в БД в 1 клик из ответа ИИ
  const handleDirectDecomposeActiveTasks = async (entryId: string) => {
    if (decomposingEntryId || decomposedEntryIds[entryId]) return;
    setDecomposingEntryId(entryId);
    try {
      const openTasks = tasks.filter((t) => t.status !== 'Done').slice(0, 5);
      for (const tk of openTasks) {
        if (!Array.isArray(tk.checklist) || tk.checklist.length === 0) {
          const { checklist, summary } = buildBuiltInChecklistForTask(
            tk.title,
            tk.description,
            language
          );
          await fetch('/api/db', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'tasks',
              id: tk.id,
              updates: {
                checklist,
                ai_summary: summary,
              },
            }),
          });
        }
      }
      setDecomposedEntryIds((prev) => ({ ...prev, [entryId]: true }));
      if (onRefreshWorkspace) {
        await onRefreshWorkspace();
      }
    } finally {
      setDecomposingEntryId(null);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if ((!q && pendingAttachments.length === 0) || isLoading) return;
    const filesToSend = [...pendingAttachments];
    const label =
      q ||
      (isEn
        ? `Analyze attached file: ${filesToSend.map((f) => f.name).join(', ')}`
        : `Анализ документа: ${filesToSend.map((f) => f.name).join(', ')}`);
    setQuestion('');
    setPendingAttachments([]);
    await triggerAiAction('custom', label, label, filesToSend);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs font-sans"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0D0D11] border-l border-white/[0.08] h-[100dvh] flex flex-col justify-between overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-white/[0.07] bg-[#111116] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                  TedCloud Intelligence
                </h2>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {companyName} · {tasks.filter((t) => t.status !== 'Done').length}{' '}
                {isEn ? 'open tasks' : 'активных задач'} · {leads.length} CRM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close TedCloud Intelligence' : 'Закрыть TedCloud Intelligence'}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2x2 Grid of Quick Scenarios (Block 2) */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-white/[0.07] bg-[#0F0F14] shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction('daily_brief', isEn ? 'Daily Brief' : 'Сводка дня')
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400" />
            <span className="truncate">{isEn ? 'Daily Brief' : 'Сводка дня'}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction(
                'workload_analysis',
                isEn ? 'Bottleneck Analysis' : 'Анализ узких мест'
              )
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors"
          >
            <BarChart3 className="w-4 h-4 shrink-0 text-sky-400" />
            <span className="truncate">{isEn ? 'Bottleneck Analysis' : 'Анализ узких мест'}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction(
                'workload_analysis',
                isEn ? 'CRM Pipeline Audit' : 'Аудит сделок CRM',
                isEn
                  ? 'Audit CRM pipeline and deal conversion across the organization'
                  : 'Аудит сделок CRM и конверсии воронки компании'
              )
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors"
          >
            <Briefcase className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">{isEn ? 'CRM Pipeline Audit' : 'Аудит сделок CRM'}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction(
                'decompose_task',
                isEn ? 'Task Plan' : 'План задач',
                tasks[0]?.title || (isEn ? 'Q4 Operational Execution Plan' : 'Операционный план квартала')
              )
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors"
          >
            <ListChecks className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="truncate">{isEn ? 'Task Plan' : 'План задач'}</span>
          </button>
        </div>

        {/* Conversational Stream */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5">
          {entries.length === 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#131319] p-3.5 space-y-2.5 text-zinc-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  TedCloud Copilot
                </span>
                <span className="text-[10px] text-zinc-500">
                  {isEn ? 'Ready' : 'Готов к работе'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isEn
                  ? `Select a quick scenario above, attach a document or screenshot via the paperclip icon, or ask any question about "${companyName}".`
                  : `Выберите быстрый сценарий сверху, прикрепите документ/скриншот через скрепку или задайте вопрос по данным «${companyName}».`}
              </p>
            </div>
          )}

          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex flex-col ${
                entry.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {entry.role === 'user' ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-white/15 bg-zinc-800/90 px-3.5 py-2.5 text-white space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-400">
                    <span className="font-semibold text-zinc-200">
                      {currentProfile?.name || (isEn ? 'You' : 'Вы')}
                    </span>
                    <span className="tabular-nums">{entry.timestamp}</span>
                  </div>
                  <div className="text-xs leading-relaxed">{entry.text}</div>
                  {entry.attachments && entry.attachments.length > 0 && (
                    <AttachmentListRenderer
                      attachments={entry.attachments}
                      lang={language}
                      compact
                    />
                  )}
                </div>
              ) : (
                <div className="w-full rounded-2xl rounded-tl-sm border border-white/[0.08] bg-[#131319] p-3.5 space-y-3 text-zinc-100 shadow-lg">
                  {/* Assistant Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-xs font-semibold text-white truncate">
                        {entry.headline || 'TedCloud Intelligence'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>

                  {/* Mini-Grid of Key Metrics */}
                  {entry.metrics && entry.metrics.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {entry.metrics.map((m, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-white/[0.07] bg-[#181820] px-2.5 py-2 space-y-0.5 min-w-0"
                        >
                          <div className="text-[10px] font-medium text-zinc-400 truncate">
                            {m.label}
                          </div>
                          <div className="text-xs sm:text-sm font-semibold text-white tabular-nums truncate">
                            {m.value}
                          </div>
                          {m.sublabel && (
                            <div className="text-[10px] text-zinc-500 truncate">
                              {m.sublabel}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Structured Sections */}
                  {entry.sections && entry.sections.length > 0 ? (
                    <div className="space-y-2.5">
                      {entry.sections.map((sec, sIdx) => (
                        <div
                          key={sIdx}
                          className="rounded-xl border border-white/[0.06] bg-[#16161D] p-3 space-y-1.5"
                        >
                          <h4 className="text-xs font-semibold text-white tracking-tight">
                            {sec.title}
                          </h4>
                          <ul className="space-y-1">
                            {sec.items.map((item, iIdx) => (
                              <li
                                key={iIdx}
                                className="text-xs text-zinc-300 leading-relaxed flex items-start gap-2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/80 mt-1.5 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                      {entry.text}
                    </div>
                  )}

                  {/* Interactive Direct DB Action Buttons inside AI Response */}
                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        creatingTaskEntryId === entry.id || Boolean(createdTaskIds[entry.id])
                      }
                      onClick={() => void handleDirectCreateSuggestedTask(entry)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                        createdTaskIds[entry.id]
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white text-black hover:bg-zinc-200'
                      }`}
                    >
                      {creatingTaskEntryId === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : createdTaskIds[entry.id] ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      <span>
                        {createdTaskIds[entry.id]
                          ? isEn
                            ? 'Task Created in Registry'
                            : 'Задача создана в реестре'
                          : isEn
                          ? '+ Create Suggested Task'
                          : '+ Создать предложенную задачу'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        decomposingEntryId === entry.id || Boolean(decomposedEntryIds[entry.id])
                      }
                      onClick={() => void handleDirectDecomposeActiveTasks(entry.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-colors ${
                        decomposedEntryIds[entry.id]
                          ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200'
                      }`}
                    >
                      {decomposingEntryId === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : decomposedEntryIds[entry.id] ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <ListChecks className="w-3 h-3 text-indigo-400" />
                      )}
                      <span>
                        {decomposedEntryIds[entry.id]
                          ? isEn
                            ? 'Active Tasks Decomposed'
                            : 'Чек-листы сформированы'
                          : isEn
                          ? 'Decompose Active Tasks'
                          : 'Декомпозировать активные задачи'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-zinc-200 bg-[#14141B] border border-white/[0.08] rounded-xl px-3.5 py-2.5 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>
                {isEn
                  ? 'TedCloud Intelligence is analyzing workspace data...'
                  : 'TedCloud Intelligence анализирует данные...'}
              </span>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Bottom Composer with Paperclip + Input + Send */}
        <div className="shrink-0 sticky bottom-0 bg-[#111116] border-t border-white/[0.08]">
          <PendingAttachmentsStrip
            attachments={pendingAttachments}
            onRemove={(id) =>
              setPendingAttachments((prev) => prev.filter((item) => item.id !== id))
            }
          />
          <form
            onSubmit={handleSubmitQuestion}
            className="flex items-center gap-2 p-3"
          >
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
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 transition"
              title={isEn ? 'Attach file or screenshot' : 'Прикрепить файл или скриншот'}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                isEn
                  ? 'Ask Copilot about tasks, CRM deals, or team...'
                  : 'Спросите Copilot о задачах, сделках или команде...'
              }
              className="flex-1 h-10 rounded-xl border border-white/10 bg-[#17171F] px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none min-w-0"
            />

            <button
              type="submit"
              disabled={isLoading || (!question.trim() && pendingAttachments.length === 0)}
              className="w-9 h-9 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors"
              title={isEn ? 'Send' : 'Отправить'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
