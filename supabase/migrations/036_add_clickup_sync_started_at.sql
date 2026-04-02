-- Add clickup_sync_started_at column to detect stale/stuck syncs.
-- When a sync starts, this timestamp is set. When it completes (or errors),
-- it is cleared to NULL. If the status endpoint sees "syncing" with a
-- started_at older than 10 minutes, it auto-recovers to "error".

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS clickup_sync_started_at timestamptz;
