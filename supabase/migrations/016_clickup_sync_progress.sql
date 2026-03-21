-- Migration: Add sync progress tracking to clickup_connections
-- Supports B-026 (Initial Full Sync) and B-032 (Onboarding progress UI)

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
