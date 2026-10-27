import React from 'react';
import {
  LayoutGrid,
  CheckSquare,
  Users,
  Briefcase,
  Building2,
  UserCircle,
  LogOut,
  MessageSquare,
  Sun,
  Moon,
} from 'lucide-react';
import {
  DashboardSection,
  LanguageCode,
  OrganizationNode,
  normalizeEmployeePermissions,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';
import { UserAvatar } from './UserAvatar';

export interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  currentProfile: OrganizationNode | null;
  counts: {
    tasks: number;
    nodes: number;
    leads: number;
    messages?: number;
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

  const { access_level, permissions: perms } = normalizeEmployeePermissions(
    currentProfile?.access_level,
    currentProfile?.permissions,
    currentProfile?.role_type
  );

  const allNavItems: {
    id: DashboardSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    visible: boolean;
  }[] = [
    { id: 'overview', label: t('nav.overview'), icon: LayoutGrid, visible: true },
    { id: 'tasks', label: t('nav.tasks'), icon: CheckSquare, badge: counts.tasks, visible: true },
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
    { id: 'profile', label: t('nav.profile'), icon: UserCircle, visible: true },
    {
      id: 'workspace',
      label: t('nav.workspace'),
      icon: Building2,
      visible: perms.billing_admin,
    },
  ];

  const visibleNavItems = allNavItems.filter((item) => item.visible);

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 border-r border-white/[0.07] bg-[#0B0B0E] h-screen sticky top-0 justify-between overflow-hidden pb-4 select-none font-sans">
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
        <div className="h-14 px-5 shrink-0 flex items-center justify-between border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs tracking-tight shadow-xs">
              TC
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">TedCloud</span>
          </div>
          <span className="text-[11px] font-medium text-zinc-500 whitespace-nowrap">
            {t('brand.edition')}
          </span>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto no-scrollbar flex-1" aria-label="Main Navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-900 text-white border border-white/10 shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {typeof item.badge === 'number' && (
                  <span
                    className={`text-[11px] font-medium tabular-nums whitespace-nowrap px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-white/10 text-white' : 'text-zinc-500'
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

      {currentProfile && (
        <div className="px-3 pt-3 border-t border-white/[0.07] shrink-0">
          <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-3 space-y-2.5">
            <button
              type="button"
              onClick={() => onSelectSection('profile')}
              className="w-full text-left flex items-center gap-2.5 group"
            >
              <UserAvatar
                name={currentProfile.name}
                avatarUrl={currentProfile.avatar_url}
                size="md"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-white group-hover:underline truncate">
                    {currentProfile.name}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-400 whitespace-nowrap shrink-0">
                    {t(`accessShort.${access_level}`)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {formatRole(currentProfile.role_type)}
                  {currentProfile.department ? ` · ${formatRole(currentProfile.department)}` : ''}
                </div>
              </div>
            </button>

            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-white/[0.06]">
              <div
                className="inline-flex items-center rounded-md border border-white/[0.08] bg-zinc-900 p-0.5 shrink-0"
                aria-label="Language switcher"
              >
                {(['ru', 'en'] as LanguageCode[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                      language === lang
                        ? 'bg-white text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                title={theme === 'light' ? t('theme.dark') : t('theme.light')}
                aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-white/[0.08] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors shrink-0"
              >
                {theme === 'light' ? (
                  <Moon className="w-3.5 h-3.5" />
                ) : (
                  <Sun className="w-3.5 h-3.5" />
                )}
              </button>

              {onRequestSignOut && (
                <button
                  type="button"
                  onClick={onRequestSignOut}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border border-white/[0.08] bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3" />
                  <span>{t('profile.signOutBtn')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
