-- Migration: Add missing ClickUp connection fields to workspaces table
-- These fields are required for OAuth token management, sync tracking, and webhook health

-- ClickUp OAuth token fields
alter table workspaces add column if not exists clickup_refresh_token text;
alter table workspaces add column if not exists clickup_token_expires_at timestamptz;
alter table workspaces add column if not exists clickup_connected boolean not null default false;
alter table workspaces add column if not exists clickup_team_name text;

-- Webhook tracking
alter table workspaces add column if not exists clickup_webhook_id text;
alter table workspaces add column if not exists clickup_webhook_endpoint text;
alter table workspaces add column if not exists clickup_last_webhook_at timestamptz;

-- Sync tracking
alter table workspaces add column if not exists clickup_sync_status text default 'idle'
  check (clickup_sync_status in ('idle', 'syncing', 'error', 'complete'));
alter table workspaces add column if not exists clickup_last_synced_at timestamptz;
alter table workspaces add column if not exists clickup_sync_error text;
alter table workspaces add column if not exists last_sync_at timestamptz;

-- Rate limit awareness
alter table workspaces add column if not exists clickup_plan_tier text default 'free'
  check (clickup_plan_tier in ('free', 'unlimited', 'business', 'business_plus', 'enterprise'));

-- Indexes for connection status queries
create index if not exists idx_workspaces_clickup_connected on workspaces(clickup_connected);

-- Add source column to webhook_events for tracking event origin
alter table webhook_events add column if not exists source text;

-- Add received_at column to webhook_events (used by context builder)
alter table webhook_events add column if not exists received_at timestamptz default now();

-- ============================================================
-- Health check trend tracking: add previous_score for comparison
-- ============================================================
alter table health_check_results add column if not exists previous_score integer;

-- ============================================================
-- Credit system: add plan credit limits and monthly reset tracking
-- ============================================================
create table if not exists plan_configurations (
  plan text primary key,
  monthly_credits integer not null,
  price_cents integer not null default 0,
  max_members integer,
  features jsonb not null default '{}'
);

insert into plan_configurations (plan, monthly_credits, price_cents, max_members, features) values
  ('free', 10, 0, 1, '{"setup": false, "health": true, "dashboards": 1}'),
  ('starter', 200, 1900, 5, '{"setup": true, "health": true, "dashboards": 5}'),
  ('pro', 600, 4900, null, '{"setup": true, "health": true, "dashboards": -1}')
on conflict (plan) do nothing;

-- Track when credits were last reset for a workspace
alter table workspaces add column if not exists credits_reset_at timestamptz;
