import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { AuthGate } from './components/AuthGate';
import {
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
} from './types/database';
import { LocaleProvider, useLocale } from './i18n/LocaleContext';

const SESSION_PROFILE_ID_KEY = 'tedcloud_session_profile_id';
const SESSION_CHAT_ID_KEY = 'tedcloud_chat_id';

function AppContent() {
  const { t } = useLocale();
  const [company, setCompany] = useState<Company | null>(null);
  const [currentProfile, setCurrentProfile] = useState<OrganizationNode | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [leads, setLeads] = useState<CrmLeadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams(window.location.search);
      const urlChatId = params.get('chatId');
      const storedChatId = localStorage.getItem(SESSION_CHAT_ID_KEY);
      const storedProfileId = localStorage.getItem(SESSION_PROFILE_ID_KEY);

      const resolvedChatId = urlChatId || storedChatId || null;
      if (urlChatId) {
        localStorage.setItem(SESSION_CHAT_ID_KEY, urlChatId);
      }
      setActiveChatId(resolvedChatId);

      const queryParams = new URLSearchParams();
      if (resolvedChatId) queryParams.set('chatId', resolvedChatId);
      if (storedProfileId) queryParams.set('profileId', storedProfileId);

      const qs = queryParams.toString();
      const endpoint = qs ? `/api/db?${qs}` : '/api/db';

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const loadedNodes: OrganizationNode[] = Array.isArray(payload.nodes)
        ? payload.nodes
        : [];
      setCompany(payload.company || null);
      setNodes(loadedNodes);
      setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
      setLeads(Array.isArray(payload.leads) ? payload.leads : []);

      // Сессия активируется только при наличии сохраненного профиля или входа по ссылке ?chatId=
      if (payload.currentProfile) {
        setCurrentProfile(payload.currentProfile);
        localStorage.setItem(SESSION_PROFILE_ID_KEY, payload.currentProfile.id);
      } else if (storedProfileId) {
        const matched = loadedNodes.find((n) => n.id === storedProfileId) || null;
        setCurrentProfile(matched);
        if (!matched) {
          localStorage.removeItem(SESSION_PROFILE_ID_KEY);
        }
      } else {
        setCurrentProfile(null);
      }
    } catch (err: any) {
      console.error('[App] Failed to fetch workspace data from /api/db:', err);
      setErrorMessage(err?.message || 'Не удалось загрузить данные из /api/db');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData(true);
  }, [loadWorkspaceData]);

  const handleAuthenticated = useCallback(
    async (profile: OrganizationNode, authCompany: Company | null) => {
      localStorage.setItem(SESSION_PROFILE_ID_KEY, profile.id);
      if (profile.telegram_chat_id) {
        localStorage.setItem(SESSION_CHAT_ID_KEY, String(profile.telegram_chat_id));
      }
      setCurrentProfile(profile);
      if (authCompany) {
        setCompany(authCompany);
      }
      await loadWorkspaceData(false);
    },
    [loadWorkspaceData]
  );

  const handlePatchRecord = useCallback(
    async (
      table: 'tasks' | 'crm_leads' | 'organization_nodes' | 'companies',
      id: string,
      updates: Record<string, any>
    ): Promise<{ ok: boolean; pushSent?: boolean }> => {
      try {
        const response = await fetch('/api/db', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table, id, updates }),
        });
        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        if (table === 'tasks' && result.data) {
          setTasks((prev) => prev.map((item) => (item.id === id ? result.data : item)));
        } else if (table === 'crm_leads' && result.data) {
          setLeads((prev) => prev.map((item) => (item.id === id ? result.data : item)));
        } else if (table === 'organization_nodes' && result.data) {
          setNodes((prev) => prev.map((item) => (item.id === id ? result.data : item)));
          setCurrentProfile((prev) => (prev && prev.id === id ? result.data : prev));
        } else if (table === 'companies' && result.data) {
          setCompany((prev) => (prev ? { ...prev, ...result.data } : result.data));
        }

        return {
          ok: true,
          pushSent: Boolean(result.telegramPush?.pushed),
        };
      } catch (err: any) {
        console.error(`[App] PATCH ${table} error:`, err);
        setErrorMessage(err?.message || String(err));
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
          body: JSON.stringify({ table, id }),
        });
        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        if (table === 'tasks') {
          setTasks((prev) => prev.filter((item) => item.id !== id));
        } else if (table === 'crm_leads') {
          setLeads((prev) => prev.filter((item) => item.id !== id));
        } else if (table === 'organization_nodes') {
          setNodes((prev) => prev.filter((item) => item.id !== id));
        }

        return true;
      } catch (err: any) {
        console.error(`[App] DELETE ${table} error:`, err);
        setErrorMessage(err?.message || String(err));
        return false;
      }
    },
    []
  );

  const handleResetSession = useCallback(() => {
    localStorage.removeItem(SESSION_PROFILE_ID_KEY);
    localStorage.removeItem(SESSION_CHAT_ID_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('chatId');
    window.history.replaceState({}, '', url.toString());
    setActiveChatId(null);
    setCurrentProfile(null);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center gap-3 font-sans">
        <Loader2 className="w-6 h-6 animate-spin text-[#A1A1AA]" />
        <p className="text-xs text-[#8E8E93]">{t('system.loading')}</p>
      </div>
    );
  }

  if (errorMessage && nodes.length === 0 && tasks.length === 0 && leads.length === 0 && !currentProfile) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-xl border border-[#262626] bg-[#121214] p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-semibold">{t('system.connectionError')}</h2>
          </div>
          <p className="text-xs text-[#A1A1AA] leading-relaxed break-words bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            {errorMessage}
          </p>
          <button
            onClick={() => loadWorkspaceData(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#E4E4E7] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('system.retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  // БЛОК 3: Если сессия не инициирована — рендерим строгий экран входа / регистрации компании (Auth Gate)
  if (!currentProfile) {
    return (
      <AuthGate
        existingNodes={nodes}
        existingCompany={company}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <Dashboard
      company={company}
      currentProfile={currentProfile}
      activeChatId={activeChatId}
      nodes={nodes}
      tasks={tasks}
      leads={leads}
      isSyncing={isSyncing}
      onRefresh={() => loadWorkspaceData(false)}
      onPatchRecord={handlePatchRecord}
      onDeleteRecord={handleDeleteRecord}
      onResetSession={handleResetSession}
    />
  );
}

export function App() {
  return (
    <LocaleProvider>
      <AppContent />
    </LocaleProvider>
  );
}

export default App;
