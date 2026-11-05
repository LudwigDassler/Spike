import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { AuthGate } from './components/AuthGate';
import {
  AuditLogRecord,
  BillingInvoiceRecord,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
  WorkShiftRecord,
  WorkspaceMessageRecord,
} from './types/database';
import { LocaleProvider, useLocale } from './i18n/LocaleContext';
import { formatError } from './utils/enterpriseLogic';
import {
  installGlobalErrorTelemetry,
  recordImmutableAuditEntry,
  recordTelemetryError,
} from './utils/saasEnterpriseEngine';

const SESSION_PROFILE_ID_KEY = 'tedcloud_session_profile_id';
const SESSION_CHAT_ID_KEY = 'tedcloud_chat_id';
const SESSION_COMPANY_ID_KEY = 'tedcloud_session_company_id';

async function safeParseJson(response: Response): Promise<any> {
  const rawText = await response.text();
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return { error: `HTTP ${response.status}: ${rawText.slice(0, 180)}` };
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorText: string;
}

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return {
      hasError: true,
      errorText: formatError(error),
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[GlobalErrorBoundary] Caught runtime error:', error, errorInfo);
    recordTelemetryError(
      'ErrorBoundary',
      formatError(error),
      error?.stack || String(errorInfo?.componentStack || '')
    );
  }

  handleResetCache = () => {
    try {
      localStorage.removeItem(SESSION_PROFILE_ID_KEY);
      localStorage.removeItem(SESSION_CHAT_ID_KEY);
      localStorage.removeItem(SESSION_COMPANY_ID_KEY);
      localStorage.removeItem('tedcloud_custom_departments');
    } catch {}
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full rounded-xl border border-[#262626] bg-[#121214] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-semibold">
                Обнаружено несоответствие кэша сессии
              </h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Структура данных в браузере устарела после обновления платформы. Сбросьте локальный кэш сессии для безопасной перезагрузки рабочего пространства.
            </p>
            {this.state.errorText && (
              <div className="text-[11px] font-sans text-[#71717A] bg-[#18181B] p-2.5 rounded-lg border border-[#27272A] break-words">
                {this.state.errorText}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleResetCache}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#E4E4E7] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Сбросить кэш сессии и перезагрузить</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { t } = useLocale();
  const [company, setCompany] = useState<Company | null>(null);
  const [currentProfile, setCurrentProfile] = useState<OrganizationNode | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [leads, setLeads] = useState<CrmLeadRecord[]>([]);
  const [messages, setMessages] = useState<WorkspaceMessageRecord[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceRecord[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShiftRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverBotUsername, setServerBotUsername] = useState<string>('');

  const isFetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recentMessagePatchesRef = useRef<
    Map<string, { updates: Record<string, any>; timestamp: number }>
  >(new Map());
  const recentSentMessagesRef = useRef<
    Map<string, { message: WorkspaceMessageRecord; timestamp: number }>
  >(new Map());
  const latestMaxMsgTimestampRef = useRef<number>(0);

  useEffect(() => {
    installGlobalErrorTelemetry();
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg = String(event?.reason?.message || event?.reason || '');
      event.preventDefault();
      if (
        reasonMsg.includes('WebSocket closed without opened') ||
        reasonMsg.includes('AbortError') ||
        reasonMsg.includes('The user aborted a request')
      ) {
        return;
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  const loadWorkspaceData = useCallback(async (isInitial = false, silent = false) => {
    // Prevent overlapping background polls (Block 4)
    if (silent && isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    if (!silent && abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isInitial) setIsLoading(true);
    if (!silent) {
      setIsSyncing(true);
      setErrorMessage(null);
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const urlInvite = params.get('invite')?.trim() || null;
      const urlTgId = params.get('tg_id')?.trim() || null;
      const urlChatId = params.get('chatId')?.trim() || null;

      // If URL contains a 1-click login parameter (?invite=, ?tg_id=, ?chatId=), prioritize it over stale localStorage session
      const hasUrlAutoAuth = Boolean(urlInvite || urlTgId || urlChatId);
      const storedChatId = localStorage.getItem(SESSION_CHAT_ID_KEY);
      const storedProfileId = hasUrlAutoAuth
        ? null
        : localStorage.getItem(SESSION_PROFILE_ID_KEY);
      const storedCompanyId = hasUrlAutoAuth
        ? null
        : localStorage.getItem(SESSION_COMPANY_ID_KEY);

      const resolvedChatId = urlTgId || urlChatId || storedChatId || null;
      if (urlTgId || urlChatId) {
        try {
          localStorage.setItem(SESSION_CHAT_ID_KEY, urlTgId || urlChatId || '');
        } catch {}
      }
      setActiveChatId((prev) => (prev === resolvedChatId ? prev : resolvedChatId));

      const queryParams = new URLSearchParams();
      if (urlInvite) queryParams.set('invite', urlInvite);
      if (urlTgId) queryParams.set('tg_id', urlTgId);
      if (resolvedChatId) queryParams.set('chatId', resolvedChatId);
      if (storedProfileId) queryParams.set('profileId', storedProfileId);
      if (storedCompanyId) queryParams.set('company_id', storedCompanyId);

      const qs = queryParams.toString();
      const endpoint = qs ? `/api/db?${qs}` : '/api/db';

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });

      const payload = await safeParseJson(response);

      if (!response.ok || payload?.error) {
        throw new Error(formatError(payload?.error || `HTTP ${response.status}`));
      }

      const loadedNodes: OrganizationNode[] = Array.isArray(payload.nodes)
        ? payload.nodes
        : [];
      const nextCompany = payload.company || null;
      const nextTasks: TaskRecord[] = Array.isArray(payload.tasks) ? payload.tasks : [];
      const nextLeads: CrmLeadRecord[] = Array.isArray(payload.leads) ? payload.leads : [];
      const nextInvoices: BillingInvoiceRecord[] = Array.isArray(payload.invoices)
        ? payload.invoices
        : [];
      const nextWorkShifts: WorkShiftRecord[] = Array.isArray(payload.workShifts)
        ? payload.workShifts
        : [];
      const nextAuditLogs: AuditLogRecord[] = Array.isArray(payload.auditLogs)
        ? payload.auditLogs
        : [];

      setCompany((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(nextCompany) ? prev : nextCompany
      );
      setNodes((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(loadedNodes) ? prev : loadedNodes
      );
      setTasks((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(nextTasks) ? prev : nextTasks
      );
      setLeads((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(nextLeads) ? prev : nextLeads
      );
      setMessages((prev) => {
        const now = Date.now();
        for (const [k, v] of recentMessagePatchesRef.current.entries()) {
          if (now - v.timestamp > 12000) {
            recentMessagePatchesRef.current.delete(k);
          }
        }
        for (const [k, v] of recentSentMessagesRef.current.entries()) {
          if (now - v.timestamp > 30000) {
            recentSentMessagesRef.current.delete(k);
          }
        }

        const prevArr = Array.isArray(prev) ? prev : [];
        const prevClientKeyById = new Map<string, string>();
        for (const pm of prevArr) {
          const pid = String(pm.id || '');
          const cKey = (pm as any)._clientKey;
          if (pid && cKey) {
            prevClientKeyById.set(pid, cKey);
          }
        }

        const serverList: WorkspaceMessageRecord[] = Array.isArray(payload.messages)
          ? payload.messages
          : [];
        const seenIds = new Set<string>();
        const dedupedServer: WorkspaceMessageRecord[] = [];
        let maxTs = latestMaxMsgTimestampRef.current;

        for (const m of serverList) {
          const mid = String(m.id || '');
          if (mid && seenIds.has(mid)) continue;
          const mSender = String(m.sender_id || '');
          const mText = String(m.message_text || m.text || '').trim();
          const mTime = m.created_at ? new Date(m.created_at).getTime() : 0;
          if (mTime > maxTs) maxTs = mTime;

          const isNearDuplicate = dedupedServer.some((existing) => {
            const eSender = String(existing.sender_id || '');
            const eText = String(existing.message_text || existing.text || '').trim();
            const eTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
            return (
              eSender === mSender &&
              eText === mText &&
              mText.length > 0 &&
              mTime > 0 &&
              eTime > 0 &&
              Math.abs(mTime - eTime) <= 2500
            );
          });
          if (isNearDuplicate) continue;
          if (mid) seenIds.add(mid);
          const recentPatch = mid ? recentMessagePatchesRef.current.get(mid) : undefined;
          const existingClientKey = mid ? prevClientKeyById.get(mid) : undefined;
          const mergedMsg: any = recentPatch ? { ...m, ...recentPatch.updates } : { ...m };
          if (existingClientKey) {
            mergedMsg._clientKey = existingClientKey;
          }
          dedupedServer.push(mergedMsg);
        }

        // Ensure recently sent messages (optimistic or confirmed within the last 30s) are never dropped by an in-flight poll
        const pendingRecent: WorkspaceMessageRecord[] = [];
        for (const [, entry] of recentSentMessagesRef.current.entries()) {
          const rm = entry.message;
          const rmId = String(rm.id || '');
          const rmSender = String(rm.sender_id || '');
          const rmText = String(rm.message_text || rm.text || '').trim();
          const rmTime = rm.created_at ? new Date(rm.created_at).getTime() : 0;
          if (rmTime > maxTs) maxTs = rmTime;

          const matchedIndex = dedupedServer.findIndex((srv) => {
            if (rmId && !rmId.startsWith('optimistic_') && String(srv.id || '') === rmId) {
              return true;
            }
            const srvSender = String(srv.sender_id || '');
            const srvText = String(srv.message_text || srv.text || '').trim();
            const srvTime = srv.created_at ? new Date(srv.created_at).getTime() : 0;
            return (
              srvSender === rmSender &&
              srvText === rmText &&
              srvTime > 0 &&
              Math.abs(srvTime - rmTime) <= 10000
            );
          });

          if (matchedIndex !== -1) {
            const srvItem: any = dedupedServer[matchedIndex];
            if ((rm as any)._clientKey && !srvItem._clientKey) {
              srvItem._clientKey = (rm as any)._clientKey;
            }
            // Preserve monotonic created_at if server returned an older clock value
            if (rmTime > 0) {
              const srvTime = srvItem.created_at ? new Date(srvItem.created_at).getTime() : 0;
              if (rmTime > srvTime) {
                srvItem.created_at = rm.created_at;
              }
            }
          } else {
            pendingRecent.push(rm);
          }
        }

        latestMaxMsgTimestampRef.current = maxTs;

        const nextList =
          pendingRecent.length > 0 ? [...pendingRecent, ...dedupedServer] : dedupedServer;

        if (silent && prevArr.length === nextList.length) {
          let identical = true;
          for (let i = 0; i < prevArr.length; i++) {
            const a = prevArr[i];
            const b = nextList[i];
            if (
              a.id !== b.id ||
              (a.message_text || a.text || '') !== (b.message_text || b.text || '') ||
              JSON.stringify(a.reactions || {}) !== JSON.stringify(b.reactions || {}) ||
              JSON.stringify(a.acknowledged_by || []) !== JSON.stringify(b.acknowledged_by || [])
            ) {
              identical = false;
              break;
            }
          }
          if (identical) {
            return prevArr;
          }
        }

        return nextList;
      });
      setInvoices((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(nextInvoices) ? prev : nextInvoices
      );
      setWorkShifts((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(nextWorkShifts) ? prev : nextWorkShifts
      );
      setAuditLogs((prev) =>
        silent && JSON.stringify(prev) === JSON.stringify(nextAuditLogs) ? prev : nextAuditLogs
      );

      if (typeof payload.botUsername === 'string' && payload.botUsername.trim()) {
        const cleanBot = payload.botUsername.replace(/^@/, '').trim();
        setServerBotUsername((prev) => (prev === cleanBot ? prev : cleanBot));
        try {
          localStorage.setItem('tedcloud_bot_username', cleanBot);
        } catch {}
      }

      if (payload.currentProfile) {
        const nextProf = payload.currentProfile;
        setCurrentProfile((prev) =>
          silent && JSON.stringify(prev) === JSON.stringify(nextProf) ? prev : nextProf
        );
        try {
          localStorage.setItem(SESSION_PROFILE_ID_KEY, nextProf.id);
          if (nextProf.company_id) {
            localStorage.setItem(SESSION_COMPANY_ID_KEY, nextProf.company_id);
          } else if (payload.company?.id) {
            localStorage.setItem(SESSION_COMPANY_ID_KEY, payload.company.id);
          }
          if (nextProf.telegram_chat_id) {
            localStorage.setItem(SESSION_CHAT_ID_KEY, String(nextProf.telegram_chat_id));
          }
        } catch {}
        if (hasUrlAutoAuth) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('invite');
          cleanUrl.searchParams.delete('tg_id');
          cleanUrl.searchParams.delete('chatId');
          window.history.replaceState({}, '', cleanUrl.toString());
        }
      } else if (storedProfileId) {
        const matched = loadedNodes.find((n) => n.id === storedProfileId) || null;
        setCurrentProfile((prev) =>
          silent && JSON.stringify(prev) === JSON.stringify(matched) ? prev : matched
        );
        if (!matched) {
          try {
            localStorage.removeItem(SESSION_PROFILE_ID_KEY);
            localStorage.removeItem(SESSION_COMPANY_ID_KEY);
          } catch {}
        }
      } else if (params.get('autostart') === '1' && loadedNodes.length > 0) {
        const autoNode = loadedNodes[0];
        setCurrentProfile((prev) =>
          silent && JSON.stringify(prev) === JSON.stringify(autoNode) ? prev : autoNode
        );
        try {
          localStorage.setItem(SESSION_PROFILE_ID_KEY, autoNode.id);
          if (autoNode.company_id) {
            localStorage.setItem(SESSION_COMPANY_ID_KEY, autoNode.company_id);
          }
        } catch {}
      } else {
        setCurrentProfile(null);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (!silent) {
        console.error('[App] Failed to fetch workspace data from /api/db:', err);
        setErrorMessage(formatError(err));
      }
    } finally {
      isFetchingRef.current = false;
      if (isInitial) setIsLoading(false);
      if (!silent) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData(true);
  }, [loadWorkspaceData]);

  useEffect(() => {
    if (!currentProfile?.id) return;
    const interval = setInterval(() => {
      void loadWorkspaceData(false, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [currentProfile?.id, loadWorkspaceData]);

  const handleAuthenticated = useCallback(
    async (profile: OrganizationNode, authCompany: Company | null) => {
      try {
        localStorage.setItem(SESSION_PROFILE_ID_KEY, profile.id);
        if (profile.company_id) {
          localStorage.setItem(SESSION_COMPANY_ID_KEY, profile.company_id);
        } else if (authCompany?.id) {
          localStorage.setItem(SESSION_COMPANY_ID_KEY, authCompany.id);
        }
        if (profile.telegram_chat_id) {
          localStorage.setItem(SESSION_CHAT_ID_KEY, String(profile.telegram_chat_id));
        } else {
          localStorage.removeItem(SESSION_CHAT_ID_KEY);
        }
      } catch {}
      // Clear stale state before loading the newly authenticated workspace
      setNodes([profile]);
      setTasks([]);
      setLeads([]);
      setMessages([]);
      setInvoices([]);
      setWorkShifts([]);
      setAuditLogs([]);
      setCurrentProfile(profile);
      setCompany(authCompany);
      await loadWorkspaceData(false);
    },
    [loadWorkspaceData]
  );

  const handlePatchRecord = useCallback(
    async (
      table:
        | 'tasks'
        | 'crm_leads'
        | 'organization_nodes'
        | 'companies'
        | 'billing_invoices'
        | 'workspace_messages',
      id: string,
      updates: Record<string, any>
    ): Promise<{ ok: boolean; pushSent?: boolean }> => {
      // Optimistic UI (0ms instant update — Block 4)
      if (table === 'tasks') {
        setTasks((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) =>
            item.id === id ? { ...item, ...updates } : item
          )
        );
      } else if (table === 'crm_leads') {
        setLeads((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) =>
            item.id === id ? { ...item, ...updates } : item
          )
        );
      } else if (table === 'organization_nodes') {
        setNodes((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) =>
            item.id === id ? { ...item, ...updates } : item
          )
        );
        setCurrentProfile((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
      } else if (table === 'companies') {
        setCompany((prev) => (prev ? { ...prev, ...updates } : prev));
      } else if (table === 'billing_invoices') {
        setInvoices((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) =>
            item.id === id ? { ...item, ...updates } : item
          )
        );
      } else if (table === 'workspace_messages') {
        recentMessagePatchesRef.current.set(String(id), {
          updates,
          timestamp: Date.now(),
        });
        setMessages((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) =>
            item.id === id ? { ...item, ...updates, created_at: item.created_at } : item
          )
        );
      }

      try {
        const response = await fetch('/api/db', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table,
            id,
            updates: {
              ...updates,
              actor_id: currentProfile?.id,
              actor_name: currentProfile?.name,
              actor_role: currentProfile?.role_type,
            },
          }),
        });
        const result = await safeParseJson(response);

        if (!response.ok || result?.error) {
          throw new Error(formatError(result?.error || `HTTP ${response.status}`));
        }

        if (table === 'tasks' && result.data) {
          setTasks((prev) =>
            (Array.isArray(prev) ? prev : []).map((item) =>
              item.id === id ? { ...result.data, created_at: item.created_at || result.data.created_at } : item
            )
          );
        } else if (table === 'crm_leads' && result.data) {
          setLeads((prev) =>
            (Array.isArray(prev) ? prev : []).map((item) =>
              item.id === id ? { ...result.data, created_at: item.created_at || result.data.created_at } : item
            )
          );
        } else if (table === 'organization_nodes' && result.data) {
          setNodes((prev) =>
            (Array.isArray(prev) ? prev : []).map((item) =>
              item.id === id ? { ...result.data, created_at: item.created_at || result.data.created_at } : item
            )
          );
          setCurrentProfile((prev) =>
            prev && prev.id === id
              ? { ...result.data, created_at: prev.created_at || result.data.created_at }
              : prev
          );
        } else if (table === 'companies' && result.data) {
          setCompany((prev) => (prev ? { ...prev, ...result.data } : result.data));
        } else if (table === 'billing_invoices' && result.data) {
          setInvoices((prev) =>
            (Array.isArray(prev) ? prev : []).map((item) =>
              item.id === id ? result.data : item
            )
          );
        } else if (table === 'workspace_messages' && result.data) {
          setMessages((prev) =>
            (Array.isArray(prev) ? prev : []).map((item) =>
              item.id === id
                ? {
                    ...item,
                    ...result.data,
                    ...updates,
                    created_at: item.created_at || result.data.created_at,
                  }
                : item
            )
          );
        }

        const isShiftOnlyUpdate =
          table === 'organization_nodes' &&
          Object.keys(updates).every((k) => k === 'shift_status' || k === 'shift_started_at');

        if (table !== 'workspace_messages' && !isShiftOnlyUpdate) {
          recordImmutableAuditEntry({
            companyId: company?.id || currentProfile?.company_id || 'default',
            actorId: currentProfile?.id,
            actorName: currentProfile?.name || 'Admin',
            actorRole: currentProfile?.role_type || 'Manager',
            actionType:
              table === 'organization_nodes' && (updates.access_level || updates.permissions)
                ? 'PERMISSIONS_UPDATED'
                : 'UPDATE',
            targetEntity: table,
            details: `Обновлена запись в «${table}» (ID: ${id.slice(0, 8)})`,
          });
          void loadWorkspaceData(false, true);
        }

        return {
          ok: true,
          pushSent: Boolean(result.telegramPush?.pushed),
        };
      } catch (err: any) {
        console.error(`[App] PATCH ${table} error:`, err);
        setErrorMessage(formatError(err));
        if (table !== 'workspace_messages') {
          void loadWorkspaceData(false, true);
        }
        return { ok: false };
      }
    },
    [currentProfile, loadWorkspaceData]
  );

  const handleCreateInvoice = useCallback(
    async (
      invoicePayload: Record<string, any>
    ): Promise<{ ok: boolean; invoice?: BillingInvoiceRecord }> => {
      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'billing_invoices',
            payload: {
              ...invoicePayload,
              actor_id: currentProfile?.id,
              actor_name: currentProfile?.name,
              actor_role: currentProfile?.role_type,
            },
          }),
        });
        const result = await safeParseJson(response);

        if (!response.ok || result?.error) {
          throw new Error(formatError(result?.error || `HTTP ${response.status}`));
        }

        if (result.data) {
          setInvoices((prev) => [result.data, ...(Array.isArray(prev) ? prev : [])]);
        }

        void loadWorkspaceData(false, true);

        return {
          ok: true,
          invoice: result.data,
        };
      } catch (err: any) {
        console.error('[App] POST billing_invoices error:', err);
        setErrorMessage(formatError(err));
        return { ok: false };
      }
    },
    [currentProfile, loadWorkspaceData]
  );

  const handleCreateWorkShift = useCallback(
    async (shiftPayload: Partial<WorkShiftRecord>): Promise<void> => {
      const optimisticShift: WorkShiftRecord = {
        id: `shift_${Date.now()}`,
        company_id: shiftPayload.company_id || company?.id || 'default',
        employee_id: shiftPayload.employee_id || currentProfile?.id || 'root',
        employee_name: shiftPayload.employee_name || currentProfile?.name || 'Сотрудник',
        role_type: shiftPayload.role_type || currentProfile?.role_type || 'Специалист',
        department: shiftPayload.department ?? currentProfile?.department ?? null,
        started_at: shiftPayload.started_at || new Date().toISOString(),
        ended_at: shiftPayload.ended_at || new Date().toISOString(),
        duration_minutes: Math.max(1, Number(shiftPayload.duration_minutes ?? 1)),
        tasks_completed: Number(shiftPayload.tasks_completed ?? 0),
        summary: shiftPayload.summary || null,
        created_at: new Date().toISOString(),
      };
      setWorkShifts((prev) => [optimisticShift, ...(Array.isArray(prev) ? prev : [])]);

      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'work_shifts',
            payload: optimisticShift,
          }),
        });
        const result = await safeParseJson(response);
        if (response.ok && result?.data) {
          setWorkShifts((prev) =>
            (Array.isArray(prev) ? prev : []).map((s) =>
              s.id === optimisticShift.id ? result.data : s
            )
          );
        }
        void loadWorkspaceData(false, true);
      } catch (err) {
        console.warn('[App] POST work_shifts warning:', err);
      }
    },
    [company?.id, currentProfile, loadWorkspaceData]
  );

  const handleSendMessage = useCallback(
    async (
      messagePayload: Record<string, any>
    ): Promise<{ ok: boolean; pushSent?: boolean }> => {
      // Optimistic UI (0ms instant bubble rendering — Block 4)
      const tempId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const monotonicTime = Math.max(Date.now(), latestMaxMsgTimestampRef.current + 1000);
      latestMaxMsgTimestampRef.current = monotonicTime;
      const monotonicCreatedAt = new Date(monotonicTime).toISOString();

      const optimisticMessage: WorkspaceMessageRecord & { _clientKey?: string } = {
        id: tempId,
        _clientKey: tempId,
        company_id: messagePayload.company_id || null,
        sender_id: messagePayload.sender_id || null,
        sender_name: messagePayload.sender_name || 'Сотрудник TedCloud',
        sender_role: messagePayload.sender_role || '',
        target_type: messagePayload.target_type || 'broadcast',
        target_id: messagePayload.target_id || 'general',
        target_label: messagePayload.target_label || 'Циркуляр по компании',
        scope_type: messagePayload.scope_type || messagePayload.target_type || 'broadcast',
        recipient_id: messagePayload.recipient_id || null,
        target_department: messagePayload.target_department || null,
        message_text: messagePayload.message_text || messagePayload.text || '',
        text: messagePayload.text || messagePayload.message_text || '',
        is_urgent: Boolean(messagePayload.is_urgent),
        is_read: false,
        attachments: Array.isArray(messagePayload.attachments)
          ? messagePayload.attachments
          : [],
        reactions: {},
        reply_to: messagePayload.reply_to || null,
        created_at: monotonicCreatedAt,
      };

      recentSentMessagesRef.current.set(tempId, {
        message: optimisticMessage,
        timestamp: Date.now(),
      });

      setMessages((prev) => [optimisticMessage, ...(Array.isArray(prev) ? prev : [])]);

      const payloadWithCreatedAt = {
        ...messagePayload,
        created_at: monotonicCreatedAt,
      };

      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'workspace_messages', payload: payloadWithCreatedAt }),
        });
        const result = await safeParseJson(response);

        if (!response.ok || result?.error) {
          throw new Error(formatError(result?.error || `HTTP ${response.status}`));
        }

        if (result.data) {
          const srvTime = result.data.created_at
            ? new Date(result.data.created_at).getTime()
            : 0;
          const confirmedMsg: WorkspaceMessageRecord & { _clientKey?: string } = {
            ...result.data,
            _clientKey: tempId,
            created_at:
              srvTime >= monotonicTime ? result.data.created_at : monotonicCreatedAt,
          };
          recentSentMessagesRef.current.set(tempId, {
            message: confirmedMsg,
            timestamp: Date.now(),
          });

          setMessages((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            let foundTemp = false;
            const replaced = list.map((m) => {
              if (m.id === tempId || (m as any)._clientKey === tempId) {
                foundTemp = true;
                return confirmedMsg;
              }
              return m;
            });
            const merged = foundTemp ? replaced : [confirmedMsg, ...replaced];
            const seen = new Set<string>();
            return merged.filter((m) => {
              const idStr = String(m.id || '');
              if (!idStr) return true;
              if (seen.has(idStr)) return false;
              seen.add(idStr);
              return true;
            });
          });
        }

        return {
          ok: true,
          pushSent: Boolean(result.telegramPush?.pushed),
        };
      } catch (err: any) {
        console.error('[App] POST workspace_messages error:', err);
        recentSentMessagesRef.current.delete(tempId);
        setMessages((prev) =>
          (Array.isArray(prev) ? prev : []).filter((m) => m.id !== tempId)
        );
        setErrorMessage(formatError(err));
        return { ok: false };
      }
    },
    []
  );

  const handleDeleteRecord = useCallback(
    async (
      table: 'tasks' | 'crm_leads' | 'organization_nodes',
      id: string
    ): Promise<boolean> => {
      try {
        const response = await fetch('/api/db', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table,
            id,
            actor_id: currentProfile?.id,
            actor_name: currentProfile?.name,
            actor_role: currentProfile?.role_type,
          }),
        });
        const result = await safeParseJson(response);

        if (!response.ok || result?.error) {
          throw new Error(formatError(result?.error || `HTTP ${response.status}`));
        }

        if (table === 'tasks') {
          setTasks((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== id));
        } else if (table === 'crm_leads') {
          setLeads((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== id));
        } else if (table === 'organization_nodes') {
          setNodes((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== id));
        }

        recordImmutableAuditEntry({
          companyId: company?.id || currentProfile?.company_id || 'default',
          actorId: currentProfile?.id,
          actorName: currentProfile?.name || 'Admin',
          actorRole: currentProfile?.role_type || 'Manager',
          actionType: 'DELETE',
          targetEntity: table,
          details: `Удален объект из «${table}» (ID: ${id.slice(0, 8)})`,
        });

        void loadWorkspaceData(false, true);

        return true;
      } catch (err: any) {
        console.error(`[App] DELETE ${table} error:`, err);
        setErrorMessage(formatError(err));
        return false;
      }
    },
    [currentProfile, loadWorkspaceData]
  );

  const handleResetSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_PROFILE_ID_KEY);
      localStorage.removeItem(SESSION_CHAT_ID_KEY);
      localStorage.removeItem(SESSION_COMPANY_ID_KEY);
      localStorage.removeItem('tedcloud_custom_departments');
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.delete('chatId');
    url.searchParams.delete('tg_id');
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
    setErrorMessage(null);
    setActiveChatId(null);
    setCurrentProfile(null);
    setCompany(null);
    setNodes([]);
    setTasks([]);
    setLeads([]);
    setMessages([]);
    setInvoices([]);
    setWorkShifts([]);
    setAuditLogs([]);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center gap-3 font-sans">
        <Loader2 className="w-6 h-6 animate-spin text-[#A1A1AA]" />
        <p className="text-xs text-[#8E8E93]">{t('system.loading')}</p>
      </div>
    );
  }

  if (
    errorMessage &&
    nodes.length === 0 &&
    tasks.length === 0 &&
    leads.length === 0 &&
    !currentProfile
  ) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-xl border border-[#262626] bg-[#121214] p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-2.5 text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-semibold">{t('system.connectionError')}</h2>
          </div>
          <p className="text-xs text-[#A1A1AA] leading-relaxed break-words bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            {formatError(errorMessage)}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => loadWorkspaceData(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#E4E4E7] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('system.retry')}</span>
            </button>
            <button
              type="button"
              onClick={handleResetSession}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#27272A] bg-[#18181B] text-[#E4E4E7] text-xs font-medium hover:bg-[#222226] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Сбросить сессию / Войти заново</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <AuthGate
        existingNodes={nodes}
        nodes={nodes}
        tasks={tasks}
        leads={leads}
        existingCompany={company}
        company={company}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <Dashboard
      company={company}
      currentProfile={currentProfile}
      activeChatId={activeChatId}
      botUsername={serverBotUsername}
      nodes={nodes}
      tasks={tasks}
      leads={leads}
      messages={messages}
      invoices={invoices}
      workShifts={workShifts}
      auditLogs={auditLogs}
      isSyncing={isSyncing}
      onRefresh={() => loadWorkspaceData(false)}
      onPatchRecord={handlePatchRecord}
      onDeleteRecord={handleDeleteRecord}
      onSendMessage={handleSendMessage}
      onCreateInvoice={handleCreateInvoice}
      onCreateWorkShift={handleCreateWorkShift}
      onResetSession={handleResetSession}
    />
  );
}

export function App() {
  return (
    <GlobalErrorBoundary>
      <LocaleProvider>
        <AppContent />
      </LocaleProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
