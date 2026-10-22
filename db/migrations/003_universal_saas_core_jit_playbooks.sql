-- ============================================================================
-- Миграция 003: Универсальное ядро B2B2C Vertical SaaS (Франшизы, Агентства, MLM)
-- PostgreSQL + ltree + RLS (Privacy by Design) + Just-in-Time Playbooks (JSONB State Machine)
-- + Zero-Chat Архитектура (task_comments)
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- ============================================================================
-- ШАГ 1. УНИВЕРСАЛЬНАЯ БД + LTREE + RLS (PRIVACY BY DESIGN)
-- ============================================================================

-- 1.1. Узлы партнёрской сети (partner_nodes)
-- Универсальное поле kpi_value (PV в MLM, валовая комиссия в риэлторстве, выручка во франшизе)
-- и custom_data JSONB (квалификация, регион, грейд, атрибуты вертикали)
CREATE TABLE IF NOT EXISTS public.partner_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE, -- В Supabase: REFERENCES auth.users(id) ON DELETE CASCADE
    tenant_id UUID NOT NULL,
    upline_id UUID REFERENCES public.partner_nodes(id) ON DELETE SET NULL,
    hierarchy_path ltree NOT NULL, -- Например: 'root.u_101.u_205.u_309'
    full_name VARCHAR(255) NOT NULL,
    role_title VARCHAR(128) NOT NULL DEFAULT 'Партнёр',
    kpi_value INTEGER NOT NULL DEFAULT 0,          -- Личный универсальный KPI (PV / баллы / сделки)
    branch_kpi_value INTEGER NOT NULL DEFAULT 0,   -- Агрегированный KPI ветки
    custom_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_nodes_hierarchy_gist
    ON public.partner_nodes USING GIST (hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_partner_nodes_user_id
    ON public.partner_nodes (user_id);
CREATE INDEX IF NOT EXISTS idx_partner_nodes_custom_data_gin
    ON public.partner_nodes USING GIN (custom_data);

-- 1.2. Таблица воронки сделок/лидов (crm_leads) — видима наставнику по ветке БЕЗ телефонов
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    client_display_name VARCHAR(128) NOT NULL, -- Только имя для воронки (например: 'Екатерина М.')
    stage VARCHAR(64) NOT NULL DEFAULT 'qualification',
    kpi_value INTEGER NOT NULL DEFAULT 0,      -- Ожидаемый вклад сделки в KPI (PV / маржа / баллы)
    custom_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Продукт, день цикла, параметры объекта
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_stage
    ON public.crm_leads (owner_partner_id, stage);

-- 1.3. Изолированная таблица контактных данных и PII клиентов (crm_leads_pii)
-- Физическая защита от увода базы: наставник видит сделку в crm_leads, но НЕ имеет SELECT-доступа сюда
CREATE TABLE IF NOT EXISTS public.crm_leads_pii (
    lead_id UUID PRIMARY KEY REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    phone_e164 VARCHAR(32) NOT NULL,
    phone_masked VARCHAR(32) NOT NULL, -- '+7 *** ***-**-10'
    telegram_username VARCHAR(128),
    raw_pii_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_pii_owner
    ON public.crm_leads_pii (owner_partner_id);

-- ============================================================================
-- ШАГ 2. СТРУКТУРА УНИВЕРСАЛЬНЫХ PLAYBOOKS (JSONB STATE MACHINE, JUST-IN-TIME)
-- ============================================================================

-- 2.1. Шаблоны онбординга и ведения сделок (playbooks), где шаги хранятся в JSONB как граф (State Machine)
CREATE TABLE IF NOT EXISTS public.playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    initial_step_id VARCHAR(64) NOT NULL,
    -- Граф переходов состояний:
    -- {
    --   "step_1": { "title": "...", "script_template": "...", "kpi_value": 50, "transitions": { "success": "step_2", "retry": "step_1_followup" } },
    --   "step_2": { ... }
    -- }
    steps_graph JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2. Активные сессии прохождения плейбука конкретным партнёром/лидом (playbook_runs)
CREATE TABLE IF NOT EXISTS public.playbook_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    current_step_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    state_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4. Универсальная таблица задач (tasks) — генерируется по 1 задаче Just-in-Time
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    playbook_run_id UUID REFERENCES public.playbook_runs(id) ON DELETE SET NULL,
    playbook_step_id VARCHAR(64),
    idempotency_key VARCHAR(255) UNIQUE, -- Исключает дубли при повторных триггерах State Machine
    title VARCHAR(255) NOT NULL,
    script_prompt TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'snoozed', 'archived')),
    kpi_value INTEGER NOT NULL DEFAULT 0,
    custom_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    due_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_status
    ON public.tasks (owner_partner_id, status);

-- ============================================================================
-- ШАГ 4. ZERO-CHAT АРХИТЕКТУРА (КОНТЕКСТНЫЕ КОММЕНТАРИИ К ЗАДАЧЕ task_comments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(64) NOT NULL DEFAULT 'Наставник',
    body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id
    ON public.task_comments (task_id, created_at ASC);

-- ============================================================================
-- ПОЛИТИКИ ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.partner_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads_pii ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_partner_ltree_path()
RETURNS ltree
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT hierarchy_path FROM public.partner_nodes WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_partner_node_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT id FROM public.partner_nodes WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 1. Наставник видит всю свою нижестоящую ветку партнёров (ltree оператор <@)
CREATE POLICY partner_nodes_branch_select
    ON public.partner_nodes FOR SELECT
    USING (hierarchy_path <@ public.current_partner_ltree_path());

-- 2. Наставник видит воронку сделок (crm_leads) подопечных, но без таблицы crm_leads_pii
CREATE POLICY crm_leads_branch_select
    ON public.crm_leads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.partner_nodes pn
            WHERE pn.id = crm_leads.owner_partner_id
              AND pn.hierarchy_path <@ public.current_partner_ltree_path()
        )
    );

-- 3. Защита базы от увода: доступ к crm_leads_pii (телефонам) имеет ТОЛЬКО прямой владелец клиента
CREATE POLICY crm_leads_pii_owner_only
    ON public.crm_leads_pii FOR ALL
    USING (owner_partner_id = public.current_partner_node_id())
    WITH CHECK (owner_partner_id = public.current_partner_node_id());

-- 4. Наставник видит задачи подопечных в своей ветке (для менторства)
CREATE POLICY tasks_branch_select
    ON public.tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.partner_nodes pn
            WHERE pn.id = tasks.owner_partner_id
              AND pn.hierarchy_path <@ public.current_partner_ltree_path()
        )
    );

-- 5. Zero-Chat (task_comments): читать и писать комментарии к задаче могут только владелец задачи и его вышестоящие наставники по ветке ltree
CREATE POLICY task_comments_branch_access
    ON public.task_comments FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.tasks t
            JOIN public.partner_nodes pn ON pn.id = t.owner_partner_id
            WHERE t.id = task_comments.task_id
              AND pn.hierarchy_path <@ public.current_partner_ltree_path()
        )
    )
    WITH CHECK (
        author_partner_id = public.current_partner_node_id()
    );

COMMIT;
