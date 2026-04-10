import Anthropic from '@anthropic-ai/sdk';
import { buildBrainPrompt } from '@/lib/ai/prompts/brain-prompt';
import type { ImageAttachmentPayload } from '@/types/ai';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

interface BrainInput {
  userMessage: string;
  userContext: string;       // Tier 0 context: user name, workspace status, compact metrics
  conversationSummary: string; // Rolling summary from conversation-summary.ts
  conversationHistory: string; // Last 2 messages formatted
  crossChatContext: string;   // Summaries from other conversations in workspace
  subAgentSummaries: Array<{ agent: string; summary: string }>;
  userMemories?: string;     // Persistent facts from user_memories table
  imageAttachments?: ImageAttachmentPayload[];
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
  const systemPrompt = buildBrainPrompt(input.userContext, input.conversationSummary, input.userMemories, input.crossChatContext);

  // Build the user message with sub-agent data
  let textContent = '';

  if (input.conversationHistory) {
    textContent += `Recent conversation:\n${input.conversationHistory}\n\n`;
  }

  if (input.subAgentSummaries.length > 0) {
    textContent += 'DATA FROM ANALYSIS:\n';
    for (const { agent, summary } of input.subAgentSummaries) {
      textContent += `\n[${agent.toUpperCase()}]:\n${summary}\n`;
    }
    textContent += '\n';
  }

  textContent += `User's message: ${input.userMessage}`;

  // Build message content: text + optional images (Claude vision)
  const hasImages = input.imageAttachments && input.imageAttachments.length > 0;

  let messageContent: Anthropic.MessageCreateParams['messages'][0]['content'];

  if (hasImages) {
    // Multi-modal: include image blocks + text block
    const contentBlocks: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [];

    // Add images first so Claude can see them before reading the text
    for (const img of input.imageAttachments!) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.media_type,
          data: img.base64,
        },
      });
    }

    // Add image context note + the main text
    contentBlocks.push({
      type: 'text',
      text: `[The user attached ${input.imageAttachments!.length} image(s) above. Analyze them as part of your response.]\n\n${textContent}`,
    });

    messageContent = contentBlocks;
  } else {
    messageContent = textContent;
  }

  const response = await client.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: messageContent }],
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
