import React from 'react';
import {
  LayoutGrid,
  CheckSquare,
  Users,
  Briefcase,
  Building2,
  UserCircle,
  LogOut,
} from 'lucide-react';
import { DashboardSection, OrganizationNode } from '../types/database';
import { useLocale } from '../i18n/LocaleContext';

interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  currentProfile: OrganizationNode | null;
  counts: {
    tasks: number;
    nodes: number;
    leads: number;
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

  const navItems: {
    id: DashboardSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'overview', label: t('nav.overview'), icon: LayoutGrid },
    { id: 'tasks', label: t('nav.tasks'), icon: CheckSquare, badge: counts.tasks },
    { id: 'crm', label: t('nav.crm'), icon: Briefcase, badge: counts.leads },
    { id: 'team', label: t('nav.team'), icon: Users, badge: counts.nodes },
    { id: 'profile', label: t('nav.profile'), icon: UserCircle },
    { id: 'workspace', label: t('nav.workspace'), icon: Building2 },
  ];

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
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-[#1A1A1A] text-[#A1A1AA] border border-[#262626] whitespace-nowrap">
            {t('brand.edition')}
          </span>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
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
                    className={`text-[11px] font-medium px-2 py-0.5 rounded whitespace-nowrap ${
                      isActive ? 'bg-[#2C2C2E] text-white' : 'bg-[#171717] text-[#71717A]'
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
          <button
            type="button"
            onClick={() => onSelectSection('profile')}
            className="w-full text-left rounded-lg border border-[#1F1F1F] bg-[#121212] hover:bg-[#18181A] p-3 transition-colors space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white truncate">
                {currentProfile.name}
              </span>
              <span className="text-[10px] font-medium text-[#D4D4D8] bg-[#1C1C1E] px-2 py-0.5 rounded border border-[#2C2C2E] whitespace-nowrap">
                {t(`accessShort.${currentProfile.access_level || 'member'}`)}
              </span>
            </div>
            <div className="text-[11px] text-[#A1A1AA] truncate">
              {currentProfile.role_type}
              {currentProfile.department ? ` · ${currentProfile.department}` : ''}
            </div>
          </button>

          {onRequestSignOut && (
            <button
              type="button"
              onClick={onRequestSignOut}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1F1F1F] text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('profile.signOutBtn')}</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
