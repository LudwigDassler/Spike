import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  BarChart3,
  Briefcase,
  Bot,
} from 'lucide-react';
import {
  AiAssistantMode,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import { runBuiltInAiAssistant } from '../utils/enterpriseLogic';

interface AiChatEntry {
  id: string;
  role: 'user' | 'assistant';
  label?: string;
  text: string;
  provider?: string;
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
}) => {
  const [entries, setEntries] = useState<AiChatEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const companyId = company?.id || currentProfile?.company_id || '';
  const companyName = company?.name || 'TedCloud';

  const triggerAiAction = async (mode: AiAssistantMode, userPromptLabel: string, customPrompt?: string) => {
    if (isLoading) return;
    const nowTime = new Date().toLocaleTimeString('ru-RU', {
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

    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_assistant',
          mode,
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
            text: payload.reply,
            provider: payload.provider === 'gemini' ? 'Gemini 2.5 Flash' : 'TedCloud Core AI',
            timestamp: new Date().toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
        return;
      }
      throw new Error(payload?.error || 'Fallback');
    } catch {
      const fallback = runBuiltInAiAssistant({
        mode,
        prompt: customPrompt ?? userPromptLabel,
        companyName,
        currentUser: currentProfile,
        nodes,
        tasks,
        leads,
        messages,
      });
      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: fallback.reply,
          provider: 'TedCloud Core AI',
          timestamp: new Date().toLocaleTimeString('ru-RU', {
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
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-[#0F0F12] border-l border-[#26262C] h-full flex flex-col justify-between shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222228] bg-[#121216] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  TedCloud AI Copilot
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Enterprise Rovo
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E93]">
                Интеллектуальная аналитика задач, штата и сделок {companyName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть TedCloud AI"
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#1C1C22] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-5 py-3 border-b border-[#1E1E24] bg-[#111115] space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
            Быстрые сценарии анализа
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void triggerAiAction('daily_brief', 'Сводка моего дня')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#272730] bg-[#17171D] hover:bg-[#202028] hover:border-emerald-500/40 text-xs font-medium text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Сводка моего дня</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void triggerAiAction('workload_analysis', 'Анализ загрузки команды')
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#272730] bg-[#17171D] hover:bg-[#202028] hover:border-emerald-500/40 text-xs font-medium text-white transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
              <span>Анализ загрузки команды</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void triggerAiAction(
                  'workload_analysis',
                  'Аудит воронки CRM',
                  'Аудит воронки CRM и конверсии сделок компании'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#272730] bg-[#17171D] hover:bg-[#202028] hover:border-emerald-500/40 text-xs font-medium text-white transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              <span>Аудит воронки CRM</span>
            </button>
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-[#22222A] bg-[#141419] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>Готов к работе с данными «{companyName}»</span>
              </div>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                TedCloud AI анализирует активные поручения ({tasks.length}), штатную структуру ({nodes.length} сотр.) и коммерческий пайплайн CRM ({leads.length} сделок) строго внутри вашего изолированного рабочего пространства.
              </p>
              <div className="text-[11px] text-[#71717A] space-y-1 pt-1">
                <div>• Нажмите «Сводка моего дня» для приоритизации личных задач.</div>
                <div>• Нажмите «Анализ загрузки команды» для поиска узких мест по отделам.</div>
                <div>• Или задайте любой вопрос по ИНН контрагента, договору или задаче ниже.</div>
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
                <div
                  className={`max-w-[90%] rounded-xl border px-4 py-3 space-y-1.5 ${
                    entry.role === 'user'
                      ? 'bg-emerald-950/35 border-emerald-500/35 text-white'
                      : 'bg-[#16161C] border-[#262630] text-zinc-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-[#8E8E93]">
                    <span className="font-semibold text-white">
                      {entry.role === 'user'
                        ? currentProfile?.name || 'Вы'
                        : 'TedCloud AI'}
                    </span>
                    <div className="flex items-center gap-2">
                      {entry.provider && (
                        <span className="font-mono text-emerald-400">{entry.provider}</span>
                      )}
                      <span className="font-mono">{entry.timestamp}</span>
                    </div>
                  </div>
                  <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {entry.text}
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-[#16161C] border border-[#262630] rounded-xl px-4 py-3 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>TedCloud AI анализирует данные компании...</span>
            </div>
          )}
        </div>

        {/* Question Composer */}
        <form
          onSubmit={handleSubmitQuestion}
          className="p-4 border-t border-[#222228] bg-[#121216] flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Спросите ИИ о задачах, контрагентах, ИНН или загрузке отдела..."
            className="flex-1 rounded-xl border border-[#2A2A32] bg-[#18181F] px-3.5 py-2 text-xs text-white placeholder-[#52525B] focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Спросить</span>
          </button>
        </form>
      </div>
    </div>
  );
};
