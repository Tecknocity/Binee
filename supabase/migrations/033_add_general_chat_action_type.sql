-- Migration 033: Add general_chat to credit_usage action_type check
-- Supports the new lightweight general_chat task type that skips workspace context.

-- Drop the old check constraint and recreate with expanded values.
-- Also add all classifier task types so future types work without migration.
ALTER TABLE credit_usage DROP CONSTRAINT IF EXISTS credit_usage_action_type_check;

ALTER TABLE credit_usage ADD CONSTRAINT credit_usage_action_type_check
  CHECK (action_type IN (
    'general_chat',
    'simple_lookup',
    'complex_query',
    'action_request',
    'setup_request',
    'health_check',
    'dashboard_request',
    'analysis_audit',
    'strategy',
    'troubleshooting',
    -- Legacy values (kept for backward compatibility with existing rows)
    'chat',
    'setup',
    'dashboard',
    'briefing'
  ));
