import type Anthropic from '@anthropic-ai/sdk';
import type { BineeContext, TaskType } from '@/types/ai';
import type { KBModule } from '@/lib/ai/types/knowledge';
import { getModulesForTaskType } from '@/lib/ai/knowledge-base';

// ---------------------------------------------------------------------------
// Token budget constants (~4 chars per token)
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;

/** Token allocations per prompt component */
const TOKEN_BUDGET = {
  /** Base system prompt (identity & rules from B-039/KB) */
  system: 600,
  /** Shared knowledge base summary (always included) */
  kbSummary: 500,
  /** Task-specific brain module(s) — varies by complexity */
  brainModulesMin: 2000,
  brainModulesMax: 4000,
  /** Business context from B-041 (user, workspace, state) */
  context: 1500,
  /** Conversation history */
  history: 2000,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssembledPrompt {
  /** System prompt string for the `system` parameter */
  system: string;
  /** Complete messages array for the `messages` parameter */
  messages: Anthropic.MessageParam[];
  /** Token usage breakdown for observability */
  tokenUsage: {
    system: number;
    kbSummary: number;
    brainModules: number;
    context: number;
    history: number;
    total: number;
  };
}

export interface AssemblePromptOptions {
  /** The current user message to append */
  currentMessage: string;
  /** Optional dashboard context for dashboard-mode prompts */
  dashboardContext?: { dashboardId: string; dashboardName: string };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a complete prompt with token-budgeted components.
 *
 * Combines:
 *   1. System prompt (identity & rules)
 *   2. Shared KB summary
 *   3. Task-specific brain module(s) from knowledge base
 *   4. Business context (workspace state, user info)
 *   5. Conversation history (trimmed/summarized to fit budget)
 *
 * Returns a ready-to-send system string + messages array for the Claude API.
 */
export async function assemblePrompt(
  systemPrompt: string,
  context: BineeContext,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  taskType: TaskType,
  options?: AssemblePromptOptions,
): Promise<AssembledPrompt> {
  // 1. Fetch brain modules from knowledge base
  const { taskModules, sharedModules } = await getModulesForTaskType(taskType);

  // 2. Build each section with token budgets
  const systemSection = truncateToTokenBudget(systemPrompt, TOKEN_BUDGET.system);
  const kbSummarySection = buildKBSummarySection(sharedModules, TOKEN_BUDGET.kbSummary);
  const brainModulesSection = buildBrainModulesSection(
    taskModules,
    TOKEN_BUDGET.brainModulesMax,
  );
  const contextSection = buildContextSection(
    context,
    options?.dashboardContext,
    TOKEN_BUDGET.context,
  );

  // 3. Calculate remaining budget for history after other sections
  const usedTokens =
    estimateTokens(systemSection) +
    estimateTokens(kbSummarySection) +
    estimateTokens(brainModulesSection) +
    estimateTokens(contextSection);

  const historyBudget = TOKEN_BUDGET.history;

  // 4. Fit conversation history within budget
  const fittedHistory = fitHistoryToTokenBudget(conversationHistory, historyBudget);

  // 5. Assemble the system prompt string
  const systemParts: string[] = [systemSection];

  if (kbSummarySection) {
    systemParts.push(kbSummarySection);
  }
  if (brainModulesSection) {
    systemParts.push(brainModulesSection);
  }
  if (contextSection) {
    systemParts.push(contextSection);
  }

  const assembledSystem = systemParts.filter(Boolean).join('\n\n');

  // 6. Build the messages array
  const messages: Anthropic.MessageParam[] = [
    ...fittedHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ];

  // Append current message if provided
  if (options?.currentMessage) {
    messages.push({ role: 'user' as const, content: options.currentMessage });
  }

  // 7. Calculate token usage for observability
  const tokenUsage = {
    system: estimateTokens(systemSection),
    kbSummary: estimateTokens(kbSummarySection),
    brainModules: estimateTokens(brainModulesSection),
    context: estimateTokens(contextSection),
    history: fittedHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0),
    total: 0,
  };
  tokenUsage.total =
    tokenUsage.system +
    tokenUsage.kbSummary +
    tokenUsage.brainModules +
    tokenUsage.context +
    tokenUsage.history;

  return { system: assembledSystem, messages, tokenUsage };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Build the shared knowledge base summary section.
 * Always included — provides foundational ClickUp knowledge.
 */
function buildKBSummarySection(sharedModules: KBModule[], budget: number): string {
  if (sharedModules.length === 0) return '';

  const combined = sharedModules
    .map((mod) => mod.content)
    .join('\n\n');

  const trimmed = truncateToTokenBudget(combined, budget);

  return `## CLICKUP KNOWLEDGE BASE\n${trimmed}`;
}

/**
 * Build the task-specific brain modules section.
 * Content comes entirely from the ai_knowledge_base table — never hardcoded.
 */
function buildBrainModulesSection(taskModules: KBModule[], budget: number): string {
  if (taskModules.length === 0) return '';

  const parts: string[] = [];
  let remainingBudget = budget;

  for (const mod of taskModules) {
    const header = mod.module_key.replace(/-/g, ' ').toUpperCase();
    const content = mod.content;
    const contentTokens = estimateTokens(content);

    if (contentTokens <= remainingBudget) {
      parts.push(`## ${header}\n${content}`);
      remainingBudget -= contentTokens + estimateTokens(header) + 5; // overhead for ## and newlines
    } else if (remainingBudget > 100) {
      // Partial fit — truncate this module
      const truncated = truncateToTokenBudget(content, remainingBudget - 10);
      parts.push(`## ${header}\n${truncated}`);
      remainingBudget = 0;
      break;
    }
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Build the business context section from B-041 context data.
 */
function buildContextSection(
  context: BineeContext,
  dashboardContext: { dashboardId: string; dashboardName: string } | undefined,
  budget: number,
): string {
  const { user, workspace, businessState, workspaceSummary, recentActivity } = context;

  const parts: string[] = [];

  // User & workspace info (compact — always fits)
  const syncFreshness = workspace.last_sync_at
    ? `Last sync: ${workspace.last_sync_at}`
    : 'No data synced yet.';

  parts.push(`## BUSINESS STATE

### Current User
- Name: ${user.display_name} | Role: ${user.role} | Email: ${user.email}

### Workspace
- ${workspace.name} | ClickUp: ${workspace.clickup_connected ? 'Connected' : 'Not connected'} | Plan: ${workspace.clickup_plan_tier ?? 'Unknown'} | Credits: ${workspace.credit_balance}
- ${syncFreshness}`);

  // Business state document (structured JSON)
  if (businessState && businessState.tasks.total > 0) {
    const stateJson = JSON.stringify(businessState, null, 0);
    const stateTokens = estimateTokens(stateJson);
    const headerTokens = estimateTokens('### Business State Document\n```json\n\n```');
    const currentTokens = parts.reduce((sum, p) => sum + estimateTokens(p), 0);

    if (currentTokens + stateTokens + headerTokens <= budget) {
      parts.push(`### Business State Document\n\`\`\`json\n${stateJson}\n\`\`\``);
    }
  }

  // Workspace summary
  if (workspaceSummary) {
    const currentTokens = parts.reduce((sum, p) => sum + estimateTokens(p), 0);
    const summaryTokens = estimateTokens(workspaceSummary);
    if (currentTokens + summaryTokens + 10 <= budget) {
      parts.push(`### Workspace Summary\n${workspaceSummary}`);
    }
  }

  // Recent activity
  if (recentActivity) {
    const currentTokens = parts.reduce((sum, p) => sum + estimateTokens(p), 0);
    const activityTokens = estimateTokens(recentActivity);
    if (currentTokens + activityTokens + 10 <= budget) {
      parts.push(`### Recent Activity (last 24h)\n${recentActivity}`);
    }
  }

  // B-065: Health snapshot data (populated for health_check task type)
  if (context.healthSnapshot) {
    const hs = context.healthSnapshot;
    const healthJson = JSON.stringify({
      health_score: hs.health_score,
      health_factors: hs.health_factors,
      active_issues: hs.active_issues,
      critical_count: hs.critical_count,
      warning_count: hs.warning_count,
    }, null, 0);

    const currentTokens = parts.reduce((sum, p) => sum + estimateTokens(p), 0);
    const healthTokens = estimateTokens(healthJson);
    if (currentTokens + healthTokens + 15 <= budget) {
      parts.push(`### Health Snapshot\n\`\`\`json\n${healthJson}\n\`\`\``);
    }
  }

  // Dashboard context
  if (dashboardContext) {
    parts.push(
      `### Current Dashboard\nDashboard: "${dashboardContext.dashboardName}" (ID: ${dashboardContext.dashboardId})`,
    );
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// History management
// ---------------------------------------------------------------------------

/**
 * Fit conversation history into the token budget.
 * Strategy:
 *   - Always keep the most recent messages
 *   - If history exceeds budget, summarize older messages into a single entry
 */
function fitHistoryToTokenBudget(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  budget: number,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (history.length === 0) return [];

  // Calculate total tokens for all history
  const totalTokens = history.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

  // If it fits, return as-is
  if (totalTokens <= budget) return history;

  // Strategy: keep recent messages, summarize older ones
  // Work backwards from most recent, accumulating until we hit the budget
  const recentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let recentTokens = 0;
  // Reserve tokens for the summary message
  const summaryReserve = 200;
  const recentBudget = budget - summaryReserve;

  for (let i = history.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(history[i].content);
    if (recentTokens + msgTokens > recentBudget && recentMessages.length > 0) {
      // Summarize everything from index 0..i
      const olderMessages = history.slice(0, i + 1);
      const summary = summarizeOlderMessages(olderMessages, summaryReserve);

      return [
        { role: 'user' as const, content: summary },
        ...recentMessages.reverse(),
      ];
    }
    recentTokens += msgTokens;
    recentMessages.push(history[i]);
  }

  // Everything fit after all (edge case with rounding)
  return recentMessages.reverse();
}

/**
 * Create a compressed summary of older conversation messages.
 * Extracts key topics and decisions to preserve conversational continuity.
 */
function summarizeOlderMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  tokenBudget: number,
): string {
  const charBudget = tokenBudget * CHARS_PER_TOKEN;

  // Extract key points from each message
  const keyPoints: string[] = [];
  for (const msg of messages) {
    const prefix = msg.role === 'user' ? 'User asked about' : 'Assistant discussed';
    // Take first sentence or first 100 chars of each message
    const firstSentence = msg.content.split(/[.!?]\s/)[0];
    const point = firstSentence.length > 100
      ? firstSentence.slice(0, 100) + '...'
      : firstSentence;
    keyPoints.push(`- ${prefix}: ${point}`);
  }

  const summary = `[Earlier conversation summary]\n${keyPoints.join('\n')}`;

  // Truncate to budget if needed
  if (summary.length > charBudget) {
    return summary.slice(0, charBudget - 3) + '...';
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

/**
 * Estimate token count: ~4 characters per token for English text.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to fit within a token budget.
 * Tries to cut at a sentence boundary for cleaner output.
 */
function truncateToTokenBudget(text: string, tokenBudget: number): string {
  const charBudget = tokenBudget * CHARS_PER_TOKEN;

  if (text.length <= charBudget) return text;

  const truncated = text.slice(0, charBudget);

  // Try to cut at sentence boundary
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);

  if (cutPoint > charBudget * 0.7) {
    return truncated.slice(0, cutPoint + 1);
  }

  return truncated + '...';
}
