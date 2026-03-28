// src/lib/ai/sub-agent-executor.ts

import Anthropic from '@anthropic-ai/sdk';
import {
  TASK_MANAGER_PROMPT,
  WORKSPACE_ANALYST_PROMPT,
  SETUPPER_PROMPT,
  DASHBOARD_BUILDER_PROMPT,
} from './prompts/sub-agents';
import { executeTool } from './tool-executor';
import { CLICKUP_TOOL_REGISTRY } from './tools';
import type { BineeContext } from '@/types/ai';

const MAX_SUB_AGENT_ROUNDS = 5;

// Sub-agent configurations
const SUB_AGENT_CONFIG = {
  task_manager: {
    prompt: TASK_MANAGER_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'lookup_tasks',
      'get_overdue_tasks',
      'get_weekly_summary',
      'get_time_tracking_summary',
      'update_task',
      'create_task',
      'assign_task',
      'move_task',
    ],
  },
  workspace_analyst: {
    prompt: WORKSPACE_ANALYST_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'get_workspace_summary',
      'get_workspace_health',
      'get_team_activity',
      'get_weekly_summary',
      'lookup_tasks',
    ],
  },
  setupper: {
    prompt: SETUPPER_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'get_workspace_summary',
    ],
  },
  dashboard_builder: {
    prompt: DASHBOARD_BUILDER_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'create_dashboard_widget',
      'update_dashboard_widget',
      'delete_dashboard_widget',
      'list_dashboards',
      'list_dashboard_widgets',
    ],
  },
} as const;

type SubAgentName = keyof typeof SUB_AGENT_CONFIG;

/**
 * Execute a sub-agent with its own system prompt, tools, and tool loop.
 * Returns the sub-agent's final text response.
 */
export async function executeSubAgent(
  client: Anthropic,
  agentName: SubAgentName,
  userRequest: string,
  context: BineeContext,
  workspaceId: string,
): Promise<{
  content: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result: Record<string, unknown> }>;
  tokensInput: number;
  tokensOutput: number;
}> {
  const config = SUB_AGENT_CONFIG[agentName];

  // Build sub-agent system prompt with context
  const systemPrompt = buildSubAgentSystem(config.prompt, context);

  // Get the tool definitions for this sub-agent
  const tools = getToolsForSubAgent(config.tools);

  // Sub-agent messages start with the user's request
  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userRequest },
  ];

  const allToolCalls: Array<{ name: string; input: Record<string, unknown>; result: Record<string, unknown> }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Sub-agent tool loop
  for (let round = 0; round < MAX_SUB_AGENT_ROUNDS; round++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tools: tools as Anthropic.Tool[],
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // If no tool use, return the text response
    if (response.stop_reason === 'end_turn' || !response.content.some(b => b.type === 'tool_use')) {
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');

      return {
        content: textContent,
        toolCalls: allToolCalls,
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
      };
    }

    // Process tool calls
    const assistantMessage: Anthropic.MessageParam = { role: 'assistant', content: response.content };
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        // Execute the tool via existing tool-executor
        const result = await executeTool(block.name, block.input as Record<string, unknown>, workspaceId);
        allToolCalls.push({ name: block.name, input: block.input as Record<string, unknown>, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages = [
      ...messages,
      assistantMessage,
      { role: 'user', content: toolResults },
    ];
  }

  // If we hit max rounds, return whatever we have
  return {
    content: 'I gathered the information but reached my processing limit. Here is what I found so far.',
    toolCalls: allToolCalls,
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
  };
}

function buildSubAgentSystem(basePrompt: string, context: BineeContext): string {
  // Inject workspace context into the sub-agent prompt
  const contextBlock = `

## WORKSPACE CONTEXT

User: ${context.user.display_name} (${context.user.role})
Workspace: ${context.workspace.name}
ClickUp connected: ${context.workspace.clickup_connected ? 'Yes' : 'No'}
${context.workspace.clickup_connected ? `Last sync: ${context.workspace.last_sync_at}` : ''}

${context.businessState ? `## CURRENT DATA\n${JSON.stringify(context.businessState, null, 2)}` : ''}
`;

  return basePrompt + contextBlock;
}

function getToolsForSubAgent(toolNames: readonly string[]): Anthropic.Tool[] {
  return CLICKUP_TOOL_REGISTRY.filter((t: Anthropic.Tool) => toolNames.includes(t.name));
}
