/**
 * Авто-регистрация Telegram Webhook (GET /api/telegram/setup)
 * Инициализирует вебхук бота одним переходом по ссылке в браузере.
 */

export interface SetupWebhookOptions {
  botToken?: string;
  siteUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function registerTelegramWebhook(
  options?: SetupWebhookOptions
): Promise<{
  ok: boolean;
  webhookUrl: string;
  telegramResponse: unknown;
}> {
  const botToken = options?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const rawSiteUrl =
    options?.siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    '';

  if (!botToken) {
    throw new Error('Переменная окружения TELEGRAM_BOT_TOKEN не задана.');
  }

  if (!rawSiteUrl) {
    throw new Error('Переменная окружения NEXT_PUBLIC_SITE_URL не задана.');
  }

  const normalizedSiteUrl = rawSiteUrl.replace(/\/$/, '');
  const webhookUrl = `${normalizedSiteUrl}/api/telegram/webhook`;
  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(
    webhookUrl
  )}`;

  const fetchFn = options?.fetchImpl ?? fetch;
  const response = await fetchFn(telegramApiUrl, {
    method: 'GET',
  });

  const telegramResponse = await response.json();

  return {
    ok: Boolean(
      response.ok &&
        typeof telegramResponse === 'object' &&
        telegramResponse !== null &&
        (telegramResponse as { ok?: boolean }).ok
    ),
    webhookUrl,
    telegramResponse,
  };
}

/**
 * Next.js App Router GET Route: app/api/telegram/setup/route.ts
 */
export async function GET(): Promise<Response> {
  try {
    const result = await registerTelegramWebhook();
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
