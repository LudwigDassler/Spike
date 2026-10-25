import React from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { DashboardSection } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

interface TopBarProps {
  companyName: string;
  activeSection: DashboardSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSyncing: boolean;
  onRefresh: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  companyName,
  activeSection,
  searchQuery,
  onSearchChange,
  isSyncing,
  onRefresh,
}) => {
  const { t } = useLocale();

  const sectionLabel = t(`nav.${activeSection}`);

  return (
    <header className="h-14 border-b border-[#1F1F1F] bg-[#0D0D0D]/95 backdrop-blur-md px-6 flex items-center justify-between gap-6 sticky top-0 z-20 font-sans">
      {/* Zone 1: Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0 text-xs">
        <span className="font-medium text-[#71717A] whitespace-nowrap">
          {t('topbar.workspace')}
        </span>
        <span className="text-[#2E2E2E]">/</span>
        <span className="font-medium text-[#A1A1AA] truncate max-w-[200px]">
          {companyName}
        </span>
        <span className="text-[#2E2E2E]">/</span>
        <span className="font-semibold text-white tracking-tight whitespace-nowrap">
          {sectionLabel}
        </span>
      </div>

      {/* Zone 2 & 3: Global Search + Clean Refresh Icon */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('actions.searchPlaceholder')}
            aria-label={t('actions.searchPlaceholder')}
            className="w-56 sm:w-72 rounded-lg border border-[#262626] bg-[#141416] pl-8 pr-7 py-1.5 text-xs text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isSyncing}
          aria-label={t('topbar.sync')}
          title={t('topbar.sync')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#262626] bg-[#141416] hover:bg-[#1F1F23] text-[#A1A1AA] hover:text-white transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : ''}`} />
        </button>
      </div>
    </header>
  );
};
