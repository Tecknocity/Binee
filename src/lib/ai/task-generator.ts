// Per-list starter task generator. Called in the post-confirm enrichment phase
// (see src/lib/setup/enrichment-phase.ts). Uses Haiku 4.5 for cost/latency -
// tasks are formulaic enough that a small model produces strong output when
// given proper workspace grounding.
//
// Priority of inputs (highest first):
//   1. listPurpose + taskExamples: what the user said in the chat about this list.
//      This is the source of truth and must drive the output.
//   2. spaceName + listName: the structural label.
//   3. workspace context (domain, goal, team).
//   4. referenceSnippet: a topical excerpt from the knowledge base. Inspiration
//      for shape and tone only; never to override chat-derived context.
//
// Failures in this module must NEVER surface to the user. Callers are expected
// to catch, log silently via src/lib/errors/log.ts, and skip the list.

import type Anthropic from '@anthropic-ai/sdk';
import type { RecommendedTask, WorkspaceContext } from '@/lib/setup/types';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1200;

let _anthropic: Anthropic | null = null;

async function getClient(): Promise<Anthropic> {
  if (!_anthropic) {
    const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
    _anthropic = new AnthropicSDK({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export interface TaskGenerationInput {
  context: WorkspaceContext;
  spaceName: string;
  /** Optional per-space purpose from the chat. Used as secondary grounding. */
  spacePurpose?: string;
  listName: string;
  /** Legacy short description of the list. */
  listDescription?: string;
  /** 1-2 sentences of user-authored purpose for this list from the chat. */
  listPurpose?: string;
  /**
   * Concrete example tasks the user mentioned in chat for this list. When
   * present these take priority over everything else - generated tasks should
   * match their vocabulary and concreteness.
   */
  taskExamples?: string[];
  /** Tag names that already exist in the workspace - Haiku may reference these. */
  availableTags: string[];
  /**
   * Optional topical snippet from ai_knowledge_base. Inspiration only. The
   * chat-derived purpose and examples always win.
   */
  referenceSnippet?: string;
}

const SYSTEM_PROMPT = `You generate starter tasks for a newly-created ClickUp list.

You will receive a workspace context, a specific list, and optional chat-derived grounding (list purpose, example tasks the user mentioned) plus an optional reference snippet for inspiration. Your job is to produce 5-8 concrete, actionable starter tasks that the specific user in front of you would actually create on day one.

SOURCE OF TRUTH ORDER:
1. The user's own words about this list: listPurpose and taskExamples. If present, tasks MUST reflect the user's vocabulary, entities, and kind of work. Style and concreteness should match their examples. Extend naturally from what they gave you rather than replacing it with template copy.
2. The list name, space name, and workspace domain/goal.
3. The reference snippet. This is inspiration for shape and tone only. If it suggests tasks that do not fit what the user described, discard them. Never copy tasks from the snippet verbatim.

RULES:
- Return ONLY a JSON array. No markdown, no prose, no object wrapper.
- Each task: { "name": string, "description"?: string, "priority"?: 1|2|3|4, "tags"?: string[] }
- Name: short imperative phrase, 3-9 words. Like "Draft Q3 campaign brief" not "Task: Drafting the Q3 campaign brief document for review."
- Description: optional, 1-3 short sentences. Reference specifics from the list purpose or task examples when relevant so tasks feel tailored. Skip description on the most obvious tasks.
- Priority: 1=urgent, 2=high, 3=normal, 4=low. Distribute naturally - most tasks are normal (3), one or two high (2) if genuinely important, rarely urgent (1). If unsure, omit.
- Tags: MUST be from the provided availableTags list (exact strings) or omit the field entirely. Never invent tag names.
- Tasks should progress logically: early setup tasks first, ongoing work after.
- Avoid generic placeholders like "Task 1" or "Set up things". Every task must be real work.
- NEVER invent specifics (client names, project names, numbers, dates, vendors) that do not appear in the chat-derived grounding or workspace context. If you need a placeholder, phrase generically ("a bigger client", "a recurring invoice") rather than making one up.
- No due dates. No assignees.
- Do NOT use em dashes (-) or en dashes. Use hyphens, commas, or rephrase.`;

function buildUserMessage(input: TaskGenerationInput): string {
  const ctx = input.context;
  const lines: string[] = [
    '## Workspace context',
    `Domain: ${ctx.domain}`,
    `Primary goal: ${ctx.primaryGoal}`,
  ];
  if (ctx.teamShape) lines.push(`Team: ${ctx.teamShape}`);

  lines.push('', '## List to populate');
  lines.push(`Space: ${input.spaceName}`);
  if (input.spacePurpose) lines.push(`Space purpose (user's words): ${input.spacePurpose}`);
  lines.push(`List: ${input.listName}`);
  if (input.listPurpose) {
    lines.push(`List purpose (user's words, source of truth): ${input.listPurpose}`);
  } else if (input.listDescription) {
    lines.push(`List description: ${input.listDescription}`);
  }

  if (input.taskExamples && input.taskExamples.length > 0) {
    lines.push('', '## Example tasks the user mentioned for this list (match their concreteness and vocabulary)');
    for (const ex of input.taskExamples) lines.push(`- ${ex}`);
  }

  lines.push('', '## Available tags (use only these names, or omit tags field)');
  lines.push(input.availableTags.length > 0 ? input.availableTags.join(', ') : '(none)');

  if (input.referenceSnippet && input.referenceSnippet.trim().length > 0) {
    lines.push('', '## Reference snippet (inspiration only, NEVER override the user\'s own grounding above)');
    lines.push(input.referenceSnippet.trim());
  }

  lines.push('', 'Return the JSON array of 5-8 starter tasks now.');

  return lines.join('\n');
}

/**
 * Generate 5-8 starter tasks for a single list. Throws on failure - caller
 * must catch and log silently.
 */
export async function generateTasksForList(
  input: TaskGenerationInput,
): Promise<RecommendedTask[]> {
  const client = await getClient();

  const response = await client.messages.create({
    model: HAIKU_MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return parseTasksResponse(text, input.availableTags);
}

function parseTasksResponse(
  text: string,
  availableTags: string[],
): RecommendedTask[] {
  let jsonStr = text;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  if (!jsonStr.startsWith('[')) {
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (match) jsonStr = match[0];
  }

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) {
    throw new Error('Task response was not a JSON array');
  }

  const allowedTags = new Set(availableTags);
  const tasks: RecommendedTask[] = [];

  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name) continue;

    const task: RecommendedTask = { name: name.slice(0, 200) };

    if (typeof obj.description === 'string' && obj.description.trim()) {
      task.description = obj.description.trim().slice(0, 1000);
    }

    if (typeof obj.priority === 'number') {
      const p = Math.round(obj.priority);
      if (p >= 1 && p <= 4) task.priority = p as 1 | 2 | 3 | 4;
    }

    if (Array.isArray(obj.tags)) {
      const filtered = obj.tags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0 && allowedTags.has(t));
      if (filtered.length > 0) task.tags = filtered;
    }

    tasks.push(task);
    if (tasks.length >= 12) break;
  }

  return tasks;
}
