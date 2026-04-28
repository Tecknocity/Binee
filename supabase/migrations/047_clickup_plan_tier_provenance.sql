-- Phase 3 of the setup-chat architectural cleanup: ClickUp plan tier
-- becomes a deterministic, user-supplied value instead of a best-effort
-- scrape from an API that often does not expose it.
--
-- Background. ClickUp's GET /team endpoint does not document a plan
-- field; some accounts return one in an undocumented `plan.name`, most
-- do not. The OAuth callback that tried to read it therefore wrote
-- "free" or NULL most of the time, which then propagated through every
-- read site (because of `?? 'free'` fallbacks) and produced the
-- recurring "you are on the Free plan" loop that the user has been
-- reporting for weeks even on a Business Plus workspace.
--
-- The fix is to stop guessing. The user picks their plan from a
-- dropdown in the setup profile form (or in Settings); we record where
-- the value came from (`user`) and stop writing from the OAuth path.
-- The column already exists; this migration just adds provenance and
-- a timestamp so the UI can show "you set this on YYYY-MM-DD".
--
-- No backfill: existing rows keep whatever value Phase 0/1.5 wrote,
-- with `clickup_plan_tier_source` = NULL meaning "we do not know how
-- this got set, treat it as advisory until the user confirms in
-- Settings". The frontend uses NULL source to surface the dropdown
-- proactively.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS clickup_plan_tier_source TEXT
    CHECK (clickup_plan_tier_source IN ('user', 'api') OR clickup_plan_tier_source IS NULL);

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS clickup_plan_tier_set_at TIMESTAMPTZ;
