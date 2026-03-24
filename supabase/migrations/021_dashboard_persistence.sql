-- ============================================================
-- B-069: Dashboard Persistence
-- Adds layout_json storage and last-active tracking per user
-- ============================================================

-- Add layout_json column for persisting full widget layout snapshots
alter table dashboards add column if not exists layout_json jsonb not null default '{}';

-- Track which dashboard each user last viewed per workspace
create table if not exists user_dashboard_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  last_active_dashboard_id uuid references dashboards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, workspace_id)
);

create index if not exists idx_user_dashboard_prefs_user_workspace
  on user_dashboard_preferences(user_id, workspace_id);

alter table user_dashboard_preferences enable row level security;

drop policy if exists "Users can view own dashboard preferences" on user_dashboard_preferences;
create policy "Users can view own dashboard preferences" on user_dashboard_preferences
  for select using (user_id = auth.uid());

drop policy if exists "Users can manage own dashboard preferences" on user_dashboard_preferences;
create policy "Users can manage own dashboard preferences" on user_dashboard_preferences
  for all using (user_id = auth.uid());

-- Auto-update updated_at trigger
drop trigger if exists set_updated_at on user_dashboard_preferences;
create trigger set_updated_at before update on user_dashboard_preferences
  for each row execute function update_updated_at();
