-- ---------------------------------------------------------------------------
-- 039: Task Activity Log
-- Structured, permanent log of task changes captured from ClickUp webhooks.
-- Each row represents a single field change (status, assignee, priority, etc.)
-- parsed from webhook history_items. Raw webhook_events are pruned after 30
-- days, but this table persists forever for analytics.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  field TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  changed_by_id TEXT,
  changed_by_name TEXT,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ NOT NULL,
  webhook_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tal_workspace ON task_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tal_workspace_task ON task_activity_log(workspace_id, task_id);
CREATE INDEX IF NOT EXISTS idx_tal_workspace_field ON task_activity_log(workspace_id, field);
CREATE INDEX IF NOT EXISTS idx_tal_workspace_changed_by ON task_activity_log(workspace_id, changed_by_id);
CREATE INDEX IF NOT EXISTS idx_tal_changed_at ON task_activity_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_tal_workspace_event ON task_activity_log(workspace_id, event_type);

-- RLS: workspace members can read only.
-- Writes are done via service role key (bypasses RLS), so no write policy needed.
-- This keeps the activity log tamper-proof from the client side.
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_read_activity_log"
  ON task_activity_log
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
