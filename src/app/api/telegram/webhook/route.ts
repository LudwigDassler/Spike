export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request): Promise<Response> {
  let chatId: number | string | undefined;

  const sendTg = async (msg: string): Promise<void> => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || !chatId) return;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
        }),
      });
    } catch (sendError) {
      console.error('SendTg Error:', sendError);
    }
  };

  try {
    const body = await req.json();
    chatId = body?.message?.chat?.id || body?.edited_message?.chat?.id;
    const text = body?.message?.text;

    if (!chatId) {
      return new Response('OK', { status: 200 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from('organization_nodes')
      .select('*')
      .limit(1);

    if (error) {
      await sendTg('❌ Ошибка БД: ' + JSON.stringify(error));
      return new Response('OK', { status: 200 });
    }

    await sendTg(
      `✅ Подключение к БД успешно! Твой ID: ${chatId}${
        text ? ` | Текст: ${text}` : ''
      } | Записей в выборке: ${data ? data.length : 0}`
    );

    return new Response('OK', { status: 200 });
  } catch (e: any) {
    console.error('Fatal Webhook Error:', e);
    await sendTg('🔥 Фатальный краш: ' + (e?.message || String(e)));
    return new Response('OK', { status: 200 });
  }
}
