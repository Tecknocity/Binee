import Anthropic from '@anthropic-ai/sdk';
import { buildSetupperPrompt } from '@/lib/ai/prompts/setupper-prompt';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { loadUserMemories } from '@/lib/ai/user-memory';
import type { ImageAttachmentPayload } from '@/types/ai';
import { runClarifier } from './clarifier';
import { runReviser } from './reviser';
import type { ClarifierAsk, WorkspaceBrief } from './contracts';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

/**
 * Multi-agent feature flag. ON by default; the legacy single-Sonnet
 * handler stays as the explicit opt-out path.
 *   - default / unset: multi-agent runs (Clarifier + Reviser + Generator)
 *   - 'false':         legacy single-Sonnet path runs unchanged
 * Use the env var only as an emergency rollback if multi-agent
 * misbehaves in production.
 */
const MULTI_AGENT_SETUP = process.env.MULTI_AGENT_SETUP !== 'false';

interface SetupperInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  conversationHistory: Anthropic.MessageParam[];
  /** Pre-computed analysis from the analyzer step — avoids redundant sub-agent call */
  precomputedAnalysis?: string;
  /**
   * ClickUp plan tier for the workspace ('free' | 'unlimited' | 'business' |
   * 'business_plus' | 'enterprise'). Phase 3 made this user-supplied via
   * the profile form dropdown. Null when the user has not yet picked one;
   * the prompt builder skips the CLICKUP PLAN block entirely in that case
   * so the model is never told a fabricated default.
   */
  planTier?: string | null;
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
  /** Structure snapshot from previous chat messages (built incrementally) */
  chatStructureSnapshot?: Record<string, unknown>;
  /** User's profile form data (if already collected) */
  profileData?: {
    industry?: string;
    workStyle?: string;
    services?: string;
    teamSize?: string;
  };
  /** Base64-encoded images attached to this message (Claude vision) */
  imageAttachments?: ImageAttachmentPayload[];
  /**
   * Phase 2: pre-formatted "ATTACHMENTS IN THIS CONVERSATION" block built
   * by the chat route from every chat_attachments row in the conversation.
   * Each line is the filename + media type + Haiku-generated digest. The
   * brain appends this to the system prompt verbatim so the model carries
   * a stable memory of every upload across turns without us re-sending the
   * raw bytes. Empty string when the conversation has no attachments.
   */
  attachmentDigestBlock?: string;
}

/**
 * Phase 4 observability: diagnostics returned alongside the merged snapshot
 * so the chat route can persist a setup_draft_changes row. None of these
 * fields affect runtime behavior - they exist purely to give us a usable
 * audit trail when something looks wrong in production.
 */
export interface SnapshotDiagnostics {
  intent: 'update' | 'full_replace';
  intentFullReplaceDowngraded: boolean;
  truncatedResponse: boolean;
  spacesBefore: number;
  spacesAfter: number;
  listsBefore: number;
  listsAfter: number;
  renameCount: number;
  removeCount: number;
}

interface SetupperResult {
  content: string;
  creditsToCharge: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  anthropicCostCents: number;
  toolCalls: string[];
  /** Extracted structure snapshot from this response (if the AI proposed/updated a structure) */
  structureSnapshot?: Record<string, unknown>;
  /** Phase 4: emitted only when a snapshot was successfully merged this turn. */
  snapshotDiagnostics?: SnapshotDiagnostics;
  /** Multi-agent: which role handled this turn (for telemetry). */
  role?: 'clarifier' | 'generator-chat' | 'reviser';
  /** Multi-agent: the next chip-ask for the UI when the Clarifier ran. */
  ask?: ClarifierAsk;
  /** Multi-agent: the discovery brief when ready=true. */
  brief?: WorkspaceBrief;
  /** Multi-agent: true once discovery is complete (Generate Structure can be highlighted). */
  ready?: boolean;
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
  // Multi-agent orchestrator. When the flag is on we route this turn to the
  // Clarifier (Haiku) or the Reviser (Sonnet) based on whether a generated
  // plan already exists. The legacy single-Sonnet path stays untouched as
  // the fallback - flip the env var off and behavior reverts exactly.
  if (MULTI_AGENT_SETUP) {
    const routed = await routeMultiAgentTurn(input);
    if (routed) return routed;
  }

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
  // Skip 'profile' category memories — the company identity block in the system
  // prompt already contains all profile data, so loading them again would be
  // redundant (~200-400 wasted tokens per message).
  const userMemories = await loadUserMemories(input.userId, input.workspaceId, ['profile']);

