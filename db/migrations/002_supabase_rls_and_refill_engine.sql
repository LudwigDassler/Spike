-- ============================================================================
-- Миграция 002 (Supabase): PostgreSQL + ltree + RLS (Privacy by Design)
-- и Предиктивный трекер потребления (Refill Engine + pg_cron + idempotency_key)
-- ============================================================================

BEGIN;

-- 1. Расширения для иерархических деревьев (ltree), криптографии и планировщика pg_cron
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- ШАГ 1. ТАБЛИЦЫ И ПОЛИТИКИ RLS (PRIVACY BY DESIGN)
-- ============================================================================

-- 1.1. Узлы партнёрской сети (partner_nodes)
-- user_id связывает партнёра с учётной записью Supabase Auth (auth.uid())
CREATE TABLE IF NOT EXISTS public.partner_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE, -- В Supabase: REFERENCES auth.users(id) ON DELETE CASCADE
    upline_id UUID REFERENCES public.partner_nodes(id) ON DELETE SET NULL,
    hierarchy_path ltree NOT NULL, -- Например: 'root.u_101.u_205.u_309'
    full_name VARCHAR(255) NOT NULL,
    telegram_id BIGINT UNIQUE,
    personal_pv INTEGER NOT NULL DEFAULT 0 CHECK (personal_pv >= 0),
    group_pv INTEGER NOT NULL DEFAULT 0 CHECK (group_pv >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_nodes_path_gist
    ON public.partner_nodes USING GIST (hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_partner_nodes_user_id
    ON public.partner_nodes (user_id);

-- 1.2. Таблица метаданных клиентов и циклов потребления (БЕЗ телефона и чувствительных PII)
-- Наставник ветки может видеть только объём PV и статус цикла, но НЕ телефон клиента
CREATE TABLE IF NOT EXISTS public.client_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    client_first_name VARCHAR(128) NOT NULL, -- Только имя для скрипта и воронки
    product_sku VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,      -- Например: 'Протеиновый коктейль Формула 1 (550 г)'
    cycle_days INTEGER NOT NULL DEFAULT 21 CHECK (cycle_days > 0),
    cycle_started_at DATE NOT NULL DEFAULT CURRENT_DATE,
    cycle_end_date DATE NOT NULL,
    pv_value INTEGER NOT NULL DEFAULT 24 CHECK (pv_value >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_cycles_owner_end_date
    ON public.client_cycles (owner_partner_id, cycle_end_date)
    WHERE is_active = TRUE;

-- 1.3. Изолированное хранилище персональных данных клиентов (client_pii)
-- Физически отделено от client_cycles. Доступ разрешён ТОЛЬКО прямому владельцу (owner_partner_id)
CREATE TABLE IF NOT EXISTS public.client_pii (
    client_id UUID PRIMARY KEY REFERENCES public.client_cycles(id) ON DELETE CASCADE,
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    phone_e164 VARCHAR(32) NOT NULL,         -- Например: '+79264182210'
    phone_masked VARCHAR(32) NOT NULL,       -- Например: '+7 *** ***-**-10'
    telegram_username VARCHAR(128),
    delivery_notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_pii_owner
    ON public.client_pii (owner_partner_id);

-- 1.4. Таблица фокус-задач «Умного второго пилота» (tasks) с защитой от дублей (idempotency_key)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_partner_id UUID NOT NULL REFERENCES public.partner_nodes(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.client_cycles(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) UNIQUE,     -- Гарантирует отсутствие дублей при перезапуске воркера
    task_type VARCHAR(32) NOT NULL DEFAULT 'refill_followup'
        CHECK (task_type IN ('refill_followup', 'day3_care', 'onboarding_step', 'marathon_invite')),
    title VARCHAR(255) NOT NULL,
    client_first_name VARCHAR(128) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    days_remaining INTEGER NOT NULL DEFAULT 3,
    empathetic_script TEXT NOT NULL,
    pv_impact INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed_reordered', 'snoozed', 'archived')),
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due
    ON public.tasks (owner_partner_id, status, due_date);

-- ============================================================================
-- ВКЛЮЧЕНИЕ ROW LEVEL SECURITY (RLS) И ПОЛИТИКИ PRIVACY BY DESIGN
-- ============================================================================

ALTER TABLE public.partner_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_pii ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Вспомогательная функция: возвращает hierarchy_path текущего авторизованного партнёра (auth.uid())
CREATE OR REPLACE FUNCTION public.current_partner_ltree_path()
RETURNS ltree
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT hierarchy_path
    FROM public.partner_nodes
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- Вспомогательная функция: возвращает ID узла текущего авторизованного партнёра
CREATE OR REPLACE FUNCTION public.current_partner_node_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM public.partner_nodes
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- Политика 1 (partner_nodes): Партнёр видит себя и всю свою нижестоящую ветку (оператор ltree <@)
-- Это позволяет наставнику видеть агрегированные баллы (personal_pv, group_pv) своей структуры
CREATE POLICY partner_nodes_select_downline
    ON public.partner_nodes
    FOR SELECT
    USING (
        hierarchy_path <@ public.current_partner_ltree_path()
    );

-- Политика 2 (client_cycles): Наставник может видеть обезличенные циклы и PV ветки для аналитики,
-- но в этой таблице физически нет телефона и фамилии клиента
CREATE POLICY client_cycles_select_branch
    ON public.client_cycles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.partner_nodes pn
            WHERE pn.id = client_cycles.owner_partner_id
              AND pn.hierarchy_path <@ public.current_partner_ltree_path()
        )
    );

-- Политика 3 (client_pii — ЖЁСТКАЯ ИЗОЛЯЦИЯ КОНТАКТОВ):
-- Наставник НЕ ИМЕЕТ доступа к таблице client_pii чужих клиентов!
-- Только непосредственный владелец клиента (owner_partner_id = current_partner_node_id())
-- может прочитать или изменить телефон и Telegram-аккаунт клиента.
CREATE POLICY client_pii_strict_owner_only_select
    ON public.client_pii
    FOR SELECT
    USING (
        owner_partner_id = public.current_partner_node_id()
    );

CREATE POLICY client_pii_strict_owner_only_modify
    ON public.client_pii
    FOR ALL
    USING (
        owner_partner_id = public.current_partner_node_id()
    )
    WITH CHECK (
        owner_partner_id = public.current_partner_node_id()
    );

-- Политика 4 (tasks): Партнёр и его наставник видят статус задач, но управлять задачей может владелец
CREATE POLICY tasks_select_branch
    ON public.tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.partner_nodes pn
            WHERE pn.id = tasks.owner_partner_id
              AND pn.hierarchy_path <@ public.current_partner_ltree_path()
        )
    );

CREATE POLICY tasks_modify_owner_only
    ON public.tasks
    FOR ALL
    USING (owner_partner_id = public.current_partner_node_id())
    WITH CHECK (owner_partner_id = public.current_partner_node_id());


-- ============================================================================
-- ШАГ 2. ПРЕДИКТИВНЫЙ ТРЕКЕР (REFILL ENGINE С PG_CRON И IDEMPOTENCY_KEY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_refill_followup_tasks(
    p_reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted_count INTEGER := 0;
BEGIN
    -- Выбираем активные циклы потребления, которые заканчиваются ровно через 3 дня (или уже в зоне <= 3 дней)
    -- Формируем детерминированный idempotency_key: 'refill:<client_id>:<sku>:<cycle_end_date>'
    WITH inserted AS (
        INSERT INTO public.tasks (
            owner_partner_id,
            client_id,
            idempotency_key,
            task_type,
            title,
            client_first_name,
            product_name,
            days_remaining,
            empathetic_script,
            pv_impact,
            status,
            due_date
        )
        SELECT
            cc.owner_partner_id,
            cc.id AS client_id,
            format(
                'refill:%s:%s:%s',
                cc.id::text,
                cc.product_sku,
                to_char(cc.cycle_end_date, 'YYYY-MM-DD')
            ) AS idempotency_key,
            'refill_followup' AS task_type,
            format('Забота о результате: %s (%s)', cc.client_first_name, cc.product_name) AS title,
            cc.client_first_name,
            cc.product_name,
            GREATEST(0, (cc.cycle_end_date - p_reference_date)) AS days_remaining,
            format(
                '%s, привет! 🌿 Смотрю по нашему дневнику, твоя баночка «%s» подходит к концу примерно через 3 дня. Как твоё самочувствие и лёгкость по утрам? Давай закажем свежую заранее, чтобы не прерывать твой ритм, или попробуем новый вкус?',
                cc.client_first_name,
                cc.product_name
            ) AS empathetic_script,
            cc.pv_value AS pv_impact,
            'pending' AS status,
            p_reference_date AS due_date
        FROM public.client_cycles cc
        WHERE cc.is_active = TRUE
          AND (cc.cycle_end_date - p_reference_date) BETWEEN 0 AND 3
        -- Идемпотентность: при повторном запуске воркера дубликаты гарантированно игнорируются
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted_count FROM inserted;

    RETURN v_inserted_count;
END;
$$;

-- Регистрация ежедневного фонового задания в pg_cron (каждый день в 06:00 UTC)
-- Примечание: в Supabase pg_cron запускается в схеме cron
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
        PERFORM cron.schedule(
            'partnerflow-daily-refill-engine',
            '0 6 * * *',
            $cron$SELECT public.generate_refill_followup_tasks(CURRENT_DATE);$cron$
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Игнорируем, если локальный пользователь не суперпользователь cron
        NULL;
END;
$$;

COMMIT;
