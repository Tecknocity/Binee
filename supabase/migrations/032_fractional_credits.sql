-- Migration 032: Fractional Credit Balances
-- Changes credit_balance and related columns from integer to numeric(12,4)
-- so we can track exact fractional credits instead of rounding up per message.
-- Users see Math.floor() of their balance on the frontend.

-- ============================================================
-- 1. Alter workspaces.credit_balance to numeric
-- ============================================================
ALTER TABLE workspaces
  ALTER COLUMN credit_balance TYPE numeric(12,4) USING credit_balance::numeric(12,4);

ALTER TABLE workspaces
  ALTER COLUMN credit_balance SET DEFAULT 100;

-- ============================================================
-- 2. Alter credit_transactions.amount and balance_after to numeric
-- ============================================================
ALTER TABLE credit_transactions
  ALTER COLUMN amount TYPE numeric(12,4) USING amount::numeric(12,4);

ALTER TABLE credit_transactions
  ALTER COLUMN balance_after TYPE numeric(12,4) USING balance_after::numeric(12,4);

-- ============================================================
-- 3. Recreate deduct_credits with numeric types
-- ============================================================
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
  v_current_balance numeric(12,4);
  v_new_balance numeric(12,4);
  v_transaction_id uuid;
BEGIN
  -- Lock the workspace row to prevent concurrent deductions
  SELECT credit_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  -- Check using floor() so the user's visible balance is the gate
  IF floor(v_current_balance) < 1 AND p_amount > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_current_balance,
      'required', p_amount
    );
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  -- Update workspace balance
  UPDATE workspaces
  SET credit_balance = v_new_balance, updated_at = now()
  WHERE id = p_workspace_id;

  -- Record the transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description, message_id, metadata)
  VALUES (p_workspace_id, p_user_id, -p_amount, v_new_balance, 'deduction', p_description, p_message_id, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_balance,
    'deducted', p_amount
  );
END;
$$;

-- ============================================================
-- 4. Recreate add_credits with numeric types
-- ============================================================
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
  v_current_balance numeric(12,4);
  v_new_balance numeric(12,4);
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
