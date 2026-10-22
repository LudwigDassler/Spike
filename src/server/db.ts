import pg from 'pg';
import {
  INITIAL_CRM_LEADS,
  INITIAL_PARTNERS,
  INITIAL_TASKS,
  WHITE_LABEL_PRESETS,
} from '../data/seedData';
import { CrmLead, PartnerNode, TaskItem } from '../types/saas';
import {
  buildChildLtreePath,
  computeDownlineGroupPv,
  convertLeadToPartner,
} from '../utils/saasLogic';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://partnerflow_user:partnerflow_secret_password@localhost:5432/partnerflow_saas',
  connectionTimeoutMillis: 1500,
});

// Проверка доступности локального PostgreSQL (если Docker не запущен в облачном превью,
// сервер прозрачно исполняет те же операции в памяти с расчётом путей ltree)
let isPostgresConnected = false;

export async function checkPostgresConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isPostgresConnected = true;
    return true;
  } catch {
    isPostgresConnected = false;
    return false;
  }
}

// Состояние in-memory зеркала (для работы превью без запущенного локального Docker)
let memoryTasks: TaskItem[] = structuredClone(INITIAL_TASKS);
let memoryPartners: PartnerNode[] = structuredClone(INITIAL_PARTNERS);
let memoryLeads: CrmLead[] = structuredClone(INITIAL_CRM_LEADS);

/**
 * Пересчитывает групповой объём (group_pv) каждого партнёра через дерево ltree (<@)
 */
function recalculateMemoryGroupPv() {
  memoryPartners = memoryPartners.map((partner) => {
    if (!partner.hierarchyPath) return partner;
    const downlinePv = computeDownlineGroupPv(memoryPartners, partner.hierarchyPath);
    return {
      ...partner,
      groupPv: Math.max(partner.groupPv, downlinePv),
    };
  });
}

/**
 * 1. Получение дерева задач и партнёрской структуры (сырой SQL с ltree и WITH RECURSIVE)
 */
export async function getTasksTreeFromDb(brandId: string = 'herbalife_wellness'): Promise<{
  tasks: TaskItem[];
  engine: 'postgresql_ltree' | 'memory_ltree_mirror';
  sqlExecuted: string;
}> {
  const sqlQuery = `
    WITH RECURSIVE task_hierarchy AS (
      SELECT
        t.id,
        t.parent_task_id,
        t.code,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.project,
        t.assignee_name,
        t.assignee_role,
        TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
        t.pv_impact,
        t.estimated_hours::float AS estimated_hours,
        t.playbook_source,
        t.subtasks,
        p.hierarchy_path::text AS partner_ltree_path,
        1 AS depth_level
      FROM tasks t
      LEFT JOIN partner_nodes p ON p.id = t.assignee_partner_id
      WHERE t.brand_id = $1 AND t.parent_task_id IS NULL

      UNION ALL

      SELECT
        child.id,
        child.parent_task_id,
        child.code,
        child.title,
        child.description,
        child.status,
        child.priority,
        child.project,
        child.assignee_name,
        child.assignee_role,
        TO_CHAR(child.due_date, 'YYYY-MM-DD') AS due_date,
        child.pv_impact,
        child.estimated_hours::float AS estimated_hours,
        child.playbook_source,
        child.subtasks,
        p.hierarchy_path::text AS partner_ltree_path,
        th.depth_level + 1
      FROM tasks child
      INNER JOIN task_hierarchy th ON child.parent_task_id = th.id
      LEFT JOIN partner_nodes p ON p.id = child.assignee_partner_id
    )
    SELECT * FROM task_hierarchy
    ORDER BY depth_level ASC, due_date ASC;
  `;

  if (isPostgresConnected) {
    const { rows } = await pool.query(sqlQuery, [brandId]);
    const tasks: TaskItem[] = rows.map((r) => ({
      id: r.id,
      parentTaskId: r.parent_task_id,
      code: r.code,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      project: r.project,
      assigneeName: r.assignee_name,
      assigneeRole: r.assignee_role,
      dueDate: r.due_date,
      pvImpact: Number(r.pv_impact),
      estimatedHours: Number(r.estimated_hours),
      playbookSource: r.playbook_source || undefined,
      subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    }));
    return { tasks, engine: 'postgresql_ltree', sqlExecuted: sqlQuery.trim() };
  }

  return {
    tasks: memoryTasks,
    engine: 'memory_ltree_mirror',
    sqlExecuted: sqlQuery.trim(),
  };
}

