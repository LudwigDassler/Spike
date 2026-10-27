import React from 'react';
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
    <aside className="hidden lg:flex w-64 shrink-0 bg-[#070709] flex-col justify-between min-h-screen select-none">
      <div>
        {/* Brand Header */}
        <div className="h-14 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-white to-zinc-200 text-zinc-950 flex items-center justify-center font-bold text-xs tracking-tight shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.9)]">
              TC
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-tight">TedCloud</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-[#8E8E93] border border-white/[0.07]">
                Enterprise
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links — Linear / Attio style with thin vertical pill and badge > 0 */}
        <nav className="px-3 py-2 space-y-0.5">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6E6E77]">
            {t('nav.workspaceSection')}
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const hasPositiveBadge = typeof item.badge === 'number' && item.badge > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/[0.05] text-white'
                    : 'text-[#8E8E93] hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="w-1 h-4 rounded-full bg-indigo-400 absolute left-0.5 top-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(129,140,248,0.6)]"
                  />
                )}
                <div className="flex items-center gap-2.5 min-w-0 pl-1">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-[#71717A]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {hasPositiveBadge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums font-medium ${
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                        : 'text-[#71717A]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile + Sleek Control Bar */}
      <div className="p-3 space-y-2 border-t border-white/[0.05]">
        {currentProfile ? (
          <button
            type="button"
            onClick={() => onSelectSection('profile')}
            title={isEn ? 'Open Personal Profile' : 'Открыть Личный кабинет'}
            className={`w-full text-left rounded-xl p-2.5 transition-colors flex items-center gap-2.5 group ${
              activeSection === 'profile'
                ? 'bg-white/[0.06]'
                : 'hover:bg-white/[0.04]'
            }`}
          >
            <UserAvatar
              name={currentProfile.name}
              avatarUrl={currentProfile.avatar_url}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-200 transition-colors">
                  {currentProfile.name}
                </p>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              </div>
              <p className="text-[11px] text-[#8E8E93] truncate">
                {formatRole(currentProfile.role_type)}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-400">
                <Shield className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                <span className="truncate">{t(`accessShort.${accessLevel}`)}</span>
              </div>
            </div>
          </button>
        ) : (
          <div className="px-2.5 py-2 text-xs text-[#8E8E93]">{t('profile.guestMode')}</div>
        )}

        {/* Unified Single-Row Utility Bar: RU/EN + Theme Toggle + Sign Out */}
        <div className="flex items-center justify-between gap-1.5 pt-1 px-1">
          <div
            className="inline-flex items-center rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5"
            aria-label="Language switcher"
          >
            <button
              type="button"
              onClick={() => setLanguage('ru')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
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
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
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
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/30 text-[11px] font-medium text-[#8E8E93] hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="truncate max-w-[88px]">
                  {isEn ? 'Sign Out' : 'Выйти'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
