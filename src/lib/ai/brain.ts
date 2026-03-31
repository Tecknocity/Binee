import Anthropic from '@anthropic-ai/sdk';
import { buildBrainPrompt } from '@/lib/ai/prompts/brain-prompt';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

interface BrainInput {
  userMessage: string;
  userContext: string;       // Tier 0 context: user name, workspace status, compact metrics
  conversationSummary: string; // Rolling summary from conversation-summary.ts
  conversationHistory: string; // Last 2 messages formatted
  subAgentSummaries: Array<{ agent: string; summary: string }>;
}

interface BrainResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Sonnet Brain — generates the final user-facing response.
 *
 * Receives the original user message + all sub-agent summaries.
 * This is the ONLY component that talks to the user.
 */
export async function generateBrainResponse(
  client: Anthropic,
  input: BrainInput,
): Promise<BrainResult> {
  const systemPrompt = buildBrainPrompt(input.userContext, input.conversationSummary);

  // Build the user message with sub-agent data
  let userContent = '';

  if (input.conversationHistory) {
    userContent += `Recent conversation:\n${input.conversationHistory}\n\n`;
  }

  if (input.subAgentSummaries.length > 0) {
    userContent += 'DATA FROM ANALYSIS:\n';
    for (const { agent, summary } of input.subAgentSummaries) {
      userContent += `\n[${agent.toUpperCase()}]:\n${summary}\n`;
    }
    userContent += '\n';
  }

  userContent += `User's message: ${input.userMessage}`;

  const response = await client.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const content = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  return {
    content: content || 'I wasn\'t able to generate a response. Please try again.',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
