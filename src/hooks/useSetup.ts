'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  SetupPlan,
  SetupWizardStep,
  SetupSessionState,
  ExecutionStep,
  ExecutionProgress,
  ExecutionResult,
  ManualStep,
} from '@/lib/setup/types';
import { executeSetupPlan } from '@/lib/setup/executor';
import type { ExecutionResult as ExecutorResult } from '@/lib/setup/executor';
import { generateSetupPlan } from '@/lib/setup/planner';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetupChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type SetupStep = 0 | 1 | 2 | 3 | 4;

/**
 * Structured business profile collected during the discovery conversation.
 * Fields are populated progressively as the AI extracts information.
 */
export interface BusinessProfile {
  businessDescription: string | null;
  teamSize: string | null;
  departments: string[] | null;
  tools: string[] | null;
  workflows: string[] | null;
  painPoints: string[] | null;
}

export interface UseSetupReturn {
  currentStep: SetupStep;
  /** Named wizard step (B-079) */
  wizardStep: SetupWizardStep;
  clickUpConnected: boolean;
  clickUpLoading: boolean;
  businessDescription: string;
  businessProfile: BusinessProfile;
  chatMessages: SetupChatMessage[];
  proposedPlan: SetupPlan | null;
  executionProgress: ExecutionProgress | null;
  executionResult: ExecutionResult | null;
  /** B-079: Typed execution steps with individual status tracking */
  executionSteps: ExecutionStep[];
  manualSteps: ManualStep[];
  isExecuting: boolean;
  isSending: boolean;
  /** Whether workspace is being analyzed after ClickUp connect */
  isAnalyzing: boolean;
  /** Whether session state has been restored from persistence */
  isRestored: boolean;
  handleClickUpConnect: () => void;
  refreshClickUpStatus: () => Promise<void>;
  sendMessage: (msg: string) => void;
  selectTemplate: (template: string) => void;
  approvePlan: () => void;
  requestChanges: (feedback: string) => void;
  markStepComplete: (stepIndex: number) => void;
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
    "Welcome! I'm here to help you set up your ClickUp workspace.\n\nTell me about your business — what do you do, what services or products do you offer, and how does your team work? The more detail you share, the better I can tailor your workspace.\n\nOr pick a **quick-start template** below to get started right away.",
  timestamp: new Date(),
};

/**
 * Discovery questions the AI should ask. Used as fallback prompts when
 * the AI API is unavailable, and to guide the profile extraction logic.
 */
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
// B-079: Wizard step ↔ numeric step mapping
// ---------------------------------------------------------------------------

const WIZARD_STEP_TO_NUMERIC: Record<SetupWizardStep, SetupStep> = {
  business_chat: 1,
  preview: 2,
  executing: 3,
  manual_steps: 4,
  complete: 4,
};

const NUMERIC_TO_WIZARD_STEP: Record<SetupStep, SetupWizardStep> = {
  0: 'business_chat', // connect step maps to business_chat (pre-chat)
  1: 'business_chat',
  2: 'preview',
  3: 'executing',
  4: 'manual_steps',
};

// ---------------------------------------------------------------------------
// B-079: Session persistence helpers
// ---------------------------------------------------------------------------

// Lazy singleton — avoid calling createBrowserClient() at module scope
// because it throws when NEXT_PUBLIC_SUPABASE_URL is missing during SSG prerender.
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createBrowserClient();
  return _supabase;
}

async function saveSessionState(
  workspaceId: string,
  userId: string,
  conversationId: string,
  state: Partial<SetupSessionState>
): Promise<void> {
  try {
    await getSupabase().from('setup_sessions').upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        conversation_id: conversationId,
        status: state.wizardStep === 'complete' ? 'completed' : 'in_progress',
        setup_type: 'new_space' as const,
        config: {
          wizardStep: state.wizardStep,
          businessProfile: state.businessProfile,
          plan: state.plan,
          executionSteps: state.executionSteps,
          executionResult: state.executionResult,
          manualStepsCompleted: state.manualStepsCompleted,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,user_id' }
    );
  } catch {
    // Non-critical — session persistence is best-effort
  }
}

