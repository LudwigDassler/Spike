import React, { useState } from 'react';
import {
  Loader2,
  Paperclip,
  Send,
  Smile,
  Zap,
} from 'lucide-react';
import {
  ActiveMessengerThread,
  canUserSeeWorkspaceMessage,
  extractMessageText,
  filterMessagesForActiveThread,
  isDirectMessageBetweenUsers,
} from '../utils/messengerLogic';

export {
  canUserSeeWorkspaceMessage,
  extractMessageText,
  filterMessagesForActiveThread,
  isDirectMessageBetweenUsers,
};
export type { ActiveMessengerThread };

export interface ChatComposerBarProps {
  theme: 'dark' | 'light';
  isEn: boolean;
  commUrgent: boolean;
  setCommUrgent: React.Dispatch<React.SetStateAction<boolean>>;
  commAttachmentsCount: number;
  isProcessingCommAttachment: boolean;
  isSendingComm: boolean;
  onOpenFilePicker: () => void;
  onSubmitMessage: (text: string) => void;
}

export const ChatComposerBar: React.FC<ChatComposerBarProps> = React.memo(
  ({
    theme,
    isEn,
    commUrgent,
    setCommUrgent,
    commAttachmentsCount,
    isProcessingCommAttachment,
    isSendingComm,
    onOpenFilePicker,
    onSubmitMessage,
  }) => {
    const [text, setText] = useState<string>('');
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (isSendingComm || (!trimmed && commAttachmentsCount === 0)) return;
      setText('');
      setShowEmojiPicker(false);
      onSubmitMessage(trimmed);
    };

    return (
      <div
        className={`relative shrink-0 sticky bottom-0 p-3 border-t transition-colors ${
          theme === 'light'
            ? 'border-[#E2DFD7] bg-[#FAF9F5]'
            : 'border-white/[0.07] bg-[#111115]'
        }`}
      >
        {showEmojiPicker && (
          <div
            className={`absolute bottom-16 left-4 z-30 p-2.5 rounded-2xl shadow-xl flex flex-col gap-2 max-w-xs border ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-zinc-900 border-white/10 text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {(['👍', '🔥', '❤️', '✅', '👏', '👀'] as const).map((emojiChar) => (
                <button
                  key={emojiChar}
                  type="button"
                  onClick={() => {
                    setText((prev) => (prev ? `${prev} ${emojiChar}` : emojiChar));
                    setShowEmojiPicker(false);
                  }}
                  className={`w-8 h-8 rounded-full inline-flex items-center justify-center text-base hover:scale-110 transition-transform cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  {emojiChar}
                </button>
              ))}
            </div>
            <div
              className={`flex flex-wrap gap-1.5 pt-1 border-t ${
                theme === 'light' ? 'border-slate-200/60' : 'border-white/10'
              }`}
            >
              {[
                isEn ? 'Accepted in work' : 'Принято в работу',
                isEn ? 'Approved' : 'Согласовано',
                isEn ? 'Completed' : 'Выполнено',
                isEn ? 'On Review' : 'На проверке',
              ].map((quickPhrase) => (
                <button
                  key={quickPhrase}
                  type="button"
                  onClick={() => {
                    setText((prev) => (prev ? `${prev} ${quickPhrase}` : quickPhrase));
                    setShowEmojiPicker(false);
                  }}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-700'
                      : 'bg-white/[0.06] hover:bg-indigo-500/20 border-white/10 text-zinc-200'
                  }`}
                >
                  {quickPhrase}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleFormSubmit}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-1.5 shadow-lg transition-colors ${
            theme === 'light'
              ? 'bg-white border-[#D6D3CD] text-[#18181B]'
              : 'bg-zinc-900/90 border-white/10 text-white'
          }`}
        >
          <button
            type="button"
            disabled={isProcessingCommAttachment || isSendingComm}
            onClick={onOpenFilePicker}
            title={isEn ? 'Attach file or photo' : 'Прикрепить файл или фото'}
            aria-label={isEn ? 'Attach file or photo' : 'Прикрепить файл или фото'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
              theme === 'light'
                ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            {isProcessingCommAttachment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            title={isEn ? 'Insert emoji' : 'Добавить эмодзи'}
            aria-label={isEn ? 'Insert emoji' : 'Добавить эмодзи'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
              showEmojiPicker
                ? 'bg-indigo-500/20 text-indigo-400'
                : theme === 'light'
                ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isEn ? 'Write a message...' : 'Написать сообщение...'}
            className={`tc-composer-input !bg-transparent border-0 focus:ring-0 outline-none flex-1 min-w-0 w-full h-8 px-2 text-sm ${
              theme === 'light'
                ? 'text-[#18181B] placeholder:text-zinc-400'
                : 'text-white placeholder:text-zinc-500'
            }`}
          />

          <button
            type="button"
            onClick={() => setCommUrgent((prev) => !prev)}
            aria-label={isEn ? 'Urgent Telegram Push' : 'Срочный Push в Telegram'}
            title={
              commUrgent
                ? isEn
                  ? 'Urgent push enabled'
                  : 'Срочный Push-статус включен'
                : isEn
                ? 'Mark message as Urgent'
                : 'Отметить сообщение как «Срочно»'
            }
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
              commUrgent
                ? 'bg-amber-500/20 text-amber-400'
                : theme === 'light'
                ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={isSendingComm}
            aria-label={isEn ? 'Send message' : 'Отправить сообщение'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 !text-white hover:bg-indigo-500 transition-colors shrink-0 shadow-sm cursor-pointer"
          >
            {isSendingComm ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    );
  }
);
