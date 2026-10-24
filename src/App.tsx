/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Layout } from './components/Layout';
import {
  TelegramAuthProvider,
  useTelegramAuth,
} from './components/TelegramAuthProvider';
import {
  Company,
  CrmLeadRecord,
  DashboardSection,
  LeadStage,
  OrganizationNode,
  TaskRecord,
} from './types/database';

function WorkspaceContent() {
  const { company: authCompany } = useTelegramAuth();

  const [company, setCompany] = useState<Company | null>(authCompany);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [leads, setLeads] = useState<CrmLeadRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeSection, setActiveSection] =
    useState<DashboardSection>('overview');
  const [createModalTarget, setCreateModalTarget] =
    useState<DashboardSection | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchDatabaseEntities = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/db', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || 'Не удалось загрузить данные из /api/db.'
        );
      }

      if (result.company) {
        setCompany(result.company as Company);
      }
      setNodes((result.nodes as OrganizationNode[]) || []);
      setLeads((result.leads as CrmLeadRecord[]) || []);
      setTasks((result.tasks as TaskRecord[]) || []);
    } catch (error) {
      setFeedbackBanner({
        type: 'error',
        text: `Ошибка загрузки данных: ${(error as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authCompany) {
      setCompany(authCompany);
    }
  }, [authCompany]);

  useEffect(() => {
    void fetchDatabaseEntities();
  }, [fetchDatabaseEntities]);

  const handleUpdateLeadStage = async (leadId: string, nextStage: LeadStage) => {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lead_stage',
          payload: { id: leadId, stage: nextStage },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка обновления стадии сделки');
      }

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: nextStage } : l))
      );
    } catch (error) {
      setFeedbackBanner({
        type: 'error',
        text: `Ошибка обновления стадии: ${(error as Error).message}`,
      });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_lead',
          payload: { id: leadId },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка удаления сделки');
      }

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    } catch (error) {
      setFeedbackBanner({
        type: 'error',
        text: `Ошибка удаления сделки: ${(error as Error).message}`,
      });
    }
  };

  const handleToggleTaskDone = async (task: TaskRecord) => {
    const nextStatus = task.status === 'done' ? 'new' : 'done';
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_task',
          payload: { id: task.id, status: nextStatus },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка обновления задачи');
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
    } catch (error) {
      setFeedbackBanner({
        type: 'error',
        text: `Ошибка обновления задачи: ${(error as Error).message}`,
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_task',
          payload: { id: taskId },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка удаления задачи');
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (error) {
      setFeedbackBanner({
        type: 'error',
        text: `Ошибка удаления задачи: ${(error as Error).message}`,
      });
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_node',
          payload: { id: nodeId },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка удаления сотрудника');
      }

      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    } catch (error) {
      setFeedbackBanner({
        type: 'error',
        text: `Ошибка удаления сотрудника: ${(error as Error).message}`,
      });
    }
  };

  return (
    <Layout
      company={company}
      nodes={nodes}
      leads={leads}
      tasks={tasks}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onOpenCreateModal={(target) =>
        setCreateModalTarget(target || activeSection || 'leads')
      }
    >
      <Dashboard
        company={company}
        nodes={nodes}
        leads={leads}
        tasks={tasks}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        createModalTarget={createModalTarget}
        onOpenCreateModal={(target) => setCreateModalTarget(target)}
        onCloseCreateModal={() => setCreateModalTarget(null)}
        onLeadCreated={(lead) => {
          setLeads((prev) => [lead, ...prev]);
          void fetchDatabaseEntities();
          setFeedbackBanner({
            type: 'success',
            text: 'Успешно: Сделка добавлена в БД',
          });
        }}
        onUpdateLeadStage={handleUpdateLeadStage}
        onDeleteLead={handleDeleteLead}
        onTaskCreated={(task) => {
          setTasks((prev) => [task, ...prev]);
          void fetchDatabaseEntities();
          setFeedbackBanner({
            type: 'success',
            text: 'Успешно: Задача добавлена в БД',
          });
        }}
        onToggleTaskDone={handleToggleTaskDone}
        onDeleteTask={handleDeleteTask}
        onEmployeeCreated={(employee) => {
          setNodes((prev) => [employee, ...prev]);
          void fetchDatabaseEntities();
          setFeedbackBanner({
            type: 'success',
            text: 'Успешно: Сотрудник добавлен в БД',
          });
        }}
        onDeleteNode={handleDeleteNode}
        isLoading={isLoading}
        feedbackBanner={feedbackBanner}
        onDismissFeedback={() => setFeedbackBanner(null)}
      />
    </Layout>
  );
}

export default function App() {
  return (
    <TelegramAuthProvider>
      <WorkspaceContent />
    </TelegramAuthProvider>
  );
}
