import React from 'react';
import { useCurrentRole } from '../context/RoleContext';
import { UserRole } from '../types/saas';

export type ActiveTab = 'copilot' | 'tasks' | 'crm' | 'partners' | 'enterprise';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTaskModal,
}) => {
  const {
    currentRole,
    setCurrentRole,
    canViewCrmAndPv,
    canViewItTickets,
    canViewPartnerNetwork,
    canViewWhiteLabel,
  } = useCurrentRole();

  // Ролевая фильтрация навигации:
  // - NETWORK_PARTNER: только "Фокус дня" и "Мои клиенты" (IT-задачи и White-Label скрыты)
  // - INTERNAL_IT: только "Фокус дня" и "Задачи отдела" (CRM-воронка и баллы PV/VP скрыты)
  // - SUPERADMIN: полный доступ ко всем контурам TedCloud
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'copilot', label: 'Фокус дня' },
    ...(canViewCrmAndPv ? [{ id: 'crm' as const, label: 'Мои клиенты' }] : []),
    ...(canViewItTickets ? [{ id: 'tasks' as const, label: 'Задачи отдела' }] : []),
    ...(currentRole === 'SUPERADMIN' && canViewPartnerNetwork
      ? [{ id: 'partners' as const, label: 'Партнёрская сеть' }]
      : []),
    ...(canViewWhiteLabel
      ? [{ id: 'enterprise' as const, label: 'B2B & White-Label' }]
      : []),
  ];

  const handleRoleSwitch = (nextRole: UserRole) => {
    setCurrentRole(nextRole);
    if (nextRole === 'NETWORK_PARTNER' && activeTab !== 'copilot' && activeTab !== 'crm') {
      onSelectTab('copilot');
    } else if (nextRole === 'INTERNAL_IT' && activeTab !== 'copilot' && activeTab !== 'tasks') {
      onSelectTab('copilot');
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('copilot');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          TedCloud
        </a>
        <span className="text-xs text-slate-300 hidden sm:inline">|</span>
        <span className="text-xs font-medium text-slate-500 hidden sm:inline">
          {currentRole === 'INTERNAL_IT'
            ? 'Инженерный контур и поддержка'
            : currentRole === 'SUPERADMIN'
            ? 'Центр управления платформой'
            : 'Рабочее место партнёра'}
        </span>
      </div>

      {/* Zone 2: Role-Scoped Navigation */}
      <nav
        aria-label="Основная навигация"
        className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-600"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                isActive
                  ? currentRole === 'INTERNAL_IT'
                    ? 'border-blue-700 text-slate-900 font-semibold'
                    : 'border-emerald-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Role Switcher (NETWORK_PARTNER / INTERNAL_IT / SUPERADMIN) + Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          role="group"
          aria-label="Переключатель ролей"
          className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
        >
          <button
            type="button"
            onClick={() => handleRoleSwitch('NETWORK_PARTNER')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              currentRole === 'NETWORK_PARTNER'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            NETWORK_PARTNER
          </button>
          <button
            type="button"
            onClick={() => handleRoleSwitch('INTERNAL_IT')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              currentRole === 'INTERNAL_IT'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            INTERNAL_IT
          </button>
          <button
            type="button"
            onClick={() => handleRoleSwitch('SUPERADMIN')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              currentRole === 'SUPERADMIN'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SUPERADMIN
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenNewTaskModal}
          className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            currentRole === 'INTERNAL_IT'
              ? 'bg-blue-700 hover:bg-blue-800'
              : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
        >
          {currentRole === 'INTERNAL_IT' ? '+ Новый тикет' : '+ Новая задача'}
        </button>
      </div>
    </header>
  );
};
