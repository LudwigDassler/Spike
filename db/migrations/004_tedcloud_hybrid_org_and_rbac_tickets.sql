-- ============================================================================
-- TedCloud Hybrid Workspace Migration (PostgreSQL / Supabase)
-- Единое рабочее пространство: Внутренние отделы (IT, HR) + Партнёрская сеть (Франчайзи, MLM)
-- Шаг 1: Гибридная иерархия organization_nodes (ltree + kpi_value + custom_data JSONB)
-- Шаг 2: Маршрутизация задач и тикетов (RBAC Tickets + RLS + Queue Enforcement)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- ============================================================================
-- ШАГ 1. УНИВЕРСАЛЬНАЯ ГИБРИДНАЯ ТАБЛИЦА УЗЛОВ ОРГАНИЗАЦИИ (organization_nodes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    parent_id UUID REFERENCES organization_nodes(id) ON DELETE RESTRICT,
    display_name VARCHAR(160) NOT NULL,
    node_scope VARCHAR(32) NOT NULL CHECK (node_scope IN ('ROOT', 'INTERNAL_DEPT', 'EXTERNAL_NETWORK')),
    role_code VARCHAR(64) NOT NULL CHECK (
        role_code IN ('org_root', 'internal_it', 'internal_hr', 'network_leader', 'network_partner')
    ),
    tree_path ltree NOT NULL UNIQUE,            -- Материализованный путь: tedcloud.internal.it.* или tedcloud.network.*
    kpi_value INTEGER NOT NULL DEFAULT 0 CHECK (kpi_value >= 0), -- Универсальный KPI (Story Points для IT / PV для сети)
    custom_data JSONB NOT NULL DEFAULT '{}'::jsonb,              -- Грейд, стек, SLA или ранг франчайзи/MLM
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GiST-индекс для мгновенного поиска по поддеревьям (<@, @>) и GIN для JSONB
CREATE INDEX IF NOT EXISTS idx_organization_nodes_tree_gist ON organization_nodes USING GIST (tree_path);
CREATE INDEX IF NOT EXISTS idx_organization_nodes_custom_gin ON organization_nodes USING GIN (custom_data);
CREATE INDEX IF NOT EXISTS idx_organization_nodes_role ON organization_nodes (role_code, node_scope);

-- Демонстрация сосуществования внутренних отделов и внешней партнёрской сети в одном дереве ltree:
INSERT INTO organization_nodes (id, display_name, node_scope, role_code, tree_path, kpi_value, custom_data)
VALUES
    -- Корень экосистемы TedCloud
    ('00000000-0000-0000-0000-000000000001', 'TedCloud Holding', 'ROOT', 'org_root',
     'tedcloud'::ltree, 10000, '{"tenant": "tedcloud-global"}'::jsonb),

    -- Внутренний контур (tedcloud.internal.*)
    ('00000000-0000-0000-0000-000000000010', 'IT Department (Core Platform)', 'INTERNAL_DEPT', 'internal_it',
     'tedcloud.internal.it'::ltree, 420, '{"kpi_unit": "story_points", "sla_hours": 4, "repo": "tedcloud/core"}'::jsonb),
    ('00000000-0000-0000-0000-000000000011', 'Максим Орлов (Senior Backend Dev)', 'INTERNAL_DEPT', 'internal_it',
     'tedcloud.internal.it.dev_max'::ltree, 145, '{"grade": "Senior", "stack": ["Next.js", "PostgreSQL", "ltree"]}'::jsonb),
    ('00000000-0000-0000-0000-000000000020', 'HR & People Ops', 'INTERNAL_DEPT', 'internal_hr',
     'tedcloud.internal.hr'::ltree, 85, '{"kpi_unit": "hires_closed", "open_vacancies": 6}'::jsonb),

    -- Внешняя партнёрская сеть (tedcloud.network.*)
    ('00000000-0000-0000-0000-000000000100', 'Алина Соколова (Лидер ветки #1)', 'EXTERNAL_NETWORK', 'network_leader',
     'tedcloud.network.leader_1'::ltree, 4680, '{"kpi_unit": "PV", "rank": "President Team", "region": "RU-MOW"}'::jsonb),
    ('00000000-0000-0000-0000-000000000101', 'Артём Громов (Партнёр франшизы)', 'EXTERNAL_NETWORK', 'network_partner',
     'tedcloud.network.leader_1.partner_4'::ltree, 320, '{"kpi_unit": "PV", "rank": "Senior Consultant", "tma_enabled": true}'::jsonb)
ON CONFLICT (tree_path) DO NOTHING;

-- ============================================================================
-- ШАГ 2. МАРШРУТИЗАЦИЯ ЗАДАЧ И ТИКЕТОВ (RBAC Tickets + RLS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(240) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    task_kind VARCHAR(32) NOT NULL DEFAULT 'CLIENT_OUTREACH'
        CHECK (task_kind IN ('CLIENT_OUTREACH', 'IT_TICKET', 'HR_REQUEST')),
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'TODO', 'IN_CODE_REVIEW', 'DEPLOYED', 'DONE')),
    creator_node_id UUID NOT NULL REFERENCES organization_nodes(id) ON DELETE CASCADE,
    target_department_path ltree NOT NULL,      -- Например: 'tedcloud.internal.it' или 'tedcloud.network.leader_1'
    assignee_node_id UUID REFERENCES organization_nodes(id) ON DELETE SET NULL, -- NULL = задача в общей очереди отдела!
    routing_mode VARCHAR(32) NOT NULL DEFAULT 'DEPARTMENT_QUEUE'
        CHECK (routing_mode IN ('DEPARTMENT_QUEUE', 'DIRECT_ASSIGNMENT')),
    kpi_value INTEGER NOT NULL DEFAULT 0 CHECK (kpi_value >= 0),
    script_prompt TEXT,                         -- Эмпатичный скрипт (для партнёра сети)
    custom_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Метаданные: git_branch, env, bug_severity или client_phone_masked
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_target_dept_gist ON tasks USING GIST (target_department_path);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_node_id, status);

