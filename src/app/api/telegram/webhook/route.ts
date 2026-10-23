export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log("=== ВХОДЯЩИЙ ВЕБХУК ===");
  try {
    const body = await req.json();
    console.log("PAYLOAD:", JSON.stringify(body, null, 2));

    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id;

    if (!chatId) {
      console.log("Chat ID не найден в payload, безопасно завершаем.");
      return new Response('OK', { status: 200 });
    }

    console.log(`ID чата: ${chatId}. Пробуем отправить ответ...`);
    
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: "✅ Я жив! Vercel принял вебхук." })
    });

    const result = await response.json();
    console.log("ОТВЕТ TELEGRAM:", result);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error("=== ФАТАЛЬНАЯ ОШИБКА ===", error);
    return new Response('OK', { status: 200 });
  }
}
