import React, { useMemo, useState } from 'react';
import {
  ClientCycleItem,
  SmartCopilotTask,
  TaskClass,
  WhiteLabelPreset,
} from '../types/saas';
import { SmartTaskCard } from './SmartTaskCard';
import { useCurrentRole } from '../context/RoleContext';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';
import { CheckCircle2, Plus } from 'lucide-react';

interface TmaCopilotViewProps {
  copilotTasks: SmartCopilotTask[];
  clientCycles: ClientCycleItem[];
  activePreset: WhiteLabelPreset;
  onRunRefillWorker: () => void;
  onClientReordered: (taskId: string) => void;
  onAdvanceJitStep: (taskId: string) => void;
  onSnoozeTask: (taskId: string) => void;
  onAddComment: (taskId: string, body: string, authorPartnerId: string) => void;
  onSendTelegramTask: (task: SmartCopilotTask, finalScript: string) => void;
  onOpenNewTaskModal?: () => void;
  lastWorkerLog: string | null;
}

const DEFAULT_INTERNAL_TICKETS: SmartCopilotTask[] = [
  {
    id: 'ticket-it-101',
    idempotencyKey: 'ticket-it-101',
    task_class: 'internal_ticket',
    targetDepartment: 'IT Support',
    priority: 'critical',
    ownerPartnerId: 'partner-4',
    ownerPartnerName: 'Артём Громов (Региональный партнёр)',
    clientId: 'sys-1',
    clientFirstName: 'IT Support',
    phoneRaw: '',
    productSku: 'TC-SUP-101',
    productName: 'Задержка отображения бонусных баллов при повторной оплате заказа в мобильном кабинете',
    cycleDays: 1,
    daysRemaining: 1,
    pvImpact: 0,
    empatheticScript:
      'После оплаты заказа клиентом в мобильном приложении статус заказа обновляется мгновенно, но пересчёт группового объёма задерживается на 15 минут. Просьба проверить очередь обработки платежей.',
    status: 'pending',
    dueDate: '2026-10-24',
    comments: [
      {
        id: 'cmt-it-1',
        taskId: 'ticket-it-101',
        authorPartnerId: 'it-1',
        authorName: 'Максим Орлов',
        authorRole: 'Инженер IT Support',
        body: 'Тикет принят из общей очереди отдела. Проводим диагностику шлюза уведомлений.',
        createdAt: 'Сегодня, 11:15',
      },
    ],
  },
  {
    id: 'ticket-it-102',
    idempotencyKey: 'ticket-it-102',
    task_class: 'internal_ticket',
    targetDepartment: 'Платформа и интеграции',
    priority: 'high',
    ownerPartnerId: 'partner-1',
    ownerPartnerName: 'Алина Соколова (Дирекция сети)',
    clientId: 'sys-2',
    clientFirstName: 'Платформа и интеграции',
    phoneRaw: '',
    productSku: 'TC-SUP-102',
    productName: 'Подключение единого входа (SSO) и витрины продуктов для нового филиала',
    cycleDays: 3,
    daysRemaining: 3,
    pvImpact: 0,
    empatheticScript:
      'Необходимо активировать корпоративный домен и синхронизировать справочник продуктов для филиала в Казани до понедельника.',
    status: 'pending',
    dueDate: '2026-10-26',
    comments: [],
  },
];

