import {
  handleTelegramWebhookUpdate,
  TelegramWebhookUpdate,
} from '../../../../services/messengerService';

/**
 * Next.js App Router Route Handler: app/api/telegram/webhook/route.ts
 * Принимает входящие обновления (Update) от Telegram Bot API.
 * При получении команды `/start` отвечает стильным Markdown-приветствием TedCloud
 * и Inline-кнопкой "🚀 Открыть рабочее пространство" (Web App).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const update = (await request.json()) as TelegramWebhookUpdate;

    const result = await handleTelegramWebhookUpdate(update, {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      webAppUrl:
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.APP_URL ??
        'https://app.tedcloud.ru',
    });

    return Response.json({
      ok: true,
      handled: result.handled,
      command: result.command,
      chatId: result.chatId,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 200 } // Возвращаем 200 OK, чтобы Telegram не зацикливал повторную отправку при сетевых сбоях
    );
  }
}
