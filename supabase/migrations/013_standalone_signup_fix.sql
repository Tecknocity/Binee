-- Migration 011: Standalone signup fix
--
-- This is a SELF-CONTAINED migration that can be run on a fresh Supabase
-- database (no prior migrations needed). It creates all tables required for
-- user signup to work, sets up the handle_new_user() trigger, and backfills
-- any orphaned auth.users rows.
--
-- Safe to run multiple times (fully idempotent).

-- ============================================================
-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Core tables (CREATE IF NOT EXISTS — safe on existing DBs)
-- ============================================================

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  credit_balance integer NOT NULL DEFAULT 100,
  clickup_team_id text,
  clickup_access_token text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  email text NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Profiles
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

-- Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  type text NOT NULL CHECK (type IN ('deduction', 'purchase', 'bonus', 'refund', 'monthly_reset', 'subscription')),
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace ON credit_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(workspace_id, created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Add columns that later migrations expect (safe if they already exist)
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
-- 3. RLS policies (idempotent — only create if missing)
-- ============================================================

-- Workspaces policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Users can view own workspaces') THEN
    CREATE POLICY "Users can view own workspaces" ON workspaces
      FOR SELECT USING (
        owner_id = auth.uid() OR
        id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Owners can update workspaces') THEN
    CREATE POLICY "Owners can update workspaces" ON workspaces
      FOR UPDATE USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Authenticated users can create workspaces') THEN
    CREATE POLICY "Authenticated users can create workspaces" ON workspaces
      FOR INSERT WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- Workspace members policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members can view their workspace members') THEN
    CREATE POLICY "Members can view their workspace members" ON workspace_members
      FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Admins can manage members') THEN
    CREATE POLICY "Admins can manage members" ON workspace_members
      FOR ALL USING (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Owners can insert own member row') THEN
    CREATE POLICY "Owners can insert own member row" ON workspace_members
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Profiles policies
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

-- Credit transactions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Workspace members can view credit transactions') THEN
    CREATE POLICY "Workspace members can view credit transactions" ON credit_transactions
      FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'System can insert credit transactions') THEN
    CREATE POLICY "System can insert credit transactions" ON credit_transactions
      FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ============================================================
-- 4. Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers (DROP IF EXISTS + CREATE to be idempotent)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['workspaces', 'workspace_members', 'profiles']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 5. handle_new_user() trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id uuid;
  v_full_name text;
  v_slug text;
BEGIN
  -- Derive full_name with fallback
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate a unique slug
  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create profile
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

-- ============================================================
-- 6. Attach the trigger
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 7. Backfill orphaned auth.users (signed up before trigger worked)
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

    -- Create welcome credit
    INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
    VALUES (v_workspace_id, r.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

    RAISE NOTICE 'Backfilled workspace for user % (%)', r.id, r.email;
  END LOOP;
END $$;

-- ============================================================
-- 8. Atomic credit deduction function
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_metadata jsonb DEFAULT '{}'
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
  SELECT credit_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Insufficient credits',
      'balance', v_current_balance, 'required', p_amount
    );
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE workspaces
  SET credit_balance = v_new_balance, updated_at = now()
  WHERE id = p_workspace_id;

  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  VALUES (p_workspace_id, p_user_id, -p_amount, v_new_balance, 'deduction', p_description, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', v_transaction_id,
    'balance', v_new_balance, 'deducted', p_amount
  );
END;
$$;
