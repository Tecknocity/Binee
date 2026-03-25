// B-020: Centralized tier configuration for Binee subscription plans

export const PLAN_TIERS = {
  free: {
    credits_monthly: 0,
    credits_signup: 10,
    price: 0,
    max_members: 1,
    max_dashboards: 1,
    can_setup: false,
  },
  starter: {
    credits_monthly: 200,
    credits_signup: 10,
    price: 19,
    max_members: 5,
    max_dashboards: 5,
    can_setup: true,
  },
  pro: {
    credits_monthly: 600,
    credits_signup: 10,
    price: 49,
    max_members: null,
    max_dashboards: null,
    can_setup: true,
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

export function getTierConfig(plan: string) {
  return PLAN_TIERS[plan as PlanTier] ?? PLAN_TIERS.free;
}

export function getMonthlyCredits(plan: string): number {
  return getTierConfig(plan).credits_monthly;
}

export function getSignupCredits(plan: string): number {
  return getTierConfig(plan).credits_signup;
}

export function isPaidPlan(plan: string): boolean {
  return getTierConfig(plan).price > 0;
}
