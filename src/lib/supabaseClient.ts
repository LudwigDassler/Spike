import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRole } from '../types/saas';

export interface OrganizationNodeRecord {
  id: string;
  name: string;
  role_type: UserRole;
  tree_path: string;
  telegram_chat_id: string | null;
  kpi_value: number;
  created_at?: string;
  updated_at?: string;
}

const supabaseUrl =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL)) ||
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL)) ||
  '';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY)) ||
  '';

/**
 * Клиентский экземпляр @supabase/supabase-js (использует публичный ключ).
 * Все критические чтения и записи выполняются через серверный шлюз `/api/db` с SUPABASE_SERVICE_ROLE_KEY.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
