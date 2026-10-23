'use client';

import React, { useState } from 'react';
import { Menu, Settings, Check, Sparkles } from 'lucide-react';
import { useTelegramAuth } from './TelegramAuthProvider';
import { UserRole } from '../types/saas';

export type ActiveTab = 'copilot' | 'tasks' | 'crm' | 'partners' | 'enterprise';

export interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  onOpenMobileSidebar?: () => void;
}

const ROLE_OPTIONS: Array<{
  id: UserRole;
  label: string;
  description: string;
  activeClass: string;
}> = [
  {
    id: 'NETWORK_PARTNER',
    label: 'NETWORK_PARTNER',
    description: 'Партнёр сети (CRM Лиды и VP)',
    activeClass: 'bg-emerald-700 text-white shadow-sm',
  },
  {
    id: 'INTERNAL_IT',
    label: 'INTERNAL_IT',
    description: 'Инженер поддержки (Задачи IT-отдела)',
    activeClass: 'bg-emerald-800 text-white shadow-sm',
  },
  {
    id: 'SUPERADMIN',
    label: 'SUPERADMIN',
    description: 'Multi-Tenant Администратор',
    activeClass: 'bg-slate-900 text-white shadow-sm',
  },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTaskModal,
  onOpenMobileSidebar,
}) => {
  const { role, setRoleType } = useTelegramAuth();
  const [isMobileRoleMenuOpen, setIsMobileRoleMenuOpen] = useState(false);

  // Ролевая фильтрация навигации (RBAC):
  // - NETWORK_PARTNER: скрыт раздел «Задачи IT-отдела»
  // - INTERNAL_IT: скрыт раздел «CRM Лиды» и партнерские баллы
  // - SUPERADMIN: видит все разделы и управление организациями
  const canViewCrmLeads = role === 'NETWORK_PARTNER' || role === 'SUPERADMIN';
  const canViewItTasks = role === 'INTERNAL_IT' || role === 'SUPERADMIN';
  const isSuperAdmin = role === 'SUPERADMIN';

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'copilot', label: 'Фокус дня' },
    ...(canViewCrmLeads ? [{ id: 'crm' as const, label: 'CRM Лиды' }] : []),
    ...(canViewItTasks
      ? [{ id: 'tasks' as const, label: 'Задачи IT-отдела' }]
      : []),
    ...(isSuperAdmin
      ? [
          { id: 'partners' as const, label: 'Партнёрская сеть' },
          { id: 'enterprise' as const, label: 'B2B & White-Label' },
        ]
      : []),
  ];

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRoleType(nextRole);
    setIsMobileRoleMenuOpen(false);
    if (
      nextRole === 'NETWORK_PARTNER' &&
      activeTab !== 'copilot' &&
      activeTab !== 'crm'
    ) {
      onSelectTab('copilot');
    } else if (
      nextRole === 'INTERNAL_IT' &&
      activeTab !== 'copilot' &&
      activeTab !== 'tasks'
    ) {
      onSelectTab('copilot');
    }
  };

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-sm transition-all duration-200">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3">
        {/* Зона 1: Кнопка «гамбургера» (мобильный Offcanvas Drawer) + логотип TedCloud */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Открыть панель управления"
            className="md:hidden inline-flex items-center justify-center p-2.5 rounded-2xl text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/90 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('copilot');
            }}
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <span className="w-7 h-7 rounded-xl bg-emerald-700 text-white inline-flex items-center justify-center shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span>TedCloud</span>
          </a>
          <span className="text-xs text-slate-300 hidden sm:inline">|</span>
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">
            {role === 'INTERNAL_IT'
              ? 'Инженерный контур и поддержка'
              : role === 'SUPERADMIN'
              ? 'Multi-Tenant Центр управления'
              : 'Zero-Chat CRM пространство'}
          </span>
        </div>

        {/* Зона 2: Навигация с плавными переходами и фирменным изумрудным акцентом */}
        <nav
          aria-label="Основная навигация"
          className="order-3 md:order-2 w-full md:w-auto flex items-center gap-2 overflow-x-auto text-sm font-medium text-slate-600 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`px-3.5 py-1.5 rounded-2xl text-xs sm:text-sm transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                  isActive
                    ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-50/70'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Зона 3: Переключатель ролей + основная кнопка создания задачи */}
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 shrink-0 relative">
          <div
            role="group"
            aria-label="Переключатель ролей"
            className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80"
          >
            {ROLE_OPTIONS.map((roleOpt) => (
              <button
                key={roleOpt.id}
                type="button"
                onClick={() => handleRoleSwitch(roleOpt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  role === roleOpt.id
                    ? roleOpt.activeClass
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {roleOpt.label}
              </button>
            ))}
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileRoleMenuOpen((prev) => !prev)}
              aria-label="Выбор роли"
              aria-expanded={isMobileRoleMenuOpen}
              className="inline-flex items-center justify-center p-2.5 rounded-2xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/90 shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isMobileRoleMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs transition-opacity duration-200"
                  onClick={() => setIsMobileRoleMenuOpen(false)}
                />
                <div
                  role="menu"
                  aria-label="Выбор роли"
                  className="absolute right-0 top-full mt-2 w-68 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-md p-2.5 z-50 space-y-1"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Ролевой доступ TedCloud
                  </div>
                  {ROLE_OPTIONS.map((roleOpt) => {
                    const isSelected = role === roleOpt.id;
                    return (
                      <button
                        key={roleOpt.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleRoleSwitch(roleOpt.id)}
                        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl text-left text-xs transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-semibold">
                            {roleOpt.label}
                          </div>
                          <div
                            className={`text-[11px] ${
                              isSelected ? 'text-emerald-100' : 'text-slate-500'
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
            className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {role === 'INTERNAL_IT' ? '+ Новый тикет' : '+ Новая задача'}
          </button>
        </div>
      </div>
    </header>
  );
};
