import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Централизованный серверный клиент Supabase с обходом RLS (Admin Bypass).
 * ВАЖНО: Для гарантированного обхода политик Row Level Security (RLS) на этапе MVP
 * в продакшене (Vercel) обязательно задайте переменную SUPABASE_SERVICE_ROLE_KEY.
 * При отсутствии SUPABASE_SERVICE_ROLE_KEY используется фоллбэк на NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const env =
    typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);

  const supabaseUrl =
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    '';

  // ВАЖНО: SUPABASE_SERVICE_ROLE_KEY необходим для полного обхода RLS (Row Level Security) на сервере.
  // Если ключ Service Role не задан, откатываемся на ANON_KEY.
  const supabaseKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Не заданы переменные окружения Supabase (NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Прокси-экземпляр supabaseAdmin для удобного импорта `import { supabaseAdmin } from '@/lib/supabase/admin'`.
 * Инициализация происходит лениво при первом вызове метода (.from(), .rpc() и т.д.),
 * чтобы избежать падения модуля при сборке Next.js до загрузки runtime-переменных.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
