-- =============================================================================
-- TedCloud B2B2C SaaS Platform — Supabase / PostgreSQL Database Initialization
-- File: init.sql
-- Описание: Иерархическая гибридная схема БД на базе ltree с ролевой моделью
--           доступа (Row Level Security) и триггерами аудита времени.
-- =============================================================================

BEGIN;

-- =============================================================================
-- ШАГ 1. СОЗДАНИЕ БАЗОВОЙ СТРУКТУРЫ И ИНДЕКСОВ
-- =============================================================================

-- 1.1. Включаем расширение ltree для хранения материализованных путей иерархии
--      и pgcrypto для генерации UUID.
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1.2. Перечисления (ENUM) для строгой типизации ролей, типов задач и статусов
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tedcloud_role_type') THEN
        CREATE TYPE public.tedcloud_role_type AS ENUM (
            'SUPERADMIN',
            'NETWORK_PARTNER',
            'INTERNAL_IT'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tedcloud_task_type') THEN
        CREATE TYPE public.tedcloud_task_type AS ENUM (
            'client',
            'ticket'
        );
    END IF;
END $$;

-- 1.3. Таблица узлов организации: объединяет внутренние подразделения (IT, HR)
--      и внешнюю партнёрскую сеть в едином дереве ltree.
--      Поле id напрямую связывается с auth.users(id) в Supabase Auth.
CREATE TABLE IF NOT EXISTS public.organization_nodes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    role_type         public.tedcloud_role_type NOT NULL DEFAULT 'NETWORK_PARTNER',
    tree_path         ltree NOT NULL,
    telegram_chat_id  TEXT UNIQUE,
    kpi_value         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (kpi_value >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_nodes IS
    'Узлы организационной структуры TedCloud (внутренние отделы и партнёрская сеть).';
COMMENT ON COLUMN public.organization_nodes.tree_path IS
    'Материализованный путь ltree (например, tedcloud.internal.it или tedcloud.network.p_101).';

-- 1.4. Таблица задач и сервисных тикетов (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                    public.tedcloud_task_type NOT NULL DEFAULT 'client',
    title                   TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'review', 'done', 'archived')),
    owner_node_id           UUID NOT NULL REFERENCES public.organization_nodes(id) ON DELETE CASCADE,
    target_department_path  ltree,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Бизнес-правило: для внутренних тикетов ('ticket') целевой отдел обязателен
    CONSTRAINT chk_ticket_department_path CHECK (
        type = 'client' OR target_department_path IS NOT NULL
    )
);

COMMENT ON TABLE public.tasks IS
    'Полиморфные задачи TedCloud: клиентские касания (client) и внутренние тикеты подразделений (ticket).';

