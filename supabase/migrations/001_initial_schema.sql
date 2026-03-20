-- Binee Initial Schema Migration
-- Creates all tables, RLS policies, indexes, and RPC functions

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  credit_balance integer not null default 100,
  clickup_team_id text,
  clickup_access_token text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workspaces_owner on workspaces(owner_id);
create index idx_workspaces_slug on workspaces(slug);

alter table workspaces enable row level security;

create policy "Owners can update workspaces" on workspaces
  for update using (owner_id = auth.uid());

create policy "Authenticated users can create workspaces" on workspaces
  for insert with check (owner_id = auth.uid());

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create index idx_workspace_members_workspace on workspace_members(workspace_id);
create index idx_workspace_members_user on workspace_members(user_id);

alter table workspace_members enable row level security;

create policy "Members can view their workspace members" on workspace_members
  for select using (
    workspace_id in (select workspace_id from workspace_members wm where wm.user_id = auth.uid())
  );

create policy "Admins can manage members" on workspace_members
  for all using (
    workspace_id in (
      select workspace_id from workspace_members wm
      where wm.user_id = auth.uid() and wm.role in ('owner', 'admin')
    )
  );

-- Deferred from workspaces section (requires workspace_members to exist)
create policy "Users can view own workspaces" on workspaces
  for select using (
    owner_id = auth.uid() or
    id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- WORKSPACE INVITATIONS
-- ============================================================
create table workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workspace_invitations_workspace on workspace_invitations(workspace_id);
create index idx_workspace_invitations_email on workspace_invitations(email);
create index idx_workspace_invitations_token on workspace_invitations(token);

alter table workspace_invitations enable row level security;

create policy "Workspace members can view invitations" on workspace_invitations
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Admins can manage invitations" on workspace_invitations
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================================
-- CACHED SPACES
-- ============================================================
create table cached_spaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_id text not null,
  name text not null,
  private boolean not null default false,
  status jsonb,
  features jsonb,
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_id)
);

create index idx_cached_spaces_workspace on cached_spaces(workspace_id);

alter table cached_spaces enable row level security;

create policy "Workspace members can view cached spaces" on cached_spaces
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage cached spaces" on cached_spaces
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CACHED FOLDERS
-- ============================================================
create table cached_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_id text not null,
  space_id text not null,
  name text not null,
  hidden boolean not null default false,
  task_count integer not null default 0,
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_id)
);

create index idx_cached_folders_workspace on cached_folders(workspace_id);
create index idx_cached_folders_space on cached_folders(workspace_id, space_id);

alter table cached_folders enable row level security;

create policy "Workspace members can view cached folders" on cached_folders
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage cached folders" on cached_folders
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CACHED LISTS
-- ============================================================
create table cached_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_id text not null,
  folder_id text,
  space_id text not null,
  name text not null,
  task_count integer not null default 0,
  status jsonb,
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_id)
);

create index idx_cached_lists_workspace on cached_lists(workspace_id);
create index idx_cached_lists_space on cached_lists(workspace_id, space_id);
create index idx_cached_lists_folder on cached_lists(workspace_id, folder_id);

alter table cached_lists enable row level security;

create policy "Workspace members can view cached lists" on cached_lists
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage cached lists" on cached_lists
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CACHED TASKS
-- ============================================================
create table cached_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_id text not null,
  list_id text not null,
  name text not null,
  description text,
  status text,
  priority integer,
  assignees jsonb,
  tags jsonb,
  due_date timestamptz,
  start_date timestamptz,
  time_estimate bigint,
  time_spent bigint,
  custom_fields jsonb,
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_id)
);

create index idx_cached_tasks_workspace on cached_tasks(workspace_id);
create index idx_cached_tasks_list on cached_tasks(workspace_id, list_id);
create index idx_cached_tasks_status on cached_tasks(workspace_id, status);
create index idx_cached_tasks_due on cached_tasks(workspace_id, due_date);

alter table cached_tasks enable row level security;

