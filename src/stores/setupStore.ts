'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SetupPlan, ManualStep, ExecutionResult } from '@/lib/setup/types';
import type { ExecutionItem } from '@/lib/setup/executor';
import type { ImageAttachmentPayload } from '@/types/ai';

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
  /** Space-level statuses (inherited by all child folders/lists unless overridden) */
  statuses?: unknown;
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

export interface ExistingDocInfo {
  clickup_id: string;
  name: string;
}

export interface ExistingTagInfo {
  /** Parent space's ClickUp ID (tags in ClickUp are scoped to a space) */
  space_id: string;
  /** Tag name (case-sensitive, unique per space) */
  name: string;
}

export interface ExistingWorkspaceStructure {
  spaces: ExistingSpaceInfo[];
  /** Docs that exist in the workspace (fetched live from ClickUp) */
  docs?: ExistingDocInfo[];
  /** Tags that exist in the workspace, scoped per space (fetched live from ClickUp) */
  tags?: ExistingTagInfo[];
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

export interface EnrichmentJobView {
  id: string;
  type: 'list_tasks' | 'doc_content' | 'list_views';
  target_name: string;
  parent_name: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  attempts: number;
  last_error: string | null;
  result: Record<string, unknown> | null;
}

export interface EnrichmentSummary {
  pending: number;
  in_progress: number;
  done: number;
  failed: number;
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
    /** Phase 3: user-selected ClickUp plan (replaces OAuth scrape). */
    clickupPlan: 'free' | 'unlimited' | 'business' | 'business_plus' | 'enterprise' | '';
  } | null;
  chatMessages: SetupChatMessage[];
  businessDescription: string;
  messageCount: number;

  /**
   * Images uploaded in the BusinessProfileForm "Additional context" zone.
   * Pre-loaded into the BusinessChatStep input so the user sends them with
   * their first chat message. Cleared once consumed.
   */
  pendingImageAttachments: ImageAttachmentPayload[];

  // Step 2-3: Chat structure snapshot (built incrementally during chat)
  chatStructureSnapshot: Record<string, unknown> | null;

  /**
   * Status of the most recent PATCH /api/setup/draft call (manual edits in
   * Review). Surfaces in the Review UI as a small "Saving / Saved / Failed"
   * indicator so the user has feedback that their edit reached the server.
   * Previously the PATCH was fire-and-forget, which meant a network blip
   * silently discarded edits.
   */
  draftSaveState: 'idle' | 'saving' | 'saved' | 'failed';

  /**
   * Multi-agent: the latest Clarifier output for the chat UI. `ask` powers
   * the chip bubble next to the most recent assistant message; `brief`
   * powers the "What I've gathered" pinned checkpoint above the input;
   * `ready` decides whether to highlight the Generate Structure button.
   * Overwritten each turn - we deliberately do not persist a history of
   * asks because only the latest one is interactive.
   */
  lastClarifierAsk: {
    topic: string;
    question: string;
    suggested_options: string[];
  } | null;
  lastClarifierBrief: Record<string, unknown> | null;
  isReadyForGenerate: boolean;

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

  // Step 4: Enrichment job tracking (the queue model). When a build is in
  // progress, buildId is set and the frontend polls /enrichment-status to
  // hydrate enrichmentJobs and buildStatus. These survive navigation so the
  // user can leave the page and come back to live progress.
  buildId: string | null;
  buildStatus: 'enriching' | 'completed' | 'failed' | 'cancelled' | null;
  buildStartedAt: string | null;
  buildEstimatedCompletionAt: string | null;
  buildEtaMinutes: number | null;
  enrichmentJobs: EnrichmentJobView[];
  enrichmentSummary: EnrichmentSummary;

  // Step 5: Manual steps
  manualSteps: ManualStep[];

