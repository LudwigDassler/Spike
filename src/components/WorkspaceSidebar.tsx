import React from 'react';
import { PartnerPlaybook, WhiteLabelPreset } from '../types/saas';
import { useCurrentRole } from '../context/RoleContext';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface WorkspaceSidebarProps {
  presets: WhiteLabelPreset[];
  activePreset: WhiteLabelPreset;
  onSelectPreset: (preset: WhiteLabelPreset) => void;
  projects: string[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
  playbooks: PartnerPlaybook[];
  onDeployPlaybook: (playbook: PartnerPlaybook) => void;
  totalBranchPv: number;
  completedTasksCount: number;
  totalTasksCount: number;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  playbooks,
  onDeployPlaybook,
  totalBranchPv,
  completedTasksCount,
  totalTasksCount,
}) => {
  const { currentRole, canViewCrmAndPv } = useCurrentRole();

  const visibleProjects = projects.filter((proj) => {
    const isItProject =
      proj.toLowerCase().includes('it') || proj.toLowerCase().includes('инфраструктур');
    if (currentRole === 'INTERNAL_IT') {
      return isItProject || proj === 'Корпоративный B2B';
    }
    return !isItProject && proj !== 'Корпоративный B2B';
  });

  return (
    <aside
      aria-label="Панель управления TedCloud"
      className="w-full lg:w-72 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col gap-6"
    >
      {canViewCrmAndPv ? (
        <>
          {/* Мотивационный блок геймификации VP (Volume Points) для продавцов и лидеров сети */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Мой баланс баллов</span>
              </span>
              <span
                title="Безопасное соединение"
                aria-label="Безопасное соединение"
                className="inline-flex items-center text-emerald-700 cursor-help"
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

          {/* Готовые сценарии роста для партнёра */}
          <div className="pt-2 border-t border-slate-200">
            <h2 className="text-xs font-semibold text-slate-800 mb-1">
              Быстрые сценарии роста
            </h2>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Готовые подборки шагов для работы с клиентами:
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
                    onClick={() => onDeployPlaybook(pb)}
                    className="w-full py-1.5 px-3 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Запустить сценарий
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Инженерный сайдбар для INTERNAL_IT (без PV и без сторонних брендов) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Спринт поддержки
              </span>
              <span
                title="Безопасное соединение"
                aria-label="Безопасное соединение"
                className="inline-flex items-center text-blue-700 cursor-help"
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
                onClick={() => onSelectProject('all')}
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
                  onClick={() => onSelectProject(proj)}
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
