-- Setup build queue: turns the synchronous "build workspace" request into
-- a long-running, navigation-safe, retry-friendly job.
--
-- Two tables:
--   setup_builds          - one row per build attempt. Tracks ETA, lifecycle
--                           status, and a workspace-level lease so only one
--                           process touches a workspace's ClickUp token at
--                           any given moment (rate-limit coordination).
--   setup_enrichment_jobs - one row per enrichment unit (per list, per doc,
--                           per per-list-view-set). Each row is independently
--                           pending/in_progress/done/failed and individually
--                           retryable. The cron worker (and frontend poll)
--                           pull rows with FOR UPDATE SKIP LOCKED so multiple
--                           processes can never double-process a row.
--
-- RLS is enabled with no policies: only the service role (server-side API
-- routes) can read/write. End users go through the API.

CREATE TABLE IF NOT EXISTS setup_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- 'enriching' | 'completed' | 'failed' | 'cancelled'
  -- No 'pending' state: structural creation is synchronous, so the build is
  -- 'enriching' the moment the row is created.
  status TEXT NOT NULL DEFAULT 'enriching',
  -- When the build started (used for "Started at HH:MM" UI line)
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the build finished (set when status moves to completed/failed/cancelled)
  completed_at TIMESTAMPTZ,
  -- Estimated completion time, computed from the plan size at start. Static.
  -- The UI shows "Started at X • Estimated completion: Y" off this value.
  estimated_completion_at TIMESTAMPTZ,
  -- Total enrichment jobs this build has. Lets the status endpoint compute
  -- progress without scanning every row.
  total_jobs INT NOT NULL DEFAULT 0,
  -- Snapshot of the plan that produced this build. Lets us regenerate manual
  -- steps, retry with the same context, and audit what was attempted.
  plan JSONB NOT NULL,
  -- Snapshot of the structural execution result (spaces/folders/lists created,
  -- per-item statuses, errors). Frontend reads this for the structural section
  -- of the build screen.
  structural_result JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Workspace-level lease. While `worker_locked_at` is set and recent, no
  -- other process should pick up jobs for this workspace. Stale leases (older
  -- than ~3 minutes) are reclaimed automatically by the worker. This is the
  -- mechanism that prevents two cron invocations from racing the same
  -- workspace's ClickUp token (and double-counting toward the 100 req/min
  -- ClickUp rate limit).
  worker_locked_at TIMESTAMPTZ,
  worker_locked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_setup_builds_workspace_status
  ON setup_builds (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_setup_builds_active
  ON setup_builds (status, worker_locked_at)
  WHERE status = 'enriching';

ALTER TABLE setup_builds ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (server-side) reads/writes.

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS setup_enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES setup_builds(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- 'list_tasks'  - generate + write starter tasks for one ClickUp list
  -- 'doc_content' - generate + write markdown content for one ClickUp doc
  -- 'list_views'  - create default views (board/calendar/etc) for one list
  type TEXT NOT NULL,
  -- ClickUp ID of the target (list id or doc id). Used by the worker to make
  -- the actual write calls.
  target_clickup_id TEXT NOT NULL,
  -- Display fields (cached so the status endpoint doesn't have to join).
  target_name TEXT NOT NULL,
  parent_name TEXT,
  -- Snapshot of the relevant slice of the plan (list_plan or doc_plan plus
  -- workspace context). The worker reads this directly so it never has to
  -- reconstruct context from the parent build row.
  payload JSONB NOT NULL,
  -- 'pending' | 'in_progress' | 'done' | 'failed'
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  -- Per-row lease used by FOR UPDATE SKIP LOCKED. Stale leases are reclaimed.
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  -- Worker-supplied result blob, e.g. { tasksCreated: 6 } or { contentLength: 812 }.
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Selecting pending jobs for a build (the hot path, used by the worker)
CREATE INDEX IF NOT EXISTS idx_setup_jobs_build_status
  ON setup_enrichment_jobs (build_id, status);

-- Selecting pending jobs for a workspace (used when the worker walks all
-- workspaces with active builds)
CREATE INDEX IF NOT EXISTS idx_setup_jobs_workspace_pending
  ON setup_enrichment_jobs (workspace_id, status)
  WHERE status = 'pending';

-- Stale-lease reclaim
CREATE INDEX IF NOT EXISTS idx_setup_jobs_locked
  ON setup_enrichment_jobs (locked_at)
  WHERE status = 'in_progress';

ALTER TABLE setup_enrichment_jobs ENABLE ROW LEVEL SECURITY;
-- No policies: only service role.

-- ---------------------------------------------------------------------------
-- updated_at triggers so we can sort/filter by recency without app-side bookkeeping

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_setup_builds_updated_at ON setup_builds;
CREATE TRIGGER trg_setup_builds_updated_at
  BEFORE UPDATE ON setup_builds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_setup_jobs_updated_at ON setup_enrichment_jobs;
CREATE TRIGGER trg_setup_jobs_updated_at
  BEFORE UPDATE ON setup_enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
