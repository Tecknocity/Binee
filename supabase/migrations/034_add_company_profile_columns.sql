-- Add company profile columns to workspaces table
-- Used by the master agent for personalization during onboarding

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS team_size TEXT,
ADD COLUMN IF NOT EXISTS primary_use_case TEXT;
