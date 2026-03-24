-- B-064: Health Snapshots table for weekly trend tracking
-- Populated by the B-062 cron job; queried by the health trend chart

CREATE TABLE IF NOT EXISTS health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  category_scores JSONB NOT NULL DEFAULT '{}',
  previous_score INTEGER CHECK (previous_score >= 0 AND previous_score <= 100),
  snapshot_week DATE NOT NULL, -- Monday of the snapshot week
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient workspace + date queries
CREATE INDEX idx_health_snapshots_workspace_week
  ON health_snapshots (workspace_id, snapshot_week DESC);

-- Unique constraint: one snapshot per workspace per week
CREATE UNIQUE INDEX idx_health_snapshots_unique_week
  ON health_snapshots (workspace_id, snapshot_week);

-- RLS
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;

-- Workspace members can view snapshots
CREATE POLICY "Workspace members can view health snapshots"
  ON health_snapshots FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

-- System (service role) can insert snapshots
CREATE POLICY "System can insert health snapshots"
  ON health_snapshots FOR INSERT
  WITH CHECK (true);
