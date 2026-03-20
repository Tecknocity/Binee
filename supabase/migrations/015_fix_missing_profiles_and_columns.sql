-- Migration 015: Fix missing profiles table and workspace_members columns
--
-- The preview database is missing:
-- 1. The `profiles` table entirely (handle_new_user trigger fails silently)
-- 2. workspace_members columns: status, invited_email, joined_at
-- 3. user_profiles columns: allow_training, chat_history_enabled
--
-- This migration adds all missing schema elements and recreates the
-- handle_new_user() trigger with per-statement error handling so that
-- a single table/column issue doesn't kill the entire trigger.
--
-- Safe to run multiple times (fully idempotent).

-- ============================================================
-- 1. Create profiles table (missing from preview DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON profiles
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON profiles
      FOR UPDATE USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON profiles
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- updated_at trigger for profiles
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. Add missing columns to workspace_members
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

-- Unify status CHECK constraint (drop existing, add unified)
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

-- Backfill: set status='active' for any existing rows that have NULL status
UPDATE workspace_members SET status = 'active' WHERE status IS NULL;

-- ============================================================
-- 3. Add missing columns to user_profiles
-- ============================================================
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS allow_training boolean NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS chat_history_enabled boolean NOT NULL DEFAULT true;

-- ============================================================
-- 4. Recreate SECURITY DEFINER helpers for RLS (from migration 014)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_workspace_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = p_user_id;
$$;

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
-- 5. Fix RLS policies to use SECURITY DEFINER helpers (non-recursive)
-- ============================================================

-- workspace_members policies
DROP POLICY IF EXISTS "Members can view their workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "Owners can insert own member row" ON workspace_members;
DROP POLICY IF EXISTS "Owners can insert members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can delete members" ON workspace_members;

CREATE POLICY "Members can view their workspace members" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

CREATE POLICY "Owners can insert members" ON workspace_members
  FOR INSERT WITH CHECK (
    (user_id = auth.uid() AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
    OR
    is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "Admins can update members" ON workspace_members
  FOR UPDATE USING (
    is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "Admins can delete members" ON workspace_members
  FOR DELETE USING (
    is_workspace_admin(auth.uid(), workspace_id)
    OR user_id = auth.uid()
  );

-- workspaces policies (use helper to avoid recursion)
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Owners can delete workspaces" ON workspaces;
CREATE POLICY "Owners can delete workspaces" ON workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- credit_transactions policies (use helper)
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
-- 6. Recreate handle_new_user() with per-statement error handling
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id uuid;
  v_full_name text;
  v_slug text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create profile (non-fatal if profiles table doesn't exist)
  BEGIN
    INSERT INTO profiles (user_id, email, full_name, avatar_url)
    VALUES (NEW.id, NEW.email, v_full_name, NEW.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profiles insert failed for user %: %', NEW.id, SQLERRM;
  END;

  -- Create workspace (critical)
  BEGIN
    INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
    VALUES (v_full_name || '''s Workspace', v_slug, NEW.id, 'free', 10)
    RETURNING id INTO v_workspace_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: workspace insert failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  -- Add user as owner member (critical — needs workspace_id)
  BEGIN
    INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, status, invited_email, joined_at)
    VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name, 'active', NEW.email, now())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Retry with minimal columns if status/invited_email/joined_at don't exist
    BEGIN
      INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name)
      VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name)
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: workspace_member insert failed for user %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;
  END;

  -- Record signup bonus (non-fatal)
  BEGIN
    INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
    VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: credit_transaction insert failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 7. Backfill orphaned auth.users
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

    -- Profile
    BEGIN
      INSERT INTO profiles (user_id, email, full_name, avatar_url)
      VALUES (r.id, r.email, v_display_name, r.avatar_url)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Workspace
    INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
    VALUES (v_display_name || '''s Workspace', v_slug, r.id, 'free', 10)
    RETURNING id INTO v_workspace_id;

    -- Member
    BEGIN
      INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, status, invited_email, joined_at)
      VALUES (v_workspace_id, r.id, 'owner', r.email, v_display_name, 'active', r.email, now())
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name)
      VALUES (v_workspace_id, r.id, 'owner', r.email, v_display_name)
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    END;

    -- Credit
    BEGIN
      INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
      VALUES (v_workspace_id, r.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RAISE NOTICE 'Backfilled workspace for user % (%)', r.id, r.email;
  END LOOP;
END $$;
