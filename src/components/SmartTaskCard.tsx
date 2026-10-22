import React, { useEffect, useState } from 'react';
import { SmartCopilotTask, TaskClass, TaskPriority } from '../types/saas';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Copy,
  MessageCircle,
  MessageSquarePlus,
  RefreshCw,
  Tag,
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
    label: 'Приоритет: Критичный',
    style: 'text-red-700 bg-red-50 border-red-200',
  },
  high: {
    label: 'Приоритет: Высокий',
    style: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  medium: {
    label: 'Приоритет: Средний',
    style: 'text-slate-700 bg-slate-100 border-slate-200',
  },
  low: {
    label: 'Приоритет: Низкий',
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
  const [editableScript, setEditableScript] = useState(task.empatheticScript);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isCommentBoxOpen, setIsCommentBoxOpen] = useState(false);

  useEffect(() => {
    setEditableScript(task.empatheticScript);
    setCopiedFeedback(false);
  }, [task.id, task.empatheticScript]);

  const taskClass: TaskClass = task.task_class || 'client_action';
  const targetDepartment = task.targetDepartment || 'IT Support';
  const priorityMeta = PRIORITY_BADGE[task.priority || 'high'];
  const commentsList = task.comments || [];

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(editableScript);
      setCopiedFeedback(true);
    } catch {
      setCopiedFeedback(true);
    }
  };

  const handleOpenMessenger = () => {
    const cleanHandle = (task.telegramUsername || '').replace(/^@/, '').trim();
    const encoded = encodeURIComponent(editableScript);
    const url = cleanHandle
      ? `https://t.me/${cleanHandle}?text=${encoded}`
      : `https://t.me/share/url?text=${encoded}`;

    const tgWebApp = (
      window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } };
      }
    ).Telegram?.WebApp;

    if (tgWebApp && typeof tgWebApp.openTelegramLink === 'function') {
      tgWebApp.openTelegramLink(url);
    }
    onSendTelegram(task, editableScript);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(
      task.id,
      commentInput.trim(),
      taskClass === 'internal_ticket' ? 'it-engineer' : 'partner-4'
    );
    setCommentInput('');
  };

  // ==========================================================================
  // ВАРИАНТ 1: ВНУТРЕННИЙ ТИКЕТ (internal_ticket) — строгий дизайн в стиле Jira
  // ==========================================================================
  if (taskClass === 'internal_ticket') {
    return (
      <article
        aria-label={`Внутренний тикет отдела: ${task.productName}`}
        className="bg-white border border-slate-300 rounded-xl p-5 sm:p-6 flex flex-col gap-4 shadow-xs"
      >
        {/* Строгая верхняя панель тикета с бейджем целевого отдела и приоритетом */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-slate-900 text-white">
              <Tag className="w-3 h-3" />
              <span>[{targetDepartment}]</span>
            </span>
            <span className="text-xs font-mono text-slate-500">
              Тикет {currentIndex + 1} из {totalTasks}
            </span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${priorityMeta.style}`}
          >
            {priorityMeta.label}
          </span>
        </div>

        {/* Заголовок и описание тикета */}
        <div>
          <div className="text-xs text-slate-500">
            Инициатор: {task.ownerPartnerName} · Очередь департамента: {targetDepartment}
          </div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {task.productName}
          </h2>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            {task.empatheticScript}
          </p>
        </div>

        {/* Действия по внутреннему тикету */}
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCommentBoxOpen((prev) => !prev)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Оставить комментарий</span>
            </button>

            <button
              type="button"
              onClick={() => onClientReordered(task)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
              <span>Закрыть тикет</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Срок: {task.dueDate}
          </span>
        </div>

        {/* Лента обсуждения по тикету */}
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
              <span>Рабочее обсуждение по тикету ({commentsList.length})</span>
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
                Текст комментария к тикету
              </label>
              <input
                id={`ticket-comment-input-${task.id}`}
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Напишите решение или уточнение для отдела..."
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
  // ВАРИАНТ 2: КЛИЕНТСКАЯ ЗАДАЧА (client_action) — зелёные акценты, скрипт, мессенджер
  // ==========================================================================
  return (
    <article
      aria-label={`Клиентская задача: ${task.clientFirstName}`}
      className="bg-white border border-emerald-200/90 rounded-2xl p-5 sm:p-6 flex flex-col gap-5 shadow-xs"
    >
      {/* Шапка клиентской задачи с изумрудным акцентом */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-100 text-xs">
        <span className="font-semibold text-emerald-800">
          Клиентское касание · Задача {currentIndex + 1} из {totalTasks}
        </span>
        <span className="font-mono tabular-nums text-emerald-900 font-semibold">
          До обновления программы: {task.daysRemaining} дн. · +{task.pvImpact} PV
        </span>
      </div>

      {/* Информация о клиенте и программе */}
      <div>
        <div className="text-xs text-slate-500">
          Куратор: {task.ownerPartnerName} · Программа сопровождения
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          {task.clientFirstName} — {task.productName}
        </h2>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span className="font-mono tabular-nums font-medium text-slate-800">
            Телефон: {task.phoneRaw}
            {task.telegramUsername ? ` · @${task.telegramUsername.replace(/^@/, '')}` : ''}
          </span>
          <span className="text-emerald-800 font-medium">
            Карточка постоянного клиента
          </span>
        </div>
      </div>

      {/* Скрипт звонка / сообщения клиенту */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`script-textarea-${task.id}`}
            className="text-xs font-semibold text-slate-800"
          >
            Рекомендованный скрипт общения с клиентом:
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

      {/* Кнопки действий по клиенту */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleOpenMessenger}
          className="w-full min-h-[48px] px-4 py-3 rounded-xl text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span>Перейти в мессенджер (Telegram)</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onAdvanceJitStep(task)}
            className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Следующий шаг</span>
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

      {/* Заметки куратора по сделке */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="text-xs font-semibold text-slate-800">
          Комментарии по клиенту ({commentsList.length})
        </div>

        <div className="space-y-1.5">
          {commentsList.map((cmt) => (
            <div key={cmt.id} className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900">{cmt.authorName}</strong>{' '}
              <span className="text-slate-500">({cmt.createdAt}):</span> {cmt.body}
            </div>
          ))}
        </div>

        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Добавить заметку по результату звонка или переписки..."
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Сохранить</span>
          </button>
        </form>
      </div>
    </article>
  );
};
