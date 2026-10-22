import React, { useState } from 'react';
import {
  PartnerPlaybook,
  TaskItem,
  TaskPriority,
  TaskStatus,
  WhiteLabelPreset,
} from '../types/saas';
import { computeTaskBoardMetrics, filterTasks } from '../utils/saasLogic';
import { CheckSquare, ListFilter, Plus, Search, Square } from 'lucide-react';

interface TasksWorkspaceViewProps {
  tasks: TaskItem[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
  activePreset: WhiteLabelPreset;
  playbooks: PartnerPlaybook[];
  onAdvanceStatus: (taskId: string) => void;
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeployPlaybook: (playbook: PartnerPlaybook) => void;
  onOpenNewTaskModal: () => void;
}

const STATUS_COLUMNS: Array<{ id: TaskStatus; label: string; actionLabel: string }> = [
  { id: 'todo', label: 'К выполнению', actionLabel: 'Взять в работу' },
  { id: 'in_progress', label: 'В работе', actionLabel: 'Отправить на проверку' },
  { id: 'review', label: 'На проверке', actionLabel: 'Подтвердить выполнение' },
  { id: 'done', label: 'Готово', actionLabel: 'Выполнено' },
];

const PRIORITY_LABELS: Record<TaskPriority, { text: string; colorClass: string }> = {
  critical: { text: 'Критичный', colorClass: 'text-red-700 font-semibold' },
  high: { text: 'Высокий', colorClass: 'text-amber-700 font-semibold' },
  medium: { text: 'Средний', colorClass: 'text-slate-700 font-medium' },
  low: { text: 'Низкий', colorClass: 'text-slate-500' },
};

export const TasksWorkspaceView: React.FC<TasksWorkspaceViewProps> = ({
  tasks,
  selectedProject,
  onSelectProject,
  activePreset,
  playbooks,
  onAdvanceStatus,
  onChangeStatus,
  onToggleSubtask,
  onDeleteTask,
  onDeployPlaybook,
  onOpenNewTaskModal,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'playbooks'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>('task-1');

  const metrics = computeTaskBoardMetrics(tasks);
  const filteredTasks = filterTasks(tasks, {
    search: searchQuery,
    status: statusFilter,
    priority: priorityFilter,
    project: selectedProject,
  });

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    onSelectProject('all');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Contextual Header & KPI Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Рабочее пространство · {activePreset.brandName} ·{' '}
            {selectedProject === 'all' ? 'Все проекты' : selectedProject}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Управление задачами и партнёрскими спринтами
          </h1>
        </div>

        {/* Clean Segmented View Switcher */}
        <div
          role="group"
          aria-label="Режим отображения задач"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
        >
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'kanban'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Канбан-доска
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Таблица реестра
          </button>
          <button
            type="button"
            onClick={() => setViewMode('playbooks')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'playbooks'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Библиотека плейбуков ({playbooks.length})
          </button>
        </div>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Всего задач в потоке</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.total}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            В работе: {metrics.inProgress} · На проверке: {metrics.review}
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Индекс закрытия спринта</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {metrics.completionRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Завершено {metrics.done} из {metrics.total} задач
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">
            Потенциал объёма · {activePreset.volumeUnitLabel}
          </div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            +{metrics.totalPvImpact.toLocaleString('ru-RU')}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Уже подтверждено: {metrics.earnedPvImpact.toLocaleString('ru-RU')} PV
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Критичные дедлайны</div>
          <div
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              metrics.criticalCount > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {metrics.criticalCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Требуют контроля наставника ветки
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-lg">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="task-search-input" className="sr-only">
            Поиск по коду, названию задачи или партнёру
          </label>
          <input
            id="task-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по коду (PF-101), задаче или ответственному партнёру..."
            className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-slate-500" />
            <label htmlFor="status-filter-select" className="text-xs text-slate-600">
              Статус:
            </label>
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="all">Все статусы</option>
              <option value="todo">К выполнению</option>
              <option value="in_progress">В работе</option>
              <option value="review">На проверке</option>
              <option value="done">Готово</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="priority-filter-select" className="text-xs text-slate-600">
              Приоритет:
            </label>
            <select
              id="priority-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="all">Все приоритеты</option>
              <option value="critical">Критичный</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>

          {(searchQuery !== '' ||
            statusFilter !== 'all' ||
            priorityFilter !== 'all' ||
            selectedProject !== 'all') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      {/* Empty State if no tasks match */}
      {filteredTasks.length === 0 && viewMode !== 'playbooks' && (
        <div className="p-10 bg-white border border-slate-200 rounded-lg text-center">
          <h2 className="text-base font-semibold text-slate-900">
            По выбранным параметрам задач не найдено
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Измените параметры поиска или разверните готовый шаблон запуска нового партнёра из библиотеки плейбуков.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Показать все задачи
            </button>
            <button
              type="button"
              onClick={onOpenNewTaskModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              + Создать задачу
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: KANBAN BOARD */}
      {viewMode === 'kanban' && filteredTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const colPv = colTasks.reduce((acc, item) => acc + item.pvImpact, 0);

            return (
              <section
                key={col.id}
                aria-label={`Колонка ${col.label}`}
                className="flex flex-col gap-3"
              >
                <div className="pb-2 border-b border-slate-300 flex items-baseline justify-between">
                  <h2 className="text-xs font-bold text-slate-800">
                    {col.label}
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {colTasks.length} зад. · {colPv} PV
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {colTasks.map((task) => {
                    const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
                    const isExpanded = expandedTaskId === task.id;
                    const priorityMeta = PRIORITY_LABELS[task.priority];

                    return (
                      <article
                        key={task.id}
                        className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col gap-2.5 hover:border-slate-300 transition-colors"
                      >
                        {/* Unboxed Metadata Kicker (Zero-Pill Discipline) */}
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono tabular-nums font-medium text-slate-700">
                            {task.code} · {task.project}
                          </span>
                          <span className={priorityMeta.colorClass}>
                            {priorityMeta.text}
                          </span>
                        </div>

                        {/* Task Title */}
                        <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                          {task.title}
                        </h3>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {task.description}
                        </p>

                        {/* Clean Unboxed Metadata Line */}
                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="font-medium text-slate-800">
                            {task.assigneeName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Срок: {task.dueDate}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                            +{task.pvImpact} PV
                          </span>
                        </div>

                        {/* Interactive Subtasks Checklist Toggle */}
                        {task.subtasks.length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedTaskId(isExpanded ? null : task.id)
                              }
                              className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
                            >
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="font-mono tabular-nums">
                                Чек-лист: {completedSubtasks}/{task.subtasks.length}
                              </span>
                              <span className="text-slate-400 underline ml-1">
                                {isExpanded ? 'Скрыть' : 'Открыть шаги'}
                              </span>
                            </button>

                            {isExpanded && (
                              <ul className="mt-2 space-y-1.5 pl-1 border-t border-slate-100 pt-2">
                                {task.subtasks.map((st) => (
                                  <li key={st.id}>
                                    <button
                                      type="button"
                                      onClick={() => onToggleSubtask(task.id, st.id)}
                                      className="flex items-start gap-2 text-left text-xs text-slate-700 hover:text-slate-900 w-full"
                                    >
                                      {st.completed ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      )}
                                      <span
                                        className={
                                          st.completed ? 'line-through text-slate-400' : ''
                                        }
                                      >
                                        {st.title}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Action Bar */}
                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                          {task.status !== 'done' ? (
                            <button
                              type="button"
                              onClick={() => onAdvanceStatus(task.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                            >
                              {col.actionLabel} →
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                              ✓ Выполнено · +{task.pvImpact} PV
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label={`Удалить задачу ${task.code}`}
                            className="text-xs text-slate-400 hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
                          >
                            Архив
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: HIGH-DENSITY DATA GRID TABLE */}
      {viewMode === 'table' && filteredTasks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Код</th>
                <th className="py-3 px-4">Задача и проект</th>
                <th className="py-3 px-4">Ответственный партнёр</th>
                <th className="py-3 px-4">Приоритет</th>
                <th className="py-3 px-4">Статус этапа</th>
                <th className="py-3 px-4 text-right">Эффект PV</th>
                <th className="py-3 px-4 text-right">Дедлайн</th>
                <th className="py-3 px-4 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredTasks.map((task) => {
                const priorityMeta = PRIORITY_LABELS[task.priority];
                return (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap">
                      {task.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{task.title}</div>
                      <div className="text-slate-500 mt-0.5">
                        {task.project}
                        {task.playbookSource ? ` · Шаблон: ${task.playbookSource}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{task.assigneeName}</div>
                      <div className="text-slate-500">{task.assigneeRole}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={priorityMeta.colorClass}>{priorityMeta.text}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <label htmlFor={`status-select-${task.id}`} className="sr-only">
                        Статус задачи {task.code}
                      </label>
                      <select
                        id={`status-select-${task.id}`}
                        value={task.status}
                        onChange={(e) =>
                          onChangeStatus(task.id, e.target.value as TaskStatus)
                        }
                        className="px-2 py-1 text-xs font-medium bg-white border border-slate-300 rounded text-slate-800"
                      >
                        <option value="todo">К выполнению</option>
                        <option value="in_progress">В работе</option>
                        <option value="review">На проверке</option>
                        <option value="done">Готово</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                      +{task.pvImpact} PV
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {task.dueDate}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {task.status !== 'done' ? (
                        <button
                          type="button"
                          onClick={() => onAdvanceStatus(task.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                        >
                          Продвинуть →
                        </button>
                      ) : (
                        <span className="text-slate-400">Закрыта</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW MODE 3: PARTNER PLAYBOOKS LIBRARY */}
      {viewMode === 'playbooks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {playbooks.map((pb) => (
            <div
              key={pb.id}
              className="p-5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-4"
            >
              <div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  {pb.category} · {pb.durationDays} дней · +{pb.expectedPvGain} PV
                </div>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  {pb.title}
                </h2>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {pb.description}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-800 mb-2">
                    Автоматически создаваемые задачи ({pb.tasksTemplate.length}):
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {pb.tasksTemplate.map((tpl, i) => (
                      <li key={i} className="flex items-start justify-between gap-2">
                        <span>
                          {i + 1}. {tpl.title}
                        </span>
                        <span className="font-mono tabular-nums text-emerald-700 font-medium shrink-0">
                          +{tpl.pvImpact} PV
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onDeployPlaybook(pb);
                  setViewMode('kanban');
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Развернуть плейбук на доску задач</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
