-- ============================================================
-- B-027: Optimize Supabase Cache Tables for ClickUp Data
-- Adds data_json column, composite indexes, synced_at indexes,
-- GIN indexes for JSONB queries, and cached_members view.
-- ============================================================

-- ============================================================
-- 1. Add data_json JSONB column for flexible storage
-- ============================================================
alter table cached_spaces add column if not exists data_json jsonb;
alter table cached_folders add column if not exists data_json jsonb;
alter table cached_lists add column if not exists data_json jsonb;
alter table cached_tasks add column if not exists data_json jsonb;
alter table cached_time_entries add column if not exists data_json jsonb;
alter table cached_team_members add column if not exists data_json jsonb;

-- ============================================================
-- 2. Composite indexes on (workspace_id, clickup_id)
--    Note: The UNIQUE constraint already creates an implicit index,
--    but we add explicit B-tree indexes for read-heavy sync queries
--    that filter by workspace_id and look up by clickup_id.
-- ============================================================
-- These are already covered by the unique constraint, so no additional
-- composite indexes needed for (workspace_id, clickup_id).

-- ============================================================
-- 3. Indexes on synced_at for freshness tracking queries
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
-- 4. Additional composite indexes for common query patterns
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
-- 5. cached_members view (PRD alias for cached_team_members)
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
