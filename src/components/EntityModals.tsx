import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Users,
  Send,
  CheckSquare,
  FileText,
} from 'lucide-react';
import { Company, OrganizationNode, TaskRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

export { SlideOverDrawer, SlideOverDrawer as TaskDetailModal, SlideOverDrawer as CrmDealModal } from './SlideOverDrawer';
export type { DrawerTarget } from './SlideOverDrawer';
export {
  PermissionsMatrixModal,
  PermissionsMatrixModal as EmployeeInspectorModal,
} from './PermissionsMatrixModal';
export {
  LegalDocumentGeneratorModal,
  LegalDocumentGeneratorModal as IframePrintEngine,
} from './EnterpriseB2BFeatures';

export interface OnboardingChecklistWidgetProps {
  company: Company | null;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  onOpenAddEmployee: () => void;
  onOpenTelegramLink: () => void;
  onOpenCreateTask: () => void;
  onOpenLegalRequisites: () => void;
}

export const OnboardingChecklistWidget: React.FC<OnboardingChecklistWidgetProps> = ({
  company,
  nodes,
  tasks,
  onOpenAddEmployee,
  onOpenTelegramLink,
  onOpenCreateTask,
  onOpenLegalRequisites,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasInvitedStaff = nodes.length > 1;
  const hasTelegramLinked = nodes.some((n) =>
    Boolean(String(n?.telegram_chat_id || (n as any)?.telegram_id || '').trim())
  );
  const hasCreatedTask = tasks.length > 0;
  const hasLegalRequisites = Boolean(
    company?.billing_details?.tax_id ||
      company?.billing_details?.legal_name ||
      (company?.billing_details as any)?.taxId ||
      (company?.billing_details as any)?.legalName ||
      (company as any)?.inn
  );

  const steps = [
    {
      id: 'invite',
      done: hasInvitedStaff,
      icon: Users,
      title: isEn
        ? 'Invite team members (TC-XXXX codes)'
        : 'Пригласить сотрудников (инвайт-коды TC-XXXX)',
      subtitle: isEn
        ? `${nodes.length} active profiles in directory`
        : `В штатном расписании: ${nodes.length} сотр.`,
      actionLabel: isEn ? 'Add Employee' : 'Добавить',
      onClick: onOpenAddEmployee,
    },
    {
      id: 'telegram',
      done: hasTelegramLinked,
      icon: Send,
      title: isEn
        ? 'Link corporate Telegram Bot'
        : 'Связать корпоративный Telegram-бот',
      subtitle: isEn
        ? 'Instant push notifications & task replies'
        : 'Мгновенные пуш-уведомления и ответы из чата',
      actionLabel: isEn ? 'Configure Bot' : 'Привязать',
      onClick: onOpenTelegramLink,
    },
    {
      id: 'task',
      done: hasCreatedTask,
      icon: CheckSquare,
      title: isEn
        ? 'Create first operational task'
        : 'Создать первую задачу с дедлайном',
      subtitle: isEn
        ? `${tasks.length} tasks in workspace`
        : `Активных поручений в контуре: ${tasks.length}`,
      actionLabel: isEn ? 'New Task' : 'Создать',
      onClick: onOpenCreateTask,
    },
    {
      id: 'requisites',
      done: hasLegalRequisites,
      icon: FileText,
      title: isEn
        ? 'Fill legal requisites for A4 contracts'
        : 'Заполнить реквизиты для генерации договоров А4',
      subtitle: isEn
        ? 'Required for automated B2B invoices & acts'
        : 'ИНН, ОГРН и юр. адрес для печатных форм А4',
      actionLabel: isEn ? 'Fill Details' : 'Реквизиты',
      onClick: onOpenLegalRequisites,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xs overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] text-xs font-semibold tabular-nums text-[var(--text-primary)]">
            {completedCount}/{steps.length}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {isEn
                ? 'Workspace Launch Checklist'
                : 'Чек-лист запуска корпоративного пространства'}
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {isEn
                ? `Readiness ${progressPercent}% · Complete all 4 steps for full B2B automation`
                : `Готовность контура ${progressPercent}% · Быстрая настройка ключевых узлов`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 w-28">
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <span>{isCollapsed ? (isEn ? 'Expand' : 'Развернуть') : isEn ? 'Hide' : 'Свернуть'}</span>
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                  step.done
                    ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-elevated)]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
                      <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                      <span className="line-clamp-1">{step.title}</span>
                    </span>
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                    {step.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={step.onClick}
                  className="w-full inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-indigo-500/40 text-[11px] font-semibold text-[var(--text-primary)] transition cursor-pointer"
                >
                  <span>{step.actionLabel}</span>
                  <ArrowRight className="w-3 h-3 text-[var(--text-secondary)]" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