  // Templates are NOT loaded for chat - they're only used during plan generation
  // (generate-plan route). The system prompt already has COMMON INDUSTRY PATTERNS
  // for the discovery conversation. This keeps the prompt lean and fast.
  let systemPrompt = buildSetupperPrompt(workspaceAnalysis, '', input.planTier, input.profileData);
  if (userMemories) systemPrompt += `\n\n${userMemories}`;

  // Inject the current working draft so the AI iterates in place rather than
  // regenerating. The chat snapshot is the source of truth during chat; the
  // proposedPlan is used only when the user just came back from Review with a
  // post-Review plan and there is no fresher chat snapshot.
  const previousDraft = pickPreviousDraft(input.chatStructureSnapshot, input.proposedPlan);
  if (previousDraft) {
    systemPrompt += `\n\nCHAT DRAFT (the proposed structure the user has been refining with you - this IS the deliverable; iterate on it, do not regenerate, never confuse it with EXISTING CLICKUP STRUCTURE above):\n${JSON.stringify(previousDraft)}`;
  }

  // Phase 2: include the per-conversation attachment digest block. Even
  // when no attachments exist the chat route passes an empty string, in
  // which case we skip the section entirely so the model doesn't see a
  // dangling header.
  if (input.attachmentDigestBlock && input.attachmentDigestBlock.trim().length > 0) {
    systemPrompt += `\n\n${input.attachmentDigestBlock}`;
  }

  // Step 3: Single Sonnet call - no tools, no loop
  // The system prompt already contains the workspace analysis, templates,
  // profile data, user memories, and proposed plan. Conversation history
  // provides continuity. No need for tools to re-fetch this data.
  const hasImages = !!input.imageAttachments && input.imageAttachments.length > 0;

  let latestUserContent: Anthropic.MessageParam['content'];
  if (hasImages) {
    const blocks: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [];
    for (const img of input.imageAttachments!) {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.media_type,
          data: img.base64,
        },
      });
    }
    blocks.push({
      type: 'text',
      text: `[The user attached ${input.imageAttachments!.length} image(s) above. Read them carefully (charts, workflows, screenshots) and use what you see to inform your response.]\n\n${input.userMessage}`,
    });
    latestUserContent = blocks;
  } else {
    latestUserContent = input.userMessage;
  }

  const messages: Anthropic.MessageParam[] = input.conversationHistory.length > 0
    ? [
        ...input.conversationHistory.slice(0, -1),
        { role: 'user' as const, content: latestUserContent },
      ]
    : [{ role: 'user' as const, content: latestUserContent }];

  const response = await anthropic.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  const rawContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  const wasTruncated = response.stop_reason === 'max_tokens';
  if (wasTruncated) {
    console.warn('[setupper-brain] Response hit max_tokens; snapshot may be truncated');
  }

  // Step 3b: Extract structure snapshot from the AI response (if present).
  // The AI outputs a JSON block between |||STRUCTURE_SNAPSHOT||| and
  // |||END_STRUCTURE||| delimiters. We strip it from the visible content and
  // return it separately. If the response was truncated mid-snapshot the
  // closing delimiter will be missing - we still strip everything from the
  // opening delimiter to the end so raw JSON never leaks into the chat UI.
  let finalContent = rawContent;
  let structureSnapshot: Record<string, unknown> | undefined;
  let snapshotDiagnostics: SnapshotDiagnostics | undefined;

  const closedSnapshot = rawContent.match(/\|\|\|STRUCTURE_SNAPSHOT\|\|\|\s*([\s\S]*?)\s*\|\|\|END_STRUCTURE\|\|\|/);
  const openSnapshot = closedSnapshot ? null : rawContent.match(/\|\|\|STRUCTURE_SNAPSHOT\|\|\|\s*([\s\S]*)$/);
  const snapshotBody = closedSnapshot?.[1] ?? openSnapshot?.[1];

  if (snapshotBody) {
    try {
      const parsed = JSON.parse(snapshotBody.trim());
      if (parsed && typeof parsed === 'object' && parsed.spaces) {
        // Server-side merge: enforce monotonicity. The model can intentionally
        // update properties of items, but it cannot accidentally drop nodes
        // the user explicitly named. Items present in the previous draft but
        // missing from this snapshot are preserved unless the model emitted
        // _intent: "full_replace" AND the user actually asked to restructure
        // (the merge applies an additional safety check on user phrasing).
        const merged = mergeSnapshotWithDiagnostics(
          input.chatStructureSnapshot,
          parsed,
          input.userMessage,
        );
        structureSnapshot = merged.snapshot;
        snapshotDiagnostics = { ...merged.diagnostics, truncatedResponse: wasTruncated };
      }
    } catch {
      // Truncated JSON is expected when stop_reason === max_tokens; in that
      // case we silently drop the snapshot for this turn (the previous
      // chatStructureSnapshot stays as the working draft) rather than
      // surfacing parse errors. For non-truncated parse failures we log.
      if (!wasTruncated) {
        console.error('[setupper-brain] Failed to parse structure snapshot JSON');
      }
    }
    finalContent = rawContent
      .replace(/\|\|\|STRUCTURE_SNAPSHOT\|\|\|\s*[\s\S]*?\s*\|\|\|END_STRUCTURE\|\|\|/, '')
      .replace(/\|\|\|STRUCTURE_SNAPSHOT\|\|\|[\s\S]*$/, '')
      .trim();
  }

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
    structureSnapshot,
    snapshotDiagnostics,
  };
}