  // Actions
  setStep: (step: SetupStep) => void;
  setFurthestStep: (step: SetupStep) => void;
  setConversationId: (id: string) => void;
  setAnalysis: (analysis: string | null, counts: WorkspaceCounts | null, findings: Finding[], recommendations: Recommendation[]) => void;
  setProfileFormCompleted: (completed: boolean) => void;
  setProfileFormData: (data: SetupState['profileFormData']) => void;
  addMessage: (msg: SetupChatMessage) => void;
  setBusinessDescription: (desc: string) => void;
  setPendingImageAttachments: (images: ImageAttachmentPayload[]) => void;
  clearPendingImageAttachments: () => void;
  incrementMessageCount: () => void;
  setChatStructureSnapshot: (snapshot: Record<string, unknown> | null) => void;
  setDraftSaveState: (state: 'idle' | 'saving' | 'saved' | 'failed') => void;
  setLastClarifierAsk: (ask: SetupState['lastClarifierAsk']) => void;
  setLastClarifierBrief: (brief: Record<string, unknown> | null) => void;
  setIsReadyForGenerate: (ready: boolean) => void;
  setPlan: (plan: SetupPlan | null) => void;
  pushPlanToHistory: (plan: SetupPlan) => void;
  setExistingStructure: (structure: ExistingWorkspaceStructure | null) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  setExecutionItems: (items: ExecutionItem[]) => void;
  setBuildCompleted: (completed: boolean) => void;
  setPreviouslyBuiltItems: (items: ExecutionItem[]) => void;
  setBuild: (info: {
    buildId: string | null;
    buildStatus: 'enriching' | 'completed' | 'failed' | 'cancelled' | null;
    buildStartedAt: string | null;
    buildEstimatedCompletionAt: string | null;
    buildEtaMinutes: number | null;
  }) => void;
  setBuildStatus: (status: 'enriching' | 'completed' | 'failed' | 'cancelled' | null) => void;
  setEnrichmentJobs: (jobs: EnrichmentJobView[]) => void;
  setEnrichmentSummary: (summary: EnrichmentSummary) => void;
  setManualSteps: (steps: ManualStep[]) => void;
  toggleManualStep: (index: number) => void;
  resetFromStep: (step: SetupStep) => void;
  reset: (newConversationId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORK_STYLE_LABELS: Record<string, string> = {
  'client-based': 'client-based work (managing multiple clients)',
  'product-based': 'product development (building and shipping products)',
  'project-based': 'project-based work (discrete projects with deadlines)',
  'operations-based': 'operations management (ongoing processes and workflows)',
};

/** Rebuild a business description from the saved profile form data. */
export function buildDescriptionFromForm(
  data: SetupState['profileFormData'],
  fileContext?: string,
): string {
  if (!data) return '';
  const industry = data.industry === 'Other' ? data.industryCustom : data.industry;
  if (!industry && !data.services) return '';
  let desc = `We're in the ${industry} industry. Our work style is ${WORK_STYLE_LABELS[data.workStyle] || data.workStyle}. Our services/products include: ${data.services}. Team size: ${data.teamSize}.`;
  if (fileContext) {
    desc += `\n\nAdditional context from uploaded files:\n${fileContext}`;
  }
  return desc;
}

// ---------------------------------------------------------------------------
// Store factory — keyed by Binee workspace ID + connected ClickUp team ID
//
// Including the ClickUp team ID in the key isolates wizard state per
// connected ClickUp workspace. A consultant who connects PrintGeek, then
// switches to ShowcaseAgency, then back to PrintGeek gets a clean slate
// for each team and the previous team's chat / draft / plan tier never
// bleed through. Old keys remain in localStorage (data is archived, not
// destroyed), so reconnecting a team restores its earlier wizard state.
// ---------------------------------------------------------------------------

const stores = new Map<string, ReturnType<typeof createSetupStore>>();

function createSetupStore(storeKey: string) {
  return create<SetupState>()(
    persist(
      (set) => ({
        currentStep: 0,
        furthestStep: 0,
        // Conversation IDs MUST be UUIDs because conversations.id and
        // messages.conversation_id are uuid columns - any other format
        // makes Postgres reject every upsert silently. crypto.randomUUID
        // is available in every browser secure context (HTTPS or
        // localhost) and on Node 19+, which covers all environments
        // that run this store. The hydration guard in useSetup detects
        // legacy non-UUID values from localStorage and replaces them.
        conversationId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : '',

        workspaceAnalysis: null,
        workspaceCounts: null,
        workspaceFindings: [],
        workspaceRecommendations: [],

        profileFormCompleted: false,
        profileFormData: null,
        chatMessages: [],
        businessDescription: '',
        messageCount: 0,
        pendingImageAttachments: [],

        chatStructureSnapshot: null,
        draftSaveState: 'idle',
        lastClarifierAsk: null,
        lastClarifierBrief: null,
        isReadyForGenerate: false,
        proposedPlan: null,
        planHistory: [],
        existingStructure: null,

        executionResult: null,
        executionItems: [],
        buildCompleted: false,
        previouslyBuiltItems: [],

        buildId: null,
        buildStatus: null,
        buildStartedAt: null,
        buildEstimatedCompletionAt: null,
        buildEtaMinutes: null,
        enrichmentJobs: [],
        enrichmentSummary: { pending: 0, in_progress: 0, done: 0, failed: 0 },

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
          set((s) => ({ chatMessages: [...s.chatMessages.slice(-199), msg] })),

        setBusinessDescription: (desc) => set({ businessDescription: desc }),
        setPendingImageAttachments: (images) => set({ pendingImageAttachments: images }),
        clearPendingImageAttachments: () => set({ pendingImageAttachments: [] }),
        incrementMessageCount: () => set((s) => ({ messageCount: s.messageCount + 1 })),

        setChatStructureSnapshot: (snapshot) => set({ chatStructureSnapshot: snapshot }),
        setDraftSaveState: (state) => set({ draftSaveState: state }),
        setLastClarifierAsk: (ask) => set({ lastClarifierAsk: ask }),
        setLastClarifierBrief: (brief) => set({ lastClarifierBrief: brief }),
        setIsReadyForGenerate: (ready) => set({ isReadyForGenerate: ready }),
        setPlan: (plan) => set({ proposedPlan: plan }),
        pushPlanToHistory: (plan) => set((s) => ({
          planHistory: [...s.planHistory.slice(-4), plan], // Keep last 5 max
        })),
        setExistingStructure: (structure) => set({ existingStructure: structure }),

        setExecutionResult: (result) => set({ executionResult: result }),
        setExecutionItems: (items) => set({ executionItems: items }),
        setBuildCompleted: (completed) => set({ buildCompleted: completed }),
        setPreviouslyBuiltItems: (items) => set({ previouslyBuiltItems: items }),
        setBuild: (info) => set(info),
        setBuildStatus: (status) => set({ buildStatus: status }),
        setEnrichmentJobs: (jobs) => set({ enrichmentJobs: jobs }),
        setEnrichmentSummary: (summary) => set({ enrichmentSummary: summary }),
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
              // Rebuild description from preserved form data so generateStructure
              // never sends an empty businessDescription (which causes a 400).
              updates.businessDescription = buildDescriptionFromForm(s.profileFormData);
              updates.chatMessages = []; // Clear chat messages
              updates.messageCount = 0; // Reset message count
              updates.chatStructureSnapshot = null; // Clear chat snapshot
              updates.pendingImageAttachments = []; // Clear pending images
              updates.lastClarifierAsk = null; // Clear multi-agent chip
              updates.lastClarifierBrief = null; // Clear multi-agent brief
              updates.isReadyForGenerate = false; // Reset Generate gate
              // New conversation - must be a UUID (see comment in defaults).
              updates.conversationId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : '';
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
              updates.buildId = null;
              updates.buildStatus = null;
              updates.buildStartedAt = null;
              updates.buildEstimatedCompletionAt = null;
              updates.buildEtaMinutes = null;
              updates.enrichmentJobs = [];
              updates.enrichmentSummary = { pending: 0, in_progress: 0, done: 0, failed: 0 };
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
            pendingImageAttachments: [],
            chatStructureSnapshot: null,
            draftSaveState: 'idle',
            lastClarifierAsk: null,
            lastClarifierBrief: null,
            isReadyForGenerate: false,
            proposedPlan: null,
            planHistory: [],
            existingStructure: null,
            executionResult: null,
            executionItems: [],
            buildCompleted: false,
            previouslyBuiltItems: [],
            buildId: null,
            buildStatus: null,
            buildStartedAt: null,
            buildEstimatedCompletionAt: null,
            buildEtaMinutes: null,
            enrichmentJobs: [],
            enrichmentSummary: { pending: 0, in_progress: 0, done: 0, failed: 0 },
            manualSteps: [],
          }),
      }),
      {
        name: `binee-setup-${storeKey}`,
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
          pendingImageAttachments: state.pendingImageAttachments,
          chatStructureSnapshot: state.chatStructureSnapshot,
          proposedPlan: state.proposedPlan,
          planHistory: state.planHistory,
          existingStructure: state.existingStructure,
          executionResult: state.executionResult,
          executionItems: state.executionItems,
          buildCompleted: state.buildCompleted,
          previouslyBuiltItems: state.previouslyBuiltItems,
          buildId: state.buildId,
          buildStatus: state.buildStatus,
          buildStartedAt: state.buildStartedAt,
          buildEstimatedCompletionAt: state.buildEstimatedCompletionAt,
          buildEtaMinutes: state.buildEtaMinutes,
          enrichmentJobs: state.enrichmentJobs,
          enrichmentSummary: state.enrichmentSummary,
          manualSteps: state.manualSteps,
        }),
      }
    )
  );
}

