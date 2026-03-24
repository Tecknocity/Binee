'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { SetupPlan, ExecutionProgress, ExecutionResult, ManualStep } from '@/lib/setup/session';
import { executeSetupPlan } from '@/lib/setup/session';
import { generateDefaultPlan, parseAIResponseToPlan } from '@/lib/setup/planner';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/components/auth/AuthProvider';

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
  clickUpConnected: boolean;
  clickUpLoading: boolean;
  businessDescription: string;
  businessProfile: BusinessProfile;
  chatMessages: SetupChatMessage[];
  proposedPlan: SetupPlan | null;
  executionProgress: ExecutionProgress | null;
  executionResult: ExecutionResult | null;
  manualSteps: ManualStep[];
  isExecuting: boolean;
  isSending: boolean;
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
  const [messageCount, setMessageCount] = useState(0);

  // Auto-advance from step 0 to step 1 once ClickUp is connected
  useEffect(() => {
    if (!clickUp.loading && clickUp.connected && currentStep === 0) {
      const timer = setTimeout(() => setCurrentStep(1), 1200);
      return () => clearTimeout(timer);
    }
  }, [clickUp.connected, clickUp.loading, currentStep]);

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

      // Attempt real AI call via /api/chat
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            user_id: user?.id ?? 'anonymous',
            conversation_id: conversationId,
            message: `[SETUP DISCOVERY] ${msg}`,
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
    (template: string) => {
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

      // Generate plan immediately for template
      setTimeout(() => {
        const plan = generateDefaultPlan(template);
        setProposedPlan(plan);
        setManualSteps(plan.manualSteps);
        addMessage(
          'assistant',
          `I've created a workspace structure tailored for your ${template} business. It includes **${plan.spaces.length} spaces** with organized folders, lists, and starter tasks.\n\nLet me show you the full structure for review.`
        );
        setIsSending(false);
        setCurrentStep(2);
      }, 1200);
    },
    [addMessage]
  );

  const generateStructure = useCallback(async () => {
    setIsSending(true);

    // Attempt AI-powered structure generation
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id,
          user_id: user?.id ?? 'anonymous',
          conversation_id: conversationId,
          message: `[SETUP GENERATE] Based on our conversation, generate a complete ClickUp workspace structure as JSON. Business context: ${businessDescription}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          // Try to parse the AI response as a plan
          const plan = parseAIResponseToPlan(data.content);
          setProposedPlan(plan);
          setManualSteps(plan.manualSteps);
          addMessage(
            'assistant',
            `I've designed your workspace structure with **${plan.spaces.length} spaces**, organized folders, lists, and starter tasks.\n\nTake a look and let me know if you'd like any changes.`
          );
          setIsSending(false);
          setCurrentStep(2);
          return;
        }
      }
    } catch {
      // Fall through to default plan
    }

    // Fallback: generate a default plan based on keyword matching
    const description = businessDescription.toLowerCase();
    let planType = 'agency';
    if (description.includes('saas') || description.includes('software as a service')) {
      planType = 'saas';
    } else if (description.includes('startup') || description.includes('product')) {
      planType = 'startup';
    } else if (description.includes('ecommerce') || description.includes('e-commerce') || description.includes('store') || description.includes('shop')) {
      planType = 'ecommerce';
    } else if (description.includes('consulting') || description.includes('consult')) {
      planType = 'consulting';
    }

    const plan = generateDefaultPlan(planType);
    setProposedPlan(plan);
    setManualSteps(plan.manualSteps);
    addMessage(
      'assistant',
      `I've designed your workspace structure with **${plan.spaces.length} spaces**, organized folders, lists, and starter tasks.\n\nTake a look and let me know if you'd like any changes.`
    );
    setIsSending(false);
    setCurrentStep(2);
  }, [addMessage, businessDescription, workspace_id, user, conversationId]);

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

    const result = await executeSetupPlan(workspace_id || 'mock-workspace-id', proposedPlan, (progress) => {
      setExecutionProgress({ ...progress });
    });

    setExecutionResult(result);
    setIsExecuting(false);

    // Auto-advance to manual steps after brief pause
    setTimeout(() => {
      setCurrentStep(4);
    }, 1500);
  }, [proposedPlan, isExecuting, workspace_id]);

  const requestChanges = useCallback(
    async (feedback: string) => {
      setCurrentStep(1);
      addMessage('user', feedback);
      setIsSending(true);

      // Try AI-powered revision
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            user_id: user?.id ?? 'anonymous',
            conversation_id: conversationId,
            message: `[SETUP REVISION] The user wants changes to the proposed plan: ${feedback}`,
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
    setMessageCount(0);
    // New conversation ID for fresh start
    setConversationId(`setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }, [clickUp.connected]);

  const goToDashboard = useCallback(() => {
    window.location.href = '/';
  }, []);

  return {
    currentStep,
    clickUpConnected: clickUp.connected,
    clickUpLoading: clickUp.loading,
    businessDescription,
    businessProfile,
    chatMessages,
    proposedPlan,
    executionProgress,
    executionResult,
    manualSteps,
    isExecuting,
    isSending,
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
