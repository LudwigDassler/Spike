import { useEffect, useState } from 'react';

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramWebAppBridge {
  ready?: () => void;
  expand?: () => void;
  isExpanded?: boolean;
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
}

export interface SupabaseLikeClient {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown | null }>;
    };
  };
}

export interface TelegramSyncResult {
  telegramChatId: string | null;
  telegramUsername: string | null;
  startAppTaskId: string | null;
  isExpanded: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

/**
 * Чистая функция извлечения Telegram User ID и startapp Deep Link параметра
 * из объекта window.Telegram.WebApp и URL query-строки.
 */
export function extractTelegramInitContext(win?: {
  location?: { search?: string };
  Telegram?: { WebApp?: TelegramWebAppBridge };
}): {
  telegramChatId: string | null;
  telegramUsername: string | null;
  startAppTaskId: string | null;
} {
  const tgWebApp = win?.Telegram?.WebApp;
  const rawUserId = tgWebApp?.initDataUnsafe?.user?.id;
  const telegramChatId =
    typeof rawUserId === 'number' || typeof rawUserId === 'string'
      ? String(rawUserId)
      : null;

  const telegramUsername = tgWebApp?.initDataUnsafe?.user?.username ?? null;

  // 1. Приоритетно читаем нативный start_param из Telegram Mini App initDataUnsafe
  const nativeStartParam = tgWebApp?.initDataUnsafe?.start_param?.trim();
  if (nativeStartParam) {
    return {
      telegramChatId,
      telegramUsername,
      startAppTaskId: nativeStartParam,
    };
  }

  // 2. Фолбэк для прямых ссылок WebApp (?startapp=task-101 или ?tgWebAppStartParam=task-101)
  const search = win?.location?.search || '';
  if (search) {
    const params = new URLSearchParams(search);
    const fromQuery =
      params.get('startapp')?.trim() ||
      params.get('tgWebAppStartParam')?.trim() ||
      null;
    return {
      telegramChatId,
      telegramUsername,
      startAppTaskId: fromQuery,
    };
  }

  return {
    telegramChatId,
    telegramUsername,
    startAppTaskId: null,
  };
}

/**
 * Шаг 2. React-хук синхронизации Telegram Mini App с таблицей `organization_nodes` (Supabase / API)
 * и перехвата Deep Link параметра `startapp={taskId}`.
 */
export function useTelegramSync(options?: {
  currentNodeId?: string;
  supabaseClient?: SupabaseLikeClient;
  onDeepLinkTaskDetected?: (taskId: string) => void;
}): TelegramSyncResult {
  const currentNodeId = options?.currentNodeId ?? 'partner-4';
  const [state, setState] = useState<TelegramSyncResult>({
    telegramChatId: null,
    telegramUsername: null,
    startAppTaskId: null,
    isExpanded: false,
    syncStatus: 'idle',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tgWebApp = (
      window as unknown as {
        Telegram?: { WebApp?: TelegramWebAppBridge };
      }
    ).Telegram?.WebApp;

    // 1. Визуальная обратная связь Telegram Mini App: сообщаем о готовности и разворачиваем на весь экран
    if (tgWebApp) {
      if (typeof tgWebApp.ready === 'function') {
        tgWebApp.ready();
      }
      if (typeof tgWebApp.expand === 'function') {
        tgWebApp.expand();
      }
    }

    const { telegramChatId, telegramUsername, startAppTaskId } =
      extractTelegramInitContext(
        window as unknown as {
          location?: { search?: string };
          Telegram?: { WebApp?: TelegramWebAppBridge };
        }
      );

    if (startAppTaskId && options?.onDeepLinkTaskDetected) {
      options.onDeepLinkTaskDetected(startAppTaskId);
    }

    setState((prev) => ({
      ...prev,
      telegramChatId,
      telegramUsername,
      startAppTaskId,
      isExpanded: Boolean(tgWebApp?.isExpanded ?? true),
      syncStatus: telegramChatId ? 'syncing' : 'idle',
    }));

    if (!telegramChatId) return;

    let cancelled = false;

    async function syncChatIdToDatabase(chatId: string) {
      try {
        // А. Если передан инстанс Supabase клиента — обновляем organization_nodes напрямую:
        if (options?.supabaseClient) {
          const { error } = await options.supabaseClient
            .from('organization_nodes')
            .update({
              telegram_chat_id: chatId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentNodeId);

          if (error) throw error;
        } else {
          // Б. Синхронизация через серверный Route Handler (/api/telegram/sync-node)
          await fetch('/api/telegram/sync-node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeId: currentNodeId,
              telegramChatId: chatId,
              telegramUsername,
            }),
          });
        }

        if (!cancelled) {
          setState((prev) => ({ ...prev, syncStatus: 'synced' }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, syncStatus: 'error' }));
        }
      }
    }

    syncChatIdToDatabase(telegramChatId);

    return () => {
      cancelled = true;
    };
  }, [currentNodeId]);

  return state;
}
