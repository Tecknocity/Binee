-- Migration: Add missing tables and columns required by PRD B-001
-- Adds: profiles table, clickup_connections table, missing columns on messages,
--        credit_transactions, and workspace_members

-- ============================================================
-- PROFILES (basic user profile synced from auth)
-- ============================================================
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user on profiles(user_id);
create index if not exists idx_profiles_email on profiles(email);

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- CLICKUP CONNECTIONS (dedicated table for OAuth credentials)
-- ============================================================
create table if not exists clickup_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  clickup_user_id text,
  clickup_team_id text,
  plan_tier text default 'free'
    check (plan_tier in ('free', 'unlimited', 'business', 'business_plus', 'enterprise')),
  sync_status text default 'idle'
    check (sync_status in ('idle', 'syncing', 'error', 'complete')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

create index if not exists idx_clickup_connections_workspace on clickup_connections(workspace_id);

create trigger set_updated_at before update on clickup_connections
  for each row execute function update_updated_at();

-- ============================================================
-- MESSAGES: add missing columns
-- ============================================================
alter table messages add column if not exists tool_calls_json jsonb;
alter table messages add column if not exists model_used text;

-- ============================================================
-- CREDIT TRANSACTIONS: add message_id reference
-- ============================================================
alter table credit_transactions add column if not exists message_id uuid references messages(id) on delete set null;

create index if not exists idx_credit_transactions_message on credit_transactions(message_id);

-- ============================================================
-- WORKSPACE MEMBERS: add missing columns
-- ============================================================
alter table workspace_members add column if not exists invited_email text;
alter table workspace_members add column if not exists status text default 'active'
  check (status in ('pending', 'active', 'removed'));
alter table workspace_members add column if not exists joined_at timestamptz;
