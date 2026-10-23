import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request): Promise<Response> {
  let chatId: string | number | undefined;

  async function sendTgMessage(
    targetChatId: string | number,
    text: string,
    inlineKeyboard?: Array<Array<Record<string, unknown>>>
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const payload: Record<string, unknown> = {
      chat_id: targetChatId,
      text,
    };

    if (inlineKeyboard) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard,
      };
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  try {
    const body = await request.json();
    const message = body?.message;
    chatId = message?.chat?.id;
    const text = String(message?.text || '').trim();

    if (!chatId || !text) {
      return new Response('OK', { status: 200 });
    }

    // Принудительно приводим chatId к строке
    const tgId = String(chatId);

    // Инициализируем Supabase строго внутри блока try
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Отсутствуют переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Шаг 1: Проверка наличия пользователя в organization_nodes
    const { data: existingUser, error: selectError } = await supabase
      .from('organization_nodes')
      .select('id, company_id')
      .eq('telegram_chat_id', tgId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Ошибка поиска пользователя: ${selectError.message}`);
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const webAppKeyboard = siteUrl
      ? [[{ text: '🚀 Открыть TedCloud', web_app: { url: siteUrl } }]]
      : undefined;

    // Шаг 2: Маршрутизация и Авторегистрация
    if (!existingUser) {
      // Пользователь НЕ найден -> Авторегистрация первой компании и владельца (SUPERADMIN)
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: 'Моя Компания' })
        .select('id')
        .single();

      if (companyError || !newCompany) {
        throw new Error(
          `Ошибка создания компании: ${companyError?.message || 'не получен id'}`
        );
      }

      const fullName =
        [message?.from?.first_name, message?.from?.last_name]
          .filter(Boolean)
          .join(' ') ||
        message?.chat?.first_name ||
        'Владелец компании';

      const safePathSuffix = tgId.replace(/[^a-zA-Z0-9_]/g, '') || 'admin';

      // Вставка в organization_nodes со всеми обязательными полями схемы (включая tree_path)
      let { error: nodeError } = await supabase
        .from('organization_nodes')
        .insert({
          name: fullName,
          telegram_chat_id: tgId,
          company_id: newCompany.id,
          role_type: 'SUPERADMIN',
          tree_path: `tedcloud.owner_${safePathSuffix}`,
        });

      // Фоллбэк на случай облегченной таблицы без колонки tree_path
      if (nodeError && nodeError.message.includes('tree_path')) {
        const retryRes = await supabase.from('organization_nodes').insert({
          name: fullName,
          telegram_chat_id: tgId,
          company_id: newCompany.id,
          role_type: 'SUPERADMIN',
        });
        nodeError = retryRes.error;
      }

      if (nodeError) {
        throw new Error(`Ошибка создания профиля: ${nodeError.message}`);
      }

      await sendTgMessage(
        chatId,
        '🎉 Профиль создан! Вы зарегистрированы как Владелец компании. Теперь вы можете добавлять задачи.',
        webAppKeyboard
      );

      return new Response('OK', { status: 200 });
    }

    // Если пользователь НАЙДЕН в БД:
    const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

    if (command === '/start') {
      await sendTgMessage(
        chatId,
        'С возвращением в TedCloud! Рабочее пространство готово.',
        webAppKeyboard
      );
      return new Response('OK', { status: 200 });
    }

    if (command === '/help') {
      await sendTgMessage(
        chatId,
        'Для создания задачи просто напишите её суть текстом в этот чат, или используйте команду /new.'
      );
      return new Response('OK', { status: 200 });
    }

    if (command === '/new') {
      await sendTgMessage(
        chatId,
        'Напишите суть задачи следующим сообщением:'
      );
      return new Response('OK', { status: 200 });
    }

    // Обработка обычного текста (Создание задачи)
    if (!text.startsWith('/')) {
      const { error: taskError } = await supabase.from('tasks').insert({
        title: text,
        status: 'new',
        company_id: existingUser.company_id,
      });

      if (taskError) {
        throw new Error(`Ошибка создания задачи: ${taskError.message}`);
      }

      await sendTgMessage(chatId, '✅ Задача зафиксирована.');
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('[Telegram Webhook Critical Error]:', error);

    if (chatId) {
      try {
        await sendTgMessage(
          chatId,
          '❌ Системный сбой: ' + (error?.message || String(error))
        );
      } catch (sendError) {
        console.error('[Telegram Fail-Safe Send Error]:', sendError);
      }
    }

    return new Response('OK', { status: 200 });
  }
}
