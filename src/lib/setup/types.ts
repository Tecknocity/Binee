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
  /** AI reasoning for why this structure was chosen */
  reasoning: string;
}

export interface SpacePlan {
  name: string;
  folders: FolderPlan[];
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
  conversationId: string;
  startedAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SetupPlanValidationResult {
  valid: boolean;
  errors: string[];
}
