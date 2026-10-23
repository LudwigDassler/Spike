'use client';

import React from 'react';
import { Menu, Plus } from 'lucide-react';
import { Company, DashboardSection } from '../types/database';
import { TedCloudLogoMark } from './Sidebar';
import { useTelegramAuth } from './TelegramAuthProvider';

export interface TopBarProps {
  company: Company | null;
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  onOpenCreateModal: () => void;
  onOpenMobileSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  company,
  activeSection,
  onSelectSection,
  onOpenCreateModal,
  onOpenMobileSidebar,
}) => {
  const { role } = useTelegramAuth();

  const canViewLeads = role === 'NETWORK_PARTNER' || role === 'SUPERADMIN';
  const canViewTeam = role === 'INTERNAL_IT' || role === 'SUPERADMIN';

  const navItems: Array<{ id: DashboardSection; label: string }> = [
    { id: 'overview', label: 'Обзор' },
    ...(canViewLeads ? [{ id: 'leads' as const, label: 'Сделки' }] : []),
    { id: 'tasks', label: 'Активные задачи' },
    ...(canViewTeam ? [{ id: 'team' as const, label: 'Сотрудники' }] : []),
  ];

  return (
    <header className="font-sans bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 px-4 md:px-6 py-3">
        {/* Зона 1: Мобильный Гамбургер + Геометрический SVG логотип TedCloud */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Открыть навигацию"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all duration-200 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              onSelectSection('overview');
            }}
            className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap"
          >
            <TedCloudLogoMark className="w-7 h-7" />
            <span>TedCloud</span>
          </a>

          {company?.name && (
            <>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline truncate max-w-[200px]">
                {company.name}
              </span>
            </>
          )}
        </div>

        {/* Зона 2: Быстрая навигация по разделам (без тестовых кнопок ролей) */}
        <nav
          aria-label="Навигация рабочего пространства"
          className="hidden md:flex items-center gap-1.5"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Зона 3: Универсальное действие "Добавить" */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить</span>
          </button>
        </div>
      </div>
    </header>
  );
};
