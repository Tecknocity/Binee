'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  SetupPlan,
  SetupWizardStep,
  ExecutionProgress,
  ExecutionResult,
  ManualStep,
} from '@/lib/setup/types';
import type { ExecutionItem, ExecutionResult as ExecutorResult } from '@/lib/setup/executor';
import { computeItemsToDelete } from '@/lib/setup/executor';
// generateSetupPlan is called via /api/setup/generate-plan (server-side only)
import { generateManualSteps } from '@/lib/setup/manual-steps';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getSetupStore } from '@/stores/setupStore';
import type { SetupChatMessage as StoreChatMessage, ExistingWorkspaceStructure } from '@/stores/setupStore';

// ---------------------------------------------------------------------------
// Types (re-export for consumers)
// ---------------------------------------------------------------------------

export interface SetupChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type SetupStep = 0 | 1 | 2 | 3 | 4 | 5;

export interface BusinessProfile {
  businessDescription: string | null;
  teamSize: string | null;
  departments: string[] | null;
  tools: string[] | null;
  workflows: string[] | null;
  painPoints: string[] | null;
}

export interface ProfileFormData {
  industry: string;
  industryCustom: string;
  workStyle: string;
  services: string;
  teamSize: string;
  /** Optional context from uploaded files (Excel, CSV, etc.) */
  fileContext?: string;
}

export interface UseSetupReturn {
  currentStep: SetupStep;
  furthestStep: SetupStep;
  wizardStep: SetupWizardStep;
  clickUpConnected: boolean;
  clickUpLoading: boolean;
  clickUpTeamName: string | null;
  businessDescription: string;
  businessProfile: BusinessProfile;
  profileFormCompleted: boolean;
  profileFormData: ProfileFormData | null;
  chatMessages: SetupChatMessage[];
  proposedPlan: SetupPlan | null;
  existingStructure: ExistingWorkspaceStructure | null;
  executionProgress: ExecutionProgress | null;
  executionResult: ExecutionResult | null;
  executionItems: ExecutionItem[];
  manualSteps: ManualStep[];
  isExecuting: boolean;
  isSending: boolean;
  isGenerating: boolean;
  isAnalyzing: boolean;
  isRestored: boolean;
  workspaceAnalysis: string | null;
  workspaceCounts: { spaces: number; folders: number; lists: number; tasks: number; members: number } | null;
  workspaceFindings: Array<{ type: string; text: string }>;
  workspaceRecommendations: Array<{ action: string; text: string }>;
  handleClickUpConnect: () => void;
  refreshClickUpStatus: () => Promise<void>;
  isRefreshingClickUp: boolean;
  continueFromConnect: () => void;
  sendMessage: (msg: string, fileContext?: string) => void;
  selectTemplate: (template: string) => void;
  submitProfileForm: (data: ProfileFormData) => void;
  updatePlan: (plan: SetupPlan) => void;
  approvePlan: () => void;
  requestChanges: (feedback: string) => void;
  editProfile: () => void;
  markStepComplete: (stepIndex: number) => void;
  retryFailedItems: () => void;
  continueFromAnalysis: () => void;
  navigateToStep: (step: SetupStep) => void;
  resetStage: (step: SetupStep) => void;
  restartSetup: () => void;
  goToDashboard: () => void;
  /** Items from previous builds that should be deleted (not in current plan) */
  itemsToDelete: ExecutionItem[];
  /** Whether deletion is pending user confirmation */
  hasPendingDeletions: boolean;
  /** Confirm and execute deletion of old items, then build new plan */
  confirmDeletionsAndBuild: () => void;
  /** Skip deletions and just build new plan (old items remain in ClickUp) */
  skipDeletionsAndBuild: () => void;
  /** Whether deletions are currently being executed */
  isDeleting: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_PROFILE: BusinessProfile = {
  businessDescription: null,
  teamSize: null,
  departments: null,
  tools: null,
  workflows: null,
  painPoints: null,
};

const WELCOME_MESSAGE: SetupChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Welcome! I'm here to help you set up your ClickUp workspace.\n\nTell me about your business: what do you do, what services or products do you offer, and how does your team work? The more detail you share, the better I can tailor your workspace.\n\nOr pick a **quick-start template** below to get started right away.",
  timestamp: new Date(),
};

const DISCOVERY_QUESTIONS: Array<{ key: keyof BusinessProfile; question: string }> = [
  {
    key: 'businessDescription',
    question:
      "That's great context! Now I'd like to understand more.\n\n**What are your core services or products?** For example, do you offer consulting, build software, sell physical goods, run campaigns, etc.?",
  },
  {
    key: 'teamSize',
    question:
      "Thanks! A couple more questions to tailor your workspace:\n\n1. **How large is your team?** (Just you, 2-5 people, 5-15, or 15+)\n2. **What departments or roles** exist in your team? (e.g., Sales, Marketing, Engineering, Operations)",
  },
  {
    key: 'tools',
    question:
      "Great, I'm getting a clear picture. One more thing:\n\n1. **What tools do you currently use** for project management or collaboration? (e.g., Trello, Asana, Notion, spreadsheets)\n2. **What are your main workflows?** Walk me through a typical project or task from start to finish.",
  },
  {
    key: 'painPoints',
    question:
      "Perfect, I have a good picture now. Let me build a workspace structure tailored to your business.\n\nI'll include spaces for your core operations and internal workflows. Click **\"Generate Structure\"** below when you're ready to see the proposed plan.",
  },
];

