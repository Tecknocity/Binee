-- Migration 025: Atomic Credit Deduction Function (B-091)
--
-- Creates the deduct_user_credits() SQL function used by the billing service.
-- Uses FOR UPDATE row locking to prevent race conditions on concurrent deductions.
-- Implements the two-pool algorithm: subscription first, then PAYG.
-- Logs every deduction to the credit_usage table for full auditability.
--
-- Named deduct_user_credits (not deduct_credits) to avoid conflict with the
-- existing workspace-scoped deduct_credits function from migration 005.

CREATE OR REPLACE FUNCTION deduct_user_credits(
  p_user_id UUID,
  p_credits_to_deduct NUMERIC,
  p_action_type TEXT,
  p_session_id TEXT,
  p_model_used TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_anthropic_cost_cents NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_account user_credit_accounts%ROWTYPE;
  v_from_subscription NUMERIC := 0;
  v_from_paygo NUMERIC := 0;
  v_remaining NUMERIC;
  v_total_available NUMERIC;
BEGIN
  -- Lock the row to prevent concurrent modifications
  SELECT * INTO v_account
  FROM user_credit_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No credit account found'
    );
  END IF;

  v_total_available := v_account.subscription_balance + v_account.paygo_balance;

  -- If user has zero credits, block future actions
  IF v_total_available <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No credits available',
      'overageBlocked', true
    );
  END IF;

  -- Subscription first (expiring credits should be used first)
  v_remaining := p_credits_to_deduct;

  IF v_account.subscription_balance > 0 THEN
    v_from_subscription := LEAST(v_account.subscription_balance, v_remaining);
    v_remaining := v_remaining - v_from_subscription;
  END IF;

  -- Then PAYG (safety net, never expires)
  IF v_remaining > 0 AND v_account.paygo_balance > 0 THEN
    v_from_paygo := LEAST(v_account.paygo_balance, v_remaining);
    v_remaining := v_remaining - v_from_paygo;
  END IF;

  -- If v_remaining > 0, user went into slight overage on this action.
  -- This is by design — current action finishes, user blocked on next.

  -- Update balances
  UPDATE user_credit_accounts SET
    subscription_balance = subscription_balance - v_from_subscription,
    paygo_balance = paygo_balance - v_from_paygo,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the usage
  INSERT INTO credit_usage (
    user_id, action_type, session_id, model_used,
    input_tokens, output_tokens, anthropic_cost_cents,
    credits_deducted, deducted_from_subscription, deducted_from_paygo
  ) VALUES (
    p_user_id, p_action_type, p_session_id, p_model_used,
    p_input_tokens, p_output_tokens, p_anthropic_cost_cents,
    p_credits_to_deduct, v_from_subscription, v_from_paygo
  );

  RETURN jsonb_build_object(
    'success', true,
    'credits_deducted', p_credits_to_deduct,
    'from_subscription', v_from_subscription,
    'from_paygo', v_from_paygo,
    'new_subscription_balance', v_account.subscription_balance - v_from_subscription,
    'new_paygo_balance', v_account.paygo_balance - v_from_paygo,
    'new_display_balance', FLOOR(
      (v_account.subscription_balance - v_from_subscription) +
      (v_account.paygo_balance - v_from_paygo)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
