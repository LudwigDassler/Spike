'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ShieldAlert } from 'lucide-react';
import { OrganizationNodeRecord, supabase as defaultSupabaseClient } from '../lib/supabaseClient';
import { useCurrentRole } from '../context/RoleContext';
import { UserRole } from '../types/saas';

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebAppInstance {
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready?: () => void;
  expand?: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppInstance;
    };
  }
}

export interface TelegramAuthContextValue {
  userId: string;
  userName: string;
  role: UserRole;
  role_type: UserRole;
  telegramId: string | null;
  userNode: OrganizationNodeRecord;
  telegramUser: TelegramWebAppUser | null;
  startAppTaskId: string | null;
  isLoading: boolean;
  isUnauthorized: boolean;
  setRoleType: (role: UserRole) => void;
  clearStartAppTask: () => void;
}

const DEFAULT_PARTNER_NODE: OrganizationNodeRecord = {
  id: 'partner-4',
  name: 'Артём Громов',
  role_type: 'NETWORK_PARTNER',
  tree_path: 'tedcloud.network.p_101.p_104',
  telegram_chat_id: null,
  kpi_value: 13445,
};

const TelegramAuthContext = createContext<TelegramAuthContextValue | undefined>(undefined);

/**
 * Шаг 2: Провайдер бесшовной авторизации (Zero-Password Auth) для Telegram Mini App.
 * - Вызывает `Telegram.WebApp.expand()` при монтировании.
 * - Читает `window.Telegram.WebApp.initDataUnsafe.user.id`.
 * - Проверяет пользователя в таблице `organization_nodes` по `telegram_chat_id`.
 * - Если пользователя нет в БД — рендерит экран блокировки:
 *   "Доступ закрыт. Ваш ID: {id}. Передайте его администратору."
 */
export const TelegramAuthProvider: React.FC<{
  children: React.ReactNode;
  supabaseClient?: Pick<SupabaseClient, 'from'> | null;
}> = ({ children, supabaseClient }) => {
  const { currentRole, setCurrentRole } = useCurrentRole();
  const [userNode, setUserNode] = useState<OrganizationNodeRecord>(DEFAULT_PARTNER_NODE);
  const [telegramUser, setTelegramUser] = useState<TelegramWebAppUser | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [startAppTaskId, setStartAppTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function authorizeTelegramUser() {
      try {
        const tgWebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

        // 1. Разворачиваем приложение на весь экран телефона
        tgWebApp?.ready?.();
        tgWebApp?.expand?.();

        // 2. Считываем Deep Link параметр (?startapp=taskId)
        const searchParams =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : new URLSearchParams();
        const deepLinkParam =
          tgWebApp?.initDataUnsafe?.start_param?.trim() ||
          searchParams.get('startapp')?.trim() ||
          searchParams.get('tgWebAppStartParam')?.trim() ||
          null;

        if (deepLinkParam && isMounted) {
          setStartAppTaskId(deepLinkParam);
        }

        // 3. Получаем ID пользователя из Telegram WebApp
        const tgUser = tgWebApp?.initDataUnsafe?.user ?? null;
        const resolvedTgId = tgUser?.id ? String(tgUser.id) : null;

        if (tgUser && isMounted) {
          setTelegramUser(tgUser);
          setTelegramId(resolvedTgId);
        }

        const activeSupabase =
          supabaseClient !== undefined ? supabaseClient : defaultSupabaseClient;

        // 4. Запрашиваем данные сотрудника/партнёра в таблице organization_nodes
        if (resolvedTgId && activeSupabase) {
          const { data, error } = await activeSupabase
            .from('organization_nodes')
            .select('id, name, role_type, tree_path, telegram_chat_id, kpi_value')
            .eq('telegram_chat_id', resolvedTgId)
            .maybeSingle();

          if (error || !data) {
            if (isMounted) {
              setIsUnauthorized(true);
            }
            return;
          }

          if (isMounted) {
            const resolvedRole = (data.role_type as UserRole) || 'NETWORK_PARTNER';
            const nodeRecord: OrganizationNodeRecord = {
              id: String(data.id),
              name: String(data.name),
              role_type: resolvedRole,
              tree_path: String(data.tree_path || 'tedcloud'),
              telegram_chat_id: data.telegram_chat_id
                ? String(data.telegram_chat_id)
                : resolvedTgId,
              kpi_value: Number(data.kpi_value) || 0,
            };

            setUserNode(nodeRecord);
            setCurrentRole(resolvedRole);
            setIsUnauthorized(false);
          }
        }
      } catch {
        // В локальной веб-среде без подключения к Supabase используем демо-профиль
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void authorizeTelegramUser();

    return () => {
      isMounted = false;
    };
  }, [setCurrentRole, supabaseClient]);

  const setRoleType = (nextRole: UserRole) => {
    setCurrentRole(nextRole);
    setUserNode((prev) => ({
      ...prev,
      role_type: nextRole,
    }));
  };

  const value = useMemo<TelegramAuthContextValue>(
    () => ({
      userId: userNode.id,
      userName: userNode.name,
      role: currentRole,
      role_type: currentRole,
      telegramId,
      userNode: { ...userNode, role_type: currentRole },
      telegramUser,
      startAppTaskId,
      isLoading,
      isUnauthorized,
      setRoleType,
      clearStartAppTask: () => setStartAppTaskId(null),
    }),
    [userNode, currentRole, telegramId, telegramUser, startAppTaskId, isLoading, isUnauthorized]
  );

  // Если пользователь открыл Mini App, но его Telegram ID отсутствует в organization_nodes
  if (!isLoading && isUnauthorized) {
    return (
      <TelegramAuthContext.Provider value={value}>
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-700">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">TedCloud</h1>
            <p className="text-sm font-medium text-slate-700 leading-relaxed">
              Доступ закрыт. Ваш ID:{' '}
              <span className="font-mono font-bold text-slate-900">
                {telegramId ?? 'неизвестен'}
              </span>
              . Передайте его администратору.
            </p>
          </div>
        </div>
      </TelegramAuthContext.Provider>
    );
  }

  return (
    <TelegramAuthContext.Provider value={value}>
      {children}
    </TelegramAuthContext.Provider>
  );
};

export function useTelegramAuth(): TelegramAuthContextValue {
  const ctx = useContext(TelegramAuthContext);
  if (!ctx) {
    throw new Error('useTelegramAuth must be used within a TelegramAuthProvider');
  }
  return ctx;
}