create policy "Workspace members can view cached tasks" on cached_tasks
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage cached tasks" on cached_tasks
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CACHED TIME ENTRIES
-- ============================================================
create table cached_time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_id text not null,
  task_id text not null,
  user_id text not null,
  duration bigint not null,
  start_time timestamptz not null,
  end_time timestamptz,
  description text,
  billable boolean not null default false,
  tags jsonb,
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_id)
);

create index idx_cached_time_entries_workspace on cached_time_entries(workspace_id);
create index idx_cached_time_entries_task on cached_time_entries(workspace_id, task_id);
create index idx_cached_time_entries_user on cached_time_entries(workspace_id, user_id);

alter table cached_time_entries enable row level security;

create policy "Workspace members can view cached time entries" on cached_time_entries
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage cached time entries" on cached_time_entries
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CACHED TEAM MEMBERS
-- ============================================================
create table cached_team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_id text not null,
  username text not null,
  email text,
  initials text,
  profile_picture text,
  role integer,
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_id)
);

create index idx_cached_team_members_workspace on cached_team_members(workspace_id);

alter table cached_team_members enable row level security;

create policy "Workspace members can view cached team members" on cached_team_members
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage cached team members" on cached_team_members
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- WEBHOOK REGISTRATIONS
-- ============================================================
create table webhook_registrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clickup_webhook_id text not null,
  endpoint text not null,
  events jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, clickup_webhook_id)
);

create index idx_webhook_registrations_workspace on webhook_registrations(workspace_id);

alter table webhook_registrations enable row level security;

create policy "Workspace members can view webhook registrations" on webhook_registrations
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Admins can manage webhook registrations" on webhook_registrations
  for all using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================================