-- 1.5. Таблица CRM-воронки лидов (crm_leads)
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_node_id  UUID NOT NULL REFERENCES public.organization_nodes(id) ON DELETE CASCADE,
    full_name      TEXT NOT NULL CHECK (char_length(trim(full_name)) > 0),
    phone          TEXT NOT NULL CHECK (char_length(trim(phone)) > 0),
    stage          TEXT NOT NULL DEFAULT 'new'
                   CHECK (stage IN ('new', 'consultation', 'trial', 'repeat_client', 'partner_ready', 'archived')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_leads IS
    'Лиды и клиенты партнёрской сети с иерархическим контролем доступа по ветке.';

-- 1.6. Индексы (включая GIST-индексы для мгновенных иерархических запросов ltree <@ и @>)
CREATE INDEX IF NOT EXISTS idx_organization_nodes_tree_path_gist
    ON public.organization_nodes USING GIST (tree_path);

CREATE INDEX IF NOT EXISTS idx_organization_nodes_role_type
    ON public.organization_nodes (role_type);

CREATE INDEX IF NOT EXISTS idx_tasks_target_department_path_gist
    ON public.tasks USING GIST (target_department_path);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_node_id
    ON public.tasks (owner_node_id);

CREATE INDEX IF NOT EXISTS idx_tasks_type_status
    ON public.tasks (type, status);

CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_node_id
    ON public.crm_leads (owner_node_id);


-- =============================================================================
-- ШАГ 2. НАСТРОЙКА БЕЗОПАСНОСТИ (ROW LEVEL SECURITY)
-- =============================================================================

-- 2.1. Включаем Row Level Security (и принудительный режим FORCE) для всех таблиц
ALTER TABLE public.organization_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_nodes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads FORCE ROW LEVEL SECURITY;

-- 2.2. Вспомогательные функции безопасности (SECURITY DEFINER + search_path = public)
--      Избегают бесконечной рекурсии при проверке RLS внутри самой таблицы organization_nodes.

-- Возвращает role_type текущего аутентифицированного пользователя (через auth.uid() = organization_nodes.id)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.tedcloud_role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role_type
    FROM public.organization_nodes
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Возвращает ltree-путь (tree_path) текущего аутентифицированного пользователя
CREATE OR REPLACE FUNCTION public.get_current_user_tree_path()
RETURNS ltree
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tree_path
    FROM public.organization_nodes
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Проверяет, принадлежит ли указанный узел (target_node_id) текущему партнёру
-- или находится ниже него в иерархии дерева (оператор <@ из расширения ltree)
CREATE OR REPLACE FUNCTION public.is_node_in_current_user_downline(target_node_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_nodes AS target_node
        WHERE target_node.id = target_node_id
          AND (
              target_node.id = auth.uid()
              OR target_node.tree_path <@ public.get_current_user_tree_path()
          )
    );
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_current_user_tree_path() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_tree_path() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_node_in_current_user_downline(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_node_in_current_user_downline(UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2.3. Политики RLS для таблицы organization_nodes
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "organization_nodes_select_policy" ON public.organization_nodes;
DROP POLICY IF EXISTS "organization_nodes_insert_policy" ON public.organization_nodes;
DROP POLICY IF EXISTS "organization_nodes_update_policy" ON public.organization_nodes;
DROP POLICY IF EXISTS "organization_nodes_delete_policy" ON public.organization_nodes;

-- SELECT:
-- * SUPERADMIN и INTERNAL_IT видят любые узлы организации.
-- * NETWORK_PARTNER видит только свой узел и свою нижестоящую ветку (tree_path <@ my_path).
CREATE POLICY "organization_nodes_select_policy"
ON public.organization_nodes
FOR SELECT
TO authenticated
USING (
    public.get_current_user_role() IN ('SUPERADMIN', 'INTERNAL_IT')
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND (
            id = auth.uid()
            OR tree_path <@ public.get_current_user_tree_path()
        )
    )
);

-- INSERT:
-- * SUPERADMIN может создавать любые узлы.
-- * NETWORK_PARTNER может регистрировать новых партнёров только внутри своей ветки (tree_path <@ my_path)
--   и только с ролью NETWORK_PARTNER (запрет на эскалацию привилегий).
CREATE POLICY "organization_nodes_insert_policy"
ON public.organization_nodes
FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND role_type = 'NETWORK_PARTNER'
        AND tree_path <@ public.get_current_user_tree_path()
    )
);

-- UPDATE:
-- * SUPERADMIN имеет полный доступ.
-- * NETWORK_PARTNER может обновлять только свой узел или узлы своей нижестоящей структуры,
--   не меняя роль на административную.
CREATE POLICY "organization_nodes_update_policy"
ON public.organization_nodes
FOR UPDATE
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND (
            id = auth.uid()
            OR tree_path <@ public.get_current_user_tree_path()
        )
    )
)
WITH CHECK (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND role_type = 'NETWORK_PARTNER'
        AND (
            id = auth.uid()
            OR tree_path <@ public.get_current_user_tree_path()
        )
    )
);

-- DELETE: только SUPERADMIN
CREATE POLICY "organization_nodes_delete_policy"
ON public.organization_nodes
FOR DELETE
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
);

-- -----------------------------------------------------------------------------
-- 2.4. Политики RLS для таблицы tasks
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;

