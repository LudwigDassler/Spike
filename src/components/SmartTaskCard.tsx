import React, { useEffect, useState } from 'react';
import { SmartCopilotTask, TaskPriority } from '../types/saas';
import { useCurrentRole } from '../context/RoleContext';
import {
  handleTelegramContact,
  handleWhatsAppContact,
} from '../utils/seamlessMessaging';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  MessageSquarePlus,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface SmartTaskCardProps {
  task: SmartCopilotTask;
  currentIndex: number;
  totalTasks: number;
  onSendTelegram: (task: SmartCopilotTask, finalScript: string) => void;
  onClientReordered: (task: SmartCopilotTask) => void;
  onAdvanceJitStep: (task: SmartCopilotTask) => void;
  onSnoozeTomorrow: (task: SmartCopilotTask) => void;
  onAddComment: (taskId: string, body: string, authorPartnerId: string) => void;
}

const PRIORITY_BADGE: Record<TaskPriority, { label: string; style: string }> = {
  critical: {
    label: 'Критичный приоритет',
    style: 'text-red-700 bg-red-50 border-red-200',
  },
  high: {
    label: 'Высокий приоритет',
    style: 'text-blue-800 bg-blue-50 border-blue-200',
  },
  medium: {
    label: 'Средний приоритет',
    style: 'text-slate-700 bg-slate-100 border-slate-200',
  },
  low: {
    label: 'Низкий приоритет',
    style: 'text-slate-600 bg-slate-50 border-slate-200',
  },
};

