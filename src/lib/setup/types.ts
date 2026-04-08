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
  /** Optional initial content (markdown) */
  content?: string;
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
  description?: string;
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
