'use client';

import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Circle,
  Inbox,
  Plus,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Company,
  CrmLeadRecord,
  DashboardSection,
  LeadStage,
  OrganizationNode,
  OrganizationRoleType,
  TaskPriorityType,
  TaskRecord,
  computeDashboardKpis,
} from '../types/database';
import { AddRecordModal, AddRecordTab } from './AddRecordModal';

export interface DashboardProps {
  company: Company | null;
  nodes: OrganizationNode[];
  leads: CrmLeadRecord[];
  tasks: TaskRecord[];
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  createModalTarget: DashboardSection | null;
  onOpenCreateModal: (target: DashboardSection) => void;
  onCloseCreateModal: () => void;
  onLeadCreated: (lead: CrmLeadRecord) => void;
  onUpdateLeadStage: (leadId: string, nextStage: LeadStage) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onTaskCreated: (task: TaskRecord) => void;
  onToggleTaskDone: (task: TaskRecord) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onEmployeeCreated: (node: OrganizationNode) => void;
  onDeleteNode: (nodeId: string) => Promise<void>;
  isLoading?: boolean;
  feedbackBanner?: { type: 'success' | 'error'; text: string } | null;
  onDismissFeedback?: () => void;
}

const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Новая заявка',
  qualified: 'Квалифицирован',
  trial_marathon: 'Переговоры',
  repeat_client: 'Повторная сделка',
  partner_ready: 'Закрыта успешно',
  archived: 'В архиве',
};

const PRIORITY_LABELS: Record<TaskPriorityType, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

const ROLE_LABELS: Record<OrganizationRoleType, string> = {
  Owner: 'Owner (Владелец)',
  Manager: 'Manager (Руководитель)',
  Specialist: 'Specialist (Специалист)',
  Observer: 'Observer (Наблюдатель)',
  SUPERADMIN: 'Администратор',
  INTERNAL_IT: 'Инженер поддержки',
  NETWORK_PARTNER: 'Менеджер по продажам',
};

/**
 * Универсальный компонент пустого состояния (Empty State)
 */
