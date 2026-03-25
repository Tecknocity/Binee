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

export interface UserProfile {
  id: string;
  user_id: string;
  preferred_name: string | null;
  work_role: string | null;
  personal_preferences: string | null;
  timezone: string;
  avatar_url: string | null;
  notifications_enabled: boolean;
  notify_task_complete: boolean;
  notify_daily_standup: boolean;
  daily_standup_time: string;
  notify_daily_digest: boolean;
  daily_digest_time: string;
  allow_training: boolean;
  chat_history_enabled: boolean;
  onboarding_completed: boolean;
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
  clickup_plan_tier: 'free' | 'unlimited' | 'business' | 'business_plus' | 'enterprise' | null;
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
  data_json: Record<string, unknown> | null;
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
  data_json: Record<string, unknown> | null;
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
  data_json: Record<string, unknown> | null;
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
  data_json: Record<string, unknown> | null;
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
  data_json: Record<string, unknown> | null;
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
  data_json: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

// PRD alias: cached_members view maps to cached_team_members
export type CachedMember = CachedTeamMember;

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
  source: string | null;
  received_at: string;
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
  type: 'deduction' | 'purchase' | 'bonus' | 'refund' | 'monthly_reset' | 'subscription_grant';
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
  layout_json: Record<string, unknown>;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserDashboardPreference {
  id: string;
  user_id: string;
  workspace_id: string;
  last_active_dashboard_id: string | null;
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
  previous_score: number | null;
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

export interface HealthSnapshot {
  id: string;
  workspace_id: string;
  overall_score: number;
  category_scores: Record<string, number>;
  previous_score: number | null;
  snapshot_week: string; // DATE as ISO string (Monday of the week)
  created_at: string;
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

export interface PlanConfiguration {
  plan: string;
  monthly_credits: number;
  price_cents: number;
  max_members: number | null;
  features: Record<string, unknown>;
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

// Billing types — mirrors user-scoped billing tables (migration 024)
export interface UserCreditAccount {
  id: string;
  user_id: string;
  balance: number;
  lifetime_credits: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_tier: '100' | '150' | '250' | '500' | '750' | '1000' | '2000';
  billing_period: 'monthly' | 'annual';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripe_customer_id: string | null;
  payment_provider_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  annual_end_date: string | null;
  last_credit_allocation_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreditUsage {
  id: string;
  user_id: string;
  session_id: string | null;
  action_type: string;
  credits_used: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WeeklyUsageSummary {
  id: string;
  workspace_id: string;
  week_start: string;
  total_credits: number;
  chat_credits: number;
  health_check_credits: number;
  setup_credits: number;
  dashboard_credits: number;
  briefing_credits: number;
  created_at: string;
}

// Supabase Tables type map for client typing
export interface Tables {
  profiles: Profile;
  user_profiles: UserProfile;
  workspaces: Workspace;
  workspace_members: WorkspaceMember;
  workspace_invitations: WorkspaceInvitation;
  cached_spaces: CachedSpace;
  cached_folders: CachedFolder;
  cached_lists: CachedList;
  cached_tasks: CachedTask;
  cached_time_entries: CachedTimeEntry;
  cached_team_members: CachedTeamMember;
  cached_members: CachedMember;
  webhook_registrations: WebhookRegistration;
  clickup_connections: ClickupConnection;
  webhook_events: WebhookEvent;
  conversations: Conversation;
  messages: Message;
  credit_transactions: CreditTransaction;
  dashboards: Dashboard;
  dashboard_widgets: DashboardWidget;
  user_dashboard_preferences: UserDashboardPreference;
  health_check_results: HealthCheckResult;
  health_snapshots: HealthSnapshot;
  setup_sessions: SetupSession;
  plan_configurations: PlanConfiguration;
  user_credit_accounts: UserCreditAccount;
  user_subscriptions: UserSubscription;
  user_credit_transactions: UserCreditTransaction;
  credit_usage: CreditUsage;
  weekly_usage_summaries: WeeklyUsageSummary;
}
