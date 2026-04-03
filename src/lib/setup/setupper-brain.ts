import Anthropic from '@anthropic-ai/sdk';
import { buildSetupperPrompt } from '@/lib/ai/prompts/setupper-prompt';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { BINEE_TOOLS } from '@/lib/ai/tools';
import { executeTool } from '@/lib/ai/tool-executor';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 5;

interface SetupperInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  conversationHistory: Anthropic.MessageParam[];
  templates: string;
}

interface SetupperResult {
  content: string;
  creditsToCharge: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  anthropicCostCents: number;
  toolCalls: string[];
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Standalone Setupper Brain.
 *
 * Unlike the chat orchestrator, this is a SINGLE Sonnet brain with direct tool access.
 * It can call workspace-analyst sub-agent for initial analysis, then handles
 * the entire setup conversation directly.
 *
 * All messages are charged at 1.0 credits (complex tier).
 */
export async function handleSetupMessage(input: SetupperInput): Promise<SetupperResult> {
  const anthropic = getClient();
  const toolCallNames: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Step 1: If this is the first message, run workspace-analyst for initial scan
  let workspaceAnalysis = '';
  if (input.conversationHistory.length === 0) {
    try {
      const analysisResult = await executeSubAgent(
        anthropic,
        'workspace_analyst',
        'Provide a complete snapshot of the current workspace structure: all spaces, folders, lists, statuses, custom fields, and team members.',
        input.workspaceId,
      );
      workspaceAnalysis = analysisResult.summary;
      totalInputTokens += analysisResult.inputTokens;
      totalOutputTokens += analysisResult.outputTokens;
    } catch (error) {
      console.error('[setupper-brain] Workspace analysis failed:', error);
      workspaceAnalysis = 'Unable to analyze workspace — may be empty or not connected.';
    }
  }

  // Step 2: Build system prompt with analysis + templates
  const systemPrompt = buildSetupperPrompt(workspaceAnalysis, input.templates);

  // Step 3: Get read-only tools for the Setupper to gather workspace context.
  // Write operations (create spaces/folders/lists) are handled by the separate
  // executor engine after the user explicitly approves the plan — NOT by the brain.
  const setupToolNames = [
    'lookup_tasks', 'get_workspace_summary', 'get_workspace_health',
  ];
  const setupTools = BINEE_TOOLS.filter(t => setupToolNames.includes(t.name));

  // Step 4: Call Sonnet with tool loop
  const messages: Anthropic.MessageParam[] = [
    ...input.conversationHistory,
    { role: 'user', content: input.userMessage },
  ];

  let rounds = 0;
  let finalContent = '';

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await anthropic.messages.create({
      model: SONNET_MODEL_ID,
      max_tokens: 2048,
      system: systemPrompt,
      tools: setupTools.length > 0 ? setupTools : undefined,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolCallNames.push(block.name);
          try {
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              input.workspaceId,
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
              is_error: true,
            });
          }
        }
      }
      messages.push({ role: 'user', content: toolResults });
    } else {
      // Extract final text
      finalContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      break;
    }
  }

  // Step 5: Calculate costs (analytics only)
  const anthropicCost = calculateAnthropicCost({
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    model: 'sonnet',
  });

  // Step 6: All setup messages = 1.0 credits (complex)
  const classification = classifyMessageCost(0, true);

  return {
    content: finalContent || 'Setup session is processing. Please wait.',
    creditsToCharge: classification.creditsToCharge,
    totalInputTokens,
    totalOutputTokens,
    anthropicCostCents: anthropicCost.totalCostCents,
    toolCalls: toolCallNames,
  };
}
