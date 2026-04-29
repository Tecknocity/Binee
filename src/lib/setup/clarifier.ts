import Anthropic from '@anthropic-ai/sdk';
import { buildClarifierPrompt } from '@/lib/ai/prompts/clarifier-prompt';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import {
  type Coverage,
  type ClarifierOutput,
  type ClarifierAsk,
  type WorkspaceBrief,
  type DraftClarifierFields,
  emptyCoverage,
  isCoverageReady,
} from './contracts';
import type { ImageAttachmentPayload } from '@/types/ai';
import type { SnapshotDiagnostics } from './setupper-brain';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';

const QUESTION_HARD_CAP = 5;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface ClarifierInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  conversationHistory: Anthropic.MessageParam[];
  precomputedAnalysis?: string;
  planTier?: string | null;
  /** Previous draft from setup_drafts. Includes prior spaces/tags/docs and coverage. */
  chatStructureSnapshot?: Record<string, unknown>;
  profileData?: {
    industry?: string;
    workStyle?: string;
    services?: string;
    teamSize?: string;
  };
  imageAttachments?: ImageAttachmentPayload[];
  attachmentDigestBlock?: string;
}

export interface ClarifierResult {
  /** Plain-text message shown to the user. */
  content: string;
  creditsToCharge: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  anthropicCostCents: number;
  toolCalls: string[];
  /** Merged snapshot that includes coverage/ready/brief plus prior structure preserved. */
  structureSnapshot?: Record<string, unknown>;
  /** Diagnostics for the audit trail. Reuses the same shape as the Generator path. */
  snapshotDiagnostics?: SnapshotDiagnostics;
  /** Decoded structured output, exposed so the route can render chips client-side. */
  ask?: ClarifierAsk;
  brief?: WorkspaceBrief;
  ready: boolean;
}

/**
 * Run one Clarifier turn (Haiku). Parses strict JSON output, applies the
 * 5-question hard cap, persists coverage state into setup_drafts.draft.
 *
 * Discovery state is additive to the existing draft - we never touch
 * spaces/tags/docs the Generator may have already produced. Coverage
 * lives on the same row so a Generator call later can read it.
 */
