import type { BineeContext } from '@/types/ai';
import type { TaskType } from '@/types/ai';
import { getModule, buildKnowledgeContext } from '@/lib/ai/knowledge-base';
import { knowledgeCache } from '@/lib/ai/knowledge-cache';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The KB module_key that stores Binee's full system prompt (identity, rules, etc.) */
const AI_CHAT_MODULE_KEY = 'ai-chat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemPromptOptions {
  /** The classified task type for knowledge-base routing */
  taskType: TaskType;
  /** Optional dashboard context for dashboard-mode prompts */
  dashboardContext?: { dashboardId: string; dashboardName: string };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and assemble the full system prompt from the knowledge base.
 *
 * Assembly order:
 *   1. Base identity & rules from KB module `ai-chat`
 *   2. Business state injection (user, workspace, connection status)
 *   3. Computed data injection (workspace summary, recent activity)
 *   4. Knowledge context (task-specific + shared KB modules)
 *   5. Conversation-awareness note
 *
 * If the `ai-chat` KB module is unavailable (e.g. first deploy before seeding),
 * falls back to a minimal hardcoded identity so the app never crashes.
 */
export async function loadSystemPrompt(
  context: BineeContext,
  options: SystemPromptOptions,
): Promise<string> {
  // For general_chat: lightweight prompt — just personality, no business state,
  // no KB modules, no computed data. Saves ~2,500 tokens per message.
  if (options.taskType === 'general_chat') {
    return buildLightweightPrompt(context);
  }

  const [baseIdentity, knowledgeContext] = await Promise.all([
    loadBaseIdentity(),
    buildKnowledgeContext(options.taskType),
  ]);

  const parts: string[] = [];

  // 1. Base identity & behavioral rules from KB
  parts.push(baseIdentity);

  // 2. Business state — user, workspace, connection status
  parts.push(buildBusinessState(context));

  // 3. Computed data — workspace summary, recent activity, available actions
  parts.push(buildComputedData(context, options.dashboardContext));

  // 4. Knowledge context from KB (task-specific + shared modules)
  if (knowledgeContext) {
    parts.push(`## KNOWLEDGE CONTEXT\n${knowledgeContext}`);
  }

  // 5. Conversation awareness
  parts.push(buildConversationNote(context));

  return parts.filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Lightweight prompt for general_chat — no business state, no KB
// ---------------------------------------------------------------------------

function buildLightweightPrompt(context: BineeContext): string {
  const { user } = context;
  const historyLen = context.conversationHistory.length;
  const historyNote = historyLen > 0
    ? `\n\nThis conversation has ${historyLen} prior message(s). Maintain continuity.`
    : '';

  return `You are Binee, a smart and friendly AI business consultant built by Tecknocity. You help professionals with general questions, brainstorming, advice, and everyday conversation.

You are speaking with ${user.display_name}.

## Guidelines
- Be concise, helpful, and personable.
- Answer any question the user asks — business, general knowledge, casual chat, anything.
- If the user asks about their ClickUp workspace, tasks, team, or project data, let them know you can help with that — just ask them to phrase it so you can look up their workspace data.
- Never fabricate data. If you don't know something, say so.
- Use bullet points and short paragraphs. Avoid filler.${historyNote}`;
}

// ---------------------------------------------------------------------------
// Internal: load base identity from KB
// ---------------------------------------------------------------------------

/**
 * Fetch the `ai-chat` module from the knowledge base.
 * This module contains:
 *   - Role Definition
 *   - Critical Behavioral Rules (7 rules)
 *   - Intent Classification categories
 *   - Conversation Flow Patterns
 *   - Response Formatting guidelines
 *   - Module Routing Table
 *   - Escalation Rules
 *   - Tone and Personality
 *   - Client Profile Tracking schema
 *
 * Returns content string or a minimal fallback if unavailable.
 */
async function loadBaseIdentity(): Promise<string> {
  try {
    const mod = await getModule(AI_CHAT_MODULE_KEY);

    if (mod?.content) {
      return mod.content;
    }

    console.warn(
      `[system-prompt] KB module "${AI_CHAT_MODULE_KEY}" not found or empty — using fallback`,
    );
    return FALLBACK_IDENTITY;
  } catch (err) {
    console.error('[system-prompt] Failed to load base identity from KB:', err);
    return FALLBACK_IDENTITY;
  }
}

// ---------------------------------------------------------------------------
// Internal: build business state injection
// ---------------------------------------------------------------------------

function buildBusinessState(context: BineeContext): string {
  const { user, workspace } = context;

  const syncFreshness = workspace.last_sync_at
    ? `Last data sync: ${workspace.last_sync_at}`
    : 'No data has been synced yet.';

  const clickUpConnected = workspace.clickup_connected;

  return `## BUSINESS STATE

### Current User
- Name: ${user.display_name}
- Role: ${user.role}
- Email: ${user.email}

### Workspace
- Name: ${workspace.name}
- ClickUp Connected: ${clickUpConnected ? 'Yes' : 'No'}
- ClickUp Plan: ${workspace.clickup_plan_tier ?? 'Unknown'}
- Credit Balance: ${workspace.credit_balance}
- Data Freshness: ${syncFreshness}

### ClickUp Connection Status
${
  clickUpConnected
    ? 'ClickUp is connected. You may use all workspace tools.'
    : `**ClickUp is NOT connected.** You MUST NOT use any ClickUp-related tools (lookup_tasks, update_task, create_task, get_workspace_health, get_time_tracking_summary, create_dashboard_widget). If the user asks about their tasks, workspace, team members, time tracking, or anything that requires ClickUp data, respond with: "I don't have access to your ClickUp workspace. Please connect your ClickUp account in Settings so I can help you with that." You CAN still have general conversations, answer questions, brainstorm, and help with non-ClickUp topics.`
}`;
}

// ---------------------------------------------------------------------------
// Internal: build computed data injection
// ---------------------------------------------------------------------------

function buildComputedData(
  context: BineeContext,
  dashboardContext?: { dashboardId: string; dashboardName: string },
): string {
  const { workspace, businessState } = context;
  const clickUpConnected = workspace.clickup_connected;

  const parts: string[] = [];

  parts.push('## COMPUTED DATA');

  // Business State Document (structured JSON for LLM context — B-041)
  // This is the single source of workspace state — it contains task counts,
  // status breakdowns, member data, and recent activity in structured form.
  if (businessState && businessState.tasks.total > 0) {
    parts.push(
      `### Business State Document\n\`\`\`json\n${JSON.stringify(businessState, null, 0)}\n\`\`\``,
    );
  }

  // Available actions (tool list)
  parts.push(`### Available Actions\n${buildAvailableActions(clickUpConnected)}`);

  // Dashboard context (optional)
  if (dashboardContext) {
    parts.push(
      `### Current Dashboard Context\nYou are helping the user build and customize the dashboard "${dashboardContext.dashboardName}" (ID: ${dashboardContext.dashboardId}). Focus on adding, modifying, and arranging widgets for this specific dashboard. Use list_dashboard_widgets to see what already exists on this dashboard before making changes.`,
    );
  }

  return parts.join('\n\n');
}

function buildAvailableActions(clickUpConnected: boolean): string {
  if (!clickUpConnected) {
    return 'No workspace tools are available because ClickUp is not connected. You can still chat normally about general topics.';
  }

  return `You can use the following tools to help the user:
- lookup_tasks: Search and filter tasks
- update_task: Modify task status, assignee, due date, or priority
- create_task: Create a new task in a list
- get_workspace_health: Run a health diagnostic
- get_time_tracking_summary: Retrieve time tracking data
- create_dashboard_widget: Create a dashboard widget from a natural language description (bar chart, line chart, summary card, or table)
- update_dashboard_widget: Update an existing widget's title, type, or configuration
- delete_dashboard_widget: Remove a widget from a dashboard
- list_dashboards: List all dashboards in the workspace
- list_dashboard_widgets: List all widgets on a specific dashboard

Only use tools when necessary to answer the user's question or fulfill their request.`;
}

// ---------------------------------------------------------------------------
// Internal: conversation awareness note
// ---------------------------------------------------------------------------

function buildConversationNote(context: BineeContext): string {
  const historyLen = context.conversationHistory.length;
  if (historyLen === 0) return '';

  return `## CONVERSATION CONTEXT
This conversation has ${historyLen} prior message(s). Maintain continuity — reference earlier context when relevant and avoid repeating information already discussed.`;
}

// ---------------------------------------------------------------------------
// Fallback identity — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_IDENTITY = `You are Binee, an AI workspace intelligence assistant built by Tecknocity. You help teams understand, manage, and optimize their ClickUp workspaces through natural conversation. You can also have general conversations when the user wants to chat.

## ABSOLUTE RULES — NEVER VIOLATE THESE
1. **NEVER fabricate, invent, or hallucinate data.** If you do not have data to answer a question, you MUST say: "I don't have that data. I cannot answer that question." Never fill in gaps, guess numbers, or make up information.
2. **NEVER generate fake task names, member names, dates, metrics, or statistics.** Only reference information explicitly available in the workspace context or retrieved via tools.
3. When citing numbers (task counts, hours, etc.), always mention data freshness.
4. Before performing any write action (create, update, delete), clearly state what you intend to do and ask for confirmation unless the user's request is explicit and unambiguous.
5. Be concise. Prefer bullet points and short paragraphs. Avoid filler.
6. Reference specific workspace elements (list names, member names, task names) when available — but ONLY if they come from actual data.
7. When you lack information to answer, say so honestly and suggest what the user could do.
8. If a tool returns an error or empty result, report that honestly. Do not fabricate an alternative answer.`;
