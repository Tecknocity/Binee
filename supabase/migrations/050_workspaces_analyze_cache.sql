-- Cache the workspace analysis result on the workspaces row so the
-- /api/setup/analyze endpoint can be idempotent within a short TTL window.
--
-- Why
-- ---
-- analyze used to be fully stateless: every POST ran the Anthropic
-- workspace_analyst sub-agent, deducted 0.55 credits, and returned the result
-- in the response body. If the client tab was hidden (or the network
-- dropped) while the response was in flight, the response was lost and the
-- client had no way to recover except to POST again, which would re-run the
-- AI and re-charge credits.
--
-- With these two columns the analyze route can:
--   1. Read the cached row at the start of a request.
--   2. If it is younger than ANALYSIS_CACHE_TTL (5 minutes) and the caller
--      did not pass `force_refresh: true`, return the cached payload with
--      `credits_consumed: 0` and skip the AI call entirely.
--   3. Otherwise, run the analysis as usual and write the fresh payload back
--      to the row before sending the response.
--
-- The "Re-analyze" button in the wizard passes `force_refresh: true` so an
-- explicit user-initiated refresh is never short-circuited by the cache.
--
-- Both columns default to NULL; existing rows are unaffected.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS last_analysis_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_analysis_data JSONB;

-- No index needed: the only query path is `WHERE id = ?`, served by the
-- primary key.
