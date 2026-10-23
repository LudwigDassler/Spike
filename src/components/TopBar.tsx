'use client';

import React, { useState } from 'react';
import { Menu, Settings, Check } from 'lucide-react';
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
    activeClass: 'bg-emerald-700 text-white shadow-xs',
  },
  {
    id: 'INTERNAL_IT',
    label: 'INTERNAL_IT',
    description: 'Инженер поддержки (Задачи IT-отдела)',
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
  const { role, setRoleType } = useTelegramAuth();
  const [isMobileRoleMenuOpen, setIsMobileRoleMenuOpen] = useState(false);

  // RBAC-правила из TelegramAuthProvider:
  // - NETWORK_PARTNER: скрыт пункт «Задачи IT-отдела»
  // - INTERNAL_IT: скрыт пункт «CRM Лиды» и партнерские баллы
  // - SUPERADMIN: видит все разделы
  const canViewCrmLeads = role === 'NETWORK_PARTNER' || role === 'SUPERADMIN';
  const canViewItTasks = role === 'INTERNAL_IT' || role === 'SUPERADMIN';
  const isSuperAdmin = role === 'SUPERADMIN';

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'copilot', label: 'Фокус дня' },
    ...(canViewCrmLeads ? [{ id: 'crm' as const, label: 'CRM Лиды' }] : []),
    ...(canViewItTasks ? [{ id: 'tasks' as const, label: 'Задачи IT-отдела' }] : []),
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
    if (nextRole === 'NETWORK_PARTNER' && activeTab !== 'copilot' && activeTab !== 'crm') {
      onSelectTab('copilot');
    } else if (nextRole === 'INTERNAL_IT' && activeTab !== 'copilot' && activeTab !== 'tasks') {
      onSelectTab('copilot');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3">
        {/* Зона 1: Кнопка «гамбургера» (мобильный Offcanvas Drawer) + бренд TedCloud */}
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
            {role === 'INTERNAL_IT'
              ? 'Инженерный контур и поддержка'
              : role === 'SUPERADMIN'
              ? 'Центр управления платформой'
              : 'Рабочее место партнёра'}
          </span>
        </div>

        {/* Зона 2: Навигация с фильтрацией по ролям (RBAC) */}
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
                    ? role === 'INTERNAL_IT'
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

        {/* Зона 3: Переключатель ролей + кнопка создания задачи/тикета */}
        <div className="order-2 md:order-3 flex items-center gap-2 sm:gap-3 shrink-0 relative">
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
              role === 'INTERNAL_IT'
                ? 'bg-blue-700 hover:bg-blue-800'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {role === 'INTERNAL_IT' ? '+ Новый тикет' : '+ Новая задача'}
          </button>
        </div>
      </div>
    </header>
  );
};
