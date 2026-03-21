// AI Engine — public API
export { handleChatMessage } from '@/lib/ai/chat';
export { classifyMessage, getModelForTask } from '@/lib/ai/router';
export { buildSystemPrompt, buildSetupPrompt, buildHealthPrompt } from '@/lib/ai/prompts';
export { buildContext, buildWorkspaceSummary, buildRecentActivity } from '@/lib/ai/context';
export { BINEE_TOOLS } from '@/lib/ai/tools';
export { executeTool } from '@/lib/ai/tool-executor';
export {
  getModulesForTaskType,
  getModule,
  getModulesByPrefix,
  updateModule,
  generateSummary,
  buildKnowledgeContext,
} from '@/lib/ai/knowledge-base';
export { knowledgeCache } from '@/lib/ai/knowledge-cache';