export async function runClarifier(input: ClarifierInput): Promise<ClarifierResult> {
  const anthropic = getClient();

  const isSolo = (input.profileData?.teamSize ?? '').trim().startsWith('1');

  const priorClarifier = readClarifierFields(input.chatStructureSnapshot);
  const priorCoverage = priorClarifier.coverage ?? autoSkipFromProfile(emptyCoverage(), { isSolo });
  const priorQuestionsAsked = priorClarifier.questions_asked ?? 0;

  const systemPrompt = buildClarifierPrompt({
    industry: input.profileData?.industry,
    workStyle: input.profileData?.workStyle,
    services: input.profileData?.services,
    teamSize: input.profileData?.teamSize,
    planTier: input.planTier,
    workspaceAnalysis: input.precomputedAnalysis,
    previousDraft: input.chatStructureSnapshot ?? null,
    attachmentDigestBlock: input.attachmentDigestBlock,
  });

  const hasImages = !!input.imageAttachments && input.imageAttachments.length > 0;

  let latestUserContent: Anthropic.MessageParam['content'];
  if (hasImages) {
    const blocks: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [];
    for (const img of input.imageAttachments!) {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: img.media_type, data: img.base64 },
      });
    }
    blocks.push({
      type: 'text',
      text: `[Attached ${input.imageAttachments!.length} image(s). Use them to fill discovery slots without asking.]\n\n${input.userMessage}`,
    });
    latestUserContent = blocks;
  } else {
    latestUserContent = input.userMessage;
  }

  // Append a structured system reminder of current state so the model can't
  // forget the cap or re-ask a closed topic. This is belt-and-suspenders -
  // the prompt rules already say so, but Haiku is small and the explicit
  // reminder is cheap.
  const stateReminder = `\n\nCURRENT COVERAGE STATE (do not re-ask filled or user_skipped topics):
${JSON.stringify(priorCoverage)}
QUESTIONS ASKED SO FAR: ${priorQuestionsAsked} (hard cap: ${QUESTION_HARD_CAP})
${priorQuestionsAsked >= QUESTION_HARD_CAP ? 'HARD CAP REACHED. You MUST set ready=true this turn. Fill remaining unfilled slots with industry defaults and emit the brief.' : ''}`;

  const messages: Anthropic.MessageParam[] = input.conversationHistory.length > 0
    ? [
        ...input.conversationHistory.slice(0, -1),
        { role: 'user' as const, content: latestUserContent },
      ]
    : [{ role: 'user' as const, content: latestUserContent }];

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL_ID,
    max_tokens: 1500,
    system: systemPrompt + stateReminder,
    messages,
  });

  const totalInputTokens = response.usage.input_tokens;
  const totalOutputTokens = response.usage.output_tokens;
  const wasTruncated = response.stop_reason === 'max_tokens';

  const rawContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Parse strict JSON. Fall back to a graceful "ask the next unfilled topic"
  // if the model emits invalid JSON - never crash the chat turn.
  const parsed = parseClarifierOutput(rawContent);
  const decoded = parsed ?? fallbackOutput(priorCoverage, priorQuestionsAsked);

  // Enforce hard cap server-side regardless of what the model said.
  const askedThisTurn = decoded.ask ? 1 : 0;
  const newQuestionsAsked = priorQuestionsAsked + askedThisTurn;
  let coverage = sanitizeCoverage(decoded.coverage, priorCoverage);
  let ready = decoded.ready === true;
  let ask = decoded.ask;
  let brief = decoded.brief;

  // Loop killer: a topic in priorCoverage that was already filled or
  // user_skipped cannot be re-asked. If the model tried, drop the ask and
  // pick the next still-unfilled topic so discovery doesn't stall.
  if (ask) {
    const priorState = priorCoverage[ask.topic];
    if (priorState !== 'unfilled') {
      console.warn(
        `[clarifier] Model tried to re-ask closed topic "${ask.topic}" (state: ${priorState}); rerouting to next unfilled topic.`,
      );
      const nextTopic = COVERAGE_KEYS.find((k) => coverage[k] === 'unfilled');
      ask = nextTopic
        ? { topic: nextTopic, question: openQuestionFor(nextTopic), suggested_options: [] }
        : undefined;
    }
  }

  // Force-close discovery if hard cap reached or coverage complete.
  if (newQuestionsAsked >= QUESTION_HARD_CAP || isCoverageReady(coverage)) {
    coverage = fillDefaultsForUnfilled(coverage);
    ready = true;
    ask = undefined;
    if (!brief) brief = synthesizeBriefFallback(coverage, input.profileData);
  }

  // Build the next snapshot: prior structure preserved + clarifier fields
  // updated. We deliberately do not call mergeSnapshotWithDiagnostics here
  // because the Clarifier never writes structure - the Generator does.
  const nextSnapshot: Record<string, unknown> = {
    ...(input.chatStructureSnapshot ?? {}),
    coverage,
    ready,
    questions_asked: newQuestionsAsked,
  };
  if (brief) nextSnapshot.brief = brief;

  // Diagnostics: reuse the same shape so the audit row works unchanged.
  const spacesBefore = countSpaces(input.chatStructureSnapshot);
  const listsBefore = countLists(input.chatStructureSnapshot);
  const snapshotDiagnostics: SnapshotDiagnostics = {
    intent: 'update',
    intentFullReplaceDowngraded: false,
    truncatedResponse: wasTruncated,
    spacesBefore,
    spacesAfter: spacesBefore,
    listsBefore,
    listsAfter: listsBefore,
    renameCount: 0,
    removeCount: 0,
  };

  const anthropicCost = calculateAnthropicCost({
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    model: 'haiku',
  });

  const classification = classifyMessageCost({
    subAgentCalls: 0,
    toolCallCount: 0,
    imageCount: input.imageAttachments?.length ?? 0,
    fileCount: 0,
    hasWriteOps: false,
    isSetup: true,
  });

  return {
    content: decoded.message || 'Got it. Let me think about that for a moment.',
    creditsToCharge: classification.creditsToCharge,
    totalInputTokens,
    totalOutputTokens,
    anthropicCostCents: anthropicCost.totalCostCents,
    toolCalls: [],
    structureSnapshot: nextSnapshot,
    snapshotDiagnostics,
    ask,
    brief,
    ready,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readClarifierFields(snap: Record<string, unknown> | undefined): DraftClarifierFields {
  if (!snap || typeof snap !== 'object') return {};
  const out: DraftClarifierFields = {};
  if (snap.coverage && typeof snap.coverage === 'object') {
    out.coverage = snap.coverage as Coverage;
  }
  if (typeof snap.ready === 'boolean') out.ready = snap.ready;
  if (snap.brief && typeof snap.brief === 'object') {
    out.brief = snap.brief as WorkspaceBrief;
  }
  if (typeof snap.questions_asked === 'number') {
    out.questions_asked = snap.questions_asked;
  }
  return out;
}

function autoSkipFromProfile(c: Coverage, opts: { isSolo: boolean }): Coverage {
  if (opts.isSolo) return { ...c, collaboration: 'user_skipped' };
  return c;
}

function parseClarifierOutput(raw: string): ClarifierOutput | null {
  if (!raw) return null;
  // Strip optional markdown code fences if the model added them.
  const trimmed = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.message !== 'string') return null;
    if (typeof parsed.ready !== 'boolean') return null;
    if (typeof parsed.coverage !== 'object' || parsed.coverage === null) return null;
    return parsed as ClarifierOutput;
  } catch {
    // Try to extract the first {...} block if the model wrapped it.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      if (typeof parsed?.message === 'string' && typeof parsed.ready === 'boolean' && parsed.coverage) {
        return parsed as ClarifierOutput;
      }
    } catch {
      // give up
    }
    return null;
  }
}

