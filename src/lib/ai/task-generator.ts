// Per-list starter task generator. Called in the post-confirm enrichment phase
// (see src/lib/setup/enrichment-phase.ts). Uses Haiku 4.5 for cost/latency -
// tasks are formulaic enough that a small model produces strong output when
// given proper workspace grounding.
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
  listName: string;
  listDescription?: string;
  /** Tag names that already exist in the workspace - Haiku may reference these. */
  availableTags: string[];
}

const SYSTEM_PROMPT = `You generate starter tasks for a newly-created ClickUp list.

You will receive a workspace context and a specific list. Your job is to produce 5-8 concrete, actionable starter tasks that a real team in that domain would create on day one.

RULES:
- Return ONLY a JSON array. No markdown, no prose, no object wrapper.
- Each task: { "name": string, "description"?: string, "priority"?: 1|2|3|4, "tags"?: string[] }
- Name: short imperative phrase, 3-9 words. Like "Draft Q3 campaign brief" not "Task: Drafting the Q3 campaign brief document for review."
- Description: optional, 1-3 short sentences. Reference specifics from the workspace context (domain, goal) when relevant so tasks feel tailored, not generic. Skip description on the most obvious tasks.
- Priority: 1=urgent, 2=high, 3=normal, 4=low. Distribute naturally - most tasks are normal (3), one or two high (2) if genuinely important, rarely urgent (1). If unsure, omit.
- Tags: MUST be from the provided availableTags list (exact strings) or omit the field entirely. Never invent tag names.
- Tasks should progress logically: early setup tasks first, ongoing work after.
- Avoid generic placeholders like "Task 1" or "Set up things". Every task must be real work.
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
  lines.push(`List: ${input.listName}`);
  if (input.listDescription) lines.push(`List purpose: ${input.listDescription}`);

  lines.push('', '## Available tags (use only these names, or omit tags field)');
  lines.push(input.availableTags.length > 0 ? input.availableTags.join(', ') : '(none)');

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
