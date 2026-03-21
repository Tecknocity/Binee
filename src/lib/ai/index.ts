// AI Engine — public API
export { handleChatMessage } from '@/lib/ai/chat';
export { handleChat } from '@/lib/ai/chat-handler';
export type { ChatHandlerResponse, OrchestrationMetadata } from '@/lib/ai/chat-handler';
export { classifyMessage } from '@/lib/ai/classifier';
export { getModelForTask, routeToModel } from '@/lib/ai/router';
export { buildSystemPrompt, buildSetupPrompt, buildHealthPrompt } from '@/lib/ai/prompts';
export { loadSystemPrompt } from '@/lib/ai/prompts/system-prompt';
export { loadChatPrompt } from '@/lib/ai/prompts/chat-prompt';
export { loadSetupPrompt } from '@/lib/ai/prompts/setup-prompt';
export { loadBriefingPrompt } from '@/lib/ai/prompts/briefing-prompt';
export { loadRuleCreationPrompt } from '@/lib/ai/prompts/rule-creation-prompt';
export { loadDashboardPrompt } from '@/lib/ai/prompts/dashboard-prompt';
export { loadActionPrompt } from '@/lib/ai/prompts/action-prompt';
export { buildContext, buildBusinessStateDocument, buildWorkspaceSummary, buildRecentActivity } from '@/lib/ai/context';
export { BINEE_TOOLS } from '@/lib/ai/tools';
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
export {
  getModulesForTaskType,
  getModule,
  getModulesByPrefix,
  updateModule,
  generateSummary,
  buildKnowledgeContext,
} from '@/lib/ai/knowledge-base';
export { knowledgeCache } from '@/lib/ai/knowledge-cache';
export { assemblePrompt } from '@/lib/ai/prompt-assembler';
export type { AssembledPrompt, AssemblePromptOptions } from '@/lib/ai/prompt-assembler';
export {
  validateResponse,
  buildFallbackResponse,
  applyHallucinationDisclaimer,
  checkForHallucinatedNumbers,
  extractNumbers,
  extractSourceNumbers,
  logValidationViolations,
} from '@/lib/ai/response-validator';
export type {
  ValidationResult,
  ValidationIssue,
  ValidationIssueType,
  HallucinationCheckResult,
} from '@/lib/ai/response-validator';
