export default async function handler(req: any, res: any) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    ).replace(/\/+$/, '');

    if (!token || !siteUrl) {
      return res.status(400).json({
        ok: false,
        error:
          'Не заданы переменные окружения TELEGRAM_BOT_TOKEN или NEXT_PUBLIC_SITE_URL.',
      });
    }

    const webhookUrl = `${siteUrl}/api/telegram/webhook`;
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(
        webhookUrl
      )}`
    );
    const data = await tgRes.json();

    return res.status(200).json({
      ok: Boolean(data.ok),
      webhookUrl,
      telegramResponse: data,
    });
  } catch (error: any) {
    console.error('[API /api/telegram/setup] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Ошибка при установке вебхука Telegram.',
    });
  }
}
