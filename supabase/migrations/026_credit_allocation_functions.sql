-- Migration 026: Credit Allocation Helper Functions (B-092)
--
-- Atomic SQL functions for adding credits to subscription and PAYG pools.
-- Used by lifecycle handlers (upgrade, setup purchase, PAYG purchase).
-- Row-level locking prevents race conditions on concurrent operations.

-- ============================================================
-- 1. add_subscription_credits — atomically add to subscription pool
-- ============================================================
CREATE OR REPLACE FUNCTION add_subscription_credits(
  p_user_id UUID,
  p_credits NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_credit_accounts
  SET
    subscription_balance = subscription_balance + p_credits,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit account found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. add_paygo_credits — atomically add to PAYG pool
-- ============================================================
CREATE OR REPLACE FUNCTION add_paygo_credits(
  p_user_id UUID,
  p_credits NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_credit_accounts
  SET
    paygo_balance = paygo_balance + p_credits,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No credit account found for user %', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
