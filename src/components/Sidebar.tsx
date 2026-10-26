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
} from 'lucide-react';
import {
  DashboardSection,
  OrganizationNode,
  normalizeEmployeePermissions,
} from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

interface SidebarProps {
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
  const { t } = useLocale();

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
    <aside className="w-64 shrink-0 border-r border-[#1F1F1F] bg-[#0D0D0D] flex flex-col justify-between select-none font-sans">
      <div>
        <div className="h-14 px-5 flex items-center justify-between border-b border-[#1F1F1F]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs tracking-tight">
              TC
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">TedCloud</span>
          </div>
          <span className="text-[11px] font-medium text-[#71717A] whitespace-nowrap">
            {t('brand.edition')}
          </span>
        </div>

        <nav className="p-3 space-y-1" aria-label="Main Navigation">
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
                    ? 'bg-[#1F1F1F] text-white border border-[#2E2E2E]'
                    : 'text-[#8E8E93] hover:text-white hover:bg-[#151515] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {typeof item.badge === 'number' && (
                  <span
                    className={`text-[11px] font-mono tabular-nums whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-[#71717A]'
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
        <div className="p-3 border-t border-[#1F1F1F] space-y-2">
          <div className="rounded-lg border border-[#1F1F1F] bg-[#121212] p-3 space-y-2">
            <button
              type="button"
              onClick={() => onSelectSection('profile')}
              className="w-full text-left space-y-1 group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white group-hover:underline truncate">
                  {currentProfile.name}
                </span>
                <span className="text-[10px] font-medium text-[#A1A1AA] whitespace-nowrap">
                  {t(`accessShort.${access_level}`)}
                </span>
              </div>
              <div className="text-[11px] text-[#8E8E93] truncate">
                {currentProfile.role_type}
                {currentProfile.department ? ` · ${currentProfile.department}` : ''}
              </div>
            </button>

            {onRequestSignOut && (
              <button
                type="button"
                onClick={onRequestSignOut}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#262626] bg-[#17171A] hover:bg-[#222226] text-[11px] font-medium text-[#A1A1AA] hover:text-white transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('profile.signOutBtn')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
