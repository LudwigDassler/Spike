import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type {
  CrmLeadRecord,
  OrganizationNode,
  OrganizationRoleType,
  TaskPriorityType,
  TaskRecord,
} from '../types/database';
import { useTelegramAuth } from './TelegramAuthProvider';

export type AddRecordTab = 'deal' | 'task' | 'employee';

export interface AddRecordModalProps {
  isOpen: boolean;
  initialTab?: AddRecordTab;
  onClose: () => void;
  employees: OrganizationNode[];
  companyIdOverride?: string | null;
  onLeadCreated?: (lead: CrmLeadRecord) => void;
  onTaskCreated?: (task: TaskRecord) => void;
  onEmployeeCreated?: (employee: OrganizationNode) => void;
}

const EMPLOYEE_ROLE_OPTIONS: Array<{
  value: OrganizationRoleType;
  label: string;
}> = [
  { value: 'SUPERADMIN', label: 'SUPERADMIN (Суперадминистратор)' },
  { value: 'Owner', label: 'Owner (Владелец компании)' },
  { value: 'Manager', label: 'Manager (Руководитель направления)' },
  { value: 'Specialist', label: 'Specialist (Линейный специалист)' },
  { value: 'Observer', label: 'Observer (Наблюдатель / Аналитик)' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriorityType; label: string }> = [
  { value: 'Low', label: 'Низкий (Low)' },
  { value: 'Medium', label: 'Средний (Medium)' },
  { value: 'High', label: 'Высокий (High)' },
];

function notifyError(message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    try {
      window.alert(message);
    } catch {
      // Игнорируем блокировку window.alert в песочнице iframe
    }
  }
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  initialTab = 'deal',
  onClose,
  employees,
  companyIdOverride,
  onLeadCreated,
  onTaskCreated,
  onEmployeeCreated,
}) => {
  const { companyId: contextCompanyId, userId: currentUserId } =
    useTelegramAuth();
  const activeCompanyId =
    companyIdOverride !== undefined ? companyIdOverride : contextCompanyId;

  const [activeTab, setActiveTab] = useState<AddRecordTab>(initialTab);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Поля вкладки "Сделка" (crm_leads: client_name, amount, contact, status)
  const [clientName, setClientName] = useState<string>('');
  const [dealAmount, setDealAmount] = useState<string>('');
  const [clientContacts, setClientContacts] = useState<string>('');

  // Поля вкладки "Задача" (tasks: title, priority, assigned_to, status)
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<TaskPriorityType>('Medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');

  // Поля вкладки "Сотрудник" (organization_nodes: name, telegram_chat_id, role_type)
  const [employeeName, setEmployeeName] = useState<string>('');
  const [employeeTelegramId, setEmployeeTelegramId] = useState<string>('');
  const [employeeRole, setEmployeeRole] =
    useState<OrganizationRoleType>('Specialist');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStatusMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) {
    return null;
  }

  const resetCurrentTabFields = (tab: AddRecordTab) => {
    if (tab === 'deal') {
      setClientName('');
      setDealAmount('');
      setClientContacts('');
    } else if (tab === 'task') {
      setTaskDescription('');
      setTaskPriority('Medium');
      setTaskAssigneeId('');
    } else if (tab === 'employee') {
      setEmployeeName('');
      setEmployeeTelegramId('');
      setEmployeeRole('Specialist');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsLoading(true);

    try {
      // 1. Вкладка "Сделка" -> POST /api/db (crm_leads)
      if (activeTab === 'deal') {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity: 'deal',
            payload: {
              company_id: activeCompanyId,
              owner_node_id:
                currentUserId && currentUserId !== 'default-workspace-node'
                  ? currentUserId
                  : null,
              client_name: clientName.trim(),
              full_name: clientName.trim(),
              amount: Number(dealAmount) || 0,
              deal_value: Number(dealAmount) || 0,
              contact: clientContacts.trim() || null,
              phone: clientContacts.trim() || null,
              status: 'lead',
            },
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
          const errMsg = result.error || 'Не удалось сохранить сделку.';
          setStatusMessage({ type: 'error', text: errMsg });
          notifyError(errMsg);
          return;
        }

        if (onLeadCreated && result.data) {
          onLeadCreated(result.data as CrmLeadRecord);
        }

        const savedName =
          result.data.client_name || result.data.full_name || clientName.trim();
        setStatusMessage({
          type: 'success',
          text: `Сделка «${savedName}» успешно добавлена в воронку.`,
        });
        resetCurrentTabFields('deal');
      }

      // 2. Вкладка "Задача" -> POST /api/db (tasks + автоматический Telegram Push при назначении)
      if (activeTab === 'task') {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity: 'task',
            payload: {
              company_id: activeCompanyId,
              title: taskDescription.trim(),
              priority: taskPriority,
              assigned_to: taskAssigneeId.trim() || null,
              created_by:
                currentUserId && currentUserId !== 'default-workspace-node'
                  ? currentUserId
                  : null,
              status: 'new',
            },
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
          const errMsg = result.error || 'Не удалось создать задачу.';
          setStatusMessage({ type: 'error', text: errMsg });
          notifyError(errMsg);
          return;
        }

        if (onTaskCreated && result.data) {
          onTaskCreated(result.data as TaskRecord);
        }

        setStatusMessage({
          type: 'success',
          text: taskAssigneeId
            ? `Задача «${result.data.title}» создана и отправлена исполнителю в Telegram.`
            : `Задача «${result.data.title}» добавлена в рабочее пространство.`,
        });
        resetCurrentTabFields('task');
      }

      // 3. Вкладка "Сотрудник" -> POST /api/db (organization_nodes)
      if (activeTab === 'employee') {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity: 'employee',
            payload: {
              company_id: activeCompanyId,
              name: employeeName.trim(),
              telegram_chat_id: employeeTelegramId.trim(),
              role_type: employeeRole,
            },
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
          const errMsg = result.error || 'Не удалось добавить сотрудника.';
          setStatusMessage({ type: 'error', text: errMsg });
          notifyError(errMsg);
          return;
        }

        if (onEmployeeCreated && result.data) {
          onEmployeeCreated(result.data as OrganizationNode);
        }

        setStatusMessage({
          type: 'success',
          text: `Сотрудник «${result.data.name}» успешно добавлен в команду.`,
        });
        resetCurrentTabFields('employee');
      }
    } catch (error: any) {
      const errMsg =
        error?.message || 'Ошибка соединения с сервером. Повторите попытку.';
      setStatusMessage({
        type: 'error',
        text: errMsg,
      });
      notifyError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-record-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="add-record-modal-title"
              className="text-base font-semibold tracking-tight text-slate-900"
            >
              Новая запись TedCloud
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Выберите тип записи для добавления в рабочее пространство
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Тип создаваемой записи"
          className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'deal'}
            onClick={() => {
              setActiveTab('deal');
              setStatusMessage(null);
            }}
            className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === 'deal'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Сделка
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'task'}
            onClick={() => {
              setActiveTab('task');
              setStatusMessage(null);
            }}
            className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === 'task'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Задача
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'employee'}
            onClick={() => {
              setActiveTab('employee');
              setStatusMessage(null);
            }}
            className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === 'employee'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Сотрудник
          </button>
        </div>

        {statusMessage && (
          <div
            role="alert"
            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'deal' && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="deal-client-name"
                  className="block text-xs font-medium text-slate-700"
                >
                  Название клиента
                </label>
                <input
                  id="deal-client-name"
                  type="text"
                  required
                  disabled={isLoading}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Например: ООО ТехноЛогистика"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="deal-amount"
                  className="block text-xs font-medium text-slate-700"
                >
                  Сумма сделки (₽)
                </label>
                <input
                  id="deal-amount"
                  type="number"
                  min="0"
                  step="any"
                  required
                  disabled={isLoading}
                  value={dealAmount}
                  onChange={(e) => setDealAmount(e.target.value)}
                  placeholder="150000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="deal-contacts"
                  className="block text-xs font-medium text-slate-700"
                >
                  Контакт клиента
                </label>
                <input
                  id="deal-contacts"
                  type="text"
                  required
                  disabled={isLoading}
                  value={clientContacts}
                  onChange={(e) => setClientContacts(e.target.value)}
                  placeholder="+7 (999) 000-00-00 или @telegram_username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                />
              </div>
            </>
          )}

          {activeTab === 'task' && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="task-description"
                  className="block text-xs font-medium text-slate-700"
                >
                  Описание задачи
                </label>
                <textarea
                  id="task-description"
                  rows={3}
                  required
                  disabled={isLoading}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Опишите задачу, которую необходимо выполнить..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="task-priority"
                  className="block text-xs font-medium text-slate-700"
                >
                  Приоритет
                </label>
                <select
                  id="task-priority"
                  disabled={isLoading}
                  value={taskPriority}
                  onChange={(e) =>
                    setTaskPriority(e.target.value as TaskPriorityType)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="task-assignee"
                  className="block text-xs font-medium text-slate-700"
                >
                  Исполнитель (отправит Push-уведомление в Telegram)
                </label>
                <select
                  id="task-assignee"
                  disabled={isLoading}
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                >
                  <option value="">Не назначено (общая очередь)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role_type})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === 'employee' && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="employee-name"
                  className="block text-xs font-medium text-slate-700"
                >
                  Имя и фамилия
                </label>
                <input
                  id="employee-name"
                  type="text"
                  required
                  disabled={isLoading}
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Введите имя и фамилию сотрудника"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="employee-telegram-id"
                  className="block text-xs font-medium text-slate-700"
                >
                  Telegram Chat ID
                </label>
                <input
                  id="employee-telegram-id"
                  type="text"
                  required
                  disabled={isLoading}
                  value={employeeTelegramId}
                  onChange={(e) => setEmployeeTelegramId(e.target.value)}
                  placeholder="Например: 123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="employee-role"
                  className="block text-xs font-medium text-slate-700"
                >
                  Роль в организации
                </label>
                <select
                  id="employee-role"
                  disabled={isLoading}
                  value={employeeRole}
                  onChange={(e) =>
                    setEmployeeRole(e.target.value as OrganizationRoleType)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600 disabled:bg-slate-50"
                >
                  {EMPLOYEE_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-all duration-200 cursor-pointer"
            >
              {isLoading
                ? 'Сохранение...'
                : activeTab === 'deal'
                ? 'Сохранить сделку'
                : activeTab === 'task'
                ? 'Создать задачу'
                : 'Добавить сотрудника'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