async function loadSessionState(
  workspaceId: string,
  userId: string
): Promise<SetupSessionState | null> {
  try {
    const { data } = await getSupabase()
      .from('setup_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!data?.config) return null;

    const config = data.config as Record<string, unknown>;
    return {
      wizardStep: (config.wizardStep as SetupWizardStep) ?? 'business_chat',
      businessProfile: (config.businessProfile as SetupSessionState['businessProfile']) ?? {
        businessDescription: null,
        teamSize: null,
        departments: null,
        tools: null,
        workflows: null,
        painPoints: null,
      },
      plan: (config.plan as SetupSessionState['plan']) ?? null,
      executionSteps: (config.executionSteps as ExecutionStep[]) ?? [],
      executionResult: (config.executionResult as SetupSessionState['executionResult']) ?? null,
      manualStepsCompleted: (config.manualStepsCompleted as number[]) ?? [],
      conversationId: data.conversation_id ?? '',
      startedAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Profile extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract structured business profile data from the conversation history.
 * This runs client-side as a best-effort extraction — the real extraction
 * happens server-side in the setup prompt when generating the plan.
 */
function extractProfileFromMessages(messages: SetupChatMessage[]): BusinessProfile {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.toLowerCase());

  const allText = userMessages.join(' ');

  const profile: BusinessProfile = { ...EMPTY_PROFILE };

  // Business description — first user message is typically the description
  if (userMessages.length > 0) {
    profile.businessDescription = messages.find((m) => m.role === 'user')?.content ?? null;
  }

  // Team size extraction
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

  // Department extraction
  const deptKeywords = [
    'sales', 'marketing', 'engineering', 'product', 'design', 'hr',
    'human resources', 'finance', 'operations', 'support', 'customer success',
    'legal', 'qa', 'quality', 'research', 'data', 'content', 'growth',
    'devops', 'infrastructure', 'admin', 'management',
  ];
  const foundDepts = deptKeywords.filter((d) => allText.includes(d));
  if (foundDepts.length > 0) {
    profile.departments = foundDepts;
  }

  // Tool extraction
  const toolKeywords = [
    'trello', 'asana', 'notion', 'jira', 'monday', 'basecamp', 'linear',
    'slack', 'teams', 'google sheets', 'spreadsheet', 'excel', 'airtable',
    'hubspot', 'salesforce', 'zendesk', 'intercom', 'figma', 'github',
    'gitlab', 'confluence', 'clickup',
  ];
  const foundTools = toolKeywords.filter((t) => allText.includes(t));
  if (foundTools.length > 0) {
    profile.tools = foundTools;
  }

  // Workflow hints
  const workflowKeywords = [
    'onboarding', 'intake', 'pipeline', 'sprint', 'campaign', 'fulfillment',
    'invoicing', 'review', 'approval', 'deployment', 'release', 'hiring',
    'reporting', 'kickoff', 'retrospective', 'standup', 'planning',
  ];
  const foundWorkflows = workflowKeywords.filter((w) => allText.includes(w));
  if (foundWorkflows.length > 0) {
    profile.workflows = foundWorkflows;
  }

  return profile;
}

/**
 * Count how many profile fields have been filled.
 */
export function profileCompleteness(profile: BusinessProfile): number {
  const fields: (keyof BusinessProfile)[] = [
    'businessDescription',
    'teamSize',
    'departments',
    'tools',
    'workflows',
  ];
  return fields.filter((k) => {
    const val = profile[k];
    if (val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return val.length > 0;
  }).length;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSetup(): UseSetupReturn {
  const clickUp = useClickUpStatus();
  const { workspace_id } = useWorkspace();
  const { user } = useAuth();

  // Stable setup conversation ID — persists for the lifetime of this setup session.
  // useState lazy initializer runs once and is allowed to call impure functions.
  const [conversationId, setConversationId] = useState(
    () => `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  // Start at step 0 (connect) if ClickUp is not connected, otherwise step 1 (describe)
  const [currentStep, setCurrentStep] = useState<SetupStep>(0);
  const [businessDescription, setBusinessDescription] = useState('');
  const [chatMessages, setChatMessages] = useState<SetupChatMessage[]>([WELCOME_MESSAGE]);
  const [proposedPlan, setProposedPlan] = useState<SetupPlan | null>(null);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [workspaceAnalysis, setWorkspaceAnalysis] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  // B-079: Named wizard step, execution steps, and restoration state
  const [wizardStep, setWizardStep] = useState<SetupWizardStep>('business_chat');
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [isRestored, setIsRestored] = useState(false);
  const restoredRef = useRef(false);

  // B-079: Restore session state on mount
  useEffect(() => {
    if (!workspace_id || !user?.id || restoredRef.current) return;
    restoredRef.current = true;

    loadSessionState(workspace_id, user.id).then((saved) => {
      if (!saved) {
        setIsRestored(true);
        return;
      }

      // Restore wizard step and associated state
      setWizardStep(saved.wizardStep);
      setCurrentStep(WIZARD_STEP_TO_NUMERIC[saved.wizardStep]);
      setConversationId(saved.conversationId);

      if (saved.plan) {
        setProposedPlan(saved.plan);
      }
      if (saved.executionSteps.length > 0) {
        setExecutionSteps(saved.executionSteps);
      }
      if (saved.executionResult) {
        setExecutionResult({
          success: saved.executionResult.success,
          spacesCreated: 0,
          foldersCreated: 0,
          listsCreated: saved.executionResult.successCount,
          errors: [],
        });
      }
      if (saved.businessProfile.businessDescription) {
        setBusinessDescription(saved.businessProfile.businessDescription);
      }

      setIsRestored(true);
    });
  }, [workspace_id, user?.id]);

  // B-079: Keep wizardStep in sync with numeric currentStep changes
  useEffect(() => {
    setWizardStep(NUMERIC_TO_WIZARD_STEP[currentStep]);
  }, [currentStep]);

  // B-079: Persist session state on meaningful changes
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!workspace_id || !user?.id || !isRestored) return;

    // Debounce persistence to avoid excessive writes
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      saveSessionState(workspace_id, user.id, conversationId, {
        wizardStep,
        businessProfile: {
          businessDescription: businessDescription || null,
          teamSize: null,
          departments: null,
          tools: null,
          workflows: null,
          painPoints: null,
        },
        plan: proposedPlan,
        executionSteps,
        executionResult: executionResult
          ? {
              success: executionResult.success,
              totalItems: executionResult.spacesCreated + executionResult.foldersCreated + executionResult.listsCreated + executionResult.errors.length,
              successCount: executionResult.spacesCreated + executionResult.foldersCreated + executionResult.listsCreated,
              errorCount: executionResult.errors.length,
            }
          : null,
        manualStepsCompleted: manualSteps
          .map((s, i) => (s.completed ? i : -1))
          .filter((i) => i >= 0),
        conversationId,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }, 1000);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [wizardStep, proposedPlan, executionSteps, executionResult, businessDescription, manualSteps, workspace_id, user?.id, conversationId, isRestored]);

  // Auto-advance from step 0 to step 1 once ClickUp is connected
  // Run workspace analyzer before transitioning
  useEffect(() => {
    if (!clickUp.loading && clickUp.connected && currentStep === 0) {
      let cancelled = false;

      const advanceWithAnalysis = async () => {
        setIsAnalyzing(true);
        try {
          if (workspace_id) {
            const res = await fetch('/api/setup/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workspace_id }),
            });
            if (res.ok) {
              const data = await res.json();
              if (!cancelled && data.summary) {
                setWorkspaceAnalysis(data.summary);
              }
            }
          }
        } catch (err) {
          console.error('[useSetup] Workspace analysis failed:', err);
          // Continue anyway — don't block the flow
        }
        if (!cancelled) {
          setIsAnalyzing(false);
          setCurrentStep(1);
        }
      };

      // Small delay for the connect animation to settle
      const timer = setTimeout(advanceWithAnalysis, 800);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [clickUp.connected, clickUp.loading, currentStep, workspace_id]);

  // Derive business profile from messages — no effect needed
  const businessProfile = useMemo(
    () => extractProfileFromMessages(chatMessages),
    [chatMessages]
  );

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
    setChatMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  // Fallback: if stuck on Review (step 2) without a plan for 15s, go back to Describe
  useEffect(() => {
    if (currentStep === 2 && !proposedPlan && !isSending) {
      const timer = setTimeout(() => {
        setCurrentStep(1);
        addMessage(
          'assistant',
          "I wasn't able to generate the workspace structure. Let's try again — tell me more about your business or click **\"Generate Structure\"** when ready."
        );
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, proposedPlan, isSending, addMessage]);

  // ---------------------------------------------------------------------------
  // Send message — calls /api/chat with setup context, falls back to guided flow
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (msg: string) => {
      if (!msg.trim() || isSending) return;

      addMessage('user', msg);
      setBusinessDescription((prev) => (prev ? `${prev}\n${msg}` : msg));
      setIsSending(true);

      const idx = messageCount;
      setMessageCount((c) => c + 1);

      // Call the standalone Setupper brain API
      try {
        const response = await fetch('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: msg,
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

      // Fallback: use guided discovery questions
      const fallbackIdx = Math.min(idx, DISCOVERY_QUESTIONS.length - 1);
      const fallbackResponse = DISCOVERY_QUESTIONS[fallbackIdx].question;

      // Simulate brief delay for natural feel
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      addMessage('assistant', fallbackResponse);
      setIsSending(false);
    },
    [addMessage, isSending, messageCount, workspace_id, user, conversationId]
  );

  const selectTemplate = useCallback(
    async (template: string) => {
      const templateDescriptions: Record<string, string> = {
        agency:
          'I run a digital marketing agency. We handle social media, content creation, and paid ads for multiple clients.',
        startup:
          "We're a tech startup building a SaaS product. Small team focused on rapid development and growth.",
        ecommerce:
          'I run an e-commerce business selling products online. We manage inventory, orders, and marketing campaigns.',
        consulting:
          'I run a consulting firm. We take on client engagements for strategy and process improvement.',
        saas: "We're a SaaS company with engineering, customer success, and growth teams.",
      };

      const description = templateDescriptions[template] || templateDescriptions.agency;
      addMessage('user', description);
      setBusinessDescription(description);
      setIsSending(true);

      // Call the standalone Setupper brain for template-based plan generation
      try {
        const response = await fetch('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: `Please set up my ClickUp workspace. ${description} Create the full structure — Spaces, Folders, Lists, and statuses — tailored for a ${template} business.`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            addMessage('assistant', data.content);
          }
        }
      } catch {
        // Fall through to AI plan generation
      }

      // Generate a plan using the AI planner
      try {
        const plan = await generateSetupPlan(
          {
            businessDescription: description,
            teamSize: null,
            departments: null,
            tools: null,
            workflows: null,
            painPoints: null,
          },
          workspaceAnalysis ?? undefined,
        );
        setProposedPlan(plan);
        addMessage(
          'assistant',
          `I've created a workspace structure tailored for your ${template} business. It includes **${plan.spaces.length} spaces** with organized folders and lists.\n\nLet me show you the full structure for review.`
        );
        setIsSending(false);
        setCurrentStep(2);
      } catch {
        addMessage('assistant', 'Sorry, I had trouble generating a workspace plan. Please try describing your business manually.');
        setIsSending(false);
        // Stay on step 1 — don't advance to Review without a plan
      }
    },
    [addMessage, workspace_id, user, conversationId, workspaceAnalysis]
  );

  const generateStructure = useCallback(async () => {
    setIsSending(true);

    // Generate plan using AI planner
    try {
      const plan = await generateSetupPlan(
        {
          businessDescription,
          teamSize: businessProfile.teamSize,
          departments: businessProfile.departments,
          tools: businessProfile.tools,
          workflows: businessProfile.workflows,
          painPoints: businessProfile.painPoints,
        },
        workspaceAnalysis ?? undefined,
      );
      setProposedPlan(plan);
      addMessage(
        'assistant',
        `I've designed your workspace structure with **${plan.spaces.length} spaces**, organized folders, lists, and statuses.\n\nTake a look and let me know if you'd like any changes.`
      );
      setCurrentStep(2);
    } catch {
      addMessage('assistant', 'Sorry, I had trouble generating a workspace plan. Please try again.');
    }
    setIsSending(false);
  }, [addMessage, businessDescription, businessProfile, workspace_id, user, conversationId, workspaceAnalysis]);

  // Expose generateStructure via sendMessage when enough context gathered
  const enhancedSendMessage = useCallback(
    (msg: string) => {
      if (msg === '__generate_structure__') {
        generateStructure();
        return;
      }
      sendMessage(msg);
    },
    [sendMessage, generateStructure]
  );

  const approvePlan = useCallback(async () => {
    if (!proposedPlan || isExecuting) return;
    setCurrentStep(3);
    setIsExecuting(true);

    const executorResult = await executeSetupPlan(
      proposedPlan as SetupPlan,
      workspace_id || '',
      '', // access token resolved server-side by ClickUpClient
      (completedItem, progress) => {
        setExecutionProgress({
          phase: completedItem.type === 'space' ? 'creating_spaces' : completedItem.type === 'folder' ? 'creating_folders' : 'creating_lists',
          current: progress.completed,
          total: progress.total,
          currentItem: completedItem.name,
          errors: completedItem.status === 'error' && completedItem.error ? [completedItem.error] : [],
        });
      },
    );

    setExecutionResult({
      success: executorResult.success,
      spacesCreated: executorResult.items.filter((i) => i.type === 'space' && i.status === 'success').length,
      foldersCreated: executorResult.items.filter((i) => i.type === 'folder' && i.status === 'success').length,
      listsCreated: executorResult.items.filter((i) => i.type === 'list' && i.status === 'success').length,
      errors: executorResult.items.filter((i) => i.status === 'error').map((i) => i.error || i.name),
    });
    setIsExecuting(false);

    // Auto-advance to finish after brief pause
    setTimeout(() => {
      setCurrentStep(4);
    }, 1500);
  }, [proposedPlan, isExecuting, workspace_id]);

  const requestChanges = useCallback(
    async (feedback: string) => {
      setCurrentStep(1);
      addMessage('user', feedback);
      setIsSending(true);

      // Call the standalone Setupper brain for structure revision
      try {
        const response = await fetch('/api/setup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            conversation_id: conversationId,
            message: `I want to revise the proposed workspace structure. Here's my feedback: ${feedback}`,
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

      // Fallback
      await new Promise((r) => setTimeout(r, 800));
      addMessage(
        'assistant',
        "Got it, I've noted your feedback. Let me revise the structure based on your changes.\n\nClick **\"Generate Structure\"** when you're ready to see the updated plan."
      );
      setIsSending(false);
    },
    [addMessage, workspace_id, user, conversationId]
  );

  const markStepComplete = useCallback((stepIndex: number) => {
    setManualSteps((prev) =>
      prev.map((step, i) => (i === stepIndex ? { ...step, completed: !step.completed } : step))
    );
  }, []);

  const restartSetup = useCallback(() => {
    setCurrentStep(clickUp.connected ? 1 : 0);
    setBusinessDescription('');
    setChatMessages([WELCOME_MESSAGE]);
    setProposedPlan(null);
    setExecutionProgress(null);
    setExecutionResult(null);
    setManualSteps([]);
    setIsExecuting(false);
    setIsSending(false);
    setIsAnalyzing(false);
    setWorkspaceAnalysis(null);
    setMessageCount(0);
    setWizardStep('business_chat');
    setExecutionSteps([]);
    // New conversation ID for fresh start
    setConversationId(`setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // Mark previous session as abandoned
    if (workspace_id && user?.id) {
      getSupabase()
        .from('setup_sessions')
        .update({ status: 'abandoned', updated_at: new Date().toISOString() })
        .eq('workspace_id', workspace_id)
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .then(() => { /* best-effort */ });
    }
  }, [clickUp.connected, workspace_id, user?.id]);

  const goToDashboard = useCallback(() => {
    window.location.href = '/';
  }, []);

  return {
    currentStep,
    wizardStep,
    clickUpConnected: clickUp.connected,
    clickUpLoading: clickUp.loading,
    businessDescription,
    businessProfile,
    chatMessages,
    proposedPlan,
    executionProgress,
    executionResult,
    executionSteps,
    manualSteps,
    isExecuting,
    isSending,
    isAnalyzing,
    isRestored,
    handleClickUpConnect,
    refreshClickUpStatus,
    sendMessage: enhancedSendMessage,
    selectTemplate,
    approvePlan,
    requestChanges,
    markStepComplete,
    restartSetup,
    goToDashboard,
  };
}
