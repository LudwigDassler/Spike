/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ActiveTab, TopBar } from './components/TopBar';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { TasksWorkspaceView } from './components/TasksWorkspaceView';
import { CrmPipelineView } from './components/CrmPipelineView';
import { PartnerNetworkView } from './components/PartnerNetworkView';
import { EnterpriseExitView } from './components/EnterpriseExitView';
import { CreateTaskModal } from './components/CreateTaskModal';
import {
  INITIAL_CRM_LEADS,
  INITIAL_PARTNERS,
  INITIAL_TASKS,
  PARTNER_PLAYBOOKS,
  WHITE_LABEL_PRESETS,
} from './data/seedData';
import {
  CrmLead,
  PartnerNode,
  PartnerPlaybook,
  TaskItem,
  TaskStatus,
  WhiteLabelPreset,
} from './types/saas';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [activePreset, setActivePreset] = useState<WhiteLabelPreset>(
    WHITE_LABEL_PRESETS[0]
  );
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [leads, setLeads] = useState<CrmLead[]>(INITIAL_CRM_LEADS);
  const [partners, setPartners] = useState<PartnerNode[]>(INITIAL_PARTNERS);

  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [preselectedAssignee, setPreselectedAssignee] = useState<string | undefined>(
    undefined
  );
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Первичная загрузка дерева задач, партнёров (ltree) и лидов с бэкенда
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspaceFromApi() {
      try {
        const res = await fetch('/api/workspace');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          if (Array.isArray(data.tasks)) setTasks(data.tasks);
          if (Array.isArray(data.partners)) setPartners(data.partners);
          if (Array.isArray(data.leads)) setLeads(data.leads);
        }
      } catch {
        // Fallback на предзагруженное состояние при оффлайне
      }
    }
    loadWorkspaceFromApi();
    return () => {
      isMounted = false;
    };
  }, []);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
  };

  const projectsList = Array.from(
    new Set([
      'Запуск партнёров',
      'Велнес-марафон',
      'Квалификация PV',
      'Клиентский сервис',
      'Корпоративный B2B',
      ...tasks.map((t) => t.project),
    ])
  );

  const totalBranchPv = partners.reduce(
    (sum, p) => sum + p.personalPv + p.groupPv,
    0
  );
  const completedTasksCount = tasks.filter((t) => t.status === 'done').length;

  // Шаг 4: Асинхронное создание задачи через HTTP POST /api/tasks вместо синхронного localStorage
  const handleCreateTask = async (
    newTaskData: Omit<TaskItem, 'id' | 'code' | 'status'>
  ) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTaskData,
          brandId: activePreset.id,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Не удалось сохранить задачу в БД');
      }

      const { task: createdTask } = (await response.json()) as { task: TaskItem };
      setTasks((prev) => [createdTask, ...prev]);
      setActiveTab('tasks');
      showNotice(`Создана задача ${createdTask.code}: «${createdTask.title}» (сохранено через API)`);
    } catch (error) {
      showNotice(`Ошибка сохранения задачи: ${(error as Error).message}`);
    }
  };

  const handleAdvanceTaskStatus = async (taskId: string) => {
    try {
      const target = tasks.find((t) => t.id === taskId);
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance' }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        if (target) showNotice(`Статус задачи ${target.code} обновлён.`);
      }
    } catch (error) {
      showNotice(`Ошибка обновления задачи: ${(error as Error).message}`);
    }
  };

  const handleChangeTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_status', status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_subtask', subtaskId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        showNotice('Задача перенесена в архив.');
      }
    } catch {
      // ignore
    }
  };

  const handleDeployPlaybook = async (playbook: PartnerPlaybook) => {
    try {
      const res = await fetch(`/api/playbooks/${playbook.id}/deploy`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setSelectedProject('all');
        setActiveTab('tasks');
        showNotice(
          `Развёрнут плейбук «${playbook.title}»: добавлено ${data.generated.length} задач (+${playbook.expectedPvGain} PV).`
        );
      }
    } catch (error) {
      showNotice(`Ошибка развёртывания плейбука: ${(error as Error).message}`);
    }
  };

  // CRM Handlers (через API)
  const handleAdvanceLeadStage = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/advance`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
      }
    } catch {
      // ignore
    }
  };

  const handleConvertLeadToPartner = async (lead: CrmLead) => {
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setPartners(data.partners);
        setTasks(data.tasks);
        showNotice(
          `Клиент ${lead.name} переведён в статус Независимого Партнёра (ltree: ${data.newPartner.hierarchyPath})! Создано ${data.onboardingTasks.length} задачи онбординга.`
        );
      }
    } catch (error) {
      showNotice(`Ошибка конверсии клиента: ${(error as Error).message}`);
    }
  };

  const handleAddLead = async (newLeadData: Omit<CrmLead, 'id' | 'lastActivity'>) => {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeadData),
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        showNotice(`Клиент ${data.lead.name} добавлен в CRM-воронку.`);
      }
    } catch {
      // ignore
    }
  };

  // Partner Network Handlers (через PostgreSQL ltree API)
  const handleAddPartnerVolume = async (partnerId: string, addedPv: number) => {
    try {
      const res = await fetch(`/api/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_pv', addedPv }),
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners);
        showNotice(`Начислено +${addedPv} PV личного объёма (групповой объём ветки пересчитан по ltree).`);
      }
    } catch {
      // ignore
    }
  };

  const handleAdvanceOnboardingStep = async (partnerId: string) => {
    try {
      const res = await fetch(`/api/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_onboarding' }),
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners);
      }
    } catch {
      // ignore
    }
  };

  const handleRegisterNewPartner = async (
    name: string,
    city: string,
    uplineName: string
  ) => {
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, uplineName }),
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners);
        setTasks(data.tasks);
        showNotice(
          `Партнёр ${name} подключён к ветке ${uplineName} (ltree: ${data.partner.hierarchyPath}). Выдана задача ${data.starterTask.code}.`
        );
      }
    } catch (error) {
      showNotice(`Ошибка регистрации партнёра: ${(error as Error).message}`);
    }
  };

  const handleResetDemoData = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setLeads(data.leads);
        setPartners(data.partners);
        showNotice('Демо-данные рабочего пространства восстановлены на сервере.');
      }
    } catch {
      // ignore
    }
  };

  return (
    <div id="workspace" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewTaskModal={() => {
          setPreselectedAssignee(undefined);
          setIsNewTaskModalOpen(true);
        }}
      />

      {/* Workspace Body: Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        <WorkspaceSidebar
          presets={WHITE_LABEL_PRESETS}
          activePreset={activePreset}
          onSelectPreset={(preset) => {
            setActivePreset(preset);
            showNotice(`Активирован отраслевой скин: ${preset.brandName}`);
          }}
          projects={projectsList}
          selectedProject={selectedProject}
          onSelectProject={(proj) => {
            setSelectedProject(proj);
            setActiveTab('tasks');
          }}
          playbooks={PARTNER_PLAYBOOKS}
          onDeployPlaybook={handleDeployPlaybook}
          totalBranchPv={totalBranchPv}
          completedTasksCount={completedTasksCount}
          totalTasksCount={tasks.length}
        />

        <main className="flex-1 p-6 lg:p-8 min-w-0">
          {/* Action Feedback Banner */}
          {statusNotice && (
            <div
              role="status"
              className="mb-5 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-4 text-xs font-medium text-emerald-900"
            >
              <span>{statusNotice}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 font-semibold shrink-0"
              >
                Скрыть
              </button>
            </div>
          )}

          {activeTab === 'tasks' && (
            <TasksWorkspaceView
              tasks={tasks}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              activePreset={activePreset}
              playbooks={PARTNER_PLAYBOOKS}
              onAdvanceStatus={handleAdvanceTaskStatus}
              onChangeStatus={handleChangeTaskStatus}
              onToggleSubtask={handleToggleSubtask}
              onDeleteTask={handleDeleteTask}
              onDeployPlaybook={handleDeployPlaybook}
              onOpenNewTaskModal={() => {
                setPreselectedAssignee(undefined);
                setIsNewTaskModalOpen(true);
              }}
            />
          )}

          {activeTab === 'crm' && (
            <CrmPipelineView
              leads={leads}
              partners={partners}
              activePreset={activePreset}
              onAdvanceLeadStage={handleAdvanceLeadStage}
              onConvertLeadToPartner={handleConvertLeadToPartner}
              onAddLead={handleAddLead}
            />
          )}

          {activeTab === 'partners' && (
            <PartnerNetworkView
              partners={partners}
              activePreset={activePreset}
              onAddPartnerVolume={handleAddPartnerVolume}
              onAdvanceOnboardingStep={handleAdvanceOnboardingStep}
              onRegisterNewPartner={handleRegisterNewPartner}
              onAssignTaskToPartner={(partnerName) => {
                setPreselectedAssignee(partnerName);
                setIsNewTaskModalOpen(true);
              }}
            />
          )}

          {activeTab === 'enterprise' && (
            <EnterpriseExitView
              presets={WHITE_LABEL_PRESETS}
              activePreset={activePreset}
              onSelectPreset={setActivePreset}
            />
          )}
        </main>
      </div>

      {/* Quiet Footer with Demo State Reset */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            ПартнёрФлоу — B2B2C SaaS-система управления задачами, клиентскими марафонами и онбордингом партнёрских сетей
          </div>
          <button
            type="button"
            onClick={handleResetDemoData}
            className="text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0"
          >
            Сбросить демо-данные к исходным
          </button>
        </div>
      </footer>

      {/* New Task Modal */}
      <CreateTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onCreateTask={handleCreateTask}
        partners={partners}
        projects={projectsList}
        preselectedAssignee={preselectedAssignee}
      />
    </div>
  );
}