/**
 * 2. Создание новой задачи через PostgreSQL INSERT ... RETURNING
 */
export async function createTaskInDb(
  payload: Omit<TaskItem, 'id' | 'code' | 'status'> & { brandId?: string }
): Promise<TaskItem> {
  const brandId = payload.brandId || WHITE_LABEL_PRESETS[0].id;
  const newId = `task-${Date.now()}`;
  const nextNumber = 100 + memoryTasks.length + 1;
  const code = `PF-${nextNumber}`;

  const insertSql = `
    INSERT INTO tasks (
      id, brand_id, parent_task_id, code, title, description,
      status, priority, project, assignee_name, assignee_role,
      due_date, pv_impact, estimated_hours, playbook_source, subtasks
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      'todo', $7, $8, $9, $10,
      $11::date, $12, $13, $14, $15::jsonb
    )
    RETURNING
      id, parent_task_id, code, title, description, status, priority,
      project, assignee_name, assignee_role,
      TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
      pv_impact, estimated_hours::float AS estimated_hours,
      playbook_source, subtasks;
  `;

  if (isPostgresConnected) {
    const { rows } = await pool.query(insertSql, [
      newId,
      brandId,
      payload.parentTaskId || null,
      code,
      payload.title,
      payload.description,
      payload.priority,
      payload.project,
      payload.assigneeName,
      payload.assigneeRole || 'Независимый Партнёр',
      payload.dueDate,
      payload.pvImpact,
      payload.estimatedHours || 3,
      payload.playbookSource || null,
      JSON.stringify(payload.subtasks || []),
    ]);
    const r = rows[0];
    return {
      id: r.id,
      parentTaskId: r.parent_task_id,
      code: r.code,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      project: r.project,
      assigneeName: r.assignee_name,
      assigneeRole: r.assignee_role,
      dueDate: r.due_date,
      pvImpact: Number(r.pv_impact),
      estimatedHours: Number(r.estimated_hours),
      playbookSource: r.playbook_source || undefined,
      subtasks: r.subtasks || [],
    };
  }

  const created: TaskItem = {
    ...payload,
    id: newId,
    code,
    status: 'todo',
  };
  memoryTasks = [created, ...memoryTasks];
  return created;
}

/**
 * 3. Регистрация нового партнёра с вычислением материализованного пути ltree от наставника
 *    и транзакционным созданием стартовой задачи онбординга
 */
