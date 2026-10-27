import React, { useState } from 'react';
import {
  X,
  Cpu,
  Send,
  Loader2,
  CheckCircle2,
  BarChart3,
  Briefcase,
  Layers,
  Plus,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AiAssistantMode,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import {
  AiAssistantMetric,
  AiAssistantSection,
  runBuiltInAiAssistant,
} from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';

interface AiChatEntry {
  id: string;
  role: 'user' | 'assistant';
  headline?: string;
  metrics?: AiAssistantMetric[];
  sections?: AiAssistantSection[];
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
  onCreateFollowUpTask,
  onNavigateToCrm,
  onNavigateToTasks,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [entries, setEntries] = useState<AiChatEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const companyId = company?.id || currentProfile?.company_id || '';
  const companyName = company?.name || 'TedCloud';

  const triggerAiAction = async (
    mode: AiAssistantMode,
    userPromptLabel: string,
    customPrompt?: string
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
      timestamp: nowTime,
    };

    setEntries((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const localBaseline = runBuiltInAiAssistant({
      mode,
      lang: language,
      prompt: customPrompt ?? userPromptLabel,
      companyName,
      currentUser: currentProfile,
      nodes,
      tasks,
      leads,
      messages,
    });

    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_assistant',
          mode,
          lang: language,
          prompt: customPrompt ?? userPromptLabel,
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

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || isLoading) return;
    setQuestion('');
    await triggerAiAction('custom', q, q);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs font-sans"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0D0D11] border-l border-white/[0.08] h-full flex flex-col justify-between shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.07] bg-[#111116] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  TedCloud Intelligence
                </h2>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-300 border border-white/10">
                  Corporate Copilot
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {isEn
                  ? `Structured analytics for tasks, team, and CRM deals at ${companyName}`
                  : `Структурная аналитика поручений, штата и сделок ${companyName}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close TedCloud Intelligence' : 'Закрыть TedCloud Intelligence'}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-5 py-3 border-b border-white/[0.06] bg-[#0F0F14] space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {isEn ? 'ANALYTICAL SCENARIOS' : 'АНАЛИТИЧЕСКИЕ СЦЕНАРИИ'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void triggerAiAction(
                  'daily_brief',
                  isEn ? 'My Daily Brief' : 'Сводка моего дня'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#15151B] hover:bg-zinc-800 hover:border-white/20 text-xs font-medium text-zinc-100 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isEn ? 'My Daily Brief' : 'Сводка моего дня'}</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void triggerAiAction(
                  'workload_analysis',
                  isEn ? 'Team Workload Analysis' : 'Анализ загрузки команды'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#15151B] hover:bg-zinc-800 hover:border-white/20 text-xs font-medium text-zinc-100 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
              <span>{isEn ? 'Team Workload Analysis' : 'Анализ загрузки команды'}</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void triggerAiAction(
                  'workload_analysis',
                  isEn ? 'CRM Pipeline Audit' : 'Аудит воронки CRM',
                  isEn
                    ? 'Audit CRM pipeline and deal conversion across the organization'
                    : 'Аудит воронки CRM и конверсии сделок компании'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#15151B] hover:bg-zinc-800 hover:border-white/20 text-xs font-medium text-zinc-100 transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEn ? 'CRM Pipeline Audit' : 'Аудит воронки CRM'}</span>
            </button>
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-[#121217] p-5 space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-white">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>
                  {isEn
                    ? `Analytical contour for "${companyName}" is active`
                    : `Аналитический контур «${companyName}» активен`}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isEn
                  ? `TedCloud Intelligence analyzes active assignments (${tasks.length}), team structure (${nodes.length} members), and your commercial CRM pipeline (${leads.length} deals) inside your isolated organization workspace.`
                  : `TedCloud Intelligence обрабатывает текущие поручения (${tasks.length}), штатную матрицу (${nodes.length} сотр.) и коммерческую воронку CRM (${leads.length} сделок) в изолированном пространстве вашей организации.`}
              </p>
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="rounded-lg border border-white/[0.06] bg-[#17171E] p-3">
                  <div className="text-[10px] font-medium text-zinc-400">
                    {isEn ? 'Open Tasks' : 'Активные задачи'}
                  </div>
                  <div className="text-base font-semibold text-white tabular-nums mt-0.5">
                    {tasks.filter((t) => t.status !== 'Done').length}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-[#17171E] p-3">
                  <div className="text-[10px] font-medium text-zinc-400">
                    {isEn ? 'Team Size' : 'Штат компании'}
                  </div>
                  <div className="text-base font-semibold text-white tabular-nums mt-0.5">
                    {nodes.length}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-[#17171E] p-3">
                  <div className="text-[10px] font-medium text-zinc-400">
                    {isEn ? 'CRM Deals' : 'Сделки CRM'}
                  </div>
                  <div className="text-base font-semibold text-white tabular-nums mt-0.5">
                    {leads.length}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex flex-col ${
                  entry.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {entry.role === 'user' ? (
                  <div className="max-w-[85%] rounded-xl border border-white/15 bg-zinc-800/90 px-4 py-2.5 text-white space-y-1">
                    <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-400">
                      <span className="font-semibold text-zinc-200">
                        {currentProfile?.name || (isEn ? 'You' : 'Вы')}
                      </span>
                      <span className="tabular-nums">{entry.timestamp}</span>
                    </div>
                    <div className="text-xs leading-relaxed">{entry.text}</div>
                  </div>
                ) : (
                  <div className="w-full rounded-xl border border-white/[0.08] bg-[#131319] p-4 space-y-4 text-zinc-100 shadow-lg">
                    {/* Assistant Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-semibold text-white">
                          {entry.headline || 'TedCloud Intelligence'}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        {entry.timestamp}
                      </span>
                    </div>

                    {/* 1. Mini-Grid of Key Metrics */}
                    {entry.metrics && entry.metrics.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {entry.metrics.map((m, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-white/[0.07] bg-[#181820] px-3 py-2.5 space-y-0.5"
                          >
                            <div className="text-[10px] font-medium text-zinc-400">
                              {m.label}
                            </div>
                            <div className="text-sm font-semibold text-white tabular-nums">
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

                    {/* 2. Structured Sections & Bullet Lists */}
                    {entry.sections && entry.sections.length > 0 ? (
                      <div className="space-y-3">
                        {entry.sections.map((sec, sIdx) => (
                          <div
                            key={sIdx}
                            className="rounded-lg border border-white/[0.06] bg-[#16161D] p-3 space-y-2"
                          >
                            <h4 className="text-xs font-semibold text-white tracking-tight">
                              {sec.title}
                            </h4>
                            <ul className="space-y-1.5">
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

                    {/* 3. Interactive Quick Actions under the AI Response */}
                    <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                      {onCreateFollowUpTask && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onCreateFollowUpTask(
                              isEn
                                ? 'Follow-up action from TedCloud Intelligence'
                                : 'Поручение по итогам аналитики TedCloud'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-[11px] font-semibold transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isEn ? 'Create Follow-Up Task' : 'Создать задачу по итогам'}</span>
                        </button>
                      )}

                      {onNavigateToCrm && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigateToCrm();
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors"
                        >
                          <Briefcase className="w-3 h-3 text-amber-400" />
                          <span>{isEn ? 'Open CRM Deals' : 'Перейти к сделкам'}</span>
                          <ArrowRight className="w-3 h-3 text-zinc-500" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToTasks) {
                            onClose();
                            onNavigateToTasks();
                          } else {
                            void triggerAiAction(
                              'workload_analysis',
                              isEn ? 'Rebalance Workload' : 'Сбалансировать нагрузку'
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 transition-colors"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
                        <span>{isEn ? 'Rebalance Workload' : 'Сбалансировать нагрузку'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-zinc-200 bg-[#14141B] border border-white/[0.08] rounded-xl px-4 py-3 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>
                {isEn
                  ? 'TedCloud Intelligence is generating a structured report...'
                  : 'TedCloud Intelligence формирует структурный отчет...'}
              </span>
            </div>
          )}
        </div>

        {/* Question Composer */}
        <form
          onSubmit={handleSubmitQuestion}
          className="p-4 border-t border-white/[0.07] bg-[#111116] flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              isEn
                ? 'Ask about tasks, clients, Tax ID/VAT, or departments...'
                : 'Запрос по задачам, контрагентам, ИНН/VAT или подразделениям...'
            }
            className="flex-1 rounded-xl border border-white/10 bg-[#17171F] px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-xs font-semibold transition-colors shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isEn ? 'Ask' : 'Запрос'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
