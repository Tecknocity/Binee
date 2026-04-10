// ---------------------------------------------------------------------------
// AI-powered reconciliation recommender
//
// Analyzes existing workspace items against the proposed plan and recommends
// whether each item should be kept or deleted, with reasoning.
// Uses Haiku for fast, cheap classification.
// ---------------------------------------------------------------------------

import type { SetupPlan } from './types';
import type { ExecutionItem } from './executor';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;

export interface ReconciliationRecommendation {
  /** Key: clickupId or fallback key */
  key: string;
  action: 'keep' | 'delete';
  reason: string;
}

/**
 * Get AI recommendations for existing workspace items that are not in the
 * proposed plan. The AI considers the business context, plan structure, task
 * counts, and plan limits to recommend keep/delete for each item.
 */
export async function getReconciliationRecommendations(
  existingItems: ExecutionItem[],
  proposedPlan: SetupPlan,
  context: {
    businessDescription?: string;
    planTier?: string;
    maxSpaces?: number | null;
    existingSpaceCount?: number;
    newSpaceCount?: number;
  },
): Promise<ReconciliationRecommendation[]> {
  if (existingItems.length === 0) return [];

  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
  const anthropic = new AnthropicSDK({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = buildRecommenderPrompt(proposedPlan, context);
  const userMessage = buildItemsList(existingItems);

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return parseRecommendations(text, existingItems);
  } catch (err) {
    console.error('[reconciliation-recommender] AI call failed:', err);
    // Fallback: recommend keeping everything (safe default)
    return existingItems.map((item) => ({
      key: item.clickupId ?? `${item.type}:${item.name}`,
      action: 'keep' as const,
      reason: 'Could not analyze this item. Keeping it is the safe default.',
    }));
  }
}

function buildRecommenderPrompt(
  plan: SetupPlan,
  ctx: {
    businessDescription?: string;
    planTier?: string;
    maxSpaces?: number | null;
    existingSpaceCount?: number;
    newSpaceCount?: number;
  },
): string {
  const planSummary = plan.spaces
    .map((s) => {
      const lists = [
        ...(s.lists ?? []).map((l) => l.name),
        ...s.folders.flatMap((f) => f.lists.map((l) => `${f.name}/${l.name}`)),
      ];
      return `Space: ${s.name} (${lists.length} lists: ${lists.join(', ')})`;
    })
    .join('\n');

  const parts: string[] = [];

  parts.push(`You are an AI workspace advisor. Your job is to recommend whether existing ClickUp workspace items should be KEPT or DELETED to make room for a new workspace structure.

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation outside the JSON.`);

  if (ctx.businessDescription) {
    parts.push(`BUSINESS CONTEXT: ${ctx.businessDescription}`);
  }

  parts.push(`PROPOSED NEW WORKSPACE PLAN:
${planSummary}`);

  if (ctx.maxSpaces != null) {
    const spaceInfo = [
      `Plan tier: ${ctx.planTier ?? 'Free'}`,
      `Max spaces allowed: ${ctx.maxSpaces}`,
      `Current spaces: ${ctx.existingSpaceCount ?? 'unknown'}`,
      `New spaces in plan: ${ctx.newSpaceCount ?? 'unknown'}`,
    ];
    parts.push(`PLAN LIMITS:\n${spaceInfo.join('\n')}`);
  }

  parts.push(`RULES FOR RECOMMENDATIONS:
- If an existing item overlaps significantly with something in the new plan (similar purpose, redundant), recommend DELETE with reason.
- If an existing item has tasks (taskCount > 0), be cautious - prefer KEEP unless it clearly overlaps with the new plan. Mention the task count in your reason.
- If the space limit will be exceeded, you MUST recommend deleting enough spaces to fit the new plan. Prefer deleting empty spaces or spaces whose purpose is covered by the new plan.
- For lists inside a space: if you recommend deleting the space, recommend deleting all its lists too.
- If an item serves a unique purpose not covered by the new plan, recommend KEEP.
- Keep reasons short - one sentence max.

OUTPUT FORMAT: Return a JSON array. Each element must have: "key" (the item key provided), "action" ("keep" or "delete"), "reason" (short explanation).
Example:
[
  {"key": "space:Client Projects", "action": "delete", "reason": "Replaced by the new Client Delivery space which covers the same workflow."},
  {"key": "list:Operations & Growth/Internal Operations", "action": "keep", "reason": "Unique operational tracking not covered by the new plan."}
]`);

  return parts.join('\n\n');
}

function buildItemsList(items: ExecutionItem[]): string {
  const lines = items.map((item) => {
    const key = item.clickupId ?? `${item.type}:${item.name}`;
    const taskInfo = item.taskCount ? ` (${item.taskCount} tasks)` : ' (empty)';
    const path = item.parentName ? `${item.parentName} / ${item.name}` : item.name;
    return `- key="${key}" type=${item.type} path="${path}"${taskInfo}`;
  });

  return `Analyze these existing workspace items and recommend keep or delete for each:\n\n${lines.join('\n')}`;
}

function parseRecommendations(
  text: string,
  items: ExecutionItem[],
): ReconciliationRecommendation[] {
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  if (!jsonStr.startsWith('[')) {
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (match) jsonStr = match[0];
  }

  try {
    const parsed = JSON.parse(jsonStr) as Array<{
      key?: string;
      action?: string;
      reason?: string;
    }>;

    if (!Array.isArray(parsed)) throw new Error('Not an array');

    // Build lookup from parsed results
    const recMap = new Map<string, { action: 'keep' | 'delete'; reason: string }>();
    for (const r of parsed) {
      if (r.key && (r.action === 'keep' || r.action === 'delete')) {
        recMap.set(r.key, {
          action: r.action,
          reason: r.reason ?? (r.action === 'keep' ? 'Recommended to keep.' : 'Recommended to delete.'),
        });
      }
    }

    // Map back to items (handle missing recommendations gracefully)
    return items.map((item) => {
      const key = item.clickupId ?? `${item.type}:${item.name}`;
      const rec = recMap.get(key);
      return {
        key,
        action: rec?.action ?? 'keep',
        reason: rec?.reason ?? 'No specific recommendation.',
      };
    });
  } catch {
    console.error('[reconciliation-recommender] Failed to parse AI response:', text.slice(0, 300));
    return items.map((item) => ({
      key: item.clickupId ?? `${item.type}:${item.name}`,
      action: 'keep' as const,
      reason: 'Could not parse recommendation. Keeping is the safe default.',
    }));
  }
}
