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
import {
  convertLeadToPartner,
  getNextLeadStage,
  getNextTaskStatus,
  instantiatePlaybookTasks,
} from './utils/saasLogic';

const STORAGE_KEY_TASKS = 'partnerflow_tasks_v1';
const STORAGE_KEY_LEADS = 'partnerflow_leads_v1';
const STORAGE_KEY_PARTNERS = 'partnerflow_partners_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [activePreset, setActivePreset] = useState<WhiteLabelPreset>(
    WHITE_LABEL_PRESETS[0]
  );
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [leads, setLeads] = useState<CrmLead[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LEADS);
      return saved ? JSON.parse(saved) : INITIAL_CRM_LEADS;
    } catch {
      return INITIAL_CRM_LEADS;
    }
  });

  const [partners, setPartners] = useState<PartnerNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PARTNERS);
      return saved ? JSON.parse(saved) : INITIAL_PARTNERS;
    } catch {
      return INITIAL_PARTNERS;
    }
  });

  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [preselectedAssignee, setPreselectedAssignee] = useState<string | undefined>(
    undefined
  );
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch {
      // ignore storage errors
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    } catch {
      // ignore storage errors
    }
  }, [leads]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PARTNERS, JSON.stringify(partners));
    } catch {
      // ignore storage errors
    }
  }, [partners]);

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

  // Task Handlers
  const handleAdvanceTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextStatus = getNextTaskStatus(t.status);
        showNotice(`Статус задачи ${t.code} обновлён.`);
        return { ...t, status: nextStatus };
      })
    );
  };

  const handleChangeTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          ),
        };
      })
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showNotice('Задача перенесена в архив.');
  };

  const handleCreateTask = (newTaskData: Omit<TaskItem, 'id' | 'code' | 'status'>) => {
    const nextNum = 100 + tasks.length + 1;
    const newTask: TaskItem = {
      ...newTaskData,
      id: `task-custom-${Date.now()}`,
      code: `PF-${nextNum}`,
      status: 'todo',
    };
    setTasks((prev) => [newTask, ...prev]);
    setActiveTab('tasks');
    showNotice(`Создана задача ${newTask.code}: «${newTask.title}»`);
  };

  const handleDeployPlaybook = (playbook: PartnerPlaybook) => {
    const targetPartner = partners[partners.length - 1] || partners[0];
    const generated = instantiatePlaybookTasks(
      playbook,
      targetPartner ? targetPartner.name : 'Артём Громов',
      'Независимый Партнёр',
      tasks.length
    );
    setTasks((prev) => [...generated, ...prev]);
    setSelectedProject('all');
    setActiveTab('tasks');
    showNotice(
      `Развёрнут плейбук «${playbook.title}»: добавлено ${generated.length} задач (+${playbook.expectedPvGain} PV).`
    );
  };

  // CRM Handlers
  const handleAdvanceLeadStage = (leadId: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, stage: getNextLeadStage(l.stage) } : l
      )
    );
  };

  const handleConvertLeadToPartner = (lead: CrmLead) => {
    const { updatedLead, newPartner, onboardingTasks } = convertLeadToPartner(
      lead,
      partners.length,
      tasks.length
    );
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? updatedLead : l)));
    setPartners((prev) => [newPartner, ...prev]);
    setTasks((prev) => [...onboardingTasks, ...prev]);
    showNotice(
      `Клиент ${lead.name} переведён в статус Независимого Партнёра! Автоматически создано ${onboardingTasks.length} задачи онбординга.`
    );
  };

  const handleAddLead = (newLeadData: Omit<CrmLead, 'id' | 'lastActivity'>) => {
    const created: CrmLead = {
      ...newLeadData,
      id: `lead-${Date.now()}`,
      lastActivity: 'Только что · Карточка создана в CRM',
    };
    setLeads((prev) => [created, ...prev]);
    showNotice(`Клиент ${created.name} добавлен в CRM-воронку.`);
  };

  // Partner Network Handlers
  const handleAddPartnerVolume = (partnerId: string, addedPv: number) => {
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId ? { ...p, personalPv: p.personalPv + addedPv } : p
      )
    );
    showNotice(`Начислено +${addedPv} PV личного объёма партнёра.`);
  };

  const handleAdvanceOnboardingStep = (partnerId: string) => {
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId
          ? {
              ...p,
              onboardingCompletedSteps: Math.min(
                p.onboardingTotalSteps,
                p.onboardingCompletedSteps + 1
              ),
              status:
                p.onboardingCompletedSteps + 1 >= p.onboardingTotalSteps
                  ? 'active'
                  : p.status,
            }
          : p
      )
    );
  };

  const handleRegisterNewPartner = (
    name: string,
    city: string,
    uplineName: string
  ) => {
    const newPartner: PartnerNode = {
      id: `partner-${Date.now()}`,
      name,
      city,
      joinedDate: '2026-10-22',
      uplineName,
      personalPv: 100,
      groupPv: 0,
      targetPv: 500,
      activeClients: 1,
      onboardingCompletedSteps: 1,
      onboardingTotalSteps: 6,
      status: 'onboarding',
    };
    const starterTask: TaskItem = {
      id: `task-partner-init-${Date.now()}`,
      code: `PF-${100 + tasks.length + 1}`,
      title: `Стартовый онбординг 14 дней: ${name}`,
      description: `Ввод нового партнёра (${city}) в рабочий процесс: список 30 контактов и запуск первого марафона.`,
      status: 'todo',
      priority: 'high',
      project: 'Запуск партнёров',
      assigneeName: name,
      assigneeRole: 'Консультант (Новичок)',
      dueDate: '2026-10-28',
      pvImpact: 400,
      estimatedHours: 4,
      playbookSource: 'Авто-регистрация партнёра',
      subtasks: [
        {
          id: `st-reg-1-${Date.now()}`,
          title: 'Пройти инструктаж с наставником и настроить профиль',
          completed: true,
        },
        {
          id: `st-reg-2-${Date.now()}`,
          title: 'Добавить первых 10 кандидатов в CRM-воронку',
          completed: false,
        },
      ],
    };

    setPartners((prev) => [newPartner, ...prev]);
    setTasks((prev) => [starterTask, ...prev]);
    showNotice(
      `Партнёр ${name} подключён к ветке ${uplineName}. Выдана задача ${starterTask.code}.`
    );
  };

  const handleResetDemoData = () => {
    setTasks(INITIAL_TASKS);
    setLeads(INITIAL_CRM_LEADS);
    setPartners(INITIAL_PARTNERS);
    localStorage.removeItem(STORAGE_KEY_TASKS);
    localStorage.removeItem(STORAGE_KEY_LEADS);
    localStorage.removeItem(STORAGE_KEY_PARTNERS);
    showNotice('Демо-данные рабочего пространства восстановлены.');
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
