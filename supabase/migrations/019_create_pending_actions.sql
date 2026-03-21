-- B-045: Pending actions table for confirm-before-execute flow
-- Stores write operations awaiting user confirmation before execution.

CREATE TABLE IF NOT EXISTS pending_actions (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'executed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  execution_result jsonb,
  execution_error text
);

-- Index for quick lookups by conversation
CREATE INDEX idx_pending_actions_conversation
  ON pending_actions(conversation_id, status);

-- Index for workspace-scoped queries
CREATE INDEX idx_pending_actions_workspace
  ON pending_actions(workspace_id, status);

-- RLS: workspace-scoped access
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

-- Members of a workspace can read their pending actions
CREATE POLICY "workspace_members_select_pending_actions"
  ON pending_actions FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Members of a workspace can insert pending actions
CREATE POLICY "workspace_members_insert_pending_actions"
  ON pending_actions FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Members of a workspace can update pending actions (confirm/cancel)
CREATE POLICY "workspace_members_update_pending_actions"
  ON pending_actions FOR UPDATE
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Auto-expire stale pending actions after 1 hour (optional cron job)
-- This is a safety net — pending actions older than 1 hour are cancelled.
COMMENT ON TABLE pending_actions IS
  'B-045: Stores write operations awaiting user confirmation. Actions expire after 1 hour if not resolved.';