// ---------------------------------------------------------------------------
// Timeout-wrapped fetch helper
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs = 60000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
}

const NUMERIC_TO_WIZARD_STEP: Record<SetupStep, SetupWizardStep> = {
  0: 'business_chat',
  1: 'business_chat',
  2: 'business_chat',
  3: 'preview',
  4: 'executing',
  5: 'manual_steps',
};

// ---------------------------------------------------------------------------
// Profile extraction
// ---------------------------------------------------------------------------

function extractProfileFromMessages(messages: SetupChatMessage[]): BusinessProfile {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.toLowerCase());

  const allText = userMessages.join(' ');
  const profile: BusinessProfile = { ...EMPTY_PROFILE };

  if (userMessages.length > 0) {
    profile.businessDescription = messages.find((m) => m.role === 'user')?.content ?? null;
  }

  const teamSizePatterns = [
    { pattern: /\bjust me\b|\bsolo\b|\bone person\b|\b1 person\b/, value: '1' },
    { pattern: /\b2[-–]5\b|\bsmall team\b|\bfew people\b|\b[2-5]\s*(?:people|members|employees)\b/, value: '2-5' },
    { pattern: /\b5[-–]15\b|\b(?:[5-9]|1[0-5])\s*(?:people|members|employees)\b|\bmedium\b/, value: '5-15' },
    { pattern: /\b15\+?\b|\b(?:1[6-9]|[2-9]\d|\d{3,})\s*(?:people|members|employees)\b|\blarge\b/, value: '15+' },
  ];
  for (const { pattern, value } of teamSizePatterns) {
    if (pattern.test(allText)) {
      profile.teamSize = value;
      break;
    }
  }

  const deptKeywords = [
    'sales', 'marketing', 'engineering', 'product', 'design', 'hr',
    'human resources', 'finance', 'operations', 'support', 'customer success',
    'legal', 'qa', 'quality', 'research', 'data', 'content', 'growth',
  ];
  const foundDepts = deptKeywords.filter((d) => allText.includes(d));
  if (foundDepts.length > 0) profile.departments = foundDepts;

  const toolKeywords = [
    'trello', 'asana', 'notion', 'jira', 'monday', 'basecamp', 'linear',
    'slack', 'teams', 'google sheets', 'spreadsheet', 'excel', 'airtable',
    'hubspot', 'salesforce', 'zendesk', 'intercom', 'figma', 'github',
  ];
  const foundTools = toolKeywords.filter((t) => allText.includes(t));
  if (foundTools.length > 0) profile.tools = foundTools;

  const workflowKeywords = [
    'onboarding', 'intake', 'pipeline', 'sprint', 'campaign', 'fulfillment',
    'invoicing', 'review', 'approval', 'deployment', 'release', 'hiring',
  ];
  const foundWorkflows = workflowKeywords.filter((w) => allText.includes(w));
  if (foundWorkflows.length > 0) profile.workflows = foundWorkflows;

  return profile;
}