/**
 * Get or create a setup store for a specific Binee workspace + connected
 * ClickUp team. Pass `clickUpTeamId` whenever it is known so the wizard
 * state is scoped to that team. When no team is connected yet (Connect
 * step), pass null and the bare workspace key is used; once OAuth completes
 * and a team_id is available, the caller naturally re-keys to a fresh,
 * team-scoped store.
 */
export function getSetupStore(workspaceId: string, clickUpTeamId: string | null = null) {
  if (!workspaceId) return null;
  const storeKey = clickUpTeamId ? `${workspaceId}::${clickUpTeamId}` : workspaceId;
  let store = stores.get(storeKey);
  if (!store) {
    // One-time migration for users who were mid-wizard before the store key
    // included clickup_team_id. Without this, the key change would orphan
    // their state and force them to restart. Only fires when the new key has
    // never been written.
    if (typeof window !== 'undefined' && clickUpTeamId) {
      const newName = `binee-setup-${storeKey}`;
      const legacyName = `binee-setup-${workspaceId}`;
      if (!window.localStorage.getItem(newName)) {
        const legacy = window.localStorage.getItem(legacyName);
        if (legacy) {
          try {
            window.localStorage.setItem(newName, legacy);
          } catch {
            // localStorage write can fail (quota / private mode); not fatal,
            // user just starts fresh on the new key.
          }
        }
      }
    }
    store = createSetupStore(storeKey);
    stores.set(storeKey, store);
  }
  return store;
}
