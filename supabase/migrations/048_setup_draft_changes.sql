-- Phase 4 of the setup-chat architectural cleanup: observability.
--
-- The first three phases hardened the data model (single source of truth
-- for the draft, attachments first-class, plan tier user-set, snapshot
-- ops formalized). This phase adds the instruments that let us notice
-- when something regresses without waiting for a user complaint:
--
--   setup_draft_changes  - every mergeSnapshot call writes one row with
--                          the inputs, the operations the model emitted,
--                          and the outcome counts (spaces/lists/renames/
--                          removes). Lets us answer "did the draft just
--                          shrink unexpectedly?" / "is the model relying
--                          on full_replace too often?" without reading
--                          server logs.
--
-- The table is small per row (numeric counters + short flags + brief
-- text), unlike the messages table which we deliberately stopped
-- mirroring snapshots into. Service role writes only; workspace members
-- can read for their own conversations.

CREATE TABLE IF NOT EXISTS setup_draft_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Where the change came from. Mirrors setup_drafts.updated_by but lets
  -- us slice changes by source over time for debugging (e.g. "how often
  -- does generate_plan rebuild vs. add to an existing draft?").
  source TEXT NOT NULL CHECK (source IN ('chat', 'review', 'manual_edit', 'generate_plan')),

  -- What the model declared this turn. Useful for spotting failure
  -- modes: a high `intent_full_replace_downgraded` rate means the model
  -- is misusing the verb; a high `truncated_response` rate means we
  -- need to bump max_tokens; a sudden jump in spaces_dropped on
  -- additive turns means the merge is broken.
  intent TEXT NOT NULL CHECK (intent IN ('update', 'full_replace')),
  intent_full_replace_downgraded BOOLEAN NOT NULL DEFAULT false,
  truncated_response BOOLEAN NOT NULL DEFAULT false,

  -- Counts before / after the merge. Lets us spot accidental shrinkage
  -- (added on the same turn the user said "add") and accidental growth
  -- (model emitting duplicates that the merge then preserves).
  spaces_before INT NOT NULL DEFAULT 0,
  spaces_after INT NOT NULL DEFAULT 0,
  lists_before INT NOT NULL DEFAULT 0,
  lists_after INT NOT NULL DEFAULT 0,

  -- Operation counts emitted by the model this turn.
  rename_count INT NOT NULL DEFAULT 0,
  remove_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setup_draft_changes_conversation
  ON setup_draft_changes (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_setup_draft_changes_workspace_time
  ON setup_draft_changes (workspace_id, created_at);
-- Quick filter for "recent days where the model misused full_replace"
CREATE INDEX IF NOT EXISTS idx_setup_draft_changes_downgrade
  ON setup_draft_changes (created_at)
  WHERE intent_full_replace_downgraded = true;

ALTER TABLE setup_draft_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_read_setup_draft_changes" ON setup_draft_changes;
CREATE POLICY "workspace_members_read_setup_draft_changes"
  ON setup_draft_changes
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- View: v_workspaces_plan_tier_distribution
-- ---------------------------------------------------------------------------
-- Aggregates workspaces by clickup_plan_tier and clickup_plan_tier_source so
-- we can see at a glance what proportion of workspaces have a user-set plan
-- vs. a legacy 'api' value vs. NULL ("the user has not yet picked a plan,
-- the UI should show the dropdown"). Useful for monitoring the rollout of
-- Phase 3's plan-tier dropdown without poking at production rows.

CREATE OR REPLACE VIEW v_workspaces_plan_tier_distribution AS
SELECT
  COALESCE(clickup_plan_tier_source, 'unset') AS source,
  COALESCE(clickup_plan_tier, 'unknown') AS plan_tier,
  COUNT(*) AS workspace_count
FROM workspaces
WHERE clickup_team_id IS NOT NULL
GROUP BY clickup_plan_tier_source, clickup_plan_tier;
