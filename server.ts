import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  addCopilotTaskComment,
  advanceCopilotJitStep,
  checkPostgresConnection,
  completeCopilotReorder,
  convertMemoryLeadToPartner,
  createPartnerWithLtreeInDb,
  createTaskInDb,
  getFullMemoryState,
  getTasksTreeFromDb,
  resetMemoryState,
  snoozeCopilotTask,
  triggerRefillEngineWorker,
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
        clientCycles: state.clientCycles,
        copilotTasks: state.copilotTasks,
        engine: treeResult.engine,
        lastSqlSample: treeResult.sqlExecuted,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 1.1. Предиктивный трекер (Refill Engine с idempotency_key)
  app.post('/api/refill-engine/run', (_req, res) => {
    const result = triggerRefillEngineWorker('2026-10-22');
    res.json(result);
  });

  // 1.2. Фокус-задача TMA: Клиент заказал (Продлить цикл +21 день и начислить PV)
  app.post('/api/copilot/tasks/:id/reorder', (req, res) => {
    const state = completeCopilotReorder(req.params.id);
    if (!state) {
      res.status(404).json({ error: 'Фокус-задача не найдена' });
      return;
    }
    res.json(state);
  });

  // 1.3. Фокус-задача TMA: Напомнить завтра (Snooze)
  app.post('/api/copilot/tasks/:id/snooze', (req, res) => {
    const state = snoozeCopilotTask(req.params.id);
    res.json(state);
  });

  // 1.4. Шаг 2: Just-in-Time Playbook State Machine (генерация строго 1 следующей задачи по графу JSONB)
  app.post('/api/copilot/tasks/:id/jit-advance', (req, res) => {
    const result = advanceCopilotJitStep(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Задача не найдена' });
      return;
    }
    res.json(result);
  });

  // 1.5. Шаг 4: Zero-Chat Архитектура (контекстные комментарии task_comments между наставником и новичком)
  app.post('/api/copilot/tasks/:id/comments', (req, res) => {
    const { body, authorPartnerId } = req.body;
    if (!body || typeof body !== 'string' || !body.trim()) {
      res.status(400).json({ error: 'Текст комментария обязателен' });
      return;
    }
    const state = addCopilotTaskComment(
      req.params.id,
      body.trim(),
      authorPartnerId || 'partner-4'
    );
    res.status(201).json(state);
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

  // 9. Zero-Chat CRM: Серверные эндпоинты оркестрации мессенджеров (Telegram Bot API & WhatsApp Cloud API)
  app.post('/api/messenger/telegram/notify', async (req, res) => {
    try {
      const { chatId, message, webAppUrl } = req.body;
      if (!chatId || !message || !webAppUrl) {
        res.status(400).json({ error: 'Параметры chatId, message и webAppUrl обязательны' });
        return;
      }
      const { sendTelegramNotification } = await import('./src/services/messengerService');
      const result = await sendTelegramNotification(chatId, message, webAppUrl);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/messenger/whatsapp/template', async (req, res) => {
    try {
      const { phone, templateName, variables } = req.body;
      if (!phone || !templateName) {
        res.status(400).json({ error: 'Параметры phone и templateName обязательны' });
        return;
      }
      const { sendWhatsAppTemplate } = await import('./src/services/messengerService');
      const result = await sendWhatsAppTemplate(
        phone,
        templateName,
        Array.isArray(variables) ? variables : []
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/messenger/telegram/invite', async (req, res) => {
    try {
      const { chatId, userId, mode } = req.body;
      if (!chatId || !userId) {
        res.status(400).json({ error: 'Параметры chatId и userId обязательны' });
        return;
      }
      const { inviteToTeamChat } = await import('./src/services/messengerService');
      const result = await inviteToTeamChat(
        process.env.TELEGRAM_BOT_TOKEN || '',
        chatId,
        userId,
        { mode }
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 10. Vercel Serverless Function Gateways (/api/db, /api/telegram/webhook, /api/telegram/setup)
  app.all('/api/db', async (req, res) => {
    const { default: dbHandler } = await import('./api/db');
    await dbHandler(req, res);
  });

  app.all('/api/telegram/setup', async (req, res) => {
    const { default: setupHandler } = await import('./api/telegram/setup');
    await setupHandler(req, res);
  });

  const telegramWebhookHandler: express.RequestHandler = async (req, res) => {
    const { default: webhookHandler } = await import('./api/telegram/webhook');
    await webhookHandler(req, res);
  };

  app.post('/api/telegram/webhook', telegramWebhookHandler);
  app.get('/api/telegram/webhook', telegramWebhookHandler);
  app.post('/api/webhook', telegramWebhookHandler);

  app.post('/api/telegram/sync-node', (req, res) => {
    const { nodeId, telegramChatId, telegramUsername } = req.body;
    if (!nodeId || !telegramChatId) {
      res.status(400).json({ error: 'Параметры nodeId и telegramChatId обязательны' });
      return;
    }
    res.json({
      ok: true,
      syncedNodeId: nodeId,
      telegram_chat_id: String(telegramChatId),
      telegram_username: telegramUsername || null,
      updatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/telegram/smart-push', async (req, res) => {
    try {
      const { chatId, message, taskId } = req.body;
      if (!chatId || !message) {
        res.status(400).json({ error: 'Параметры chatId и message обязательны' });
        return;
      }
      const { sendSmartPush } = await import('./src/services/messengerService');
      const result = await sendSmartPush(chatId, message, taskId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Вся обработка сообщений Telegram идет строго через серверный вебхук /api/telegram/webhook

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
    console.log(`TedCloud Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
