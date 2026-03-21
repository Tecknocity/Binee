export type TaskType =
  | 'simple_lookup'
  | 'complex_query'
  | 'action_request'
  | 'setup_request'
  | 'health_check'
  | 'dashboard_request'
  | 'analysis_audit'
  | 'strategy'
  | 'troubleshooting';

export type ModelTier = 'haiku' | 'sonnet';

export interface ModelRouting {
  model: ModelTier;
  modelId: string;
  creditCost: number;
}

export interface ModelConfig {
  model: string;
  maxTokens: number;
}

export interface BineeContext {
  user: {
    id: string;
    display_name: string;
    role: 'admin' | 'member';
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    clickup_connected: boolean;
    clickup_plan_tier: string | null;
    credit_balance: number;
    last_sync_at: string | null;
  };
  businessState: BusinessState;
  workspaceSummary: string;
  recentActivity: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface AssistantResponse {
  content: string;
  model_used: string;
  credits_consumed: number;
  tool_calls: ToolCallResult[] | null;
  tokens_input: number;
  tokens_output: number;
  /** B-045: Present when a write operation is awaiting user confirmation */
  pending_action?: {
    id: string;
    description: string;
    details: string;
  } | null;
}

export interface ToolCallResult {
  tool_name: string;
  tool_input: Record<string, unknown>;
  result: Record<string, unknown>;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Business State Document — compressed workspace context for LLM (B-041)
// Target: 1,500–3,000 tokens
// ---------------------------------------------------------------------------

export interface BusinessState {
  generated_at: string;
  workspace_id: string;

  /** High-level task metrics */
  tasks: {
    total: number;
    overdue: number;
    unassigned: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_assignee: Array<{ name: string; count: number }>;
  };

  /** Team snapshot */
  team: {
    total_members: number;
    members: Array<{ name: string; email: string | null }>;
  };

  /** Workspace hierarchy: spaces → folders → lists */
  structure: {
    total_spaces: number;
    total_folders: number;
    total_lists: number;
    spaces: Array<{
      name: string;
      folders: Array<{ name: string; list_count: number }>;
      folderless_lists: string[];
    }>;
  };

  /** Recent activity summary (last 24h) */
  recent_activity: {
    total_events: number;
    by_type: Record<string, number>;
  };

  /** Token budget metadata */
  _meta: {
    approx_tokens: number;
    truncated: boolean;
  };
}

export interface ChatRequest {
  workspace_id: string;
  user_id: string;
  conversation_id: string;
  message: string;
}

export interface ClassificationResult {
  taskType: TaskType;
  confidence: number;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Confirmation flow (B-045) — pending actions for write operations
// ---------------------------------------------------------------------------

export interface PendingAction {
  id: string;
  workspace_id: string;
  conversation_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  description: string;
  details: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'failed';
  created_at: string;
  resolved_at?: string;
  execution_result?: Record<string, unknown>;
  execution_error?: string;
}

export interface ConfirmActionRequest {
  workspace_id: string;
  conversation_id: string;
  action_id: string;
  confirmed: boolean;
}

export interface ConfirmActionResponse {
  action_id: string;
  status: PendingAction['status'];
  result?: Record<string, unknown>;
  error?: string;
}