export function profileCompleteness(profile: BusinessProfile): number {
  const fields: (keyof BusinessProfile)[] = [
    'businessDescription', 'teamSize', 'departments', 'tools', 'workflows',
  ];
  return fields.filter((k) => {
    const val = profile[k];
    if (val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return val.length > 0;
  }).length;
}

// ---------------------------------------------------------------------------
// Store message ↔ UI message conversion
// ---------------------------------------------------------------------------

function toUiMessage(msg: StoreChatMessage): SetupChatMessage {
  return { ...msg, timestamp: new Date(msg.timestamp) };
}

function toStoreMessage(msg: SetupChatMessage): StoreChatMessage {
  return { ...msg, timestamp: msg.timestamp.toISOString() };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSetup(): UseSetupReturn {
  const clickUp = useClickUpStatus();
  const { workspace_id } = useWorkspace();

  // Get the zustand store for this workspace — auto-persists to localStorage
  const store = workspace_id ? getSetupStore(workspace_id) : null;
  const storeState = store?.getState();

  // Read persisted state from store (or defaults if no store yet)
  const currentStep = (storeState?.currentStep ?? 0) as SetupStep;
  const furthestStep = (storeState?.furthestStep ?? 0) as SetupStep;
  const conversationId = storeState?.conversationId ?? 'setup-fallback';
  const workspaceAnalysis = storeState?.workspaceAnalysis ?? null;
  const workspaceCounts = storeState?.workspaceCounts ?? null;
  const workspaceFindings = storeState?.workspaceFindings ?? [];
  const workspaceRecommendations = storeState?.workspaceRecommendations ?? [];
  const profileFormCompleted = storeState?.profileFormCompleted ?? false;
  const profileFormData = storeState?.profileFormData ?? null;
  const storedMessages = storeState?.chatMessages ?? [];
  const businessDescription = storeState?.businessDescription ?? '';
  const messageCount = storeState?.messageCount ?? 0;
  const proposedPlan = storeState?.proposedPlan ?? null;
  const existingStructure = storeState?.existingStructure ?? null;
  const manualSteps = storeState?.manualSteps ?? [];
  const persistedExecutionResult = storeState?.executionResult ?? null;
  const persistedExecutionItems = storeState?.executionItems ?? [];
  const buildCompleted = storeState?.buildCompleted ?? false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previouslyBuiltItems = useMemo(() => storeState?.previouslyBuiltItems ?? [], [storeState?.previouslyBuiltItems]);

  // Force re-render when store changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!store) return;
    return store.subscribe(() => forceUpdate((n) => n + 1));
  }, [store]);

  // Convert stored messages to UI format (with Date objects)
  const chatMessages = useMemo(() => {
    const msgs = storedMessages.map(toUiMessage);
    // Prepend welcome message if no messages
    if (msgs.length === 0) return [WELCOME_MESSAGE];
    return msgs;
  }, [storedMessages]);

  // Execution state — synced from persisted store after hydration
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionItems, setExecutionItems] = useState<ExecutionItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Restore execution state from persisted store (handles async Zustand hydration)
  const buildRestoredRef = useRef(false);
  useEffect(() => {
    if (buildRestoredRef.current || !buildCompleted || persistedExecutionItems.length === 0) return;
    buildRestoredRef.current = true;
    setExecutionItems(persistedExecutionItems);
    setExecutionResult(persistedExecutionResult);
    setExecutionProgress({
      phase: 'complete',
      current: persistedExecutionItems.length,
      total: persistedExecutionItems.length,
      currentItem: '',
      errors: persistedExecutionItems.filter(i => i.status === 'error').map(i => i.error || i.name),
    });
  }, [buildCompleted, persistedExecutionItems, persistedExecutionResult]);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reconciliation: compute items to delete when rebuilding
  const itemsToDelete = useMemo(() => {
    if (!proposedPlan || previouslyBuiltItems.length === 0) return [];
    return computeItemsToDelete(previouslyBuiltItems, proposedPlan);
  }, [proposedPlan, previouslyBuiltItems]);

  const hasPendingDeletions = itemsToDelete.length > 0;

  const wizardStep = NUMERIC_TO_WIZARD_STEP[currentStep];

  // Store setters — wrapped for convenience
  const setCurrentStep = useCallback((step: SetupStep) => {
    store?.getState().setStep(step);
  }, [store]);

  // Auto-advance from step 0 → step 1 when ClickUp is connected
  // On first visit (furthestStep === 0): always auto-advance after 800ms
  // On revisit after OAuth: auto-advance if URL has success=clickup_connected
  useEffect(() => {
    if (!clickUp.loading && clickUp.connected && currentStep === 0) {
      const isFirstVisit = furthestStep === 0;
      const isReturningFromOAuth = typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('success') === 'clickup_connected';

      if (isFirstVisit || isReturningFromOAuth) {
        const timer = setTimeout(() => {
          // Clear the URL param so it doesn't re-trigger
          if (isReturningFromOAuth) {
            const url = new URL(window.location.href);
            url.searchParams.delete('success');
            window.history.replaceState({}, '', url.toString());
          }
          // Reset analysis so it re-runs with fresh data
          if (isReturningFromOAuth && furthestStep > 0) {
            store?.getState().resetFromStep(1);
          }
          setCurrentStep(1);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [clickUp.connected, clickUp.loading, currentStep, furthestStep, setCurrentStep, store]);

  // Run workspace analysis when we arrive at step 1 and haven't analyzed yet
  const analysisStartedRef = useRef(false);
  useEffect(() => {
    if (currentStep !== 1 || workspaceAnalysis || analysisStartedRef.current) return;
    analysisStartedRef.current = true;

    let cancelled = false;
    setIsAnalyzing(true);

    (async () => {
      try {
        if (workspace_id) {
          const res = await fetchWithTimeout('/api/setup/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id }),
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              store?.getState().setAnalysis(
                data.summary || 'No workspace data yet.',
                data.counts || null,
                data.findings || [],
                data.recommendations || [],
              );
            }
          } else if (!cancelled) {
            store?.getState().setAnalysis('Unable to analyze workspace.', null, [], []);
          }
        } else if (!cancelled) {
          store?.getState().setAnalysis('No workspace data yet. Fresh workspace.', null, [], []);
        }
      } catch (err) {
        console.error('[useSetup] Workspace analysis failed:', err);
        if (!cancelled) {
          store?.getState().setAnalysis('Unable to analyze workspace.', null, [], []);
        }
      }
      if (!cancelled) {
        setIsAnalyzing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentStep, workspaceAnalysis, workspace_id, store]);

  // Load existing workspace structure when arriving at step 3 (Review)
  const existingStructureLoadedRef = useRef(false);
  useEffect(() => {
    if (currentStep !== 3 || existingStructure || existingStructureLoadedRef.current || !workspace_id) return;
    existingStructureLoadedRef.current = true;

    (async () => {
      try {
        const res = await fetchWithTimeout('/api/setup/existing-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.structure) {
            store?.getState().setExistingStructure(data.structure);
          }
        }
      } catch (err) {
        console.error('[useSetup] Failed to load existing structure:', err);
      }
    })();
  }, [currentStep, existingStructure, workspace_id, store]);

  // Load saved manual step completions from DB when arriving at step 5
  useEffect(() => {
    if (currentStep !== 5 || !workspace_id || manualSteps.length === 0) return;

    (async () => {
      try {
        const res = await fetchWithTimeout(`/api/setup/manual-steps?workspace_id=${encodeURIComponent(workspace_id)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.completions && Array.isArray(data.completions)) {
            // Merge DB completions into local manual steps
            const completionMap = new Map<number, boolean>();
            for (const c of data.completions) {
              completionMap.set(c.step_index, c.completed);
            }
            const currentSteps = store?.getState().manualSteps ?? [];
            const merged = currentSteps.map((step, i) => {
              const dbCompleted = completionMap.get(i);
              if (dbCompleted !== undefined && dbCompleted !== step.completed) {
                return { ...step, completed: dbCompleted };
              }
              return step;
            });
            store?.getState().setManualSteps(merged);
          }
        }
      } catch (err) {
        console.error('[useSetup] Failed to load manual step completions:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, workspace_id]);

  // Derive business profile from messages
  const businessProfile = useMemo(
    () => extractProfileFromMessages(chatMessages),
    [chatMessages]
  );

  // Build comprehensive analysis context for the Setupper brain
  const fullAnalysisContext = useMemo(() => {
    if (!workspaceAnalysis && !workspaceCounts) return undefined;

    const parts: string[] = [];
    if (workspaceCounts) {
      parts.push(`WORKSPACE STRUCTURE COUNTS:\n- Spaces: ${workspaceCounts.spaces}\n- Folders: ${workspaceCounts.folders}\n- Lists: ${workspaceCounts.lists}\n- Tasks: ${workspaceCounts.tasks}\n- Team Members: ${workspaceCounts.members}`);
    }
    if (workspaceFindings.length > 0) {
      parts.push(`KEY FINDINGS:\n${workspaceFindings.map(f => `- [${f.type.toUpperCase()}] ${f.text}`).join('\n')}`);
    }
    if (workspaceRecommendations.length > 0) {
      parts.push(`RECOMMENDATIONS FROM ANALYSIS:\n${workspaceRecommendations.map(r => `- [${r.action.toUpperCase()}] ${r.text}`).join('\n')}`);
    }
    if (workspaceAnalysis) {
      parts.push(`RAW WORKSPACE ANALYST REPORT:\n${workspaceAnalysis}`);
    }
    return parts.join('\n\n');
  }, [workspaceAnalysis, workspaceCounts, workspaceFindings, workspaceRecommendations]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleClickUpConnect = useCallback(() => {
    if (!workspace_id) return;
    window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}&source=setup`;
  }, [workspace_id]);

  const [isRefreshingClickUp, setIsRefreshingClickUp] = useState(false);

  const refreshClickUpStatus = useCallback(async () => {
    setIsRefreshingClickUp(true);
    try {
      await clickUp.refetch();
    } finally {
      setIsRefreshingClickUp(false);
    }
  }, [clickUp]);

  const continueFromConnect = useCallback(() => {
    // Reset analysis so it re-runs with fresh data, then move to step 1
    store?.getState().resetFromStep(1);
    analysisStartedRef.current = false;
    setIsAnalyzing(false);
    setCurrentStep(1);
  }, [store, setCurrentStep]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: SetupChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      timestamp: new Date(),
    };
    store?.getState().addMessage(toStoreMessage(msg));
    return msg;
  }, [store]);

  // Fallback: if stuck on Review (step 3) without a plan for 15s, go back
  useEffect(() => {
    if (currentStep === 3 && !proposedPlan && !isSending && !isGenerating) {
      const timer = setTimeout(() => {
        setCurrentStep(2);
        addMessage('assistant', "I wasn't able to generate the workspace structure. Let's try again. Tell me more about your business or click **\"Generate Structure\"** when ready.");
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, proposedPlan, isSending, isGenerating, addMessage, setCurrentStep]);

  const sendMessage = useCallback(
    async (msg: string, fileContext?: string) => {
      if (!msg.trim() || isSending) return;

      addMessage('user', msg);
      store?.getState().setBusinessDescription(businessDescription ? `${businessDescription}\n${msg}` : msg);
      setIsSending(true);

      const idx = messageCount;
      store?.getState().incrementMessageCount();

      // Include proposed plan and profile data so the AI retains full context
      const currentPlan = store?.getState().proposedPlan;
      const currentProfile = store?.getState().profileFormData;

      try {
        const response = await fetchWithTimeout('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: msg,
            workspace_analysis: fullAnalysisContext,
            proposed_plan: currentPlan ?? undefined,
            profile_data: currentProfile ?? undefined,
            ...(fileContext ? { file_context: fileContext } : {}),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            addMessage('assistant', data.content);
            setIsSending(false);
            return;
          }
        }
      } catch {
        // Fall through to guided fallback
      }

      const fallbackIdx = Math.min(idx, DISCOVERY_QUESTIONS.length - 1);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      addMessage('assistant', DISCOVERY_QUESTIONS[fallbackIdx].question);
      setIsSending(false);
    },
    [addMessage, isSending, messageCount, workspace_id, conversationId, businessDescription, fullAnalysisContext, store]
  );

  const selectTemplate = useCallback(
    async (template: string) => {
      const templateDescriptions: Record<string, string> = {
        agency: 'I run a digital marketing agency. We handle social media, content creation, and paid ads for multiple clients.',
        startup: "We're a tech startup building a SaaS product. Small team focused on rapid development and growth.",
        ecommerce: 'I run an e-commerce business selling products online. We manage inventory, orders, and marketing campaigns.',
        consulting: 'I run a consulting firm. We take on client engagements for strategy and process improvement.',
        saas: "We're a SaaS company with engineering, customer success, and growth teams.",
      };

      const description = templateDescriptions[template] || templateDescriptions.agency;
      addMessage('user', description);
      store?.getState().setBusinessDescription(description);
      store?.getState().incrementMessageCount();
      setIsSending(true);

      try {
        const response = await fetchWithTimeout('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: `Here is my business profile: ${description}\n\nBased on my current workspace analysis and this profile, please summarize what you'd build for a ${template} business and ask if I want to make any changes before generating the workspace structure.`,
            workspace_analysis: fullAnalysisContext,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            addMessage('assistant', data.content);
            setIsSending(false);
            return;
          }
        }
      } catch {
        // Fall through to fallback
      }

      // Fallback if API fails
      await new Promise((r) => setTimeout(r, 800));
      addMessage('assistant', `Great choice! I'll design a workspace structure tailored for a **${template}** business.\n\nWould you like to share any more details about your team, workflows, or specific needs? Or click **"Generate Structure"** when you're ready to see the proposed plan.`);
      setIsSending(false);
    },
    [addMessage, workspace_id, conversationId, fullAnalysisContext, store]
  );

  const generateStructure = useCallback(async () => {
    setIsGenerating(true);
    setIsSending(true);

    // If rebuilding after a previous build, clear stale state
    if (store?.getState().buildCompleted) {
      store?.getState().setBuildCompleted(false);
      store?.getState().setExecutionResult(null);
      store?.getState().setExecutionItems([]);
      store?.getState().setExistingStructure(null);
      existingStructureLoadedRef.current = false;
      buildRestoredRef.current = false;
      setExecutionProgress(null);
      setExecutionResult(null);
      setExecutionItems([]);
      setIsExecuting(false);
    }

    // Immediately advance to step 3 so the user sees a "building" animation
    setCurrentStep(3);
    try {
      // Save current plan to history before generating a new one
      const currentPlan = store?.getState().proposedPlan;
      if (currentPlan) {
        store?.getState().pushPlanToHistory(currentPlan);
      }

      // Build conversation context for the planner
      const recentMessages = store?.getState().chatMessages
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`)
        .join('\n') || '';

      // Build plan history summary so the planner knows what was tried before
      const history = store?.getState().planHistory || [];
      const planHistorySummary = history.length > 0
        ? history.map((p, i) => `Plan v${i + 1}: ${p.spaces.map(s => s.name).join(', ')} (${p.reasoning?.slice(0, 100) || 'no reasoning'})`).join('\n')
        : undefined;

      const res = await fetchWithTimeout('/api/setup/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessProfile: {
            businessDescription,
            teamSize: businessProfile.teamSize,
            departments: businessProfile.departments,
            tools: businessProfile.tools,
            workflows: businessProfile.workflows,
            painPoints: businessProfile.painPoints,
          },
          workspaceAnalysis: workspaceAnalysis ?? undefined,
          conversationContext: recentMessages || undefined,
          previousPlan: currentPlan ?? undefined,
          planHistorySummary: planHistorySummary || undefined,
        }),
      });
      if (!res.ok) throw new Error('Plan generation failed');
      const { plan } = await res.json();
      store?.getState().setPlan(plan);
      const version = (history.length || 0) + (currentPlan ? 2 : 1);
      const totalLists = plan.spaces.reduce((acc: number, s: { folders: Array<{ lists: unknown[] }>; lists?: unknown[] }) => {
        const folderLists = s.folders.reduce((a: number, f: { lists: unknown[] }) => a + f.lists.length, 0);
        return acc + folderLists + (s.lists?.length ?? 0);
      }, 0);
      const totalFolders = plan.spaces.reduce((acc: number, s: { folders: unknown[] }) => acc + s.folders.length, 0);
      const structureDesc = totalFolders > 0
        ? `**${plan.spaces.length} spaces**, **${totalLists} lists**, and ${totalFolders} folders`
        : `**${plan.spaces.length} spaces** and **${totalLists} lists**`;
      addMessage('assistant', `I've designed your workspace structure (v${version}) with ${structureDesc}.\n\nTake a look and let me know if you'd like any changes.`);
    } catch {
      addMessage('assistant', 'Sorry, I had trouble generating a workspace plan. Please try again.');
      // Go back to Describe step on failure
      setCurrentStep(2);
    }
    setIsGenerating(false);
    setIsSending(false);
  }, [addMessage, businessDescription, businessProfile, workspaceAnalysis, store, setCurrentStep]);

  const enhancedSendMessage = useCallback(
    (msg: string, fileContext?: string) => {
      if (msg === '__generate_structure__') { generateStructure(); return; }
      sendMessage(msg, fileContext);
    },
    [sendMessage, generateStructure]
  );

  // Shared execution runner for approvePlan and retryFailedItems
  const runExecution = useCallback(async (structure: ExistingWorkspaceStructure | null) => {
    if (!proposedPlan) return;

    try {
      // Execute server-side to avoid client-side Supabase service key issues
      const response = await fetchWithTimeout('/api/setup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id,
          plan: proposedPlan,
          existing_structure: structure,
        }),
      }, 120_000);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Execution failed' }));
        setExecutionProgress({
          phase: 'complete',
          current: 0,
          total: 0,
          currentItem: '',
          errors: [errData.error || 'Execution failed'],
        });
        return;
      }

      const { result: executorResult } = await response.json() as { result: ExecutorResult };

      const resultItems = executorResult.items;
      const executionResultData: ExecutionResult = {
        success: executorResult.success,
        spacesCreated: resultItems.filter((i) => i.type === 'space' && (i.status === 'success' || i.status === 'skipped')).length,
        foldersCreated: resultItems.filter((i) => i.type === 'folder' && (i.status === 'success' || i.status === 'skipped')).length,
        listsCreated: resultItems.filter((i) => i.type === 'list' && (i.status === 'success' || i.status === 'skipped')).length,
        errors: resultItems.filter((i) => i.status === 'error').map((i) => i.error || i.name),
      };

      setExecutionItems(resultItems);
      setExecutionProgress({
        phase: 'complete',
        current: executorResult.totalItems,
        total: executorResult.totalItems,
        currentItem: '',
        errors: executionResultData.errors,
      });
      setExecutionResult(executionResultData);

      // Persist build results to store so they survive navigation
      store?.getState().setExecutionItems(resultItems);
      store?.getState().setExecutionResult(executionResultData);
      store?.getState().setBuildCompleted(true);

      // Save successfully created items for future reconciliation (deletion tracking)
      // Merge with existing previouslyBuiltItems to track across multiple builds
      const newlyCreated = resultItems.filter(i => i.status === 'success' && i.clickupId);
      const existingBuilt = store?.getState().previouslyBuiltItems ?? [];
      // Deduplicate by clickupId
      const allBuiltMap = new Map<string, ExecutionItem>();
      for (const item of existingBuilt) {
        if (item.clickupId) allBuiltMap.set(item.clickupId, item);
      }
      for (const item of newlyCreated) {
        if (item.clickupId) allBuiltMap.set(item.clickupId, item);
      }
      store?.getState().setPreviouslyBuiltItems(Array.from(allBuiltMap.values()));

      if (proposedPlan) {
        const steps = generateManualSteps(proposedPlan as SetupPlan);
        store?.getState().setManualSteps(steps);
      }

      // Auto-advance if no structural errors (spaces/folders/lists).
      // Tags/docs/goals failures are shown but should not block progression.
      const structuralTypes = new Set(['space', 'folder', 'list']);
      const hasStructuralErrors = resultItems.some(
        i => i.status === 'error' && structuralTypes.has(i.type)
      );
      if (!hasStructuralErrors) {
        setTimeout(() => setCurrentStep(5), 1500);
      }
    } catch (err) {
      console.error('[useSetup] Execution failed:', err);
      setExecutionProgress({
        phase: 'complete',
        current: 0,
        total: 0,
        currentItem: '',
        errors: [err instanceof Error ? err.message : 'Execution failed unexpectedly'],
      });
    } finally {
      setIsExecuting(false);
    }
  }, [proposedPlan, workspace_id, store, setCurrentStep]);

  const approvePlan = useCallback(async () => {
    if (!proposedPlan || isExecuting) return;
    setCurrentStep(4);
    setIsExecuting(true);

    // Take a pre-build snapshot (non-blocking safety net)
    fetch('/api/setup/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id,
        snapshot_type: 'pre_build',
        setup_plan: proposedPlan,
      }),
    }).catch((err) => console.error('[useSetup] Pre-build snapshot failed:', err));

    // Always fetch fresh existing structure before building to account for
    // items created in previous builds or manual changes in ClickUp
    let freshStructure = existingStructure;
    try {
      const structRes = await fetchWithTimeout('/api/setup/existing-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      });
      if (structRes.ok) {
        const data = await structRes.json();
        if (data.structure) {
          freshStructure = data.structure;
          store?.getState().setExistingStructure(data.structure);
        }
      }
    } catch (err) {
      console.error('[useSetup] Failed to refresh existing structure before build:', err);
    }

    await runExecution(freshStructure);
  }, [proposedPlan, isExecuting, workspace_id, setCurrentStep, existingStructure, store, runExecution]);

  // Delete old items then build new plan
  const confirmDeletionsAndBuild = useCallback(async () => {
    if (!proposedPlan || isExecuting || isDeleting) return;
    setCurrentStep(4);
    setIsDeleting(true);
    setIsExecuting(true);

    try {
      // Delete items from previous builds that are no longer in the plan
      const deleteResponse = await fetchWithTimeout('/api/setup/delete-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id,
          items_to_delete: itemsToDelete,
        }),
      }, 60_000);

      if (deleteResponse.ok) {
        const { results: deleteResults } = await deleteResponse.json();
        const deletedIds = new Set(
          deleteResults
            .filter((r: ExecutionItem) => r.status === 'success' && r.clickupId)
            .map((r: ExecutionItem) => r.clickupId)
        );
        // Remove successfully deleted items from previouslyBuiltItems
        const remaining = previouslyBuiltItems.filter(i => !deletedIds.has(i.clickupId));
        store?.getState().setPreviouslyBuiltItems(remaining);
      }
    } catch (err) {
      console.error('[useSetup] Failed to delete old items:', err);
      // Continue with build even if deletion fails
    }

    setIsDeleting(false);

    // Fetch fresh structure after deletions
    let freshStructure = existingStructure;
    try {
      const structRes = await fetchWithTimeout('/api/setup/existing-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      });
      if (structRes.ok) {
        const data = await structRes.json();
        if (data.structure) {
          freshStructure = data.structure;
          store?.getState().setExistingStructure(data.structure);
        }
      }
    } catch (err) {
      console.error('[useSetup] Failed to refresh structure after deletion:', err);
    }

    await runExecution(freshStructure);
  }, [proposedPlan, isExecuting, isDeleting, workspace_id, setCurrentStep, itemsToDelete, previouslyBuiltItems, existingStructure, store, runExecution]);

  // Skip deletions and just build (old items remain)
  const skipDeletionsAndBuild = useCallback(async () => {
    // Just run approvePlan normally - old items stay in ClickUp
    await approvePlan();
  }, [approvePlan]);

  const retryFailedItems = useCallback(async () => {
    if (!proposedPlan || isExecuting) return;
    setIsExecuting(true);

    // Reset progress state so UI shows building animation
    buildRestoredRef.current = false;
    setExecutionProgress(null);
    setExecutionItems([]);
    setExecutionResult(null);
    store?.getState().setBuildCompleted(false);
    store?.getState().setExecutionResult(null);
    store?.getState().setExecutionItems([]);

    // Re-fetch existing structure to get fresh state after partial build
    let freshStructure = existingStructure;
    try {
      const structRes = await fetchWithTimeout('/api/setup/existing-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      });
      if (structRes.ok) {
        const data = await structRes.json();
        if (data.structure) {
          freshStructure = data.structure;
          store?.getState().setExistingStructure(data.structure);
        }
      }
    } catch (err) {
      console.error('[useSetup] Failed to refresh existing structure for retry:', err);
    }

    await runExecution(freshStructure);
  }, [proposedPlan, isExecuting, workspace_id, existingStructure, store, runExecution]);

  const requestChanges = useCallback(
    async (feedback: string) => {
      setCurrentStep(2);
      addMessage('user', feedback);
      setIsSending(true);

      // Build rich context so the AI doesn't start fresh
      const previousPlanSummary = proposedPlan
        ? `\n\nPREVIOUS WORKSPACE STRUCTURE (what was generated):\n${proposedPlan.spaces.map(s =>
            `Space: ${s.name}\n${s.folders.map(f =>
              `  Folder: ${f.name}\n${f.lists.map(l =>
                `    List: ${l.name} (statuses: ${l.statuses.map(st => st.name).join(', ')})`
              ).join('\n')}`
            ).join('\n')}`
          ).join('\n')}\n\nThe user has already reviewed this structure and wants to make changes. Do NOT ask them to describe their business again. Ask specifically what they want to change about the structure above.`
        : '';

      const profileContext = profileFormData
        ? `\n\nUSER PROFILE (already collected, do NOT re-ask):\n- Industry: ${profileFormData.industry}\n- Work style: ${profileFormData.workStyle}\n- Services: ${profileFormData.services}\n- Team size: ${profileFormData.teamSize}`
        : '';

      try {
        const response = await fetchWithTimeout('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: `I want to revise the proposed workspace structure. Here's my feedback: ${feedback}${previousPlanSummary}${profileContext}`,
            workspace_analysis: fullAnalysisContext,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.content) { addMessage('assistant', data.content); setIsSending(false); return; }
        }
      } catch {
        // Fall through to fallback
      }

      await new Promise((r) => setTimeout(r, 800));
      addMessage('assistant', "I have your previous structure in mind. What specific changes would you like to make? You can ask me to add, remove, or rename spaces, folders, lists, or statuses.\n\nClick **\"Generate Structure\"** when you're ready to see the updated plan.");
      setIsSending(false);
    },
    [addMessage, workspace_id, conversationId, fullAnalysisContext, setCurrentStep, proposedPlan, profileFormData]
  );

  const markStepComplete = useCallback(async (stepIndex: number) => {
    // Update local state immediately
    store?.getState().toggleManualStep(stepIndex);

    // Persist to DB for cross-member visibility
    const currentSteps = store?.getState().manualSteps;
    const step = currentSteps?.[stepIndex];
    if (step && workspace_id) {
      try {
        await fetchWithTimeout('/api/setup/manual-steps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            step_index: stepIndex,
            step_title: step.title,
            completed: step.completed, // Already toggled in local state
          }),
        });
      } catch (err) {
        console.error('[useSetup] Failed to persist manual step completion:', err);
      }
    }
  }, [store, workspace_id]);

  const navigateToStep = useCallback((step: SetupStep) => {
    const wasBuildCompleted = store?.getState().buildCompleted ?? false;

    // When navigating back to Describe (step 2) after a build, prepare for revision
    if (step === 2 && wasBuildCompleted) {
      // Clear build state so user can rebuild
      store?.getState().setBuildCompleted(false);
      store?.getState().setExecutionResult(null);
      store?.getState().setExecutionItems([]);
      // Clear stale existing structure so it's refetched at step 3
      store?.getState().setExistingStructure(null);
      existingStructureLoadedRef.current = false;
      // Reset execution UI state
      buildRestoredRef.current = false;
      setExecutionProgress(null);
      setExecutionResult(null);
      setExecutionItems([]);
      setIsExecuting(false);

      // Add a revision prompt instead of auto-generating
      addMessage('assistant', "Welcome back! Your workspace structure has already been built.\n\nWhat would you like to change? You can ask me to add, remove, rename, or restructure spaces, folders, lists, or statuses.\n\nOnce you're happy with the changes, click **\"Generate Structure\"** to create the updated plan.");
    }

    // When navigating back to Review (step 3) after a build, refresh existing structure
    if (step === 3 && wasBuildCompleted) {
      store?.getState().setBuildCompleted(false);
      store?.getState().setExecutionResult(null);
      store?.getState().setExecutionItems([]);
      store?.getState().setExistingStructure(null);
      existingStructureLoadedRef.current = false;
      buildRestoredRef.current = false;
      setExecutionProgress(null);
      setExecutionResult(null);
      setExecutionItems([]);
      setIsExecuting(false);
    }

    setCurrentStep(step);
  }, [setCurrentStep, store, addMessage]);

  const resetStage = useCallback((step: SetupStep) => {
    // Clear data from this step onward and navigate to it
    store?.getState().resetFromStep(step);
    if (step === 1) {
      analysisStartedRef.current = false;
      setIsAnalyzing(false);
    }
    if (step === 2) {
      // Add a welcome-back message so the chat isn't empty
      const welcomeMsg: SetupChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: "Fresh start! Tell me about your business and how you work, and I'll design a workspace structure for you.",
        timestamp: new Date(),
      };
      store?.getState().addMessage(toStoreMessage(welcomeMsg));
    }
    setExecutionProgress(null);
    setExecutionResult(null);
    setExecutionItems([]);
    setIsExecuting(false);
    setIsSending(false);
  }, [store]);

  const restartSetup = useCallback(() => {
    const newId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    store?.getState().reset(newId);
    analysisStartedRef.current = false;
    setExecutionProgress(null);
    setExecutionResult(null);
    setExecutionItems([]);
    setIsExecuting(false);
    setIsSending(false);
    setIsAnalyzing(false);
    // If ClickUp is connected, go to analysis (step 1), otherwise connect (step 0)
    if (clickUp.connected) {
      store?.getState().setStep(1);
    }
  }, [store, clickUp.connected]);

  const continueFromAnalysis = useCallback(() => {
    setCurrentStep(2);
  }, [setCurrentStep]);

  const editProfile = useCallback(() => {
    store?.getState().setProfileFormCompleted(false);
  }, [store]);

  const submitProfileForm = useCallback(
    (data: ProfileFormData) => {
      store?.getState().setProfileFormData(data);
      store?.getState().setProfileFormCompleted(true);

      const workStyleLabel: Record<string, string> = {
        'client-based': 'client-based work (managing multiple clients)',
        'product-based': 'product development (building and shipping products)',
        'project-based': 'project-based work (discrete projects with deadlines)',
        'operations-based': 'operations management (ongoing processes and workflows)',
      };

      // Build a business description from the form data and store it
      // The profile data is passed to the AI via the system prompt (profileData param)
      // so we don't need to send it as a chat message
      let desc = `We're in the ${data.industry} industry. Our work style is ${workStyleLabel[data.workStyle] || data.workStyle}. Our services/products include: ${data.services}. Team size: ${data.teamSize}.`;

      // Include uploaded file context if available
      if (data.fileContext) {
        desc += `\n\nAdditional context from uploaded files:\n${data.fileContext}`;
      }

      store?.getState().setBusinessDescription(desc);
    },
    [store],
  );

  const updatePlan = useCallback((newPlan: SetupPlan) => {
    store?.getState().setPlan(newPlan);
  }, [store]);

  const goToDashboard = useCallback(() => {
    window.location.href = '/';
  }, []);

  return {
    currentStep,
    furthestStep,
    wizardStep,
    clickUpConnected: clickUp.connected,
    clickUpLoading: clickUp.loading,
    clickUpTeamName: clickUp.teamName,
    businessDescription,
    businessProfile,
    profileFormCompleted,
    profileFormData,
    chatMessages,
    proposedPlan,
    existingStructure,
    executionProgress,
    executionResult,
    executionItems,
    manualSteps,
    isExecuting,
    isSending,
    isGenerating,
    isAnalyzing,
    isRestored: true, // Always true with localStorage — instant hydration
    workspaceAnalysis,
    workspaceCounts,
    workspaceFindings,
    workspaceRecommendations,
    handleClickUpConnect,
    refreshClickUpStatus,
    isRefreshingClickUp,
    continueFromConnect,
    sendMessage: enhancedSendMessage,
    selectTemplate,
    submitProfileForm,
    updatePlan,
    approvePlan,
    requestChanges,
    editProfile,
    markStepComplete,
    retryFailedItems,
    continueFromAnalysis,
    navigateToStep,
    resetStage,
    restartSetup,
    goToDashboard,
    itemsToDelete,
    hasPendingDeletions,
    confirmDeletionsAndBuild,
    skipDeletionsAndBuild,
    isDeleting,
  };
}
