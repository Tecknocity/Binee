'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SetupPlan, ManualStep, ExecutionResult } from '@/lib/setup/types';
import type { ExecutionItem } from '@/lib/setup/executor';

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

export interface ExistingSpaceInfo {
  clickup_id: string;
  name: string;
  folders: Array<{
    clickup_id: string;
    name: string;
    lists: Array<{
      clickup_id: string;
      name: string;
      task_count: number;
      statuses: unknown;
    }>;
  }>;
  /** Folderless lists that live directly in the space */
  lists?: Array<{
    clickup_id: string;
    name: string;
    task_count: number;
    statuses: unknown;
  }>;
}

export interface ExistingWorkspaceStructure {
  spaces: ExistingSpaceInfo[];
  captured_at: string;
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
  furthestStep: SetupStep;
  conversationId: string;

  // Step 1: Analysis
  workspaceAnalysis: string | null;
  workspaceCounts: WorkspaceCounts | null;
  workspaceFindings: Finding[];
  workspaceRecommendations: Recommendation[];

  // Step 2: Profile form + Chat
  profileFormCompleted: boolean;
  profileFormData: {
    industry: string;
    industryCustom: string;
    workStyle: string;
    services: string;
    teamSize: string;
  } | null;
  chatMessages: SetupChatMessage[];
  businessDescription: string;
  messageCount: number;

  // Step 3: Plan
  proposedPlan: SetupPlan | null;
  planHistory: SetupPlan[]; // All previously generated plans (v1, v2, ...)

  // Existing workspace structure (from cached tables)
  existingStructure: ExistingWorkspaceStructure | null;

  // Step 4: Build execution results (persisted so they survive navigation)
  executionResult: ExecutionResult | null;
  executionItems: ExecutionItem[];
  buildCompleted: boolean;
  /** Items successfully created by Binee in previous builds (for reconciliation/deletion) */
  previouslyBuiltItems: ExecutionItem[];

  // Step 5: Manual steps
  manualSteps: ManualStep[];

  // Actions
  setStep: (step: SetupStep) => void;
  setFurthestStep: (step: SetupStep) => void;
  setConversationId: (id: string) => void;
  setAnalysis: (analysis: string | null, counts: WorkspaceCounts | null, findings: Finding[], recommendations: Recommendation[]) => void;
  setProfileFormCompleted: (completed: boolean) => void;
  setProfileFormData: (data: { industry: string; industryCustom: string; workStyle: string; services: string; teamSize: string } | null) => void;
  addMessage: (msg: SetupChatMessage) => void;
  setBusinessDescription: (desc: string) => void;
  incrementMessageCount: () => void;
  setPlan: (plan: SetupPlan | null) => void;
  pushPlanToHistory: (plan: SetupPlan) => void;
  setExistingStructure: (structure: ExistingWorkspaceStructure | null) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  setExecutionItems: (items: ExecutionItem[]) => void;
  setBuildCompleted: (completed: boolean) => void;
  setPreviouslyBuiltItems: (items: ExecutionItem[]) => void;
  setManualSteps: (steps: ManualStep[]) => void;
  toggleManualStep: (index: number) => void;
  resetFromStep: (step: SetupStep) => void;
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
        furthestStep: 0,
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
        planHistory: [],
        existingStructure: null,

        executionResult: null,
        executionItems: [],
        buildCompleted: false,
        previouslyBuiltItems: [],

        manualSteps: [],

        setStep: (step) => set((s) => ({
          currentStep: step,
          furthestStep: step > s.furthestStep ? step as SetupStep : s.furthestStep,
        })),
        setFurthestStep: (step) => set({ furthestStep: step }),
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
        pushPlanToHistory: (plan) => set((s) => ({
          planHistory: [...s.planHistory.slice(-4), plan], // Keep last 5 max
        })),
        setExistingStructure: (structure) => set({ existingStructure: structure }),

        setExecutionResult: (result) => set({ executionResult: result }),
        setExecutionItems: (items) => set({ executionItems: items }),
        setBuildCompleted: (completed) => set({ buildCompleted: completed }),
        setPreviouslyBuiltItems: (items) => set({ previouslyBuiltItems: items }),
        setManualSteps: (steps) => set({ manualSteps: steps }),
        toggleManualStep: (index) =>
          set((s) => ({
            manualSteps: s.manualSteps.map((step, i) =>
              i === index ? { ...step, completed: !step.completed } : step
            ),
          })),

        resetFromStep: (step) =>
          set((s) => {
            const updates: Partial<SetupState> = {
              currentStep: step,
              furthestStep: step < s.furthestStep ? step as SetupStep : s.furthestStep,
            };
            // Clear data from this step onward
            if (step <= 1) {
              // Resetting from Analyze: clear analysis + everything after
              updates.workspaceAnalysis = null;
              updates.workspaceCounts = null;
              updates.workspaceFindings = [];
              updates.workspaceRecommendations = [];
            }
            if (step <= 2) {
              // Resetting from Describe: clear chat and start fresh so AI
              // doesn't reference previous discussion. Keep form data so user
              // doesn't have to re-fill the profile.
              updates.profileFormCompleted = s.profileFormCompleted; // Keep form data
              updates.profileFormData = s.profileFormData; // Keep form data
              updates.businessDescription = ''; // Clear description for fresh start
              updates.chatMessages = []; // Clear chat messages
              updates.messageCount = 0; // Reset message count
              updates.conversationId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // New conversation
            }
            if (step <= 3) {
              // Resetting from Review: clear plan + existing structure + build + manual steps
              // planHistory intentionally preserved so user can reference earlier plans
              updates.proposedPlan = null;
              updates.existingStructure = null;
            }
            if (step <= 4) {
              // Resetting from Build: clear build results + manual steps
              // Note: previouslyBuiltItems is intentionally preserved for reconciliation
              updates.executionResult = null;
              updates.executionItems = [];
              updates.buildCompleted = false;
              updates.manualSteps = [];
            }
            return updates;
          }),

        reset: (newConversationId) =>
          set({
            currentStep: 0,
            furthestStep: 0,
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
            planHistory: [],
            existingStructure: null,
            executionResult: null,
            executionItems: [],
            buildCompleted: false,
            previouslyBuiltItems: [],
            manualSteps: [],
          }),
      }),
      {
        name: `binee-setup-${workspaceId}`,
        // Only persist resumable data, not the action functions
        partialize: (state) => ({
          currentStep: state.currentStep,
          furthestStep: state.furthestStep,
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
          planHistory: state.planHistory,
          existingStructure: state.existingStructure,
          executionResult: state.executionResult,
          executionItems: state.executionItems,
          buildCompleted: state.buildCompleted,
          previouslyBuiltItems: state.previouslyBuiltItems,
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
