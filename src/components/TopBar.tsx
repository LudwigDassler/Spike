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
    canViewPartnerNetwork,
    canViewWhiteLabel,
  } = useCurrentRole();

  const allNavItems: Array<{ id: ActiveTab; label: string; visible: boolean }> = [
    { id: 'copilot', label: 'Фокус дня', visible: true },
    { id: 'tasks', label: 'Задачи и тикеты', visible: true },
    { id: 'crm', label: 'Воронка и CRM', visible: canViewCrmAndPv },
    { id: 'partners', label: 'Партнёрская сеть', visible: canViewPartnerNetwork },
    { id: 'enterprise', label: 'B2B и White-Label', visible: canViewWhiteLabel },
  ];

  const visibleNavItems = allNavItems.filter((item) => item.visible);

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (newRole === 'INTERNAL_IT' && (activeTab === 'crm' || activeTab === 'partners' || activeTab === 'enterprise')) {
      onSelectTab('copilot');
    } else if (newRole === 'NETWORK_PARTNER' && activeTab === 'enterprise') {
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
        <span className="text-xs text-slate-400 hidden sm:inline">·</span>
        <span className="text-xs font-medium text-slate-500 hidden sm:inline">
          Единое рабочее пространство
        </span>
      </div>

      {/* Zone 2: Role-Filtered Navigation Links */}
      <nav
        aria-label="Основная навигация"
        className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-600"
      >
        {visibleNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                isActive
                  ? 'border-emerald-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Role Context Switcher + Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <label htmlFor="header-role-select" className="text-xs text-slate-500 hidden md:inline">
            Режим доступа:
          </label>
          <select
            id="header-role-select"
            aria-label="Текущая роль пользователя в TedCloud"
            value={currentRole}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            <option value="SUPERADMIN">Руководитель (Superadmin)</option>
            <option value="NETWORK_PARTNER">Партнёр сети (Продажи)</option>
            <option value="INTERNAL_IT">IT-специалист (Поддержка)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onOpenNewTaskModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          {currentRole === 'INTERNAL_IT' ? '+ Новый тикет' : '+ Новая задача'}
        </button>
      </div>
    </header>
  );
};
