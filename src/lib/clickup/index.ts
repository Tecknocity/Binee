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

export {
  createTask,
  updateTask,
  moveTask,
  updateTaskStatus,
  assignTask,
  unassignTask,
  addComment,
  createList,
  createFolder,
  searchDocs,
  createDoc,
  getDocPages,
  createDocPage,
  updateDocPage,
  getTaskComments,
  createTaskComment,
  getGoals,
  createGoal,
  updateGoal,
  getKeyResults,
  createKeyResult,
  addTagToTask,
  removeTagFromTask,
  setCustomFieldValue,
  addDependency,
  removeDependency,
  addTaskLink,
  removeTaskLink,
} from "@/lib/clickup/operations";

export type { OperationResult, AddCommentResult } from "@/lib/clickup/operations";

export {
  getWorkspace,
  getWorkspaces,
  getSpaces,
  getFolders,
  getLists,
  getFolderlessLists,
  getTasks,
  getAllTasks,
  getTask,
  getMembers,
  getWorkspaceHierarchy,
} from "@/lib/clickup/queries";

export type {
  QueryResult,
  PaginatedTasks,
  TaskQueryOptions,
  WorkspaceHierarchy,
} from "@/lib/clickup/queries";
