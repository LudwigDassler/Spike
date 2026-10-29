import React, { useState } from 'react';
import {
  LayoutGrid,
  CheckSquare,
  Briefcase,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Shield,
  UserCircle2,
  Sun,
  Moon,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  DashboardSection,
  OrganizationNode,
  normalizeEmployeePermissions,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

export type NavSection = DashboardSection;

interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  currentProfile: OrganizationNode | null;
  counts: {
    tasks: number;
    nodes: number;
    leads: number;
    messages: number;
  };
  onRequestSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  currentProfile,
  counts,
  onRequestSignOut,
}) => {
  const { language, setLanguage, theme, toggleTheme, t, formatRole } = useLocale();
  const isEn = language === 'en';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tedcloud_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tedcloud_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
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
        isSidebarCollapsed ? 'w-[60px]' : 'w-52'
      } shrink-0 bg-[#070709] border-r border-white/[0.05] flex-col justify-between min-h-screen select-none overflow-hidden transition-all duration-200`}
    >
      <div>
        {/* Brand Header with Collapse Toggle */}
        <div
          className={`h-14 ${
            isSidebarCollapsed ? 'px-2 justify-center' : 'px-3.5 justify-between'
          } flex items-center border-b border-white/[0.04]`}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-white to-zinc-200 text-zinc-950 flex items-center justify-center font-bold text-xs tracking-tight shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.9)] shrink-0">
                TC
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-white tracking-tight truncate">
                  TedCloud
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-[#8E8E93] border border-white/[0.07] shrink-0">
                  B2B
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
            className="w-7 h-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={`${isSidebarCollapsed ? 'px-2' : 'px-2.5'} pt-2.5 pb-2 space-y-1`}>
          {!isSidebarCollapsed && (
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6E6E77] truncate">
              {t('nav.workspaceSection')}
            </div>
          )}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const hasPositiveBadge = typeof item.badge === 'number' && item.badge > 0;
            const isLight = theme === 'light';

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
                      ? 'tc-nav-active-light bg-slate-900 text-white font-medium rounded-xl shadow-sm'
                      : 'bg-white/[0.08] text-white font-medium rounded-xl'
                    : 'rounded-xl text-[#8E8E93] font-medium hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'tc-nav-active-icon text-white' : 'text-[#71717A]'
                    }`}
                  />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isSidebarCollapsed && hasPositiveBadge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums font-medium shrink-0 ${
                      isActive
                        ? isLight
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.12] text-white'
                        : 'text-[#71717A]'
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

      {/* Bottom Profile + Sleek Control Bar */}
      <div className="p-2.5 pb-3 shrink-0 space-y-2 border-t border-white/[0.05]">
        {currentProfile ? (
          <button
            type="button"
            onClick={() => onSelectSection('profile')}
            title={`${currentProfile.name} (${formatRole(currentProfile.role_type)})`}
            className={`w-full text-left rounded-xl ${
              isSidebarCollapsed ? 'p-1.5 justify-center' : 'p-2'
            } transition-colors flex items-center gap-2.5 group cursor-pointer ${
              activeSection === 'profile' ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
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
                  <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-200 transition-colors">
                    {currentProfile.name}
                  </p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <p className="text-[10px] text-[#8E8E93] truncate">
                  {formatRole(currentProfile.role_type)}
                </p>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-400">
                  <Shield className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{t(`accessShort.${accessLevel}`)}</span>
                </div>
              </div>
            )}
          </button>
        ) : (
          !isSidebarCollapsed && (
            <div className="px-2 py-1.5 text-xs text-[#8E8E93]">{t('profile.guestMode')}</div>
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
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[#A1A1AA] hover:text-white transition-colors"
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
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/30 text-[#8E8E93] hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 pt-1 px-0.5">
            <div
              className="inline-flex items-center rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5"
              aria-label="Language switcher"
            >
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  language === 'ru'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                RU
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-[#8E8E93] hover:text-white'
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
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[#A1A1AA] hover:text-white transition-colors"
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
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/30 text-[11px] font-medium text-[#8E8E93] hover:text-red-400 transition-colors"
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