export const EmptyStateCard: React.FC<{
  description?: string;
  onAddClick: () => void;
}> = ({ description, onAddClick }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm flex flex-col items-center justify-center gap-3">
    <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300">
      <Inbox className="w-5 h-5" />
    </div>
    <div className="space-y-1 max-w-sm">
      <h3 className="text-sm font-semibold tracking-tight text-slate-900">
        В этом разделе пока нет данных
      </h3>
      {description && (
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={onAddClick}
      className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all duration-200 cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      <span>Добавить</span>
    </button>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({
  company,
  nodes,
  leads,
  tasks,
  activeSection,
  createModalTarget,
  onOpenCreateModal,
  onCloseCreateModal,
  onLeadCreated,
  onUpdateLeadStage,
  onDeleteLead,
  onTaskCreated,
  onToggleTaskDone,
  onDeleteTask,
  onEmployeeCreated,
  onDeleteNode,
  feedbackBanner,
  onDismissFeedback,
}) => {
  const kpis = computeDashboardKpis(leads, tasks, nodes);
  const [initialModalTab, setInitialModalTab] = useState<AddRecordTab>('deal');

  const openModalFor = (targetSection: DashboardSection) => {
    const mappedTab: AddRecordTab =
      targetSection === 'tasks'
        ? 'task'
        : targetSection === 'team'
        ? 'employee'
        : 'deal';
    setInitialModalTab(mappedTab);
    onOpenCreateModal(targetSection);
  };

  const resolvedModalTab: AddRecordTab =
    createModalTarget === 'tasks'
      ? 'task'
      : createModalTarget === 'team'
      ? 'employee'
      : createModalTarget === 'leads'
      ? 'deal'
      : initialModalTab;

  return (
    <div className="font-sans space-y-6">
      {/* Заголовок рабочего пространства */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {activeSection === 'overview' && 'Обзор рабочего пространства'}
            {activeSection === 'leads' && 'Воронка сделок'}
            {activeSection === 'tasks' && 'Активные задачи'}
            {activeSection === 'team' && 'Сотрудники'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {company?.name
              ? `Организация: ${company.name}`
              : 'Универсальная B2B CRM-платформа TedCloud'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModalFor(activeSection)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {/* Плашка обратной связи */}
      {feedbackBanner && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          {onDismissFeedback && (
            <button
              type="button"
              onClick={onDismissFeedback}
              className="text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Карточки универсальных B2B метрик */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Сумма сделок</span>
            <Briefcase className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.totalDealValue.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-slate-400">
            Всего сделок в воронке: {leads.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Активные задачи</span>
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.activeTasksCount}
          </div>
          <div className="text-xs text-slate-400">
            Всего задач в системе: {tasks.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Конверсия</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.conversionRatePercent}%
          </div>
          <div className="text-xs text-slate-400">
            Квалифицированные и закрытые сделки
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Сотрудники</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.employeesCount}
          </div>
          <div className="text-xs text-slate-400">
            Узлы организации в базе данных
          </div>
        </div>
      </div>

      {/* Секция 1: Воронка сделок (crm_leads) */}
      {(activeSection === 'overview' || activeSection === 'leads') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Воронка сделок
            </h2>
            <button
              type="button"
              onClick={() => openModalFor('leads')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              + Добавить сделку
            </button>
          </div>

          {leads.length === 0 ? (
            <EmptyStateCard
              description="Создайте первую сделку вручную или примите входящее обращение через Telegram-бота."
              onAddClick={() => openModalFor('leads')}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-tight text-slate-500">
                      <th className="py-3 px-4">Название клиента</th>
                      <th className="py-3 px-4">Стадия</th>
                      <th className="py-3 px-4">Сумма</th>
                      <th className="py-3 px-4">Контакты</th>
                      <th className="py-3 px-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {lead.full_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            aria-label={`Стадия сделки ${lead.full_name}`}
                            value={lead.stage}
                            onChange={(e) =>
                              void onUpdateLeadStage(
                                lead.id,
                                e.target.value as LeadStage
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                          >
                            {Object.entries(LEAD_STAGE_LABELS).map(
                              ([val, label]) => (
                                <option key={val} value={val}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {(Number(lead.deal_value) || 0).toLocaleString(
                            'ru-RU'
                          )}{' '}
                          ₽
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {lead.phone || lead.description || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => void onDeleteLead(lead.id)}
                            aria-label="Удалить сделку"
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Секция 2: Активные задачи (tasks) */}
      {(activeSection === 'overview' || activeSection === 'tasks') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Активные задачи
            </h2>
            <button
              type="button"
              onClick={() => openModalFor('tasks')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              + Добавить задачу
            </button>
          </div>

          {tasks.length === 0 ? (
            <EmptyStateCard
              description="Запланируйте задачи вручную или отправьте обычное текстовое сообщение в Telegram-бота."
              onAddClick={() => openModalFor('tasks')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map((task) => {
                const isDone = task.status === 'done';
                const assignee = nodes.find((n) => n.id === task.assigned_to);
                return (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => void onToggleTaskDone(task)}
                        aria-label="Переключить статус выполнения"
                        className="mt-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                      <div className="min-w-0 space-y-1">
                        <div
                          className={`text-sm font-semibold tracking-tight ${
                            isDone
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            Приоритет: {PRIORITY_LABELS[task.priority]}
                          </span>
                          {assignee && (
                            <span>Исполнитель: {assignee.name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onDeleteTask(task.id)}
                      aria-label="Удалить задачу"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Секция 3: Сотрудники организации (organization_nodes) */}
      {(activeSection === 'overview' || activeSection === 'team') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Сотрудники
            </h2>
            <button
              type="button"
              onClick={() => openModalFor('team')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              + Добавить сотрудника
            </button>
          </div>

          {nodes.length === 0 ? (
            <EmptyStateCard
              description="Зарегистрируйте сотрудников компании и укажите их Telegram ID для бесшовного доступа."
              onAddClick={() => openModalFor('team')}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-tight text-slate-500">
                      <th className="py-3 px-4">Имя сотрудника</th>
                      <th className="py-3 px-4">Роль</th>
                      <th className="py-3 px-4">Telegram ID</th>
                      <th className="py-3 px-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {nodes.map((node) => (
                      <tr
                        key={node.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {node.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                            {ROLE_LABELS[node.role_type] || node.role_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {node.telegram_chat_id || 'Не привязан'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => void onDeleteNode(node.id)}
                            aria-label="Удалить сотрудника"
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Динамическая модальная форма (БЛОК 1: AddRecordModal) */}
      <AddRecordModal
        isOpen={Boolean(createModalTarget)}
        initialTab={resolvedModalTab}
        onClose={onCloseCreateModal}
        employees={nodes}
        companyIdOverride={company?.id ?? undefined}
        onLeadCreated={onLeadCreated}
        onTaskCreated={onTaskCreated}
        onEmployeeCreated={onEmployeeCreated}
      />
    </div>
  );
};