-- WEBHOOK EVENTS
-- ============================================================
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  webhook_id uuid references webhook_registrations(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index idx_webhook_events_workspace on webhook_events(workspace_id);
create index idx_webhook_events_processed on webhook_events(workspace_id, processed);
create index idx_webhook_events_type on webhook_events(event_type);

alter table webhook_events enable row level security;

create policy "Workspace members can view webhook events" on webhook_events
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can manage webhook events" on webhook_events
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  title text,
  summary text,
  context_type text check (context_type in ('general', 'health', 'setup', 'dashboard')),
  context_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_workspace on conversations(workspace_id);
create index idx_conversations_user on conversations(workspace_id, user_id);

alter table conversations enable row level security;

create policy "Users can view own conversations" on conversations
  for select using (
    user_id = auth.uid() and
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Users can create conversations" on conversations
  for insert with check (
    user_id = auth.uid() and
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Users can update own conversations" on conversations
  for update using (user_id = auth.uid());

-- ============================================================
-- MESSAGES
-- ============================================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb,
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id);
create index idx_messages_workspace on messages(workspace_id);

alter table messages enable row level security;

create policy "Users can view messages in own conversations" on messages
  for select using (
    conversation_id in (select id from conversations where user_id = auth.uid())
  );

create policy "Users can create messages" on messages
  for insert with check (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- CREDIT TRANSACTIONS
-- ============================================================
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid,
  amount integer not null,
  balance_after integer not null,
  type text not null check (type in ('deduction', 'purchase', 'bonus', 'refund', 'monthly_reset')),
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_credit_transactions_workspace on credit_transactions(workspace_id);
create index idx_credit_transactions_user on credit_transactions(workspace_id, user_id);
create index idx_credit_transactions_type on credit_transactions(type);
create index idx_credit_transactions_created on credit_transactions(workspace_id, created_at desc);

alter table credit_transactions enable row level security;

create policy "Workspace members can view credit transactions" on credit_transactions
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can insert credit transactions" on credit_transactions
  for insert with check (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- DASHBOARDS
-- ============================================================
create table dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  layout jsonb not null default '[]',
  is_default boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_dashboards_workspace on dashboards(workspace_id);

alter table dashboards enable row level security;

create policy "Workspace members can view dashboards" on dashboards
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Workspace members can manage dashboards" on dashboards
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- DASHBOARD WIDGETS
-- ============================================================
create table dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  dashboard_id uuid not null references dashboards(id) on delete cascade,
  type text not null,
  title text not null,
  config jsonb not null default '{}',
  position jsonb not null default '{"x": 0, "y": 0, "w": 4, "h": 3}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_dashboard_widgets_dashboard on dashboard_widgets(dashboard_id);
create index idx_dashboard_widgets_workspace on dashboard_widgets(workspace_id);

alter table dashboard_widgets enable row level security;

create policy "Workspace members can view dashboard widgets" on dashboard_widgets
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Workspace members can manage dashboard widgets" on dashboard_widgets
  for all using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- HEALTH CHECK RESULTS
-- ============================================================
create table health_check_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  overall_score integer not null check (overall_score >= 0 and overall_score <= 100),
  category_scores jsonb not null default '{}',
  issues jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  checked_at timestamptz not null default now(),
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_health_check_results_workspace on health_check_results(workspace_id);
create index idx_health_check_results_checked on health_check_results(workspace_id, checked_at desc);

alter table health_check_results enable row level security;

create policy "Workspace members can view health check results" on health_check_results
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "System can insert health check results" on health_check_results
  for insert with check (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- ============================================================
-- SETUP SESSIONS
-- ============================================================
create table setup_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  setup_type text not null check (setup_type in ('new_space', 'optimize', 'template')),
  config jsonb not null default '{}',
  conversation_id uuid references conversations(id),
  result jsonb,
  credits_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_setup_sessions_workspace on setup_sessions(workspace_id);
create index idx_setup_sessions_user on setup_sessions(workspace_id, user_id);

alter table setup_sessions enable row level security;

create policy "Users can view own setup sessions" on setup_sessions
  for select using (
    user_id = auth.uid() and
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Users can create setup sessions" on setup_sessions
  for insert with check (
    user_id = auth.uid() and
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "Users can update own setup sessions" on setup_sessions
  for update using (user_id = auth.uid());

-- ============================================================
-- RPC: Atomic Credit Deduction
-- ============================================================
create or replace function deduct_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_metadata jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  -- Lock the workspace row to prevent concurrent deductions
  select credit_balance into v_current_balance
  from workspaces
  where id = p_workspace_id
  for update;

  if v_current_balance is null then
    return jsonb_build_object('success', false, 'error', 'Workspace not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'balance', v_current_balance,
      'required', p_amount
    );
  end if;

  v_new_balance := v_current_balance - p_amount;

  -- Update workspace balance
  update workspaces
  set credit_balance = v_new_balance, updated_at = now()
  where id = p_workspace_id;

  -- Record the transaction
  insert into credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  values (p_workspace_id, p_user_id, -p_amount, v_new_balance, 'deduction', p_description, p_metadata)
  returning id into v_transaction_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_balance,
    'deducted', p_amount
  );
end;
$$;

-- ============================================================
-- Updated_at trigger function
-- ============================================================
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers to all relevant tables
create trigger set_updated_at before update on workspaces for each row execute function update_updated_at();
create trigger set_updated_at before update on workspace_members for each row execute function update_updated_at();
create trigger set_updated_at before update on workspace_invitations for each row execute function update_updated_at();
create trigger set_updated_at before update on cached_spaces for each row execute function update_updated_at();
create trigger set_updated_at before update on cached_folders for each row execute function update_updated_at();
create trigger set_updated_at before update on cached_lists for each row execute function update_updated_at();
create trigger set_updated_at before update on cached_tasks for each row execute function update_updated_at();
create trigger set_updated_at before update on cached_time_entries for each row execute function update_updated_at();
create trigger set_updated_at before update on cached_team_members for each row execute function update_updated_at();
create trigger set_updated_at before update on webhook_registrations for each row execute function update_updated_at();
create trigger set_updated_at before update on conversations for each row execute function update_updated_at();
create trigger set_updated_at before update on dashboards for each row execute function update_updated_at();
create trigger set_updated_at before update on dashboard_widgets for each row execute function update_updated_at();
create trigger set_updated_at before update on setup_sessions for each row execute function update_updated_at();
