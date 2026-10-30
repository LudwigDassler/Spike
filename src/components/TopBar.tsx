import React from 'react';
import { RefreshCw, Search, Command, X, Menu, Sun, Moon } from 'lucide-react';
import { DashboardSection, OrganizationNode, TaskRecord, WorkShiftRecord } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { WorkdayShiftWidget } from './EnterpriseB2BFeatures';
import { TeddyAvatar } from './TedCloudAiDrawer';

interface TopBarProps {
  companyId?: string;
  companyName: string;
  activeSection: DashboardSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenCommandBar?: () => void;
  onOpenAiCopilot?: () => void;
  onOpenMobileMenu?: () => void;
  searchPlaceholder?: string;
  isSyncing: boolean;
  onRefresh: () => void;
  currentProfile?: OrganizationNode | null;
  tasks?: TaskRecord[];
  onPostShiftSummary?: (summaryText: string) => Promise<void>;
  onSyncShiftState?: (status: 'online' | 'break' | 'offline', startedAt: string | null) => Promise<void>;
  onCreateWorkShift?: (shift: Partial<WorkShiftRecord>) => Promise<void>;
  showToast?: (msg: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  companyId = 'default',
  companyName,
  activeSection,
  searchQuery,
  onSearchChange,
  onOpenCommandBar,
  onOpenAiCopilot,
  onOpenMobileMenu,
  searchPlaceholder,
  isSyncing,
  onRefresh,
  currentProfile = null,
  tasks = [],
  onPostShiftSummary,
  onSyncShiftState,
  onCreateWorkShift,
  showToast,
}) => {
  const { t, language, theme, toggleTheme } = useLocale();
  const isEn = language === 'en';

  const sectionLabel = t(`nav.${activeSection}`);
  const effectivePlaceholder = searchPlaceholder || t('actions.searchPlaceholder');

  return (
    <header className="h-14 border-b border-white/[0.07] bg-[#09090B]/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 font-sans">
      {/* Zone 1: Mobile Menu Trigger + Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0 text-xs">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label={isEn ? 'Open navigation menu' : 'Открыть меню навигации'}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-[#111114] text-zinc-300 hover:text-white shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="lg:hidden w-6 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold text-[11px] tracking-tight shrink-0">
          TC
        </div>

        <span className="font-medium text-zinc-500 whitespace-nowrap hidden md:inline">
          {t('topbar.workspace')}
        </span>
        <span className="text-zinc-700 hidden md:inline">/</span>
        <span className="font-medium text-zinc-400 truncate max-w-[110px] sm:max-w-[180px]">
          {companyName}
        </span>
        <span className="text-zinc-700 hidden sm:inline">/</span>
        <span className="font-semibold text-white tracking-tight whitespace-nowrap hidden sm:inline">
          {sectionLabel}
        </span>
      </div>

      {/* Zone 2 & 3: Global Search (Cmd+K) + Workday Shift Tracker + TedCloud Intelligence + Theme Switcher + Refresh */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mobile compact search button (< 640px) */}
        {onOpenCommandBar && (
          <button
            type="button"
            onClick={onOpenCommandBar}
            aria-label={isEn ? 'Search (Cmd+K)' : 'Поиск (Cmd+K)'}
            className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-[#111114] text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Desktop & Tablet search bar (>= 640px) */}
        <div className="relative hidden sm:flex items-center">
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
            className="w-40 md:w-56 lg:w-64 rounded-lg border border-white/[0.08] bg-[#111114] pl-8 pr-14 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-white/25 focus:outline-none transition-colors"
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
                title={
                  isEn
                    ? 'Global Omnisearch & Command Bar (Cmd+K)'
                    : 'Глобальный поиск и командный бар (Cmd+K / Ctrl+K)'
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/10 text-[10px] font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <Command className="w-2.5 h-2.5" />
                <span>K</span>
              </button>
            )
          )}
        </div>

        {/* Live Workday Shift Tracker */}
        <WorkdayShiftWidget
          companyId={companyId}
          currentProfile={currentProfile}
          tasks={tasks}
          onPostShiftSummary={onPostShiftSummary}
          onSyncShiftState={onSyncShiftState}
          onCreateWorkShift={onCreateWorkShift}
          showToast={showToast}
        />

        {onOpenAiCopilot && (
          <button
            type="button"
            onClick={onOpenAiCopilot}
            aria-label={isEn ? 'Teddy AI Advisor' : 'Советник Teddy'}
            className="inline-flex items-center justify-center gap-2 h-8 px-2.5 sm:px-3 rounded-lg border border-indigo-500/30 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-colors whitespace-nowrap shadow-xs shrink-0"
          >
            <TeddyAvatar size="xs" />
            <span className="hidden md:inline">
              {isEn ? 'Teddy AI' : 'Советник Teddy'}
            </span>
          </button>
        )}

        {/* Theme Switcher Button (Dark / Light Mode) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
          title={theme === 'light' ? t('theme.dark') : t('theme.light')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-[#111114] hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors shrink-0"
        >
          {theme === 'light' ? (
            <Moon className="w-3.5 h-3.5" />
          ) : (
            <Sun className="w-3.5 h-3.5" />
          )}
        </button>

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
