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
}

export interface ToolCallResult {
  tool_name: string;
  tool_input: Record<string, unknown>;
  result: Record<string, unknown>;
  success: boolean;
  error?: string;
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