export const SmartTaskCard: React.FC<SmartTaskCardProps> = ({
  task,
  currentIndex,
  totalTasks,
  onSendTelegram,
  onClientReordered,
  onAdvanceJitStep,
  onSnoozeTomorrow,
  onAddComment,
}) => {
  const { currentRole } = useCurrentRole();
  const [editableScript, setEditableScript] = useState(task.empatheticScript);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isCommentBoxOpen, setIsCommentBoxOpen] = useState(false);
  const [activeDeepLinkPreview, setActiveDeepLinkPreview] = useState<{
    channel: 'Telegram' | 'WhatsApp';
    url: string;
  } | null>(null);

  useEffect(() => {
    setEditableScript(task.empatheticScript);
    setCopiedFeedback(false);
    setActiveDeepLinkPreview(null);
  }, [task.id, task.empatheticScript]);

  const isInternalItView =
    currentRole === 'INTERNAL_IT' || task.task_class === 'internal_ticket';
  const targetDepartment = task.targetDepartment || 'IT Support';
  const priorityMeta = PRIORITY_BADGE[task.priority || 'high'];
  const kpiValue = task.pvImpact > 0 ? task.pvImpact : 8;
  const commentsList = task.comments || [];

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(editableScript);
      setCopiedFeedback(true);
    } catch {
      setCopiedFeedback(true);
    }
  };

  const onTelegramClick = () => {
    const links = handleTelegramContact(
      task.telegramUsername || '',
      editableScript
    );
    setActiveDeepLinkPreview({
      channel: 'Telegram',
      url: links.tgResolveUrl,
    });
    onSendTelegram(task, editableScript);
  };

  const onWhatsAppClick = () => {
    const waUrl = handleWhatsAppContact(task.phoneRaw || '', editableScript);
    setActiveDeepLinkPreview({
      channel: 'WhatsApp',
      url: waUrl,
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(
      task.id,
      commentInput.trim(),
      isInternalItView ? 'it-engineer' : 'partner-4'
    );
    setCommentInput('');
  };

  // ==========================================================================
  // ВАРИАНТ 1: Роль INTERNAL_IT (Внутренний инженерный тикет с Soft Pill бейджем отдела)
  // ==========================================================================
  if (isInternalItView) {
    return (
      <article
        aria-label={`Инженерный тикет: ${task.productName}`}
        className="bg-white border border-slate-300 rounded-xl p-5 sm:p-6 flex flex-col gap-4 shadow-xs"
      >
        {/* Верхняя панель: Soft Pill бейдж отдела (без квадратных скобок) + Story Points + Иконка щита */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {targetDepartment}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityMeta.style}`}
            >
              {priorityMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              {kpiValue} Story Points
            </span>
            <span
              title="Безопасное соединение"
              aria-label="Безопасное соединение"
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-blue-700 border border-slate-200 cursor-help"
            >
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Описание задачи отдела */}
        <div>
          <div className="text-xs text-slate-500">
            Инициатор обращения: {task.ownerPartnerName} · Подразделение: {targetDepartment}
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {task.productName}
          </h2>
          <p className="mt-2.5 text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            {task.empatheticScript}
          </p>
        </div>

        {/* Кнопки действий */}
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCommentBoxOpen((prev) => !prev)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Оставить комментарий</span>
            </button>

            <button
              type="button"
              onClick={() => onClientReordered(task)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
              <span>Закрыть тикет</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Тикет {currentIndex + 1} из {totalTasks} · Срок: {task.dueDate}
          </span>
        </div>

        {/* Блок комментариев специалистов */}
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-blue-700" />
              <span>Комментарии специалистов ({commentsList.length})</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {commentsList.map((cmt) => (
              <div
                key={cmt.id}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed"
              >
                <strong className="text-slate-900">{cmt.authorName}</strong>{' '}
                <span className="text-slate-500">
                  ({cmt.authorRole} · {cmt.createdAt}):
                </span>{' '}
                {cmt.body}
              </div>
            ))}
          </div>

          {(isCommentBoxOpen || commentsList.length >= 0) && (
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
              <label htmlFor={`ticket-comment-input-${task.id}`} className="sr-only">
                Комментарий к тикету
              </label>
              <input
                id={`ticket-comment-input-${task.id}`}
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Добавьте технический комментарий или статус решения..."
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Отправить
              </button>
            </form>
          )}
        </div>
      </article>
    );
  }

  // ==========================================================================
  // ВАРИАНТ 2: Роль NETWORK_PARTNER (Zero-Chat CRM + кнопка "Написать в Telegram")
  // ==========================================================================
  return (
    <article
      aria-label={`Клиентская задача: ${task.clientFirstName}`}
      className="bg-white border border-emerald-200 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 shadow-xs"
    >
      {/* Верхняя панель с геймифицированным Soft Pill бейджем +{kpiValue} VP и иконкой щита */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-100">
        <span className="text-xs font-semibold text-emerald-900">
          Фокус дня · Клиент {currentIndex + 1} из {totalTasks}
        </span>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-600 text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>+{kpiValue} VP</span>
          </span>

          <span
            title="Безопасное соединение"
            aria-label="Безопасное соединение"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-help"
          >
            <ShieldCheck className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Чистые бизнес-данные клиента */}
      <div>
        <div className="text-xs text-slate-500">
          До обновления курса: {task.daysRemaining} дн. · Куратор: {task.ownerPartnerName}
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          {task.clientFirstName} — {task.productName}
        </h2>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span className="font-mono tabular-nums font-medium text-slate-800">
            {task.phoneRaw}
            {task.telegramUsername ? ` · @${task.telegramUsername.replace(/^@/, '')}` : ''}
          </span>
          <span className="text-emerald-800 font-medium">
            Постоянный клиент
          </span>
        </div>
      </div>

      {/* Готовый заботливый скрипт общения */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`script-textarea-${task.id}`}
            className="text-xs font-semibold text-slate-800"
          >
            Готовый скрипт сообщения для клиента:
          </label>
          <button
            type="button"
            onClick={handleCopyScript}
            className="text-xs font-medium text-emerald-800 hover:text-emerald-950 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedFeedback ? 'Скопировано!' : 'Скопировать текст'}</span>
          </button>
        </div>

        <textarea
          id={`script-textarea-${task.id}`}
          rows={4}
          value={editableScript}
          onChange={(e) => setEditableScript(e.target.value)}
          className="w-full p-3.5 text-sm leading-relaxed text-slate-900 bg-emerald-50/40 border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
        />
      </div>

      {/* Индикатор сформированной ссылки tg://resolve или https://wa.me */}
      {activeDeepLinkPreview && (
        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-emerald-900">
              Переход в {activeDeepLinkPreview.channel} готов (текст скопирован):
            </span>
            <p className="font-mono text-[11px] text-emerald-800 truncate mt-0.5">
              {activeDeepLinkPreview.url}
            </p>
          </div>
          <a
            href={activeDeepLinkPreview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 shrink-0 hover:bg-emerald-800"
          >
            <span>Открыть чат</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Кнопки Seamless Messaging (Zero-Chat CRM) */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onTelegramClick}
            className="min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Написать в Telegram</span>
          </button>

          <button
            type="button"
            onClick={onWhatsAppClick}
            className="min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <PhoneCall className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Написать в WhatsApp</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onAdvanceJitStep(task)}
            className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Завершить шаг (+{kpiValue} VP)</span>
          </button>

          <button
            type="button"
            onClick={() => onClientReordered(task)}
            className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Продлить (+{task.cycleDays}д)</span>
          </button>

          <button
            type="button"
            onClick={() => onSnoozeTomorrow(task)}
            className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>На завтра</span>
          </button>
        </div>
      </div>
    </article>
  );
};
