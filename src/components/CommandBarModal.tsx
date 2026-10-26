import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  CheckSquare,
  Briefcase,
  Users,
  MessageSquare,
  Plus,
  Sparkles,
  ArrowRight,
  Command,
} from 'lucide-react';
import {
  CrmLeadRecord,
  DashboardSection,
  OrganizationNode,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import { searchWorkspaceEntities } from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';

interface CommandBarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  nodes: OrganizationNode[];
  messages: WorkspaceMessageRecord[];
  canCreateTasks: boolean;
  canViewCrm: boolean;
  onSelectTask: (taskId: string) => void;
  onSelectLead: (leadId: string) => void;
  onSelectSection: (section: DashboardSection) => void;
  onCreateTask: () => void;
  onOpenAiCopilot: () => void;
}

export const CommandBarModal: React.FC<CommandBarModalProps> = ({
  isOpen,
  onClose,
  tasks,
  leads,
  nodes,
  messages,
  canCreateTasks,
  canViewCrm,
  onSelectTask,
  onSelectLead,
  onSelectSection,
  onCreateTask,
  onOpenAiCopilot,
}) => {
  const { formatMoney } = useLocale();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const results = useMemo(
    () => searchWorkspaceEntities(query, tasks, canViewCrm ? leads : [], nodes, messages),
    [query, tasks, leads, canViewCrm, nodes, messages]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-xs pt-16 px-4 font-sans"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#2A2A32] bg-[#111115] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Omnisearch Input */}
        <div className="px-4 py-3.5 border-b border-[#222228] flex items-center gap-3 bg-[#141419]">
          <Search className="w-4 h-4 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Мгновенный поиск: задачи, сделки, ИНН контрагента, сотрудники, сообщения..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#71717A] focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1F1F26] border border-[#2E2E38] text-[#8E8E93]">
              ESC
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#1E1E24]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-5">
          {/* Quick Actions */}
          <div className="space-y-1.5">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
              Быстрые команды (Quick Actions)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {canCreateTasks && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateTask();
                  }}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#24242C] bg-[#16161C] hover:border-white/40 text-xs font-medium text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Создать задачу</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#71717A]" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectSection('communications');
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#24242C] bg-[#16161C] hover:border-white/40 text-xs font-medium text-white transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>Перейти в чат</span>
                </span>
                <ArrowRight className="w-3 h-3 text-[#71717A]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiCopilot();
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Запустить TedCloud AI</span>
                </span>
                <ArrowRight className="w-3 h-3 text-emerald-400" />
              </button>
            </div>
          </div>

          {/* Tasks Results */}
          {results.tasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckSquare className="w-3 h-3 text-emerald-400" />
                  <span>Задачи ({results.tasks.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {results.tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectTask(t.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#191920] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">{t.title}</div>
                      <div className="text-[11px] text-[#8E8E93] truncate">
                        {t.department || 'Общий контур'} · {t.status}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1C1C22] border border-[#2C2C35] text-[#A1A1AA] shrink-0">
                      {t.priority}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CRM Deals Results (including tax_id / ИНН) */}
          {canViewCrm && results.leads.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3 text-amber-400" />
                  <span>Сделки и контрагенты CRM ({results.leads.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {results.leads.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectLead(l.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#191920] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {l.client_name || l.title}
                      </div>
                      <div className="text-[11px] text-[#8E8E93] truncate font-mono">
                        {l.tax_id ? `ИНН/VAT: ${l.tax_id}` : 'Без ИНН'}
                        {l.contract_number ? ` · Договор № ${l.contract_number}` : ''}
                        {l.department ? ` · ${l.department}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 shrink-0 font-mono">
                      {formatMoney(Number(l.amount ?? l.deal_value ?? 0))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Employees Results */}
          {results.nodes.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span>Сотрудники ({results.nodes.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {results.nodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectSection('communications');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#191920] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">{n.name}</div>
                      <div className="text-[11px] text-[#8E8E93] truncate">
                        {n.role_type} {n.department ? `· ${n.department}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#1C1C22] px-2 py-0.5 rounded border border-[#2C2C35]">
                      {n.invite_code || 'TC'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages Results */}
          {results.messages.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#71717A]">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 text-purple-400" />
                  <span>Сообщения чата ({results.messages.length})</span>
                </span>
              </div>
              <div className="space-y-1">
                {results.messages.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectSection('communications');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#191920] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {m.message_text || m.text || m.content}
                      </div>
                      <div className="text-[11px] text-[#8E8E93] truncate">
                        От: {m.sender_name || 'Сотрудник'} · {m.target_label || 'Инфополе'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.tasks.length === 0 &&
            results.leads.length === 0 &&
            results.nodes.length === 0 &&
            results.messages.length === 0 && (
              <div className="py-8 text-center text-xs text-[#71717A]">
                По запросу «{query}» совпадений не найдено.
              </div>
            )}
        </div>

        <div className="px-4 py-2.5 border-t border-[#222228] bg-[#141419] flex items-center justify-between text-[11px] text-[#71717A]">
          <span className="inline-flex items-center gap-1.5">
            <Command className="w-3 h-3" />
            <span>TedCloud Omnisearch & Teamwork Graph</span>
          </span>
          <span>Поиск по задачам, ИНН контрагентов, сотрудникам и чату</span>
        </div>
      </div>
    </div>
  );
};
