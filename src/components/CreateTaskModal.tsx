import React, { useState } from 'react';
import { PartnerNode, TaskItem, TaskPriority } from '../types/saas';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState(projects[0] || 'Запуск партнёров');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [assigneeName, setAssigneeName] = useState(
    preselectedAssignee || partners[0]?.name || 'Алина Соколова'
  );
  const [dueDate, setDueDate] = useState('2026-10-29');
  const [pvImpact, setPvImpact] = useState('300');
  const [subtaskText, setSubtaskText] = useState(
    'Провести вводный инструктаж\nЗафиксировать контрольную точку в CRM'
  );
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Пожалуйста, укажите название задачи.');
      return;
    }
    const parsedPv = Number(pvImpact);
    if (Number.isNaN(parsedPv) || parsedPv < 0) {
      setErrorMessage('Укажите корректное числовое значение PV (Очков объёма).');
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
        'Операционная задача в рамках стандартизации рабочего процесса партнёра.',
      priority,
      project,
      assigneeName,
      assigneeRole: 'Независимый Партнёр',
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
            Постановка новой задачи в партнёрскую сеть
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
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

          <div>
            <label
              htmlFor="new-task-title"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Название задачи *
            </label>
            <input
              id="new-task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Например: Провести стартовый разбор рациона для 5 клиентов"
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

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
                Исполнитель (Партнёр)
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                className="w-full px-3 py-2 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md"
              />
            </div>

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
                className="w-full px-3 py-2 text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="new-task-desc"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Регламент и описание результата
            </label>
            <textarea
              id="new-task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите критерии приёмки задачи наставником..."
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
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Создать задачу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
