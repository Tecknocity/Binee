// Binee Database Types — mirrors the Supabase schema

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: 'free' | 'starter' | 'pro';
  credit_balance: number;
  clickup_team_id: string | null;
  clickup_access_token: string | null;
  clickup_refresh_token: string | null;
  clickup_token_expires_at: string | null;
  clickup_connected: boolean;
  clickup_team_name: string | null;
  clickup_webhook_id: string | null;
  clickup_webhook_endpoint: string | null;
  clickup_last_webhook_at: string | null;
  clickup_sync_status: 'idle' | 'syncing' | 'error' | 'complete';
  clickup_last_synced_at: string | null;
  clickup_sync_error: string | null;
  clickup_plan_tier: string | null;
  last_sync_at: string | null;
  credits_reset_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  invited_email: string | null;
  status: 'pending' | 'active' | 'removed';
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedSpace {
  id: string;
  workspace_id: string;
  clickup_id: string;
  name: string;
  private: boolean;
  status: Record<string, unknown> | null;
  features: Record<string, unknown> | null;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedFolder {
  id: string;
  workspace_id: string;
  clickup_id: string;
  space_id: string;
  name: string;
  hidden: boolean;
  task_count: number;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedList {
  id: string;
  workspace_id: string;
  clickup_id: string;
  folder_id: string | null;
  space_id: string;
  name: string;
  task_count: number;
  status: Record<string, unknown> | null;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedTask {
  id: string;
  workspace_id: string;
  clickup_id: string;
  list_id: string;
  name: string;
  description: string | null;
  status: string | null;
  priority: number | null;
  assignees: Record<string, unknown>[] | null;
  tags: string[] | null;
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  custom_fields: Record<string, unknown>[] | null;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedTimeEntry {
  id: string;
  workspace_id: string;
  clickup_id: string;
  task_id: string;
  user_id: string;
  duration: number;
  start_time: string;
  end_time: string | null;
  description: string | null;
  billable: boolean;
  tags: string[] | null;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedTeamMember {
  id: string;
  workspace_id: string;
  clickup_id: string;
  username: string;
  email: string | null;
  initials: string | null;
  profile_picture: string | null;
  role: number | null;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookRegistration {
  id: string;
  workspace_id: string;
  clickup_webhook_id: string;
  endpoint: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClickupConnection {
  id: string;
  workspace_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  clickup_user_id: string | null;
  clickup_team_id: string | null;
  plan_tier: 'free' | 'unlimited' | 'business' | 'business_plus' | 'enterprise';
  sync_status: 'idle' | 'syncing' | 'error' | 'complete';
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  workspace_id: string;
  webhook_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  context_type: 'general' | 'health' | 'setup' | 'dashboard' | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  workspace_id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls_json: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  credits_used: number;
  model_used: string | null;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  workspace_id: string;
  user_id: string | null;
  amount: number;
  balance_after: number;
  type: 'deduction' | 'purchase' | 'bonus' | 'refund' | 'monthly_reset';
  description: string;
  message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  layout: Record<string, unknown>[];
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  workspace_id: string;
  dashboard_id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResult {
  id: string;
  workspace_id: string;
  overall_score: number;
  category_scores: Record<string, number>;
  issues: HealthIssue[];
  recommendations: string[];
  checked_at: string;
  credits_used: number;
  created_at: string;
}

export interface HealthIssue {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affected_items: string[];
  suggestion: string;
}

export interface SetupSession {
  id: string;
  workspace_id: string;
  user_id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  setup_type: 'new_space' | 'optimize' | 'template';
  config: Record<string, unknown>;
  conversation_id: string | null;
  result: Record<string, unknown> | null;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

// Helper type for deduct_credits RPC response
export interface DeductCreditsResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  balance?: number;
  deducted?: number;
  required?: number;
}

// Helper type for add_credits RPC response
export interface AddCreditsResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  balance?: number;
  added?: number;
}
