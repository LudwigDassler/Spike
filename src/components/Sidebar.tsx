'use client';

import React from 'react';
import { PartnerPlaybook, WhiteLabelPreset } from '../types/saas';
import { useTelegramAuth } from './TelegramAuthProvider';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';
import { ShieldCheck, Sparkles, X, Users, Terminal, Layers } from 'lucide-react';

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
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const { role, userName } = useTelegramAuth();

  // RBAC-правила:
  // - NETWORK_PARTNER: видит «CRM Лиды» и партнерские баллы; скрыт раздел «Задачи IT-отдела»
  // - INTERNAL_IT: видит «Задачи IT-отдела»; скрыты «CRM Лиды» и партнерские баллы
  // - SUPERADMIN: видит оба контура («CRM Лиды» + «Задачи IT-отдела»)
  const canViewCrmLeads = role === 'NETWORK_PARTNER' || role === 'SUPERADMIN';
  const canViewItTasks = role === 'INTERNAL_IT' || role === 'SUPERADMIN';

  const visibleProjects = projects.filter((proj) => {
    const isItProject =
      proj.toLowerCase().includes('it') || proj.toLowerCase().includes('инфраструктур');
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
      aria-label={isMobileDrawer ? 'Мобильное меню TedCloud' : 'Панель управления TedCloud'}
      className={
        isMobileDrawer
          ? 'w-80 max-w-[85vw] h-full overflow-y-auto bg-white border-r border-slate-200 p-5 flex flex-col gap-6 shadow-2xl'
          : 'hidden md:flex md:w-72 shrink-0 bg-white border-r border-slate-200 p-5 flex-col gap-6'
      }
    >
      {/* Шапка мобильного Drawer */}
      {isMobileDrawer && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="text-sm font-bold text-slate-900">TedCloud</div>
            <div className="text-xs text-slate-500">
              {userName} ·{' '}
              {role === 'INTERNAL_IT'
                ? 'Задачи IT-отдела'
                : role === 'SUPERADMIN'
                ? 'Полный доступ'
                : 'CRM Лиды и VP'}
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            aria-label="Закрыть меню"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Навигационные разделы по ролям (RBAC) */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Доступные разделы
        </div>
        <div className="flex flex-col gap-1">
          {canViewCrmLeads && (
            <button
              type="button"
              onClick={() => handleProjectClick('all')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50/80 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100/70 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                <span>CRM Лиды</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-800">Активно</span>
            </button>
          )}

          {canViewItTasks && (
            <button
              type="button"
              onClick={() => handleProjectClick('all')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50/80 text-blue-900 border border-blue-200/80 hover:bg-blue-100/70 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-blue-700" />
                <span>Задачи IT-отдела</span>
              </span>
              <span className="font-mono text-[11px] text-blue-800">Очередь</span>
            </button>
          )}

          {role === 'SUPERADMIN' && (
            <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Гибридная иерархия TedCloud</span>
            </div>
          )}
        </div>
      </div>

      {/* Контур партнёра: CRM Лиды и партнёрские баллы VP (скрыто для INTERNAL_IT) */}
      {canViewCrmLeads && (
        <>
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Партнёрские баллы</span>
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
              <span className="text-xs text-slate-600">Командный объём</span>
              <span className="text-base font-bold font-mono tabular-nums text-emerald-900">
                {totalBranchPv.toLocaleString('ru-RU')} VP
              </span>
            </div>

            <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-emerald-200">
              <div
                className="h-full bg-emerald-600 transition-all duration-200"
                style={{
                  width: `${Math.min(100, Math.round((totalBranchPv / 15000) * 100))}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Выполнено касаний</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {completedTasksCount} из {totalTasksCount}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <h2 className="text-xs font-semibold text-slate-800 mb-1">
              Быстрые сценарии роста
            </h2>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Готовые последовательности шагов для работы с лидами:
            </p>
            <div className="flex flex-col gap-2.5">
              {playbooks.map((pb) => (
                <div
                  key={pb.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-900 leading-snug">
                      {pb.title}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 shrink-0">
                      +{pb.expectedPvGain} VP
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Длительность: {pb.durationDays} дн.
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePlaybookClick(pb)}
                    className="w-full py-1.5 px-3 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Запустить сценарий
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Контур инженера: Задачи IT-отдела (скрыто для NETWORK_PARTNER) */}
      {canViewItTasks && (
        <>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Задачи IT-отдела
              </span>
              <span
                title="Защищённая сессия TedCloud"
                aria-label="Защищённая сессия TedCloud"
                className="inline-flex items-center text-blue-700"
              >
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Ёмкость спринта</span>
              <span className="text-sm font-bold font-mono tabular-nums text-blue-800">
                34 Story Points
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-800 mb-2.5">
              Очереди подразделений
            </div>
            <div className="space-y-2">
              {DEPARTMENT_QUEUE_OPTIONS.map((dept) => (
                <div
                  key={dept.id}
                  className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs space-y-1.5"
                >
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
                    {dept.label}
                  </span>
                  <div className="text-slate-500">{dept.category}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h2 className="text-xs font-semibold text-slate-800 mb-2">
              Инженерные потоки
            </h2>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleProjectClick('all')}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                  selectedProject === 'all'
                    ? 'bg-slate-800 text-white'
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
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                    selectedProject === proj
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {proj}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export const WorkspaceSidebar = Sidebar;
