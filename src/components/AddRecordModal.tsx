'use client';

import React, { useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabase as defaultSupabaseClient } from '../lib/supabaseClient';
import {
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
  supabaseClient?: Pick<SupabaseClient, 'from'> | null;
  onLeadCreated?: (lead: CrmLeadRecord) => void;
  onTaskCreated?: (task: TaskRecord) => void;
  onEmployeeCreated?: (employee: OrganizationNode) => void;
}

const EMPLOYEE_ROLE_OPTIONS: Array<{
  value: OrganizationRoleType;
  label: string;
}> = [
  { value: 'Owner', label: 'Owner (Владелец компании)' },
  { value: 'Manager', label: 'Manager (Руководитель направления)' },
  { value: 'Specialist', label: 'Specialist (Линейный специалист)' },
  { value: 'Observer', label: 'Observer (Наблюдатель / Аналитик)' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriorityType; label: string }> = [
  { value: 'low', label: 'Низкий (Low)' },
  { value: 'medium', label: 'Средний (Medium)' },
  { value: 'high', label: 'Высокий (High)' },
  { value: 'critical', label: 'Критический (Critical)' },
];

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  initialTab = 'deal',
  onClose,
  employees,
  companyIdOverride,
  supabaseClient,
  onLeadCreated,
  onTaskCreated,
  onEmployeeCreated,
}) => {
  const { companyId: contextCompanyId, userId: currentUserId } = useTelegramAuth();
  const activeCompanyId =
    companyIdOverride !== undefined ? companyIdOverride : contextCompanyId;

  const [activeTab, setActiveTab] = useState<AddRecordTab>(initialTab);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Поля вкладки "Сделка" (crm_leads)
  const [clientName, setClientName] = useState<string>('');
  const [dealAmount, setDealAmount] = useState<string>('');
  const [clientContacts, setClientContacts] = useState<string>('');

  // Поля вкладки "Задача" (tasks)
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<TaskPriorityType>('medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');

  // Поля вкладки "Сотрудник" (organization_nodes)
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

  const activeSupabase =
    supabaseClient !== undefined ? supabaseClient : defaultSupabaseClient;

  const resetCurrentTabFields = (tab: AddRecordTab) => {
    if (tab === 'deal') {
      setClientName('');
      setDealAmount('');
      setClientContacts('');
    } else if (tab === 'task') {
      setTaskDescription('');
      setTaskPriority('medium');
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
      // 1. Вкладка "Сделка" -> таблица crm_leads
      if (activeTab === 'deal') {
        const trimmedClient = clientName.trim();
        if (!trimmedClient) {
          throw new Error('Укажите название клиента.');
        }

        const numericAmount = Number(dealAmount) || 0;
        const trimmedContacts = clientContacts.trim() || null;

        if (activeSupabase) {
          const { data, error } = await activeSupabase
            .from('crm_leads')
            .insert({
              company_id: activeCompanyId,
              owner_node_id: currentUserId || null,
              full_name: trimmedClient,
              deal_value: numericAmount,
              phone: trimmedContacts,
              stage: 'new',
            })
            .select()
            .single();

          if (error) {
            throw new Error(error.message);
          }

          if (data && onLeadCreated) {
            onLeadCreated(data as CrmLeadRecord);
          }
        } else if (onLeadCreated) {
          onLeadCreated({
            id: crypto.randomUUID(),
            company_id: activeCompanyId,
            owner_node_id: currentUserId || null,
            full_name: trimmedClient,
            deal_value: numericAmount,
            phone: trimmedContacts,
            telegram_chat_id: null,
            stage: 'new',
            description: null,
            created_at: new Date().toISOString(),
          });
        }

        setStatusMessage({
          type: 'success',
          text: 'Успешно: Сделка сохранена в БД (crm_leads).',
        });
        resetCurrentTabFields('deal');
      }

      // 2. Вкладка "Задача" -> таблица tasks
      if (activeTab === 'task') {
        const trimmedTitle = taskDescription.trim();
        if (!trimmedTitle) {
          throw new Error('Введите описание задачи.');
        }

        const resolvedAssignee = taskAssigneeId.trim() || null;

        if (activeSupabase) {
          const { data, error } = await activeSupabase
            .from('tasks')
            .insert({
              company_id: activeCompanyId,
              title: trimmedTitle,
              priority: taskPriority,
              assigned_to: resolvedAssignee,
              created_by: currentUserId || null,
              status: 'new',
              type: 'client',
            })
            .select()
            .single();

          if (error) {
            throw new Error(error.message);
          }

          if (data && onTaskCreated) {
            onTaskCreated(data as TaskRecord);
          }
        } else if (onTaskCreated) {
          onTaskCreated({
            id: crypto.randomUUID(),
            company_id: activeCompanyId,
            type: 'client',
            title: trimmedTitle,
            status: 'new',
            priority: taskPriority,
            assigned_to: resolvedAssignee,
            created_by: currentUserId || null,
            due_date: null,
            created_at: new Date().toISOString(),
          });
        }

        setStatusMessage({
          type: 'success',
          text: 'Успешно: Задача сохранена в БД (tasks).',
        });
        resetCurrentTabFields('task');
      }

      // 3. Вкладка "Сотрудник" -> таблица organization_nodes
      if (activeTab === 'employee') {
        const trimmedName = employeeName.trim();
        if (!trimmedName) {
          throw new Error('Укажите имя сотрудника.');
        }

        const trimmedTgId = employeeTelegramId.trim() || null;

        if (activeSupabase) {
          const { data, error } = await activeSupabase
            .from('organization_nodes')
            .insert({
              company_id: activeCompanyId,
              name: trimmedName,
              telegram_chat_id: trimmedTgId,
              role_type: employeeRole,
              tree_path: 'tedcloud',
            })
            .select()
            .single();

          if (error) {
            throw new Error(error.message);
          }

          if (data && onEmployeeCreated) {
            onEmployeeCreated(data as OrganizationNode);
          }
        } else if (onEmployeeCreated) {
          onEmployeeCreated({
            id: crypto.randomUUID(),
            company_id: activeCompanyId,
            name: trimmedName,
            role_type: employeeRole,
            tree_path: 'tedcloud',
            telegram_chat_id: trimmedTgId,
            kpi_value: 0,
            created_at: new Date().toISOString(),
          });
        }

        setStatusMessage({
          type: 'success',
          text: 'Успешно: Пользователь добавлен в БД (organization_nodes).',
        });
        resetCurrentTabFields('employee');
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: `Ошибка записи в БД: ${(error as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-record-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-md p-6 space-y-5">
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="add-record-modal-title"
              className="text-base font-semibold tracking-tight text-slate-900"
            >
              Новая запись TedCloud
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Данные автоматически привязываются к вашей компании
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

        {/* Переключатель вкладок ("Сделка", "Задача", "Сотрудник") */}
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

        {/* Уведомление об успешной записи или ошибке RLS/Supabase */}
        {statusMessage && (
          <div
            role="status"
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

        {/* Динамическая форма (Conditional Rendering по activeTab) */}
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
                  Сумма (₽)
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
                  Контакты
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
                  Описание
                </label>
                <textarea
                  id="task-description"
                  rows={3}
                  required
                  disabled={isLoading}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Опишите, что необходимо сделать..."
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
                  Назначить на...
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
                  Имя
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
                  Telegram ID
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
                  Роль
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

          {/* Кнопки действий */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Закрыть
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-all duration-200 cursor-pointer"
            >
              {isLoading
                ? 'Отправка...'
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
