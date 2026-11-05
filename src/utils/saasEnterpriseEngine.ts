import { AuditLogRecord, SubscriptionPlanTier } from '../types/database';

export interface AiQuotaState {
  planTier: string;
  usedToday: number;
  dailyLimit: number | 'unlimited';
  remaining: number | 'unlimited';
  isExhausted: boolean;
  labelRu: string;
  labelEn: string;
}

const AI_QUOTA_STORAGE_PREFIX = 'tedcloud_ai_quota_v1_';
const AUDIT_LOG_STORAGE_PREFIX = 'tedcloud_immutable_audit_v1_';

function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function resolvePlanDailyLimit(planTier?: SubscriptionPlanTier | string | null): number | 'unlimited' {
  const normalized = String(planTier || 'Business').toLowerCase().trim();
  if (normalized === 'enterprise') return 'unlimited';
  if (normalized === 'business') return 150;
  return 15;
}

export function getAiQuotaState(
  companyId: string,
  planTier?: SubscriptionPlanTier | string | null
): AiQuotaState {
  const safeCompany = String(companyId || 'default');
  const limit = resolvePlanDailyLimit(planTier);
  const dateKey = getTodayDateKey();
  const storageKey = `${AI_QUOTA_STORAGE_PREFIX}${safeCompany}_${dateKey}`;
  let usedToday = 0;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(parsed) && parsed >= 0) {
        usedToday = parsed;
      }
    } catch {}
  }

  const normalizedPlan = String(planTier || 'Business');
  if (limit === 'unlimited') {
    return {
      planTier: normalizedPlan,
      usedToday,
      dailyLimit: 'unlimited',
      remaining: 'unlimited',
      isExhausted: false,
      labelRu: `Квота AI: ${usedToday} / ∞ (Enterprise)`,
      labelEn: `AI Quota: ${usedToday} / ∞ (Enterprise)`,
    };
  }

  const remaining = Math.max(0, limit - usedToday);
  const isExhausted = usedToday >= limit;

  return {
    planTier: normalizedPlan,
    usedToday,
    dailyLimit: limit,
    remaining,
    isExhausted,
    labelRu: `Квота AI: ${usedToday} / ${limit}`,
    labelEn: `AI Quota: ${usedToday} / ${limit}`,
  };
}

export function incrementAiQuotaUsage(
  companyId: string,
  planTier?: SubscriptionPlanTier | string | null,
  incrementBy = 1
): AiQuotaState {
  const current = getAiQuotaState(companyId, planTier);
  if (current.dailyLimit !== 'unlimited' && current.isExhausted) {
    return current;
  }
  const safeCompany = String(companyId || 'default');
  const dateKey = getTodayDateKey();
  const storageKey = `${AI_QUOTA_STORAGE_PREFIX}${safeCompany}_${dateKey}`;
  const nextUsed = current.usedToday + Math.max(1, incrementBy);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, String(nextUsed));
    } catch {}
  }
  return getAiQuotaState(companyId, planTier);
}

export function exportToCsvOrXlsx(filename: string, rows: Record<string, any>[]): void {
  if (typeof window === 'undefined' || !Array.isArray(rows) || rows.length === 0) return;

  const headersSet = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((k) => headersSet.add(k));
    }
  }
  const headers = Array.from(headersSet);
  if (headers.length === 0) return;

  const escapeCsvCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str =
      typeof val === 'object'
        ? JSON.stringify(val).replace(/"/g, '""')
        : String(val).replace(/"/g, '""');
    return `"${str.replace(/\r?\n/g, ' ')}"`;
  };

  const csvLines = [
    headers.map(escapeCsvCell).join(';'),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row?.[h])).join(';')),
  ];

  const bomContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([bomContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.href = url;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ImmutableAuditInput {
  companyId: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  actionType: string;
  targetEntity: string;
  ipOrChannel?: string;
  details?: string;
}

export function getLocalImmutableAuditLogs(companyId: string): AuditLogRecord[] {
  if (typeof window === 'undefined') return [];
  const key = `${AUDIT_LOG_STORAGE_PREFIX}${companyId || 'default'}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordImmutableAuditEntry(input: ImmutableAuditInput): AuditLogRecord {
  const entry: AuditLogRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    company_id: input.companyId || 'default',
    actor_id: input.actorId || null,
    actor_name: input.actorName || 'System',
    actor_role: input.actorRole || 'member',
    action_type: input.actionType,
    entity_type: input.targetEntity,
    details: `${input.details ? `${input.details} · ` : ''}[${input.ipOrChannel || 'Web HTTPS / TLS 1.3'}]`,
    created_at: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const key = `${AUDIT_LOG_STORAGE_PREFIX}${input.companyId || 'default'}`;
    try {
      const existing = getLocalImmutableAuditLogs(input.companyId);
      const next = [entry, ...existing].slice(0, 250);
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('tedcloud-audit-updated'));
    } catch {}
  }

  return entry;
}

export interface ErrorTelemetryEvent {
  id: string;
  timestamp: string;
  source: 'window.onerror' | 'unhandledrejection' | 'ErrorBoundary' | 'ManualProbe';
  message: string;
  stack: string;
  url: string;
}

let telemetryLogs: ErrorTelemetryEvent[] = [];
let telemetryListeners: Array<() => void> = [];
let isErrorTelemetryInstalled = false;

function notifyTelemetryListeners() {
  telemetryListeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

export function recordTelemetryError(
  source: ErrorTelemetryEvent['source'],
  message: string,
  stack?: string
): void {
  const cleanMsg = String(message || 'Unknown runtime exception');
  if (
    cleanMsg.includes('WebSocket closed without opened') ||
    cleanMsg.includes('AbortError') ||
    cleanMsg.includes('The user aborted a request')
  ) {
    return;
  }

  const item: ErrorTelemetryEvent = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    source,
    message: cleanMsg,
    stack: stack || 'No stack trace available',
    url: typeof window !== 'undefined' ? window.location.pathname : '/',
  };

  telemetryLogs = [item, ...telemetryLogs].slice(0, 50);
  notifyTelemetryListeners();
}

export function installGlobalErrorTelemetry(): void {
  if (typeof window === 'undefined' || isErrorTelemetryInstalled) return;
  isErrorTelemetryInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    recordTelemetryError(
      'window.onerror',
      event.message || String(event.error || 'Window script error'),
      event.error?.stack || `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`
    );
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || 'Unhandled Promise Rejection');
    const stack = reason?.stack || String(reason || '');
    recordTelemetryError('unhandledrejection', msg, stack);
  });
}

export function getErrorTelemetryLogs(): ErrorTelemetryEvent[] {
  return telemetryLogs;
}

export function clearErrorTelemetryLogs(): void {
  telemetryLogs = [];
  notifyTelemetryListeners();
}

export function subscribeErrorTelemetry(cb: () => void): () => void {
  telemetryListeners.push(cb);
  return () => {
    telemetryListeners = telemetryListeners.filter((x) => x !== cb);
  };
}
