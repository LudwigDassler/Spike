export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request): Promise<Response> {
  console.log('🚨 WEBHOOK TRIGGERED:', await request.clone().text());

  let chatId: number | string | undefined;

  async function sendTelegramMessage(
    targetChatId: number | string,
    text: string,
    inlineKeyboard?: Array<Array<Record<string, unknown>>>
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('❌ [Webhook Error]: TELEGRAM_BOT_TOKEN не задан в .env');
      return;
    }

    const payload: Record<string, unknown> = {
      chat_id: targetChatId,
      text,
    };

    if (inlineKeyboard) {
      payload.reply_markup = {
        inline_keyboard: inlineKeyboard,
      };
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const responseData = await response.text();
    console.log(
      `📤 [Telegram API Response status=${response.status}]:`,
      responseData
    );
  }

  try {
    const body = await request.json();
    const message = body?.message || body?.edited_message;
    chatId = message?.chat?.id;
    const text = String(message?.text || '').trim();

    if (!chatId) {
      console.log('ℹ️ [Webhook]: chat.id отсутствует в payload, завершаем.');
      return new Response('OK', { status: 200 });
    }

    const tgChatId = String(chatId);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'В переменных окружения Vercel отсутствует NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY (Service Role обязателен для обхода RLS на сервере).'
      );
    }

    // Инициализируем клиент с SUPABASE_SERVICE_ROLE_KEY для полного обхода RLS
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const webAppKeyboard = siteUrl
      ? [[{ text: '🚀 Открыть TedCloud', web_app: { url: siteUrl } }]]
      : undefined;

    // 1. Ищем пользователя в organization_nodes по telegram_chat_id
    const { data: existingUser, error: selectError } = await supabase
      .from('organization_nodes')
      .select('id, name, role_type, company_id')
      .eq('telegram_chat_id', tgChatId)
      .maybeSingle();

    if (selectError) {
      throw new Error(
        `Ошибка чтения organization_nodes: ${selectError.message} (code: ${selectError.code})`
      );
    }

    // 2. Если пользователь НЕ найден -> делаем реальный INSERT в organization_nodes
    if (!existingUser) {
      // Проверяем наличие компании или создаем новую для привязки company_id
      let companyId: string | null = null;

      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) {
        companyId = existingCompany.id;
      } else {
        const { data: createdCompany, error: companyInsertError } =
          await supabase
            .from('companies')
            .insert({ name: 'TedCloud Organization' })
            .select('id')
            .single();

        if (companyInsertError) {
          throw new Error(
            `Ошибка создания компании (companies): ${companyInsertError.message}`
          );
        }
        companyId = createdCompany.id;
      }

      const fullName =
        [message?.from?.first_name, message?.from?.last_name]
          .filter(Boolean)
          .join(' ') ||
        message?.chat?.first_name ||
        message?.from?.username ||
        `Сотрудник ${tgChatId}`;

      const safePathId = tgChatId.replace(/[^a-zA-Z0-9_]/g, '') || 'user';

      // Делаем INSERT новой записи в organization_nodes
      let { data: insertedNode, error: insertNodeError } = await supabase
        .from('organization_nodes')
        .insert({
          name: fullName,
          telegram_chat_id: tgChatId,
          role_type: 'SUPERADMIN',
          company_id: companyId,
          tree_path: `tedcloud.user_${safePathId}`,
        })
        .select('id, name, role_type')
        .single();

      // Фоллбэк, если в схеме таблицы нет колонки tree_path
      if (insertNodeError && insertNodeError.message.includes('tree_path')) {
        const retryRes = await supabase
          .from('organization_nodes')
          .insert({
            name: fullName,
            telegram_chat_id: tgChatId,
            role_type: 'SUPERADMIN',
            company_id: companyId,
          })
          .select('id, name, role_type')
          .single();

        insertedNode = retryRes.data;
        insertNodeError = retryRes.error;
      }

      if (insertNodeError || !insertedNode) {
        throw new Error(
          `Ошибка INSERT в organization_nodes: ${
            insertNodeError?.message || 'Запись не создана'
          }`
        );
      }

      await sendTelegramMessage(
        chatId,
        `✅ Регистрация успешно завершена!\n\nСотрудник: ${insertedNode.name}\nTelegram ID: ${tgChatId}\nРоль: ${insertedNode.role_type}`,
        webAppKeyboard
      );

      return new Response('OK', { status: 200 });
    }

    // 3. Если пользователь НАЙДЕН
    const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

    if (!text || command === '/start') {
      await sendTelegramMessage(
        chatId,
        `✅ Подтверждено! Вы авторизованы в TedCloud как «${existingUser.name}» (${existingUser.role_type}).`,
        webAppKeyboard
      );
      return new Response('OK', { status: 200 });
    }

    if (command === '/help') {
      await sendTelegramMessage(
        chatId,
        'Отправьте любое текстовое сообщение, чтобы мгновенно создать задачу в TedCloud.'
      );
      return new Response('OK', { status: 200 });
    }

    // Если пользователь отправил обычный текст — сохраняем задачу в tasks
    if (!text.startsWith('/')) {
      const { error: taskInsertError } = await supabase.from('tasks').insert({
        title: text,
        status: 'new',
        company_id: existingUser.company_id,
      });

      if (taskInsertError) {
        throw new Error(
          `Ошибка INSERT в tasks: ${taskInsertError.message} (code: ${taskInsertError.code})`
        );
      }

      await sendTelegramMessage(
        chatId,
        `✅ Задача сохранена в базе данных: «${text}»`
      );
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('💥 [Webhook Fatal Error]:', error);

    if (chatId) {
      try {
        await sendTelegramMessage(
          chatId,
          `❌ Ошибка базы данных / сервера:\n${error?.message || String(error)}`
        );
      } catch (notifyErr) {
        console.error('Не удалось отправить ошибку в Telegram:', notifyErr);
      }
    }

    return new Response('OK', { status: 200 });
  }
}