// ---------------------------------------------------------------------------
// Draft selection + merge.
//
// Monotonicity rule: items the user explicitly named persist across turns.
// The model is instructed to start from the previous draft and modify in
// place. The merge below is the structural enforcement of that rule - if the
// model drops an item, we restore it unless the model flagged the snapshot as
// a deliberate full replacement (_intent: "full_replace").
// ---------------------------------------------------------------------------

interface DraftSpace {
  name?: string;
  purpose?: string;
  folders?: DraftFolder[];
  lists?: DraftList[];
  [key: string]: unknown;
}
interface DraftFolder {
  name?: string;
  lists?: DraftList[];
  [key: string]: unknown;
}
interface DraftList {
  name?: string;
  purpose?: string;
  taskExamples?: string[];
  statuses?: Array<{ name: string; type?: string }>;
  [key: string]: unknown;
}
interface DraftNamed { name?: string; [key: string]: unknown }

/** Pick the previous draft for system prompt injection. */
function pickPreviousDraft(
  chatSnapshot: Record<string, unknown> | undefined,
  proposedPlan: SetupperInput['proposedPlan'],
): Record<string, unknown> | null {
  if (chatSnapshot && typeof chatSnapshot === 'object' && Object.keys(chatSnapshot).length > 0) {
    return chatSnapshot;
  }
  if (proposedPlan?.spaces?.length) {
    return proposedPlan as unknown as Record<string, unknown>;
  }
  return null;
}

