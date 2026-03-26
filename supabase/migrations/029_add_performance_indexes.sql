-- Migration 029: Add composite indexes for common query patterns
--
-- These indexes address slow queries identified in the performance audit:
-- 1. Messages ordered by created_at within a conversation (chat loading)
-- 2. Conversations listed by updated_at for a user within a workspace (sidebar)
-- 3. Credit transactions filtered by workspace + type (usage aggregation)
-- 4. Pending actions filtered by status + staleness (expiry cleanup)

-- Messages: chat loading queries ORDER BY created_at within a conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);

-- Conversations: sidebar/list queries ORDER BY updated_at DESC for a specific user
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON conversations (workspace_id, user_id, updated_at DESC);

-- Credit transactions: usage aggregation queries filtered by workspace + type
CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace_type
  ON credit_transactions (workspace_id, type);

-- Pending actions: cleanup/expiry queries filtered by status + creation time
CREATE INDEX IF NOT EXISTS idx_pending_actions_status_created
  ON pending_actions (status, created_at);
