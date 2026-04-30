import Anthropic from '@anthropic-ai/sdk';
import { REVISER_STATIC_RULES, buildReviserContext } from '@/lib/ai/prompts/reviser-prompt';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import type { PlanDelta } from './contracts';
import type { SnapshotDiagnostics } from './setupper-brain';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface ReviserInput {
  userMessage: string;
  conversationHistory: Anthropic.MessageParam[];
  /** Current plan from setup_drafts. Required - the Reviser only runs when a plan exists. */
  currentPlan: Record<string, unknown>;
  brief?: Record<string, unknown> | null;
  planTier?: string | null;
  industry?: string;
}

export interface ReviserResult {
  /** Plain-text message shown to the user (the delta.notes field). */
  content: string;
  creditsToCharge: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  anthropicCostCents: number;
  toolCalls: string[];
  /** Merged snapshot to persist. */
  structureSnapshot?: Record<string, unknown>;
  snapshotDiagnostics?: SnapshotDiagnostics;
  /** The raw delta the model produced, for telemetry/debugging. */
  delta?: PlanDelta;
  /** Wall-clock for the Anthropic .messages.create() call (debug observability). */
  modelCallMs: number;
  /** stop_reason returned by the model for the same call. */
  modelStopReason?: string;
}

/**
 * Run one Reviser turn. Sonnet interprets the user's feedback and emits a
 * PlanDelta. We translate the delta into the same shape mergeSnapshot
 * understands (_rename / _remove / spaces / recommended_tags etc.) and
 * persist via the existing merge machinery.
 */
export async function runReviser(input: ReviserInput): Promise<ReviserResult> {
  const anthropic = getClient();

  const dynamicContext = buildReviserContext({
    currentPlan: input.currentPlan,
    brief: input.brief ?? null,
    planTier: input.planTier,
    industry: input.industry,
  });

  const messages: Anthropic.MessageParam[] = input.conversationHistory.length > 0
    ? [
        ...input.conversationHistory.slice(0, -1),
        { role: 'user' as const, content: input.userMessage },
      ]
    : [{ role: 'user' as const, content: input.userMessage }];

  const modelStart = Date.now();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: 2500,
    // Two-block system: static rules are cached after the first call
    // (~900 tokens, ~85% latency reduction on cache hits). The current plan
    // JSON + brief change per user so they are always sent fresh.
    system: [
      {
        type: 'text',
        text: REVISER_STATIC_RULES,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: dynamicContext,
      },
    ],
    messages,
  });
  const modelCallMs = Date.now() - modelStart;

  const totalInputTokens = response.usage.input_tokens;
  const totalOutputTokens = response.usage.output_tokens;
  const wasTruncated = response.stop_reason === 'max_tokens';

  const rawContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const delta = parseDelta(rawContent);

  let snapshot = input.currentPlan;
  let diagnostics: SnapshotDiagnostics | undefined;

  if (delta) {
    const result = applyDeltaToSnapshot(input.currentPlan, delta);
    snapshot = result.snapshot;
    diagnostics = { ...result.diagnostics, truncatedResponse: wasTruncated };
  } else if (wasTruncated) {
    console.warn('[reviser] Response truncated and no parseable delta - leaving plan unchanged.');
  } else {
    console.warn('[reviser] Could not parse delta from response - leaving plan unchanged.');
  }

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

  const message =
    delta?.notes?.trim() ||
    "I made the change. Have a look and tell me what to adjust next.";

  return {
    content: message,
    creditsToCharge: classification.creditsToCharge,
    totalInputTokens,
    totalOutputTokens,
    anthropicCostCents: anthropicCost.totalCostCents,
    toolCalls: [],
    structureSnapshot: snapshot,
    snapshotDiagnostics: diagnostics,
    delta: delta ?? undefined,
    modelCallMs,
    modelStopReason: response.stop_reason ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDelta(raw: string): PlanDelta | null {
  if (!raw) return null;
  const trimmed = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(trimmed);
    return normalizeDelta(parsed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return normalizeDelta(JSON.parse(match[0]));
    } catch {
      return null;
    }
  }
}

function normalizeDelta(raw: unknown): PlanDelta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: PlanDelta = {
    notes: typeof r.notes === 'string' ? r.notes : '',
    rename: Array.isArray(r.rename)
      ? (r.rename as Array<Record<string, unknown>>)
          .filter((op) => typeof op?.from === 'string' && typeof op?.to === 'string')
          .map((op) => ({ from: op.from as string, to: op.to as string }))
      : [],
    add:
      r.add && typeof r.add === 'object'
        ? (r.add as PlanDelta['add'])
        : {},
    remove: Array.isArray(r.remove)
      ? (r.remove as Array<Record<string, unknown>>)
          .filter((op) => typeof op?.path === 'string')
          .map((op) => ({ path: op.path as string }))
      : [],
    status_changes: Array.isArray(r.status_changes)
      ? (r.status_changes as PlanDelta['status_changes'])
      : undefined,
  };
  return out;
}

interface ApplyResult {
  snapshot: Record<string, unknown>;
  diagnostics: Omit<SnapshotDiagnostics, 'truncatedResponse'>;
}

interface SpaceLike {
  name?: string;
  lists?: ListLike[];
  folders?: Array<{ name?: string; lists?: ListLike[] }>;
  [k: string]: unknown;
}
interface ListLike {
  name?: string;
  statuses?: Array<{ name: string; type?: string }>;
  [k: string]: unknown;
}

/**
 * Apply a PlanDelta to an existing snapshot. We deep-clone first so the
 * caller's plan is never mutated. Renames + removes use slash paths.
 */
