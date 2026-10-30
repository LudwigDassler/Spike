import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  BarChart3,
  Briefcase,
  Plus,
  Check,
  Paperclip,
  ListChecks,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Trash2,
  RefreshCw,
  ShieldAlert,
  Calculator,
} from 'lucide-react';
import {
  AiAssistantMode,
  AttachmentItem,
  Company,
  CrmLeadRecord,
  OrganizationNode,
  TaskRecord,
  WorkspaceMessageRecord,
} from '../types/database';
import {
  AiAssistantMetric,
  AiAssistantSection,
  buildBuiltInChecklistForTask,
  runBuiltInAiAssistant,
} from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  AttachmentListRenderer,
  PendingAttachmentsStrip,
  processFilesToAttachments,
} from './AttachmentSystem';

export type TeddyPersonaMode = 'strategist' | 'mathematician';

/**
 * Авторский геометрический SVG-аватар «Teddy AI» (Faceted Noble Bear · Roosevelt × Kaczynski)
 * С янтарно-индиговыми гранями, благородным силуэтом и живым свечением
 */
export const TeddyAvatar: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg';
  persona?: TeddyPersonaMode;
  className?: string;
}> = ({ size = 'md', persona = 'strategist', className = '' }) => {
  const dim =
    size === 'xs'
      ? 'w-4 h-4'
      : size === 'sm'
      ? 'w-5 h-5'
      : size === 'lg'
      ? 'w-11 h-11'
      : 'w-7 h-7';

  const isMath = persona === 'mathematician';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${dim} ${className}`}
      aria-hidden="true"
    >
      <span
        className={`absolute inset-0 rounded-full blur-[6px] opacity-60 transition-colors duration-300 ${
          isMath ? 'bg-amber-500/40' : 'bg-indigo-500/45'
        }`}
      />
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full drop-shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
      >
        <defs>
          <linearGradient id="teddyCrownGrad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isMath ? '#F59E0B' : '#818CF8'} />
            <stop offset="52%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="teddyFaceShield" x1="16" y1="14" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="60%" stopColor="#111827" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id="teddyMuzzleGrad" x1="22" y1="32" x2="42" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Left & Right Faceted Bear Ears */}
        <polygon
          points="10,22 6,10 18,8 23,17"
          fill="url(#teddyFaceShield)"
          stroke="url(#teddyCrownGrad)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polygon points="11,18 9,12 16,11 19,16" fill="#F59E0B" fillOpacity="0.45" />

        <polygon
          points="54,22 58,10 46,8 41,17"
          fill="url(#teddyFaceShield)"
          stroke="url(#teddyCrownGrad)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polygon points="53,18 55,12 48,11 45,16" fill="#818CF8" fillOpacity="0.5" />

        {/* Outer Geometric Cranium & Jaw */}
        <polygon
          points="20,12 44,12 55,25 51,45 32,57 13,45 9,25"
          fill="url(#teddyFaceShield)"
          stroke="url(#teddyCrownGrad)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Internal Faceted Brow & Cheek Planes */}
        <polyline
          points="20,12 32,24 44,12"
          stroke="#818CF8"
          strokeOpacity="0.55"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="9,25 22,30 32,24 42,30 55,25"
          stroke="#F59E0B"
          strokeOpacity="0.45"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="13,45 23,38 10,26"
          stroke="#6366F1"
          strokeOpacity="0.45"
          strokeWidth="1.2"
        />
        <polyline
          points="51,45 41,38 54,26"
          stroke="#6366F1"
          strokeOpacity="0.45"
          strokeWidth="1.2"
        />

        {/* Roosevelt Pince-Nez / Mathematical Analytical Optics */}
        <polygon
          points="17,27 27,26 28,32 19,33"
          fill={isMath ? '#34D399' : '#FBBF24'}
          fillOpacity="0.95"
        />
        <polygon
          points="47,27 37,26 36,32 45,33"
          fill={isMath ? '#34D399' : '#FBBF24'}
          fillOpacity="0.95"
        />
        {/* Pince-Nez Bridge */}
        <line
          x1="28"
          y1="28.5"
          x2="36"
          y2="28.5"
          stroke="#FDE68A"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Faceted Amber Muzzle & Nose */}
        <polygon
          points="32,31 42,38 38,50 26,50 22,38"
          fill="url(#teddyMuzzleGrad)"
          stroke="#FDE68A"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <polygon points="27,36 37,36 32,42" fill="#09090B" />
        <line x1="32" y1="42" x2="32" y2="46.5" stroke="#09090B" strokeWidth="1.8" strokeLinecap="round" />
        <polyline
          points="28,46.5 32,48 36,46.5"
          stroke="#09090B"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

interface ExecutedAiActionItem {
  type: 'task_created' | 'deal_created' | 'message_sent';
  record: Record<string, any>;
  targetName?: string;
  summary: string;
}

interface AiChatEntry {
  id: string;
  role: 'user' | 'assistant';
  mode?: AiAssistantMode;
  personaMode?: TeddyPersonaMode;
  headline?: string;
  metrics?: AiAssistantMetric[];
  sections?: AiAssistantSection[];
  executedActions?: ExecutedAiActionItem[];
  suggestedTaskTitle?: string;
  attachments?: AttachmentItem[];
  text: string;
  timestamp: string;
}

interface TedCloudAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  currentProfile: OrganizationNode | null;
  nodes: OrganizationNode[];
  tasks: TaskRecord[];
  leads: CrmLeadRecord[];
  messages: WorkspaceMessageRecord[];
  onCreateFollowUpTask?: (suggestedTitle?: string) => void;
  onNavigateToCrm?: () => void;
  onNavigateToTasks?: () => void;
  onRefreshWorkspace?: () => Promise<void> | void;
}

export const TedCloudAiDrawer: React.FC<TedCloudAiDrawerProps> = ({
  isOpen,
  onClose,
  company,
  currentProfile,
  nodes,
  tasks,
  leads,
  messages,
  onNavigateToCrm,
  onNavigateToTasks,
  onRefreshWorkspace,
}) => {
  const { language, currency, formatMoney, formatRole } = useLocale();
  const isEn = language === 'en';
  const [entries, setEntries] = useState<AiChatEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [personaMode, setPersonaMode] = useState<TeddyPersonaMode>('strategist');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullWorkspaceSize, setIsFullWorkspaceSize] = useState(false);
  const [creatingTaskEntryId, setCreatingTaskEntryId] = useState<string | null>(null);
  const [createdTaskIds, setCreatedTaskIds] = useState<Record<string, boolean>>({});
  const [decomposingEntryId, setDecomposingEntryId] = useState<string | null>(null);
  const [decomposedEntryIds, setDecomposedEntryIds] = useState<Record<string, boolean>>({});
  const [rebalancingNodeId, setRebalancingNodeId] = useState<string | null>(null);
  const [rebalancedNodeIds, setRebalancedNodeIds] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  const companyId = company?.id || currentProfile?.company_id || '';
  const companyName = company?.name || 'TedCloud';

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { attachments } = await processFilesToAttachments(files, language);
    e.target.value = '';
    if (attachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...attachments]);
    }
  };

  const triggerAiAction = async (
    mode: AiAssistantMode,
    userPromptLabel: string,
    customPrompt?: string,
    attachedFiles?: AttachmentItem[]
  ) => {
    if (isLoading) return;
    const nowTime = new Date().toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: AiChatEntry = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: userPromptLabel,
      attachments: attachedFiles && attachedFiles.length > 0 ? attachedFiles : undefined,
      timestamp: nowTime,
    };

    setEntries((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const attachmentContextNote =
      attachedFiles && attachedFiles.length > 0
        ? ` [Attached files: ${attachedFiles.map((f) => f.name).join(', ')}]`
        : '';

    const effectivePrompt = `${customPrompt ?? userPromptLabel}${attachmentContextNote}`;

    const localBaseline = runBuiltInAiAssistant({
      mode,
      personaMode,
      lang: language,
      currency,
      prompt: effectivePrompt,
      companyName,
      currentUser: currentProfile,
      nodes: safeNodes,
      tasks: safeTasks,
      leads: safeLeads,
      messages: safeMessages,
    });

    const suggestedTaskTitle = isEn
      ? `Execute directive: ${userPromptLabel.slice(0, 48)}`
      : `Директива Teddy: ${userPromptLabel.slice(0, 48)}`;

    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_assistant',
          mode,
          personaMode,
          lang: language,
          currency,
          prompt: effectivePrompt,
          company_id: companyId,
          companyName,
          profile_id: currentProfile?.id || null,
        }),
      });

      const payload = await response.json();
      if (response.ok && payload?.reply) {
        const executedActions: ExecutedAiActionItem[] = Array.isArray(payload.executedActions)
          ? payload.executedActions
          : [];

        if (executedActions.length > 0 && onRefreshWorkspace) {
          void onRefreshWorkspace();
        }

        setEntries((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            mode,
            personaMode,
            headline: payload.headline || localBaseline.headline,
            metrics: localBaseline.metrics,
            sections:
              Array.isArray(payload.sections) && payload.sections.length > 0
                ? payload.sections
                : localBaseline.sections,
            executedActions: executedActions.length > 0 ? executedActions : undefined,
            suggestedTaskTitle,
            text: payload.reply,
            timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
        return;
      }
      throw new Error(payload?.error || 'Fallback');
    } catch {
      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          mode,
          personaMode,
          headline: localBaseline.headline,
          metrics: localBaseline.metrics,
          sections: localBaseline.sections,
          suggestedTaskTitle,
          text: localBaseline.reply,
          timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectCreateSuggestedTask = async (
    entryKey: string,
    titleToCreate: string,
    descriptionText: string
  ) => {
    if (creatingTaskEntryId || createdTaskIds[entryKey]) return;
    setCreatingTaskEntryId(entryKey);
    try {
      const { checklist, summary } = buildBuiltInChecklistForTask(
        titleToCreate,
        descriptionText,
        language
      );
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          payload: {
            company_id: companyId,
            title: titleToCreate,
            description: descriptionText.slice(0, 600),
            type: 'Task',
            priority: 'High',
            status: 'Todo',
            department: currentProfile?.department || null,
            assigned_to: currentProfile?.id || safeNodes[0]?.id || null,
            owner_node_id: currentProfile?.id || safeNodes[0]?.id || null,
            created_by: currentProfile?.id || null,
            checklist,
            ai_summary: summary,
          },
        }),
      });
      if (response.ok) {
        setCreatedTaskIds((prev) => ({ ...prev, [entryKey]: true }));
        if (onRefreshWorkspace) {
          await onRefreshWorkspace();
        }
      }
    } finally {
      setCreatingTaskEntryId(null);
    }
  };

  const handleRebalanceEmployeeLoad = async (sourceNodeId: string) => {
    if (rebalancingNodeId || rebalancedNodeIds[sourceNodeId]) return;
    const openTasksForNode = safeTasks.filter(
      (t) =>
        t.status !== 'Done' &&
        (t.assigned_to === sourceNodeId || t.owner_node_id === sourceNodeId)
    );
    if (openTasksForNode.length === 0) return;

    const otherNodes = safeNodes.filter((n) => n.id !== sourceNodeId);
    if (otherNodes.length === 0) return;

    const sortedByLoad = [...otherNodes].sort((a, b) => {
      const aCount = safeTasks.filter(
        (t) => t.status !== 'Done' && (t.assigned_to === a.id || t.owner_node_id === a.id)
      ).length;
      const bCount = safeTasks.filter(
        (t) => t.status !== 'Done' && (t.assigned_to === b.id || t.owner_node_id === b.id)
      ).length;
      return aCount - bCount;
    });

    const targetColleague = sortedByLoad[0];
    const taskToMove = openTasksForNode[0];

    setRebalancingNodeId(sourceNodeId);
    try {
      const response = await fetch('/api/db', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          id: taskToMove.id,
          updates: {
            assigned_to: targetColleague.id,
            owner_node_id: targetColleague.id,
            department: targetColleague.department || taskToMove.department,
          },
        }),
      });
      if (response.ok) {
        setRebalancedNodeIds((prev) => ({ ...prev, [sourceNodeId]: true }));
        if (onRefreshWorkspace) {
          await onRefreshWorkspace();
        }
      }
    } finally {
      setRebalancingNodeId(null);
    }
  };

  const handleDirectDecomposeActiveTasks = async (entryId: string) => {
    if (decomposingEntryId || decomposedEntryIds[entryId]) return;
    setDecomposingEntryId(entryId);
    try {
      const openTasks = safeTasks.filter((t) => t.status !== 'Done').slice(0, 5);
      for (const tk of openTasks) {
        if (!Array.isArray(tk.checklist) || tk.checklist.length === 0) {
          const { checklist, summary } = buildBuiltInChecklistForTask(
            tk.title,
            tk.description,
            language
          );
          await fetch('/api/db', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'tasks',
              id: tk.id,
              updates: {
                checklist,
                ai_summary: summary,
              },
            }),
          });
        }
      }
      setDecomposedEntryIds((prev) => ({ ...prev, [entryId]: true }));
      if (onRefreshWorkspace) {
        await onRefreshWorkspace();
      }
    } finally {
      setDecomposingEntryId(null);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if ((!q && pendingAttachments.length === 0) || isLoading) return;
    const filesToSend = [...pendingAttachments];
    const label =
      q ||
      (isEn
        ? `Analyze attached file: ${filesToSend.map((f) => f.name).join(', ')}`
        : `Анализ документа: ${filesToSend.map((f) => f.name).join(', ')}`);
    setQuestion('');
    setPendingAttachments([]);
    await triggerAiAction('custom', label, label, filesToSend);
  };

  // Compute live employee workload for interactive chart
  const openWorkspaceTasks = safeTasks.filter((t) => t.status !== 'Done');
  const onlineShiftsCount = safeNodes.filter(
    (n) => n.shift_status === 'online' || n.shift_status === 'break'
  ).length;
  const activeShiftsDisplay = onlineShiftsCount > 0 ? onlineShiftsCount : safeNodes.length;

  const employeeWorkloadRows = safeNodes
    .map((n) => {
      const count = openWorkspaceTasks.filter(
        (t) => t.assigned_to === n.id || t.owner_node_id === n.id
      ).length;
      const highCount = openWorkspaceTasks.filter(
        (t) => (t.assigned_to === n.id || t.owner_node_id === n.id) && t.priority === 'High'
      ).length;
      return {
        id: n.id,
        name: n.name,
        role: formatRole(n.role_type || ''),
        count,
        highCount,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxWorkloadCount = Math.max(1, ...employeeWorkloadRows.map((r) => r.count), 4);

  const activeDealsPreview = safeLeads
    .filter((l) => (l.status || l.stage) !== 'Lost')
    .slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 font-sans"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`tc-teddy-modal w-full ${
          isFullWorkspaceSize
            ? 'max-w-6xl h-[88dvh]'
            : 'max-w-3xl h-[84dvh] max-h-[820px]'
        } rounded-2xl border border-white/10 bg-[#0D0D11] !text-white flex flex-col justify-between overflow-hidden shadow-[0_25px_90px_-15px_rgba(99,102,241,0.35)] transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spotlight Header with Teddy Avatar + Thinking Focus Switcher */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#111116] flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 via-indigo-950/40 to-amber-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <TeddyAvatar size="md" persona={personaMode} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold !text-white tracking-tight truncate">
                    {isEn ? 'Teddy AI · Executive Advisor' : 'Советник Teddy (Teddy AI)'}
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                    {personaMode === 'strategist'
                      ? isEn
                        ? 'Roosevelt Doctrine'
                        : 'Доктрина Рузвельта'
                      : isEn
                      ? 'Systems Mathematician'
                      : 'Системный Математик'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {companyName} · {openWorkspaceTasks.length}{' '}
                  {isEn ? 'open tasks' : 'поручений в работе'} · {safeLeads.length}{' '}
                  {isEn ? 'deals' : 'сделок CRM'} · {activeShiftsDisplay}{' '}
                  {isEn ? 'staff on shift' : 'сотр. на смене'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEntries([])}
                  title={isEn ? 'Clear conversation' : 'Очистить историю диалога с Teddy'}
                  className="p-2 rounded-xl text-zinc-400 hover:!text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFullWorkspaceSize((prev) => !prev)}
                title={
                  isFullWorkspaceSize
                    ? isEn
                      ? 'Restore standard Spotlight size'
                      : 'Стандартный размер окна'
                    : isEn
                    ? 'Expand to full workspace'
                    : 'Развернуть на весь рабочий экран'
                }
                className="p-2 rounded-xl text-zinc-400 hover:!text-white hover:bg-white/[0.06] transition-colors"
              >
                {isFullWorkspaceSize ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={isEn ? 'Close Teddy AI' : 'Закрыть Советника Teddy'}
                className="p-2 rounded-xl text-zinc-400 hover:!text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Переключатель фокуса мышления Teddy: Стратег (Доктрина Рузвельта) vs Системный Математик (Анти-Бюрократия) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPersonaMode('strategist')}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                personaMode === 'strategist'
                  ? 'border-indigo-500/60 bg-indigo-500/15 !text-white shadow-[0_0_25px_-8px_rgba(99,102,241,0.5)]'
                  : 'border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:!text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert
                  className={`w-4 h-4 shrink-0 ${
                    personaMode === 'strategist' ? 'text-indigo-400' : 'text-zinc-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold !text-white truncate">
                    {isEn ? 'Strategist (Roosevelt Doctrine)' : 'Стратег (Доктрина Рузвельта)'}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {isEn
                      ? 'Iron SLA discipline, CRM deal closing & delegation'
                      : 'Железный контроль сроков, дожим сделок CRM и делегирование'}
                  </div>
                </div>
              </div>
              {personaMode === 'strategist' && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setPersonaMode('mathematician')}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                personaMode === 'mathematician'
                  ? 'border-amber-500/60 bg-amber-500/15 !text-white shadow-[0_0_25px_-8px_rgba(245,158,11,0.45)]'
                  : 'border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:!text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Calculator
                  className={`w-4 h-4 shrink-0 ${
                    personaMode === 'mathematician' ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold !text-white truncate">
                    {isEn
                      ? 'Systems Mathematician (Anti-Bureaucracy)'
                      : 'Системный Математик (Анти-Бюрократия)'}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {isEn
                      ? 'Bottleneck math, exposing fake busywork & unit economics'
                      : 'Поиск узких мест, вскрытие имитации деятельности и юнит-экономика'}
                  </div>
                </div>
              </div>
              {personaMode === 'mathematician' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* 4-Column Grid of Quick Scenarios */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3.5 border-b border-white/[0.07] bg-[#0F0F14] shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction('daily_brief', isEn ? 'Daily Brief' : 'Сводка дня')
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400" />
            <span className="truncate">{isEn ? 'Daily Brief' : 'Сводка дня'}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction(
                'workload_analysis',
                isEn ? 'Bottleneck Analysis' : 'Анализ узких мест'
              )
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 shrink-0 text-sky-400" />
            <span className="truncate">{isEn ? 'Bottleneck Analysis' : 'Анализ узких мест'}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction(
                'workload_analysis',
                isEn ? 'CRM Pipeline Audit' : 'Аудит сделок CRM',
                isEn
                  ? 'Audit CRM pipeline and deal conversion across the organization'
                  : 'Аудит сделок CRM и конверсии воронки компании'
              )
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors cursor-pointer"
          >
            <Briefcase className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">{isEn ? 'CRM Pipeline Audit' : 'Аудит сделок CRM'}</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void triggerAiAction(
                'decompose_task',
                isEn ? 'Task Plan' : 'План задач',
                safeTasks[0]?.title ||
                  (isEn ? 'Q4 Operational Execution Plan' : 'Операционный план квартала')
              )
            }
            className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-left truncate text-zinc-100 transition-colors cursor-pointer"
          >
            <ListChecks className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="truncate">{isEn ? 'Task Plan' : 'План задач'}</span>
          </button>
        </div>

        {/* Conversational Stream */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-3.5">
          {entries.length === 0 && (
            <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-[#141522] via-[#12131C] to-[#17141F] p-4 space-y-3.5 text-zinc-200 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <TeddyAvatar size="sm" persona={personaMode} />
                  <div>
                    <div className="text-xs font-bold !text-white flex items-center gap-2">
                      <span>
                        {isEn
                          ? 'Teddy AI · Chief Executive Advisor & Mathematician'
                          : 'Советник Teddy · Главный стратег и системный математик'}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-300/90 font-medium">
                      {personaMode === 'strategist'
                        ? isEn
                          ? '“Speak softly and carry a big stick” — T. Roosevelt'
                          : '«Говори мягко, но держи в руках большую дубинку» — Т. Рузвельт'
                        : isEn
                        ? '“Zero tolerance for bureaucratic entropy” — Systems Math'
                        : '«Математическая точность против корпоративной бюрократии»'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold shrink-0">
                  {isEn ? 'Direct DB Execution' : 'Прямое управление БД'}
                </span>
              </div>

              <p className="text-xs text-zinc-200 leading-relaxed">
                {isEn ? (
                  <>
                    Greetings. I have audited the operational contour of{' '}
                    <strong className="!text-white">“{companyName}”</strong>: there are{' '}
                    <strong className="text-indigo-300">{openWorkspaceTasks.length}</strong> active
                    assignments and <strong className="text-emerald-300">{safeLeads.length}</strong>{' '}
                    CRM deals in flight (<strong className="text-amber-300">{activeShiftsDisplay}</strong>{' '}
                    staff members in contour). Industrial society loves breeding chaos and endless
                    meetings, whereas you and I prefer iron discipline and exact mathematical
                    calculation. Which employee shall we steer on course today, or which deal shall
                    we close?
                  </>
                ) : (
                  <>
                    Приветствую. Я проанализировал контур вашей организации{' '}
                    <strong className="!text-white">«{companyName}»</strong>: в работе{' '}
                    <strong className="text-indigo-300">{openWorkspaceTasks.length}</strong>{' '}
                    поручений и <strong className="text-emerald-300">{safeLeads.length}</strong>{' '}
                    сделок (на смене <strong className="text-amber-300">{activeShiftsDisplay}</strong>{' '}
                    сотр.). Индустриальное общество обожает плодить хаос и совещания, а мы с вами
                    любим железную дисциплину и точный математический расчет. Кого из сотрудников
                    сегодня направим в нужное русло или какую сделку дожмем?
                  </>
                )}
              </p>

              {/* Quick Natural Command Chips */}
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    const targetColleague =
                      safeNodes.find((n) => n.id !== currentProfile?.id)?.name ||
                      currentProfile?.name ||
                      'команды';
                    const cmd = isEn
                      ? `Create task Prepare Q4 financial audit for ${targetColleague}`
                      : `Создай задачу Подготовить финансовый отчет для ${targetColleague}`;
                    void triggerAiAction('custom', cmd, cmd);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-semibold text-indigo-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {isEn
                      ? 'Create task via Teddy'
                      : '«Создай задачу подготовить отчет...»'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    const cmd = isEn
                      ? 'Create deal Enterprise Cloud License for 1500000'
                      : 'Создай сделку Северсталь Логистика на 1.5 млн';
                    void triggerAiAction('custom', cmd, cmd);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-semibold text-emerald-200 transition-colors cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {isEn
                      ? 'Create CRM deal via Teddy'
                      : '«Создай сделку Северсталь на 1.5 млн»'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {entries.map((entry) => {
            const suggestedCards = [
              {
                key: `${entry.id}_s1`,
                title:
                  entry.suggestedTaskTitle ||
                  (isEn
                    ? 'Audit Q4 Commercial Pipeline & Contracts'
                    : 'Провести ревизию договоров и воронки CRM'),
                dept: currentProfile?.department || (isEn ? 'Sales & Legal' : 'Отдел продаж'),
                priority: 'High' as const,
              },
              {
                key: `${entry.id}_s2`,
                title: isEn
                  ? 'Synchronize SLA deadlines across active tasks'
                  : 'Актуализировать контрольные сроки (SLA) по задачам',
                dept: currentProfile?.department || (isEn ? 'Operations' : 'Операционный блок'),
                priority: 'Medium' as const,
              },
            ];

            return (
              <div
                key={entry.id}
                className={`flex flex-col ${
                  entry.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {entry.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600/90 px-3.5 py-2.5 !text-white space-y-1 shadow-sm">
                    <div className="flex items-center justify-between gap-3 text-[10px] text-indigo-100/80">
                      <span className="font-semibold !text-white">
                        {currentProfile?.name || (isEn ? 'You' : 'Вы')}
                      </span>
                      <span className="tabular-nums">{entry.timestamp}</span>
                    </div>
                    <div className="text-xs leading-relaxed !text-white">{entry.text}</div>
                    {entry.attachments && entry.attachments.length > 0 && (
                      <AttachmentListRenderer
                        attachments={entry.attachments}
                        lang={language}
                        compact
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full rounded-2xl rounded-tl-sm border border-white/[0.08] bg-[#131319] p-4 space-y-3.5 text-zinc-100 shadow-lg">
                    {/* Assistant Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeddyAvatar
                          size="xs"
                          persona={entry.personaMode || personaMode}
                        />
                        <span className="text-xs font-semibold !text-white truncate">
                          {entry.headline || 'Советник Teddy (Teddy AI)'}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                        {entry.timestamp}
                      </span>
                    </div>

                    {/* Interactive Executed DB Action Cards */}
                    {entry.executedActions && entry.executedActions.length > 0 && (
                      <div className="space-y-2">
                        {entry.executedActions.map((act, aIdx) => (
                          <div
                            key={aIdx}
                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>
                                  {act.type === 'task_created'
                                    ? isEn
                                      ? 'Task Created in DB'
                                      : 'Задача записана в БД'
                                    : act.type === 'deal_created'
                                    ? isEn
                                      ? 'CRM Deal Created in DB'
                                      : 'Сделка записана в CRM'
                                    : isEn
                                    ? 'Message Sent'
                                    : 'Сообщение доставлено'}
                                </span>
                              </span>

                              {act.type === 'task_created' && onNavigateToTasks && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onNavigateToTasks();
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold !text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition-colors"
                                >
                                  <span>{isEn ? 'Open Tasks' : 'В задачи'}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}

                              {act.type === 'deal_created' && onNavigateToCrm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onNavigateToCrm();
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold !text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition-colors"
                                >
                                  <span>{isEn ? 'Open CRM' : 'В воронку'}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="text-xs font-medium !text-white">
                              {act.record?.title ||
                                act.record?.client_name ||
                                act.summary}
                            </div>

                            {act.type === 'deal_created' && act.record?.amount !== undefined && (
                              <div className="text-xs text-emerald-300 font-semibold tabular-nums">
                                {formatMoney(Number(act.record.amount) || 0)}
                              </div>
                            )}

                            {act.targetName && (
                              <div className="text-[11px] text-zinc-300">
                                {isEn ? 'Assignee / Recipient:' : 'Исполнитель / Адресат:'}{' '}
                                <span className="font-medium !text-white">{act.targetName}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Mini-Grid of Key Metrics */}
                    {entry.metrics && entry.metrics.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {entry.metrics.map((m, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-white/[0.07] bg-[#181820] px-3 py-2.5 space-y-0.5 min-w-0"
                          >
                            <div className="text-[10px] font-medium text-zinc-400 truncate">
                              {m.label}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold !text-white tabular-nums truncate">
                              {m.value}
                            </div>
                            {m.sublabel && (
                              <div className="text-[10px] text-zinc-500 truncate">
                                {m.sublabel}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* WIDGET 1: Mini Workload Distribution Chart + Rebalance Action */}
                    {(entry.mode === 'workload_analysis' || entry.mode === 'daily_brief') &&
                      employeeWorkloadRows.length > 0 && (
                        <div className="rounded-xl border border-white/[0.07] bg-[#171822] p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold !text-white flex items-center gap-1.5">
                              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                              {isEn
                                ? 'Staff Workload Distribution'
                                : 'Матрица загрузки сотрудников'}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {isEn ? 'Active tasks per specialist' : 'Активные задачи по штату'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {employeeWorkloadRows.map((row) => {
                              const pct = Math.min(
                                100,
                                Math.max(8, Math.round((row.count / maxWorkloadCount) * 100))
                              );
                              const isOverloaded = row.count >= 3 && safeNodes.length > 1;
                              return (
                                <div key={row.id} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <div className="min-w-0 truncate">
                                      <span className="font-medium !text-white">{row.name}</span>
                                      <span className="text-[10px] text-zinc-400 ml-1.5">
                                        · {row.role}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-semibold tabular-nums text-zinc-200">
                                        {row.count} {isEn ? 'tasks' : 'зад.'}
                                      </span>
                                      {isOverloaded && (
                                        <button
                                          type="button"
                                          disabled={
                                            rebalancingNodeId === row.id ||
                                            Boolean(rebalancedNodeIds[row.id])
                                          }
                                          onClick={() => void handleRebalanceEmployeeLoad(row.id)}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                                            rebalancedNodeIds[row.id]
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                              : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30'
                                          }`}
                                        >
                                          {rebalancingNodeId === row.id ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                          ) : rebalancedNodeIds[row.id] ? (
                                            <Check className="w-2.5 h-2.5" />
                                          ) : (
                                            <RefreshCw className="w-2.5 h-2.5" />
                                          )}
                                          <span>
                                            {rebalancedNodeIds[row.id]
                                              ? isEn
                                                ? 'Rebalanced'
                                                : 'Перераспределено'
                                              : isEn
                                              ? 'Rebalance'
                                              : 'Перераспределить'}
                                          </span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        row.count >= 3
                                          ? 'bg-amber-400'
                                          : row.count >= 1
                                          ? 'bg-indigo-500'
                                          : 'bg-emerald-400'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* WIDGET 2: Express CRM Deal Audit Cards */}
                    {(entry.mode === 'workload_analysis' || entry.mode === 'daily_brief') &&
                      activeDealsPreview.length > 0 && (
                        <div className="rounded-xl border border-white/[0.07] bg-[#171822] p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold !text-white flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                              {isEn ? 'Express CRM Deal Audit' : 'Экспресс-аудит сделок CRM'}
                            </span>
                            {onNavigateToCrm && (
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateToCrm();
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-300 hover:text-indigo-200"
                              >
                                <span>{isEn ? 'Open Pipeline' : 'Открыть воронку'}</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeDealsPreview.map((deal) => (
                              <div
                                key={deal.id}
                                onClick={() => {
                                  if (onNavigateToCrm) {
                                    onNavigateToCrm();
                                    onClose();
                                  }
                                }}
                                className="rounded-lg border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold !text-white truncate">
                                    {deal.client_name || deal.title}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 truncate">
                                    {deal.status || deal.stage || 'New'}
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-emerald-400 tabular-nums shrink-0">
                                  {formatMoney(Number(deal.amount ?? deal.deal_value ?? 0))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Structured Sections */}
                    {entry.sections && entry.sections.length > 0 ? (
                      <div className="space-y-2.5">
                        {entry.sections.map((sec, sIdx) => (
                          <div
                            key={sIdx}
                            className="rounded-xl border border-white/[0.06] bg-[#16161D] p-3 space-y-1.5"
                          >
                            <h4 className="text-xs font-semibold !text-white tracking-tight">
                              {sec.title}
                            </h4>
                            <ul className="space-y-1">
                              {sec.items.map((item, iIdx) => (
                                <li
                                  key={iIdx}
                                  className="text-xs text-zinc-300 leading-relaxed flex items-start gap-2"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/80 mt-1.5 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                        {entry.text}
                      </div>
                    )}

                    {/* WIDGET 3: Suggested AI Task Cards (+ В работу) */}
                    {(!entry.executedActions || entry.executedActions.length === 0) && (
                      <div className="rounded-xl border border-white/[0.07] bg-[#171822] p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold !text-white flex items-center gap-1.5">
                            <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
                            {isEn ? 'Teddy’s Daily Directives' : 'Директивы Teddy на сегодня'}
                          </span>
                          <button
                            type="button"
                            disabled={
                              decomposingEntryId === entry.id ||
                              Boolean(decomposedEntryIds[entry.id])
                            }
                            onClick={() => void handleDirectDecomposeActiveTasks(entry.id)}
                            className="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
                          >
                            {decomposedEntryIds[entry.id]
                              ? isEn
                                ? '✓ Checklists Ready'
                                : '✓ Чек-листы сформированы'
                              : isEn
                              ? 'Decompose Active Tasks'
                              : 'Декомпозировать активные задачи'}
                          </button>
                        </div>

                        <div className="space-y-2">
                          {suggestedCards.map((sc) => {
                            const isCreated = Boolean(createdTaskIds[sc.key]);
                            const isCreating = creatingTaskEntryId === sc.key;
                            return (
                              <div
                                key={sc.key}
                                className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium !text-white truncate">
                                    {sc.title}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                                    <span className="text-amber-300 font-semibold">
                                      {sc.priority}
                                    </span>
                                    <span>·</span>
                                    <span className="truncate">{formatRole(sc.dept)}</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={isCreating || isCreated}
                                  onClick={() =>
                                    void handleDirectCreateSuggestedTask(
                                      sc.key,
                                      sc.title,
                                      entry.text
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-colors ${
                                    isCreated
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-indigo-600 hover:bg-indigo-500 !text-white'
                                  }`}
                                >
                                  {isCreating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : isCreated ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <Plus className="w-3 h-3" />
                                  )}
                                  <span>
                                    {isCreated
                                      ? isEn
                                        ? 'Added'
                                        : 'В работе'
                                      : isEn
                                      ? '+ To Work'
                                      : '+ В работу'}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-zinc-200 bg-[#14141B] border border-white/[0.08] rounded-xl px-3.5 py-2.5 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>
                {isEn
                  ? 'Teddy AI is calculating directive...'
                  : 'Советник Teddy выполняет математический расчет и запись...'}
              </span>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Bottom Composer with Paperclip + Input + Send */}
        <div className="shrink-0 sticky bottom-0 bg-[#111116] border-t border-white/[0.08]">
          <PendingAttachmentsStrip
            attachments={pendingAttachments}
            onRemove={(id) =>
              setPendingAttachments((prev) => prev.filter((item) => item.id !== id))
            }
          />
          <form
            onSubmit={handleSubmitQuestion}
            className="flex items-center gap-2 p-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_ATTACHMENT_TYPES}
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:!text-white flex items-center justify-center shrink-0 transition"
              title={isEn ? 'Attach file or screenshot' : 'Прикрепить файл или скриншот'}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                isEn
                  ? 'Ask Teddy or command: "Create task...", "Create deal...", "Message..."'
                  : 'Поручение для Teddy: «Создай задачу...», «Создай сделку...» или вопрос...'
              }
              className="flex-1 h-10 rounded-xl border border-white/10 bg-[#17171F] px-3.5 text-sm !text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none min-w-0"
            />

            <button
              type="submit"
              disabled={isLoading || (!question.trim() && pendingAttachments.length === 0)}
              className="w-9 h-9 rounded-xl bg-indigo-600 !text-white hover:bg-indigo-500 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors"
              title={isEn ? 'Send to Teddy' : 'Отправить Советнику Teddy'}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
