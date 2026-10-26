import React from 'react';
import {
  Building2,
  CheckCircle2,
  Briefcase,
  Network,
  AlertCircle,
} from 'lucide-react';
import {
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
} from '../types/database';
import { UserAvatar } from './UserAvatar';
import { useLocale } from '../i18n/LocaleContext';

interface TeamworkGraphViewProps {
  companyName: string;
  departments: string[];
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  canViewCrm: boolean;
  onSelectTask?: (taskId: string) => void;
  onSelectLead?: (leadId: string) => void;
}

export const TeamworkGraphView: React.FC<TeamworkGraphViewProps> = ({
  companyName,
  departments,
  nodes,
  tasks,
  leads,
  canViewCrm,
  onSelectTask,
  onSelectLead,
}) => {
  const { formatMoney, t } = useLocale();

  const openTasks = tasks.filter((t) => t.status !== 'Done');
  const activeLeads = canViewCrm
    ? leads.filter((l) => (l.status || l.stage) !== 'Lost')
    : [];

  // Group employees by department
  const effectiveDepts = Array.from(
    new Set([
      ...departments,
      ...nodes.map((n) => (n.department && n.department.trim() ? n.department.trim() : 'Дирекция / Общий штат')),
    ])
  );

  if (effectiveDepts.length === 0) {
    effectiveDepts.push('Основное подразделение');
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#111114] shadow-2xl p-6 space-y-6">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Network className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Карта связей организации (Teamwork Graph)
            </h2>
            <p className="text-xs text-[#8E8E93]">
              Интерактивная топология: Организация ➔ Подразделения ➔ Сотрудники ➔ Активные задачи и сделки
            </p>
          </div>
        </div>

        {/* Workload Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A1A1AA]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Оптимальная нагрузка (0–2 задачи)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Повышенная (3–4 задачи)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>Перегрузка (5+ задач)</span>
          </span>
        </div>
      </div>

      {/* Level 1: Organization Root Node */}
      <div className="flex flex-col items-center">
        <div className="rounded-xl border border-emerald-500/40 bg-[#15151A] px-5 py-3 shadow-lg flex items-center gap-3">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-xs font-semibold text-white uppercase tracking-wider">
              {companyName}
            </div>
            <div className="text-[11px] text-[#8E8E93] tabular-nums">
              Подразделений: {effectiveDepts.length} · Штат: {nodes.length} · Активных задач: {openTasks.length}
            </div>
          </div>
        </div>

        <div className="w-px h-6 bg-[#2A2A32]" />
      </div>

      {/* Level 2 & 3 & 4: Departments -> Employees -> Linked Tasks & Deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {effectiveDepts.map((deptName) => {
          const deptEmployees = nodes.filter((n) => {
            const empDept =
              n.department && n.department.trim()
                ? n.department.trim()
                : 'Дирекция / Общий штат';
            return empDept.toLowerCase() === deptName.toLowerCase();
          });

          const deptUnassignedTasks = openTasks.filter(
            (t) =>
              !t.assigned_to &&
              t.department &&
              t.department.toLowerCase() === deptName.toLowerCase()
          );

          return (
            <div
              key={deptName}
              className="rounded-xl border border-white/[0.07] bg-[#141418] p-4 space-y-4"
            >
              {/* Department Header Node */}
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Подразделение: {deptName}
                  </h3>
                </div>
                <span className="text-[11px] tabular-nums text-[#8E8E93] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                  {deptEmployees.length} сотр.
                </span>
              </div>

              {/* Employees inside Department */}
              {deptEmployees.length === 0 ? (
                <div className="text-xs text-[#71717A] py-2">
                  В подразделении пока нет привязанных сотрудников.
                </div>
              ) : (
                <div className="space-y-3">
                  {deptEmployees.map((emp) => {
                    const empTasks = openTasks.filter(
                      (t) => t.assigned_to === emp.id || t.owner_node_id === emp.id
                    );
                    const empDeals = activeLeads.filter(
                      (l) => l.assigned_to === emp.id || l.owner_node_id === emp.id
                    );

                    const loadCount = empTasks.length;
                    const loadBadgeClass =
                      loadCount >= 5
                        ? 'bg-red-500/15 text-red-300 border-red-500/35'
                        : loadCount >= 3
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';

                    return (
                      <div
                        key={emp.id}
                        className="rounded-lg border border-white/[0.07] bg-[#18181E] p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              name={emp.name}
                              avatarUrl={emp.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {emp.name}
                              </div>
                              <div className="text-[11px] text-[#8E8E93] truncate">
                                {emp.role_type}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap tabular-nums ${loadBadgeClass}`}
                          >
                            Задач: {loadCount}
                          </span>
                        </div>

                        {/* Linked Active Tasks & Deals */}
                        {(empTasks.length > 0 || empDeals.length > 0) && (
                          <div className="pl-3 border-l-2 border-[#2C2C36] space-y-1.5">
                            {empTasks.slice(0, 4).map((tItem) => (
                              <button
                                key={tItem.id}
                                type="button"
                                onClick={() => onSelectTask && onSelectTask(tItem.id)}
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[#121216] hover:bg-[#1F1F26] border border-white/[0.06] text-left transition-colors"
                              >
                                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-200 truncate">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="truncate">{tItem.title}</span>
                                </span>
                                {tItem.priority === 'High' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-red-400 font-medium shrink-0">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>{t('priority.High')}</span>
                                  </span>
                                )}
                              </button>
                            ))}

                            {empDeals.slice(0, 3).map((dItem) => (
                              <button
                                key={dItem.id}
                                type="button"
                                onClick={() => onSelectLead && onSelectLead(dItem.id)}
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[#121216] hover:bg-[#1F1F26] border border-white/[0.06] text-left transition-colors"
                              >
                                <span className="inline-flex items-center gap-1.5 text-xs text-amber-200 truncate">
                                  <Briefcase className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="truncate">
                                    {dItem.client_name || dItem.title}
                                  </span>
                                </span>
                                <span className="text-[10px] tabular-nums text-emerald-400 shrink-0">
                                  {formatMoney(Number(dItem.amount ?? dItem.deal_value ?? 0))}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Department-level unassigned tasks */}
              {deptUnassignedTasks.length > 0 && (
                <div className="pt-2 border-t border-white/[0.07] space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] tabular-nums">
                    Общие поручения на отдел ({deptUnassignedTasks.length})
                  </div>
                  {deptUnassignedTasks.map((tItem) => (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={() => onSelectTask && onSelectTask(tItem.id)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[#121216] hover:bg-[#1F1F26] border border-white/[0.06] text-left text-xs text-white"
                    >
                      <span className="truncate">{tItem.title}</span>
                      <span className="text-[10px] text-[#8E8E93]">
                        {t(`priority.${tItem.priority}` as any)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
