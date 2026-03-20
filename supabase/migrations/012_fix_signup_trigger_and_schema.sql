-- Migration 010: Fix signup trigger and ensure schema consistency
--
-- This migration addresses the issue where user signup succeeds (auth.users row
-- is created) but no profile, workspace, workspace_members, or credit_transactions
-- rows are created. This happens when:
-- 1. The handle_new_user() trigger was never applied or was dropped
-- 2. Schema columns are missing that the trigger depends on
--
-- This migration is fully idempotent and safe to run multiple times.

-- ============================================================
-- 1. Ensure all required columns exist on workspace_members
-- ============================================================
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS invited_email text;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS joined_at timestamptz;

-- Ensure status column exists with a default
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

-- Unify status CHECK constraint (drop all existing, add unified)
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
ALTER TABLE workspace_members ALTER COLUMN status SET NOT NULL;

-- ============================================================
-- 2. Ensure profiles table exists
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

-- Ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Ensure RLS policies exist for profiles (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON profiles
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON profiles
      FOR UPDATE USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON profiles
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 4. Ensure "Owners can insert own member row" RLS policy exists
--    (fixes circular RLS dependency for first workspace_member insert)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspace_members' AND policyname = 'Owners can insert own member row'
  ) THEN
    CREATE POLICY "Owners can insert own member row" ON workspace_members
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 5. Re-create the handle_new_user() trigger function
--    Uses CREATE OR REPLACE so it's safe to run multiple times.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id uuid;
  v_full_name text;
  v_slug text;
BEGIN
  -- Derive full_name with fallback to display_name then email username
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate a unique slug from the name
  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create profile (skip if already exists)
  INSERT INTO profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Create workspace
  INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
  VALUES (
    v_full_name || '''s Workspace',
    v_slug,
    NEW.id,
    'free',
    10
  )
  RETURNING id INTO v_workspace_id;

  -- Add user as owner member of their workspace
  INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
  VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name, NEW.email, 'active', now())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Record signup bonus credit transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
  VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't block user creation.
  -- The ensure-owner API route will handle workspace creation as a fallback.
  RAISE WARNING 'handle_new_user trigger failed for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Attach the trigger (drop first to ensure clean state)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 7. Backfill: create workspace + member for any auth.users
--    that exist but have no workspace (users who signed up
--    before the trigger was working).
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
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = u.id AND wm.status IN ('active', 'pending')
    )
  LOOP
    v_display_name := COALESCE(r.display_name, 'User');
    v_slug := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(gen_random_uuid()::text, 1, 8);

    -- Create profile if missing
    INSERT INTO profiles (user_id, email, full_name, avatar_url)
    VALUES (r.id, r.email, v_display_name, r.avatar_url)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create workspace
    INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
    VALUES (v_display_name || '''s Workspace', v_slug, r.id, 'free', 10)
    RETURNING id INTO v_workspace_id;

    -- Create workspace member
    INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
    VALUES (v_workspace_id, r.id, 'owner', r.email, v_display_name, r.email, 'active', now())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    -- Create welcome credit transaction
    INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
    VALUES (v_workspace_id, r.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

    RAISE NOTICE 'Backfilled workspace for user % (%)', r.id, r.email;
  END LOOP;
END $$;
