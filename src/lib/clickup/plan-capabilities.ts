// ClickUp plan tier feature capabilities and error classification
//
// Maps ClickUp plan tiers to available features so we can:
// 1. Warn users before building items their plan doesn't support
// 2. Smart-skip unsupported items instead of wasting API calls
// 3. Give actionable error messages when things fail

import type { ClickUpPlanTier } from '@/lib/clickup/rate-limits';

// ---------------------------------------------------------------------------
// Feature capabilities per plan
// ---------------------------------------------------------------------------

export interface PlanCapabilities {
  spaces: boolean;
  folders: boolean;
  lists: boolean;
  statuses: boolean;
  tags: boolean;
  customFields: boolean;
  docs: boolean;
  goals: boolean;
  timeTracking: boolean;
  automations: boolean;
  dashboards: boolean;
  /** Human-readable plan label */
  label: string;
  /** Minimum plan needed to unlock next tier of features */
  upgradeTarget: ClickUpPlanTier | null;
}

const PLAN_CAPABILITIES: Record<ClickUpPlanTier, PlanCapabilities> = {
  free: {
    spaces: true,
    folders: true,
    lists: true,
    statuses: true,
    tags: true,
    customFields: true,
    docs: true,
    goals: false,
    timeTracking: false,
    automations: false,
    dashboards: false,
    label: 'Free',
    upgradeTarget: 'unlimited',
  },
  unlimited: {
    spaces: true,
    folders: true,
    lists: true,
    statuses: true,
    tags: true,
    customFields: true,
    docs: true,
    goals: false,
    timeTracking: true,
    automations: true,
    dashboards: true,
    label: 'Unlimited',
    upgradeTarget: 'business',
  },
  business: {
    spaces: true,
    folders: true,
    lists: true,
    statuses: true,
    tags: true,
    customFields: true,
    docs: true,
    goals: true,
    timeTracking: true,
    automations: true,
    dashboards: true,
    label: 'Business',
    upgradeTarget: 'enterprise',
  },
  business_plus: {
    spaces: true,
    folders: true,
    lists: true,
    statuses: true,
    tags: true,
    customFields: true,
    docs: true,
    goals: true,
    timeTracking: true,
    automations: true,
    dashboards: true,
    label: 'Business Plus',
    upgradeTarget: 'enterprise',
  },
  enterprise: {
    spaces: true,
    folders: true,
    lists: true,
    statuses: true,
    tags: true,
    customFields: true,
    docs: true,
    goals: true,
    timeTracking: true,
    automations: true,
    dashboards: true,
    label: 'Enterprise',
    upgradeTarget: null,
  },
};

// ---------------------------------------------------------------------------
// Default list views per plan tier
// ---------------------------------------------------------------------------
//
// Every list the setup executor creates gets these views attached automatically
// (when the user has the "Add starter tasks and doc content" toggle on). 5 per
// tier, with List + Board + Calendar always included so the basics are covered
// regardless of plan. Higher tiers swap in views that need more powerful caps:
//   - Gantt: capped at 100 uses on Free, unlimited on Unlimited+
//   - Workload: requires Business+ to be useful (capacity by assignee)
// View type strings match ClickUp's POST /list/{id}/view `type` field.
// ---------------------------------------------------------------------------

export const DEFAULT_LIST_VIEWS_BY_TIER: Record<ClickUpPlanTier, string[]> = {
  free: ['list', 'board', 'calendar', 'gantt', 'activity'],
  unlimited: ['list', 'board', 'calendar', 'gantt', 'timeline'],
  business: ['list', 'board', 'calendar', 'timeline', 'workload'],
  business_plus: ['list', 'board', 'calendar', 'timeline', 'workload'],
  enterprise: ['list', 'board', 'calendar', 'timeline', 'workload'],
};

export function getDefaultListViews(planTier: string): string[] {
  const tier = planTier.toLowerCase().replace(/\s+/g, '_') as ClickUpPlanTier;
  return DEFAULT_LIST_VIEWS_BY_TIER[tier] ?? DEFAULT_LIST_VIEWS_BY_TIER.free;
}

/**
 * Get the capabilities for a given ClickUp plan tier.
 */
