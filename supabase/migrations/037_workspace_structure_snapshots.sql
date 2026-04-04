-- ---------------------------------------------------------------------------
-- 037: Workspace Structure Snapshots
-- Safety net: stores full workspace structure at key moments so we can
-- restore if anything goes wrong during setup execution.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workspace_structure_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- When was this snapshot taken?
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('initial_connect', 'pre_build', 'manual')),

  -- Full structure as JSON: spaces, folders, lists with statuses and task counts
  structure JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional: the setup plan that was about to be executed (for pre_build snapshots)
  setup_plan JSONB
);

-- Index for fast lookups by workspace
CREATE INDEX IF NOT EXISTS idx_wss_workspace_id ON workspace_structure_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wss_workspace_type ON workspace_structure_snapshots(workspace_id, snapshot_type);

-- RLS: workspace members can read their own snapshots
ALTER TABLE workspace_structure_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_read_snapshots"
  ON workspace_structure_snapshots
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_snapshots"
  ON workspace_structure_snapshots
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
