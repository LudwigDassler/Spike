-- ============================================================================
-- Миграция 001: Инициализация схемы B2B2C SaaS «ПартнёрФлоу» (PostgreSQL + ltree)
-- ============================================================================

BEGIN;

-- 1. Подключаем расширения для UUID и иерархических деревьев спонсорской сети (ltree)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- 2. Таблица отраслевых White-Label брендов (арендаторов / тенантов)
CREATE TABLE IF NOT EXISTS brands (
    id VARCHAR(64) PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    industry_label VARCHAR(255) NOT NULL,
    volume_unit_label VARCHAR(64) NOT NULL DEFAULT 'PV (Очки Объёма)',
    partner_title_label VARCHAR(128) NOT NULL DEFAULT 'Независимый Партнёр',
    client_event_label VARCHAR(128) NOT NULL DEFAULT 'Марафон стройности 10д',
    primary_color_hex VARCHAR(7) NOT NULL DEFAULT '#15803d',
    corporate_buyer_example VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Таблица узлов партнёрской сети (partner_nodes) с материализованным путём ltree
CREATE TABLE IF NOT EXISTS partner_nodes (
    id VARCHAR(64) PRIMARY KEY,
    brand_id VARCHAR(64) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    upline_id VARCHAR(64) REFERENCES partner_nodes(id) ON DELETE SET NULL,
    -- Путь в дереве спонсорской структуры, например: 'root.p_1.p_3.p_4'
    hierarchy_path ltree NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(128) NOT NULL,
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    personal_pv INTEGER NOT NULL DEFAULT 0 CHECK (personal_pv >= 0),
    group_pv INTEGER NOT NULL DEFAULT 0 CHECK (group_pv >= 0),
    target_pv INTEGER NOT NULL DEFAULT 500 CHECK (target_pv > 0),
    active_clients INTEGER NOT NULL DEFAULT 0 CHECK (active_clients >= 0),
    onboarding_completed_steps INTEGER NOT NULL DEFAULT 1 CHECK (onboarding_completed_steps >= 0),
    onboarding_total_steps INTEGER NOT NULL DEFAULT 6 CHECK (onboarding_total_steps > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'onboarding' CHECK (status IN ('active', 'onboarding', 'risk')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс GiST по полю ltree для мгновенного поиска всех нижестоящих веток (операторы <@ и @>)
CREATE INDEX IF NOT EXISTS idx_partner_nodes_hierarchy_gist ON partner_nodes USING GIST (hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_partner_nodes_brand_id ON partner_nodes (brand_id);
CREATE INDEX IF NOT EXISTS idx_partner_nodes_upline_id ON partner_nodes (upline_id);

-- 4. Таблица задач и партнёрских спринтов (tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    brand_id VARCHAR(64) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    parent_task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE CASCADE,
    assignee_partner_id VARCHAR(64) REFERENCES partner_nodes(id) ON DELETE SET NULL,
    code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    project VARCHAR(128) NOT NULL,
    assignee_name VARCHAR(255) NOT NULL,
    assignee_role VARCHAR(128) NOT NULL DEFAULT 'Независимый Партнёр',
    due_date DATE NOT NULL,
    pv_impact INTEGER NOT NULL DEFAULT 0 CHECK (pv_impact >= 0),
    estimated_hours NUMERIC(5,1) NOT NULL DEFAULT 2.0,
    playbook_source VARCHAR(255),
    subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_brand_status ON tasks (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_partner_id ON tasks (assignee_partner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project);

-- 5. Таблица клиентской CRM-воронки (crm_leads)
CREATE TABLE IF NOT EXISTS crm_leads (
    id VARCHAR(64) PRIMARY KEY,
    brand_id VARCHAR(64) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    mentor_partner_id VARCHAR(64) REFERENCES partner_nodes(id) ON DELETE SET NULL,
    converted_partner_id VARCHAR(64) REFERENCES partner_nodes(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    city VARCHAR(128) NOT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'contact'
        CHECK (stage IN ('contact', 'consultation', 'marathon', 'repeat_client', 'partner_ready')),
    monthly_pv INTEGER NOT NULL DEFAULT 0 CHECK (monthly_pv >= 0),
    deal_value_rub INTEGER NOT NULL DEFAULT 0 CHECK (deal_value_rub >= 0),
    program_name VARCHAR(255) NOT NULL,
    mentor_name VARCHAR(255) NOT NULL,
    last_activity TEXT NOT NULL DEFAULT '',
    converted_to_partner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_brand_stage ON crm_leads (brand_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_mentor_partner_id ON crm_leads (mentor_partner_id);

COMMIT;
