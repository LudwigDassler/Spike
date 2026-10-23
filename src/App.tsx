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
import { supabase } from './lib/supabaseClient';
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
    if (!supabase) return;
    setIsLoading(true);
    try {
      const [companiesRes, nodesRes, leadsRes, tasksRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, subscription_status, created_at')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('organization_nodes')
          .select(
            'id, company_id, name, role_type, tree_path, telegram_chat_id, kpi_value, created_at'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_leads')
          .select(
            'id, company_id, owner_node_id, full_name, phone, telegram_chat_id, stage, description, deal_value, created_at'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('tasks')
          .select(
            'id, company_id, type, title, status, priority, assigned_to, created_by, due_date, created_at'
          )
          .order('created_at', { ascending: false }),
      ]);

      if (!companiesRes.error && companiesRes.data?.[0]) {
        setCompany(companiesRes.data[0] as Company);
      }
      if (nodesRes.error) {
        throw new Error(
          `Ошибка чтения organization_nodes: ${nodesRes.error.message}`
        );
      }
      setNodes((nodesRes.data as OrganizationNode[]) || []);

      if (leadsRes.error) {
        throw new Error(`Ошибка чтения crm_leads: ${leadsRes.error.message}`);
      }
      setLeads((leadsRes.data as CrmLeadRecord[]) || []);

      if (tasksRes.error) {
        throw new Error(`Ошибка чтения tasks: ${tasksRes.error.message}`);
      }
      setTasks((tasksRes.data as TaskRecord[]) || []);
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
      if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
      }
      const { error } = await supabase
        .from('crm_leads')
        .update({ stage: nextStage })
        .eq('id', leadId);
      if (error) throw new Error(error.message);

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
      if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
      }
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadId);
      if (error) throw new Error(error.message);

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
      if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
      }
      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', task.id);
      if (error) throw new Error(error.message);

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
      if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
      }
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw new Error(error.message);

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
      if (!supabase) {
        throw new Error('Клиент Supabase не инициализирован.');
      }
      const { error } = await supabase
        .from('organization_nodes')
        .delete()
        .eq('id', nodeId);
      if (error) throw new Error(error.message);

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
            text: 'Успешно: Сотрудник добавлен в БД (organization_nodes)',
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
