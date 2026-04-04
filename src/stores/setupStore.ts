'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SetupPlan, ManualStep } from '@/lib/setup/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetupStep = 0 | 1 | 2 | 3 | 4 | 5;

export interface SetupChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string for serialization
}

interface WorkspaceCounts {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
  members: number;
}

interface Finding {
  type: string;
  text: string;
}

interface Recommendation {
  action: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Store shape — only resumable state, no transient UI flags
// ---------------------------------------------------------------------------

interface SetupState {
  // Progress
  currentStep: SetupStep;
  conversationId: string;

  // Step 1: Analysis
  workspaceAnalysis: string | null;
  workspaceCounts: WorkspaceCounts | null;
  workspaceFindings: Finding[];
  workspaceRecommendations: Recommendation[];

  // Step 2: Profile form + Chat
  profileFormCompleted: boolean;
  profileFormData: {
    businessCategory: string;
    companyType: string;
    services: string;
    teamSize: string;
  } | null;
  chatMessages: SetupChatMessage[];
  businessDescription: string;
  messageCount: number;

  // Step 3: Plan
  proposedPlan: SetupPlan | null;

  // Step 5: Manual steps
  manualSteps: ManualStep[];

  // Actions
  setStep: (step: SetupStep) => void;
  setConversationId: (id: string) => void;
  setAnalysis: (analysis: string | null, counts: WorkspaceCounts | null, findings: Finding[], recommendations: Recommendation[]) => void;
  setProfileFormCompleted: (completed: boolean) => void;
  setProfileFormData: (data: { businessCategory: string; companyType: string; services: string; teamSize: string } | null) => void;
  addMessage: (msg: SetupChatMessage) => void;
  setBusinessDescription: (desc: string) => void;
  incrementMessageCount: () => void;
  setPlan: (plan: SetupPlan | null) => void;
  setManualSteps: (steps: ManualStep[]) => void;
  toggleManualStep: (index: number) => void;
  reset: (newConversationId: string) => void;
}

// ---------------------------------------------------------------------------
// Store factory — keyed by workspace ID
// ---------------------------------------------------------------------------

const stores = new Map<string, ReturnType<typeof createSetupStore>>();

function createSetupStore(workspaceId: string) {
  return create<SetupState>()(
    persist(
      (set) => ({
        currentStep: 0,
        conversationId: `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

        workspaceAnalysis: null,
        workspaceCounts: null,
        workspaceFindings: [],
        workspaceRecommendations: [],

        profileFormCompleted: false,
        profileFormData: null,
        chatMessages: [],
        businessDescription: '',
        messageCount: 0,

        proposedPlan: null,

        manualSteps: [],

        setStep: (step) => set({ currentStep: step }),
        setConversationId: (id) => set({ conversationId: id }),

        setAnalysis: (analysis, counts, findings, recommendations) =>
          set({ workspaceAnalysis: analysis, workspaceCounts: counts, workspaceFindings: findings, workspaceRecommendations: recommendations }),

        setProfileFormCompleted: (completed) => set({ profileFormCompleted: completed }),
        setProfileFormData: (data) => set({ profileFormData: data }),

        addMessage: (msg) =>
          set((s) => ({ chatMessages: [...s.chatMessages.slice(-29), msg] })),

        setBusinessDescription: (desc) => set({ businessDescription: desc }),
        incrementMessageCount: () => set((s) => ({ messageCount: s.messageCount + 1 })),

        setPlan: (plan) => set({ proposedPlan: plan }),

        setManualSteps: (steps) => set({ manualSteps: steps }),
        toggleManualStep: (index) =>
          set((s) => ({
            manualSteps: s.manualSteps.map((step, i) =>
              i === index ? { ...step, completed: !step.completed } : step
            ),
          })),

        reset: (newConversationId) =>
          set({
            currentStep: 0,
            conversationId: newConversationId,
            workspaceAnalysis: null,
            workspaceCounts: null,
            workspaceFindings: [],
            workspaceRecommendations: [],
            profileFormCompleted: false,
            profileFormData: null,
            chatMessages: [],
            businessDescription: '',
            messageCount: 0,
            proposedPlan: null,
            manualSteps: [],
          }),
      }),
      {
        name: `binee-setup-${workspaceId}`,
        // Only persist resumable data, not the action functions
        partialize: (state) => ({
          currentStep: state.currentStep,
          conversationId: state.conversationId,
          workspaceAnalysis: state.workspaceAnalysis,
          workspaceCounts: state.workspaceCounts,
          workspaceFindings: state.workspaceFindings,
          workspaceRecommendations: state.workspaceRecommendations,
          profileFormCompleted: state.profileFormCompleted,
          profileFormData: state.profileFormData,
          chatMessages: state.chatMessages,
          businessDescription: state.businessDescription,
          messageCount: state.messageCount,
          proposedPlan: state.proposedPlan,
          manualSteps: state.manualSteps,
        }),
      }
    )
  );
}

/**
 * Get or create a setup store for a specific workspace.
 * Each workspace gets its own localStorage key.
 */
export function getSetupStore(workspaceId: string) {
  if (!workspaceId) return null;
  let store = stores.get(workspaceId);
  if (!store) {
    store = createSetupStore(workspaceId);
    stores.set(workspaceId, store);
  }
  return store;
}
