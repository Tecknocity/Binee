// AI Engine — public API
export { handleChat } from '@/lib/ai/chat-handler';
export type { ChatHandlerResponse } from '@/lib/ai/chat-handler';
export { buildContext, buildBusinessStateDocument, buildWorkspaceSummary, buildRecentActivity } from '@/lib/ai/context';
export { BINEE_TOOLS, CLICKUP_TOOL_REGISTRY, SUB_AGENT_TOOLS, DIRECT_TOOLS, ALL_TOOLS } from '@/lib/ai/tools';
export { executeTool } from '@/lib/ai/tool-executor';
export {
  isWriteOperation,
  isBlockedOperation,
  isReadOnlyOperation,
  createPendingAction,
  resolvePendingAction,
  describeAction,
  getOperationTrustTier,
  isEligibleForAlwaysAllow,
} from '@/lib/ai/confirmation';
export type { TrustTier } from '@/lib/ai/confirmation';
export {
  getActionPreferences,
  getActionPreference,
  setActionPreference,
  resetActionPreferences,
  shouldAutoApprove,
} from '@/lib/ai/action-preferences';
export type { ActionPreference } from '@/lib/ai/action-preferences';
export { MASTER_AGENT_PROMPT } from '@/lib/ai/prompts/master-agent';
export {
  TASK_MANAGER_PROMPT,
  WORKSPACE_ANALYST_PROMPT,
  SETUPPER_PROMPT,
  DASHBOARD_BUILDER_PROMPT,
} from '@/lib/ai/prompts/sub-agents';
export { executeSubAgent } from '@/lib/ai/sub-agent-executor';