/** Case-insensitive name match used everywhere in the merge. */
function sameName(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function mergeNamedArray<T extends DraftNamed>(prev: T[] | undefined, next: T[] | undefined): T[] {
  const result: T[] = Array.isArray(next) ? [...next] : [];
  if (!Array.isArray(prev)) return result;
  for (const oldItem of prev) {
    if (!oldItem?.name) continue;
    const stillPresent = result.some(n => sameName(n.name, oldItem.name));
    if (!stillPresent) result.push(oldItem);
  }
  return result;
}

function mergeList(prev: DraftList, next: DraftList): DraftList {
  // Lists merge by taking the model's intentional updates (statuses,
  // taskExamples, purpose) but restoring any taskExamples that were present
  // before and silently dropped. Statuses are treated as a model decision
  // unless empty (then we preserve previous).
  const merged: DraftList = { ...prev, ...next };
  if (Array.isArray(next.statuses) && next.statuses.length === 0 && Array.isArray(prev.statuses) && prev.statuses.length > 0) {
    merged.statuses = prev.statuses;
  }
  if (Array.isArray(prev.taskExamples) && prev.taskExamples.length > 0) {
    const nextExamples = Array.isArray(next.taskExamples) ? next.taskExamples : [];
    const lower = new Set(nextExamples.map(t => t.toLowerCase().trim()));
    const restored = prev.taskExamples.filter(t => !lower.has(t.toLowerCase().trim()));
    if (restored.length > 0) merged.taskExamples = [...nextExamples, ...restored];
  }
  return merged;
}

function mergeFolder(prev: DraftFolder, next: DraftFolder): DraftFolder {
  const mergedLists = mergeNamedArray(prev.lists, next.lists).map(list => {
    const old = (prev.lists || []).find(l => sameName(l.name, list.name));
    return old ? mergeList(old, list) : list;
  });
  return { ...prev, ...next, lists: mergedLists };
}

function mergeSpace(prev: DraftSpace, next: DraftSpace): DraftSpace {
  const mergedFolders = mergeNamedArray(prev.folders, next.folders).map(folder => {
    const old = (prev.folders || []).find(f => sameName(f.name, folder.name));
    return old ? mergeFolder(old, folder) : folder;
  });
  const mergedLists = mergeNamedArray(prev.lists, next.lists).map(list => {
    const old = (prev.lists || []).find(l => sameName(l.name, list.name));
    return old ? mergeList(old, list) : list;
  });
  return { ...prev, ...next, folders: mergedFolders, lists: mergedLists };
}

/**
 * Heuristic: did the user actually authorize the model to throw out the
 * working draft and start from scratch? Without this guard the model can
 * unilaterally emit `_intent: "full_replace"` in response to an additive
 * request like "add goals", which silently nukes user-approved structure.
 */
function userAskedForRebuild(userMessage: string | undefined): boolean {
  if (!userMessage) return false;
  const m = userMessage.toLowerCase();
  return /\b(start over|from scratch|throw (this|it|them|everything) (out|away)|rebuild( this| it| everything| from)?|restart|wipe|reset|trash this|forget (everything|this)|clean slate|blank slate)\b/.test(m);
}

/**
 * Phase 3 snapshot ops. Before this phase the only way the model could
 * drop a node was `_intent: "full_replace"` (which we then had to guard
 * against because the model would emit it for additive requests like
 * "add goals"). Renames likewise produced duplicates because the
 * monotonicity merge kept both the old and the new name in the same
 * parent. The model now has explicit verbs:
 *   _rename: [{ from: "Client Management/New Clients",
 *               to:   "Client Management/New Prospects" }]
 *   _remove: [{ path: "Operations/All Test Projects" }]
 * Paths are slash-separated, name-based. Parent levels must match for a
 * rename (we only rename the leaf segment, not move across parents).
 */
interface RenameOp { from?: string; to?: string }
interface RemoveOp { path?: string }

function parsePath(path: string): string[] {
  return path.split('/').map(s => s.trim()).filter((s) => s.length > 0);
}

function findNodeByPath(
  snap: Record<string, unknown>,
  parts: string[],
): { node: DraftNamed } | null {
  if (parts.length === 0) return null;
  const spaces = (snap.spaces as DraftSpace[] | undefined) || [];
  const space = spaces.find((s) => sameName(s.name, parts[0]));
  if (!space) return null;
  if (parts.length === 1) return { node: space };
  if (parts.length === 2) {
    const list = (space.lists || []).find((l) => sameName(l.name, parts[1]));
    if (list) return { node: list };
    const folder = (space.folders || []).find((f) => sameName(f.name, parts[1]));
    if (folder) return { node: folder };
    return null;
  }
  if (parts.length === 3) {
    const folder = (space.folders || []).find((f) => sameName(f.name, parts[1]));
    if (!folder) return null;
    const list = (folder.lists || []).find((l) => sameName(l.name, parts[2]));
    if (list) return { node: list };
    return null;
  }
  return null;
}

function applyRenames(snap: Record<string, unknown>, renames: RenameOp[]): void {
  for (const op of renames) {
    if (!op?.from || !op?.to) continue;
    const fromParts = parsePath(op.from);
    const toParts = parsePath(op.to);
    if (fromParts.length === 0 || fromParts.length !== toParts.length) continue;
    // We only support leaf renames; the parent path must be identical.
    let parentMatches = true;
    for (let i = 0; i < fromParts.length - 1; i++) {
      if (!sameName(fromParts[i], toParts[i])) {
        parentMatches = false;
        break;
      }
    }
    if (!parentMatches) {
      console.warn('[setupper-brain] _rename across parents is unsupported, skipping:', op);
      continue;
    }
    const located = findNodeByPath(snap, fromParts);
    if (!located) continue;
    located.node.name = toParts[toParts.length - 1];
  }
}

function applyRemoves(snap: Record<string, unknown>, removes: RemoveOp[]): void {
  for (const op of removes) {
    if (!op?.path) continue;
    const parts = parsePath(op.path);
    if (parts.length === 0) continue;
    const spaces = (snap.spaces as DraftSpace[] | undefined) || [];
    if (parts.length === 1) {
      snap.spaces = spaces.filter((s) => !sameName(s.name, parts[0]));
      continue;
    }
    const space = spaces.find((s) => sameName(s.name, parts[0]));
    if (!space) continue;
    if (parts.length === 2) {
      space.lists = (space.lists || []).filter((l) => !sameName(l.name, parts[1]));
      space.folders = (space.folders || []).filter((f) => !sameName(f.name, parts[1]));
      continue;
    }
    if (parts.length === 3) {
      const folder = (space.folders || []).find((f) => sameName(f.name, parts[1]));
      if (!folder) continue;
      folder.lists = (folder.lists || []).filter((l) => !sameName(l.name, parts[2]));
    }
  }
}

function countLists(snapshot: Record<string, unknown> | undefined): number {
  if (!snapshot) return 0;
  const spaces = (snapshot.spaces as DraftSpace[] | undefined) || [];
  let count = 0;
  for (const space of spaces) {
    count += (space.lists?.length ?? 0);
    for (const folder of space.folders ?? []) {
      count += (folder.lists?.length ?? 0);
    }
  }
  return count;
}

interface MergeOutcome {
  snapshot: Record<string, unknown>;
  diagnostics: Omit<SnapshotDiagnostics, 'truncatedResponse'>;
}

function mergeSnapshotWithDiagnostics(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
  userMessage?: string,
): MergeOutcome {
  // The _intent flag is set by the model when the user explicitly asked to
  // restructure. If the model claimed full_replace but the user message
  // does not actually authorize a rebuild, downgrade to update so an
  // additive request like "add goals" never silently drops the draft.
  const declaredIntent = next._intent === 'full_replace' ? 'full_replace' : 'update';
  let effectiveIntent: 'update' | 'full_replace' = declaredIntent;
  let downgraded = false;
  if (declaredIntent === 'full_replace' && !userAskedForRebuild(userMessage)) {
    console.warn(
      '[setupper-brain] Model emitted _intent: "full_replace" but user message does not authorize a rebuild; downgrading to "update" to preserve the existing draft.',
    );
    effectiveIntent = 'update';
    downgraded = true;
  }

  const renames = Array.isArray(next._rename) ? (next._rename as RenameOp[]) : [];
  const removes = Array.isArray(next._remove) ? (next._remove as RemoveOp[]) : [];

  const cleaned: Record<string, unknown> = { ...next };
  delete cleaned._intent;
  delete cleaned._rename;
  delete cleaned._remove;

  const spacesBefore = (prev?.spaces as DraftSpace[] | undefined)?.length ?? 0;
  const listsBefore = countLists(prev);

  let merged: Record<string, unknown>;
  if (effectiveIntent === 'full_replace' || !prev || typeof prev !== 'object') {
    // For a full replace there is no prior draft to mutate, so renames
    // and removes are meaningless. The model may emit them anyway; we
    // silently drop them.
    merged = cleaned;
  } else {
    const prevSpaces = (prev.spaces as DraftSpace[] | undefined) || [];
    const nextSpaces = (cleaned.spaces as DraftSpace[] | undefined) || [];
    const mergedSpaces = mergeNamedArray(prevSpaces, nextSpaces).map(space => {
      const old = prevSpaces.find(s => sameName(s.name, space.name));
      return old ? mergeSpace(old, space) : space;
    });

    const mergedTags = mergeNamedArray(
      prev.recommended_tags as DraftNamed[] | undefined,
      cleaned.recommended_tags as DraftNamed[] | undefined,
    );
    const mergedDocs = mergeNamedArray(
      prev.recommended_docs as DraftNamed[] | undefined,
      cleaned.recommended_docs as DraftNamed[] | undefined,
    );

    merged = {
      ...prev,
      ...cleaned,
      spaces: mergedSpaces,
      recommended_tags: mergedTags,
      recommended_docs: mergedDocs,
    };

    // Renames first so a subsequent _remove can target the new path if
    // the model is removing something it just renamed.
    if (renames.length > 0) applyRenames(merged, renames);
    // Removes last so they always win - even if the model also emitted
    // the node in spaces this turn, the explicit remove wins.
    if (removes.length > 0) applyRemoves(merged, removes);
  }

  return {
    snapshot: merged,
    diagnostics: {
      intent: effectiveIntent,
      intentFullReplaceDowngraded: downgraded,
      spacesBefore,
      spacesAfter: (merged.spaces as DraftSpace[] | undefined)?.length ?? 0,
      listsBefore,
      listsAfter: countLists(merged),
      renameCount: renames.length,
      removeCount: removes.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Multi-agent orchestrator
//
// Decides whether this chat turn is a discovery turn (Clarifier, Haiku) or
// a post-generation refinement turn (Reviser, Sonnet). The decision is
// based purely on whether the canonical draft has both `coverage.ready === true`
// AND a non-empty spaces array - meaning discovery completed AND the user
// has clicked Generate Structure at some point.
// ---------------------------------------------------------------------------

function isReadyDraft(snap: Record<string, unknown> | undefined): boolean {
  if (!snap || typeof snap !== 'object') return false;
  const ready = snap.ready;
  const spaces = snap.spaces;
  return ready === true && Array.isArray(spaces) && spaces.length > 0;
}

async function routeMultiAgentTurn(input: SetupperInput): Promise<SetupperResult | null> {
  // We need the workspace analysis even on the multi-agent path so the
  // Clarifier can speak intelligently about what the user already has.
  // Reuse the same pre-computed analyzer output the legacy path uses.
  let workspaceAnalysis = input.precomputedAnalysis || '';
  if (!workspaceAnalysis && input.conversationHistory.length === 0) {
    try {
      const analysisResult = await executeSubAgent(
        getClient(),
        'workspace_analyst',
        'Provide a complete snapshot of the current workspace structure: all spaces, folders, lists, statuses, custom fields, and team members.',
        input.workspaceId,
      );
      workspaceAnalysis = analysisResult.summary;
    } catch (error) {
      console.error('[setupper-brain] Multi-agent analyzer failed:', error);
      workspaceAnalysis = 'Unable to analyze workspace. It may be empty or not connected.';
    }
  }

  const draft = input.chatStructureSnapshot;

  // Reviser path: discovery already done AND a plan exists in the draft.
  if (isReadyDraft(draft)) {
    const result = await runReviser({
      userMessage: input.userMessage,
      conversationHistory: input.conversationHistory,
      currentPlan: draft as Record<string, unknown>,
      brief: (draft?.brief as Record<string, unknown> | undefined) ?? null,
      planTier: input.planTier,
      industry: input.profileData?.industry,
    });
    return {
      content: result.content,
      creditsToCharge: result.creditsToCharge,
      totalInputTokens: result.totalInputTokens,
      totalOutputTokens: result.totalOutputTokens,
      anthropicCostCents: result.anthropicCostCents,
      toolCalls: result.toolCalls,
      structureSnapshot: result.structureSnapshot,
      snapshotDiagnostics: result.snapshotDiagnostics,
      role: 'reviser',
      ready: true,
    };
  }

  // Clarifier path: discovery in progress.
  const result = await runClarifier({
    userMessage: input.userMessage,
    workspaceId: input.workspaceId,
    userId: input.userId,
    conversationId: input.conversationId,
    conversationHistory: input.conversationHistory,
    precomputedAnalysis: workspaceAnalysis,
    planTier: input.planTier,
    chatStructureSnapshot: draft,
    profileData: input.profileData,
    imageAttachments: input.imageAttachments,
    attachmentDigestBlock: input.attachmentDigestBlock,
  });
  return {
    content: result.content,
    creditsToCharge: result.creditsToCharge,
    totalInputTokens: result.totalInputTokens,
    totalOutputTokens: result.totalOutputTokens,
    anthropicCostCents: result.anthropicCostCents,
    toolCalls: result.toolCalls,
    structureSnapshot: result.structureSnapshot,
    snapshotDiagnostics: result.snapshotDiagnostics,
    role: 'clarifier',
    ask: result.ask,
    brief: result.brief,
    ready: result.ready,
  };
}