export async function createPartnerWithLtreeInDb(params: {
  name: string;
  city: string;
  uplineName: string;
  uplineId?: string;
  brandId?: string;
}): Promise<{
  partner: PartnerNode;
  starterTask: TaskItem;
  sqlExecuted: string;
}> {
  const brandId = params.brandId || WHITE_LABEL_PRESETS[0].id;
  const newPartnerId = `partner_${Date.now()}`;

  const transactionSql = `
    -- 1. Находим путь ltree вышестоящего спонсора (наставника)
    SELECT id, name, hierarchy_path::text AS upline_path
    FROM partner_nodes
    WHERE (id = $1 OR name = $2) AND brand_id = $3
    LIMIT 1;

    -- 2. Вставляем нового партнёра с конкатенацией пути ltree: upline.hierarchy_path || text2ltree('p_' || new_id)
    INSERT INTO partner_nodes (
      id, brand_id, upline_id, hierarchy_path,
      name, city, personal_pv, group_pv, target_pv,
      active_clients, onboarding_completed_steps, onboarding_total_steps, status
    )
    VALUES (
      $4, $3, $5, text2ltree($6),
      $7, $8, 100, 0, 500,
      1, 1, 6, 'onboarding'
    )
    RETURNING *;

    -- 3. Пересчитываем групповой объём (ГО) всех вышестоящих наставников через оператор ltree @>
    UPDATE partner_nodes ancestor
    SET group_pv = (
      SELECT COALESCE(SUM(descendant.personal_pv), 0)
      FROM partner_nodes descendant
      WHERE descendant.hierarchy_path <@ ancestor.hierarchy_path
        AND descendant.id != ancestor.id
    )
    WHERE ancestor.hierarchy_path @> text2ltree($6)
      AND ancestor.id != $4;
  `;

  if (isPostgresConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const uplineRes = await client.query(
        `SELECT id, name, hierarchy_path::text AS upline_path
         FROM partner_nodes
         WHERE (id = $1 OR name = $2) AND brand_id = $3
         LIMIT 1`,
        [params.uplineId || null, params.uplineName, brandId]
      );
      const uplineRow = uplineRes.rows[0];
      const childPath = buildChildLtreePath(uplineRow?.upline_path, newPartnerId);

      const insertPartnerRes = await client.query(
        `INSERT INTO partner_nodes (
          id, brand_id, upline_id, hierarchy_path,
          name, city, personal_pv, group_pv, target_pv,
          active_clients, onboarding_completed_steps, onboarding_total_steps, status
        )
        VALUES ($1, $2, $3, text2ltree($4), $5, $6, 100, 0, 500, 1, 1, 6, 'onboarding')
        RETURNING id, upline_id, hierarchy_path::text AS hierarchy_path, name, city,
                  TO_CHAR(joined_date, 'YYYY-MM-DD') AS joined_date,
                  personal_pv, group_pv, target_pv, active_clients,
                  onboarding_completed_steps, onboarding_total_steps, status`,
        [
          newPartnerId,
          brandId,
          uplineRow?.id || null,
          childPath,
          params.name,
          params.city,
        ]
      );

      // Обновляем групповой объём спонсорской ветки вверх по ltree (@>)
      await client.query(
        `UPDATE partner_nodes ancestor
         SET group_pv = (
           SELECT COALESCE(SUM(descendant.personal_pv), 0)
           FROM partner_nodes descendant
           WHERE descendant.hierarchy_path <@ ancestor.hierarchy_path
             AND descendant.id != ancestor.id
         )
         WHERE ancestor.hierarchy_path @> text2ltree($1)
           AND ancestor.id != $2`,
        [childPath, newPartnerId]
      );

      const starterCode = `PF-${100 + memoryTasks.length + 1}`;
      const starterSubtasks = [
        {
          id: `st-reg-1-${Date.now()}`,
          title: 'Пройти инструктаж с наставником и настроить профиль',
          completed: true,
        },
        {
          id: `st-reg-2-${Date.now()}`,
          title: 'Добавить первых 10 кандидатов в CRM-воронку',
          completed: false,
        },
      ];

      const taskRes = await client.query(
        `INSERT INTO tasks (
          id, brand_id, assignee_partner_id, code, title, description,
          status, priority, project, assignee_name, assignee_role,
          due_date, pv_impact, estimated_hours, playbook_source, subtasks
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          'todo', 'high', 'Запуск партнёров', $7, 'Консультант (Новичок)',
          CURRENT_DATE + INTERVAL '6 days', 400, 4, 'Авто-регистрация партнёра (ltree)', $8::jsonb
        )
        RETURNING id, code, title, description, status, priority, project,
                  assignee_name, assignee_role, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
                  pv_impact, estimated_hours::float AS estimated_hours, playbook_source, subtasks`,
        [
          `task-init-${Date.now()}`,
          brandId,
          newPartnerId,
          starterCode,
          `Стартовый онбординг 14 дней: ${params.name}`,
          `Ввод нового партнёра (${params.city}) в рабочий процесс: список 30 контактов и запуск первого марафона.`,
          params.name,
          JSON.stringify(starterSubtasks),
        ]
      );

      await client.query('COMMIT');
      const pRow = insertPartnerRes.rows[0];
      const tRow = taskRes.rows[0];

      return {
        partner: {
          id: pRow.id,
          uplineId: pRow.upline_id,
          hierarchyPath: pRow.hierarchy_path,
          name: pRow.name,
          city: pRow.city,
          joinedDate: pRow.joined_date,
          uplineName: uplineRow?.name || params.uplineName,
          personalPv: Number(pRow.personal_pv),
          groupPv: Number(pRow.group_pv),
          targetPv: Number(pRow.target_pv),
          activeClients: Number(pRow.active_clients),
          onboardingCompletedSteps: Number(pRow.onboarding_completed_steps),
          onboardingTotalSteps: Number(pRow.onboarding_total_steps),
          status: pRow.status,
        },
        starterTask: {
          id: tRow.id,
          code: tRow.code,
          title: tRow.title,
          description: tRow.description,
          status: tRow.status,
          priority: tRow.priority,
          project: tRow.project,
          assigneeName: tRow.assignee_name,
          assigneeRole: tRow.assignee_role,
          dueDate: tRow.due_date,
          pvImpact: Number(tRow.pv_impact),
          estimatedHours: Number(tRow.estimated_hours),
          playbookSource: tRow.playbook_source,
          subtasks: tRow.subtasks,
        },
        sqlExecuted: transactionSql.trim(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback с идентичным вычислением ltree-пути в памяти
  const uplineNode = memoryPartners.find(
    (p) => p.id === params.uplineId || p.name === params.uplineName
  );
  const childPath = buildChildLtreePath(uplineNode?.hierarchyPath, newPartnerId);

  const newPartner: PartnerNode = {
    id: newPartnerId,
    uplineId: uplineNode?.id || null,
    hierarchyPath: childPath,
    name: params.name,
    city: params.city,
    joinedDate: '2026-10-22',
    uplineName: uplineNode?.name || params.uplineName,
    personalPv: 100,
    groupPv: 0,
    targetPv: 500,
    activeClients: 1,
    onboardingCompletedSteps: 1,
    onboardingTotalSteps: 6,
    status: 'onboarding',
  };

  const starterTask: TaskItem = {
    id: `task-partner-init-${Date.now()}`,
    code: `PF-${100 + memoryTasks.length + 1}`,
    title: `Стартовый онбординг 14 дней: ${params.name}`,
    description: `Ввод нового партнёра (${params.city}) в рабочий процесс: список 30 контактов и запуск первого марафона.`,
    status: 'todo',
    priority: 'high',
    project: 'Запуск партнёров',
    assigneeName: params.name,
    assigneeRole: 'Консультант (Новичок)',
    dueDate: '2026-10-28',
    pvImpact: 400,
    estimatedHours: 4,
    playbookSource: 'Авто-регистрация партнёра (ltree)',
    subtasks: [
      {
        id: `st-reg-1-${Date.now()}`,
        title: 'Пройти инструктаж с наставником и настроить профиль',
        completed: true,
      },
      {
        id: `st-reg-2-${Date.now()}`,
        title: 'Добавить первых 10 кандидатов в CRM-воронку',
        completed: false,
      },
    ],
  };

  memoryPartners = [newPartner, ...memoryPartners];
  recalculateMemoryGroupPv();
  memoryTasks = [starterTask, ...memoryTasks];

  return {
    partner: newPartner,
    starterTask,
    sqlExecuted: transactionSql.trim(),
  };
}

export function getFullMemoryState() {
  return {
    tasks: memoryTasks,
    partners: memoryPartners,
    leads: memoryLeads,
    isPostgresConnected,
  };
}

export function updateMemoryTasks(updater: (prev: TaskItem[]) => TaskItem[]) {
  memoryTasks = updater(memoryTasks);
  return memoryTasks;
}

export function updateMemoryPartners(updater: (prev: PartnerNode[]) => PartnerNode[]) {
  memoryPartners = updater(memoryPartners);
  recalculateMemoryGroupPv();
  return memoryPartners;
}

export function updateMemoryLeads(updater: (prev: CrmLead[]) => CrmLead[]) {
  memoryLeads = updater(memoryLeads);
  return memoryLeads;
}

export function convertMemoryLeadToPartner(leadId: string) {
  const lead = memoryLeads.find((l) => l.id === leadId);
  if (!lead) return null;

  const { updatedLead, newPartner, onboardingTasks } = convertLeadToPartner(
    lead,
    memoryPartners.length,
    memoryTasks.length
  );

  const mentorNode = memoryPartners.find((p) => p.name === lead.mentorName);
  const partnerWithLtree: PartnerNode = {
    ...newPartner,
    uplineId: mentorNode?.id || null,
    hierarchyPath: buildChildLtreePath(mentorNode?.hierarchyPath, newPartner.id),
  };

  memoryLeads = memoryLeads.map((l) => (l.id === leadId ? updatedLead : l));
  memoryPartners = [partnerWithLtree, ...memoryPartners];
  recalculateMemoryGroupPv();
  memoryTasks = [...onboardingTasks, ...memoryTasks];

  return {
    updatedLead,
    newPartner: partnerWithLtree,
    onboardingTasks,
  };
}

export function resetMemoryState() {
  memoryTasks = structuredClone(INITIAL_TASKS);
  memoryPartners = structuredClone(INITIAL_PARTNERS);
  memoryLeads = structuredClone(INITIAL_CRM_LEADS);
  return getFullMemoryState();
}
