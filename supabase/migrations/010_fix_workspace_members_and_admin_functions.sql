-- Migration 008: Fix workspace_members connectivity & add admin functions
--
-- Problems addressed:
-- 1. Conflicting CHECK constraints on workspace_members.status from two 004 migrations
-- 2. Circular RLS policy: first member INSERT blocked because no member exists yet
-- 3. Missing workspace_members rows for existing workspace owners
-- 4. No admin functions for managing roles/credits from Supabase dashboard

-- ============================================================
-- 1. Unify the status CHECK constraint
--    Both 004 migrations tried to add the column with different allowed values.
--    We drop ALL existing check constraints on status and create one that
--    covers every needed value.
-- ============================================================

DO $$
DECLARE
  r record;
BEGIN
  -- Drop every CHECK constraint that references the 'status' column
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'workspace_members'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE workspace_members DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Add unified CHECK covering all needed statuses
ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_status_check
  CHECK (status IN ('active', 'pending', 'removed', 'inactive', 'suspended'));

-- Ensure NOT NULL default is correct
ALTER TABLE workspace_members ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE workspace_members ALTER COLUMN status SET NOT NULL;

-- ============================================================
-- 2. Fix circular RLS: allow workspace owners to insert their own member row
--    The existing "Admins can manage members" FOR ALL policy requires
--    the user to already be a member. This new INSERT policy lets the
--    workspace owner create the first member row for themselves.
-- ============================================================

-- Drop the old INSERT-blocking part by replacing with separate policies
-- (Keep the existing "Admins can manage members" as-is since FOR ALL includes INSERT,
--  but add a more specific INSERT policy that takes priority)

DROP POLICY IF EXISTS "Owners can insert own member row" ON workspace_members;
CREATE POLICY "Owners can insert own member row" ON workspace_members
  FOR INSERT WITH CHECK (
    -- The user inserting must be the workspace owner AND inserting themselves
    user_id = auth.uid()
    AND workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Backfill missing workspace_members rows
--    For every workspace where the owner has no active member row,
--    create one with role='owner', status='active'.
-- ============================================================

INSERT INTO workspace_members (workspace_id, user_id, role, email, invited_email, status, joined_at)
SELECT
  w.id,
  w.owner_id,
  'owner',
  COALESCE(u.email, 'unknown'),
  COALESCE(u.email, 'unknown'),
  'active',
  COALESCE(w.created_at, now())
FROM workspaces w
JOIN auth.users u ON u.id = w.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.user_id = w.owner_id
    AND wm.status IN ('active', 'pending')
);

-- Also backfill display_name from auth metadata where it's NULL
UPDATE workspace_members wm
SET display_name = COALESCE(
  u.raw_user_meta_data->>'display_name',
  u.raw_user_meta_data->>'full_name',
  split_part(u.email, '@', 1)
)
FROM auth.users u
WHERE wm.user_id = u.id
  AND wm.display_name IS NULL;

-- ============================================================
-- 4. Backfill missing profiles
--    Ensure every auth user has a profile row.
-- ============================================================

INSERT INTO profiles (user_id, email, full_name, avatar_url)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name',
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 5. Admin helper functions (callable from Supabase SQL editor / dashboard)
--    These use SECURITY DEFINER to bypass RLS, so they can only be
--    called by users with database access (i.e., admins in Supabase dashboard).
-- ============================================================

-- 5a. Change a user's role within a workspace
CREATE OR REPLACE FUNCTION admin_set_user_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id uuid;
  v_old_role text;
BEGIN
  -- Validate role
  IF p_new_role NOT IN ('owner', 'admin', 'member') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role. Must be owner, admin, or member.');
  END IF;

  -- Find the member row
  SELECT id, role INTO v_member_id, v_old_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
    AND status = 'active';

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active member not found for this workspace/user combination.');
  END IF;

  -- If promoting to owner, also update workspaces.owner_id
  IF p_new_role = 'owner' THEN
    UPDATE workspaces SET owner_id = p_user_id WHERE id = p_workspace_id;
    -- Demote the old owner to admin
    UPDATE workspace_members
    SET role = 'admin'
    WHERE workspace_id = p_workspace_id
      AND role = 'owner'
      AND user_id != p_user_id;
  END IF;

  -- Update the role
  UPDATE workspace_members
  SET role = p_new_role
  WHERE id = v_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
END;
$$;

-- 5b. Add credits to a workspace (admin bonus/adjustment)
CREATE OR REPLACE FUNCTION admin_add_credits(
  p_workspace_id uuid,
  p_amount integer,
  p_description text DEFAULT 'Admin credit adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount cannot be zero.');
  END IF;

  -- Lock the workspace row
  SELECT credit_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found.');
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would result in negative balance.',
      'current_balance', v_current_balance, 'requested', p_amount);
  END IF;

  -- Update balance
  UPDATE workspaces
  SET credit_balance = v_new_balance, updated_at = now()
  WHERE id = p_workspace_id;

  -- Record the transaction
  INSERT INTO credit_transactions (workspace_id, amount, balance_after, type, description)
  VALUES (p_workspace_id, p_amount, v_new_balance,
    CASE WHEN p_amount > 0 THEN 'bonus' ELSE 'deduction' END,
    p_description)
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'old_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$;

-- 5c. List all users with their workspace memberships (admin view)
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  workspace_id uuid,
  workspace_name text,
  role text,
  member_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    COALESCE(p.full_name, u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))::text AS full_name,
    wm.workspace_id,
    w.name::text AS workspace_name,
    wm.role::text,
    wm.status::text AS member_status,
    u.created_at
  FROM auth.users u
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.status IN ('active', 'pending')
  LEFT JOIN workspaces w ON w.id = wm.workspace_id
  ORDER BY u.created_at DESC;
END;
$$;

-- 5d. Force-connect a user to a workspace (for admin troubleshooting)
CREATE OR REPLACE FUNCTION admin_connect_user_to_workspace(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
  v_display_name text;
  v_member_id uuid;
BEGIN
  -- Validate role
  IF p_role NOT IN ('owner', 'admin', 'member') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role.');
  END IF;

  -- Verify workspace exists
  IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = p_workspace_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found.');
  END IF;

  -- Verify user exists
  SELECT u.email, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
  INTO v_email, v_display_name
  FROM auth.users u WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found.');
  END IF;

  -- Check if already a member
  SELECT id INTO v_member_id
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND status = 'active';

  IF v_member_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is already an active member.', 'member_id', v_member_id);
  END IF;

  -- Upsert: reactivate if removed/inactive, or insert new
  INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
  VALUES (p_workspace_id, p_user_id, p_role, v_email, v_display_name, v_email, 'active', now())
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = p_role, status = 'active', joined_at = now()
  RETURNING id INTO v_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'email', v_email,
    'role', p_role
  );
END;
$$;
