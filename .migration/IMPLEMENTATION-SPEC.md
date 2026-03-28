# BINEE ARCHITECTURE MIGRATION — COMPLETE IMPLEMENTATION SPEC

This document is the single source of truth for migrating Binee from the current monolithic AI pipeline to the master agent + sub-agent architecture. Follow it file by file. Do not skip anything. Do not improvise.

---

## ARCHITECTURE OVERVIEW

**Before:** One big system prompt (~32K tokens from knowledge base) → classifier → router → prompt-assembler → Claude API call.

**After:** Lean master agent (~2.4K tokens, always Sonnet) → routes to sub-agents via Anthropic tool calls → sub-agents have their own focused system prompts.

**Key change:** The classifier, router, prompt-assembler, knowledge-base, and knowledge-cache files are eliminated. The master agent always runs on Sonnet. It reads tool descriptions to decide which sub-agent to invoke. Sub-agents are implemented as tools in the Anthropic API.

---

## DO NOT TOUCH — These files stay exactly as they are

| File | Why |
|------|-----|
| `src/lib/ai/tool-executor.ts` | All ClickUp API calls and Supabase queries stay identical |
| `src/lib/ai/confirmation.ts` | Write operation confirmation flow stays identical |
| `src/lib/ai/billing.ts` | Credit deduction logic stays identical |
| `src/lib/ai/context.ts` | Context building stays identical (but we'll call it differently) |
| `src/app/api/chat/route.ts` | HTTP endpoint stays identical |
| `src/app/api/chat/confirm/route.ts` | Confirmation endpoint stays identical |
| `src/app/api/chat/welcome/route.ts` | Welcome message stays identical |
| All `src/components/dashboard/widgets/*.tsx` | Widget rendering components stay identical |
| `src/components/dashboard/AddWidgetDialog.tsx` | Widget dialog stays identical |
| `src/components/dashboard/DashboardChatPanel.tsx` | Dashboard chat panel stays identical |
| `src/components/dashboard/DashboardPage.tsx` | Dashboard page stays identical |
| `src/components/dashboard/DashboardSelector.tsx` | Dashboard selector stays identical |
| `src/components/dashboard/WidgetGrid.tsx` | Widget grid stays identical |
| All Stripe/billing files | Payment logic untouched |
| All ClickUp sync/webhook files | Sync pipeline untouched |
| `src/types/ai.ts` | Types file updated minimally (see below) |

---

## PHASE 1: DELETE LEGACY FILES

Remove these files entirely. They are replaced by the new architecture:

```
DELETE: src/lib/ai/classifier.ts          (137 lines — keyword-based classification, replaced by master agent routing)
DELETE: src/lib/ai/router.ts              (98 lines — model routing table, replaced by master agent always using Sonnet)
DELETE: src/lib/ai/prompt-assembler.ts    (468 lines — token budgeting/assembly, replaced by sub-agent prompt loading)
DELETE: src/lib/ai/knowledge-base.ts      (219 lines — KB module fetching, replaced by hardcoded sub-agent prompts)
DELETE: src/lib/ai/knowledge-cache.ts     (61 lines — in-memory KB cache, no longer needed)
DELETE: src/lib/ai/response-validator.ts  (379 lines — hallucination guard, simplified inline)
DELETE: src/lib/ai/prompts/system-prompt.ts    (283 lines — old system prompt loader)
DELETE: src/lib/ai/prompts/chat-prompt.ts      (48 lines)
DELETE: src/lib/ai/prompts/action-prompt.ts    (44 lines)
DELETE: src/lib/ai/prompts/briefing-prompt.ts  (77 lines)
DELETE: src/lib/ai/prompts/setup-prompt.ts     (76 lines)
DELETE: src/lib/ai/prompts/dashboard-prompt.ts (50 lines)
DELETE: src/lib/ai/prompts/rule-creation-prompt.ts (46 lines)
```

Total removed: ~1,986 lines

---

## PHASE 2: CREATE NEW FILES

### File 1: `src/lib/ai/prompts/master-agent.ts`

This file exports the master agent system prompt as a string constant. Copy the content from `prompts/master-agent.md` verbatim.

```typescript
// src/lib/ai/prompts/master-agent.ts

export const MASTER_AGENT_PROMPT = `
<PASTE FULL CONTENT OF master-agent.md HERE>
`;
```

### File 2: `src/lib/ai/prompts/sub-agents.ts`

This file exports all four sub-agent system prompts as string constants.

```typescript
// src/lib/ai/prompts/sub-agents.ts

export const TASK_MANAGER_PROMPT = `
<PASTE FULL CONTENT OF task-manager.md HERE>
`;

export const WORKSPACE_ANALYST_PROMPT = `
<PASTE FULL CONTENT OF workspace-analyst.md HERE>
`;

export const SETUPPER_PROMPT = `
<PASTE FULL CONTENT OF setupper.md HERE>
`;

export const DASHBOARD_BUILDER_PROMPT = `
<PASTE FULL CONTENT OF dashboard-builder.md HERE>
`;
```

### File 3: `src/lib/ai/sub-agent-executor.ts`

This is the new sub-agent execution engine. When the master agent calls a sub-agent tool, this file handles spinning up the sub-agent with its own system prompt and tools, running the sub-agent's tool loop, and returning the result to the master.

```typescript
// src/lib/ai/sub-agent-executor.ts

import Anthropic from '@anthropic-ai/sdk';
import {
  TASK_MANAGER_PROMPT,
  WORKSPACE_ANALYST_PROMPT,
  SETUPPER_PROMPT,
  DASHBOARD_BUILDER_PROMPT,
} from './prompts/sub-agents';
import { executeTool } from './tool-executor';
import { BineeContext } from '@/types/ai';

const MAX_SUB_AGENT_ROUNDS = 5;

// Sub-agent configurations
const SUB_AGENT_CONFIG = {
  task_manager: {
    prompt: TASK_MANAGER_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'lookup_tasks',
      'get_overdue_tasks',
      'get_weekly_summary',
      'get_time_tracking_summary',
      'update_task',
      'create_task',
      'assign_task',
      'move_task',
    ],
  },
  workspace_analyst: {
    prompt: WORKSPACE_ANALYST_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'get_workspace_summary',
      'get_workspace_health',
      'get_team_activity',
      'get_weekly_summary',
      'lookup_tasks',
    ],
  },
  setupper: {
    prompt: SETUPPER_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      // Setupper uses ClickUp API tools for creating structure
      // These are the NEW tools we need to add (see PHASE 4)
      'create_space',
      'create_folder',
      'create_list',
      'set_space_statuses',
      'create_custom_field',
      'get_workspace_summary',
    ],
  },
  dashboard_builder: {
    prompt: DASHBOARD_BUILDER_PROMPT,
    model: 'claude-sonnet-4-6' as const,
    maxTokens: 4096,
    tools: [
      'create_dashboard_widget',
      'update_dashboard_widget',
      'delete_dashboard_widget',
      'list_dashboards',
      'list_dashboard_widgets',
    ],
  },
} as const;

type SubAgentName = keyof typeof SUB_AGENT_CONFIG;

/**
 * Execute a sub-agent with its own system prompt, tools, and tool loop.
 * Returns the sub-agent's final text response.
 */
export async function executeSubAgent(
  client: Anthropic,
  agentName: SubAgentName,
  userRequest: string,
  context: BineeContext,
  workspaceId: string,
): Promise<{
  content: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result: Record<string, unknown> }>;
  tokensInput: number;
  tokensOutput: number;
}> {
  const config = SUB_AGENT_CONFIG[agentName];

  // Build sub-agent system prompt with context
  const systemPrompt = buildSubAgentSystem(config.prompt, context);

  // Get the tool definitions for this sub-agent
  const tools = getToolsForSubAgent(config.tools);

  // Sub-agent messages start with the user's request
  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userRequest },
  ];

  const allToolCalls: Array<{ name: string; input: Record<string, unknown>; result: Record<string, unknown> }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Sub-agent tool loop
  for (let round = 0; round < MAX_SUB_AGENT_ROUNDS; round++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tools: tools as Anthropic.Tool[],
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // If no tool use, return the text response
    if (response.stop_reason === 'end_turn' || !response.content.some(b => b.type === 'tool_use')) {
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');

      return {
        content: textContent,
        toolCalls: allToolCalls,
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
      };
    }

    // Process tool calls
    const assistantMessage: Anthropic.MessageParam = { role: 'assistant', content: response.content };
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        // Execute the tool via existing tool-executor
        const result = await executeTool(block.name, block.input as Record<string, unknown>, workspaceId);
        allToolCalls.push({ name: block.name, input: block.input as Record<string, unknown>, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages = [
      ...messages,
      assistantMessage,
      { role: 'user', content: toolResults },
    ];
  }

  // If we hit max rounds, return whatever we have
  return {
    content: 'I gathered the information but reached my processing limit. Here is what I found so far.',
    toolCalls: allToolCalls,
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
  };
}

function buildSubAgentSystem(basePrompt: string, context: BineeContext): string {
  // Inject workspace context into the sub-agent prompt
  const contextBlock = `

## WORKSPACE CONTEXT

User: ${context.user.display_name} (${context.user.role})
Workspace: ${context.workspace.name}
ClickUp connected: ${context.workspace.clickup_connected ? 'Yes' : 'No'}
${context.workspace.clickup_connected ? `Last sync: ${context.workspace.last_sync_at}` : ''}

${context.businessState ? `## CURRENT DATA\n${JSON.stringify(context.businessState, null, 2)}` : ''}
`;

  return basePrompt + contextBlock;
}

function getToolsForSubAgent(toolNames: readonly string[]): Anthropic.Tool[] {
  // Import from the existing tools.ts and filter
  // This function filters BINEE_TOOLS to only include the tools this sub-agent needs
  const { BINEE_TOOLS } = require('./tools');
  return BINEE_TOOLS.filter((t: Anthropic.Tool) => toolNames.includes(t.name));
}
```

**IMPORTANT NOTE about the Setupper tools:** The current `tools.ts` does NOT have tools for creating Spaces, Folders, Lists, or Custom Fields via ClickUp API. The Setupper sub-agent needs these. Check if `tool-executor.ts` already has handlers for ClickUp structure creation, or if these need to be added. The Setup flow currently uses `src/components/onboarding/ExecutionProgress.tsx` which calls a separate API endpoint — that logic should be reviewed and potentially wired into new Setupper tools.

---

## PHASE 3: REWRITE `chat-handler.ts`

This is the biggest change. The current 686-line file becomes ~150 lines. The new flow:

```
User message → Build context → Load master agent prompt → Call Claude with sub-agent tools
→ If Claude calls a sub-agent tool → executeSubAgent() → Return result to master
→ If Claude calls a ClickUp tool directly → executeTool() → Return result
→ If Claude responds with text → Return to user
→ Handle write confirmations (same as before)
→ Deduct credits → Save messages
```

Here is the new `chat-handler.ts`:

```typescript
// src/lib/ai/chat-handler.ts
// REWRITTEN — Master Agent + Sub-Agent Architecture

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { MASTER_AGENT_PROMPT } from './prompts/master-agent';
import { executeSubAgent } from './sub-agent-executor';
import { executeTool } from './tool-executor';
import { buildContext } from './context';
import { isWriteOperation, createPendingAction, describeAction } from './confirmation';
import { deductCreditsForAIResponse, checkSufficientCredits } from './billing';
import { SUB_AGENT_TOOLS, DIRECT_TOOLS } from './tools';
import type { ChatRequest, ChatHandlerResponse, BineeContext } from '@/types/ai';

const MAX_TOOL_ROUNDS = 5;
const MASTER_MODEL = 'claude-sonnet-4-6';
const MASTER_MAX_TOKENS = 4096;

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

export async function handleChat(request: ChatRequest): Promise<ChatHandlerResponse> {
  const { workspace_id, user_id, conversation_id, message } = request;
  const supabase = await createClient();
  const client = getAnthropicClient();

  // 1. Check credits (flat cost: 3 credits per message)
  const creditCost = 3;
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspace_id)
    .single();

  const creditError = checkSufficientCredits(workspace?.credit_balance ?? 0, creditCost);
  if (creditError) {
    return { error: creditError.message, credits_remaining: workspace?.credit_balance ?? 0 };
  }

  // 2. Save user message
  await supabase.from('messages').insert({
    conversation_id,
    role: 'user',
    content: message,
    workspace_id,
    user_id,
  });

  // 3. Build context
  const context = await buildContext(workspace_id, user_id, conversation_id);

  // 4. Build system prompt with context
  const systemPrompt = buildMasterSystem(MASTER_AGENT_PROMPT, context);

  // 5. Fetch conversation history
  const conversationHistory = context.conversationHistory.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Add current message
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: message },
  ];

  // 6. Get all tools (sub-agent tools + direct tools)
  const allTools = [...SUB_AGENT_TOOLS, ...DIRECT_TOOLS];

  // 7. Master agent tool loop
  let allToolCalls: Array<{ name: string; input: any; result: any }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let pendingAction = null;
  let apiMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MASTER_MODEL,
      max_tokens: MASTER_MAX_TOKENS,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tools: allTools.map(t => ({
        ...t,
        cache_control: { type: 'ephemeral' as const },
      })) as Anthropic.Tool[],
      messages: apiMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // If done (no tool calls), extract text and return
    if (response.stop_reason === 'end_turn' || !response.content.some(b => b.type === 'tool_use')) {
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');

      // Deduct credits
      await deductCreditsForAIResponse(supabase, {
        workspace_id,
        credits: creditCost,
        model_used: MASTER_MODEL,
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        conversation_id,
      });

      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id,
        role: 'assistant',
        content: textContent,
        workspace_id,
        metadata: {
          model_used: MASTER_MODEL,
          credits_consumed: creditCost,
          tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
          tokens_input: totalInputTokens,
          tokens_output: totalOutputTokens,
        },
      });

      return {
        content: textContent,
        model_used: MASTER_MODEL,
        credits_consumed: creditCost,
        tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        pending_action: pendingAction,
      };
    }

    // Process tool calls
    const assistantContent = response.content;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type !== 'tool_use') continue;

      const toolName = block.name;
      const toolInput = block.input as Record<string, unknown>;

      // Check if this is a sub-agent tool
      if (isSubAgentTool(toolName)) {
        // Execute the sub-agent
        const subAgentResult = await executeSubAgent(
          client,
          toolName as any,
          toolInput.request as string,
          context,
          workspace_id,
        );

        allToolCalls.push(...subAgentResult.toolCalls);
        totalInputTokens += subAgentResult.tokensInput;
        totalOutputTokens += subAgentResult.tokensOutput;

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: subAgentResult.content,
        });
      }
      // Check if this is a write operation that needs confirmation
      else if (isWriteOperation(toolName)) {
        const action = await createPendingAction({
          workspace_id,
          conversation_id,
          tool_name: toolName,
          tool_input: toolInput,
          description: describeAction(toolName, toolInput),
        });

        pendingAction = action;
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({
            status: 'pending_confirmation',
            message: `Action requires confirmation: ${action.description}`,
            action_id: action.id,
          }),
        });
      }
      // Regular read tool — execute directly
      else {
        const result = await executeTool(toolName, toolInput, workspace_id);
        allToolCalls.push({ name: toolName, input: toolInput, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Continue the conversation with tool results
    apiMessages = [
      ...apiMessages,
      { role: 'assistant', content: assistantContent },
      { role: 'user', content: toolResults },
    ];
  }

  // Should not reach here, but handle gracefully
  return {
    content: 'I processed your request but need a moment to finalize. Could you try again?',
    model_used: MASTER_MODEL,
    credits_consumed: creditCost,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
    tokens_input: totalInputTokens,
    tokens_output: totalOutputTokens,
  };
}

function isSubAgentTool(name: string): boolean {
  return ['task_manager', 'workspace_analyst', 'setupper', 'dashboard_builder'].includes(name);
}

function buildMasterSystem(basePrompt: string, context: BineeContext): string {
  // Inject minimal workspace context for the master agent
  const contextBlock = `

---

## CURRENT SESSION

User: ${context.user.display_name} (${context.user.role})
Workspace: ${context.workspace.name}
ClickUp: ${context.workspace.clickup_connected ? 'Connected' : 'Not connected'}
Credits: ${context.workspace.credit_balance}
${context.workspace.clickup_connected && context.workspace.last_sync_at
    ? `Last sync: ${context.workspace.last_sync_at}`
    : ''}
`;

  // Add company profile if available
  const companyProfile = context.workspace.company_profile
    ? `
Company: ${context.workspace.company_profile.company_name || 'Unknown'}
Industry: ${context.workspace.company_profile.industry || 'Unknown'}
Team size: ${context.workspace.company_profile.team_size || 'Unknown'}
Primary use: ${context.workspace.company_profile.primary_use_case || 'Unknown'}
`
    : '';

  return basePrompt + contextBlock + companyProfile;
}
```

---

## PHASE 4: REWRITE `tools.ts` — Tool Descriptions for Routing

This is critical. The master agent routes to sub-agents based on tool descriptions. The current `tools.ts` has 15 ClickUp tools with per-TaskType filtering. The new version has:

1. **4 sub-agent tools** (for routing to sub-agents)
2. **Existing ClickUp tools** (for when the master handles simple things directly, like a quick task lookup)

**NOTE:** The master agent CAN also call some ClickUp tools directly for simple operations. For example, if a user says "show me my overdue tasks," the master shouldn't spin up a whole sub-agent — it should just call `lookup_tasks` directly. The sub-agents are for complex, multi-step operations.

```typescript
// src/lib/ai/tools.ts
// REWRITTEN — Sub-Agent Tools + Direct Tools

import type Anthropic from '@anthropic-ai/sdk';

/**
 * SUB-AGENT TOOLS
 * These are the tools the master agent uses to delegate to specialized sub-agents.
 * The descriptions are how the master agent knows WHEN to use each sub-agent.
 * These descriptions are critical for correct routing — be precise about boundaries.
 */
export const SUB_AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'task_manager',
    description: `Delegate to the Task Manager sub-agent for creating, updating, searching, moving, or organizing tasks in ClickUp. Use this when the user wants to:
- Create a new task (with name, assignee, due date, priority, list)
- Update an existing task (status, assignee, due date, priority, custom fields)
- Search for tasks by name, assignee, status, list, or due date
- Find overdue tasks or tasks matching specific criteria
- Assign or reassign tasks to team members
- Move tasks between lists
- Add time entries or manage time tracking
- Perform bulk operations on multiple tasks

DO NOT use this for: workspace structure changes (use setupper), dashboard creation (use dashboard_builder), or workspace analysis (use workspace_analyst). For simple one-off task lookups where you just need a quick count or list, you can use the direct lookup_tasks or get_overdue_tasks tools instead of spinning up the full task manager.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what the user wants to do with tasks. Include all relevant details from the user message.',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'workspace_analyst',
    description: `Delegate to the Workspace Analyst sub-agent for analyzing workspace health, structure, and usage patterns. Use this when the user wants to:
- Get an overview or health check of their workspace
- Understand what's working and what's not in their ClickUp setup
- See workspace metrics, trends, or comparisons over time
- Audit their workspace structure (spaces, folders, lists, statuses)
- Identify bottlenecks, unused areas, or problematic patterns
- Get recommendations for workspace improvements
- Run a full workspace scan (for the Setup flow)

DO NOT use this for: creating or modifying workspace structure (use setupper), managing tasks (use task_manager), or building dashboards (use dashboard_builder).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what analysis the user wants. Include context about what specific areas to analyze if mentioned.',
        },
        mode: {
          type: 'string',
          enum: ['audit', 'snapshot'],
          description: 'audit = human-readable analysis for chat. snapshot = structured data for the Setup flow.',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'setupper',
    description: `Delegate to the Setupper sub-agent for creating or improving ClickUp workspace structure. Use this when the user wants to:
- Set up their ClickUp workspace for the first time
- Create new Spaces, Folders, or Lists
- Add or modify status configurations
- Create custom fields
- Restructure or reorganize their workspace
- Apply industry-specific workspace templates
- Improve their current workspace structure based on analysis

DO NOT use this for: analyzing workspace health (use workspace_analyst first, then setupper to act on findings), managing individual tasks (use task_manager), or building dashboards (use dashboard_builder). The Setupper NEVER deletes existing structures — it only creates new ones alongside existing ones.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what workspace structure the user wants to create or change. Include industry, team size, and use case if the user mentioned them.',
        },
        analyst_snapshot: {
          type: 'string',
          description: 'Optional: JSON snapshot from the Workspace Analyst if a scan was run first. Pass this so the Setupper knows the current state.',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'dashboard_builder',
    description: `Delegate to the Dashboard Builder sub-agent for creating, modifying, or managing dashboards and widgets. Use this when the user wants to:
- Create a new dashboard
- Add widgets to a dashboard (charts, tables, summary cards, etc.)
- Modify existing widget configurations (filters, grouping, time range)
- Remove widgets from a dashboard
- Get suggestions for dashboard layouts based on their needs
- Build specific dashboard types (project overview, team performance, sprint, client)

DO NOT use this for: analyzing workspace data outside of dashboards (use workspace_analyst), managing tasks (use task_manager), or modifying workspace structure (use setupper).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what the user wants on their dashboard. Include widget types, metrics, and filters if mentioned.',
        },
      },
      required: ['request'],
    },
  },
];

/**
 * DIRECT TOOLS
 * These are ClickUp tools the master agent can call directly for simple operations
 * without spinning up a sub-agent. Used for quick lookups and simple reads.
 */
export const DIRECT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_tasks',
    description: 'Quick task search. Use for simple lookups like "show me tasks assigned to Sarah" or "how many tasks are in the Marketing list." For complex task operations (create, update, bulk), use the task_manager sub-agent instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: { type: 'string', description: 'Filter by assignee name' },
        status: { type: 'string', description: 'Filter by status name' },
        list_name: { type: 'string', description: 'Filter by list name' },
        search_term: { type: 'string', description: 'Search task names' },
        include_closed: { type: 'boolean', description: 'Include closed tasks (default false)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_overdue_tasks',
    description: 'Get all overdue tasks. Quick read-only lookup. For taking action on overdue tasks (reassigning, updating), use the task_manager sub-agent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: { type: 'string', description: 'Filter by assignee name' },
        space_name: { type: 'string', description: 'Filter by space name' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_workspace_summary',
    description: 'Get high-level workspace metrics: total tasks, by status, by priority, by assignee. Use for quick stats. For deep analysis, use workspace_analyst.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_weekly_summary',
    description: 'Get time-scoped task metrics (today, this week, this month). Quick stats on recent progress.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time period' },
      },
      required: [],
    },
  },
];

// For backward compatibility — export combined tools
export const ALL_TOOLS = [...SUB_AGENT_TOOLS, ...DIRECT_TOOLS];

// Remove the old getToolsForTask function entirely
// Remove the old TOOL_NAMES_BY_TASK mapping entirely
// Remove the old BINEE_TOOLS array entirely
```

**IMPORTANT:** The existing `BINEE_TOOLS` array in the current `tools.ts` has the full tool definitions for ALL 15+ tools. The sub-agent executor needs access to those definitions to pass to sub-agents. Either:
- (A) Keep the full definitions in a separate `CLICKUP_TOOLS` export that the sub-agent executor imports, OR
- (B) The sub-agent executor filters from a complete tool registry

Recommended approach: Keep all ClickUp tool definitions in a `CLICKUP_TOOL_REGISTRY` object, and have both the master's DIRECT_TOOLS and the sub-agent executor pull from it. This avoids duplicating tool schemas.

---

## PHASE 5: UPDATE `src/types/ai.ts`

Minimal changes:

1. **Remove the `TaskType` type** — no longer needed (the master agent doesn't classify)
2. **Add `SubAgentName` type:**
```typescript
export type SubAgentName = 'task_manager' | 'workspace_analyst' | 'setupper' | 'dashboard_builder';
```
3. **Add `company_profile` to workspace context type:**
```typescript
// Inside the workspace property of BineeContext
company_profile?: {
  company_name?: string;
  industry?: string;
  team_size?: string;
  primary_use_case?: string;
};
```
4. **Keep everything else** — `BineeContext`, `BusinessState`, `ChatRequest`, `AssistantResponse`, `PendingAction` all stay.

**WARNING:** Search the entire codebase for `TaskType` imports before removing it. If other files reference it (like billing.ts or context.ts), they need updates too.

---

## PHASE 6: UPDATE SIDEBAR — Remove Health Nav Item

**File:** `src/components/layout/Sidebar.tsx`

Find the navigation items array (around line 36-41) and remove the Health entry:

```typescript
// BEFORE
{ href: '/chats', label: 'Chats', icon: MessageSquare },
{ href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
{ href: '/health', label: 'Health', icon: HeartPulse },
{ href: '/setup', label: 'Setup', icon: Wrench },

// AFTER
{ href: '/chats', label: 'Chats', icon: MessageSquare },
{ href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
{ href: '/setup', label: 'Setup', icon: Wrench },
```

Also remove the `HeartPulse` import from lucide-react if it's only used for the Health nav item.

---

## PHASE 7: DELETE HEALTH PAGE

Remove these files/directories:

```
DELETE: src/app/(app)/health/page.tsx
DELETE: src/app/(app)/health/ (entire directory)
DELETE: src/components/dashboard/HealthPage.tsx
DELETE: src/components/dashboard/HealthScoreCircle.tsx
DELETE: src/components/dashboard/HealthTrendChart.tsx
DELETE: src/components/dashboard/IssueCard.tsx (if only used by HealthPage)
```

---

## PHASE 8: DATABASE — Add Company Profile to Workspaces

Add these columns to the `workspaces` table via Supabase migration:

```sql
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS team_size TEXT,
ADD COLUMN IF NOT EXISTS primary_use_case TEXT;
```

These are populated during onboarding and used by the master agent for personalization.

---

## PHASE 9: DEFAULT TEMPLATE DASHBOARD

When a user syncs their ClickUp workspace, automatically create a "Project Overview" dashboard with 10 default widgets. This is CODE, not AI — zero credit cost.

**Where to add this:** In the ClickUp sync completion handler (wherever the sync pipeline finishes). After sync completes:

1. Check if a dashboard named "Project Overview" already exists for this workspace
2. If not, create it with these 10 default widgets:
   - Summary Card: Total Active Tasks
   - Summary Card: Overdue Tasks
   - Summary Card: Completion Rate (30d)
   - Summary Card: Team Members
   - Bar Chart: Tasks by Status
   - Bar Chart: Tasks by Assignee
   - Donut Chart: Tasks by Priority
   - Line Chart: Task Completion Trend (30d)
   - Data Table: Overdue Tasks (sorted by days overdue)
   - Activity Feed: Recent Activity

**This replaces the Health page.** All the health-related information (overdue count, completion rate, trends) is now visible on this default dashboard without any AI credits spent.

---

## PHASE 10: UPDATE IMPORTS ACROSS CODEBASE

After deleting legacy files, search for broken imports:

```bash
# Find all files that import from deleted modules
grep -r "from.*classifier" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*router" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*prompt-assembler" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*knowledge-base" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*knowledge-cache" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*response-validator" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*system-prompt" src/ --include="*.ts" --include="*.tsx"
grep -r "TaskType" src/ --include="*.ts" --include="*.tsx"
grep -r "HealthPage" src/ --include="*.ts" --include="*.tsx"
grep -r "HealthScoreCircle" src/ --include="*.ts" --include="*.tsx"
grep -r "HealthTrendChart" src/ --include="*.ts" --include="*.tsx"
```

Fix all broken imports. The main one will be `chat-handler.ts` which is being fully rewritten and no longer imports from deleted files.

---

## PHASE 11: VERIFICATION CHECKLIST

After all changes, verify:

- [ ] `npm run build` completes with zero errors
- [ ] No imports reference deleted files
- [ ] No references to `TaskType` remain (or they're updated)
- [ ] Health page route returns 404
- [ ] Sidebar shows 3 items: Chats, Dashboards, Setup
- [ ] Chat API still works (send a message, get a response)
- [ ] Master agent responds to general questions without tool calls
- [ ] Master agent routes "show me overdue tasks" to `lookup_tasks` directly
- [ ] Master agent routes "set up my workspace" to `setupper` sub-agent
- [ ] Master agent routes "how's my workspace looking" to `workspace_analyst` sub-agent
- [ ] Master agent routes "build me a dashboard" to `dashboard_builder` sub-agent
- [ ] Write operations still require confirmation
- [ ] Credits are deducted correctly
- [ ] Prompt caching works (check Anthropic dashboard for cache hits)

---

## EXECUTION ORDER

Do these in order. Each phase depends on the previous:

1. **Phase 1:** Delete legacy files
2. **Phase 2:** Create new files (prompts, sub-agent-executor)
3. **Phase 3:** Rewrite chat-handler.ts
4. **Phase 4:** Rewrite tools.ts
5. **Phase 5:** Update types
6. **Phase 6:** Update Sidebar
7. **Phase 7:** Delete Health page
8. **Phase 8:** Database migration
9. **Phase 9:** Default dashboard (can be done in parallel with 1-7)
10. **Phase 10:** Fix broken imports
11. **Phase 11:** Build and verify

---

## FILES SUMMARY

| Action | File | Lines Changed |
|--------|------|---------------|
| DELETE | `src/lib/ai/classifier.ts` | -137 |
| DELETE | `src/lib/ai/router.ts` | -98 |
| DELETE | `src/lib/ai/prompt-assembler.ts` | -468 |
| DELETE | `src/lib/ai/knowledge-base.ts` | -219 |
| DELETE | `src/lib/ai/knowledge-cache.ts` | -61 |
| DELETE | `src/lib/ai/response-validator.ts` | -379 |
| DELETE | `src/lib/ai/prompts/system-prompt.ts` | -283 |
| DELETE | `src/lib/ai/prompts/chat-prompt.ts` | -48 |
| DELETE | `src/lib/ai/prompts/action-prompt.ts` | -44 |
| DELETE | `src/lib/ai/prompts/briefing-prompt.ts` | -77 |
| DELETE | `src/lib/ai/prompts/setup-prompt.ts` | -76 |
| DELETE | `src/lib/ai/prompts/dashboard-prompt.ts` | -50 |
| DELETE | `src/lib/ai/prompts/rule-creation-prompt.ts` | -46 |
| DELETE | `src/app/(app)/health/page.tsx` | -12 |
| DELETE | `src/components/dashboard/HealthPage.tsx` | -316 |
| DELETE | `src/components/dashboard/HealthScoreCircle.tsx` | ~-80 |
| DELETE | `src/components/dashboard/HealthTrendChart.tsx` | ~-120 |
| CREATE | `src/lib/ai/prompts/master-agent.ts` | +190 |
| CREATE | `src/lib/ai/prompts/sub-agents.ts` | +400 |
| CREATE | `src/lib/ai/sub-agent-executor.ts` | +150 |
| REWRITE | `src/lib/ai/chat-handler.ts` | 686 → ~180 |
| REWRITE | `src/lib/ai/tools.ts` | 472 → ~250 |
| UPDATE | `src/types/ai.ts` | ~10 lines changed |
| UPDATE | `src/components/layout/Sidebar.tsx` | ~3 lines changed |
| ADD | Supabase migration (company profile columns) | +5 lines SQL |
| ADD | Default dashboard creation (in sync handler) | +50 lines |

**Net result:** ~2,500 lines deleted, ~1,200 lines added. Codebase gets significantly leaner.
