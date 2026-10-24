import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Inbox,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UserCheck,
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
  TaskRecord,
  TaskStatusType,
  computeDashboardKpis,
  getLeadAmount,
  getLeadClientName,
  getLeadContact,
  getLeadStatus,
  isHighPriority,
  normalizePriorityLabel,
} from '../types/database';
import { AddRecordModal, AddRecordTab } from './AddRecordModal';

export type TaskQuickFilter = 'all' | 'in_progress' | 'high_priority' | 'done';

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
  onUpdateTask?: (
    taskId: string,
    updates: Partial<Pick<TaskRecord, 'status' | 'priority' | 'assigned_to'>>
  ) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onEmployeeCreated: (node: OrganizationNode) => void;
  onDeleteNode: (nodeId: string) => Promise<void>;
  isLoading?: boolean;
  feedbackBanner?: { type: 'success' | 'error'; text: string } | null;
  onDismissFeedback?: () => void;
}

const PIPELINE_STEPS: Array<{ value: LeadStage; label: string }> = [
  { value: 'lead', label: 'Лид' },
  { value: 'negotiation', label: 'Переговоры' },
  { value: 'qualified', label: 'Квалифицирован' },
  { value: 'won', label: 'Закрыта / Оплачена' },
];

const TASK_STATUS_STEPS: Array<{ value: TaskStatusType; label: string }> = [
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готово' },
];

const ROLE_LABELS: Record<OrganizationRoleType, string> = {
  Owner: 'Owner (Владелец)',
  Manager: 'Manager (Руководитель)',
  Specialist: 'Specialist (Специалист)',
  Observer: 'Observer (Наблюдатель)',
  SUPERADMIN: 'SUPERADMIN (Суперадмин)',
  INTERNAL_IT: 'Инженер поддержки',
  NETWORK_PARTNER: 'Менеджер по продажам',
};

