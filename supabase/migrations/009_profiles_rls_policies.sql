-- Migration 009: Add RLS policies to profiles table
--
-- The profiles table was created in 004_add_missing_prd_tables.sql
-- but RLS was never enabled. This is a security vulnerability —
-- any authenticated user could read/modify any profile.

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Users can insert their own profile (needed for signup flow)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Workspace members can view profiles of other members in shared workspaces
-- (needed so team settings can display member names/avatars)
CREATE POLICY "Members can view teammate profiles" ON profiles
  FOR SELECT USING (
    user_id IN (
      SELECT wm.user_id FROM workspace_members wm
      WHERE wm.workspace_id IN (
        SELECT wm2.workspace_id FROM workspace_members wm2
        WHERE wm2.user_id = auth.uid()
          AND wm2.status = 'active'
      )
      AND wm.status = 'active'
    )
  );
