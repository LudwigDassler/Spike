import React, { useEffect, useState } from 'react';
import { PartnerNode, TaskClass, TaskItem, TaskPriority } from '../types/saas';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';
import { useCurrentRole } from '../context/RoleContext';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (newTaskData: Omit<TaskItem, 'id' | 'code' | 'status'>) => void;
  partners: PartnerNode[];
  projects: string[];
  preselectedAssignee?: string;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  partners,
  projects,
  preselectedAssignee,
}) => {
  const { currentRole } = useCurrentRole();
  const [taskClass, setTaskClass] = useState<TaskClass>(
    currentRole === 'INTERNAL_IT' ? 'internal_ticket' : 'client_action'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState(projects[0] || 'Запуск партнёров');
  const [targetDepartment, setTargetDepartment] = useState(
    DEPARTMENT_QUEUE_OPTIONS[0].label
  );
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [assigneeName, setAssigneeName] = useState(
    preselectedAssignee || partners[0]?.name || 'Алина Соколова'
  );
  const [dueDate, setDueDate] = useState('2026-10-29');
  const [pvImpact, setPvImpact] = useState('300');
  const [subtaskText, setSubtaskText] = useState(
    'Провести первичный разбор обращения\nЗафиксировать результат выполнения'
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (currentRole === 'INTERNAL_IT') {
      setTaskClass('internal_ticket');
    }
  }, [currentRole]);

  if (!isOpen) return null;

  const isInternalTicket = taskClass === 'internal_ticket';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Пожалуйста, укажите название задачи или тикета.');
      return;
    }

    const parsedPv = isInternalTicket ? 0 : Number(pvImpact);
    if (!isInternalTicket && (Number.isNaN(parsedPv) || parsedPv < 0)) {
      setErrorMessage('Укажите корректное числовое значение PV.');
      return;
    }

    const subtasks = subtaskText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        id: `custom-st-${Date.now()}-${idx}`,
        title: line,
        completed: false,
      }));

    onCreateTask({
      title: title.trim(),
      description:
        description.trim() ||
        (isInternalTicket
          ? `Сервисный тикет направлен в очередь отдела [${targetDepartment}].`
          : 'Клиентская задача в рамках сопровождения и повторных продаж.'),
      task_class: taskClass,
      targetDepartment: isInternalTicket ? targetDepartment : undefined,
      priority,
      project: isInternalTicket ? 'IT и инфраструктура' : project,
      assigneeName: isInternalTicket
        ? `Очередь отдела: ${targetDepartment}`
        : assigneeName,
      assigneeRole: isInternalTicket
        ? `Департамент ${targetDepartment}`
        : 'Независимый Партнёр',
      dueDate,
      pvImpact: parsedPv,
      estimatedHours: 3,
      subtasks,
    });

    setTitle('');
    setDescription('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-create-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2 id="modal-create-task-title" className="text-base font-bold text-slate-900">
            {isInternalTicket
              ? 'Создание тикета в очередь отдела TedCloud'
              : 'Постановка новой клиентской задачи'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Закрыть
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md"
            >
              {errorMessage}
            </div>
          )}

          {/* Переключатель класса задачи: client_action vs internal_ticket */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Тип создаваемой карточки
            </span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTaskClass('client_action')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  !isInternalTicket
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Клиентская задача
              </button>
              <button
                type="button"
                onClick={() => setTaskClass('internal_ticket')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  isInternalTicket
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Внутренний тикет в отдел
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="new-task-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              {isInternalTicket ? 'Тема обращения / тикета *' : 'Название задачи *'}
            </label>
            <input
              id="new-task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder={
                isInternalTicket
                  ? 'Например: Ошибка при выгрузке отчёта по региональному складу'
                  : 'Например: Провести стартовый разбор рациона для 5 клиентов'
              }
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Маршрутизация: для internal_ticket выбирается ЦЕЛЕВОЙ ОТДЕЛ из дерева, а не конкретный человек */}
          {isInternalTicket ? (
            <div>
              <label
                htmlFor="new-ticket-department"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Целевой отдел из структуры компании (Общая очередь)
              </label>
              <select
                id="new-ticket-department"
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {DEPARTMENT_QUEUE_OPTIONS.map((dept) => (
                  <option key={dept.id} value={dept.label}>
                    [{dept.label}] — {dept.category}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Тикет поступит в общую очередь выбранного отдела без прямого назначения на конкретного инженера.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-task-project"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Проект / Направление
                </label>
                <select
                  id="new-task-project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md"
                >
                  {projects.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-task-assignee"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Ответственный партнёр
                </label>
                <select
                  id="new-task-assignee"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md"
                >
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.name}>
                      {partner.name} ({partner.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 ${isInternalTicket ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
            <div>
              <label
                htmlFor="new-task-priority"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Приоритет
              </label>
              <select
                id="new-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md"
              >
                <option value="critical">Критичный</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>

            {!isInternalTicket && (
              <div>
                <label
                  htmlFor="new-task-pv"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Вклад в объём (PV)
                </label>
                <input
                  id="new-task-pv"
                  type="number"
                  value={pvImpact}
                  onChange={(e) => setPvImpact(e.target.value)}
                  className="w-full px-3 py-2 text-xs tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="new-task-due"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Срок выполнения
              </label>
              <input
                id="new-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="new-task-desc"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              {isInternalTicket
                ? 'Описание проблемы и шаги воспроизведения'
                : 'Регламент и описание результата'}
            </label>
            <textarea
              id="new-task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isInternalTicket
                  ? 'Опишите детали запроса для специалистов целевого отдела...'
                  : 'Опишите критерии приёмки задачи наставником...'
              }
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label
              htmlFor="new-task-subtasks"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Шаги чек-листа (каждый с новой строки)
            </label>
            <textarea
              id="new-task-subtasks"
              rows={2}
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isInternalTicket
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {isInternalTicket ? 'Отправить тикет в отдел' : 'Создать задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
