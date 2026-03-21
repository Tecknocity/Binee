// ClickUp plan tier rate limit configuration and throttle helpers

export type ClickUpPlanTier =
  | "free"
  | "unlimited"
  | "business"
  | "business_plus"
  | "enterprise";

export const RATE_LIMITS: Record<ClickUpPlanTier, { requests_per_minute: number }> = {
  free: { requests_per_minute: 100 },
  unlimited: { requests_per_minute: 1500 },
  business: { requests_per_minute: 1500 },
  business_plus: { requests_per_minute: 1000 },
  enterprise: { requests_per_minute: 10000 },
} as const;

const DEFAULT_RATE_LIMIT = 100;

/**
 * Get the rate limit (requests per minute) for a given plan tier.
 * Returns the default (free tier) limit for unknown tiers.
 */
export function getRateLimit(planTier: string): number {
  const tier = planTier.toLowerCase() as ClickUpPlanTier;
  return RATE_LIMITS[tier]?.requests_per_minute ?? DEFAULT_RATE_LIMIT;
}

/**
 * Check whether the current request count has reached the throttle
 * threshold for the given plan tier. Uses an 80% safety margin to
 * avoid hitting the hard limit.
 */
export function shouldThrottle(requestCount: number, planTier: string): boolean {
  const limit = getRateLimit(planTier);
  const threshold = Math.floor(limit * 0.8);
  return requestCount >= threshold;
}

/**
 * Normalise a plan name string from the ClickUp API into our canonical tier.
 * The API returns values like "Free", "Business", "Business Plus", "Enterprise", etc.
 */
export function normalizePlanTier(rawPlan: string): ClickUpPlanTier {
  const cleaned = rawPlan.trim().toLowerCase().replace(/\s+/g, "_");

  if (cleaned in RATE_LIMITS) {
    return cleaned as ClickUpPlanTier;
  }

  // Handle common API variants
  if (cleaned.startsWith("enterprise")) return "enterprise";
  if (cleaned.startsWith("business_plus") || cleaned === "businessplus") return "business_plus";
  if (cleaned.startsWith("business")) return "business";
  if (cleaned === "unlimited" || cleaned === "team") return "unlimited";

  return "free";
}
