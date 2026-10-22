import {
  handleTelegramStartCommand,
  TelegramBotUpdate,
} from '../../../server/bot';

/**
 * Next.js App Router API Route: app/api/webhook/route.ts
 * Перехватывает команду `/start` от Telegram Bot API и отправляет приветствие:
 * "Добро пожаловать в TedCloud! Ваше рабочее пространство готово."
 * с прикреплённой InlineKeyboardMarkup кнопкой запуска Web App (`web_app: { url }`).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const update = (await request.json()) as TelegramBotUpdate;

    const result = await handleTelegramStartCommand(update, {
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
      { status: 200 }
    );
  }
}
