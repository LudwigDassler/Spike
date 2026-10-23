'use client';

import React from 'react';
import {
  Briefcase,
  CheckSquare,
  LayoutGrid,
  Users,
  X,
  Building2,
  Plus,
} from 'lucide-react';
import {
  Company,
  CrmLeadRecord,
  DashboardSection,
  OrganizationNode,
  TaskRecord,
  computeDashboardKpis,
} from '../types/database';
import { useTelegramAuth } from './TelegramAuthProvider';

/**
 * Строгий геометрический SVG-логотип TedCloud (абстрактные узлы сети и слои).
 */
export const TedCloudLogoMark: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="32" height="32" rx="8" className="fill-emerald-600" />
    <rect
      x="7"
      y="7"
      width="7"
      height="7"
      rx="2"
      stroke="white"
      strokeWidth="2"
    />
    <rect
      x="18"
      y="7"
      width="7"
      height="7"
      rx="2"
      stroke="white"
      strokeWidth="2"
    />
    <rect
      x="12.5"
      y="18"
      width="7"
      height="7"
      rx="2"
      stroke="white"
      strokeWidth="2"
    />
    <path
      d="M14 10.5H18M11.5 14L14.5 18M20.5 14L17.5 18"
      stroke="white"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export interface SidebarProps {
  company: Company | null;
  nodes: OrganizationNode[];
  leads: CrmLeadRecord[];
  tasks: TaskRecord[];
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  onQuickCreateAction?: (section: DashboardSection) => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  company,
  nodes,
  leads,
  tasks,
  activeSection,
  onSelectSection,
  onQuickCreateAction,
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const { role, userName } = useTelegramAuth();
  const kpis = computeDashboardKpis(leads, tasks, nodes);

  // Ролевой доступ из контекста авторизации / БД (без ручных переключателей):
  // - NETWORK_PARTNER: Обзор, Воронка сделок, Задачи
  // - INTERNAL_IT: Обзор, Задачи, Сотрудники
  // - SUPERADMIN: полный доступ ко всем разделам
  const canViewLeads = role === 'NETWORK_PARTNER' || role === 'SUPERADMIN';
  const canViewTeam = role === 'INTERNAL_IT' || role === 'SUPERADMIN';

  const navItems: Array<{
    id: DashboardSection;
    label: string;
    count?: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Обзор системы', icon: LayoutGrid },
    ...(canViewLeads
      ? [
          {
            id: 'leads' as const,
            label: 'Воронка сделок',
            count: leads.length,
            icon: Briefcase,
          },
        ]
      : []),
    {
      id: 'tasks',
      label: 'Активные задачи',
      count: kpis.activeTasksCount,
      icon: CheckSquare,
    },
    ...(canViewTeam
      ? [
          {
            id: 'team' as const,
            label: 'Сотрудники',
            count: nodes.length,
            icon: Users,
          },
        ]
      : []),
  ];

  const handleNavClick = (section: DashboardSection) => {
    onSelectSection(section);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  return (
    <aside
      aria-label={
        isMobileDrawer ? 'Мобильная навигация TedCloud' : 'Навигация TedCloud'
      }
      className={
        isMobileDrawer
          ? 'w-72 max-w-[85vw] h-full overflow-y-auto font-sans bg-white border-r border-slate-200 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col justify-between gap-6 shadow-md'
          : 'hidden md:flex md:w-68 shrink-0 font-sans bg-white border-r border-slate-200 p-5 flex-col justify-between gap-6'
      }
    >
      <div className="space-y-6">
        {/* Бренд и заголовок в мобильном Drawer */}
        {isMobileDrawer && (
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <TedCloudLogoMark className="w-7 h-7" />
              <span className="text-base font-semibold tracking-tight text-slate-900">
                TedCloud
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              aria-label="Закрыть меню"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Текущая организация из таблицы companies */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">Организация</div>
            <div className="text-sm font-semibold tracking-tight text-slate-900 truncate">
              {company?.name || 'Не назначена'}
            </div>
          </div>
        </div>

        {/* Основная навигация */}
        <div className="space-y-1.5">
          <div className="px-2 text-xs font-semibold tracking-tight text-slate-400 uppercase">
            Навигация
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        isActive
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Сводка B2B показателей компании */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="text-xs font-semibold tracking-tight text-slate-900">
            Показатели компании
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Сумма сделок</span>
              <span className="font-semibold text-slate-900">
                {kpis.totalDealValue.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Активные задачи</span>
              <span className="font-semibold text-slate-900">
                {kpis.activeTasksCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Конверсия</span>
              <span className="font-semibold text-emerald-600">
                {kpis.conversionRatePercent}%
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Сотрудники</span>
              <span className="font-semibold text-slate-900">
                {kpis.employeesCount}
              </span>
            </div>
          </div>
          {onQuickCreateAction && (
            <button
              type="button"
              onClick={() => {
                onQuickCreateAction(
                  activeSection === 'overview' ? 'leads' : activeSection
                );
                if (onCloseMobileDrawer) onCloseMobileDrawer();
              }}
              className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить запись</span>
            </button>
          )}
        </div>
      </div>

      {/* Профиль авторизованного сотрудника (без отладочных переключателей ролей) */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-tight text-slate-900 truncate">
            {userName}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {role === 'SUPERADMIN'
              ? 'Администратор'
              : role === 'INTERNAL_IT'
              ? 'Инженер поддержки'
              : 'Менеджер по работе с клиентами'}
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
      </div>
    </aside>
  );
};

export const WorkspaceSidebar = Sidebar;
