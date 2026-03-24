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
// Validation
// ---------------------------------------------------------------------------

export interface SetupPlanValidationResult {
  valid: boolean;
  errors: string[];
}
