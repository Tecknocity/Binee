'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  SetupPlan,
  SetupWizardStep,
  ExecutionProgress,
  ExecutionResult,
  ManualStep,
} from '@/lib/setup/types';
import { executeSetupPlan } from '@/lib/setup/executor';
import type { ExecutionItem } from '@/lib/setup/executor';
// generateSetupPlan is called via /api/setup/generate-plan (server-side only)
import { generateManualSteps } from '@/lib/setup/manual-steps';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/components/auth/AuthProvider';
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
}

export interface UseSetupReturn {
  currentStep: SetupStep;
  furthestStep: SetupStep;
  wizardStep: SetupWizardStep;
  clickUpConnected: boolean;
  clickUpLoading: boolean;
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
  isAnalyzing: boolean;
  isRestored: boolean;
  workspaceAnalysis: string | null;
  workspaceCounts: { spaces: number; folders: number; lists: number; tasks: number; members: number } | null;
  workspaceFindings: Array<{ type: string; text: string }>;
  workspaceRecommendations: Array<{ action: string; text: string }>;
  handleClickUpConnect: () => void;
  refreshClickUpStatus: () => Promise<void>;
  sendMessage: (msg: string) => void;
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
  const { user } = useAuth();

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

  // Transient UI state — NOT persisted (resets on refresh, that's fine)
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionItems, setExecutionItems] = useState<ExecutionItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const wizardStep = NUMERIC_TO_WIZARD_STEP[currentStep];

  // Store setters — wrapped for convenience
  const setCurrentStep = useCallback((step: SetupStep) => {
    store?.getState().setStep(step);
  }, [store]);

  // Auto-advance from step 0 → step 1 when ClickUp is connected
  useEffect(() => {
    if (!clickUp.loading && clickUp.connected && currentStep === 0) {
      const timer = setTimeout(() => setCurrentStep(1), 800);
      return () => clearTimeout(timer);
    }
  }, [clickUp.connected, clickUp.loading, currentStep, setCurrentStep]);

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
    window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}`;
  }, [workspace_id]);

  const refreshClickUpStatus = useCallback(async () => {
    await clickUp.refetch();
  }, [clickUp]);

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
    if (currentStep === 3 && !proposedPlan && !isSending) {
      const timer = setTimeout(() => {
        setCurrentStep(2);
        addMessage('assistant', "I wasn't able to generate the workspace structure. Let's try again. Tell me more about your business or click **\"Generate Structure\"** when ready.");
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, proposedPlan, isSending, addMessage, setCurrentStep]);

  const sendMessage = useCallback(
    async (msg: string) => {
      if (!msg.trim() || isSending) return;

      addMessage('user', msg);
      store?.getState().setBusinessDescription(businessDescription ? `${businessDescription}\n${msg}` : msg);
      setIsSending(true);

      const idx = messageCount;
      store?.getState().incrementMessageCount();

      try {
        const response = await fetchWithTimeout('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: msg,
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
    setIsSending(true);
    try {
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
        }),
      });
      if (!res.ok) throw new Error('Plan generation failed');
      const { plan } = await res.json();
      store?.getState().setPlan(plan);
      addMessage('assistant', `I've designed your workspace structure with **${plan.spaces.length} spaces**, organized folders, lists, and statuses.\n\nTake a look and let me know if you'd like any changes.`);
      setCurrentStep(3);
    } catch {
      addMessage('assistant', 'Sorry, I had trouble generating a workspace plan. Please try again.');
    }
    setIsSending(false);
  }, [addMessage, businessDescription, businessProfile, workspaceAnalysis, store, setCurrentStep]);

  const enhancedSendMessage = useCallback(
    (msg: string) => {
      if (msg === '__generate_structure__') { generateStructure(); return; }
      sendMessage(msg);
    },
    [sendMessage, generateStructure]
  );

  // Shared execution runner for approvePlan and retryFailedItems
  const runExecution = useCallback(async (structure: ExistingWorkspaceStructure | null) => {
    if (!proposedPlan) return;

    const progressItems: ExecutionItem[] = [];

    const executorResult = await executeSetupPlan(
      proposedPlan as SetupPlan,
      workspace_id || '',
      '',
      (completedItem, progress) => {
        const idx = progressItems.findIndex(
          (pi) => pi.type === completedItem.type && pi.name === completedItem.name && pi.parentName === completedItem.parentName
        );
        if (idx >= 0) { progressItems[idx] = completedItem; } else { progressItems.push(completedItem); }
        setExecutionItems([...progressItems]);
        setExecutionProgress({
          phase: completedItem.type === 'space' ? 'creating_spaces' : completedItem.type === 'folder' ? 'creating_folders' : 'creating_lists',
          current: progress.completed,
          total: progress.total,
          currentItem: completedItem.name,
          errors: completedItem.status === 'error' && completedItem.error ? [completedItem.error] : [],
        });
      },
      structure,
    );

    setExecutionItems(executorResult.items);
    setExecutionProgress({
      phase: 'complete',
      current: executorResult.totalItems,
      total: executorResult.totalItems,
      currentItem: '',
      errors: executorResult.items.filter((i) => i.status === 'error').map((i) => i.error || i.name),
    });
    setExecutionResult({
      success: executorResult.success,
      spacesCreated: executorResult.items.filter((i) => i.type === 'space' && (i.status === 'success' || i.status === 'skipped')).length,
      foldersCreated: executorResult.items.filter((i) => i.type === 'folder' && (i.status === 'success' || i.status === 'skipped')).length,
      listsCreated: executorResult.items.filter((i) => i.type === 'list' && (i.status === 'success' || i.status === 'skipped')).length,
      errors: executorResult.items.filter((i) => i.status === 'error').map((i) => i.error || i.name),
    });
    setIsExecuting(false);

    if (proposedPlan) {
      const steps = generateManualSteps(proposedPlan as SetupPlan);
      store?.getState().setManualSteps(steps);
    }

    // Only auto-advance if no errors
    const hasErrors = executorResult.items.some(i => i.status === 'error');
    if (!hasErrors) {
      setTimeout(() => setCurrentStep(5), 1500);
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

    await runExecution(existingStructure);
  }, [proposedPlan, isExecuting, workspace_id, setCurrentStep, existingStructure, runExecution]);

  const retryFailedItems = useCallback(async () => {
    if (!proposedPlan || isExecuting) return;
    setIsExecuting(true);

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
    // Just navigate - no data clearing. Used for viewing completed stages.
    setCurrentStep(step);
  }, [setCurrentStep]);

  const resetStage = useCallback((step: SetupStep) => {
    // Clear data from this step onward and navigate to it
    store?.getState().resetFromStep(step);
    if (step === 1) {
      analysisStartedRef.current = false;
      setIsAnalyzing(false);
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
    async (data: ProfileFormData) => {
      store?.getState().setProfileFormData(data);
      store?.getState().setProfileFormCompleted(true);

      const workStyleLabel: Record<string, string> = {
        'client-based': 'client-based work (managing multiple clients)',
        'product-based': 'product development (building and shipping products)',
        'project-based': 'project-based work (discrete projects with deadlines)',
        'operations-based': 'operations management (ongoing processes and workflows)',
      };

      // Build a business description from the form data
      const desc = `We're in the ${data.industry} industry. Our work style is ${workStyleLabel[data.workStyle] || data.workStyle}. Our services/products include: ${data.services}. Team size: ${data.teamSize}.`;
      store?.getState().setBusinessDescription(desc);

      // Add the description as a user message and trigger the chat
      addMessage('user', desc);
      store?.getState().incrementMessageCount();
      setIsSending(true);

      try {
        const response = await fetchWithTimeout('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: `Here's my business profile:\n- Industry: ${data.industry}\n- Work style: ${workStyleLabel[data.workStyle] || data.workStyle}\n- Services/Products: ${data.services}\n- Team size: ${data.teamSize}\n\nBased on my current workspace analysis and this profile, please recommend the optimal ClickUp workspace structure. Summarize what you'd build and ask if I want to make any changes before generating the structure.`,
            workspace_analysis: fullAnalysisContext,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.content) {
            addMessage('assistant', resData.content);
            setIsSending(false);
            return;
          }
        }
      } catch {
        // Fall through to fallback
      }

      // Fallback if API fails
      await new Promise((r) => setTimeout(r, 800));
      addMessage('assistant', `Great! Based on your **${data.industry}** business with a **${data.workStyle}** work style, I can see how to structure your workspace.\n\nI'll create spaces for your core operations, organize folders by ${data.services.includes(',') ? 'service areas' : 'your workflow'}, and set up lists with custom statuses.\n\nWould you like to share any more details about your workflows, tools, or pain points? Or click **"Generate Structure"** to see the proposed plan.`);
      setIsSending(false);
    },
    [addMessage, workspace_id, conversationId, fullAnalysisContext, store],
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
    isAnalyzing,
    isRestored: true, // Always true with localStorage — instant hydration
    workspaceAnalysis,
    workspaceCounts,
    workspaceFindings,
    workspaceRecommendations,
    handleClickUpConnect,
    refreshClickUpStatus,
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
  };
}