export const EmptyStateCard: React.FC<{
  description?: string;
  onAddClick: () => void;
}> = ({ description, onAddClick }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs flex flex-col items-center justify-center gap-3">
    <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
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
      <span>Добавить запись</span>
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
  onUpdateTask,
  onDeleteTask,
  onEmployeeCreated,
  onDeleteNode,
  feedbackBanner,
  onDismissFeedback,
}) => {
  const kpis = computeDashboardKpis(leads, tasks, nodes);
  const [initialModalTab, setInitialModalTab] = useState<AddRecordTab>('deal');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [taskFilter, setTaskFilter] = useState<TaskQuickFilter>('all');

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

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Фильтрация задач по строке поиска и быстрому фильтру (Все | В работе | Высокий приоритет | Завершенные)
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskFilter === 'in_progress' && task.status !== 'in_progress') {
        return false;
      }
      if (taskFilter === 'high_priority' && !isHighPriority(task.priority)) {
        return false;
      }
      if (taskFilter === 'done' && task.status !== 'done') {
        return false;
      }

      if (!normalizedQuery) return true;

      const assigneeName =
        nodes.find((n) => n.id === task.assigned_to)?.name?.toLowerCase() || '';
      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        assigneeName.includes(normalizedQuery) ||
        String(task.priority || '')
          .toLowerCase()
          .includes(normalizedQuery)
      );
    });
  }, [tasks, taskFilter, normalizedQuery, nodes]);

  // Фильтрация сделок по строке поиска
  const filteredLeads = useMemo(() => {
    if (!normalizedQuery) return leads;
    return leads.filter((lead) => {
      const name = getLeadClientName(lead).toLowerCase();
      const contact = getLeadContact(lead).toLowerCase();
      return name.includes(normalizedQuery) || contact.includes(normalizedQuery);
    });
  }, [leads, normalizedQuery]);

  const handleTaskStatusSelect = async (
    task: TaskRecord,
    nextStatus: TaskStatusType
  ) => {
    if (task.status === nextStatus) return;
    if (onUpdateTask) {
      await onUpdateTask(task.id, { status: nextStatus });
    } else {
      await onToggleTaskDone(task);
    }
  };

  const handleCycleTaskStatus = async (task: TaskRecord) => {
    const nextStatus: TaskStatusType =
      task.status === 'new' || task.status === 'todo'
        ? 'in_progress'
        : task.status === 'in_progress'
        ? 'done'
        : 'new';
    await handleTaskStatusSelect(task, nextStatus);
  };

  const getPriorityBadgeStyle = (priority?: string | null) => {
    const label = normalizePriorityLabel(priority);
    if (label === 'High') {
      return {
        label: 'High',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (label === 'Low') {
      return {
        label: 'Low',
        className: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    }
    return {
      label: 'Medium',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  };

  return (
    <div className="font-sans space-y-6">
      {/* Шапка рабочего пространства */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {activeSection === 'overview' && 'Обзор рабочего пространства'}
            {activeSection === 'leads' && 'Воронка сделок'}
            {activeSection === 'tasks' && 'Доска задач'}
            {activeSection === 'team' && 'Команда организации'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {company?.name
              ? `Организация: ${company.name}`
              : 'Единое B2B-пространство управления продажами, задачами и командой'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModalFor(activeSection)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Новая запись</span>
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

      {/* Карточки KPI в стиле Linear / Vercel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
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

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Активные задачи</span>
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.activeTasksCount}
          </div>
          <div className="text-xs text-slate-400">
            Выполнено: {tasks.filter((t) => t.status === 'done').length} из{' '}
            {tasks.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Конверсия</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.conversionRatePercent}%
          </div>
          <div className="text-xs text-slate-400">
            Доля квалифицированных и оплаченных сделок
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Сотрудники</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {kpis.employeesCount}
          </div>
          <div className="text-xs text-slate-400">
            Активные участники с Telegram Push
          </div>
        </div>
      </div>

      {/* Панель быстрого поиска и фильтров */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Быстрый поиск по задачам, клиентам, контактам или исполнителям..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition-colors"
          />
        </div>

        <div
          role="group"
          aria-label="Фильтры задач"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(
            [
              { id: 'all', label: 'Все' },
              { id: 'in_progress', label: 'В работе' },
              { id: 'high_priority', label: 'Высокий приоритет' },
              { id: 'done', label: 'Завершенные' },
            ] as Array<{ id: TaskQuickFilter; label: string }>
          ).map((f) => {
            const active = taskFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setTaskFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Секция 1: Воронка сделок (crm_leads) с интерактивным переключателем этапов */}
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

          {filteredLeads.length === 0 ? (
            <EmptyStateCard
              description="Добавьте первую сделку и переключайте этапы воронки (Лид ➔ Переговоры ➔ Квалифицирован ➔ Закрыта / Оплачена) для автоматического расчёта конверсии."
              onAddClick={() => openModalFor('leads')}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-tight text-slate-500">
                      <th className="py-3 px-4">Клиент</th>
                      <th className="py-3 px-4">
                        Этап воронки (Лид ➔ Переговоры ➔ Квалифицирован ➔ Закрыта)
                      </th>
                      <th className="py-3 px-4">Сумма</th>
                      <th className="py-3 px-4">Контакт</th>
                      <th className="py-3 px-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredLeads.map((lead) => {
                      const currentStage = getLeadStatus(lead);
                      const amountVal = getLeadAmount(lead);
                      const clientLabel = getLeadClientName(lead);
                      const contactLabel = getLeadContact(lead);

                      return (
                        <tr
                          key={lead.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {clientLabel}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                              {PIPELINE_STEPS.map((step) => {
                                const isCurrent = currentStage === step.value;
                                return (
                                  <button
                                    key={step.value}
                                    type="button"
                                    onClick={() =>
                                      void onUpdateLeadStage(
                                        lead.id,
                                        step.value
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                      isCurrent
                                        ? step.value === 'won'
                                          ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                                          : 'bg-white text-slate-900 font-semibold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    {step.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            {amountVal.toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {contactLabel}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Секция 2: Активные задачи (tasks) с Канбан-переключателем статуса, бейджем приоритета и ответственным */}
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

          {filteredTasks.length === 0 ? (
            <EmptyStateCard
              description="Создайте задачу в веб-интерфейсе или отправьте сообщение в Telegram-бота (начните с ! для приоритета High)."
              onAddClick={() => openModalFor('tasks')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredTasks.map((task) => {
                const isDone = task.status === 'done';
                const currentStatus: TaskStatusType =
                  task.status === 'in_progress'
                    ? 'in_progress'
                    : task.status === 'done'
                    ? 'done'
                    : 'new';
                const assignee = nodes.find((n) => n.id === task.assigned_to);
                const priorityBadge = getPriorityBadgeStyle(task.priority);

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Бейдж приоритета (High — красный, Medium — янтарный, Low — синий) */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-tight ${priorityBadge.className}`}
                          >
                            {priorityBadge.label}
                          </span>

                          {/* Имя ответственного сотрудника */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                            <UserCheck className="w-3 h-3 text-slate-500" />
                            <span>
                              {assignee ? assignee.name : 'Не назначен'}
                            </span>
                          </span>
                        </div>

                        <div
                          className={`text-sm font-semibold tracking-tight leading-snug ${
                            isDone
                              ? 'line-through text-slate-400'
                              : 'text-slate-900'
                          }`}
                        >
                          {task.title}
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

                    {/* Нижняя панель карточки: Канбан-переключатель статуса (Новая ➔ В работе ➔ Готово) и выбор ответственного */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                        {TASK_STATUS_STEPS.map((step, idx) => {
                          const isCurrent = currentStatus === step.value;
                          return (
                            <React.Fragment key={step.value}>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleTaskStatusSelect(task, step.value)
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                  isCurrent
                                    ? step.value === 'done'
                                      ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                                      : step.value === 'in_progress'
                                      ? 'bg-amber-500 text-white font-semibold shadow-xs'
                                      : 'bg-white text-slate-900 font-semibold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {step.label}
                              </button>
                              {idx < TASK_STATUS_STEPS.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {onUpdateTask && nodes.length > 0 ? (
                        <select
                          aria-label={`Ответственный за задачу ${task.title}`}
                          value={task.assigned_to || ''}
                          onChange={(e) =>
                            void onUpdateTask(task.id, {
                              assigned_to: e.target.value || null,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
                        >
                          <option value="">Назначить сотрудника...</option>
                          {nodes.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCycleTaskStatus(task)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          Сменить статус ➔
                        </button>
                      )}
                    </div>
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
              description="Добавьте сотрудников и укажите их Telegram Chat ID, чтобы они мгновенно получали Push-уведомления с кнопками [⚡️ В работу] и [✅ Выполнено] при назначении задач."
              onAddClick={() => openModalFor('team')}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold tracking-tight text-slate-500">
                      <th className="py-3 px-4">Имя сотрудника</th>
                      <th className="py-3 px-4">Роль</th>
                      <th className="py-3 px-4">Telegram Chat ID</th>
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
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
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

      {/* Модальное окно добавления сделки / задачи / сотрудника */}
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
