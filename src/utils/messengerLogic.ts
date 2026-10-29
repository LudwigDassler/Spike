import { OrganizationNode, WorkspaceMessageRecord, normalizeAccessLevel } from '../types/database';

export type MessengerTargetType = 'direct' | 'department' | 'broadcast' | 'general' | 'task' | 'deal';

export interface ActiveMessengerThread {
  type: 'broadcast' | 'department' | 'direct';
  id: string;
  label: string;
  subtitle?: string;
  telegramConnected?: boolean;
  targetType?: 'broadcast' | 'department' | 'direct';
  targetId?: string;
  targetLabel?: string;
  colleague?: OrganizationNode | null;
}

/**
 * Extracts normalized message text from any supported payload or DB row shape.
 */
export function extractMessageText(raw: Record<string, any> | null | undefined): string {
  if (!raw || typeof raw !== 'object') return '';
  return String(raw.message_text || raw.text || raw.content || raw.message || '').trim();
}

/**
 * Resolves normalized target_type, target_id, and target_label from raw payload or row.
 */
export function resolveMessageAddressing(
  raw: Record<string, any>,
  nodes: Array<Partial<OrganizationNode>> = []
): {
  target_type: MessengerTargetType;
  target_id: string | null;
  target_label: string;
} {
  const rawType = String(raw.target_type || raw.scope_type || raw.scope || '').trim().toLowerCase();
  const explicitTargetId =
    raw.target_id !== undefined && raw.target_id !== null && String(raw.target_id).trim() !== ''
      ? String(raw.target_id).trim()
      : null;
  const recipientId =
    raw.recipient_id !== undefined && raw.recipient_id !== null && String(raw.recipient_id).trim() !== ''
      ? String(raw.recipient_id).trim()
      : null;
  const dept =
    raw.target_department !== undefined &&
    raw.target_department !== null &&
    String(raw.target_department).trim() !== ''
      ? String(raw.target_department).trim()
      : null;

  if (rawType === 'task' || raw.task_id) {
    const taskId = String(raw.task_id || explicitTargetId || raw.entity_id || '').trim() || null;
    const label = String(raw.target_label || raw.entity_title || 'Задача').trim();
    return {
      target_type: 'task',
      target_id: taskId,
      target_label: label,
    };
  }

  if (rawType === 'deal' || rawType === 'lead' || raw.lead_id) {
    const leadId = String(raw.lead_id || explicitTargetId || raw.entity_id || '').trim() || null;
    const label = String(raw.target_label || raw.entity_title || 'Сделка CRM').trim();
    return {
      target_type: 'deal',
      target_id: leadId,
      target_label: label,
    };
  }

  if (rawType === 'direct' || recipientId || (explicitTargetId && rawType !== 'department' && rawType !== 'broadcast' && rawType !== 'general')) {
    const finalTargetId = explicitTargetId || recipientId;
    const matchedNode = finalTargetId
      ? nodes.find((n) => String(n.id) === String(finalTargetId))
      : null;
    const label = String(raw.target_label || matchedNode?.name || 'Личное сообщение').trim();
    return {
      target_type: 'direct',
      target_id: finalTargetId,
      target_label: label,
    };
  }

  if (rawType === 'department' || dept) {
    const finalDept = explicitTargetId || dept || String(raw.target_label || '').trim();
    const label = String(raw.target_label || finalDept || 'Отдел').trim();
    return {
      target_type: 'department',
      target_id: finalDept || null,
      target_label: label,
    };
  }

  return {
    target_type: rawType === 'general' ? 'general' : 'broadcast',
    target_id: explicitTargetId || null,
    target_label: String(raw.target_label || 'Всем сотрудникам').trim(),
  };
}

/**
 * Enforces strict privacy rules for workspace_messages:
 * - direct: ONLY sender and recipient can see (even root/admins cannot read others' direct messages).
 * - department: members of that department and root administrators can see.
 * - general / broadcast: all employees in the company can see.
 * - task / deal comments: visible to company members who can view the entity.
 */
export function canUserSeeWorkspaceMessage(
  msg: Partial<WorkspaceMessageRecord> & Record<string, any>,
  currentUser: Partial<OrganizationNode> | null | undefined
): boolean {
  if (!msg || !currentUser || !currentUser.id) return false;

  const userId = String(currentUser.id).trim();
  const userName = String(currentUser.name || '').trim().toLowerCase();
  const userDept = String(currentUser.department || '').trim().toLowerCase();
  const userAccess = normalizeAccessLevel(currentUser.access_level, currentUser.role_type);

  const rawTargetType = String(msg.target_type || msg.scope_type || '').trim().toLowerCase();
  const targetType: MessengerTargetType =
    rawTargetType === 'direct'
      ? 'direct'
      : rawTargetType === 'department'
      ? 'department'
      : rawTargetType === 'task' || msg.task_id
      ? 'task'
      : rawTargetType === 'deal' || rawTargetType === 'lead' || msg.lead_id
      ? 'deal'
      : msg.recipient_id
      ? 'direct'
      : msg.target_department
      ? 'department'
      : rawTargetType === 'general'
      ? 'general'
      : 'broadcast';

  const senderId = msg.sender_id ? String(msg.sender_id).trim() : '';
  const targetId = msg.target_id
    ? String(msg.target_id).trim()
    : msg.recipient_id
    ? String(msg.recipient_id).trim()
    : '';
  const targetLabel = String(msg.target_label || msg.target_department || '').trim();
  const targetLabelLower = targetLabel.toLowerCase();

  if (targetType === 'direct') {
    if (senderId && senderId === userId) return true;
    if (targetId && targetId === userId) return true;
    if (userName && targetLabelLower && targetLabelLower === userName) return true;
    return false;
  }

  if (targetType === 'department') {
    if (userAccess === 'root') return true;
    if (senderId && senderId === userId) return true;
    if (!userDept) return false;
    const targetIdLower = targetId.toLowerCase();
    return (
      (Boolean(targetIdLower) && userDept === targetIdLower) ||
      (Boolean(targetLabelLower) && userDept === targetLabelLower)
    );
  }

  if (targetType === 'general' || targetType === 'broadcast') {
    return true;
  }

  // Task / Deal comments
  return true;
}

