-- Migration 031: Add workspace_id to credit_usage for per-member analytics
--
-- The credit_usage table tracks per-AI-interaction costs for admin visibility.
-- Adding workspace_id allows admins to query "who in my workspace used how many credits"
-- without joining through users → workspace_members → workspaces.

ALTER TABLE credit_usage ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

-- Index for admin queries: "show me usage by all members in workspace X"
CREATE INDEX IF NOT EXISTS idx_credit_usage_workspace
  ON credit_usage (workspace_id, user_id);
