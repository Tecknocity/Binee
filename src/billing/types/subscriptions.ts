export type PlanTier = '100' | '150' | '250' | '500' | '750' | '1000' | '2000';
export type BillingPeriod = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'none';

export interface UserSubscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan_tier: PlanTier | null;
  billing_period: BillingPeriod | null;
  current_period_start: string | null;  // Stripe billing period
  current_period_end: string | null;    // Stripe billing period
  next_credit_allocation_date: string | null;  // Backend-managed
  annual_end_date: string | null;              // For annual plans only
  cancel_at_period_end: boolean;
  pending_plan_change: PlanTier | null;
  payment_provider_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}
