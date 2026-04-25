// ---------------------------------------------------------------------------
// B-073: AI Setup Planner types
// ---------------------------------------------------------------------------

/**
 * Business profile collected during the discovery conversation (B-072).
 * Passed to the AI planner to generate a tailored workspace structure.
 */
export interface BusinessProfile {
  businessDescription: string;
  teamSize: string | null;
  departments: string[] | null;
  tools: string[] | null;
  workflows: string[] | null;
  painPoints: string[] | null;
}

// ---------------------------------------------------------------------------
// Setup plan — structured output from the AI planner
// ---------------------------------------------------------------------------

export interface SetupPlan {
  /** Detected industry/business type */
  business_type: string;
  /** Which KB template was used as the base reference */
  matched_template: string;
  /** Workspace hierarchy: Spaces -> Folders -> Lists with Statuses */
  spaces: SpacePlan[];
  /** ClickApps recommended for this workspace */
  recommended_clickapps: string[];
  /** Tags recommended for the workspace (created in the first space) */
  recommended_tags?: RecommendedTag[];
  /** Starter docs recommended for the workspace */
  recommended_docs?: RecommendedDoc[];
  /** Goals recommended for the workspace */
  recommended_goals?: RecommendedGoal[];
  /** AI reasoning for why this structure was chosen */
  reasoning: string;
  /**
   * Compact workspace context derived from the business profile. Passed to the
   * enrichment phase (task + doc generation) so Haiku can produce grounded,
   * domain-aware content. Not shown in the preview UI.
   */
  context?: WorkspaceContext;
}

/**
 * Compact workspace grounding passed to per-list task generation and per-doc
 * content generation. Derived from the BusinessProfile at plan time; kept short
 * so each Haiku call stays cheap.
 */
export interface WorkspaceContext {
  /** Industry or business type, e.g. "B2B SaaS marketing agency" */
  domain: string;
  /** The user's headline goal, e.g. "launch paid acquisition for Q3" */
  primaryGoal: string;
  /** Optional team shape, e.g. "5 people, 2 content, 1 designer, 2 ads" */
  teamShape?: string;
}

export interface RecommendedTag {
  /** Tag name */
  name: string;
  /** Background color hex (e.g. "#854DF9") */
  tag_bg: string;
  /** Foreground color hex (e.g. "#FFFFFF") */
  tag_fg: string;
}

export interface RecommendedDoc {
  /** Document title */
  name: string;
  /** Brief description of the doc's purpose */
  description: string;
  /** Optional target audience, e.g. "new content writers" */
  audience?: string;
  /** Optional section outline that guides post-confirm content generation */
  outline?: string[];
  /**
   * Optional starter content (markdown). Kept for backwards compatibility with
   * older plans. New plans leave this empty; content is generated in the
   * enrichment phase after the user confirms the plan.
   */
  content?: string;
}

/**
 * A starter task generated for a list after the user confirms the plan.
 * Generated in the enrichment phase (not in the preview) via Haiku per list.
 */
export interface RecommendedTask {
  name: string;
  description?: string;
  /** ClickUp priority: 1=urgent, 2=high, 3=normal, 4=low */
  priority?: 1 | 2 | 3 | 4;
  /** Tag names that must match tags already created in the workspace */
  tags?: string[];
  /**
   * 3-4 short checklist items added to the task after creation. Makes the
   * starter task feel populated rather than an empty shell. Generic phrasing
   * is fine - the goal is to show the user what a "lived-in" task looks like.
   */
  checklist?: string[];
  /**
   * Index (within this list's task array) of another starter task that must
   * complete before this one can start. The generator uses this on a few
   * later tasks in lists with 3+ tasks to demonstrate dependencies. Ignored
   * when the referenced index is invalid or self-referential.
   */
  dependsOnIndex?: number;
}

export interface RecommendedGoal {
  /** Goal name */
  name: string;
  /** Due date as ISO date string */
  due_date: string;
  /** Brief description */
  description?: string;
  /** Goal color hex */
  color?: string;
}

export interface SpacePlan {
  name: string;
  /**
   * Short statement of what this space is for, in the user's own words from
   * the chat (e.g. "personal stuff like shopping and errands"). Populated by
   * the planner from the conversation. Passed to enrichment so generated
   * tasks/docs reflect the user's actual intent for the space.
   */
  purpose?: string;
  /** Folders containing lists (3rd layer, optional) */
  folders: FolderPlan[];
  /** Lists directly in the space without a folder (preferred flat structure) */
  lists?: ListPlan[];
}

export interface FolderPlan {
  name: string;
  lists: ListPlan[];
}

export interface ListPlan {
  name: string;
  statuses: StatusPlan[];
  /** Short description of the list's purpose (legacy field, still used). */
  description?: string;
  /**
   * 1-2 sentence purpose pulled from the chat in the user's own words. When
   * present, takes priority over `description` for downstream task generation.
   */
  purpose?: string;
  /**
   * Concrete example tasks the user mentioned in chat for this list. Used as
   * grounding by the task generator so starter tasks reflect the user's real
   * work, not generic templates. Empty when the user did not provide any.
   */
  taskExamples?: string[];
}

export interface StatusPlan {
  name: string;
  color: string;
  type: 'open' | 'active' | 'done' | 'closed';
}

// ---------------------------------------------------------------------------
// B-079: Execution step tracking
// ---------------------------------------------------------------------------

export type ExecutionStepStatus = 'pending' | 'in_progress' | 'success' | 'error' | 'skipped';

export interface ExecutionStep {
  id: string;
  type: 'space' | 'folder' | 'list';
  name: string;
  parentName?: string;
  status: ExecutionStepStatus;
  error?: string;
  clickupId?: string;
  startedAt?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// B-079: Wizard step names
// ---------------------------------------------------------------------------

export type SetupWizardStep =
  | 'business_chat'
  | 'preview'
  | 'executing'
  | 'manual_steps'
  | 'complete';

// ---------------------------------------------------------------------------
// B-079: Setup session state (persisted to Supabase)
// ---------------------------------------------------------------------------

export interface SetupSessionState {
  wizardStep: SetupWizardStep;
  businessProfile: {
    businessDescription: string | null;
    teamSize: string | null;
    departments: string[] | null;
    tools: string[] | null;
    workflows: string[] | null;
    painPoints: string[] | null;
  };
  plan: SetupPlan | null;
  executionSteps: ExecutionStep[];
  executionResult: {
    success: boolean;
    totalItems: number;
    successCount: number;
    errorCount: number;
  } | null;
  manualStepsCompleted: number[];
  chatMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  conversationId: string;
  startedAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Manual step (post-creation guidance)
// ---------------------------------------------------------------------------

export interface ManualStep {
  title: string;
  description: string;
  instructions: string[];
  category: 'automation' | 'view' | 'setting' | 'custom_field';
  clickupLink?: string;
  completed: boolean;
}

// ---------------------------------------------------------------------------
// Execution progress tracking (used by useSetup and ExecutionProgress UI)
// ---------------------------------------------------------------------------

export interface ExecutionProgress {
  phase: string;
  current: number;
  total: number;
  currentItem: string;
  errors: string[];
}

export interface ExecutionResult {
  success: boolean;
  spacesCreated: number;
  foldersCreated: number;
  listsCreated: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SetupPlanValidationResult {
  valid: boolean;
  errors: string[];
}
