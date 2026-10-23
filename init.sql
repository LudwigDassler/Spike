-- =============================================================================
-- TedCloud B2B SaaS: Multi-Tenancy & Row Level Security (RLS) Migration
-- Безопасная миграция для существующей БД Supabase (PostgreSQL 15+ / ltree)
-- =============================================================================

BEGIN;

-- 1. Включаем необходимые расширения
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;

-- 2. Таблица компаний-арендаторов (Multi-Tenancy)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Создание таблиц (если не существуют) + идемпотентное добавление всех колонок в существующие таблицы
CREATE TABLE IF NOT EXISTS public.organization_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'NETWORK_PARTNER',
  tree_path public.ltree NOT NULL DEFAULT 'tedcloud'::public.ltree,
  telegram_chat_id TEXT UNIQUE,
  kpi_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Гарантируем наличие колонок в уже существующей таблице organization_nodes
ALTER TABLE public.organization_nodes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS role_type TEXT NOT NULL DEFAULT 'NETWORK_PARTNER';

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT 'Новый контакт из ТГ',
  phone TEXT,
  telegram_chat_id TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  description TEXT,
  deal_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Гарантируем наличие колонок в уже существующей таблице crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_node_id UUID REFERENCES public.organization_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'client',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES public.organization_nodes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.organization_nodes(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Гарантируем наличие колонки company_id в уже существующей таблице tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 4. Индексы производительности (GIST для ltree + B-Tree для Multi-Tenancy)
CREATE INDEX IF NOT EXISTS idx_org_nodes_tree_path_gist
  ON public.organization_nodes USING GIST (tree_path);

CREATE INDEX IF NOT EXISTS idx_org_nodes_company_id
  ON public.organization_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_org_nodes_telegram_chat_id
  ON public.organization_nodes (telegram_chat_id);

CREATE INDEX IF NOT EXISTS idx_crm_leads_company_id
  ON public.crm_leads (company_id);

CREATE INDEX IF NOT EXISTS idx_tasks_company_id
  ON public.tasks (company_id);

-- 5. Security-Definer функции для определения company_id текущего пользователя и прав SUPERADMIN
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.company_id
  FROM public.organization_nodes n
  WHERE n.id = auth.uid()
     OR n.auth_user_id = auth.uid()
     OR (
       n.telegram_chat_id IS NOT NULL
       AND n.telegram_chat_id = coalesce(
         current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_chat_id',
         ''
       )
     )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_nodes n
    WHERE (
      n.id = auth.uid()
      OR n.auth_user_id = auth.uid()
      OR (
        n.telegram_chat_id IS NOT NULL
        AND n.telegram_chat_id = coalesce(
          current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_chat_id',
          ''
        )
      )
    )
    AND n.role_type = 'SUPERADMIN'
  );
$$;

-- 6. Включаем Row Level Security (RLS) на всех таблицах
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 7. Политики RLS для таблицы companies
DROP POLICY IF EXISTS "companies_tenant_select" ON public.companies;
CREATE POLICY "companies_tenant_select"
  ON public.companies
  FOR SELECT
  USING (
    public.current_user_is_superadmin()
    OR id = public.current_user_company_id()
  );

DROP POLICY IF EXISTS "companies_superadmin_all" ON public.companies;
CREATE POLICY "companies_superadmin_all"
  ON public.companies
  FOR ALL
  USING (public.current_user_is_superadmin())
  WITH CHECK (public.current_user_is_superadmin());

-- 8. Политики RLS для таблицы organization_nodes (изоляция по company_id + доступ SUPERADMIN)
DROP POLICY IF EXISTS "org_nodes_tenant_isolation" ON public.organization_nodes;
CREATE POLICY "org_nodes_tenant_isolation"
  ON public.organization_nodes
  FOR SELECT
  USING (
    public.current_user_is_superadmin()
    OR company_id = public.current_user_company_id()
  );

DROP POLICY IF EXISTS "org_nodes_superadmin_manage" ON public.organization_nodes;
CREATE POLICY "org_nodes_superadmin_manage"
  ON public.organization_nodes
  FOR ALL
  USING (public.current_user_is_superadmin())
  WITH CHECK (public.current_user_is_superadmin());

-- 9. Политики RLS для таблицы crm_leads (изоляция по company_id + доступ SUPERADMIN)
DROP POLICY IF EXISTS "crm_leads_tenant_isolation" ON public.crm_leads;
CREATE POLICY "crm_leads_tenant_isolation"
  ON public.crm_leads
  FOR ALL
  USING (
    public.current_user_is_superadmin()
    OR company_id = public.current_user_company_id()
  )
  WITH CHECK (
    public.current_user_is_superadmin()
    OR company_id = public.current_user_company_id()
  );

-- 10. Политики RLS для таблицы tasks (изоляция по company_id + доступ SUPERADMIN)
DROP POLICY IF EXISTS "tasks_tenant_isolation" ON public.tasks;
CREATE POLICY "tasks_tenant_isolation"
  ON public.tasks
  FOR ALL
  USING (
    public.current_user_is_superadmin()
    OR company_id = public.current_user_company_id()
  )
  WITH CHECK (
    public.current_user_is_superadmin()
    OR company_id = public.current_user_company_id()
  );

COMMIT;
