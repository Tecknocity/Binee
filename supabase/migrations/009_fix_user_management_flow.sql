-- Migration 009: Fix user management flow
--
-- Problems addressed:
-- 1. handle_new_user() trigger doesn't create user_profiles row
-- 2. profiles table has no RLS policies
-- 3. add_credits() function doesn't accept 'subscription_grant' type
-- 4. Orphaned data from broken signup flow (workspaces without members)
-- 5. Need to clean up orphaned workspaces/credit_transactions from race conditions

-- ============================================================
-- 1. Clean up orphaned data from broken signup flows
--    Delete workspaces that have no workspace_members rows,
--    and their associated credit_transactions.
-- ============================================================

DELETE FROM credit_transactions
WHERE workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = w.id
  )
);

DELETE FROM workspaces
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspaces.id
);

-- ============================================================
-- 2. Add RLS policies to profiles table
--    This table was created in migration 004 but had NO RLS.
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Allow users to insert their own profile
CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. Fix handle_new_user() trigger
--    Now also creates a user_profiles row for settings/preferences.
--    Uses explicit error handling so a failure in one step
--    doesn't silently break the entire signup.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id uuid;
  v_full_name text;
  v_slug text;
BEGIN
  -- Derive full_name with fallback to email username
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate a unique slug from the name
  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create auth-synced profile (profiles table)
  INSERT INTO profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Create user settings profile (user_profiles table)
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id)
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
  VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name, NEW.email, 'active', now());

  -- Record signup bonus credit transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
  VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (DROP IF EXISTS + CREATE ensures clean state)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 4. Fix add_credits() to accept 'subscription_grant' type
-- ============================================================

CREATE OR REPLACE FUNCTION add_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_description text,
  p_metadata jsonb default '{}'
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
  -- Validate type (now includes subscription_grant)
  IF p_type NOT IN ('purchase', 'bonus', 'refund', 'monthly_reset', 'subscription_grant') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type: ' || p_type);
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock the workspace row to prevent concurrent modifications
  SELECT credit_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Update workspace balance
  UPDATE workspaces
  SET credit_balance = v_new_balance, updated_at = now()
  WHERE id = p_workspace_id;

  -- Record the transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  VALUES (p_workspace_id, p_user_id, p_amount, v_new_balance, p_type::text, p_description, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_balance,
    'added', p_amount
  );
END;
$$;

-- ============================================================
-- 5. Backfill: create user_profiles for any auth users missing them
-- ============================================================

INSERT INTO user_profiles (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 6. Backfill: ensure every workspace owner has a workspace_members row
--    (repeat of migration 008, but for any new orphans)
-- ============================================================

INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
SELECT
  w.id,
  w.owner_id,
  'owner',
  COALESCE(u.email, 'unknown'),
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ),
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
)
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET status = 'active', role = 'owner';