-- SELECT:
-- * SUPERADMIN: видит все задачи и тикеты.
-- * NETWORK_PARTNER: видит задачи и созданные им/его веткой обращения, где owner_node_id <@ его пути.
-- * INTERNAL_IT: видит тикеты своего отдела (или вложенных подотделов через <@), а также свои собственные задачи.
CREATE POLICY "tasks_select_policy"
ON public.tasks
FOR SELECT
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
    OR (
        public.get_current_user_role() = 'INTERNAL_IT'
        AND (
            owner_node_id = auth.uid()
            OR (
                type = 'ticket'
                AND target_department_path IS NOT NULL
                AND target_department_path <@ public.get_current_user_tree_path()
            )
        )
    )
);

-- INSERT:
-- * SUPERADMIN: полный доступ.
-- * NETWORK_PARTNER: может создавать задачи и тикеты для себя или своей нижестоящей ветки.
-- * INTERNAL_IT: может создавать тикеты в рамках своего отдела.
CREATE POLICY "tasks_insert_policy"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
    OR (
        public.get_current_user_role() = 'INTERNAL_IT'
        AND type = 'ticket'
        AND target_department_path IS NOT NULL
        AND target_department_path <@ public.get_current_user_tree_path()
    )
);

-- UPDATE:
-- * SUPERADMIN: полный доступ.
-- * NETWORK_PARTNER: может редактировать только задачи, принадлежащие ему лично или его ветке (<@).
-- * INTERNAL_IT: может редактировать ТОЛЬКО задачи (тикеты), где target_department_path совпадает с его отделом (или подотделом <@).
CREATE POLICY "tasks_update_policy"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
    OR (
        public.get_current_user_role() = 'INTERNAL_IT'
        AND type = 'ticket'
        AND target_department_path IS NOT NULL
        AND target_department_path <@ public.get_current_user_tree_path()
    )
)
WITH CHECK (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
    OR (
        public.get_current_user_role() = 'INTERNAL_IT'
        AND type = 'ticket'
        AND target_department_path IS NOT NULL
        AND target_department_path <@ public.get_current_user_tree_path()
    )
);

-- DELETE: только SUPERADMIN
CREATE POLICY "tasks_delete_policy"
ON public.tasks
FOR DELETE
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
);

-- -----------------------------------------------------------------------------
-- 2.5. Политики RLS для таблицы crm_leads
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "crm_leads_select_policy" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_insert_policy" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_update_policy" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_delete_policy" ON public.crm_leads;

-- SELECT:
-- * SUPERADMIN: видит всех лидов.
-- * NETWORK_PARTNER: видит только лидов, принадлежащих ему лично или его нижестоящей ветке (<@).
-- * INTERNAL_IT: не имеет доступа к коммерческой CRM-воронке клиентов.
CREATE POLICY "crm_leads_select_policy"
ON public.crm_leads
FOR SELECT
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
);

-- INSERT:
-- * SUPERADMIN: полный доступ.
-- * NETWORK_PARTNER: может добавлять лидов себе или партнёрам своей нижестоящей ветки (<@).
CREATE POLICY "crm_leads_insert_policy"
ON public.crm_leads
FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
);

-- UPDATE:
-- * SUPERADMIN: полный доступ.
-- * NETWORK_PARTNER: может редактировать только своих лидов и лидов нижестоящей структуры (<@).
CREATE POLICY "crm_leads_update_policy"
ON public.crm_leads
FOR UPDATE
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
)
WITH CHECK (
    public.get_current_user_role() = 'SUPERADMIN'
    OR (
        public.get_current_user_role() = 'NETWORK_PARTNER'
        AND public.is_node_in_current_user_downline(owner_node_id)
    )
);

-- DELETE: только SUPERADMIN
CREATE POLICY "crm_leads_delete_policy"
ON public.crm_leads
FOR DELETE
TO authenticated
USING (
    public.get_current_user_role() = 'SUPERADMIN'
);


-- =============================================================================
-- ШАГ 3. ТРИГГЕРЫ АВТОМАТИЗАЦИИ (set_updated_at)
-- =============================================================================

-- 3.1. Универсальная триггерная функция для автоматического обновления поля updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 3.2. Привязка триггера ко всем основным таблицам платформы
DROP TRIGGER IF EXISTS trg_organization_nodes_set_updated_at ON public.organization_nodes;
CREATE TRIGGER trg_organization_nodes_set_updated_at
BEFORE UPDATE ON public.organization_nodes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_set_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_leads_set_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_set_updated_at
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
