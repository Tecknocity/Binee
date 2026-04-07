-- User memories: structured facts extracted from conversations
-- Used for cross-conversation context injection (like Claude/ChatGPT memory)
-- Facts are auto-extracted by Haiku during conversation summarization (every 4 messages)

CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'auto_extracted'
    CHECK (category IN ('auto_extracted', 'user_stated', 'preference', 'context')),
  content TEXT NOT NULL,
  source_conversation_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookup when injecting into prompts
CREATE INDEX IF NOT EXISTS idx_user_memories_lookup
  ON user_memories (user_id, workspace_id, is_active)
  WHERE is_active = true;

-- RLS policies
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- Users can read their own memories
CREATE POLICY user_memories_select ON user_memories
  FOR SELECT USING (auth.uid() = user_id);

-- Users can manage their own memories (edit, deactivate)
CREATE POLICY user_memories_update ON user_memories
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert (used by summarization engine)
CREATE POLICY user_memories_insert ON user_memories
  FOR INSERT WITH CHECK (true);

-- Users can delete their own memories
CREATE POLICY user_memories_delete ON user_memories
  FOR DELETE USING (auth.uid() = user_id);
