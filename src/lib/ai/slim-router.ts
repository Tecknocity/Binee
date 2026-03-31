import Anthropic from '@anthropic-ai/sdk';
import { buildRouterPrompt } from '@/lib/ai/prompts/router-prompt';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

type SubAgentName = 'task_manager' | 'workspace_analyst';

export interface RouteDecision {
  route: 'direct' | 'single' | 'multi';
  agents: Array<{ agent: SubAgentName; context_for_agent: string }>;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Slim Sonnet Router.
 *
 * Runs with minimal context (~1,500 tokens) to decide routing.
 * Returns which sub-agents to call and what context to give them.
 *
 * For "direct" routes, no sub-agents are called — the brain answers alone.
 */
export async function routeMessage(
  client: Anthropic,
  userMessage: string,
  workspaceStructure: string,
  recentMessages: string,
): Promise<RouteDecision> {
  const systemPrompt = buildRouterPrompt(workspaceStructure);

  // Build user message with conversation context
  const fullUserMessage = recentMessages
    ? `Recent conversation:\n${recentMessages}\n\nCurrent message: ${userMessage}`
    : userMessage;

  try {
    const response = await client.messages.create({
      model: SONNET_MODEL_ID,
      max_tokens: 300, // Routing decisions are small
      system: systemPrompt,
      messages: [{ role: 'user', content: fullUserMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Parse JSON response
    const decision = JSON.parse(text);

    const agents: Array<{ agent: SubAgentName; context_for_agent: string }> = [];

    if (decision.route === 'single' && decision.agent) {
      agents.push({
        agent: decision.agent,
        context_for_agent: decision.context_for_agent || userMessage,
      });
    } else if (decision.route === 'multi' && Array.isArray(decision.agents)) {
      for (const a of decision.agents) {
        agents.push({
          agent: a.agent,
          context_for_agent: a.context_for_agent || userMessage,
        });
      }
    }

    return {
      route: decision.route || 'direct',
      agents,
      reasoning: decision.reasoning || '',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    // If routing fails, default to direct (brain handles it alone)
    console.error('[slim-router] Routing failed, defaulting to direct:', error);
    return {
      route: 'direct',
      agents: [],
      reasoning: 'Routing failed — defaulting to direct brain response',
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
