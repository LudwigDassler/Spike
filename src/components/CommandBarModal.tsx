import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  CheckSquare,
  Briefcase,
  Users,
  MessageSquare,
  Plus,
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
import { TeddyAvatar } from './TedCloudAiDrawer';

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
  const { t, language, formatRole, formatMoney } = useLocale();
  const isEn = language === 'en';
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-xs pt-10 sm:pt-16 px-3 sm:px-4 font-sans"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-[calc(100vw-24px)] max-w-2xl rounded-2xl border border-white/10 bg-[#111115] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Omnisearch Input */}
        <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center gap-3 bg-[#141419]">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder={
              isEn
                ? 'Search tasks, deals, Tax ID, team members, and chat...'
                : 'Поиск по задачам, сделкам, ИНН, сотрудникам и чату...'
            }
            className="tc-composer-input !bg-transparent bg-transparent border-0 outline-none focus:ring-0 flex-1 w-full text-sm text-white placeholder-zinc-500"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/10 text-zinc-400">
              ESC
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={isEn ? 'Close search' : 'Закрыть поиск'}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto no-scrollbar p-4 space-y-5">
          {/* Quick Actions */}
          <div className="space-y-1.5">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {isEn ? 'QUICK ACTIONS' : 'БЫСТРЫЕ КОМАНДЫ'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {canCreateTasks && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateTask();
                  }}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-[#16161C] hover:border-white/30 text-xs font-medium text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-zinc-300" />
                    <span>{isEn ? 'Create Task' : 'Создать задачу'}</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectSection('communications');
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-[#16161C] hover:border-white/30 text-xs font-medium text-white transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isEn ? 'Open Chat' : 'Перейти в чат'}</span>
                </span>
                <ArrowRight className="w-3 h-3 text-zinc-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiCopilot();
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-indigo-500/30 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <TeddyAvatar size="xs" />
                  <span>Teddy</span>
                </span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Tasks Results */}
          {results.tasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckSquare className="w-3 h-3 text-indigo-400" />
                  <span>
                    {isEn ? 'TASKS' : 'ЗАДАЧИ'} ({results.tasks.length})
                  </span>
                </span>
              </div>
              <div className="space-y-1">
                {results.tasks.map((taskItem) => (
                  <button
                    key={taskItem.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectTask(taskItem.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {taskItem.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {taskItem.department
                          ? formatRole(taskItem.department)
                          : t('common.generalScope')}{' '}
                        · {t(`status.${taskItem.status}`)}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${
                        taskItem.priority === 'High'
                          ? 'bg-red-500/10 border-red-500/30 text-red-300'
                          : taskItem.priority === 'Low'
                          ? 'bg-zinc-800 border-white/10 text-zinc-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {t(`priority.${taskItem.priority}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CRM Deals Results */}
          {canViewCrm && results.leads.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3 text-amber-400" />
                  <span>
                    {isEn ? 'CRM DEALS & CLIENTS' : 'СДЕЛКИ И КОНТРАГЕНТЫ CRM'} ({results.leads.length})
                  </span>
                </span>
              </div>
              <div className="space-y-1">
                {results.leads.map((leadItem) => (
                  <button
                    key={leadItem.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectLead(leadItem.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {leadItem.client_name || leadItem.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate tabular-nums">
                        {leadItem.tax_id
                          ? isEn
                            ? `Tax ID/VAT: ${leadItem.tax_id}`
                            : `ИНН/VAT: ${leadItem.tax_id}`
                          : isEn
                          ? 'No Tax ID'
                          : 'Без ИНН'}
                        {leadItem.contract_number
                          ? isEn
                            ? ` · Contract #${leadItem.contract_number}`
                            : ` · Договор № ${leadItem.contract_number}`
                          : ''}
                        {leadItem.department ? ` · ${formatRole(leadItem.department)}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-white shrink-0 tabular-nums">
                      {formatMoney(Number(leadItem.amount ?? leadItem.deal_value ?? 0))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Employees Results */}
          {results.nodes.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-sky-400" />
                  <span>
                    {isEn ? 'TEAM MEMBERS' : 'СОТРУДНИКИ'} ({results.nodes.length})
                  </span>
                </span>
              </div>
              <div className="space-y-1">
                {results.nodes.map((nodeItem) => (
                  <button
                    key={nodeItem.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectSection('communications');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {nodeItem.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {formatRole(nodeItem.role_type)}{' '}
                        {nodeItem.department ? `· ${formatRole(nodeItem.department)}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium tabular-nums text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/10">
                      {nodeItem.invite_code || 'TC'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages Results */}
          {results.messages.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 text-indigo-400" />
                  <span>
                    {isEn ? 'CHAT MESSAGES' : 'СООБЩЕНИЯ ЧАТА'} ({results.messages.length})
                  </span>
                </span>
              </div>
              <div className="space-y-1">
                {results.messages.map((msgItem) => (
                  <button
                    key={msgItem.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectSection('communications');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {msgItem.message_text || msgItem.text || msgItem.content}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {isEn ? 'From:' : 'От:'}{' '}
                        {msgItem.sender_name || (isEn ? 'Member' : 'Сотрудник')} ·{' '}
                        {msgItem.target_label
                          ? formatRole(msgItem.target_label)
                          : isEn
                          ? 'Workspace Stream'
                          : 'Инфополе'}
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
              <div className="py-8 text-center text-xs text-zinc-500">
                {isEn
                  ? `No matches found for "${query}".`
                  : `По запросу «${query}» совпадений не найдено.`}
              </div>
            )}
        </div>

        <div className="px-4 py-2.5 border-t border-white/[0.07] bg-[#141419] flex items-center justify-between text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Command className="w-3 h-3" />
            <span>TedCloud Omnisearch</span>
          </span>
          <span className="truncate ml-2">
            {isEn
              ? 'Search tasks, Tax IDs, team members & chat'
              : 'Поиск по задачам, ИНН контрагентов, сотрудникам и чату'}
          </span>
        </div>
      </div>
    </div>
  );
};
