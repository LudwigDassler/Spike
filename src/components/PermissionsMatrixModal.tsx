import React, { useState, useEffect } from 'react';
import { X, Shield, Loader2, Check } from 'lucide-react';
import {
  AccessLevel,
  EmployeePermissions,
  OrganizationNode,
  PERMISSION_KEYS,
  getDefaultPermissionsForAccessLevel,
  normalizeEmployeePermissions,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

interface PermissionsMatrixModalProps {
  node: OrganizationNode | null;
  onClose: () => void;
  onSave: (
    nodeId: string,
    accessLevel: AccessLevel,
    permissions: EmployeePermissions
  ) => Promise<void>;
}

export const PermissionsMatrixModal: React.FC<PermissionsMatrixModalProps> = ({
  node,
  onClose,
  onSave,
}) => {
  const { t, formatRole } = useLocale();
  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>('member');
  const [permissions, setPermissions] = useState<EmployeePermissions>(() =>
    getDefaultPermissionsForAccessLevel('member')
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (node) {
      const normalized = normalizeEmployeePermissions(
        node.access_level,
        node.permissions,
        node.role_type
      );
      setSelectedLevel(normalized.access_level);
      setPermissions(normalized.permissions);
    }
  }, [node]);

  if (!node) return null;

  const isRootLocked =
    selectedLevel === 'root' || String(node.role_type || '').trim().toUpperCase() === 'SUPERADMIN';

  const handlePresetChange = (nextLevel: AccessLevel) => {
    setSelectedLevel(nextLevel);
    setPermissions(getDefaultPermissionsForAccessLevel(nextLevel));
  };

  const handleToggleKey = (key: keyof EmployeePermissions) => {
    if (isRootLocked) return;
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const finalPermissions = isRootLocked
        ? getDefaultPermissionsForAccessLevel('root')
        : permissions;
      await onSave(node.id, isRootLocked ? 'root' : selectedLevel, finalPermissions);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans overflow-y-auto no-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-matrix-title"
    >
      <div className="w-[calc(100vw-24px)] max-w-lg rounded-xl border border-[#262626] bg-[#121214] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <h3 id="perm-matrix-title" className="text-sm font-semibold text-white tracking-tight">
                {t('permModal.title')}
              </h3>
              <p className="text-xs text-[#8E8E93]">
                {node.name} · {formatRole(node.role_type)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('invite.close')}
            className="text-[#8E8E93] hover:text-white p-1 rounded-lg hover:bg-[#1F1F23] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-[#A1A1AA] leading-relaxed">{t('permModal.subtitle')}</p>

          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              {t('permModal.presetLabel')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['root', 'manager', 'member', 'observer'] as AccessLevel[]).map((lvl) => {
                const isSelected = selectedLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handlePresetChange(lvl)}
                    className={`text-xs font-medium px-3 py-2 text-center truncate rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-white bg-white text-black font-semibold'
                        : 'border-[#262626] bg-[#17171A] text-[#A1A1AA] hover:text-white hover:border-[#3F3F46]'
                    }`}
                  >
                    {t(`accessShort.${lvl}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {isRootLocked && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
              {t('permModal.rootNotice')}
            </div>
          )}

          <div className="rounded-lg border border-[#262626] bg-[#161619] divide-y divide-[#222226]">
            {PERMISSION_KEYS.map((permKey) => {
              const enabled = isRootLocked ? true : Boolean(permissions[permKey]);
              return (
                <div
                  key={permKey}
                  onClick={() => handleToggleKey(permKey)}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-xs transition-colors ${
                    isRootLocked ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:bg-[#1C1C20]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-white font-sans">{t(`perm.${permKey}`)}</div>
                    <div className="text-[11px] text-[#8E8E93] font-sans leading-snug mt-0.5">
                      {t(`permDesc.${permKey}`)}
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={isRootLocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleKey(permKey);
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                      enabled ? 'bg-emerald-500' : 'bg-[#2C2C30]'
                    }`}
                  >
                    <span
                      className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-white hover:bg-[#1F1F23] transition-colors whitespace-nowrap"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{t('permModal.saveBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
