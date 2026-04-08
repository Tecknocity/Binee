import Anthropic from '@anthropic-ai/sdk';
import { buildSetupperPrompt } from '@/lib/ai/prompts/setupper-prompt';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { BINEE_TOOLS } from '@/lib/ai/tools';
import { executeTool } from '@/lib/ai/tool-executor';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { loadUserMemories } from '@/lib/ai/user-memory';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 5;

interface SetupperInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  conversationHistory: Anthropic.MessageParam[];
  templates: string;
  /** Pre-computed analysis from the analyzer step — avoids redundant sub-agent call */
  precomputedAnalysis?: string;
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

  // Step 1: Use pre-computed analysis from the analyzer step if available.
  // Only run a fresh sub-agent call if no analysis was provided (e.g. direct API call).
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

  // Step 2: Build system prompt with analysis + templates + user memories + cross-chat context
  const userMemories = await loadUserMemories(input.userId, input.workspaceId);

  // Load summaries from other conversations for cross-chat awareness
  const { createClient } = await import('@supabase/supabase-js');
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: otherConvos } = await adminClient
    .from('conversations')
    .select('summary, context_type')
    .eq('workspace_id', input.workspaceId)
    .neq('id', input.conversationId)
    .not('summary', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  const crossChatLines = (otherConvos ?? [])
    .filter(c => c.summary && (c.summary as string).trim().length > 0)
    .map(c => {
      const label = c.context_type === 'setup' ? 'Setup session' : 'Previous chat';
      return `[${label}]: ${(c.summary as string).slice(0, 200)}`;
    });

  let systemPrompt = buildSetupperPrompt(workspaceAnalysis, input.templates);
  if (userMemories) systemPrompt += `\n\n${userMemories}`;
  if (crossChatLines.length > 0) {
    systemPrompt += `\n\nCONTEXT FROM OTHER CONVERSATIONS:\nThe user has had other recent interactions. Use for continuity, but do not reference unless relevant:\n${crossChatLines.join('\n')}`;
  }

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

  // Include profile data so the AI doesn't re-ask for already collected info
  if (input.profileData) {
    const { industry, workStyle, services, teamSize } = input.profileData;
    const parts = [
      industry && `Industry: ${industry}`,
      workStyle && `Work style: ${workStyle}`,
      services && `Services/Products: ${services}`,
      teamSize && `Team size: ${teamSize}`,
    ].filter(Boolean);
    if (parts.length > 0) {
      systemPrompt += `\n\nUSER PROFILE (already collected, do NOT re-ask for this information):\n${parts.join('\n')}`;
    }
  }

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
