import { createClient } from '@supabase/supabase-js';

interface InlineButton {
  text: string;
  callback_data?: string;
  web_app?: { url: string };
}

async function callTelegramApi(
  method: string,
  payload: Record<string, unknown>
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[Telegram Webhook] Пропуск ${method}: не задан TELEGRAM_BOT_TOKEN`);
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[Telegram Webhook] Ошибка вызова ${method}:`, err);
  }
}

async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  inlineKeyboard?: InlineButton[][]
) {
  if (!chatId) return;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (inlineKeyboard && inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  }

  await callTelegramApi('sendMessage', payload);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, status: 'Telegram Webhook 2.0 active' });
  }

  let chatId: string | number | undefined;

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      '';

    // =========================================================================
    // 1. Обработка нажатий на Inline-кнопки (body.callback_query)
    // =========================================================================
    if (body.callback_query) {
      const cb = body.callback_query;
      const callbackId = cb.id;
      const callbackData: string = typeof cb.data === 'string' ? cb.data : '';
      const cbMessage = cb.message;
      chatId = cbMessage?.chat?.id || cb.from?.id;

      if (
        callbackData.startsWith('task_progress_') ||
        callbackData.startsWith('task_done_')
      ) {
        const isProgress = callbackData.startsWith('task_progress_');
        const taskId = isProgress
          ? callbackData.slice('task_progress_'.length)
          : callbackData.slice('task_done_'.length);
        const nextStatus = isProgress ? 'in_progress' : 'done';
        const statusLine = isProgress
          ? '🔄 Статус: В работе'
          : '✅ Статус: Выполнено';

        if (!supabaseUrl || !supabaseKey) {
          await callTelegramApi('answerCallbackQuery', {
            callback_query_id: callbackId,
            text: 'Ошибка: не настроены ключи Supabase на сервере',
            show_alert: true,
          });
          return res.status(200).json({ ok: true });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: updateError } = await supabase
          .from('tasks')
          .update({ status: nextStatus })
          .eq('id', taskId);

        if (updateError) {
          throw new Error(
            `Не удалось обновить статус задачи: ${updateError.message}`
          );
        }

        // 1.1. Всплывающее уведомление в Telegram
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackId,
          text: 'Статус обновлен!',
        });

        // 1.2. Редактирование исходного сообщения с добавлением строки статуса в конец
        if (cbMessage?.chat?.id && cbMessage?.message_id) {
          const originalText = String(cbMessage.text || '')
            .replace(/\n\n(🔄 Статус: В работе|✅ Статус: Выполнено)$/g, '')
            .trim();

          const updatedText = `${originalText}\n\n${statusLine}`;

          const updatedMarkup = isProgress
            ? {
                inline_keyboard: [
                  [
                    {
                      text: '✅ Выполнено',
                      callback_data: `task_done_${taskId}`,
                    },
                  ],
                ],
              }
            : { inline_keyboard: [] };

          await callTelegramApi('editMessageText', {
            chat_id: cbMessage.chat.id,
            message_id: cbMessage.message_id,
            text: updatedText,
            reply_markup: updatedMarkup,
          });
        }

        return res.status(200).json({ ok: true });
      }

      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackId,
      });
      return res.status(200).json({ ok: true });
    }

    // =========================================================================
    // 2. Обработка входящих текстовых сообщений и команд (/start, /tasks, /new, !текст)
    // =========================================================================
    const message = body.message || body.edited_message;
    chatId = message?.chat?.id;
    const rawText: string =
      typeof message?.text === 'string' ? message.text.trim() : '';

    if (!chatId) {
      return res.status(200).json({ ok: true });
    }

    const chatIdStr = String(chatId);
    const firstName =
      message?.from?.first_name || message?.chat?.first_name || 'Superadmin';
    const lastName = message?.from?.last_name || message?.chat?.last_name || '';
    const username = message?.from?.username || message?.chat?.username || '';
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      username ||
      'Superadmin';

    if (!supabaseUrl || !supabaseKey) {
      await sendTelegramMessage(
        chatId,
        '❌ Ошибка конфигурации: Не заданы переменные NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY на сервере Vercel.'
      );
      return res.status(200).json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Поиск пользователя по telegram_chat_id
    const { data: existingUser, error: userSelectError } = await supabase
      .from('organization_nodes')
      .select('*')
      .eq('telegram_chat_id', chatIdStr)
      .maybeSingle();

    if (userSelectError) {
      throw new Error(
        `Ошибка чтения organization_nodes: ${userSelectError.message}`
      );
    }

    const webAppButtonRow: InlineButton[][] | undefined = siteUrl
      ? [[{ text: '🚀 Открыть TedCloud Web App', web_app: { url: siteUrl } }]]
      : undefined;

    // 2.1. Команда /start: авто-создание компании и SUPERADMIN
    if (rawText === '/start' || rawText.startsWith('/start ')) {
      if (!existingUser) {
        let companyId: string | null = null;
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id, name')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingCompany?.id) {
          companyId = String(existingCompany.id);
        } else {
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert({ name: `${fullName} Organization` })
            .select('id, name')
            .single();

          if (companyError || !newCompany) {
            throw new Error(
              `Ошибка создания компании в companies: ${
                companyError?.message || 'Нет данных'
              }`
            );
          }
          companyId = String(newCompany.id);
        }

        const safePathId =
          chatIdStr.replace(/[^a-zA-Z0-9_]/g, '') || Date.now().toString();

        let { data: createdNode, error: insertNodeError } = await supabase
          .from('organization_nodes')
          .insert({
            company_id: companyId,
            name: fullName,
            telegram_chat_id: chatIdStr,
            role_type: 'SUPERADMIN',
            tree_path: `tedcloud.admin_${safePathId}`,
          })
          .select('*')
          .single();

        if (insertNodeError && insertNodeError.message?.includes('tree_path')) {
          const retryNoTree = await supabase
            .from('organization_nodes')
            .insert({
              company_id: companyId,
              name: fullName,
              telegram_chat_id: chatIdStr,
              role_type: 'SUPERADMIN',
            })
            .select('*')
            .single();
          createdNode = retryNoTree.data;
          insertNodeError = retryNoTree.error;
        }

        if (insertNodeError && insertNodeError.message?.includes('role_type')) {
          const retryOwner = await supabase
            .from('organization_nodes')
            .insert({
              company_id: companyId,
              name: fullName,
              telegram_chat_id: chatIdStr,
              role_type: 'Owner',
            })
            .select('*')
            .single();
          createdNode = retryOwner.data;
          insertNodeError = retryOwner.error;
        }

        if (insertNodeError || !createdNode) {
          throw new Error(
            `Ошибка регистрации пользователя в organization_nodes: ${
              insertNodeError?.message || 'Нет данных'
            }`
          );
        }

        await sendTelegramMessage(
          chatId,
          `🎉 Добро пожаловать в TedCloud, ${fullName}!\n✅ Ваш профиль активирован (Роль: ${createdNode.role_type}).\n🆔 Ваш Telegram ID: ${chatIdStr}\n\nДоступные возможности:\n• Отправьте любой текст для создания задачи\n• Начните текст с «!» (например: !Срочно оплатить счет) для задачи с высоким приоритетом\n• Отправьте /tasks для просмотра активных задач`,
          webAppButtonRow
        );
        return res.status(200).json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        `👋 С возвращением, ${existingUser.name} (${existingUser.role_type})!\n🆔 Ваш Telegram ID: ${chatIdStr}\n\n• Отправьте текст задачи (или !текст для высокого приоритета)\n• Команда /tasks — список открытых задач`,
        webAppButtonRow
      );
      return res.status(200).json({ ok: true });
    }

    // 2.2. Команда /help
    if (rawText === '/help') {
      await sendTelegramMessage(
        chatId,
        `📖 Команды TedCloud Bot 2.0:\n/start — Авторизация и вход в Web App\n/tasks — Список открытых задач с кнопками завершения\n/new <текст> — Создать новую задачу\n!<текст> — Быстрое создание срочной задачи (Приоритет: High)`,
        webAppButtonRow
      );
      return res.status(200).json({ ok: true });
    }

    // 2.3. Команда /tasks: вывод списка открытых задач с inline-кнопками [✅ Завершить]
    if (rawText === '/tasks' || rawText.startsWith('/tasks@')) {
      let query = supabase
        .from('tasks')
        .select('id, title, priority, status')
        .neq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(10);

      if (existingUser?.company_id) {
        query = query.eq('company_id', existingUser.company_id);
      }

      const { data: openTasks, error: tasksError } = await query;

      if (tasksError) {
        throw new Error(
          `Ошибка получения списка задач: ${tasksError.message}`
        );
      }

      if (!openTasks || openTasks.length === 0) {
        await sendTelegramMessage(
          chatId,
          '🎉 Все задачи выполнены! В вашем рабочем пространстве нет открытых задач.',
          webAppButtonRow
        );
        return res.status(200).json({ ok: true });
      }

      for (const task of openTasks) {
        const statusBadge =
          task.status === 'in_progress' ? '🔄 В работе' : '🆕 Новая';
        const prioBadge = task.priority || 'Medium';

        await sendTelegramMessage(
          chatId,
          `📌 ${task.title}\n⚡ Приоритет: ${prioBadge} · ${statusBadge}`,
          [
            [
              ...(task.status !== 'in_progress'
                ? [
                    {
                      text: '⚡️ В работу',
                      callback_data: `task_progress_${task.id}`,
                    },
                  ]
                : []),
              {
                text: '✅ Завершить',
                callback_data: `task_done_${task.id}`,
              },
            ],
          ]
        );
      }

      return res.status(200).json({ ok: true });
    }

    // 2.4. Авто-профиль, если пользователь сразу пишет задачу без предварительного /start
    let activeUser = existingUser;
    if (!activeUser) {
      const { data: firstCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle();

      let companyId = firstCompany?.id;
      if (!companyId) {
        const { data: createdComp } = await supabase
          .from('companies')
          .insert({ name: `${fullName} Organization` })
          .select('id')
          .single();
        companyId = createdComp?.id;
      }

      const { data: autoNode } = await supabase
        .from('organization_nodes')
        .insert({
          company_id: companyId,
          name: fullName,
          telegram_chat_id: chatIdStr,
          role_type: 'SUPERADMIN',
        })
        .select('*')
        .single();

      activeUser = autoNode || {
        id: null,
        company_id: companyId || null,
      };
    }

    // 2.5. Быстрое создание задач (с поддержкой префикса "!" для приоритета High)
    const strippedNewCommand = rawText.startsWith('/new')
      ? rawText.replace(/^\/new\s*/i, '').trim()
      : rawText;

    if (!strippedNewCommand) {
      await sendTelegramMessage(
        chatId,
        '✏️ Напишите текст задачи после команды /new или отправьте сообщение (начните с ! для высокого приоритета).'
      );
      return res.status(200).json({ ok: true });
    }

    const isUrgent = strippedNewCommand.startsWith('!');
    const cleanTitle = isUrgent
      ? strippedNewCommand.replace(/^!+\s*/, '').trim()
      : strippedNewCommand;
    const requestedPriority = isUrgent ? 'High' : 'Medium';

    if (!cleanTitle) {
      await sendTelegramMessage(
        chatId,
        '✏️ Укажите название задачи после восклицательного знака, например: !Срочно оплатить счет'
      );
      return res.status(200).json({ ok: true });
    }

    let { data: createdTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        company_id: activeUser.company_id,
        title: cleanTitle,
        priority: requestedPriority,
        status: 'new',
        assigned_to: activeUser.id || null,
      })
      .select('id, title, priority')
      .single();

    // Фоллбэк: если в БД стоит lowercase CHECK constraint ('high' / 'medium')
    if (taskError && taskError.message?.toLowerCase().includes('priority')) {
      const retryLower = await supabase
        .from('tasks')
        .insert({
          company_id: activeUser.company_id,
          title: cleanTitle,
          priority: requestedPriority.toLowerCase(),
          status: 'new',
          assigned_to: activeUser.id || null,
        })
        .select('id, title, priority')
        .single();

      createdTask = retryLower.data;
      taskError = retryLower.error;
    }

    if (taskError || !createdTask) {
      throw new Error(
        `Ошибка создания задачи в tasks: ${
          taskError?.message || 'Нет данных'
        }`
      );
    }

    await sendTelegramMessage(
      chatId,
      `✅ Задача создана!\n\n📌 ${createdTask.title}\n⚡ Приоритет: ${requestedPriority}`,
      [
        [
          {
            text: '✅ Отметить выполненной',
            callback_data: `task_done_${createdTask.id}`,
          },
        ],
      ]
    );

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook] Fatal Error:', error);
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        '❌ Ошибка бота: ' + (error?.message || String(error))
      );
    }
    return res.status(200).json({ ok: true });
  }
}