export const TmaCopilotView: React.FC<TmaCopilotViewProps> = ({
  copilotTasks,
  clientCycles,
  activePreset,
  onRunRefillWorker,
  onClientReordered,
  onAdvanceJitStep,
  onSnoozeTask,
  onAddComment,
  onSendTelegramTask,
  onOpenNewTaskModal,
}) => {
  const { currentRole, canViewCrmAndPv, canViewItTickets } = useCurrentRole();
  const [superadminCardFilter, setSuperadminCardFilter] =
    useState<TaskClass>('client_action');
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const [localTickets, setLocalTickets] = useState<SmartCopilotTask[]>(
    DEFAULT_INTERNAL_TICKETS
  );

  const activeTaskClass: TaskClass = useMemo(() => {
    if (currentRole === 'INTERNAL_IT') return 'internal_ticket';
    if (currentRole === 'NETWORK_PARTNER') return 'client_action';
    return superadminCardFilter;
  }, [currentRole, superadminCardFilter]);

  const combinedTasks = useMemo(() => {
    const clientItems = copilotTasks.map((t) => ({
      ...t,
      task_class: (t.task_class || 'client_action') as TaskClass,
    }));
    return [...clientItems, ...localTickets];
  }, [copilotTasks, localTickets]);

  const pendingTasks = combinedTasks.filter(
    (t) => t.status === 'pending' && (t.task_class || 'client_action') === activeTaskClass
  );

  const safeIndex =
    pendingTasks.length > 0
      ? Math.min(currentFocusIndex, pendingTasks.length - 1)
      : 0;
  const activeFocusTask = pendingTasks[safeIndex] || null;

  const handleTicketComment = (taskId: string, body: string, authorPartnerId: string) => {
    if (taskId.startsWith('ticket-it-')) {
      setLocalTickets((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                comments: [
                  ...(t.comments || []),
                  {
                    id: `cmt-${Date.now()}`,
                    taskId,
                    authorPartnerId,
                    authorName:
                      currentRole === 'INTERNAL_IT'
                        ? 'Инженер поддержки'
                        : 'Алина Соколова',
                    authorRole:
                      currentRole === 'INTERNAL_IT' ? 'IT Support' : 'Руководитель',
                    body,
                    createdAt: 'Только что',
                  },
                ],
              }
            : t
        )
      );
      return;
    }
    onAddComment(taskId, body, authorPartnerId);
  };

  const handleTicketClose = (taskId: string) => {
    if (taskId.startsWith('ticket-it-')) {
      setLocalTickets((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: 'completed_reordered' } : t
        )
      );
      return;
    }
    onClientReordered(taskId);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Contextual Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            TedCloud · {activePreset.brandName}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {activeTaskClass === 'internal_ticket'
              ? 'Очередь сервисных тикетов подразделений'
              : 'Фокус дня: сопровождение клиентов и повторные продажи'}
          </h1>
        </div>

        {/* Для SUPERADMIN доступен переключатель между клиентскими задачами и внутренними тикетами */}
        {currentRole === 'SUPERADMIN' && (
          <div
            role="group"
            aria-label="Тип отображаемых карточек"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                setSuperadminCardFilter('client_action');
                setCurrentFocusIndex(0);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                superadminCardFilter === 'client_action'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Клиентские задачи
            </button>
            <button
              type="button"
              onClick={() => {
                setSuperadminCardFilter('internal_ticket');
                setCurrentFocusIndex(0);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                superadminCardFilter === 'internal_ticket'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Внутренние тикеты отделов
            </button>
          </div>
        )}
      </div>

      {/* Main Split: Left = Polymorphic SmartTaskCard, Right = Clean Business Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Polymorphic SmartTaskCard */}
        <section
          aria-label="Текущая приоритетная карточка"
          className="lg:col-span-7 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Активных карточек в очереди:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {pendingTasks.length}
              </strong>
            </span>

            {pendingTasks.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentFocusIndex((prev) =>
                      prev > 0 ? prev - 1 : pendingTasks.length - 1
                    )
                  }
                  className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  ← Предыдущая
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentFocusIndex((prev) =>
                      prev + 1 < pendingTasks.length ? prev + 1 : 0
                    )
                  }
                  className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Следующая →
                </button>
              </div>
            )}
          </div>

          {activeFocusTask ? (
            <SmartTaskCard
              task={activeFocusTask}
              currentIndex={safeIndex}
              totalTasks={pendingTasks.length}
              onSendTelegram={onSendTelegramTask}
              onClientReordered={(t) => handleTicketClose(t.id)}
              onAdvanceJitStep={(t) => onAdvanceJitStep(t.id)}
              onSnoozeTomorrow={(t) => onSnoozeTask(t.id)}
              onAddComment={handleTicketComment}
            />
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
              <h2 className="text-base font-bold text-slate-900">
                Все задачи в текущем списке выполнены
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Новые задачи появятся автоматически по мере приближения дат обновления клиентских программ или поступления обращений.
              </p>
            </div>
          )}
        </section>

        {/* Right 5 Cols: Clean Business Context (Client Schedule for Sales vs Department Queues for IT) */}
        <section
          aria-label="Сводка по направлению"
          className="lg:col-span-5 p-6 bg-white border border-slate-200 rounded-2xl space-y-5"
        >
          {canViewCrmAndPv && activeTaskClass === 'client_action' ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    График сопровождения клиентов
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Активные программы питания и плановые даты продления заказа
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRunRefillWorker}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Обновить расписание
                </button>
              </div>

              <div className="divide-y divide-slate-200 border-t border-b border-slate-200 text-xs">
                {clientCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {cycle.clientFirstName} · {cycle.productName}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        Куратор: {cycle.ownerPartnerName} · Дата завершения курса:{' '}
                        <span className="font-mono tabular-nums text-slate-700">
                          {cycle.cycleEndDate}
                        </span>
                      </div>
                    </div>

                    <div className="sm:text-right font-mono tabular-nums font-semibold text-emerald-700 shrink-0">
                      +{cycle.pvValue} PV
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {(canViewItTickets || activeTaskClass === 'internal_ticket') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Целевые отделы поддержки TedCloud
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Обращения направляются в общую очередь выбранного департамента
                  </p>
                </div>
                {onOpenNewTaskModal && (
                  <button
                    type="button"
                    onClick={onOpenNewTaskModal}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Создать тикет</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-200 border-t border-b border-slate-200 text-xs">
                {DEPARTMENT_QUEUE_OPTIONS.map((dept) => (
                  <div
                    key={dept.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        [{dept.label}]
                      </div>
                      <div className="text-slate-500 mt-0.5">{dept.category}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium shrink-0">
                      Очередь активна
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
