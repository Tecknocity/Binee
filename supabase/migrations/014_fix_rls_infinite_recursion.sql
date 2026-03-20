-- Migration 014: Fix infinite recursion in workspace_members RLS policies
--
-- Problem: The RLS policies on workspace_members reference workspace_members
-- in subqueries, which triggers the same RLS check recursively (error 42P17).
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to look up
-- the user's workspace memberships, then reference that function in policies.
--
-- Also ensures all required columns exist on workspace_members.
--
-- Safe to run multiple times (fully idempotent).

-- ============================================================
-- 1. Ensure required columns exist
-- ============================================================
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_email text;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS joined_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspace_members'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE workspace_members ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Unify status CHECK constraint
DO $$
DECLARE
  r record;
BEGIN
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

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_status_check
  CHECK (status IN ('active', 'pending', 'removed', 'inactive', 'suspended'));

ALTER TABLE workspace_members ALTER COLUMN status SET DEFAULT 'active';

-- ============================================================
-- 2. Create SECURITY DEFINER helper to avoid RLS recursion
-- ============================================================
-- This function runs as the function owner (superuser/definer), bypassing
-- RLS on workspace_members. Policies use it instead of direct subqueries.

CREATE OR REPLACE FUNCTION get_user_workspace_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = p_user_id;
$$;

-- Similar helper: check if user is owner/admin of a workspace
CREATE OR REPLACE FUNCTION is_workspace_admin(p_user_id uuid, p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = p_user_id
      AND workspace_id = p_workspace_id
      AND role IN ('owner', 'admin')
  );
$$;

-- ============================================================
-- 3. Drop old problematic RLS policies on workspace_members
-- ============================================================
DROP POLICY IF EXISTS "Members can view their workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "Owners can insert own member row" ON workspace_members;

-- ============================================================
-- 4. Create new non-recursive RLS policies
-- ============================================================

-- SELECT: Members can see all members in their workspaces
CREATE POLICY "Members can view their workspace members" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- INSERT: Workspace owners can insert member rows (for themselves or invites)
CREATE POLICY "Owners can insert members" ON workspace_members
  FOR INSERT WITH CHECK (
    -- Owner inserting themselves (first member row for a new workspace)
    (user_id = auth.uid() AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
    OR
    -- Admin/owner adding other members
    is_workspace_admin(auth.uid(), workspace_id)
  );

-- UPDATE: Admins/owners can update member rows in their workspaces
CREATE POLICY "Admins can update members" ON workspace_members
  FOR UPDATE USING (
    is_workspace_admin(auth.uid(), workspace_id)
  );

-- DELETE: Admins/owners can delete member rows, or users can remove themselves
CREATE POLICY "Admins can delete members" ON workspace_members
  FOR DELETE USING (
    is_workspace_admin(auth.uid(), workspace_id)
    OR user_id = auth.uid()
  );

-- ============================================================
-- 5. Fix workspaces SELECT policy to also use the helper
-- ============================================================
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;

CREATE POLICY "Users can view own workspaces" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Also allow owners to delete their own workspaces (for cleanup of orphans)
DROP POLICY IF EXISTS "Owners can delete workspaces" ON workspaces;

CREATE POLICY "Owners can delete workspaces" ON workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- 6. Fix credit_transactions policies to use the helper
-- ============================================================
DROP POLICY IF EXISTS "Workspace members can view credit transactions" ON credit_transactions;
DROP POLICY IF EXISTS "System can insert credit transactions" ON credit_transactions;

CREATE POLICY "Workspace members can view credit transactions" ON credit_transactions
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

CREATE POLICY "System can insert credit transactions" ON credit_transactions
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- ============================================================
-- 7. Ensure handle_new_user() trigger exists
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id uuid;
  v_full_name text;
  v_slug text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create profile
  INSERT INTO profiles (user_id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, v_full_name, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create workspace
  INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
  VALUES (v_full_name || '''s Workspace', v_slug, NEW.id, 'free', 10)
  RETURNING id INTO v_workspace_id;

  -- Add user as owner member
  INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
  VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name, NEW.email, 'active', now())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Record signup bonus
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
  VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger failed for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 8. Backfill orphaned auth.users
-- ============================================================
DO $$
DECLARE
  r record;
  v_workspace_id uuid;
  v_slug text;
  v_display_name text;
BEGIN
  FOR r IN
    SELECT u.id, u.email,
      COALESCE(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1)
      ) AS display_name,
      u.raw_user_meta_data->>'avatar_url' AS avatar_url
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM workspaces w WHERE w.owner_id = u.id
    )
  LOOP
    v_display_name := COALESCE(r.display_name, 'User');
    v_slug := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(gen_random_uuid()::text, 1, 8);

    INSERT INTO profiles (user_id, email, full_name, avatar_url)
    VALUES (r.id, r.email, v_display_name, r.avatar_url)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
    VALUES (v_display_name || '''s Workspace', v_slug, r.id, 'free', 10)
    RETURNING id INTO v_workspace_id;

    INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
    VALUES (v_workspace_id, r.id, 'owner', r.email, v_display_name, r.email, 'active', now())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
    VALUES (v_workspace_id, r.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

    RAISE NOTICE 'Backfilled workspace for user % (%)', r.id, r.email;
  END LOOP;
END $$;
