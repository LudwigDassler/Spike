/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ActiveTab, TopBar } from './components/TopBar';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { TmaCopilotView } from './components/TmaCopilotView';
import { TasksWorkspaceView } from './components/TasksWorkspaceView';
import { CrmPipelineView } from './components/CrmPipelineView';
import { PartnerNetworkView } from './components/PartnerNetworkView';
import { EnterpriseExitView } from './components/EnterpriseExitView';
import { CreateTaskModal } from './components/CreateTaskModal';
import { CurrentRoleProvider } from './context/RoleContext';
import {
  INITIAL_CLIENT_CYCLES,
  INITIAL_CRM_LEADS,
  INITIAL_PARTNERS,
  INITIAL_TASKS,
  PARTNER_PLAYBOOKS,
  WHITE_LABEL_PRESETS,
} from './data/seedData';
import {
  ClientCycleItem,
  CrmLead,
  PartnerNode,
  PartnerPlaybook,
  SmartCopilotTask,
  TaskItem,
  TaskStatus,
  WhiteLabelPreset,
} from './types/saas';
import { runRefillEngineIdempotent } from './utils/saasLogic';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('copilot');
  const [activePreset, setActivePreset] = useState<WhiteLabelPreset>(
    WHITE_LABEL_PRESETS[0]
  );
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [leads, setLeads] = useState<CrmLead[]>(INITIAL_CRM_LEADS);
  const [partners, setPartners] = useState<PartnerNode[]>(INITIAL_PARTNERS);
  const [clientCycles, setClientCycles] = useState<ClientCycleItem[]>(
    INITIAL_CLIENT_CYCLES
  );
  const [copilotTasks, setCopilotTasks] = useState<SmartCopilotTask[]>(() =>
    runRefillEngineIdempotent(INITIAL_CLIENT_CYCLES, [], '2026-10-22').tasks
  );
  const [lastWorkerLog, setLastWorkerLog] = useState<string | null>(null);

  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [preselectedAssignee, setPreselectedAssignee] = useState<string | undefined>(
    undefined
  );
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

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
          if (Array.isArray(data.clientCycles)) setClientCycles(data.clientCycles);
          if (Array.isArray(data.copilotTasks)) setCopilotTasks(data.copilotTasks);
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
      'IT и инфраструктура',
      'Корпоративный B2B',
      ...tasks.map((t) => t.project),
    ])
  );

  const totalBranchPv = partners.reduce(
    (sum, p) => sum + p.personalPv + p.groupPv,
    0
  );
  const completedTasksCount = tasks.filter((t) => t.status === 'done').length;

  const handleRunRefillWorker = async () => {
    try {
      const res = await fetch('/api/refill-engine/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCopilotTasks(data.copilotTasks);
        setClientCycles(data.clientCycles);
        const logText = `Расписание сопровождения клиентов обновлено: добавлено новых задач — ${data.createdCount}.`;
        setLastWorkerLog(logText);
        showNotice(logText);
      }
    } catch (error) {
      showNotice(`Ошибка обновления расписания: ${(error as Error).message}`);
    }
  };

  const handleCopilotClientReordered = async (taskId: string) => {
    try {
      const target = copilotTasks.find((t) => t.id === taskId);
      const res = await fetch(`/api/copilot/tasks/${taskId}/reorder`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotTasks(data.copilotTasks);
        setClientCycles(data.clientCycles);
        setPartners(data.partners);
        if (target) {
          showNotice(
            `Программа «${target.productName}» для клиента ${target.clientFirstName} продлена на +${target.cycleDays} дн. Начислено +${target.pvImpact} PV.`
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCopilotSnoozeTask = async (taskId: string) => {
    try {
      const target = copilotTasks.find((t) => t.id === taskId);
      const res = await fetch(`/api/copilot/tasks/${taskId}/snooze`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotTasks(data.copilotTasks);
        if (target) {
          showNotice(
            `Напоминание для клиента ${target.clientFirstName} перенесено на завтра.`
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCopilotAdvanceJitStep = async (taskId: string) => {
    try {
      const res = await fetch(`/api/copilot/tasks/${taskId}/jit-advance`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotTasks(data.copilotTasks);
        setPartners(data.partners);
        if (data.nextTask) {
          showNotice(
            'Текущий этап сопровождения выполнен! Подготовлена следующая задача по клиенту.'
          );
        } else {
          showNotice('Цикл сопровождения клиента успешно завершён!');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleCopilotAddComment = async (
    taskId: string,
    body: string,
    authorPartnerId: string
  ) => {
    try {
      const res = await fetch(`/api/copilot/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, authorPartnerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotTasks(data.copilotTasks);
        showNotice('Комментарий добавлен к карточке.');
      }
    } catch {
      // ignore
    }
  };

  const handleCopilotSendTelegram = async (
    task: SmartCopilotTask,
    finalScript: string
  ) => {
    try {
      await navigator.clipboard.writeText(finalScript);
    } catch {
      // ignore clipboard errors
    }
    showNotice(
      `Скрипт сообщения для клиента ${task.clientFirstName} скопирован и открыт в мессенджере.`
    );
  };

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
        throw new Error(errBody.error || 'Не удалось сохранить карточку');
      }

      const { task: createdTask } = (await response.json()) as { task: TaskItem };
      const enrichedTask: TaskItem = {
        ...createdTask,
        task_class: newTaskData.task_class || 'client_action',
        targetDepartment: newTaskData.targetDepartment,
      };
      setTasks((prev) => [enrichedTask, ...prev]);
      setActiveTab('tasks');
      showNotice(
        enrichedTask.task_class === 'internal_ticket'
          ? `Тикет направлен в общую очередь отдела [${enrichedTask.targetDepartment}]: «${enrichedTask.title}»`
          : `Создана клиентская задача: «${enrichedTask.title}»`
      );
    } catch (error) {
      showNotice(`Ошибка сохранения: ${(error as Error).message}`);
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
        if (target) showNotice(`Статус карточки ${target.code} обновлён.`);
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
        showNotice('Карточка перенесена в архив.');
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
          `Развёрнут сценарий «${playbook.title}»: добавлено ${data.generated.length} задач (+${playbook.expectedPvGain} PV).`
        );
      }
    } catch (error) {
      showNotice(`Ошибка развёртывания сценария: ${(error as Error).message}`);
    }
  };

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
          `Клиент ${lead.name} переведён в статус Независимого Партнёра! Создано ${data.onboardingTasks.length} стартовые задачи.`
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
        showNotice(`Начислено +${addedPv} PV личного объёма (групповой объём ветки обновлён).`);
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
          `Партнёр ${name} подключён к команде наставника ${uplineName}. Назначен стартовый план.`
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
        setClientCycles(data.clientCycles);
        setCopilotTasks(data.copilotTasks);
        setLastWorkerLog(null);
        showNotice('Демо-данные рабочего пространства TedCloud восстановлены.');
      }
    } catch {
      // ignore
    }
  };

  return (
    <CurrentRoleProvider initialRole="SUPERADMIN">
      <div id="workspace" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {/* TopBar with TedCloud Wordmark & RoleContext Navigation */}
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
              showNotice(`Активирован отраслевой профиль: ${preset.brandName}`);
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
            {statusNotice && (
              <div
                role="status"
                className="mb-5 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-4 text-xs font-medium text-emerald-900"
              >
                <span>{statusNotice}</span>
                <button
                  type="button"
                  onClick={() => setStatusNotice(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-semibold shrink-0 cursor-pointer"
                >
                  Скрыть
                </button>
              </div>
            )}

            {activeTab === 'copilot' && (
              <TmaCopilotView
                copilotTasks={copilotTasks}
                clientCycles={clientCycles}
                activePreset={activePreset}
                onRunRefillWorker={handleRunRefillWorker}
                onClientReordered={handleCopilotClientReordered}
                onAdvanceJitStep={handleCopilotAdvanceJitStep}
                onSnoozeTask={handleCopilotSnoozeTask}
                onAddComment={handleCopilotAddComment}
                onSendTelegramTask={handleCopilotSendTelegram}
                onOpenNewTaskModal={() => {
                  setPreselectedAssignee(undefined);
                  setIsNewTaskModalOpen(true);
                }}
                lastWorkerLog={lastWorkerLog}
              />
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

        {/* Footer with TedCloud Branding */}
        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              TedCloud — Единая B2B2C SaaS-система управления клиентскими задачами, внутренними тикетами и партнёрской сетью
            </div>
            <button
              type="button"
              onClick={handleResetDemoData}
              className="text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Сбросить демо-данные к исходным
            </button>
          </div>
        </footer>

        {/* Modal for Creating Client Actions or Department Tickets */}
        <CreateTaskModal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          onCreateTask={handleCreateTask}
          partners={partners}
          projects={projectsList}
          preselectedAssignee={preselectedAssignee}
        />
      </div>
    </CurrentRoleProvider>
  );
}
