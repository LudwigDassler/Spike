import { createClient } from '@supabase/supabase-js';

async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  webAppUrl?: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn(
      '[Telegram Webhook] Пропуск отправки: не задан TELEGRAM_BOT_TOKEN или chatId'
    );
    return;
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (webAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть TedCloud Web App',
            web_app: { url: webAppUrl },
          },
        ],
      ],
    };
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[Telegram Webhook] Ошибка fetch к Telegram API:', err);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, status: 'Telegram webhook active' });
  }

  let chatId: string | number | undefined;

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

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

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

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

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      '';

    // 1. Поиск пользователя по telegram_chat_id (строка)
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

    // 2. Команда /start: авто-создание компании и SUPERADMIN, если пользователя еще нет
    if (rawText === '/start' || rawText.startsWith('/start ')) {
      if (!existingUser) {
        // Проверяем, есть ли уже компания в таблице companies, иначе создаём
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

        // Пытаемся вставить с ролью SUPERADMIN и tree_path
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

        // Фоллбэк 1: если в БД нет колонки tree_path
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

        // Фоллбэк 2: если в БД стоит CHECK constraint на role_type ('Owner' вместо 'SUPERADMIN')
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
          `🎉 Добро пожаловать в TedCloud, ${fullName}!\n✅ Ваш профиль зарегистрирован (Роль: ${createdNode.role_type}).\n🆔 Ваш Telegram ID: ${chatIdStr}\n\nОтправьте любое сообщение или команду /new <текст>, чтобы создать задачу.`,
          siteUrl || undefined
        );
        return res.status(200).json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        `👋 С возвращением, ${existingUser.name} (${existingUser.role_type})!\n🆔 Ваш Telegram ID: ${chatIdStr}\n\nОтправьте текст задачи в чат или откройте панель управления:`,
        siteUrl || undefined
      );
      return res.status(200).json({ ok: true });
    }

    // 3. Команда /help
    if (rawText === '/help') {
      await sendTelegramMessage(
        chatId,
        `📖 Команды TedCloud Bot:\n/start — Авторизация и вход в Web App\n/new <текст> — Создать новую задачу\nЛюбое текстовое сообщение — Мгновенное создание задачи в БД`,
        siteUrl || undefined
      );
      return res.status(200).json({ ok: true });
    }

    // 4. Если пользователя еще нет в БД (написал текст до /start) — регистрируем или просим /start
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

      const { data: autoNode, error: autoErr } = await supabase
        .from('organization_nodes')
        .insert({
          company_id: companyId,
          name: fullName,
          telegram_chat_id: chatIdStr,
          role_type: 'SUPERADMIN',
        })
        .select('*')
        .single();

      if (autoErr || !autoNode) {
        await sendTelegramMessage(
          chatId,
          `⚠️ Вы еще не зарегистрированы. Нажмите /start для автоматического создания профиля SUPERADMIN.`
        );
        return res.status(200).json({ ok: true });
      }
      activeUser = autoNode;
    }

    // 5. Создание задачи по команде /new или любому обычному тексту
    const taskTitle = rawText.startsWith('/new')
      ? rawText.replace(/^\/new\s*/i, '').trim()
      : rawText;

    if (!taskTitle) {
      await sendTelegramMessage(
        chatId,
        '✏️ Напишите текст задачи после команды /new или просто отправьте сообщение в чат.'
      );
      return res.status(200).json({ ok: true });
    }

    const { data: createdTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        company_id: activeUser.company_id,
        title: taskTitle,
        priority: 'medium',
        status: 'new',
        type: 'client',
        created_by: activeUser.id,
        assigned_to: activeUser.id,
      })
      .select('id, title')
      .single();

    if (taskError || !createdTask) {
      throw new Error(
        `Ошибка записи задачи в таблицу tasks: ${
          taskError?.message || 'Нет данных'
        }`
      );
    }

    await sendTelegramMessage(
      chatId,
      `✅ Задача сохранена в БД!\n📌 «${createdTask.title}»\n🆔 ID: ${createdTask.id}`,
      siteUrl || undefined
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
