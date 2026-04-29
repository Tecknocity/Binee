-- ---------------------------------------------------------------------------
-- 049: Extend setup_draft_changes.source check to allow multi-agent sources
--
-- The multi-agent setup flow (MULTI_AGENT_SETUP feature flag) introduces
-- two new chat-stage roles that write through mergeSnapshot:
--   - 'clarifier' (Haiku): discovery turns
--   - 'reviser'   (Sonnet): post-generation refinement turns
--
-- Without this migration the existing CHECK constraint rejects those
-- values and every multi-agent audit insert silently fails (logged to
-- console, not surfaced).
-- ---------------------------------------------------------------------------

ALTER TABLE setup_draft_changes
  DROP CONSTRAINT IF EXISTS setup_draft_changes_source_check;

ALTER TABLE setup_draft_changes
  ADD CONSTRAINT setup_draft_changes_source_check
  CHECK (source IN ('chat', 'review', 'manual_edit', 'generate_plan', 'clarifier', 'reviser'));
