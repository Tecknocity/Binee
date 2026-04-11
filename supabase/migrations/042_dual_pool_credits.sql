-- Migration 042: Dual-Pool Credit Model
-- Adds subscription_balance and paygo_balance columns to workspaces.
-- Subscription credits reset each billing cycle; PAYG credits persist forever.
-- Deductions draw from subscription first, then PAYG.
-- credit_balance is kept as a denormalized total (sub + paygo) for backward compat.

-- ============================================================
-- 1. Add new pool columns
-- ============================================================
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS subscription_balance numeric(12,4) NOT NULL DEFAULT 0;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS paygo_balance numeric(12,4) NOT NULL DEFAULT 0;

-- Migrate existing credit_balance into paygo_balance.
-- All existing credits are from purchases/bonuses/signup, not active subscriptions,
-- so they belong in the PAYG pool.
UPDATE workspaces SET paygo_balance = credit_balance WHERE credit_balance > 0;

-- ============================================================
-- 1b. Update handle_new_user trigger to populate dual pools
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

  INSERT INTO profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Create workspace with signup credits in paygo pool
  INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance, subscription_balance, paygo_balance)
  VALUES (
    v_full_name || '''s Workspace',
    v_slug,
    NEW.id,
    'free',
    10,
    0,
    10
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
  VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name, NEW.email, 'active', now())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.',
    '{"pool": "paygo"}'::jsonb);

  -- Create billing system rows (user_credit_accounts + user_subscriptions)
  INSERT INTO user_credit_accounts (user_id, subscription_balance, subscription_plan_credits, paygo_balance)
  VALUES (NEW.id, 0, 0, 25)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_subscriptions (user_id, status)
  VALUES (NEW.id, 'none')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_credit_transactions (user_id, type, credits_added, pool, amount_paid_cents, description)
  VALUES (NEW.id, 'signup_bonus', 25, 'paygo', 0, 'Welcome to Binee! 25 free credits.');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger failed for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Rewrite deduct_credits: subscription-first deduction
-- ============================================================
DROP FUNCTION IF EXISTS deduct_credits(uuid, uuid, numeric, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION deduct_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_message_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_balance numeric(12,4);
  v_paygo_balance numeric(12,4);
  v_total_balance numeric(12,4);
  v_from_sub numeric(12,4);
  v_from_paygo numeric(12,4);
  v_new_sub numeric(12,4);
  v_new_paygo numeric(12,4);
  v_new_total numeric(12,4);
  v_transaction_id uuid;
BEGIN
  -- Lock the workspace row to prevent concurrent deductions
  SELECT subscription_balance, paygo_balance
  INTO v_sub_balance, v_paygo_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_sub_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  v_total_balance := v_sub_balance + v_paygo_balance;

  -- Check using floor() so the user's visible balance is the gate
  IF floor(v_total_balance) < 1 AND p_amount > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_total_balance,
      'required', p_amount
    );
  END IF;

  -- Deduct from subscription first, overflow to paygo
  IF v_sub_balance >= p_amount THEN
    v_from_sub := p_amount;
    v_from_paygo := 0;
  ELSE
    v_from_sub := v_sub_balance;
    v_from_paygo := p_amount - v_sub_balance;
  END IF;

  v_new_sub := v_sub_balance - v_from_sub;
  v_new_paygo := v_paygo_balance - v_from_paygo;

  -- Prevent negative balance
  IF v_new_paygo < 0 THEN
    v_new_paygo := 0;
  END IF;

  v_new_total := v_new_sub + v_new_paygo;

  -- Update workspace balances
  UPDATE workspaces
  SET subscription_balance = v_new_sub,
      paygo_balance = v_new_paygo,
      credit_balance = v_new_total,
      updated_at = now()
  WHERE id = p_workspace_id;

  -- Record the transaction with pool breakdown in metadata
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, message_id, metadata)
  VALUES (
    p_workspace_id, p_user_id, -p_amount, v_new_total, 'deduction', p_description, p_message_id,
    p_metadata || jsonb_build_object('from_subscription', v_from_sub, 'from_paygo', v_from_paygo)
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_total,
    'deducted', p_amount,
    'from_subscription', v_from_sub,
    'from_paygo', v_from_paygo,
    'subscription_balance', v_new_sub,
    'paygo_balance', v_new_paygo
  );
END;
$$;

-- ============================================================
-- 3. Rewrite add_credits: route to correct pool based on type
-- ============================================================
DROP FUNCTION IF EXISTS add_credits(uuid, uuid, numeric, text, text, jsonb);

CREATE OR REPLACE FUNCTION add_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_balance numeric(12,4);
  v_paygo_balance numeric(12,4);
  v_new_sub numeric(12,4);
  v_new_paygo numeric(12,4);
  v_new_total numeric(12,4);
  v_transaction_id uuid;
BEGIN
  -- Validate type
  IF p_type NOT IN ('purchase', 'bonus', 'refund', 'monthly_reset', 'subscription_grant') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type: ' || p_type);
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock the workspace row
  SELECT subscription_balance, paygo_balance
  INTO v_sub_balance, v_paygo_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_sub_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  -- Route to correct pool based on credit type
  IF p_type IN ('subscription_grant', 'monthly_reset') THEN
    v_new_sub := v_sub_balance + p_amount;
    v_new_paygo := v_paygo_balance;
  ELSE
    -- purchase, bonus, refund go to paygo pool
    v_new_sub := v_sub_balance;
    v_new_paygo := v_paygo_balance + p_amount;
  END IF;

  v_new_total := v_new_sub + v_new_paygo;

  -- Update workspace balances
  UPDATE workspaces
  SET subscription_balance = v_new_sub,
      paygo_balance = v_new_paygo,
      credit_balance = v_new_total,
      updated_at = now()
  WHERE id = p_workspace_id;

  -- Record the transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  VALUES (p_workspace_id, p_user_id, p_amount, v_new_total, p_type::text, p_description,
    p_metadata || jsonb_build_object('pool', CASE WHEN p_type IN ('subscription_grant', 'monthly_reset') THEN 'subscription' ELSE 'paygo' END))
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_total,
    'added', p_amount,
    'subscription_balance', v_new_sub,
    'paygo_balance', v_new_paygo
  );
END;
$$;

-- ============================================================
-- 4. New RPC: reset_subscription_credits
--    Resets subscription_balance to a given amount (no rollover).
--    Used on monthly renewal and annual drip.
-- ============================================================
CREATE OR REPLACE FUNCTION reset_subscription_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_sub numeric(12,4);
  v_paygo_balance numeric(12,4);
  v_new_total numeric(12,4);
  v_delta numeric(12,4);
  v_transaction_id uuid;
BEGIN
  IF p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be non-negative');
  END IF;

  -- Lock the workspace row
  SELECT subscription_balance, paygo_balance
  INTO v_old_sub, v_paygo_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_old_sub IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  v_new_total := p_amount + v_paygo_balance;
  v_delta := p_amount - v_old_sub;

  -- Reset subscription balance; paygo untouched
  UPDATE workspaces
  SET subscription_balance = p_amount,
      credit_balance = v_new_total,
      credits_reset_at = now(),
      updated_at = now()
  WHERE id = p_workspace_id;

  -- Record the reset transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  VALUES (
    p_workspace_id, p_user_id, v_delta, v_new_total, 'subscription_grant', p_description,
    p_metadata || jsonb_build_object(
      'pool', 'subscription',
      'reset', true,
      'previous_subscription_balance', v_old_sub,
      'new_subscription_balance', p_amount,
      'paygo_balance', v_paygo_balance
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_total,
    'subscription_balance', p_amount,
    'paygo_balance', v_paygo_balance,
    'previous_subscription_balance', v_old_sub
  );
END;
$$;
