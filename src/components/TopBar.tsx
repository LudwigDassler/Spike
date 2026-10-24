import React, { useEffect, useState } from 'react';
import { Menu, Plus, Send, ShieldCheck } from 'lucide-react';
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
  const { role, userName, telegramUser, telegramId } = useTelegramAuth();
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      setIsInsideTelegram(Boolean(window.Telegram.WebApp.initDataUnsafe?.user));
    }
  }, [telegramUser]);

  const canViewLeads = role !== 'INTERNAL_IT';
  const canViewTeam = role !== 'NETWORK_PARTNER';

  const navItems: Array<{ id: DashboardSection; label: string }> = [
    { id: 'overview', label: 'Обзор' },
    ...(canViewLeads ? [{ id: 'leads' as const, label: 'Сделки' }] : []),
    { id: 'tasks', label: 'Задачи' },
    ...(canViewTeam ? [{ id: 'team' as const, label: 'Сотрудники' }] : []),
  ];

  const displayTgName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(' ') ||
      telegramUser.username ||
      userName
    : userName;

  return (
    <header className="font-sans bg-white/95 backdrop-blur-xs border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 px-4 md:px-6 py-3">
        {/* Зона 1: Мобильный Гамбургер + Бренд TedCloud */}
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

        {/* Зона 2: Быстрая навигация в стиле Linear / Vercel */}
        <nav
          aria-label="Навигация рабочего пространства"
          className="hidden md:flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Зона 3: Бейдж Telegram Mini App профиля + кнопка "Добавить" */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isInsideTelegram || telegramUser ? (
            <div
              title={`Авторизован через Telegram Mini App (ID: ${
                telegramId || telegramUser?.id || '—'
              })`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-medium"
            >
              <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="truncate max-w-[140px] font-semibold">
                {displayTgName}
              </span>
              {telegramUser?.username && (
                <span className="hidden sm:inline text-sky-600">
                  @{telegramUser.username}
                </span>
              )}
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[130px]">{userName}</span>
            </div>
          )}

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
