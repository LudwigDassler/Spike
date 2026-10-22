import React from 'react';
import { PartnerPlaybook, WhiteLabelPreset } from '../types/saas';
import { useCurrentRole } from '../context/RoleContext';
import { DEPARTMENT_QUEUE_OPTIONS } from '../data/seedData';

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
  presets,
  activePreset,
  onSelectPreset,
  projects,
  selectedProject,
  onSelectProject,
  playbooks,
  onDeployPlaybook,
  totalBranchPv,
  completedTasksCount,
  totalTasksCount,
}) => {
  const {
    currentRole,
    canViewCrmAndPv,
    canViewItTickets,
    canViewWhiteLabel,
  } = useCurrentRole();

  // Фильтруем направления в сайдбаре в зависимости от роли пользователя
  const visibleProjects = projects.filter((proj) => {
    const isItProject = proj.toLowerCase().includes('it') || proj.toLowerCase().includes('инфраструктур');
    if (currentRole === 'INTERNAL_IT') {
      return isItProject || proj === 'Корпоративный B2B';
    }
    if (currentRole === 'NETWORK_PARTNER') {
      return !isItProject && proj !== 'Корпоративный B2B';
    }
    return true;
  });

  return (
    <aside
      aria-label="Управление рабочим пространством TedCloud"
      className="w-full lg:w-72 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col gap-6"
    >
      {/* White-Label Tenant Selector: Виден только SUPERADMIN (скрыт для обычных продажников и IT) */}
      {canViewWhiteLabel && (
        <div>
          <label
            htmlFor="tenant-preset-select"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Отраслевой профиль (White-Label)
          </label>
          <select
            id="tenant-preset-select"
            value={activePreset.id}
            onChange={(e) => {
              const found = presets.find((p) => p.id === e.target.value);
              if (found) onSelectPreset(found);
            }}
            className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.brandName}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            {activePreset.industryLabel} · Роль в сети: {activePreset.partnerTitleLabel}
          </p>
        </div>
      )}

      {/* PV-аналитика ветки: скрыта для IT-специалистов */}
      {canViewCrmAndPv ? (
        <div className={canViewWhiteLabel ? 'pt-4 border-t border-slate-200' : ''}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-medium text-slate-600">
              Групповой объём ветки
            </span>
            <span className="text-sm font-semibold font-mono tabular-nums text-slate-900">
              {totalBranchPv.toLocaleString('ru-RU')} PV
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-emerald-700 transition-all duration-200"
              style={{
                width: `${Math.min(100, Math.round((totalBranchPv / 12000) * 100))}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Закрыто задач по сети</span>
            <span className="font-mono tabular-nums font-medium text-slate-800">
              {completedTasksCount} из {totalTasksCount}
            </span>
          </div>
        </div>
      ) : (
        /* Сводка сервисных очередей для IT-специалиста (без PV и коммерческой воронки) */
        <div>
          <div className="text-xs font-semibold text-slate-800 mb-2">
            Сервисные очереди департаментов
          </div>
          <div className="space-y-2">
            {DEPARTMENT_QUEUE_OPTIONS.map((dept) => (
              <div
                key={dept.id}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div className="font-semibold text-slate-900">[{dept.label}]</div>
                <div className="text-slate-500 mt-0.5">{dept.category}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Filter Navigation */}
      <div className="pt-4 border-t border-slate-200">
        <h2 className="text-xs font-semibold text-slate-800 mb-2">
          {canViewItTickets && !canViewCrmAndPv
            ? 'Инженерные потоки'
            : 'Проекты и направления'}
        </h2>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onSelectProject('all')}
            className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate ${
              selectedProject === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Все доступные направления
          </button>
          {visibleProjects.map((proj) => (
            <button
              key={proj}
              type="button"
              onClick={() => onSelectProject(proj)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate ${
                selectedProject === proj
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {proj}
            </button>
          ))}
        </div>
      </div>

      {/* Сценарии запуска партнёра: видны только ролям продаж и руководителю */}
      {canViewCrmAndPv && (
        <div className="pt-4 border-t border-slate-200">
          <h2 className="text-xs font-semibold text-slate-800 mb-1">
            Шаблоны запуска партнёра
          </h2>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Пошаговые бизнес-сценарии для вывода новичка на плановый результат:
          </p>
          <div className="flex flex-col gap-2.5">
            {playbooks.map((pb) => (
              <div
                key={pb.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900 leading-snug">
                    {pb.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    {pb.durationDays} дн. · +{pb.expectedPvGain} PV · {pb.tasksTemplate.length} зад.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeployPlaybook(pb)}
                  className="w-full py-1.5 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Развернуть задачи ({pb.tasksTemplate.length})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
