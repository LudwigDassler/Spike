import React from 'react';
import { AlertTriangle, ShieldAlert, X, Loader2 } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useLocale();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-[#262626] bg-[#121214] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                variant === 'danger'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {variant === 'danger' ? (
                <ShieldAlert className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-[#8E8E93] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1F1F1F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-[#A1A1AA] leading-relaxed">{description}</p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-white hover:bg-[#1F1F1F] border border-[#262626] transition-colors"
            >
              {cancelLabel || t('confirm.cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-white text-black hover:bg-[#E4E4E7]'
              }`}
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isLoading ? t('confirm.processing') : confirmLabel || t('confirm.confirm')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