export function getPlanCapabilities(planTier: string): PlanCapabilities {
  const tier = planTier.toLowerCase().replace(/\s+/g, '_') as ClickUpPlanTier;
  return PLAN_CAPABILITIES[tier] ?? PLAN_CAPABILITIES.free;
}

/**
 * Map setup item types to the capability key they require.
 */
const ITEM_TYPE_TO_CAPABILITY: Record<string, keyof PlanCapabilities> = {
  space: 'spaces',
  folder: 'folders',
  list: 'lists',
  tag: 'tags',
  doc: 'docs',
  goal: 'goals',
};

/**
 * Check if a given setup item type is supported on the plan.
 */
export function isItemTypeSupported(itemType: string, planTier: string): boolean {
  const caps = getPlanCapabilities(planTier);
  const capKey = ITEM_TYPE_TO_CAPABILITY[itemType];
  if (!capKey) return true; // Unknown types are assumed supported
  return caps[capKey] === true;
}

/**
 * Get a list of unsupported item types for a given plan.
 * Returns tuples of [itemType, requiredPlan].
 */
export function getUnsupportedFeatures(planTier: string): Array<{
  feature: string;
  requiredPlan: string;
}> {
  const caps = getPlanCapabilities(planTier);
  const unsupported: Array<{ feature: string; requiredPlan: string }> = [];

  if (!caps.goals) {
    unsupported.push({ feature: 'Goals', requiredPlan: 'Business' });
  }
  if (!caps.timeTracking) {
    unsupported.push({ feature: 'Time Tracking', requiredPlan: 'Unlimited' });
  }
  if (!caps.automations) {
    unsupported.push({ feature: 'Automations', requiredPlan: 'Unlimited' });
  }
  if (!caps.dashboards) {
    unsupported.push({ feature: 'Dashboards', requiredPlan: 'Unlimited' });
  }

  return unsupported;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export type ClickUpErrorType =
  | 'plan_limitation'
  | 'permission'
  | 'rate_limit'
  | 'auth_expired'
  | 'not_found'
  | 'clickup_error'
  | 'binee_error';

export interface ClassifiedError {
  type: ClickUpErrorType;
  /** Short user-facing message */
  message: string;
  /** Longer explanation with action the user can take */
  detail: string;
  /** Whether the user can resolve this themselves */
  userResolvable: boolean;
}

/**
 * Classify a ClickUp API error into an actionable category with a
 * user-friendly message. Works with raw status codes or ClickUpApiError.
 */
export function classifyClickUpError(
  statusCode: number,
  errorBody?: string,
  itemType?: string,
  planTier?: string,
): ClassifiedError {
  const bodyLower = (errorBody || '').toLowerCase();

  // 401 - Authentication expired
  if (statusCode === 401) {
    return {
      type: 'auth_expired',
      message: 'ClickUp connection expired',
      detail: 'Your ClickUp authorization has expired. Please reconnect your ClickUp account in Settings to continue.',
      userResolvable: true,
    };
  }

  // 403 - Permission or plan limitation
  if (statusCode === 403) {
    // Check the error body for specific limit/plan-related messages from ClickUp
    if (bodyLower.includes('limit') || bodyLower.includes('maximum') || bodyLower.includes('upgrade') || bodyLower.includes('plan')) {
      const caps = planTier ? getPlanCapabilities(planTier) : null;
      const planLabel = caps?.label || 'current';
      const itemLabel = itemType
        ? itemType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + 's'
        : 'items';
      return {
        type: 'plan_limitation',
        message: `${itemLabel} limit reached on ${planLabel} plan`,
        detail: `You've reached the maximum number of ${itemLabel.toLowerCase()} allowed on your ${planLabel} ClickUp plan. Upgrade your plan at clickup.com/pricing or remove existing ${itemLabel.toLowerCase()} to free up space.`,
        userResolvable: true,
      };
    }

    // Check if this is a plan limitation vs a permission issue
    if (itemType && planTier && !isItemTypeSupported(itemType, planTier)) {
      const caps = getPlanCapabilities(planTier);
      const featureName = itemType
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') + 's';
      return {
        type: 'plan_limitation',
        message: `${featureName} not available on ${caps.label} plan`,
        detail: `ClickUp ${featureName} require a higher plan. You can upgrade your ClickUp plan at clickup.com/pricing, then retry the build.`,
        userResolvable: true,
      };
    }

    // Check for specific ClickUp permission messages in error body
    if (bodyLower.includes('guest') || bodyLower.includes('admin') || bodyLower.includes('owner')) {
      return {
        type: 'permission',
        message: 'Insufficient ClickUp role',
        detail: 'This action requires admin or owner permissions in your ClickUp workspace. Ask your workspace owner to grant you the necessary role.',
        userResolvable: true,
      };
    }

    return {
      type: 'permission',
      message: 'ClickUp permission denied',
      detail: 'Your ClickUp user does not have permission for this action. Check your ClickUp workspace role and permissions.',
      userResolvable: true,
    };
  }

  // 404 - Resource not found
  if (statusCode === 404) {
    return {
      type: 'not_found',
      message: 'Resource not found in ClickUp',
      detail: 'The requested resource was not found in ClickUp. It may have been deleted or moved.',
      userResolvable: false,
    };
  }

  // 429 - Rate limit
  if (statusCode === 429) {
    return {
      type: 'rate_limit',
      message: 'ClickUp rate limit reached',
      detail: 'Too many requests to ClickUp. Wait a moment and try again. The build will automatically retry.',
      userResolvable: true,
    };
  }

  // 5xx - ClickUp server error
  if (statusCode >= 500) {
    return {
      type: 'clickup_error',
      message: 'ClickUp is experiencing issues',
      detail: 'ClickUp returned a server error. This is usually temporary. Try again in a few minutes.',
      userResolvable: true,
    };
  }

  // Check error body for common messages
  if (bodyLower.includes('oauth') || bodyLower.includes('token')) {
    return {
      type: 'auth_expired',
      message: 'ClickUp connection expired',
      detail: 'Your ClickUp authorization has expired. Reconnect in Settings.',
      userResolvable: true,
    };
  }

  // Default
  return {
    type: 'binee_error',
    message: 'Something went wrong',
    detail: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
    userResolvable: false,
  };
}

// ---------------------------------------------------------------------------
// Plan resource limits (e.g. max spaces on Free tier)
// ---------------------------------------------------------------------------

export interface PlanLimits {
  /** Max number of spaces allowed, or null if unlimited */
  maxSpaces: number | null;
}

const PLAN_LIMITS: Record<ClickUpPlanTier, PlanLimits> = {
  free: { maxSpaces: 5 },
  unlimited: { maxSpaces: null },
  business: { maxSpaces: null },
  business_plus: { maxSpaces: null },
  enterprise: { maxSpaces: null },
};

/**
 * Get resource limits for a given ClickUp plan tier.
 */
export function getPlanLimits(planTier: string): PlanLimits {
  const tier = planTier.toLowerCase().replace(/\s+/g, '_') as ClickUpPlanTier;
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
}

/**
 * Build a concise plan limitations summary for the AI prompt.
 * Tells the AI what NOT to recommend based on the user's plan.
 */
export function buildPlanContextForAI(planTier: string): string {
  const caps = getPlanCapabilities(planTier);
  const unsupported = getUnsupportedFeatures(planTier);

  if (unsupported.length === 0) {
    return `CLICKUP PLAN: ${caps.label} - all features available. You can recommend any ClickUp feature.`;
  }

  // Phase 3 made plan tier user-supplied (profile form dropdown writes
  // workspaces.clickup_plan_tier with source='user'), so this block is
  // now authoritative. The earlier advisory wording was a band-aid
  // around the unreliable OAuth scrape; the deference rule in the
  // system prompt has been removed in lockstep.
  const lines = [
    `CLICKUP PLAN: ${caps.label}`,
    `Available on this plan: Spaces, Folders, Lists, Tags, Custom Fields, Statuses${caps.docs ? ', Docs' : ''}${caps.timeTracking ? ', Time Tracking' : ''}`,
    `NOT available on this plan: ${unsupported.map(u => `${u.feature} (requires ${u.requiredPlan}+)`).join(', ')}`,
    `Do not recommend the unavailable features in the workspace structure - the user's plan would reject them at build time. If the user asks about an unavailable feature, explain it requires a higher plan.`,
  ];

  return lines.join('\n');
}
