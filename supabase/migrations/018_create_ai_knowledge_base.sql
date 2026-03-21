-- Migration: Create ai_knowledge_base table
-- Table and seed data already exist in Supabase; this migration is for version control.

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  task_types TEXT[] DEFAULT '{}',
  token_estimate INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  is_shared BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for task_type overlap queries
CREATE INDEX IF NOT EXISTS idx_kb_task_types ON ai_knowledge_base USING GIN (task_types);

-- Index for prefix queries on module_key
CREATE INDEX IF NOT EXISTS idx_kb_module_key ON ai_knowledge_base (module_key);

-- Index for shared module lookups
CREATE INDEX IF NOT EXISTS idx_kb_is_shared ON ai_knowledge_base (is_shared) WHERE is_shared = true;

-- ---------------------------------------------------------------------------
-- RLS policies: workspace members can read, only admins can write
-- ---------------------------------------------------------------------------

ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read knowledge base modules
CREATE POLICY "Authenticated users can read knowledge base"
  ON ai_knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (admin operations) can insert/update/delete
-- App-level admin checks happen in the knowledge-base service layer
CREATE POLICY "Service role can manage knowledge base"
  ON ai_knowledge_base
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Helper RPC: increment version for a module
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_kb_version(target_module_key TEXT)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE ai_knowledge_base
  SET version = version + 1,
      updated_at = now()
  WHERE module_key = target_module_key;
$$;
