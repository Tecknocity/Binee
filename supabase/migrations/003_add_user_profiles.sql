-- Migration: Add user_profiles table for settings, preferences, and notification config
-- Stores per-user settings that are independent of workspace membership

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  preferred_name text,
  work_role text,
  personal_preferences text,
  timezone text not null default 'America/New_York',
  avatar_url text,

  -- Notification preferences
  notifications_enabled boolean not null default true,
  notify_task_complete boolean not null default true,
  notify_daily_standup boolean not null default false,
  daily_standup_time time not null default '08:00',
  notify_daily_digest boolean not null default false,
  daily_digest_time time not null default '18:00',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_user on user_profiles(user_id);

alter table user_profiles enable row level security;

create policy "Users can view own profile" on user_profiles
  for select using (user_id = auth.uid());

create policy "Users can update own profile" on user_profiles
  for update using (user_id = auth.uid());

create policy "Users can insert own profile" on user_profiles
  for insert with check (user_id = auth.uid());

-- Apply updated_at trigger
create trigger set_updated_at before update on user_profiles for each row execute function update_updated_at();