/**
 * Checks whether a message belongs to a specific 1-on-1 direct dialog between currentUser and colleague.
 * Supports both (msg, currentUserObj, colleagueObj) and (msg, myId, myName, colId, colName).
 */
export function isDirectMessageBetweenUsers(
  msg: Partial<WorkspaceMessageRecord> & Record<string, any>,
  currentUserOrId: Partial<OrganizationNode> | string | null | undefined,
  colleagueOrMyName: Partial<OrganizationNode> | string | null | undefined,
  colleagueIdArg?: string | null,
  colleagueNameArg?: string | null
): boolean {
  if (!msg || !currentUserOrId) return false;

  let myId = '';
  let myName = '';
  let colId = '';
  let colName = '';

  if (typeof currentUserOrId === 'object') {
    myId = String(currentUserOrId.id || '').trim();
    myName = String(currentUserOrId.name || '').trim().toLowerCase();
    const colObj =
      typeof colleagueOrMyName === 'object' && colleagueOrMyName !== null
        ? colleagueOrMyName
        : null;
    colId = String(colObj?.id || '').trim();
    colName = String(colObj?.name || '').trim().toLowerCase();
  } else {
    myId = String(currentUserOrId || '').trim();
    myName = String(colleagueOrMyName || '').trim().toLowerCase();
    colId = String(colleagueIdArg || '').trim();
    colName = String(colleagueNameArg || '').trim().toLowerCase();
  }

  if (!myId || (!colId && !colName)) return false;

  const rawTargetType = String(msg.target_type || msg.scope_type || '').trim().toLowerCase();
  const isDirect =
    rawTargetType === 'direct' ||
    Boolean(msg.recipient_id) ||
    (Boolean(msg.target_id) &&
      rawTargetType !== 'department' &&
      rawTargetType !== 'broadcast' &&
      rawTargetType !== 'general' &&
      rawTargetType !== 'task' &&
      rawTargetType !== 'deal');

  if (!isDirect) return false;

  const senderId = String(msg.sender_id || '').trim();
  const senderName = String(msg.sender_name || '').trim().toLowerCase();
  const targetId = String(msg.target_id || msg.recipient_id || '').trim();
  const targetLabel = String(msg.target_label || '').trim().toLowerCase();

  const sentByMeToColleague =
    (senderId === myId || (Boolean(myName) && senderName === myName)) &&
    ((Boolean(colId) && targetId === colId) || (Boolean(colName) && targetLabel === colName));

  const sentByColleagueToMe =
    ((Boolean(colId) && senderId === colId) || (Boolean(colName) && senderName === colName)) &&
    (targetId === myId || (Boolean(myName) && targetLabel === myName));

  return sentByMeToColleague || sentByColleagueToMe;
}

/**
 * Filters visible messages for the active thread in the Split-View Messenger.
 */
export function filterMessagesForActiveThread<
  T extends Partial<WorkspaceMessageRecord> & Record<string, any>
>(
  messages: T[],
  thread: ActiveMessengerThread,
  currentUser: Partial<OrganizationNode> | null | undefined
): T[] {
  const safeList = Array.isArray(messages) ? messages : [];
  const resolvedThreadType = thread.targetType || thread.type || 'broadcast';
  const resolvedThreadId = String(thread.targetId ?? thread.id ?? '').trim();
  const resolvedThreadLabel = String(thread.targetLabel ?? thread.label ?? '').trim();

  const filtered = safeList.filter((msg) => {
    if (!canUserSeeWorkspaceMessage(msg, currentUser)) return false;

    const rawType = String(msg.target_type || msg.scope_type || '').trim().toLowerCase();

    if (resolvedThreadType === 'broadcast') {
      return (
        rawType === 'broadcast' ||
        rawType === 'general' ||
        (!rawType &&
          !msg.target_id &&
          !msg.recipient_id &&
          !msg.target_department &&
          !msg.task_id &&
          !msg.lead_id)
      );
    }

    if (resolvedThreadType === 'department') {
      const deptKey = (resolvedThreadId || resolvedThreadLabel).toLowerCase();
      const msgTargetId = String(msg.target_id || msg.target_department || '').trim().toLowerCase();
      const msgTargetLabel = String(msg.target_label || msg.target_department || '')
        .trim()
        .toLowerCase();
      return (
        (rawType === 'department' || Boolean(msg.target_department)) &&
        (msgTargetId === deptKey || msgTargetLabel === deptKey)
      );
    }

    if (resolvedThreadType === 'direct') {
      const colleagueObj: Partial<OrganizationNode> = thread.colleague || {
        id: resolvedThreadId,
        name: resolvedThreadLabel,
      };
      return isDirectMessageBetweenUsers(msg, currentUser, colleagueObj);
    }

    return false;
  });

  // Sort oldest-to-newest for natural chat reading order (top = oldest / Yesterday, bottom = newest / Today)
  const getSafeTime = (m: any): number => {
    const raw = m?.created_at || m?.timestamp || m?.inserted_at;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  return [...filtered].sort((a, b) => getSafeTime(a) - getSafeTime(b));
}
