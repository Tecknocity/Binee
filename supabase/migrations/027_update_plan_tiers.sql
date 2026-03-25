-- Migration 027: Update plan_tier values
--
-- Removes the '50' tier and adds '150', '750', '2000' tiers.
-- Updates the CHECK constraint on user_subscriptions.plan_tier.

-- 1. Drop the existing CHECK constraint on plan_tier
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_tier_check;

-- 2. Add the new CHECK constraint with updated tier values
ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_tier_check
  CHECK (plan_tier IN ('100', '150', '250', '500', '750', '1000', '2000'));
