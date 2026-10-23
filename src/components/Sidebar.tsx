'use client';

import React from 'react';
import { PartnerPlaybook, WhiteLabelPreset } from '../types/saas';
import { useTelegramAuth } from './TelegramAuthProvider';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';
import {
  ShieldCheck,
  Sparkles,
  X,
  Users,
  Terminal,
  Layers,
  Inbox,
  FolderKanban,
  Building2,
} from 'lucide-react';

export interface SidebarProps {
  presets?: WhiteLabelPreset[];
  activePreset?: WhiteLabelPreset;
  onSelectPreset?: (preset: WhiteLabelPreset) => void;
  projects: string[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
  playbooks: PartnerPlaybook[];
  onDeployPlaybook: (playbook: PartnerPlaybook) => void;
  totalBranchPv: number;
  completedTasksCount: number;
  totalTasksCount: number;
  leadsCount?: number;
  companyName?: string;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  playbooks,
  onDeployPlaybook,
  totalBranchPv,
  completedTasksCount,
  totalTasksCount,
  leadsCount = 0,
  companyName = 'TedCloud Enterprise',
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const { role, userName } = useTelegramAuth();

  // RBAC-правила Multi-Tenant пространства:
  // - NETWORK_PARTNER: видит «CRM Лиды» и партнерские баллы; скрыт раздел «Задачи IT-отдела»
  // - INTERNAL_IT: видит «Задачи IT-отдела»; скрыты «CRM Лиды» и партнерские баллы
  // - SUPERADMIN: полный доступ ко всем компаниям и контурам
  const canViewCrmLeads = role === 'NETWORK_PARTNER' || role === 'SUPERADMIN';
  const canViewItTasks = role === 'INTERNAL_IT' || role === 'SUPERADMIN';

  const visibleProjects = projects.filter((proj) => {
    const isItProject =
      proj.toLowerCase().includes('it') ||
      proj.toLowerCase().includes('инфраструктур');
    if (role === 'INTERNAL_IT') {
      return isItProject || proj === 'Корпоративный B2B';
    }
    if (role === 'NETWORK_PARTNER') {
      return !isItProject && proj !== 'Корпоративный B2B';
    }
    return true;
  });

  const handleProjectClick = (proj: string) => {
    onSelectProject(proj);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const handlePlaybookClick = (pb: PartnerPlaybook) => {
    onDeployPlaybook(pb);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  return (
    <aside
      aria-label={
        isMobileDrawer ? 'Мобильное меню TedCloud' : 'Панель управления TedCloud'
      }
      className={
        isMobileDrawer
          ? 'w-80 max-w-[86vw] h-full overflow-y-auto bg-white/95 backdrop-blur-xl border-r border-slate-200/80 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-6 shadow-2xl transition-all duration-200'
          : 'hidden md:flex md:w-76 shrink-0 bg-white/85 backdrop-blur-md border-r border-slate-200/80 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex-col gap-6'
      }
    >
      {/* Шапка мобильного Drawer с поддержкой Glassmorphism */}
      {isMobileDrawer && (
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
          <div className="space-y-0.5">
            <div className="text-sm font-bold tracking-tight text-slate-900">
              TedCloud
            </div>
            <div className="text-xs text-slate-500">
              {userName} · {companyName}
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            aria-label="Закрыть меню"
            className="p-2 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Карточка арендатора (Multi-Tenant Workspace Badge) */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-400">
              Рабочее пространство
            </div>
            <div className="text-xs font-semibold text-slate-900 truncate">
              {companyName}
            </div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 shrink-0">
          Active
        </span>
      </div>

      {/* Навигационные разделы по ролям (RBAC) */}
      <div className="space-y-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Доступные разделы
        </div>
        <div className="flex flex-col gap-1.5">
          {canViewCrmLeads && (
            <button
              type="button"
              onClick={() => handleProjectClick('all')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-100" />
                <span>CRM Лиды</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-100">
                Активно
              </span>
            </button>
          )}

          {canViewItTasks && (
            <button
              type="button"
              onClick={() => handleProjectClick('all')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-white text-slate-800 border border-slate-200/90 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-300 transition-all duration-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-700" />
                <span>Задачи IT-отдела</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Очередь
              </span>
            </button>
          )}

          {role === 'SUPERADMIN' && (
            <div className="px-3.5 py-2.5 rounded-2xl text-xs font-medium bg-white border border-slate-200/80 shadow-sm text-slate-700 flex items-center gap-2 transition-all duration-200">
              <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Multi-Tenant Управление</span>
            </div>
          )}
        </div>
      </div>

      {/* Контур партнёра: CRM Лиды, баланс VP и сценарии сопровождения */}
      {canViewCrmLeads && (
        <>
          <div className="p-4 rounded-3xl bg-white border border-emerald-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Партнёрские баллы</span>
              </span>
              <span
                title="Защищённая Multi-Tenant сессия TedCloud"
                aria-label="Защищённая Multi-Tenant сессия TedCloud"
                className="inline-flex items-center text-emerald-700"
              >
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Командный объём</span>
              <span className="text-base font-bold font-mono tabular-nums text-emerald-900">
                {totalBranchPv.toLocaleString('ru-RU')} VP
              </span>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-700 rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((totalBranchPv / 15000) * 100)
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Выполнено касаний</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {completedTasksCount} из {totalTasksCount}
              </span>
            </div>
          </div>

          {/* Empty State для воронки лидов, если список пуст */}
          {leadsCount === 0 && (
            <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-200 shadow-sm text-center space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <Inbox className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-slate-800">
                В этой воронке пока нет лидов
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Новые обращения из Telegram-бота появятся здесь автоматически.
              </p>
            </div>
          )}

          {/* Быстрые сценарии роста */}
          <div className="pt-2 border-t border-slate-200/80 space-y-3">
            <div>
              <h2 className="text-xs font-semibold text-slate-900">
                Быстрые сценарии роста
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Автоматизированные цепочки касаний для клиентов:
              </p>
            </div>

            {playbooks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-200 text-center space-y-1.5">
                <FolderKanban className="w-4 h-4 text-slate-400 mx-auto" />
                <div className="text-xs font-medium text-slate-700">
                  В этой воронке пока нет сценариев
                </div>
                <p className="text-[11px] text-slate-500">
                  Добавьте первый шаблон онбординга для команды.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {playbooks.map((pb) => (
                  <div
                    key={pb.id}
                    className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900 leading-snug">
                        {pb.title}
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70 shrink-0">
                        +{pb.expectedPvGain} VP
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      Длительность: {pb.durationDays} дн.
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePlaybookClick(pb)}
                      className="w-full py-2 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Запустить сценарий
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Контур инженера: Задачи IT-отдела */}
      {canViewItTasks && (
        <>
          <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">
                Задачи IT-отдела
              </span>
              <span
                title="Защищённая сессия TedCloud"
                aria-label="Защищённая сессия TedCloud"
                className="inline-flex items-center text-emerald-700"
              >
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Ёмкость спринта</span>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-800">
                34 Story Points
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="px-1 text-xs font-semibold text-slate-800">
              Очереди подразделений
            </div>
            <div className="space-y-2">
              {DEPARTMENT_QUEUE_OPTIONS.map((dept) => (
                <div
                  key={dept.id}
                  className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm text-xs space-y-1.5 transition-all duration-200"
                >
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    {dept.label}
                  </span>
                  <div className="text-slate-500">{dept.category}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 space-y-2">
            <h2 className="px-1 text-xs font-semibold text-slate-800">
              Инженерные потоки
            </h2>
            {visibleProjects.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Очередь потоков пуста
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => handleProjectClick('all')}
                  className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap truncate cursor-pointer ${
                    selectedProject === 'all'
                      ? 'bg-emerald-700 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Все очереди
                </button>
                {visibleProjects.map((proj) => (
                  <button
                    key={proj}
                    type="button"
                    onClick={() => handleProjectClick(proj)}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap truncate cursor-pointer ${
                      selectedProject === proj
                        ? 'bg-emerald-700 text-white shadow-sm font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {proj}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};

export const WorkspaceSidebar = Sidebar;
