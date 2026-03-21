// ClickUp integration — main exports

export { ClickUpClient, ClickUpApiError, ClickUpRateLimitError } from "@/lib/clickup/client";

export {
  getClickUpAuthUrl,
  parseOAuthState,
  exchangeCodeForToken,
  refreshAccessToken,
  storeTokens,
  getAccessToken,
  disconnectClickUp,
} from "@/lib/clickup/oauth";

export {
  encryptToken,
  decryptToken,
} from "@/lib/clickup/encryption";

export {
  refreshTokenIfNeeded,
  forceRefreshToken,
} from "@/lib/clickup/token-refresh";

export {
  performInitialSync,
  performReconciliationSync,
  runFullSync,
  getSyncProgress,
  upsertCachedSpaces,
  upsertCachedFolders,
  upsertCachedLists,
  upsertCachedTasks,
  upsertCachedMembers,
  upsertCachedTimeEntries,
} from "@/lib/clickup/sync";

export type { FullSyncProgress } from "@/lib/clickup/sync";

export {
  registerWebhooks,
  unregisterWebhooks,
  processWebhookEvent,
  handleTimeTracked,
  verifyWebhookHealth,
} from "@/lib/clickup/webhooks";

export {
  RATE_LIMITS,
  getRateLimit,
  shouldThrottle,
  normalizePlanTier,
} from "@/lib/clickup/rate-limits";

export type { ClickUpPlanTier } from "@/lib/clickup/rate-limits";
