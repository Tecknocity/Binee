-- B-028: Add webhook tracking columns to clickup_connections
-- Stores the ClickUp webhook_id for cleanup on disconnect

alter table clickup_connections add column if not exists clickup_webhook_id text;
alter table clickup_connections add column if not exists webhook_endpoint text;
alter table clickup_connections add column if not exists webhook_events jsonb default '[]';
