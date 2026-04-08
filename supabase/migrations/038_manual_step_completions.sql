-- ---------------------------------------------------------------------------
-- 038: Manual Step Completions
-- Persists manual step completion state across all workspace members.
-- Each workspace+step_index pair is unique. When toggled, we track
-- who completed it and when.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS manual_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_title TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, step_index)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_msc_workspace_id ON manual_step_completions(workspace_id);

-- RLS: workspace members can read and write
ALTER TABLE manual_step_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_manage_manual_steps" ON manual_step_completions;
CREATE POLICY "workspace_members_manage_manual_steps"
  ON manual_step_completions
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
