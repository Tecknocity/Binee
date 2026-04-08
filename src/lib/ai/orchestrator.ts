import Anthropic from '@anthropic-ai/sdk';
import { routeMessage, type RouteDecision } from '@/lib/ai/slim-router';
import { executeSubAgents, type SubAgentResult } from '@/lib/ai/sub-agents/executor';
import { generateBrainResponse } from '@/lib/ai/brain';
import { classifyMessageCost, type MessageClassification } from '@/billing/engine/flat-credit-classifier';
import { calculateAnthropicCost, type TokenCostResult } from '@/billing/engine/token-converter';
import { loadUserMemories } from '@/lib/ai/user-memory';

export interface OrchestrationInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  // Context (built by context.ts before calling orchestrator)
  workspaceStructure: string;  // For router: space/folder/list names
  userContext: string;          // For brain: Tier 0 compact context
  conversationSummary: string;  // Rolling summary
  conversationHistory: string;  // Last 2 messages formatted
  recentMessages: string;       // Last 2 messages for router context
  crossChatContext: string;     // Summaries from other conversations in workspace
}

export interface OrchestrationResult {
  content: string;
  creditClassification: MessageClassification;
  totalInputTokens: number;
  totalOutputTokens: number;
  anthropicCost: TokenCostResult;
  routeDecision: RouteDecision;
  subAgentResults: SubAgentResult[];
  modelUsed: string;
}

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Main orchestration pipeline.
 *
 * 1. Slim Sonnet Router decides what sub-agents to call
 * 2. Haiku sub-agents fetch and summarize data (in parallel)
 * 3. Sonnet Brain generates final response with all summaries
 * 4. Flat credit classifier determines charge
 *
 * Returns everything needed for billing, analytics, and the user response.
 */
export async function orchestrate(input: OrchestrationInput): Promise<OrchestrationResult> {
  const client = getClient();

  // ---- Step 1: Route ----
  const routeDecision = await routeMessage(
    client,
    input.userMessage,
    input.workspaceStructure,
    input.recentMessages,
  );

  // ---- Step 2: Execute sub-agents (if needed) ----
  let subAgentResults: SubAgentResult[] = [];

  if (routeDecision.route !== 'direct' && routeDecision.agents.length > 0) {
    subAgentResults = await executeSubAgents(
      client,
      routeDecision.agents.map(a => ({
        agent: a.agent,
        contextFromRouter: a.context_for_agent,
      })),
      input.workspaceId,
    );
  }

  // ---- Step 3: Brain generates final response ----
  // Load user memories in parallel with sub-agents (or here if no sub-agents)
  const userMemories = await loadUserMemories(input.userId, input.workspaceId);

  const brainResult = await generateBrainResponse(client, {
    userMessage: input.userMessage,
    userContext: input.userContext,
    conversationSummary: input.conversationSummary,
    conversationHistory: input.conversationHistory,
    crossChatContext: input.crossChatContext || '',
    subAgentSummaries: subAgentResults.map(r => ({
      agent: r.agent,
      summary: r.summary,
    })),
    userMemories: userMemories || undefined,
  });

  // ---- Step 4: Classify credit tier ----
  const creditClassification = classifyMessageCost(
    subAgentResults.length,
    false, // isSetup — regular chat is never setup. Setup has its own brain.
  );

  // ---- Step 5: Calculate total token usage (for analytics) ----
  const totalInputTokens =
    routeDecision.inputTokens +
    subAgentResults.reduce((sum, r) => sum + r.inputTokens, 0) +
    brainResult.inputTokens;

  const totalOutputTokens =
    routeDecision.outputTokens +
    subAgentResults.reduce((sum, r) => sum + r.outputTokens, 0) +
    brainResult.outputTokens;

  // Weight the cost calculation — router and brain are Sonnet, sub-agents are Haiku
  // For simplicity, calculate each separately and sum
  const routerCost = calculateAnthropicCost({
    input_tokens: routeDecision.inputTokens,
    output_tokens: routeDecision.outputTokens,
    model: 'sonnet',
  });

  const subAgentCost = subAgentResults.reduce(
    (acc, r) => {
      const cost = calculateAnthropicCost({
        input_tokens: r.inputTokens,
        output_tokens: r.outputTokens,
        model: 'haiku',
      });
      return {
        inputCostCents: acc.inputCostCents + cost.inputCostCents,
        outputCostCents: acc.outputCostCents + cost.outputCostCents,
        totalCostCents: acc.totalCostCents + cost.totalCostCents,
      };
    },
    { inputCostCents: 0, outputCostCents: 0, totalCostCents: 0 },
  );

  const brainCost = calculateAnthropicCost({
    input_tokens: brainResult.inputTokens,
    output_tokens: brainResult.outputTokens,
    model: 'sonnet',
  });

  const anthropicCost: TokenCostResult = {
    inputCostCents: routerCost.inputCostCents + subAgentCost.inputCostCents + brainCost.inputCostCents,
    outputCostCents: routerCost.outputCostCents + subAgentCost.outputCostCents + brainCost.outputCostCents,
    totalCostCents: routerCost.totalCostCents + subAgentCost.totalCostCents + brainCost.totalCostCents,
  };

  return {
    content: brainResult.content,
    creditClassification,
    totalInputTokens,
    totalOutputTokens,
    anthropicCost,
    routeDecision,
    subAgentResults,
    modelUsed: 'claude-sonnet-4-20250514',
  };
}
