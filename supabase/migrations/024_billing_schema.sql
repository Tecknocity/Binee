-- Migration 024: Billing Database Schema (B-090)
--
-- Creates the billing system foundation:
--   - user_credit_accounts (dual-pool credit balances per user)
--   - user_subscriptions (subscription state per user)
--   - credit_transactions (new user-scoped, immutable transaction log)
--   - credit_usage (per-AI-interaction cost tracking)
--   - weekly_usage_summaries (materialized weekly rollups)
--   - RLS policies (users can only read their own data)
--   - Updated handle_new_user() trigger to auto-create billing rows
--
-- Note: The existing workspace-scoped credit_transactions table and
-- deduct_credits/add_credits functions are left intact for backward
-- compatibility. The new billing tables operate independently.

-- ============================================================
-- 1. user_credit_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS user_credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Subscription pool (expires on cycle reset)
  subscription_balance NUMERIC(12, 4) NOT NULL DEFAULT 0,
  subscription_plan_credits INTEGER NOT NULL DEFAULT 0,

  -- PAYG pool (never expires, includes free credits and setup credits)
  paygo_balance NUMERIC(12, 4) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Display balance is computed: FLOOR(subscription_balance + paygo_balance)
-- Never stored — always calculated on read

-- ============================================================
-- 2. user_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('active', 'cancelled', 'past_due', 'none')),
  plan_tier TEXT CHECK (plan_tier IN ('50', '100', '250', '500', '1000')),
  billing_period TEXT CHECK (billing_period IN ('monthly', 'annual')),

  -- Stripe billing dates (when Stripe charges)
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Credit allocation dates (backend-managed, independent of Stripe)
  next_credit_allocation_date TIMESTAMPTZ,
  annual_end_date TIMESTAMPTZ,

  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  pending_plan_change TEXT,
  payment_provider_id TEXT,
  stripe_customer_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_allocation
  ON user_subscriptions(next_credit_allocation_date)
  WHERE status = 'active';

-- ============================================================
-- 3. credit_usage (per-AI-interaction cost tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  action_type TEXT NOT NULL CHECK (action_type IN ('chat', 'health_check', 'setup', 'dashboard', 'briefing')),
  session_id TEXT,

  model_used TEXT NOT NULL CHECK (model_used IN ('haiku', 'sonnet', 'opus')),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  anthropic_cost_cents NUMERIC(10, 4) NOT NULL,

  credits_deducted NUMERIC(12, 4) NOT NULL,
  deducted_from_subscription NUMERIC(12, 4) NOT NULL DEFAULT 0,
  deducted_from_paygo NUMERIC(12, 4) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user ON credit_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_usage_session ON credit_usage(session_id);

-- ============================================================
-- 4. weekly_usage_summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_usage_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_credits_used INTEGER NOT NULL,
  total_actions INTEGER NOT NULL,
  breakdown_chat INTEGER NOT NULL DEFAULT 0,
  breakdown_health_check INTEGER NOT NULL DEFAULT 0,
  breakdown_setup INTEGER NOT NULL DEFAULT 0,
  breakdown_dashboard INTEGER NOT NULL DEFAULT 0,
  breakdown_briefing INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, week_start)
);

-- ============================================================
-- 5. New user-scoped credit_transactions table
-- ============================================================
-- The existing credit_transactions table is workspace-scoped.
-- We create a new user-scoped table for the billing system.
-- Using a separate name to avoid conflicts with the existing table.
CREATE TABLE IF NOT EXISTS user_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'subscription_renewal', 'subscription_upgrade', 'paygo_purchase', 'setup_purchase')),
  credits_added NUMERIC(12, 4) NOT NULL,
  pool TEXT NOT NULL CHECK (pool IN ('subscription', 'paygo')),
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_user
  ON user_credit_transactions(user_id, created_at DESC);

-- ============================================================
-- 6. RLS Policies
-- ============================================================
ALTER TABLE user_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_usage_summaries ENABLE ROW LEVEL SECURITY;

-- user_credit_accounts: users can only read their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credit_accounts' AND policyname = 'Users read own credit account') THEN
    CREATE POLICY "Users read own credit account" ON user_credit_accounts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- user_subscriptions: users can only read their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_subscriptions' AND policyname = 'Users read own subscription') THEN
    CREATE POLICY "Users read own subscription" ON user_subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- user_credit_transactions: users can only read their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credit_transactions' AND policyname = 'Users read own transactions') THEN
    CREATE POLICY "Users read own transactions" ON user_credit_transactions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- credit_usage: users can only read their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_usage' AND policyname = 'Users read own usage') THEN
    CREATE POLICY "Users read own usage" ON credit_usage
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- weekly_usage_summaries: users can only read their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_usage_summaries' AND policyname = 'Users read own summaries') THEN
    CREATE POLICY "Users read own summaries" ON weekly_usage_summaries
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- All writes happen server-side (Edge Functions / API routes) using service role key

-- ============================================================
-- 7. updated_at triggers for new billing tables
-- ============================================================
-- Reuse the existing update_updated_at() function from migration 013
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['user_credit_accounts', 'user_subscriptions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 8. Update handle_new_user() to create billing rows on signup
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

  -- Record legacy workspace signup bonus
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
  VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

  -- ============================================================
  -- NEW: Create billing system rows
  -- ============================================================

  -- Create user credit account with free signup credits in PAYG pool
  INSERT INTO user_credit_accounts (user_id, subscription_balance, subscription_plan_credits, paygo_balance)
  VALUES (NEW.id, 0, 0, 25)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create user subscription with status 'none'
  INSERT INTO user_subscriptions (user_id, status)
  VALUES (NEW.id, 'none')
  ON CONFLICT (user_id) DO NOTHING;

  -- Record the signup bonus in the new billing transaction log
  INSERT INTO user_credit_transactions (user_id, type, credits_added, pool, amount_paid_cents, description)
  VALUES (NEW.id, 'signup_bonus', 25, 'paygo', 0, 'Welcome to Binee! 25 free credits.');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger failed for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. Backfill billing rows for existing users
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM user_credit_accounts uca WHERE uca.user_id = u.id
    )
  LOOP
    -- Create credit account (existing users get 25 PAYG credits too)
    INSERT INTO user_credit_accounts (user_id, subscription_balance, subscription_plan_credits, paygo_balance)
    VALUES (r.id, 0, 0, 25)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create subscription record
    INSERT INTO user_subscriptions (user_id, status)
    VALUES (r.id, 'none')
    ON CONFLICT (user_id) DO NOTHING;

    -- Record signup bonus
    INSERT INTO user_credit_transactions (user_id, type, credits_added, pool, amount_paid_cents, description)
    VALUES (r.id, 'signup_bonus', 25, 'paygo', 0, 'Welcome to Binee! 25 free credits (backfill).');

    RAISE NOTICE 'Backfilled billing rows for user %', r.id;
  END LOOP;
END $$;