-- Хелперы получения текущего узла пользователя из JWT-сессии Supabase
CREATE OR REPLACE FUNCTION public.current_org_node_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT id FROM public.organization_nodes WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_org_tree_path()
RETURNS ltree LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT tree_path FROM public.organization_nodes WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Триггер принудительной маршрутизации (Defense-in-Depth на уровне БД):
-- 1) Если создатель из внешней сети (tedcloud.network.*), а цель — внутренний отдел (tedcloud.internal.*),
--    задача принудительно ставится в общую очередь отдела: assignee_node_id = NULL, routing_mode = 'DEPARTMENT_QUEUE'.
-- 2) Внутри своего отдела (creator и target в одном внутреннем подразделении) разрешено прямое назначение.
CREATE OR REPLACE FUNCTION public.enforce_tedcloud_task_routing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_creator_path ltree;
    v_assignee_path ltree;
BEGIN
    SELECT tree_path INTO v_creator_path
    FROM public.organization_nodes
    WHERE id = NEW.creator_node_id;

    IF v_creator_path IS NULL THEN
        RAISE EXCEPTION 'Creator organization node not found';
    END IF;

    -- Сценарий А: Внешний партнёр (tedcloud.network.*) создаёт тикет во внутренний отдел (tedcloud.internal.*)
    IF (v_creator_path <@ 'tedcloud.network'::ltree)
       AND (NEW.target_department_path <@ 'tedcloud.internal'::ltree) THEN
        IF NEW.assignee_node_id IS NOT NULL THEN
            RAISE EXCEPTION 'RBAC Routing Violation: External network partners cannot assign tasks directly to an internal developer. Leave assignee_node_id NULL to route into department queue (%).', NEW.target_department_path;
        END IF;
        NEW.routing_mode := 'DEPARTMENT_QUEUE';
        NEW.status := 'QUEUED';
        RETURN NEW;
    END IF;

    -- Сценарий Б: Прямое назначение внутри своего отдела / своей ветки
    IF NEW.assignee_node_id IS NOT NULL THEN
        SELECT tree_path INTO v_assignee_path
        FROM public.organization_nodes
        WHERE id = NEW.assignee_node_id;

        IF NOT (v_assignee_path <@ NEW.target_department_path) THEN
            RAISE EXCEPTION 'Assignee must belong to target_department_path (%)', NEW.target_department_path;
        END IF;

        NEW.routing_mode := 'DIRECT_ASSIGNMENT';
    ELSE
        NEW.routing_mode := 'DEPARTMENT_QUEUE';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tedcloud_task_routing ON tasks;
CREATE TRIGGER trg_enforce_tedcloud_task_routing
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_tedcloud_task_routing();

-- Включаем Row Level Security (RLS)
ALTER TABLE organization_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Политика 1 (SELECT):
-- Сотрудник внутреннего отдела видит все задачи своего отдела (включая общую очередь assignee_node_id IS NULL).
-- Партнёр сети видит свои задачи, задачи своей нижестоящей ветки (<@) и созданные им тикеты в IT.
CREATE POLICY tasks_hybrid_select_policy ON tasks
    FOR SELECT USING (
        creator_node_id = public.current_org_node_id()
        OR assignee_node_id = public.current_org_node_id()
        OR (public.current_org_tree_path() <@ target_department_path)
        OR (target_department_path <@ public.current_org_tree_path())
    );

-- Политика 2 (INSERT — RBAC Tickets):
-- Партнёр из внешней сети может создать задачу:
--   а) внутри своей партнёрской ветки (прямое назначение разрешено),
--   б) ИЛИ тикет в IT/HR отдел (tedcloud.internal.*), НО ТОЛЬКО в общую очередь (assignee_node_id IS NULL).
-- Сотрудник внутреннего отдела может назначать задачи напрямую коллегам внутри своего отдела.
CREATE POLICY tasks_hybrid_insert_rbac_policy ON tasks
    FOR INSERT WITH CHECK (
        creator_node_id = public.current_org_node_id()
        AND (
            -- Внутри своего отдела или своей нижестоящей ветки: можно назначать напрямую
            (
                target_department_path <@ public.current_org_tree_path()
                OR public.current_org_tree_path() <@ target_department_path
            )
            OR
            -- Межконтурный тикет (Партнёр сети -> IT-отдел): строго в очередь отдела без прямого исполнителя!
            (
                public.current_org_tree_path() <@ 'tedcloud.network'::ltree
                AND target_department_path <@ 'tedcloud.internal'::ltree
                AND assignee_node_id IS NULL
                AND routing_mode = 'DEPARTMENT_QUEUE'
            )
        )
    );

-- Политика 3 (UPDATE):
-- Разработчик IT-отдела может забрать тикет из очереди своего отдела (взять в код-ревью / задеплоить)
CREATE POLICY tasks_hybrid_update_policy ON tasks
    FOR UPDATE USING (
        assignee_node_id = public.current_org_node_id()
        OR (public.current_org_tree_path() <@ target_department_path)
        OR (target_department_path <@ public.current_org_tree_path())
    );
