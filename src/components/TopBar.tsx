import React, { useState } from 'react';
import { Menu, Settings, Check } from 'lucide-react';
import { useCurrentRole } from '../context/RoleContext';
import { UserRole } from '../types/saas';

export type ActiveTab = 'copilot' | 'tasks' | 'crm' | 'partners' | 'enterprise';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onOpenMobileSidebar?: () => void;
}

const ROLE_OPTIONS: Array<{ id: UserRole; label: string; description: string; activeClass: string }> = [
  {
    id: 'NETWORK_PARTNER',
    label: 'NETWORK_PARTNER',
    description: 'Партнёр сети (Клиенты и VP)',
    activeClass: 'bg-emerald-700 text-white shadow-xs',
  },
  {
    id: 'INTERNAL_IT',
    label: 'INTERNAL_IT',
    description: 'Инженер поддержки (Тикеты)',
    activeClass: 'bg-blue-700 text-white shadow-xs',
  },
  {
    id: 'SUPERADMIN',
    label: 'SUPERADMIN',
    description: 'Полный доступ TedCloud',
    activeClass: 'bg-slate-900 text-white shadow-xs',
  },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTaskModal,
  onOpenMobileSidebar,
}) => {
  const {
    currentRole,
    setCurrentRole,
    canViewCrmAndPv,
    canViewItTickets,
    canViewPartnerNetwork,
    canViewWhiteLabel,
  } = useCurrentRole();

  const [isMobileRoleMenuOpen, setIsMobileRoleMenuOpen] = useState(false);

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
    setIsMobileRoleMenuOpen(false);
    if (nextRole === 'NETWORK_PARTNER' && activeTab !== 'copilot' && activeTab !== 'crm') {
      onSelectTab('copilot');
    } else if (nextRole === 'INTERNAL_IT' && activeTab !== 'copilot' && activeTab !== 'tasks') {
      onSelectTab('copilot');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3">
        {/* Zone 1: Mobile Hamburger + TedCloud Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Открыть панель управления"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

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

        {/* Zone 2: Role-Scoped Navigation (Desktop inline, Mobile full-width second row) */}
        <nav
          aria-label="Основная навигация"
          className="order-3 md:order-2 w-full md:w-auto flex items-center gap-5 overflow-x-auto text-sm font-medium text-slate-600 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100"
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

        {/* Zone 3: Role Switcher (Desktop inline / Mobile Settings Gear) + Primary Action */}
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 shrink-0 relative">
          {/* Десктопный переключатель ролей (виден на md и выше) */}
          <div
            role="group"
            aria-label="Переключатель ролей"
            className="hidden md:flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200"
          >
            {ROLE_OPTIONS.map((roleOpt) => (
              <button
                key={roleOpt.id}
                type="button"
                onClick={() => handleRoleSwitch(roleOpt.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  currentRole === roleOpt.id
                    ? roleOpt.activeClass
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {roleOpt.label}
              </button>
            ))}
          </div>

          {/* Мобильная кнопка-шестерёнка (< md) для скрытия демо-переключателя ролей */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileRoleMenuOpen((prev) => !prev)}
              aria-label="Настройки роли (Демо)"
              aria-expanded={isMobileRoleMenuOpen}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isMobileRoleMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMobileRoleMenuOpen(false)}
                />
                <div
                  role="menu"
                  aria-label="Выбор роли"
                  className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 space-y-1"
                >
                  <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Режим просмотра (Демо)
                  </div>
                  {ROLE_OPTIONS.map((roleOpt) => {
                    const isSelected = currentRole === roleOpt.id;
                    return (
                      <button
                        key={roleOpt.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleRoleSwitch(roleOpt.id)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-semibold">{roleOpt.label}</div>
                          <div
                            className={`text-[11px] ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {roleOpt.description}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentRole === 'INTERNAL_IT'
                ? 'bg-blue-700 hover:bg-blue-800'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {currentRole === 'INTERNAL_IT' ? '+ Новый тикет' : '+ Новая задача'}
          </button>
        </div>
      </div>
    </header>
  );
};

