'use client';

import { useState, useCallback } from 'react';
import type { SetupPlan, ExecutionProgress, ExecutionResult, ManualStep } from '@/lib/setup/session';
import { executeSetupPlan } from '@/lib/setup/session';
import { generateDefaultPlan } from '@/lib/setup/planner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetupChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type SetupStep = 1 | 2 | 3 | 4;

export interface UseSetupReturn {
  currentStep: SetupStep;
  businessDescription: string;
  chatMessages: SetupChatMessage[];
  proposedPlan: SetupPlan | null;
  executionProgress: ExecutionProgress | null;
  executionResult: ExecutionResult | null;
  manualSteps: ManualStep[];
  isExecuting: boolean;
  isSending: boolean;
  sendMessage: (msg: string) => void;
  selectTemplate: (template: string) => void;
  approvePlan: () => void;
  requestChanges: (feedback: string) => void;
  markStepComplete: (stepIndex: number) => void;
  restartSetup: () => void;
  goToDashboard: () => void;
}

// ---------------------------------------------------------------------------
// Mock follow-up responses
// ---------------------------------------------------------------------------

const FOLLOW_UPS: string[] = [
  "That's great context! A couple more questions:\n\n1. **How large is your team?** (Just you, 2-5 people, 5-15, or 15+)\n2. **What tools do you currently use** for project management, if any?\n\nThis will help me tailor the structure to your workflow.",
  "Perfect, I have a good picture now. Let me build a workspace structure tailored to your business.\n\nI'll include spaces for your core operations, client management, and internal workflows. Click **\"Generate Structure\"** below when you're ready to see the proposed plan.",
];

const WELCOME_MESSAGE: SetupChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Welcome! I'm here to help you set up your ClickUp workspace.\n\nTell me about your business — what do you do, what services do you offer, and how does your team work? The more detail you share, the better I can tailor your workspace.\n\nOr pick a quick-start template below to get started right away.",
  timestamp: new Date(),
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSetup(): UseSetupReturn {
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [businessDescription, setBusinessDescription] = useState('');
  const [chatMessages, setChatMessages] = useState<SetupChatMessage[]>([WELCOME_MESSAGE]);
  const [proposedPlan, setProposedPlan] = useState<SetupPlan | null>(null);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [manualSteps, setManualSteps] = useState<ManualStep[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

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

  const sendMessage = useCallback(
    (msg: string) => {
      if (!msg.trim() || isSending) return;

      addMessage('user', msg);
      setBusinessDescription((prev) => (prev ? `${prev}\n${msg}` : msg));
      setIsSending(true);

      const idx = messageCount;
      setMessageCount((c) => c + 1);

      // Simulate AI response delay
      setTimeout(() => {
        const response = idx < FOLLOW_UPS.length ? FOLLOW_UPS[idx] : FOLLOW_UPS[FOLLOW_UPS.length - 1];
        addMessage('assistant', response);
        setIsSending(false);
      }, 800 + Math.random() * 600);
    },
    [addMessage, isSending, messageCount]
  );

  const selectTemplate = useCallback(
    (template: string) => {
      const templateDescriptions: Record<string, string> = {
        agency: "I run a digital marketing agency. We handle social media, content creation, and paid ads for multiple clients.",
        startup: "We're a tech startup building a SaaS product. Small team focused on rapid development and growth.",
        ecommerce: "I run an e-commerce business selling products online. We manage inventory, orders, and marketing campaigns.",
        consulting: "I run a consulting firm. We take on client engagements for strategy and process improvement.",
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

  const generateStructure = useCallback(() => {
    // This is triggered when user has provided enough info via chat
    setIsSending(true);
    setTimeout(() => {
      const plan = generateDefaultPlan('agency');
      setProposedPlan(plan);
      setManualSteps(plan.manualSteps);
      addMessage(
        'assistant',
        `I've designed your workspace structure with **${plan.spaces.length} spaces**, organized folders, lists, and starter tasks.\n\nTake a look and let me know if you'd like any changes.`
      );
      setIsSending(false);
      setCurrentStep(2);
    }, 1200);
  }, [addMessage]);

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

    const result = await executeSetupPlan('mock-workspace-id', proposedPlan, (progress) => {
      setExecutionProgress({ ...progress });
    });

    setExecutionResult(result);
    setIsExecuting(false);

    // Auto-advance to manual steps after brief pause
    setTimeout(() => {
      setCurrentStep(4);
    }, 1500);
  }, [proposedPlan, isExecuting]);

  const requestChanges = useCallback(
    (feedback: string) => {
      setCurrentStep(1);
      addMessage('user', feedback);
      setIsSending(true);

      setTimeout(() => {
        addMessage(
          'assistant',
          "Got it, I've noted your feedback. Let me revise the structure based on your changes.\n\nClick **\"Generate Structure\"** when you're ready to see the updated plan."
        );
        setIsSending(false);
      }, 800);
    },
    [addMessage]
  );

  const markStepComplete = useCallback((stepIndex: number) => {
    setManualSteps((prev) =>
      prev.map((step, i) => (i === stepIndex ? { ...step, completed: !step.completed } : step))
    );
  }, []);

  const restartSetup = useCallback(() => {
    setCurrentStep(1);
    setBusinessDescription('');
    setChatMessages([WELCOME_MESSAGE]);
    setProposedPlan(null);
    setExecutionProgress(null);
    setExecutionResult(null);
    setManualSteps([]);
    setIsExecuting(false);
    setIsSending(false);
    setMessageCount(0);
  }, []);

  const goToDashboard = useCallback(() => {
    // In a real app, this would use router.push('/')
    window.location.href = '/';
  }, []);

  return {
    currentStep,
    businessDescription,
    chatMessages,
    proposedPlan,
    executionProgress,
    executionResult,
    manualSteps,
    isExecuting,
    isSending,
    sendMessage: enhancedSendMessage,
    selectTemplate,
    approvePlan,
    requestChanges,
    markStepComplete,
    restartSetup,
    goToDashboard,
  };
}
