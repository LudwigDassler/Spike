import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  checkPostgresConnection,
  convertMemoryLeadToPartner,
  createPartnerWithLtreeInDb,
  createTaskInDb,
  getFullMemoryState,
  getTasksTreeFromDb,
  resetMemoryState,
  updateMemoryLeads,
  updateMemoryPartners,
  updateMemoryTasks,
} from './src/server/db';
import { PARTNER_PLAYBOOKS } from './src/data/seedData';
import {
  getNextLeadStage,
  getNextTaskStatus,
  instantiatePlaybookTasks,
} from './src/utils/saasLogic';
import { CrmLead, TaskStatus } from './src/types/saas';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  await checkPostgresConnection();

  // 1. Получение полного состояния рабочего пространства и статуса подключения БД
  app.get('/api/workspace', async (_req, res) => {
    try {
      const treeResult = await getTasksTreeFromDb();
      const state = getFullMemoryState();
      res.json({
        tasks: treeResult.tasks,
        partners: state.partners,
        leads: state.leads,
        engine: treeResult.engine,
        lastSqlSample: treeResult.sqlExecuted,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 2. Эндпоинт получения иерархического дерева задач (WITH RECURSIVE + JOIN partner_nodes ltree)
  app.get('/api/tasks/tree', async (req, res) => {
    try {
      const brandId = (req.query.brandId as string) || 'herbalife_wellness';
      const result = await getTasksTreeFromDb(brandId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 3. Эндпоинт создания новой задачи (асинхронная замена синхронного localStorage из App.tsx)
  app.post('/api/tasks', async (req, res) => {
    try {
      const { title, description, priority, project, assigneeName, assigneeRole, dueDate, pvImpact, estimatedHours, subtasks, parentTaskId } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'Название задачи обязательно' });
        return;
      }
      const createdTask = await createTaskInDb({
        title: title.trim(),
        description: description || '',
        priority: priority || 'high',
        project: project || 'Запуск партнёров',
        assigneeName: assigneeName || 'Алина Соколова',
        assigneeRole: assigneeRole || 'Независимый Партнёр',
        dueDate: dueDate || '2026-10-29',
        pvImpact: Number(pvImpact) || 0,
        estimatedHours: Number(estimatedHours) || 3,
        subtasks: Array.isArray(subtasks) ? subtasks : [],
        parentTaskId: parentTaskId || null,
      });
      res.status(201).json({ task: createdTask });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 4. Продвижение или смена статуса задачи / переключение подзадачи чек-листа
  app.patch('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { action, status, subtaskId } = req.body;

    const updatedTasks = updateMemoryTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (action === 'advance') {
          return { ...t, status: getNextTaskStatus(t.status) };
        }
        if (action === 'set_status' && status) {
          return { ...t, status: status as TaskStatus };
        }
        if (action === 'toggle_subtask' && subtaskId) {
          return {
            ...t,
            subtasks: t.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st
            ),
          };
        }
        return t;
      })
    );

    const updated = updatedTasks.find((t) => t.id === id);
    res.json({ task: updated, tasks: updatedTasks });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const tasks = updateMemoryTasks((prev) => prev.filter((t) => t.id !== id));
    res.json({ tasks });
  });

  // 5. Развёртывание плейбука партнёра
  app.post('/api/playbooks/:id/deploy', (req, res) => {
    const playbook = PARTNER_PLAYBOOKS.find((p) => p.id === req.params.id);
    if (!playbook) {
      res.status(404).json({ error: 'Плейбук не найден' });
      return;
    }
    const state = getFullMemoryState();
    const targetPartner = state.partners[state.partners.length - 1] || state.partners[0];
    const generated = instantiatePlaybookTasks(
      playbook,
      targetPartner ? targetPartner.name : 'Артём Громов',
      'Независимый Партнёр',
      state.tasks.length
    );
    const tasks = updateMemoryTasks((prev) => [...generated, ...prev]);
    res.status(201).json({ generated, tasks });
  });

  // 6. Эндпоинт создания нового партнёра с привязкой к наставнику через PostgreSQL ltree
  app.post('/api/partners', async (req, res) => {
    try {
      const { name, city, uplineName, uplineId } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'ФИО партнёра обязательно' });
        return;
      }
      const result = await createPartnerWithLtreeInDb({
        name: name.trim(),
        city: city || 'Москва',
        uplineName: uplineName || 'Алина Соколова',
        uplineId,
      });
      const state = getFullMemoryState();
      res.status(201).json({
        partner: result.partner,
        starterTask: result.starterTask,
        partners: state.partners,
        tasks: state.tasks,
        sqlExecuted: result.sqlExecuted,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 7. Обновление PV и шагов онбординга партнёра (с автоматическим пересчётом группового объёма по ltree)
  app.patch('/api/partners/:id', (req, res) => {
    const { id } = req.params;
    const { action, addedPv } = req.body;
    const partners = updateMemoryPartners((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (action === 'add_pv') {
          return { ...p, personalPv: p.personalPv + (Number(addedPv) || 150) };
        }
        if (action === 'advance_onboarding') {
          const nextSteps = Math.min(p.onboardingTotalSteps, p.onboardingCompletedSteps + 1);
          return {
            ...p,
            onboardingCompletedSteps: nextSteps,
            status: nextSteps >= p.onboardingTotalSteps ? 'active' : p.status,
          };
        }
        return p;
      })
    );
    res.json({ partners });
  });

  // 8. CRM-воронка: создание лида и конверсия в партнёра (с созданием узла ltree)
  app.post('/api/leads', (req, res) => {
    const { name, phone, city, stage, monthlyPv, dealValueRub, programName, mentorName } = req.body;
    const created: CrmLead = {
      id: `lead-${Date.now()}`,
      name,
      phone,
      city: city || 'Москва',
      stage: stage || 'consultation',
      monthlyPv: Number(monthlyPv) || 120,
      dealValueRub: Number(dealValueRub) || 14500,
      programName: programName || 'Марафон стройности 10д',
      mentorName: mentorName || 'Алина Соколова',
      lastActivity: 'Только что · Карточка сохранена через REST API',
    };
    const leads = updateMemoryLeads((prev) => [created, ...prev]);
    res.status(201).json({ lead: created, leads });
  });

  app.patch('/api/leads/:id/advance', (req, res) => {
    const { id } = req.params;
    const leads = updateMemoryLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, stage: getNextLeadStage(l.stage) } : l))
    );
    res.json({ leads });
  });

  app.post('/api/leads/:id/convert', (req, res) => {
    const result = convertMemoryLeadToPartner(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }
    const state = getFullMemoryState();
    res.json({
      ...result,
      leads: state.leads,
      partners: state.partners,
      tasks: state.tasks,
    });
  });

  app.post('/api/reset', (_req, res) => {
    const state = resetMemoryState();
    res.json(state);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PartnerFlow Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
