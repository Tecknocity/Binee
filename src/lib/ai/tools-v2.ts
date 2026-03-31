import type Anthropic from '@anthropic-ai/sdk';
import { BINEE_TOOLS } from '@/lib/ai/tools';
import { TASK_MANAGER_TOOLS_NAMES } from '@/lib/ai/prompts/task-manager-prompt';
import { WORKSPACE_ANALYST_TOOLS_NAMES } from '@/lib/ai/prompts/workspace-analyst-prompt';

type SubAgentName = 'task_manager' | 'workspace_analyst';

const SUB_AGENT_TOOL_MAP: Record<SubAgentName, readonly string[]> = {
  task_manager: TASK_MANAGER_TOOLS_NAMES,
  workspace_analyst: WORKSPACE_ANALYST_TOOLS_NAMES,
};

/**
 * Get Anthropic tool definitions filtered for a specific sub-agent.
 * Reuses existing BINEE_TOOLS definitions but only includes tools
 * the sub-agent is allowed to use.
 */
export function getToolsForSubAgent(agentName: SubAgentName): Anthropic.Tool[] {
  const allowedNames = SUB_AGENT_TOOL_MAP[agentName];
  if (!allowedNames) return [];

  return BINEE_TOOLS.filter(tool => (allowedNames as readonly string[]).includes(tool.name));
}

/**
 * Get all available tool names for analytics/logging.
 */
export function getSubAgentToolNames(agentName: SubAgentName): readonly string[] {
  return SUB_AGENT_TOOL_MAP[agentName] || [];
}
