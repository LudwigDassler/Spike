import React from 'react';
import { RefreshCw, Search, Cpu, Command, X } from 'lucide-react';
import { DashboardSection } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

interface TopBarProps {
  companyName: string;
  activeSection: DashboardSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenCommandBar?: () => void;
  onOpenAiCopilot?: () => void;
  searchPlaceholder?: string;
  isSyncing: boolean;
  onRefresh: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  companyName,
  activeSection,
  searchQuery,
  onSearchChange,
  onOpenCommandBar,
  onOpenAiCopilot,
  searchPlaceholder,
  isSyncing,
  onRefresh,
}) => {
  const { t } = useLocale();

  const sectionLabel = t(`nav.${activeSection}`);
  const effectivePlaceholder = searchPlaceholder || t('actions.searchPlaceholder');

  return (
    <header className="h-14 border-b border-white/[0.07] bg-[#09090B]/90 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-20 font-sans">
      {/* Zone 1: Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0 text-xs">
        <span className="font-medium text-zinc-500 whitespace-nowrap hidden sm:inline">
          {t('topbar.workspace')}
        </span>
        <span className="text-zinc-700 hidden sm:inline">/</span>
        <span className="font-medium text-zinc-400 truncate max-w-[180px]">
          {companyName}
        </span>
        <span className="text-zinc-700">/</span>
        <span className="font-semibold text-white tracking-tight whitespace-nowrap">
          {sectionLabel}
        </span>
      </div>

      {/* Zone 2 & 3: Global Search (Cmd+K) + TedCloud Intelligence + Clean Refresh Icon */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClick={() => {
              if (onOpenCommandBar && !searchQuery) {
                onOpenCommandBar();
              }
            }}
            placeholder={effectivePlaceholder}
            aria-label={effectivePlaceholder}
            className="w-48 sm:w-64 lg:w-72 rounded-lg border border-white/[0.08] bg-[#111114] pl-8 pr-14 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none transition-colors"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            onOpenCommandBar && (
              <button
                type="button"
                onClick={onOpenCommandBar}
                title="Глобальный поиск и командный бар (Cmd+K / Ctrl+K)"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/10 text-[10px] font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <Command className="w-2.5 h-2.5" />
                <span>K</span>
              </button>
            )
          )}
        </div>

        {onOpenAiCopilot && (
          <button
            type="button"
            onClick={onOpenAiCopilot}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-colors whitespace-nowrap shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>TedCloud Intelligence</span>
          </button>
        )}

        <button
          type="button"
          onClick={onRefresh}
          disabled={isSyncing}
          aria-label={t('topbar.sync')}
          title={t('topbar.sync')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-[#111114] hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : ''}`} />
        </button>
      </div>
    </header>
  );
};
