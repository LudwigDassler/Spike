import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  CheckSquare,
  Briefcase,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Shield,
  Sun,
  Moon,
  Clock,
  UserCircle2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  Company,
  DashboardSection,
  OrganizationNode,
  normalizeEmployeePermissions,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';
import { TeddyPrismIcon } from './TedCloudAiDrawer';

export type { DashboardSection };

export interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  counts: {
    nodes: number;
    tasks: number;
    leads: number;
    messages?: number;
  };
  currentProfile?: OrganizationNode | null;
  company?: Company | null;
  allCompanies?: Company[];
  onSwitchCompany?: (company: Company) => void;
  onOpenRegisterCompany?: () => void;
  onRequestSignOut?: () => void;
  onOpenAiCopilot?: () => void;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'tedcloud_sidebar_collapsed_v1';

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  counts,
  currentProfile,
  onRequestSignOut,
}) => {
  const { language, setLanguage, theme, toggleTheme, t, formatRole } = useLocale();
  const isEn = language === 'en';
  const isLight = theme === 'light';

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, isSidebarCollapsed ? '1' : '0');
    } catch {}
  }, [isSidebarCollapsed]);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  const normalized = normalizeEmployeePermissions(
    currentProfile?.access_level,
    currentProfile?.permissions,
    currentProfile?.role_type
  );
  const perms = normalized.permissions;
  const accessLevel = normalized.access_level;

  const navItems: {
    id: DashboardSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    visible: boolean;
  }[] = [
    {
      id: 'overview',
      label: t('nav.overview'),
      icon: LayoutGrid,
      visible: true,
    },
    {
      id: 'tasks',
      label: t('nav.tasks'),
      icon: CheckSquare,
      badge: counts.tasks,
      visible: true,
    },
    {
      id: 'crm',
      label: t('nav.crm'),
      icon: Briefcase,
      badge: counts.leads,
      visible: perms.crm_view,
    },
    {
      id: 'communications',
      label: t('nav.communications'),
      icon: MessageSquare,
      badge: counts.messages,
      visible: true,
    },
    {
      id: 'shifts',
      label: t('nav.shifts'),
      icon: Clock,
      visible: true,
    },
    {
      id: 'team',
      label: t('nav.team'),
      icon: Users,
      badge: counts.nodes,
      visible: perms.team_manage,
    },
    {
      id: 'profile',
      label: t('nav.profile'),
      icon: UserCircle2,
      visible: true,
    },
    {
      id: 'workspace',
      label: t('nav.workspace'),
      icon: Settings,
      visible: perms.billing_admin,
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.visible);

  return (
    <aside
      className={`hidden lg:flex ${
        isSidebarCollapsed ? 'w-[60px]' : 'w-56'
      } shrink-0 bg-white dark:bg-[#0b0d13] border-r border-slate-200/90 dark:border-white/[0.06] flex-col justify-between min-h-screen select-none overflow-hidden transition-all duration-200`}
    >
      <div>
        <div
          className={`h-14 ${
            isSidebarCollapsed ? 'px-2 justify-center' : 'px-3.5 justify-between'
          } flex items-center border-b border-slate-200/80 dark:border-white/[0.05]`}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white border border-slate-800 dark:bg-white/[0.08] dark:text-white dark:border-white/[0.14] flex items-center justify-center shadow-2xs shrink-0">
                <TeddyPrismIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  TedCloud
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 tracking-tight">
                  os
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            title={
              isSidebarCollapsed
                ? isEn
                  ? 'Expand Sidebar'
                  : 'Развернуть боковую панель'
                : isEn
                ? 'Collapse Sidebar'
                : 'Свернуть боковую панель'
            }
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-slate-600 hover:text-slate-900 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] dark:border-white/[0.06] dark:text-[#8E8E93] dark:hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <nav className={`${isSidebarCollapsed ? 'px-2' : 'px-2.5'} pt-2.5 pb-2 space-y-1`}>
          {!isSidebarCollapsed && (
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
              {t('nav.workspaceSection')}
            </div>
          )}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const hasPositiveBadge = typeof item.badge === 'number' && item.badge > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                title={
                  isSidebarCollapsed
                    ? `${item.label}${hasPositiveBadge ? ` (${item.badge})` : ''}`
                    : item.label
                }
                className={`tc-nav-item relative w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-2.5 py-2'
                } text-xs transition-all duration-150 cursor-pointer ${
                  isActive
                    ? isLight
                      ? 'tc-nav-active-light bg-indigo-600/[0.09] text-indigo-700 font-semibold border border-indigo-500/20 shadow-2xs rounded-xl'
                      : 'bg-indigo-500/15 text-white font-semibold border border-indigo-500/25 rounded-xl'
                    : 'rounded-xl text-slate-600 dark:text-[#A1A1AA] font-medium hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100/80 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? isLight
                          ? 'tc-nav-active-icon text-indigo-600'
                          : 'tc-nav-active-icon text-indigo-400'
                        : 'text-slate-500 dark:text-[#71717A]'
                    }`}
                  />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isSidebarCollapsed && hasPositiveBadge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums font-semibold shrink-0 ${
                      isActive
                        ? isLight
                          ? 'bg-indigo-600/15 text-indigo-700'
                          : 'bg-indigo-500/25 text-indigo-200'
                        : 'text-slate-600 dark:text-[#8E8E93]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isSidebarCollapsed && hasPositiveBadge && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-2.5 pb-3 shrink-0 space-y-2 border-t border-slate-200/80 dark:border-white/[0.05]">
        {currentProfile ? (
          <button
            type="button"
            onClick={() => onSelectSection('profile')}
            title={`${currentProfile.name} (${formatRole(currentProfile.role_type)})`}
            className={`w-full text-left rounded-xl ${
              isSidebarCollapsed ? 'p-1.5 justify-center' : 'p-2'
            } transition-colors flex items-center gap-2.5 group cursor-pointer ${
              activeSection === 'profile'
                ? 'bg-slate-100 dark:bg-white/[0.06]'
                : 'hover:bg-slate-100/80 dark:hover:bg-white/[0.04]'
            }`}
          >
            <UserAvatar
              name={currentProfile.name}
              avatarUrl={currentProfile.avatar_url}
              size="sm"
            />
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">
                    {currentProfile.name}
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                </div>
                <p className="text-[10px] font-medium text-slate-600 dark:text-[#8E8E93] truncate">
                  {formatRole(currentProfile.role_type)}
                </p>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                  <Shield className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">{t(`accessShort.${accessLevel}`)}</span>
                </div>
              </div>
            )}
          </button>
        ) : (
          !isSidebarCollapsed && (
            <div className="px-2 py-1.5 text-xs text-slate-600 dark:text-[#8E8E93]">
              {t('profile.guestMode')}
            </div>
          )
        )}

        {/* Utility Bar */}
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={toggleTheme}
              title={
                theme === 'dark'
                  ? isEn
                    ? 'Switch to Light Mode'
                    : 'Включить светлую тему'
                  : isEn
                  ? 'Switch to Dark Mode'
                  : 'Включить темную тему'
              }
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-slate-700 hover:text-slate-900 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] dark:border-white/[0.06] dark:text-[#A1A1AA] dark:hover:text-white transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>
            {onRequestSignOut && (
              <button
                type="button"
                onClick={onRequestSignOut}
                title={isEn ? 'Sign Out' : 'Выйти'}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 border border-slate-200/90 hover:border-rose-200 text-slate-700 hover:text-rose-600 dark:bg-white/[0.03] dark:hover:bg-red-500/10 dark:border-white/[0.06] dark:hover:border-red-500/30 dark:text-[#8E8E93] dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 pt-1 px-0.5">
            <div
              className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-white/[0.03] border border-slate-200/90 dark:border-white/[0.06] p-0.5"
              aria-label="Language switcher"
            >
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                  language === 'ru'
                    ? 'bg-slate-900 !text-white dark:bg-white dark:!text-slate-950 shadow-2xs'
                    : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                RU
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-slate-900 !text-white dark:bg-white dark:!text-slate-950 shadow-2xs'
                    : 'text-slate-600 dark:text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                title={
                  theme === 'dark'
                    ? isEn
                      ? 'Switch to Light Mode'
                      : 'Включить светлую тему'
                    : isEn
                    ? 'Switch to Dark Mode'
                    : 'Включить темную тему'
                }
                aria-label="Toggle theme"
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-slate-700 hover:text-slate-900 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] dark:border-white/[0.06] dark:text-[#A1A1AA] dark:hover:text-white transition-colors cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                )}
              </button>

              {onRequestSignOut && (
                <button
                  type="button"
                  onClick={onRequestSignOut}
                  title={t('profile.switchAccount')}
                  aria-label={t('profile.switchAccount')}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-slate-100 hover:bg-rose-50 border border-slate-200/90 hover:border-rose-200 text-[11px] font-semibold text-slate-700 hover:text-rose-600 dark:bg-white/[0.03] dark:hover:bg-red-500/10 dark:border-white/[0.06] dark:hover:border-red-500/30 dark:text-[#8E8E93] dark:hover:text-red-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[68px]">
                    {isEn ? 'Sign Out' : 'Выйти'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
