'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ShieldAlert } from 'lucide-react';
import { supabase as defaultSupabaseClient } from '../lib/supabaseClient';
import { Company, OrganizationNode, OrganizationRoleType } from '../types/database';

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
  role: OrganizationRoleType;
  role_type: OrganizationRoleType;
  companyId: string | null;
  company: Company | null;
  telegramId: string | null;
  userNode: OrganizationNode;
  telegramUser: TelegramWebAppUser | null;
  startAppTaskId: string | null;
  isLoading: boolean;
  isUnauthorized: boolean;
  clearStartAppTask: () => void;
}

const DEFAULT_SYSTEM_NODE: OrganizationNode = {
  id: 'default-workspace-node',
  company_id: null,
  name: 'Администратор',
  role_type: 'SUPERADMIN',
  tree_path: 'tedcloud',
  telegram_chat_id: null,
  kpi_value: 0,
};

const TelegramAuthContext = createContext<TelegramAuthContextValue | undefined>(undefined);

/**
 * Провайдер бесшовной авторизации (Zero-Password Auth) для TedCloud.
 * Роль и компания пользователя определяются строго из БД Supabase (`organization_nodes` + `companies`).
 */
export const TelegramAuthProvider: React.FC<{
  children: React.ReactNode;
  supabaseClient?: Pick<SupabaseClient, 'from'> | null;
}> = ({ children, supabaseClient }) => {
  const [userNode, setUserNode] = useState<OrganizationNode>(DEFAULT_SYSTEM_NODE);
  const [company, setCompany] = useState<Company | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramWebAppUser | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [startAppTaskId, setStartAppTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function authorizeUser() {
      try {
        const tgWebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

        tgWebApp?.ready?.();
        tgWebApp?.expand?.();

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

        const tgUser = tgWebApp?.initDataUnsafe?.user ?? null;
        const resolvedTgId = tgUser?.id ? String(tgUser.id) : null;

        if (tgUser && isMounted) {
          setTelegramUser(tgUser);
          setTelegramId(resolvedTgId);
        }

        const activeSupabase =
          supabaseClient !== undefined ? supabaseClient : defaultSupabaseClient;

        if (resolvedTgId && activeSupabase) {
          const { data, error } = await activeSupabase
            .from('organization_nodes')
            .select(
              'id, company_id, name, role_type, tree_path, telegram_chat_id, kpi_value, companies(id, name, subscription_status, created_at)'
            )
            .eq('telegram_chat_id', resolvedTgId)
            .maybeSingle();

          if (error || !data) {
            if (isMounted) {
              setIsUnauthorized(true);
            }
            return;
          }

          if (isMounted) {
            const resolvedRole =
              (data.role_type as OrganizationRoleType) || 'NETWORK_PARTNER';
            const nodeRecord: OrganizationNode = {
              id: String(data.id),
              company_id: data.company_id ? String(data.company_id) : null,
              name: String(data.name),
              role_type: resolvedRole,
              tree_path: String(data.tree_path || 'tedcloud'),
              telegram_chat_id: data.telegram_chat_id
                ? String(data.telegram_chat_id)
                : resolvedTgId,
              kpi_value: Number(data.kpi_value) || 0,
            };

            const joinedCompanies = (
              data as { companies?: Company | Company[] | null }
            ).companies;
            const resolvedCompany = Array.isArray(joinedCompanies)
              ? joinedCompanies[0] ?? null
              : joinedCompanies ?? null;

            setUserNode(nodeRecord);
            setCompany(resolvedCompany);
            setIsUnauthorized(false);
          }
        }
      } catch {
        // Fallback в веб-режиме без Telegram WebApp
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void authorizeUser();

    return () => {
      isMounted = false;
    };
  }, [supabaseClient]);

  const value = useMemo<TelegramAuthContextValue>(
    () => ({
      userId: userNode.id,
      userName: userNode.name,
      role: userNode.role_type,
      role_type: userNode.role_type,
      companyId: userNode.company_id,
      company,
      telegramId,
      userNode,
      telegramUser,
      startAppTaskId,
      isLoading,
      isUnauthorized,
      clearStartAppTask: () => setStartAppTaskId(null),
    }),
    [userNode, company, telegramId, telegramUser, startAppTaskId, isLoading, isUnauthorized]
  );

  if (!isLoading && isUnauthorized) {
    return (
      <TelegramAuthContext.Provider value={value}>
        <div className="min-h-screen w-full font-sans flex items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              TedCloud
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Доступ закрыт. Ваш ID:{' '}
              <span className="font-semibold text-slate-900">
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
