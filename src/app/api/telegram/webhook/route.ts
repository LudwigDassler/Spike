export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '../../../../lib/supabase/admin';

async function sendMessage(chatId: number | string, text: string, webAppUrl?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn('[Telegram Webhook] Пропуск sendMessage: отсутствует TELEGRAM_BOT_TOKEN или chatId');
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
            text: '🚀 Открыть TedCloud Mini App',
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
  } catch (fetchError) {
    console.error('[Telegram Webhook] Ошибка отправки сообщения в Telegram:', fetchError);
  }
}

export async function POST(req: Request) {
  let chatId: number | string | undefined;

  try {
    const body = await req.json();
    const message = body?.message || body?.edited_message;
    chatId = message?.chat?.id;
    const rawText: string = typeof message?.text === 'string' ? message.text.trim() : '';

    if (!chatId) {
      return new Response('OK', { status: 200 });
    }

    const chatIdStr = String(chatId);
    const firstName = message?.from?.first_name || message?.chat?.first_name || 'Владелец';
    const lastName = message?.from?.last_name || message?.chat?.last_name || '';
    const username = message?.from?.username || message?.chat?.username || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || username || 'Owner';

    const supabaseAdmin = getSupabaseAdmin();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';

    // 1. Ищем пользователя в таблице organization_nodes по telegram_chat_id
    const { data: existingNode, error: selectError } = await supabaseAdmin
      .from('organization_nodes')
      .select('id, company_id, name, role_type')
      .eq('telegram_chat_id', chatIdStr)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Ошибка поиска пользователя в organization_nodes: ${selectError.message}`);
    }

    // 2. Обработка команды /start (с авторегистрацией Владельца, если его нет в БД)
    if (rawText === '/start' || rawText.startsWith('/start ')) {
      if (!existingNode) {
        // 2.1. Создаём компанию в таблице companies
        const companyName = `${fullName} Workspace`;
        const { data: createdCompany, error: companyError } = await supabaseAdmin
          .from('companies')
          .insert({ name: companyName })
          .select('id, name')
          .single();

        if (companyError || !createdCompany) {
          throw new Error(
            `Не удалось создать компанию в таблице companies: ${companyError?.message || 'Нет данных'}`
          );
        }

        // 2.2. Создаём запись Владельца (Owner) в таблице organization_nodes
        const safePathId = chatIdStr.replace(/[^a-zA-Z0-9_]/g, '') || Date.now().toString();
        let { data: createdNode, error: nodeError } = await supabaseAdmin
          .from('organization_nodes')
          .insert({
            company_id: createdCompany.id,
            name: fullName,
            telegram_chat_id: chatIdStr,
            role_type: 'Owner',
            tree_path: `tedcloud.owner_${safePathId}`,
          })
          .select('id, company_id, name, role_type')
          .single();

        // Фоллбэк, если в таблице organization_nodes нет колонки tree_path
        if (nodeError && nodeError.message?.includes('tree_path')) {
          const retryNode = await supabaseAdmin
            .from('organization_nodes')
            .insert({
              company_id: createdCompany.id,
              name: fullName,
              telegram_chat_id: chatIdStr,
              role_type: 'Owner',
            })
            .select('id, company_id, name, role_type')
            .single();

          createdNode = retryNode.data;
          nodeError = retryNode.error;
        }

        if (nodeError || !createdNode) {
          throw new Error(
            `Не удалось создать профиль Владельца в organization_nodes: ${
              nodeError?.message || 'Нет данных'
            }`
          );
        }

        await sendMessage(
          chatId,
          `🎉 Вы успешно зарегистрированы как Владелец (Owner)!\n🏢 Компания: ${createdCompany.name}\n🆔 Ваш Telegram ID: ${chatIdStr}\n\nОтправьте любое текстовое сообщение, чтобы мгновенно создать задачу в БД.`,
          siteUrl || undefined
        );
        return new Response('OK', { status: 200 });
      }

      await sendMessage(
        chatId,
        `👋 С возвращением, ${existingNode.name} (${existingNode.role_type})!\n🆔 Ваш Telegram ID: ${chatIdStr}\n\nНапишите любой текст, чтобы поставить новую задачу в вашу компанию.`,
        siteUrl || undefined
      );
      return new Response('OK', { status: 200 });
    }

    // 3. Если пользователь не найден и написал не /start — предлагаем пройти авторегистрацию через /start
    if (!existingNode) {
      await sendMessage(
        chatId,
        `⚠️ Ваш Telegram ID (${chatIdStr}) ещё не зарегистрирован в системе.\nНажмите /start для автоматического создания компании и профиля Владельца.`
      );
      return new Response('OK', { status: 200 });
    }

    // 4. Если пришёл обычный текст — создаём задачу в таблице tasks через админский клиент
    if (rawText) {
      const { data: createdTask, error: taskError } = await supabaseAdmin
        .from('tasks')
        .insert({
          company_id: existingNode.company_id,
          title: rawText,
          priority: 'medium',
          status: 'new',
          type: 'client',
          created_by: existingNode.id,
          assigned_to: existingNode.id,
        })
        .select('id, title')
        .single();

      if (taskError || !createdTask) {
        throw new Error(`Ошибка создания задачи в tasks: ${taskError?.message || 'Нет данных'}`);
      }

      await sendMessage(
        chatId,
        `✅ Задача сохранена в БД!\n📌 «${createdTask.title}»\n🆔 ID задачи: ${createdTask.id}`
      );
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('[Telegram Webhook] Fatal Error:', error);
    if (chatId) {
      await sendMessage(
        chatId,
        '❌ Системный сбой: ' + (error?.message || String(error))
      );
    }
    return new Response('OK', { status: 200 });
  }
}