const COVERAGE_KEYS: Array<keyof Coverage> = [
  'primary_entities',
  'organization',
  'lifecycle',
  'collaboration',
  'tracking_data',
];

function sanitizeCoverage(c: Partial<Coverage> | undefined, prior: Coverage): Coverage {
  const out: Coverage = { ...prior };
  for (const k of COVERAGE_KEYS) {
    const v = c?.[k];
    if (v === 'filled' || v === 'user_skipped' || v === 'unfilled') {
      // Monotonicity: once filled or user_skipped, do not regress to unfilled.
      if (prior[k] !== 'unfilled' && v === 'unfilled') continue;
      out[k] = v;
    }
  }
  return out;
}

function fillDefaultsForUnfilled(c: Coverage): Coverage {
  const out = { ...c };
  for (const k of COVERAGE_KEYS) {
    if (out[k] === 'unfilled') out[k] = 'user_skipped';
  }
  return out;
}

function fallbackOutput(prior: Coverage, askedSoFar: number): ClarifierOutput {
  // Used when the model returned invalid JSON. Pick the first unfilled
  // topic and ask its open question. If everything is filled, close
  // discovery with a generic ready brief.
  const nextTopic = COVERAGE_KEYS.find((k) => prior[k] === 'unfilled');
  if (!nextTopic || askedSoFar >= QUESTION_HARD_CAP) {
    return {
      message: "Got it. I have what I need - click **Generate Structure** when you're ready, or tell me what to adjust.",
      coverage: fillDefaultsForUnfilled(prior),
      ready: true,
      brief: synthesizeBriefFallback(fillDefaultsForUnfilled(prior), undefined),
    };
  }
  return {
    message: 'Let me ask one more thing to make sure the structure fits.',
    ask: {
      topic: nextTopic,
      question: openQuestionFor(nextTopic),
      suggested_options: [],
    },
    coverage: prior,
    ready: false,
  };
}

function openQuestionFor(topic: keyof Coverage): string {
  switch (topic) {
    case 'primary_entities':
      return 'Tell me how your work is split. What are the main areas you spend time on day-to-day?';
    case 'organization':
      return 'Inside that work, how do you organize it - by client, by project, by something else?';
    case 'lifecycle':
      return 'Take one project from when it lands to when it is truly done. What stages does it go through?';
    case 'collaboration':
      return 'Who else is involved in the work?';
    case 'tracking_data':
      return 'What information do you need to track for each project - the stuff you would otherwise keep in a spreadsheet?';
  }
}

function synthesizeBriefFallback(
  coverage: Coverage,
  profile: ClarifierInput['profileData'],
): WorkspaceBrief {
  const industry = profile?.industry?.trim() || 'your business';
  const defaults: Array<keyof Coverage> = COVERAGE_KEYS.filter((k) => coverage[k] === 'user_skipped');
  return {
    summary: `Here's what I have so far for ${industry}. Click **Generate Structure** to see the full layout, or tell me what to adjust.`,
    primary_entities: profile?.services || 'general project work',
    organization: profile?.workStyle || 'project-based',
    lifecycle: ['Intake', 'In Progress', 'Review', 'Done'],
    collaboration: (profile?.teamSize ?? '').trim().startsWith('1') ? 'Solo' : 'Small team',
    tracking_data: ['Deadline', 'Priority'],
    industry_defaults_used: defaults,
  };
}

function countSpaces(snap: Record<string, unknown> | undefined): number {
  if (!snap) return 0;
  const spaces = snap.spaces;
  return Array.isArray(spaces) ? spaces.length : 0;
}

interface SpaceLike { lists?: unknown[]; folders?: Array<{ lists?: unknown[] }> }
function countLists(snap: Record<string, unknown> | undefined): number {
  if (!snap) return 0;
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
