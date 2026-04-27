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
import { computeItemsToDelete, computeExistingItemsNotInPlan } from '@/lib/setup/executor';
// generateSetupPlan is called via /api/setup/generate-plan (server-side only)
import { generateManualSteps } from '@/lib/setup/manual-steps';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getSetupStore, buildDescriptionFromForm } from '@/stores/setupStore';
import type {
  SetupChatMessage as StoreChatMessage,
  ExistingWorkspaceStructure,
  EnrichmentJobView,
  EnrichmentSummary,
} from '@/stores/setupStore';
import type { ImageAttachmentPayload } from '@/types/ai';

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
  /**
   * Optional images uploaded in the form's "Additional context" zone.
   * These are stored as pending and pre-loaded into the chat input so the
   * user sends them with their first chat message.
   */
  imageAttachments?: ImageAttachmentPayload[];
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
  sendMessage: (msg: string, fileContext?: string, imageAttachments?: ImageAttachmentPayload[]) => void;
  /** Images uploaded in the BusinessProfileForm waiting to be sent with the next chat message. */
  pendingImageAttachments: ImageAttachmentPayload[];
  /** Clear pending images once they've been attached to a chat message. */
  clearPendingImageAttachments: () => void;
  submitProfileForm: (data: ProfileFormData) => void;
  updatePlan: (plan: SetupPlan) => void;
  approvePlan: (opts?: { generateEnrichment?: boolean }) => void;
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
  /** Existing workspace items not in the proposed plan (candidates for user-initiated deletion) */
  existingItemsNotInPlan: ExecutionItem[];
  /** Whether AI recommendations are loading */
  isLoadingRecommendations: boolean;
  /** Whether deletion is pending user confirmation */
  hasPendingDeletions: boolean;
  /** Confirm and execute deletion of selected old items, then build new plan */
  confirmDeletionsAndBuild: (selectedItems?: ExecutionItem[]) => void;
  /** Skip deletions and just build new plan (old items remain in ClickUp) */
  skipDeletionsAndBuild: () => void;
  /** Whether deletions are currently being executed */
  isDeleting: boolean;
  /** Active enrichment build ID (queue-backed, navigation-safe) */
  buildId: string | null;
  /** Enrichment build status */
  buildStatus: 'enriching' | 'completed' | 'failed' | 'cancelled' | null;
  /** When the active build started (ISO) */
  buildStartedAt: string | null;
  /** Estimated completion time (ISO) */
  buildEstimatedCompletionAt: string | null;
  /** Estimated minutes for the build (display only) */
  buildEtaMinutes: number | null;
  /** Per-item enrichment job state, hydrated from polling */
  enrichmentJobs: EnrichmentJobView[];
  /** Aggregate enrichment counts */
  enrichmentSummary: EnrichmentSummary;
  /** Retry one specific failed enrichment job */
  retryEnrichmentJob: (jobId: string) => Promise<void>;
  /** Retry every failed enrichment job in the active build */
  retryAllFailedEnrichment: () => Promise<void>;
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

/**
 * Build a welcome message that acknowledges profile form data when available.
 */
