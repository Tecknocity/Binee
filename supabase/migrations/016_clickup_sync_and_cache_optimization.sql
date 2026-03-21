-- ============================================================
-- Migration 016: B-026 + B-027 Combined
-- B-026: Sync progress tracking on clickup_connections
-- B-027: Cache table optimization (indexes, data_json, view)
-- ============================================================

-- ============================================================
-- B-026: Add sync progress tracking to clickup_connections
-- ============================================================

-- Add progress tracking columns
alter table clickup_connections
  add column if not exists sync_phase text,
  add column if not exists sync_current integer default 0,
  add column if not exists sync_total integer default 0,
  add column if not exists sync_message text,
  add column if not exists sync_error text,
  add column if not exists sync_started_at timestamptz,
  add column if not exists sync_completed_at timestamptz,
  add column if not exists synced_spaces integer default 0,
  add column if not exists synced_folders integer default 0,
  add column if not exists synced_lists integer default 0,
  add column if not exists synced_tasks integer default 0,
  add column if not exists synced_members integer default 0,
  add column if not exists synced_time_entries integer default 0;

-- Update check constraint to include 'synced' as valid status
alter table clickup_connections drop constraint if exists clickup_connections_sync_status_check;
alter table clickup_connections
  add constraint clickup_connections_sync_status_check
  check (sync_status in ('idle', 'syncing', 'error', 'complete', 'synced'));

-- ============================================================
-- B-027: Add data_json JSONB column for flexible storage
-- ============================================================
alter table cached_spaces add column if not exists data_json jsonb;
alter table cached_folders add column if not exists data_json jsonb;
alter table cached_lists add column if not exists data_json jsonb;
alter table cached_tasks add column if not exists data_json jsonb;
alter table cached_time_entries add column if not exists data_json jsonb;
alter table cached_team_members add column if not exists data_json jsonb;

-- ============================================================
-- B-027: Indexes on synced_at for freshness tracking queries
-- ============================================================
create index if not exists idx_cached_spaces_synced_at
  on cached_spaces(workspace_id, synced_at);

create index if not exists idx_cached_folders_synced_at
  on cached_folders(workspace_id, synced_at);

create index if not exists idx_cached_lists_synced_at
  on cached_lists(workspace_id, synced_at);

create index if not exists idx_cached_tasks_synced_at
  on cached_tasks(workspace_id, synced_at);

create index if not exists idx_cached_time_entries_synced_at
  on cached_time_entries(workspace_id, synced_at);

create index if not exists idx_cached_team_members_synced_at
  on cached_team_members(workspace_id, synced_at);

-- ============================================================
-- B-027: Additional composite indexes for common query patterns
-- ============================================================

-- Task priority filtering
create index if not exists idx_cached_tasks_priority
  on cached_tasks(workspace_id, priority);

-- Task assignee lookups via GIN index on JSONB
create index if not exists idx_cached_tasks_assignees_gin
  on cached_tasks using gin (assignees);

-- Task tags lookups via GIN index on JSONB
create index if not exists idx_cached_tasks_tags_gin
  on cached_tasks using gin (tags);

-- Task custom fields via GIN index on JSONB
create index if not exists idx_cached_tasks_custom_fields_gin
  on cached_tasks using gin (custom_fields);

-- Team member email lookups
create index if not exists idx_cached_team_members_email
  on cached_team_members(workspace_id, email);

-- Time entries date range queries
create index if not exists idx_cached_time_entries_start_time
  on cached_time_entries(workspace_id, start_time);

-- ============================================================
-- B-027: cached_members view (PRD alias for cached_team_members)
-- ============================================================
create or replace view cached_members as
  select
    id,
    workspace_id,
    clickup_id,
    username,
    email,
    initials,
    profile_picture,
    role,
    raw_data,
    data_json,
    synced_at,
    created_at,
    updated_at
  from cached_team_members;

-- Grant access to the view (inherits RLS from underlying table)
grant select on cached_members to authenticated;
