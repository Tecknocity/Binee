-- Error logs: generic silent-failure sink used by features that should never
-- surface errors to the end user (e.g. template task/doc generation).
-- Write-only from server (service role); users cannot read, insert, update,
-- or delete. Inspected manually by engineers via the service role key.

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_source_created
  ON error_logs (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_workspace_created
  ON error_logs (workspace_id, created_at DESC);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- No policies defined: RLS is on, so authenticated/anon users cannot touch
-- this table. Only the service role (which bypasses RLS) can read/write.