function applyDeltaToSnapshot(prev: Record<string, unknown>, delta: PlanDelta): ApplyResult {
  const snap: Record<string, unknown> = JSON.parse(JSON.stringify(prev));

  const spacesBefore = (snap.spaces as SpaceLike[] | undefined)?.length ?? 0;
  const listsBefore = countListsIn(snap);

  // 1. Renames first (so a subsequent remove can target the new name).
  for (const op of delta.rename) {
    const fromParts = parsePath(op.from);
    const toParts = parsePath(op.to);
    if (fromParts.length === 0 || fromParts.length !== toParts.length) continue;
    let parentMatches = true;
    for (let i = 0; i < fromParts.length - 1; i++) {
      if (!sameName(fromParts[i], toParts[i])) {
        parentMatches = false;
        break;
      }
    }
    if (!parentMatches) continue;
    const node = findNodeByPath(snap, fromParts);
    if (node) node.name = toParts[toParts.length - 1];
  }

  // 2. Adds (spaces, tags, docs).
  if (delta.add?.spaces?.length) {
    const existing = (snap.spaces as SpaceLike[] | undefined) ?? [];
    const existingNames = new Set(existing.map((s) => (s.name ?? '').toLowerCase().trim()));
    const additions = delta.add.spaces.filter((s) => {
      const name = ((s as SpaceLike).name ?? '').toLowerCase().trim();
      return name.length > 0 && !existingNames.has(name);
    });
    snap.spaces = [...existing, ...(additions as SpaceLike[])];
  }
  if (delta.add?.tags?.length) {
    const existing = (snap.recommended_tags as Array<{ name?: string }> | undefined) ?? [];
    const existingNames = new Set(existing.map((t) => (t.name ?? '').toLowerCase().trim()));
    const additions = delta.add.tags.filter((t) => {
      const name = (t.name ?? '').toLowerCase().trim();
      return name.length > 0 && !existingNames.has(name);
    });
    snap.recommended_tags = [...existing, ...additions];
  }
  if (delta.add?.docs?.length) {
    const existing = (snap.recommended_docs as Array<{ name?: string }> | undefined) ?? [];
    const existingNames = new Set(existing.map((d) => (d.name ?? '').toLowerCase().trim()));
    const additions = delta.add.docs.filter((d) => {
      const name = (d.name ?? '').toLowerCase().trim();
      return name.length > 0 && !existingNames.has(name);
    });
    snap.recommended_docs = [...existing, ...additions];
  }

  // 3. Status changes.
  if (delta.status_changes?.length) {
    for (const change of delta.status_changes) {
      const parts = parsePath(change.list_path);
      const node = findNodeByPath(snap, parts);
      if (node && Array.isArray(change.statuses)) {
        (node as ListLike).statuses = change.statuses;
      }
    }
  }

  // 4. Removes last (always win).
  for (const op of delta.remove) {
    const parts = parsePath(op.path);
    if (parts.length === 0) continue;
    const spaces = (snap.spaces as SpaceLike[] | undefined) ?? [];
    if (parts.length === 1) {
      snap.spaces = spaces.filter((s) => !sameName(s.name, parts[0]));
      continue;
    }
    const space = spaces.find((s) => sameName(s.name, parts[0]));
    if (!space) continue;
    if (parts.length === 2) {
      space.lists = (space.lists ?? []).filter((l) => !sameName(l.name, parts[1]));
      space.folders = (space.folders ?? []).filter((f) => !sameName(f.name, parts[1]));
      continue;
    }
    if (parts.length === 3) {
      const folder = (space.folders ?? []).find((f) => sameName(f.name, parts[1]));
      if (!folder) continue;
      folder.lists = (folder.lists ?? []).filter((l) => !sameName(l.name, parts[2]));
    }
  }

  const spacesAfter = (snap.spaces as SpaceLike[] | undefined)?.length ?? 0;
  const listsAfter = countListsIn(snap);

  return {
    snapshot: snap,
    diagnostics: {
      intent: 'update',
      intentFullReplaceDowngraded: false,
      spacesBefore,
      spacesAfter,
      listsBefore,
      listsAfter,
      renameCount: delta.rename.length,
      removeCount: delta.remove.length,
    },
  };
}

function parsePath(p: string): string[] {
  return p
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sameName(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findNodeByPath(snap: Record<string, unknown>, parts: string[]): { name?: string } | null {
  if (parts.length === 0) return null;
  const spaces = (snap.spaces as SpaceLike[] | undefined) ?? [];
  const space = spaces.find((s) => sameName(s.name, parts[0]));
  if (!space) return null;
  if (parts.length === 1) return space;
  if (parts.length === 2) {
    const list = (space.lists ?? []).find((l) => sameName(l.name, parts[1]));
    if (list) return list;
    const folder = (space.folders ?? []).find((f) => sameName(f.name, parts[1]));
    if (folder) return folder;
    return null;
  }
  if (parts.length === 3) {
    const folder = (space.folders ?? []).find((f) => sameName(f.name, parts[1]));
    if (!folder) return null;
    const list = (folder.lists ?? []).find((l) => sameName(l.name, parts[2]));
    return list ?? null;
  }
  return null;
}

function countListsIn(snap: Record<string, unknown>): number {
  const spaces = snap.spaces as SpaceLike[] | undefined;
  if (!Array.isArray(spaces)) return 0;
  let count = 0;
  for (const s of spaces) {
    if (Array.isArray(s.lists)) count += s.lists.length;
    if (Array.isArray(s.folders)) {
      for (const f of s.folders) {
        if (Array.isArray(f.lists)) count += f.lists.length;
      }
    }
  }
  return count;
}
