import React, { useMemo, useState } from 'react';
import {
  ClientCycleItem,
  SmartCopilotTask,
  TaskClass,
  WhiteLabelPreset,
} from '../types/saas';
import { SmartTaskCard } from './SmartTaskCard';
import { useCurrentRole } from '../context/RoleContext';
import { useTelegramSync } from '../hooks/useTelegramSync';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';
import { CheckCircle2, Plus, ShieldCheck } from 'lucide-react';

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
    pvImpact: 8,
    empatheticScript:
      'После оплаты заказа клиентом в мобильном приложении статус заказа обновляется мгновенно, но пересчёт командного объёма задерживается на 15 минут. Просьба проверить очередь обработки платежей.',
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
    pvImpact: 5,
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
  onRunRefillWorker,
  onClientReordered,
  onAdvanceJitStep,
  onSnoozeTask,
  onAddComment,
  onSendTelegramTask,
  onOpenNewTaskModal,
}) => {
  const { currentRole, setCurrentRole } = useCurrentRole();
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const [localTickets, setLocalTickets] = useState<SmartCopilotTask[]>(
    DEFAULT_INTERNAL_TICKETS
  );

  const activeTaskClass: TaskClass =
    currentRole === 'INTERNAL_IT' ? 'internal_ticket' : 'client_action';

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

  // Шаг 2 & 3: Синхронизация Telegram Mini App (initDataUnsafe.user.id) и перехват Deep Link startapp={taskId}
  useTelegramSync({
    currentNodeId: 'partner-4',
    onDeepLinkTaskDetected: (deepLinkedTaskId) => {
      const targetTask = combinedTasks.find((t) => t.id === deepLinkedTaskId);
      if (!targetTask) return;
      if (targetTask.task_class === 'internal_ticket' && currentRole !== 'INTERNAL_IT') {
        setCurrentRole('INTERNAL_IT');
      }
      const sameClassList = combinedTasks.filter(
        (t) =>
          t.status === 'pending' &&
          (t.task_class || 'client_action') === (targetTask.task_class || 'client_action')
      );
      const targetIdx = sameClassList.findIndex((t) => t.id === deepLinkedTaskId);
      if (targetIdx >= 0) {
        setCurrentFocusIndex(targetIdx);
      }
    },
  });

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
                    authorName: 'Инженер поддержки',
                    authorRole: 'IT Support',
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
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
            <span>TedCloud</span>
            <span>·</span>
            <span>
              {currentRole === 'INTERNAL_IT'
                ? 'Внутренняя служба поддержки и разработки'
                : 'Умный помощник сопровождения клиентов'}
            </span>
            <span
              title="Безопасное соединение"
              aria-label="Безопасное соединение"
              className="inline-flex items-center text-emerald-700 cursor-help ml-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {currentRole === 'INTERNAL_IT'
              ? 'Очередь сервисных обращений подразделений'
              : 'Фокус дня: забота о клиентах и начисление VP'}
          </h1>
        </div>
      </div>

      {/* Main Split: Left = Polymorphic SmartTaskCard, Right = Role-Specific Business Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          aria-label="Текущая приоритетная карточка"
          className="lg:col-span-7 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              В очереди на сегодня:{' '}
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
                Все задачи на сегодня выполнены!
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Отличная работа! Все запланированные действия закрыты.
              </p>
            </div>
          )}
        </section>

        {/* Right 5 Cols: Role-Scoped Context */}
        <section
          aria-label="Сводка по направлению"
          className="lg:col-span-5 p-6 bg-white border border-slate-200 rounded-2xl space-y-5"
        >
          {currentRole !== 'INTERNAL_IT' ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Календарь продления заказов
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ближайшие обновления клиентских программ и награда в VP
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRunRefillWorker}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Обновить список
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
                        Завершение курса:{' '}
                        <span className="font-mono tabular-nums text-slate-700">
                          {cycle.cycleEndDate}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full font-mono tabular-nums font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 self-start sm:self-center">
                      +{cycle.pvValue} VP
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Очереди подразделений TedCloud
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Новые тикеты распределяются по профильным отделам
                  </p>
                </div>
                {onOpenNewTaskModal && (
                  <button
                    type="button"
                    onClick={onOpenNewTaskModal}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Новый тикет</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-200 border-t border-b border-slate-200 text-xs">
                {DEPARTMENT_QUEUE_OPTIONS.map((dept) => (
                  <div
                    key={dept.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
                        {dept.label}
                      </span>
                      <div className="text-slate-500">{dept.category}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium shrink-0">
                      Активна
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
