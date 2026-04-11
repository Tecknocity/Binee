import Anthropic from '@anthropic-ai/sdk';
import { buildSetupperPrompt } from '@/lib/ai/prompts/setupper-prompt';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { loadUserMemories } from '@/lib/ai/user-memory';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

interface SetupperInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  conversationHistory: Anthropic.MessageParam[];
  /** Pre-computed analysis from the analyzer step — avoids redundant sub-agent call */
  precomputedAnalysis?: string;
  /** ClickUp plan tier for the workspace (e.g. 'free', 'business') */
  planTier?: string;
  /** The currently proposed workspace plan (if one has been generated) */
  proposedPlan?: {
    spaces: Array<{
      name: string;
      folders: Array<{
        name: string;
        lists: Array<{
          name: string;
          statuses: Array<{ name: string }>;
        }>;
      }>;
    }>;
    reasoning?: string;
    clickApps?: string[];
  };
  /** User's profile form data (if already collected) */
  profileData?: {
    industry?: string;
    workStyle?: string;
    services?: string;
    teamSize?: string;
  };
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
 * Single Sonnet call with all context in the system prompt. No tools needed -
 * the workspace analysis is pre-computed, the profile data comes from the form,
 * and conversation history provides continuity.
 *
 * This keeps the setup chat fast (~5-15s per message) while maintaining
 * full context awareness.
 */
export async function handleSetupMessage(input: SetupperInput): Promise<SetupperResult> {
  const anthropic = getClient();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Step 1: Use pre-computed analysis from the analyzer step if available.
  // Only run a fresh sub-agent call if no analysis was provided (edge case).
  let workspaceAnalysis = input.precomputedAnalysis || '';
  if (!workspaceAnalysis && input.conversationHistory.length === 0) {
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
      workspaceAnalysis = 'Unable to analyze workspace. It may be empty or not connected.';
    }
  }

  // Step 2: Build system prompt with all context
  const userMemories = await loadUserMemories(input.userId, input.workspaceId);

  // Templates are NOT loaded for chat - they're only used during plan generation
  // (generate-plan route). The system prompt already has COMMON INDUSTRY PATTERNS
  // for the discovery conversation. This keeps the prompt lean and fast.
  let systemPrompt = buildSetupperPrompt(workspaceAnalysis, '', input.planTier, input.profileData);
  if (userMemories) systemPrompt += `\n\n${userMemories}`;

  // Include the proposed plan so the AI knows exactly what structure was generated
  if (input.proposedPlan?.spaces?.length) {
    const planSummary = input.proposedPlan.spaces.map(s => {
      const directLists = (s as Record<string, unknown>).lists as Array<{ name: string; statuses: Array<{ name: string }> }> | undefined;
      const directListsStr = directLists?.map(l =>
        `  List: ${l.name} (statuses: ${l.statuses.map(st => st.name).join(', ')})`
      ).join('\n') || '';
      const foldersStr = s.folders.map(f =>
        `  Folder: ${f.name}\n${f.lists.map(l =>
          `    List: ${l.name} (statuses: ${l.statuses.map(st => st.name).join(', ')})`
        ).join('\n')}`
      ).join('\n');
      return `Space: ${s.name}\n${directListsStr}${directListsStr && foldersStr ? '\n' : ''}${foldersStr}`;
    }).join('\n');
    systemPrompt += `\n\nPREVIOUSLY GENERATED WORKSPACE PLAN (the user has already seen this structure):\n${planSummary}${input.proposedPlan.reasoning ? `\nReasoning: ${input.proposedPlan.reasoning}` : ''}${input.proposedPlan.clickApps?.length ? `\nRecommended ClickApps: ${input.proposedPlan.clickApps.join(', ')}` : ''}\n\nIMPORTANT: The user is coming back from reviewing this plan. Reference THIS specific structure when they ask about changes. Do NOT generate a new structure from scratch or claim you don't know what was proposed.`;
  }

  // Step 3: Single Sonnet call - no tools, no loop
  // The system prompt already contains the workspace analysis, templates,
  // profile data, user memories, and proposed plan. Conversation history
  // provides continuity. No need for tools to re-fetch this data.
  const messages: Anthropic.MessageParam[] = input.conversationHistory.length > 0
    ? [
        ...input.conversationHistory.slice(0, -1),
        { role: 'user' as const, content: input.userMessage },
      ]
    : [{ role: 'user' as const, content: input.userMessage }];

  const response = await anthropic.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  const finalContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  // Step 4: Calculate costs
  const anthropicCost = calculateAnthropicCost({
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    model: 'sonnet',
  });

  const classification = classifyMessageCost({
    subAgentCalls: 0,
    toolCallCount: 0,
    imageCount: 0,
    fileCount: 0,
    hasWriteOps: false,
    isSetup: true,
  });

  return {
    content: finalContent || 'I wasn\'t able to generate a response. Please try again.',
    creditsToCharge: classification.creditsToCharge,
    totalInputTokens,
    totalOutputTokens,
    anthropicCostCents: anthropicCost.totalCostCents,
    toolCalls: [],
  };
}
