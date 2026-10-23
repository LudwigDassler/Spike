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

const getEnvVar = (viteKey: string, nextKey: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = (import.meta.env as Record<string, string | undefined>)[viteKey] ||
      (import.meta.env as Record<string, string | undefined>)[nextKey];
    if (val) return val;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[nextKey] || process.env[viteKey] || '';
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

/**
 * Инициализированный клиент @supabase/supabase-js.
 * Если переменные окружения ещё не заданы, возвращает null для безопасного демо-режима.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