function buildWelcomeMessage(profile: ProfileFormData | null): SetupChatMessage {
  if (profile && (profile.industry || profile.services || profile.teamSize)) {
    const parts: string[] = [];
    if (profile.industry) parts.push(`you're in **${profile.industry}**`);
    if (profile.services) parts.push(`offering **${profile.services}**`);
    if (profile.teamSize) parts.push(`with a **${profile.teamSize}** team`);

    const summary = parts.join(', ');

    return {
      id: 'welcome',
      role: 'assistant',
      content: `Great, I can see ${summary}.\n\nI have your business profile ready. Want me to go ahead and **build your workspace structure**? Or tell me more about your workflows, tools, or any specific needs first.`,
      timestamp: new Date(),
    };
  }

  return {
    id: 'welcome',
    role: 'assistant',
    content:
      "Welcome! I'm here to help you set up your ClickUp workspace.\n\nTell me about your business: what do you do, what services or products do you offer, and how does your team work? The more detail you share, the better I can tailor your workspace.",
    timestamp: new Date(),
  };
}

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
  const { workspace_id, workspace } = useWorkspace();

  // Get the zustand store for this workspace + currently connected ClickUp
  // team. Switching ClickUp teams (consultant managing multiple clients)
  // re-keys the store, so the new team starts with a fresh wizard instead
  // of inheriting the previous client's chat, profile, draft, or plan tier.
  const clickUpTeamId = workspace?.clickup_team_id ?? null;
  const store = workspace_id ? getSetupStore(workspace_id, clickUpTeamId) : null;
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
  const pendingImageAttachments = storeState?.pendingImageAttachments ?? [];
  // messageCount from store is no longer used directly — sendMessage derives
  // the fallback index from actual chatMessages to avoid count drift.
  const proposedPlan = storeState?.proposedPlan ?? null;
  const existingStructure = storeState?.existingStructure ?? null;
  const manualSteps = storeState?.manualSteps ?? [];
  const persistedExecutionResult = storeState?.executionResult ?? null;
  const persistedExecutionItems = storeState?.executionItems ?? [];
  const buildCompleted = storeState?.buildCompleted ?? false;
  const buildId = storeState?.buildId ?? null;
  const buildStatus = storeState?.buildStatus ?? null;
  const buildStartedAt = storeState?.buildStartedAt ?? null;
  const buildEstimatedCompletionAt = storeState?.buildEstimatedCompletionAt ?? null;
  const buildEtaMinutes = storeState?.buildEtaMinutes ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enrichmentJobs = useMemo(() => storeState?.enrichmentJobs ?? [], [storeState?.enrichmentJobs]);
  const enrichmentSummary = storeState?.enrichmentSummary ?? { pending: 0, in_progress: 0, done: 0, failed: 0 };
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
    // Prepend welcome message if no messages — uses profile data for context-aware greeting
    if (msgs.length === 0) return [buildWelcomeMessage(profileFormData)];
    return msgs;
  }, [storedMessages, profileFormData]);

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

  // Reconciliation: compute items to delete when rebuilding, enriched with
  // task counts from the existing workspace structure so the UI can warn
  // about non-empty lists/spaces before deletion.
  const itemsToDelete = useMemo(() => {
    if (!proposedPlan || previouslyBuiltItems.length === 0) return [];
    const raw = computeItemsToDelete(previouslyBuiltItems, proposedPlan);
    if (!existingStructure?.spaces || raw.length === 0) return raw;

    // Build a lookup: clickupId → task count from existing structure
    const taskCounts = new Map<string, number>();
    for (const space of existingStructure.spaces) {
      // Sum all tasks across all lists in this space
      let spaceTotal = 0;
      for (const folder of space.folders) {
        let folderTotal = 0;
        for (const list of folder.lists) {
          taskCounts.set(list.clickup_id, list.task_count);
          folderTotal += list.task_count;
        }
        taskCounts.set(folder.clickup_id, folderTotal);
        spaceTotal += folderTotal;
      }
      for (const list of space.lists ?? []) {
        taskCounts.set(list.clickup_id, list.task_count);
        spaceTotal += list.task_count;
      }
      taskCounts.set(space.clickup_id, spaceTotal);
    }

    return raw.map(item => ({
      ...item,
      taskCount: item.clickupId ? (taskCounts.get(item.clickupId) ?? 0) : 0,
    }));
  }, [proposedPlan, previouslyBuiltItems, existingStructure]);

  // Existing workspace items NOT in the proposed plan and NOT already tracked
  // as Binee-built items. These are user-created items occupying plan slots
  // that the user may want to delete to make room for new items.
  const rawExistingItemsNotInPlan = useMemo(() => {
    if (!proposedPlan || !existingStructure?.spaces) return [];
    return computeExistingItemsNotInPlan(existingStructure, proposedPlan, previouslyBuiltItems);
  }, [proposedPlan, existingStructure, previouslyBuiltItems]);

  // AI recommendations for existing items (keep/delete with reasoning)
  const [recommendations, setRecommendations] = useState<
    Map<string, { action: 'keep' | 'delete'; reason: string }>
  >(new Map());
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const recommendationsLoadedRef = useRef(false);

  // Fetch AI recommendations when existing items are available at the review step
  useEffect(() => {
    if (
      currentStep !== 3 ||
      rawExistingItemsNotInPlan.length === 0 ||
      recommendationsLoadedRef.current ||
      !proposedPlan ||
      !workspace_id
    ) return;
    recommendationsLoadedRef.current = true;
    setIsLoadingRecommendations(true);

    const planTier = workspace?.clickup_plan_tier ?? undefined;

    // Count new spaces (not in existing structure)
    const existingSpaceNames = new Set(
      (existingStructure?.spaces ?? []).map(s => s.name.toLowerCase())
    );
    const newSpaceCount = proposedPlan.spaces.filter(
      s => !existingSpaceNames.has(s.name.toLowerCase())
    ).length;

    (async () => {
      try {
        const res = await fetchWithTimeout('/api/setup/reconciliation-recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            existingItems: rawExistingItemsNotInPlan,
            proposedPlan,
            businessDescription: businessDescription || undefined,
            planTier,
            maxSpaces: planTier === 'free' ? 5 : null,
            existingSpaceCount: existingStructure?.spaces?.length ?? 0,
            newSpaceCount,
          }),
        }, 25_000);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.recommendations)) {
            const map = new Map<string, { action: 'keep' | 'delete'; reason: string }>();
            for (const rec of data.recommendations) {
              if (rec.key) {
                map.set(rec.key, { action: rec.action, reason: rec.reason });
              }
            }
            setRecommendations(map);
          }
        }
      } catch (err) {
        console.error('[useSetup] Failed to fetch reconciliation recommendations:', err);
      } finally {
        setIsLoadingRecommendations(false);
      }
    })();
  }, [currentStep, rawExistingItemsNotInPlan, proposedPlan, workspace_id, workspace, existingStructure, businessDescription]);

  // Reset recommendations when navigating away from review step
  useEffect(() => {
    if (currentStep !== 3) {
      recommendationsLoadedRef.current = false;
      setRecommendations(new Map());
    }
  }, [currentStep]);

  // Enrich existing items with AI recommendations
  const existingItemsNotInPlan = useMemo(() => {
    return rawExistingItemsNotInPlan.map(item => {
      const key = item.clickupId ?? `${item.type}:${item.name}`;
      const rec = recommendations.get(key);
      if (rec) {
        return { ...item, recommendation: rec.action, recommendationReason: rec.reason };
      }
      return item;
    });
  }, [rawExistingItemsNotInPlan, recommendations]);

  const hasPendingDeletions = itemsToDelete.length > 0 || existingItemsNotInPlan.length > 0;

  const wizardStep = NUMERIC_TO_WIZARD_STEP[currentStep];

  // Store setters — wrapped for convenience
  const setCurrentStep = useCallback((step: SetupStep) => {
    store?.getState().setStep(step);
  }, [store]);

  // Auto-advance from step 0 → step 1 when ClickUp is connected
  // On first visit (furthestStep === 0): always auto-advance after 800ms
  // On revisit after OAuth: fully reset the wizard so the new workspace
  // starts from scratch (analysis, profile, chat, plan, build all cleared).
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
          // After (re)connecting via OAuth, wipe everything from the previous
          // workspace. The user was warned in the reconnect modal that
          // progress would be reset; honor that by doing a true full reset
          // (form data, plan history, previously built items, etc.).
          if (isReturningFromOAuth && furthestStep > 0) {
            const newId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            store?.getState().reset(newId);
            existingStructureLoadedRef.current = false;
            buildRestoredRef.current = false;
            recommendationsLoadedRef.current = false;
            setExecutionProgress(null);
            setExecutionResult(null);
            setExecutionItems([]);
            setIsExecuting(false);
            setIsSending(false);
          }
          analysisStartedRef.current = false;
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
          // Always persist the loaded structure, including empty ones. The
          // server now returns `{spaces: []}` for empty workspaces (instead
          // of null) so we can reconcile stale previouslyBuiltItems.
          if (data.structure) {
            store?.getState().setExistingStructure(data.structure);
          }
        }
      } catch (err) {
        console.error('[useSetup] Failed to load existing structure:', err);
      }
    })();
  }, [currentStep, existingStructure, workspace_id, store]);

  // Reconcile previouslyBuiltItems against the live ClickUp state.
  //
  // previouslyBuiltItems is persisted in localStorage and preserved across
  // resetFromStep(1) calls (including ClickUp reconnects) so we can offer to
  // clean up items from prior builds. But if the user deleted those items
  // manually in ClickUp, they no longer exist and shouldn't appear in the
  // "items to remove" list. Prune any entry whose clickupId is absent from
  // the freshly-loaded existingStructure.
  useEffect(() => {
    if (!existingStructure || previouslyBuiltItems.length === 0) return;

    const existingSpaceIds = new Set<string>();
    const existingFolderIds = new Set<string>();
    const existingListIds = new Set<string>();
    for (const space of existingStructure.spaces) {
      existingSpaceIds.add(space.clickup_id);
      for (const folder of space.folders) {
        existingFolderIds.add(folder.clickup_id);
        for (const list of folder.lists) existingListIds.add(list.clickup_id);
      }
      for (const list of space.lists ?? []) existingListIds.add(list.clickup_id);
    }
    const existingDocIds = new Set((existingStructure.docs ?? []).map(d => d.clickup_id));
    // Tags are identified by (space_id, name) - ClickUp tags are space-scoped
    const existingTagKeys = new Set(
      (existingStructure.tags ?? []).map(t => `${t.space_id}:${t.name.toLowerCase().trim()}`)
    );

    const reconciled = previouslyBuiltItems.filter(item => {
      if (!item.clickupId) return true; // Keep items that were never successfully created (no ID)
      switch (item.type) {
        case 'space':  return existingSpaceIds.has(item.clickupId);
        case 'folder': return existingFolderIds.has(item.clickupId);
        case 'list':   return existingListIds.has(item.clickupId);
        case 'doc':    return existingDocIds.has(item.clickupId);
        case 'tag':    return existingTagKeys.has(`${item.clickupId}:${item.name.toLowerCase().trim()}`);
        // Goals are not fetched in existingStructure yet - keep them to avoid
        // false pruning. If orphaned, the delete call will 404 and be treated
        // as success by deleteRemovedItems.
        case 'goal':   return true;
        default:       return true;
      }
    });

    if (reconciled.length !== previouslyBuiltItems.length) {
      store?.getState().setPreviouslyBuiltItems(reconciled);
    }
  }, [existingStructure, previouslyBuiltItems, store]);

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
    // resetFromStep(1) cascades through steps 1-4, clearing analysis, chat,
    // plan, and execution data. Reset all tracking refs to match.
    analysisStartedRef.current = false;
    existingStructureLoadedRef.current = false;
    buildRestoredRef.current = false;
    recommendationsLoadedRef.current = false;
    setIsAnalyzing(false);
    setExecutionProgress(null);
    setExecutionResult(null);
    setExecutionItems([]);
    setIsExecuting(false);
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
    async (msg: string, fileContext?: string, imageAttachments?: ImageAttachmentPayload[]) => {
      if (!msg.trim() || isSending) return;

      addMessage('user', msg);
      setIsSending(true);

      // Read live values from the store to avoid stale closures
      const state = store?.getState();
      const liveConversationId = state?.conversationId ?? conversationId;

      const payload = {
        workspace_id,
        conversation_id: liveConversationId,
        message: msg,
        workspace_analysis: fullAnalysisContext,
        proposed_plan: state?.proposedPlan ?? undefined,
        profile_data: state?.profileFormData ?? undefined,
        // Send the chat structure snapshot so the AI has full context
        chat_structure_snapshot: state?.chatStructureSnapshot ?? undefined,
        ...(fileContext ? { file_context: fileContext } : {}),
        ...(imageAttachments && imageAttachments.length > 0 ? { image_attachments: imageAttachments } : {}),
      };

      // Try with one automatic retry on failure (handles transient 500s)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetchWithTimeout('/api/setup/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }, 90_000);

          if (response.ok) {
            const data = await response.json();
            if (data.content) {
              addMessage('assistant', data.content);
              // Save structure snapshot if the AI returned one
              if (data.structure_snapshot) {
                store?.getState().setChatStructureSnapshot(data.structure_snapshot);
              }
              setIsSending(false);
              return;
            }
            console.error(`[setup/sendMessage] API returned ok but empty content (attempt ${attempt + 1})`);
          } else {
            console.error(`[setup/sendMessage] API returned status ${response.status} (attempt ${attempt + 1})`);
          }
        } catch (err) {
          console.error(`[setup/sendMessage] API call failed (attempt ${attempt + 1}):`, err);
        }

        // Wait 1.5s before retrying
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      // Both attempts failed — show honest error
      addMessage('assistant', "Sorry, I wasn't able to process that. Please try sending your message again. Don't worry, our conversation history is saved.");
      setIsSending(false);
    },
    [addMessage, isSending, workspace_id, conversationId, fullAnalysisContext, store]
  );

  // Shared helper: clear all build/execution state so the user can rebuild.
  // Called from navigateToStep and generateStructure when returning after a build.
  const clearBuildState = useCallback(() => {
    store?.getState().setBuildCompleted(false);
    store?.getState().setExecutionResult(null);
    store?.getState().setExecutionItems([]);
    store?.getState().setExistingStructure(null);
    store?.getState().setManualSteps([]);
    existingStructureLoadedRef.current = false;
    buildRestoredRef.current = false;
    recommendationsLoadedRef.current = false;
    setExecutionProgress(null);
    setExecutionResult(null);
    setExecutionItems([]);
    setIsExecuting(false);
  }, [store]);

  const generateStructure = useCallback(async () => {
    setIsGenerating(true);
    setIsSending(true);

    // If rebuilding after a previous build, clear stale state
    if (store?.getState().buildCompleted) {
      clearBuildState();
    }

    // Immediately advance to step 3 so the user sees a "building" animation
    setCurrentStep(3);
    try {
      // Read live values from the store to avoid stale closures
      const state = store?.getState();

      // Save current plan to history before generating a new one, then clear
      // it from the store. Clearing avoids two failure modes on regeneration:
      // (1) the Review step rendering the stale plan while the new one is
      //     still being generated, and
      // (2) the stale plan being sent as `previousPlan` to the planner, which
      //     would compete with `chatStructureSnapshot` as a baseline and push
      //     the model toward inconsistent output.
      const currentPlan = state?.proposedPlan;
      if (currentPlan) {
        store?.getState().pushPlanToHistory(currentPlan);
        store?.getState().setPlan(null);
      }

      // Resolve businessDescription: prefer store value, fall back to rebuilding
      // from profileFormData. This prevents 400 errors when resetFromStep or
      // stale closures leave businessDescription empty while form data is intact.
      const liveDescription = state?.businessDescription
        || businessDescription
        || buildDescriptionFromForm(state?.profileFormData ?? null);

      if (!liveDescription) {
        throw new Error('No business description available. Please fill in your business profile first.');
      }

      // Build plan history summary so the planner knows what was tried before
      const history = state?.planHistory || [];
      const planHistorySummary = history.length > 0
        ? history.map((p, i) => `Plan v${i + 1}: ${p.spaces.map(s => s.name).join(', ')} (${p.reasoning?.slice(0, 100) || 'no reasoning'})`).join('\n')
        : undefined;

      // Pass conversation_id so the server loads the full chat history and
      // latest structure snapshot directly from the DB - same context the
      // chat AI sees. The client no longer needs to bundle it all up.
      const liveConversationId = state?.conversationId ?? conversationId;
      const chatSnapshot = state?.chatStructureSnapshot as Record<string, unknown> | null;

      const res = await fetchWithTimeout('/api/setup/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: liveConversationId,
          businessProfile: {
            businessDescription: liveDescription,
            teamSize: businessProfile.teamSize,
            departments: businessProfile.departments,
            tools: businessProfile.tools,
            workflows: businessProfile.workflows,
            painPoints: businessProfile.painPoints,
          },
          workspaceAnalysis: workspaceAnalysis ?? undefined,
          chatStructureSnapshot: chatSnapshot ?? undefined,
          // Only fall back to the prior generated plan when the chat has not
          // produced a snapshot. The chat snapshot is the authoritative latest
          // baseline; sending both confuses the planner.
          previousPlan: chatSnapshot ? undefined : currentPlan ?? undefined,
          planHistorySummary: planHistorySummary || undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Plan generation failed (status ${res.status})`);
      }
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
    } catch (err) {
      console.error('[generateStructure] Failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      addMessage('assistant', `Sorry, I had trouble generating a workspace plan: ${message}. Please try again.`);
      // Go back to Describe step on failure
      setCurrentStep(2);
    }
    setIsGenerating(false);
    setIsSending(false);
  }, [addMessage, businessDescription, businessProfile, workspaceAnalysis, store, setCurrentStep, clearBuildState, conversationId]);

  const enhancedSendMessage = useCallback(
    (msg: string, fileContext?: string, imageAttachments?: ImageAttachmentPayload[]) => {
      if (msg === '__generate_structure__') { generateStructure(); return; }
      sendMessage(msg, fileContext, imageAttachments);
    },
    [sendMessage, generateStructure]
  );

  // Shared execution runner for approvePlan and retryFailedItems.
  // Drives the structural creation synchronously, then registers a queue-backed
  // build for the enrichment phase. Polling is handled by a separate effect
  // so the enrichment continues even if the user navigates away.
  const runExecution = useCallback(async (
    structure: ExistingWorkspaceStructure | null,
    runOptions?: { generateEnrichment?: boolean },
  ) => {
    if (!proposedPlan) return;

    // Pre-compute manual steps from the plan immediately. They never depend
    // on execution outcomes, so the Finish step is useful even if the
    // enrichment is still in flight or the user lands there partway through.
    try {
      const steps = generateManualSteps(proposedPlan as SetupPlan);
      store?.getState().setManualSteps(steps);
    } catch (err) {
      console.error('[useSetup] Failed to compute manual steps:', err);
    }

    try {
      // Structural creation typically completes well under 60s. The new
      // execute endpoint returns immediately after structural creation and
      // enqueues enrichment jobs into setup_enrichment_jobs.
      const response = await fetchWithTimeout('/api/setup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id,
          plan: proposedPlan,
          existing_structure: structure,
          generate_enrichment: runOptions?.generateEnrichment !== false,
        }),
      }, 90_000);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Execution failed' }));
        const structuralFromError = errData?.structural_result;
        if (structuralFromError?.items) {
          setExecutionItems(structuralFromError.items);
          store?.getState().setExecutionItems(structuralFromError.items);
        }
        setExecutionProgress({
          phase: 'complete',
          current: 0,
          total: 0,
          currentItem: '',
          errors: [errData.error || 'Execution failed'],
        });
        return;
      }

      const responseData = await response.json() as {
        build_id: string | null;
        started_at: string;
        estimated_completion_at: string | null;
        eta_minutes: number;
        structural_result: ExecutorResult;
        total_jobs: number;
      };

      const executorResult = responseData.structural_result;
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

      store?.getState().setExecutionItems(resultItems);
      store?.getState().setExecutionResult(executionResultData);
      store?.getState().setBuildCompleted(true);

      // Register the queue-backed build so the polling effect can watch it.
      store?.getState().setBuild({
        buildId: responseData.build_id,
        buildStatus: responseData.build_id ? 'enriching' : 'completed',
        buildStartedAt: responseData.started_at,
        buildEstimatedCompletionAt: responseData.estimated_completion_at,
        buildEtaMinutes: responseData.eta_minutes,
      });
      // Reset enrichment view; polling will hydrate it.
      store?.getState().setEnrichmentJobs([]);
      store?.getState().setEnrichmentSummary({ pending: 0, in_progress: 0, done: 0, failed: 0 });

      // Save successfully created items for future reconciliation
      const newlyCreated = resultItems.filter(i => i.status === 'success' && i.clickupId);
      const existingBuilt = store?.getState().previouslyBuiltItems ?? [];
      const allBuiltMap = new Map<string, ExecutionItem>();
      for (const item of existingBuilt) {
        if (item.clickupId) allBuiltMap.set(item.clickupId, item);
      }
      for (const item of newlyCreated) {
        if (item.clickupId) allBuiltMap.set(item.clickupId, item);
      }
      store?.getState().setPreviouslyBuiltItems(Array.from(allBuiltMap.values()));

      // Auto-advance if no structural errors (spaces/folders/lists).
      // Tags/docs/goals failures are shown but should not block progression.
      // Enrichment runs in the background regardless.
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

  // ---------------------------------------------------------------------------
  // Unified build lifecycle: DELETE old → FETCH fresh state → CREATE new
  //
  // Every build path (approve, retry, confirm-with-deletions) goes through
  // this single function. The lifecycle ensures old items are cleaned up
  // before new ones are created, preventing plan-limit collisions.
  //
  // Options:
  //   skipDeletions  - true when user explicitly chose "Keep All & Build"
  //   selectedItems  - user-selected subset of itemsToDelete (from checkboxes)
  //   isRetry        - true when retrying a failed build (resets UI state)
  // ---------------------------------------------------------------------------
  const executeBuild = useCallback(async (options?: {
    skipDeletions?: boolean;
    selectedItems?: ExecutionItem[];
    isRetry?: boolean;
    generateEnrichment?: boolean;
  }) => {
    if (!proposedPlan || isExecuting) return;
    setCurrentStep(4);
    setIsExecuting(true);

    // For retries, reset progress state so UI shows building animation
    if (options?.isRetry) {
      buildRestoredRef.current = false;
      setExecutionProgress(null);
      setExecutionItems([]);
      setExecutionResult(null);
      store?.getState().setBuildCompleted(false);
      store?.getState().setExecutionResult(null);
      store?.getState().setExecutionItems([]);
    }

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

    // ------------------------------------------------------------------
    // Phase 1: DELETE — Remove items from previous builds that are no
    // longer in the current plan. This frees up plan slots (e.g. spaces
    // on the Free tier) before we attempt to create new ones.
    //
    // Only deletes items the user explicitly selected (or all pending
    // items if no explicit selection was provided). Items Binee never
    // created are never touched.
    // ------------------------------------------------------------------
    const deletionList = options?.selectedItems ?? itemsToDelete;
    if (!options?.skipDeletions && deletionList.length > 0) {
      setIsDeleting(true);

      try {
        const deleteResponse = await fetchWithTimeout('/api/setup/delete-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id,
            items_to_delete: deletionList,
          }),
        }, 60_000);

        if (deleteResponse.ok) {
          const { results: deleteResults } = await deleteResponse.json();
          const deletedIds = new Set(
            deleteResults
              .filter((r: ExecutionItem) => r.status === 'success' && r.clickupId)
              .map((r: ExecutionItem) => r.clickupId)
          );

          // Update tracking: remove successfully deleted items
          const remaining = previouslyBuiltItems.filter(i => !deletedIds.has(i.clickupId));
          store?.getState().setPreviouslyBuiltItems(remaining);

          // If structural items (spaces/folders) failed to delete, abort -
          // creating new ones will hit plan limits
          const failedStructural = deleteResults.filter(
            (r: ExecutionItem) => r.status === 'error' && (r.type === 'space' || r.type === 'folder')
          );
          if (failedStructural.length > 0) {
            const names = failedStructural.map((r: ExecutionItem) => r.name).join(', ');
            setExecutionProgress({
              phase: 'complete',
              current: 0,
              total: 0,
              currentItem: '',
              errors: [`Failed to delete old items from ClickUp: ${names}. Please delete them manually in ClickUp and retry.`],
            });
            setIsDeleting(false);
            setIsExecuting(false);
            return;
          }
        } else {
          const errData = await deleteResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[useSetup] Delete API returned error:', errData);
          setExecutionProgress({
            phase: 'complete',
            current: 0,
            total: 0,
            currentItem: '',
            errors: [`Failed to remove old items from ClickUp: ${errData.error || 'Server error'}. Please try again.`],
          });
          setIsDeleting(false);
          setIsExecuting(false);
          return;
        }
      } catch (err) {
        console.error('[useSetup] Failed to delete old items:', err);
        setExecutionProgress({
          phase: 'complete',
          current: 0,
          total: 0,
          currentItem: '',
          errors: [`Failed to remove old items from ClickUp: ${err instanceof Error ? err.message : 'Network error'}. Please try again.`],
        });
        setIsDeleting(false);
        setIsExecuting(false);
        return;
      }

      setIsDeleting(false);
    }

    // ------------------------------------------------------------------
    // Phase 2: FETCH — Get fresh workspace structure from ClickUp so the
    // executor knows which items already exist (skip) vs. need creating.
    // ------------------------------------------------------------------
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
      console.error('[useSetup] Failed to refresh existing structure:', err);
    }

    // ------------------------------------------------------------------
    // Phase 3: CREATE — Execute the plan. The executor skips items that
    // already exist and creates everything else.
    // ------------------------------------------------------------------
    await runExecution(freshStructure, { generateEnrichment: options?.generateEnrichment });
  }, [proposedPlan, isExecuting, workspace_id, setCurrentStep, itemsToDelete, previouslyBuiltItems, existingStructure, store, runExecution]);

  // Public API — thin wrappers over the unified build lifecycle

  /** Standard build: delete old → fetch → create new */
  const approvePlan = useCallback(async (opts?: { generateEnrichment?: boolean }) => {
    await executeBuild({ generateEnrichment: opts?.generateEnrichment });
  }, [executeBuild]);

  /**
   * Build with user-selected deletions. The selectedItems parameter
   * contains only the items the user checked in the deletion dialog.
   * Items the user unchecked are kept in ClickUp.
   */
  const confirmDeletionsAndBuild = useCallback(async (
    selectedItems?: ExecutionItem[],
    opts?: { generateEnrichment?: boolean },
  ) => {
    await executeBuild({ selectedItems, generateEnrichment: opts?.generateEnrichment });
  }, [executeBuild]);

  /** User explicitly chose to keep old items — skip the delete phase */
  const skipDeletionsAndBuild = useCallback(async (opts?: { generateEnrichment?: boolean }) => {
    await executeBuild({ skipDeletions: true, generateEnrichment: opts?.generateEnrichment });
  }, [executeBuild]);

  /** Retry a failed build — resets UI state, then runs the full lifecycle */
  const retryFailedItems = useCallback(async () => {
    await executeBuild({ isRetry: true });
  }, [executeBuild]);

  // ---------------------------------------------------------------------------
  // Enrichment polling: keeps the UI in sync with setup_builds /
  // setup_enrichment_jobs while a build is running. Survives navigation
  // because state lives in the store + DB. The cron does the actual work
  // independently; polling is purely for UI freshness when a tab is open.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!buildId || buildStatus !== 'enriching' || !workspace_id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetchWithTimeout(
          `/api/setup/enrichment-status?workspace_id=${encodeURIComponent(workspace_id)}&build_id=${encodeURIComponent(buildId)}`,
          { method: 'GET' },
          15_000,
        );
        if (!res.ok) {
          if (!cancelled) timer = setTimeout(tick, 8_000);
          return;
        }
        const data = await res.json() as {
          build: {
            id: string;
            status: 'enriching' | 'completed' | 'failed' | 'cancelled';
            started_at: string;
            completed_at: string | null;
            estimated_completion_at: string | null;
          } | null;
          jobs: EnrichmentJobView[];
          summary: EnrichmentSummary;
        };
        if (cancelled) return;
        if (data.build) {
          store?.getState().setBuildStatus(data.build.status);
        }
        store?.getState().setEnrichmentJobs(data.jobs ?? []);
        store?.getState().setEnrichmentSummary(data.summary ?? { pending: 0, in_progress: 0, done: 0, failed: 0 });

        // Best-effort kick to the worker so progress shows up immediately
        // when the tab is open. Cron handles it when the tab is closed.
        if (data.build?.status === 'enriching' && (data.summary?.pending ?? 0) > 0) {
          fetch('/api/setup/run-enrichment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id }),
            credentials: 'same-origin',
          }).catch(() => undefined);
        }

        const stillRunning = data.build?.status === 'enriching';
        if (stillRunning && !cancelled) {
          timer = setTimeout(tick, 4_000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 8_000);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [buildId, buildStatus, workspace_id, store]);

  /** Retry a single failed enrichment job by id. */
  const retryEnrichmentJob = useCallback(async (jobId: string) => {
    if (!buildId) return;
    try {
      await fetchWithTimeout('/api/setup/retry-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: buildId, job_ids: [jobId] }),
      }, 15_000);
      // Mark optimistic; polling will rehydrate.
      store?.getState().setBuildStatus('enriching');
    } catch (err) {
      console.error('[useSetup] retryEnrichmentJob failed:', err);
    }
  }, [buildId, store]);

  /** Retry every failed enrichment job in the current build. */
  const retryAllFailedEnrichment = useCallback(async () => {
    if (!buildId) return;
    try {
      await fetchWithTimeout('/api/setup/retry-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: buildId, all_failed: true }),
      }, 15_000);
      store?.getState().setBuildStatus('enriching');
    } catch (err) {
      console.error('[useSetup] retryAllFailedEnrichment failed:', err);
    }
  }, [buildId, store]);

  const requestChanges = useCallback(
    async (feedback: string) => {
      setCurrentStep(2);
      addMessage('user', feedback);
      setIsSending(true);

      // Read live values from store to avoid stale closures
      const state = store?.getState();
      const liveConversationId = state?.conversationId ?? conversationId;
      const livePlan = state?.proposedPlan ?? proposedPlan;
      const liveProfile = state?.profileFormData ?? profileFormData;

      // Build rich context so the AI doesn't start fresh
      const previousPlanSummary = livePlan
        ? `\n\nPREVIOUS WORKSPACE STRUCTURE (what was generated):\n${livePlan.spaces.map(s =>
            `Space: ${s.name}\n${s.folders.map(f =>
              `  Folder: ${f.name}\n${f.lists.map(l =>
                `    List: ${l.name} (statuses: ${l.statuses.map(st => st.name).join(', ')})`
              ).join('\n')}`
            ).join('\n')}`
          ).join('\n')}\n\nThe user has already reviewed this structure and wants to make changes. Do NOT ask them to describe their business again. Ask specifically what they want to change about the structure above.`
        : '';

      const profileContext = liveProfile
        ? `\n\nUSER PROFILE (already collected, do NOT re-ask):\n- Industry: ${liveProfile.industry}\n- Work style: ${liveProfile.workStyle}\n- Services: ${liveProfile.services}\n- Team size: ${liveProfile.teamSize}`
        : '';

      const payload = {
        workspace_id,
        conversation_id: liveConversationId,
        message: `I want to revise the proposed workspace structure. Here's my feedback: ${feedback}${previousPlanSummary}${profileContext}`,
        workspace_analysis: fullAnalysisContext,
        proposed_plan: livePlan ?? undefined,
        profile_data: liveProfile ?? undefined,
        chat_structure_snapshot: state?.chatStructureSnapshot ?? undefined,
      };

      // Try with one automatic retry
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetchWithTimeout('/api/setup/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.content) {
              addMessage('assistant', data.content);
              if (data.structure_snapshot) {
                store?.getState().setChatStructureSnapshot(data.structure_snapshot);
              }
              setIsSending(false);
              return;
            }
            console.error(`[setup/requestChanges] API returned ok but empty content (attempt ${attempt + 1})`);
          } else {
            console.error(`[setup/requestChanges] API returned status ${response.status} (attempt ${attempt + 1})`);
          }
        } catch (err) {
          console.error(`[setup/requestChanges] API call failed (attempt ${attempt + 1}):`, err);
        }

        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      addMessage('assistant', "I wasn't able to process your feedback right now. Please try sending your message again, or click **\"Generate Structure\"** to regenerate the plan.");
      setIsSending(false);
    },
    [addMessage, workspace_id, conversationId, fullAnalysisContext, setCurrentStep, proposedPlan, profileFormData, store]
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
    setCurrentStep(step);
  }, [setCurrentStep]);

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
    // Reset all tracking refs so effects re-run with fresh data
    existingStructureLoadedRef.current = false;
    buildRestoredRef.current = false;
    recommendationsLoadedRef.current = false;
    setExecutionProgress(null);
    setExecutionResult(null);
    setExecutionItems([]);
    setIsExecuting(false);
    setIsSending(false);
  }, [store]);

  const restartSetup = useCallback(() => {
    const newId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    store?.getState().reset(newId);
    // Reset all tracking refs so effects re-run with fresh data
    analysisStartedRef.current = false;
    existingStructureLoadedRef.current = false;
    buildRestoredRef.current = false;
    recommendationsLoadedRef.current = false;
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
    // Clear businessDescription so stale data from the old profile isn't used
    // if something triggers generation before the user re-submits the form.
    store?.getState().setBusinessDescription('');
  }, [store]);

  const submitProfileForm = useCallback(
    (data: ProfileFormData) => {
      // Strip imageAttachments before persisting profileFormData — they live
      // in pendingImageAttachments instead so they can be consumed once.
      const { imageAttachments: pendingImages, ...persistedData } = data;
      store?.getState().setProfileFormData(persistedData);
      store?.getState().setProfileFormCompleted(true);

      // Use the shared buildDescriptionFromForm so the description logic
      // (e.g. resolving "Other" → industryCustom) stays in one place.
      const desc = buildDescriptionFromForm(persistedData, persistedData.fileContext);
      store?.getState().setBusinessDescription(desc);

      // Stash any uploaded images so the next chat send picks them up.
      if (pendingImages && pendingImages.length > 0) {
        store?.getState().setPendingImageAttachments(pendingImages);
      }
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
    pendingImageAttachments,
    clearPendingImageAttachments: () => store?.getState().clearPendingImageAttachments(),
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
    existingItemsNotInPlan,
    isLoadingRecommendations,
    hasPendingDeletions,
    confirmDeletionsAndBuild,
    skipDeletionsAndBuild,
    isDeleting,
    buildId,
    buildStatus,
    buildStartedAt,
    buildEstimatedCompletionAt,
    buildEtaMinutes,
    enrichmentJobs,
    enrichmentSummary,
    retryEnrichmentJob,
    retryAllFailedEnrichment,
  };
}
