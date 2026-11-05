import React from 'react';
import { RefreshCw, Search, Command, X, Menu, Sun, Moon } from 'lucide-react';
import {
  DashboardSection,
  OrganizationNode,
  TaskRecord,
  WorkShiftRecord,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { WorkdayShiftWidget } from './EnterpriseB2BFeatures';
import { TeddyPrismIcon } from './TedCloudAiDrawer';

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
  onSyncShiftState?: (
    status: 'online' | 'break' | 'offline',
    startedAt: string | null
  ) => Promise<void>;
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
    <header className="h-14 border-b border-slate-200/90 dark:border-white/[0.07] bg-white/95 dark:bg-[#09090B]/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 font-sans">
      <div className="flex items-center gap-2 min-w-0 text-xs">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label={isEn ? 'Open navigation menu' : 'Открыть меню навигации'}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111114] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="lg:hidden w-7 h-7 rounded-lg bg-slate-900 text-white border border-slate-800 dark:bg-white/[0.08] dark:border-white/[0.14] flex items-center justify-center shrink-0">
          <TeddyPrismIcon className="w-4 h-4" />
        </div>

        <span className="font-medium text-slate-600 dark:text-zinc-400 whitespace-nowrap hidden md:inline">
          {t('topbar.workspace')}
        </span>
        <span className="text-slate-400 dark:text-zinc-600 hidden md:inline">/</span>
        <span className="font-semibold text-slate-700 dark:text-zinc-300 truncate max-w-[110px] sm:max-w-[180px]">
          {companyName}
        </span>
        <span className="text-slate-400 dark:text-zinc-600 hidden sm:inline">/</span>
        <span className="font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap hidden sm:inline">
          {sectionLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenCommandBar && (
          <button
            type="button"
            onClick={onOpenCommandBar}
            aria-label={isEn ? 'Search (Cmd+K)' : 'Поиск (Cmd+K)'}
            className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111114] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="relative hidden sm:flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            className="w-40 md:w-56 lg:w-64 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111114] pl-8 pr-14 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-500 focus:border-indigo-500 dark:focus:border-white/25 focus:outline-none transition-colors"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/90 hover:bg-slate-200/70 dark:bg-zinc-800/90 dark:text-zinc-100 dark:border-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                <Command className="w-2.5 h-2.5" />
                <span>K</span>
              </button>
            )
          )}
        </div>

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
            aria-label="TedCloud Intelligence"
            title={
              isEn
                ? 'TedCloud Intelligence · CloudCode Console (Alt+Space)'
                : 'ИИ-консоль TedCloud Intelligence (Alt+Space)'
            }
            className="inline-flex items-center justify-center gap-2 h-8 px-2.5 sm:px-3 rounded-lg border border-slate-200/90 dark:border-white/10 bg-slate-100 text-slate-900 hover:bg-slate-200/70 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-colors whitespace-nowrap shadow-2xs shrink-0 cursor-pointer"
          >
            <TeddyPrismIcon className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">{isEn ? 'CloudAI' : 'ИИ-контур'}</span>
          </button>
        )}

        {/* Theme Switcher Button (Dark / Light Mode) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
          title={theme === 'light' ? t('theme.dark') : t('theme.light')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111114] hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
        >
          {theme === 'light' ? (
            <Moon className="w-3.5 h-3.5" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isSyncing}
          aria-label={t('topbar.sync')}
          title={t('topbar.sync')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111114] hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              isSyncing ? 'animate-spin text-indigo-600 dark:text-white' : ''
            }`}
          />
        </button>
      </div>
    </header>
  );
};
