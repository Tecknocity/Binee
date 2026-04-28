-- Phase 1 of the setup-chat architectural cleanup: setup_drafts is the
-- canonical store for the workspace structure being built in a setup
-- conversation. Before this migration the draft lived in three places that
-- could drift apart:
--   - zustand `chatStructureSnapshot` in browser localStorage (client auth.)
--   - `messages.metadata.structure_snapshot` on each assistant turn
--   - `proposedPlan` from generate-plan (server) + frontend zustand
-- That made manual edits in Review invisible to the chat AI on the next
-- turn, and a localStorage clear (or our recent per-team store rekey) could
-- destroy a draft that was actually still in messages.metadata.
--
-- After this migration the chat route, generate-plan, the Review screen,
-- and the build executor all read/write the same row keyed by
-- conversation_id. Frontend zustand becomes a cache, not a source of
-- truth.

CREATE TABLE IF NOT EXISTS setup_drafts (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Connected ClickUp team at draft creation. Lets us scope drafts per
  -- ClickUp workspace when a single Binee workspace switches between
  -- teams (consultant flow). Nullable so a draft can exist before OAuth.
  clickup_team_id TEXT,

  -- The canonical workspace structure: spaces, folders, lists, statuses,
  -- recommended_tags, recommended_docs, plus any future operations
  -- (_remove / _rename) that Phase 4 introduces.
  draft JSONB NOT NULL DEFAULT '{"spaces": []}'::jsonb,

  -- Monotonic version. Bumped on every write so the frontend cache can
  -- detect that the server has a newer draft (e.g. the user just edited
  -- in Review and is now back in Chat) and reconcile.
  version INT NOT NULL DEFAULT 1,

  -- Provenance for the latest write. Lets us show the user "last edited
  -- in Chat 2 min ago" / "last edited in Review just now" and helps
  -- debugging when chat and review disagree.
  updated_by TEXT NOT NULL DEFAULT 'chat'
    CHECK (updated_by IN ('chat', 'review', 'manual_edit', 'generate_plan')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setup_drafts_workspace
  ON setup_drafts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_setup_drafts_workspace_team
  ON setup_drafts (workspace_id, clickup_team_id);

ALTER TABLE setup_drafts ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their own drafts. Writes go through the
-- server (service role) so they can be wrapped in version bumps and
-- mergeSnapshot logic, mirroring how messages are written today.
DROP POLICY IF EXISTS "workspace_members_read_setup_drafts" ON setup_drafts;
CREATE POLICY "workspace_members_read_setup_drafts"
  ON setup_drafts
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Trigger: bump updated_at on every UPDATE so we never have to set it
-- manually from the API.
CREATE OR REPLACE FUNCTION setup_drafts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_setup_drafts_touch ON setup_drafts;
CREATE TRIGGER trg_setup_drafts_touch
  BEFORE UPDATE ON setup_drafts
  FOR EACH ROW
  EXECUTE FUNCTION setup_drafts_touch_updated_at();
