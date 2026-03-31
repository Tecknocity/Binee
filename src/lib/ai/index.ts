// AI Engine — public API

// Chat handling
export { handleChat } from '@/lib/ai/chat-handler';
export type { ChatHandlerResponse } from '@/lib/ai/chat-handler';

// Context
export { buildContext, buildBusinessStateDocument, buildWorkspaceSummary, buildRecentActivity, buildSlimContext } from '@/lib/ai/context';
export type { SlimContext } from '@/lib/ai/context';

// Tools
export { BINEE_TOOLS, CLICKUP_TOOL_REGISTRY, SUB_AGENT_TOOLS, DIRECT_TOOLS, ALL_TOOLS } from '@/lib/ai/tools';
export { executeTool } from '@/lib/ai/tool-executor';
export { getToolsForSubAgent, getSubAgentToolNames } from '@/lib/ai/tools-v2';

// Action confirmation
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

// Action preferences
export {
  getActionPreferences,
  getActionPreference,
  setActionPreference,
  resetActionPreferences,
  shouldAutoApprove,
} from '@/lib/ai/action-preferences';
export type { ActionPreference } from '@/lib/ai/action-preferences';

// Prompts
export { MASTER_AGENT_PROMPT } from '@/lib/ai/prompts/master-agent';
export {
  TASK_MANAGER_PROMPT,
  WORKSPACE_ANALYST_PROMPT,
  SETUPPER_PROMPT,
} from '@/lib/ai/prompts/sub-agents';
export { buildRouterPrompt } from '@/lib/ai/prompts/router-prompt';
export { buildBrainPrompt } from '@/lib/ai/prompts/brain-prompt';
export { TASK_MANAGER_TOOLS_NAMES } from '@/lib/ai/prompts/task-manager-prompt';
export { WORKSPACE_ANALYST_TOOLS_NAMES } from '@/lib/ai/prompts/workspace-analyst-prompt';

// New Router → Sub-Agent → Brain architecture
export { orchestrate } from '@/lib/ai/orchestrator';
export type { OrchestrationInput, OrchestrationResult } from '@/lib/ai/orchestrator';
export { routeMessage } from '@/lib/ai/slim-router';
export type { RouteDecision } from '@/lib/ai/slim-router';
export { generateBrainResponse } from '@/lib/ai/brain';
export { executeSubAgent } from '@/lib/ai/sub-agents/executor';
export { maybeSummarizeConversation } from '@/lib/ai/conversation-summary';
