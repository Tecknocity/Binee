import Anthropic from '@anthropic-ai/sdk';
import { executeTool } from '@/lib/ai/tool-executor';
import { getToolsForSubAgent } from '@/lib/ai/tools-v2';
import { TASK_MANAGER_PROMPT, TASK_MANAGER_TOOLS_NAMES } from '@/lib/ai/prompts/task-manager-prompt';
import { WORKSPACE_ANALYST_PROMPT, WORKSPACE_ANALYST_TOOLS_NAMES } from '@/lib/ai/prompts/workspace-analyst-prompt';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const MAX_SUB_AGENT_ROUNDS = 3; // Safety limit for tool loops
const MAX_SUMMARY_TOKENS = 500; // Hard cap on sub-agent output

type SubAgentName = 'task_manager' | 'workspace_analyst';

export interface SubAgentResult {
  agent: SubAgentName;
  summary: string;
  toolCalls: string[];
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

const AGENT_CONFIGS: Record<SubAgentName, { prompt: string; toolNames: readonly string[] }> = {
  task_manager: { prompt: TASK_MANAGER_PROMPT, toolNames: TASK_MANAGER_TOOLS_NAMES },
  workspace_analyst: { prompt: WORKSPACE_ANALYST_PROMPT, toolNames: WORKSPACE_ANALYST_TOOLS_NAMES },
};

/**
 * Execute a single sub-agent (Haiku).
 *
 * 1. Calls Haiku with the sub-agent's system prompt + tools + context from router
 * 2. Haiku calls tools as needed (up to MAX_SUB_AGENT_ROUNDS)
 * 3. After tools complete, Haiku generates a summary
 * 4. Summary is capped at MAX_SUMMARY_TOKENS
 *
 * Returns structured result with the summary and usage stats.
 */
export async function executeSubAgent(
  client: Anthropic,
  agentName: SubAgentName,
  contextFromRouter: string,
  workspaceId: string,
): Promise<SubAgentResult> {
  const config = AGENT_CONFIGS[agentName];
  if (!config) {
    return {
      agent: agentName,
      summary: `Unknown sub-agent: ${agentName}`,
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
      error: `Unknown sub-agent: ${agentName}`,
    };
  }

  const tools = getToolsForSubAgent(agentName);
  const toolCallNames: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Build initial messages
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: contextFromRouter },
  ];

  try {
    let rounds = 0;

    while (rounds < MAX_SUB_AGENT_ROUNDS) {
      rounds++;

      const response = await client.messages.create({
        model: HAIKU_MODEL_ID,
        max_tokens: MAX_SUMMARY_TOKENS,
        system: config.prompt,
        tools,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Check if we need to handle tool calls
      if (response.stop_reason === 'tool_use') {
        // Add assistant response to messages
        messages.push({ role: 'assistant', content: response.content });

        // Execute each tool call
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            toolCallNames.push(block.name);

            try {
              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>,
                workspaceId,
              );
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            } catch (toolError) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Tool error: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`,
                is_error: true,
              });
            }
          }
        }

        // Add tool results back to conversation
        messages.push({ role: 'user', content: toolResults });
      } else {
        // stop_reason === 'end_turn' or 'max_tokens' — extract text summary
        const textBlocks = response.content.filter(
          (b): b is Anthropic.TextBlock => b.type === 'text',
        );
        const summary = textBlocks.map(b => b.text).join('\n').trim();

        return {
          agent: agentName,
          summary: summary || 'No summary generated.',
          toolCalls: toolCallNames,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
      }
    }

    // Hit max rounds — return what we have
    return {
      agent: agentName,
      summary: 'Sub-agent reached maximum tool rounds without completing.',
      toolCalls: toolCallNames,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      error: 'Max rounds exceeded',
    };
  } catch (error) {
    return {
      agent: agentName,
      summary: `Sub-agent error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      toolCalls: toolCallNames,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute multiple sub-agents in parallel.
 */
export async function executeSubAgents(
  client: Anthropic,
  agents: Array<{ agent: SubAgentName; contextFromRouter: string }>,
  workspaceId: string,
): Promise<SubAgentResult[]> {
  return Promise.all(
    agents.map(({ agent, contextFromRouter }) =>
      executeSubAgent(client, agent, contextFromRouter, workspaceId)
    )
  );
}
