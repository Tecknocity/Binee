import Anthropic from '@anthropic-ai/sdk';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import { loadUserMemories } from '@/lib/ai/user-memory';
import type { ImageAttachmentPayload } from '@/types/ai';
import type { ClarifierAsk, Coverage, WorkspaceBrief } from './contracts';
import type { SnapshotDiagnostics } from './setupper-brain';

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';

/**
 * Info Handler (Sonnet).
 *
 * Handles setup chat turns that the intent classifier marked as "info":
 *   - Questions about the user's existing ClickUp workspace
 *   - Health-check style questions ("is my structure good?")
 *   - Recall questions ("what did I tell you?")
 *   - Explicit discovery opt-outs ("I just want to add docs, don't change structure")
 *
 * Hard guarantees this handler honors (in service of preventing the regression
 * classes that have bitten the setup chat before):
 *
 * 1. NEVER writes to setup_drafts. The handler is read-only on the draft.
 *    Discovery state - coverage, brief, ready, questions_asked - is preserved
 *    untouched across info turns. The result has no `structureSnapshot`, so
 *    the chat route never persists anything from this handler to the draft.
 *
 * 2. ECHOES prior `brief` and `ready` from the draft into its result, so the
 *    UI store at useSetup.ts:1113-1131 doesn't unconditionally null these
 *    out. The "What I've gathered" panel and Generate Structure highlight
 *    survive an info turn intact.
 *
 * 3. CONSUMES all 9 context streams (history, summary, profile, workspace
 *    analysis, draft, memories, attachment digests, current-turn images,
 *    inlined files via userMessage) so the model has the same memory the
 *    Clarifier and the legacy Setupper had. No stream is silently dropped.
 *
 * 4. The system prompt forbids discovery questions and JSON snapshots so the
 *    handler can never turn into a second Clarifier or accidentally produce
 *    a structure snapshot the route would then merge.
 */

export interface InfoHandlerInput {
  userMessage: string;
  workspaceId: string;
  userId: string;
  conversationHistory: Anthropic.MessageParam[];
  profileData?: {
    industry?: string;
    workStyle?: string;
    services?: string;
    teamSize?: string;
  };
  /** Existing ClickUp structure (precomputed by the analyzer). */
  workspaceAnalysis?: string;
  /** The canonical draft. Read-only here. */
  chatStructureSnapshot?: Record<string, unknown>;
  /** Per-conversation attachment digest block from chat_attachments. */
  attachmentDigestBlock?: string;
  /** Vision blocks for any image uploaded on this turn. */
  imageAttachments?: ImageAttachmentPayload[];
  /** ClickUp plan tier (free/unlimited/business/...) - shapes what we can suggest. */
  planTier?: string | null;
}

export interface InfoHandlerResult {
  content: string;
  creditsToCharge: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  anthropicCostCents: number;
  toolCalls: string[];
  /**
   * Always undefined. The Info Handler must not write to setup_drafts.
   * Declared for shape-compatibility with the SetupperResult union the
   * orchestrator returns.
   */
  structureSnapshot?: undefined;
  snapshotDiagnostics?: SnapshotDiagnostics;
  /** Echoed from prior draft so the UI store keeps its discovery state. */
  ask?: ClarifierAsk;
  brief?: WorkspaceBrief;
  ready?: boolean;
  modelCallMs: number;
  modelStopReason?: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const STATIC_SYSTEM_PROMPT = `You are Binee, an expert business operations consultant helping a user during workspace setup. The user has just asked a question or made an info-style request. Your job is to answer their question directly using the context provided. You do not design or modify their workspace structure on this turn.

WHAT YOU DO:
- Answer the user's question directly with specific details from their context.
- If they ask "is my structure good?" or "what would you keep / change?", give evidence-based recommendations grounded in the workspace analysis and the current draft. Reference specific spaces, lists, or items by name.
- If they ask what they have or what was discussed, recall from the relevant context block. Cite specifics (counts, names) rather than generalities.
- If they want to add a doc, list, or tag, explain that the next step depends on where they are. If discovery is in progress, they should tell you about that area so the design accounts for it. If a draft is already generated, the next message can be a direct edit (e.g., "add a doc called Onboarding Checklist") which the system will apply.
- If something they ask about was not in the context (e.g., they ask about docs but the workspace analysis only listed spaces and lists), say so honestly. Offer to check it on a follow-up turn rather than guess.

WHAT YOU DO NOT DO:
- Do NOT ask discovery questions like "tell me how your work is split" or "what stages does your project go through". The user is not in discovery right now. They have explicitly asked for something else this turn. Discovery resumes when the user asks for it.
- Do NOT propose a new workspace structure, a list of spaces, or a redesign. The user has not asked for one.
- Do NOT emit any JSON, |||delimiters|||, coverage state, brief, ready flag, or any structured output. Plain prose only.
- Do NOT claim to have made changes in ClickUp. You cannot. You can only describe what is in the draft and the analysis.
- Do NOT fabricate data. Only reference what is in the provided context. If a fact was not retrieved (e.g., docs, goals, automations were not in the workspace analysis), say "I did not check that yet" or offer to look it up. Do NOT claim the workspace has zero of something unless that was explicitly confirmed.
- Do NOT echo back the entire draft. Reference items by name as needed.

TONE:
Concise and warm. You are a consultant who answers what the user asked, not a chatbot who steers them toward another topic. Aim for 1-3 short paragraphs unless the user asks for detail.

NEVER use em dashes or en dashes in your reply. Use a hyphen, a comma, a period, or rephrase the sentence.

The context blocks below are your knowledge for this turn. Read them before responding.`;

/**
 * Run one Info Handler turn.
 *
 * Calls Sonnet with the full setup context. Reads prior `ask`/`brief`/`ready`
 * from the draft and returns them unchanged so the UI store at
 * useSetup.ts:1113-1131 stays consistent across the turn. Does NOT write to
 * setup_drafts.
 */
export async function runInfoHandler(input: InfoHandlerInput): Promise<InfoHandlerResult> {
  const anthropic = getClient();

  // Stream 6: user memories. Skip 'profile' category since the company
  // identity block already contains profile data (mirrors setupper-brain).
  const userMemories = await loadUserMemories(input.userId, input.workspaceId, ['profile']);

  // Build the dynamic context block. Every stream is fed through verbatim or
  // marked as absent; the model needs to see "stream X was not provided"
  // explicitly so it knows when to admit ignorance.
  const dynamicContext = buildDynamicContext({
    profileData: input.profileData,
    workspaceAnalysis: input.workspaceAnalysis,
    chatStructureSnapshot: input.chatStructureSnapshot,
    userMemories,
    attachmentDigestBlock: input.attachmentDigestBlock,
    planTier: input.planTier,
  });

  // Build the latest user content (text + optional images).
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
      text: `[The user attached ${input.imageAttachments!.length} image(s) above. Use them to inform your answer if relevant. Do not ask discovery questions about them; the user wants an answer to their text question.]\n\n${input.userMessage}`,
    });
    latestUserContent = blocks;
  } else {
    latestUserContent = input.userMessage;
  }

  // The conversation history we receive already has the user's latest
  // message at the tail (the route inserts it before calling the brain).
  // Replace that tail with our augmented content (text + images) so vision
  // blocks get attached to the right turn.
  const messages: Anthropic.MessageParam[] = input.conversationHistory.length > 0
    ? [
        ...input.conversationHistory.slice(0, -1),
        { role: 'user' as const, content: latestUserContent },
      ]
    : [{ role: 'user' as const, content: latestUserContent }];

  const modelStart = Date.now();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: 2048,
    // Two-block system: static instructions are cached after the first call.
    system: [
      {
        type: 'text',
        text: STATIC_SYSTEM_PROMPT,
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

  const rawContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Belt-and-suspenders: if the model accidentally emitted a structure
  // snapshot block (it should not, the prompt forbids it), strip it before
  // it leaks into the visible chat. Never persist it.
  const cleanContent = stripAccidentalSnapshot(rawContent);

  // Echo prior ask/brief/ready from the draft so the UI store keeps state.
  // Reading these is the entire reason this handler must accept the draft.
  const priorClarifier = readClarifierFields(input.chatStructureSnapshot);

  // Cost + classification. Setup is always premium per
  // billing/engine/flat-credit-classifier.classifyMessageCost(isSetup=true).
  const anthropicCost = calculateAnthropicCost({
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    model: 'sonnet',
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
    content: cleanContent || "I wasn't able to answer that. Please try rephrasing the question.",
    creditsToCharge: classification.creditsToCharge,
    totalInputTokens,
    totalOutputTokens,
    anthropicCostCents: anthropicCost.totalCostCents,
    toolCalls: [],
    // Echoed pass-throughs (UI-store stability).
    brief: priorClarifier.brief,
    ready: priorClarifier.ready,
    // ask is transient per-turn (the Clarifier emits it fresh each turn and
    // it is not persisted on the draft). On info turns the chip bubble has
    // no current ask. The UI does not currently render the chip bubble, so
    // setting this to undefined has no UX impact today. If chip rendering
    // ships later, persist `ask` on setup_drafts.draft and read it here.
    ask: undefined,
    modelCallMs,
    modelStopReason: response.stop_reason ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface DynamicContextInput {
  profileData?: InfoHandlerInput['profileData'];
  workspaceAnalysis?: string;
  chatStructureSnapshot?: Record<string, unknown>;
  userMemories: string;
  attachmentDigestBlock?: string;
  planTier?: string | null;
}

function buildDynamicContext(input: DynamicContextInput): string {
  const sections: string[] = [];

  // Stream 3: profile.
  const profileLines = [
    input.profileData?.industry && `Industry: ${input.profileData.industry}`,
    input.profileData?.workStyle && `Work style: ${input.profileData.workStyle}`,
    input.profileData?.services && `Services / Products: ${input.profileData.services}`,
    input.profileData?.teamSize && `Team size: ${input.profileData.teamSize}`,
    input.planTier && `ClickUp plan: ${input.planTier}`,
  ].filter(Boolean);
  sections.push(
    `PROFILE:\n${profileLines.length > 0 ? profileLines.join('\n') : '(no profile data captured yet)'}`,
  );

  // Stream 4: existing workspace analysis.
  const analysis = input.workspaceAnalysis?.trim();
  if (analysis && analysis.length > 0) {
    sections.push(
      `EXISTING CLICKUP STRUCTURE (what is already in the user's account; this is NOT the draft you are building):\n${analysis}`,
    );
  } else {
    sections.push(
      'EXISTING CLICKUP STRUCTURE: not analyzed yet on this turn. Do not claim the workspace is empty - say you have not checked.',
    );
  }

  // Stream 5: chat draft (read-only).
  const draft = input.chatStructureSnapshot;
  if (draft && typeof draft === 'object' && Object.keys(draft).length > 0) {
    sections.push(
      `CHAT DRAFT (the proposed structure being designed in this conversation; you can describe it but do NOT modify it on this turn):\n${JSON.stringify(draft)}`,
    );
  } else {
    sections.push('CHAT DRAFT: nothing drafted yet for this conversation.');
  }

  // Stream 6: user memories.
  if (input.userMemories.trim().length > 0) {
    sections.push(input.userMemories.trim());
  }

  // Stream 7: attachment digests (cross-turn memory of uploads).
  if (input.attachmentDigestBlock && input.attachmentDigestBlock.trim().length > 0) {
    sections.push(input.attachmentDigestBlock.trim());
  }

  return sections.join('\n\n');
}

/**
 * Defensively strip any accidental |||STRUCTURE_SNAPSHOT||| block from the
 * model's reply. The system prompt forbids snapshots, but Sonnet can drift
 * if the conversation history contains snapshots from prior Clarifier or
 * Reviser turns. We never want raw JSON to surface in the visible chat.
 */
function stripAccidentalSnapshot(raw: string): string {
  return raw
    .replace(/\|\|\|STRUCTURE_SNAPSHOT\|\|\|\s*[\s\S]*?\s*\|\|\|END_STRUCTURE\|\|\|/, '')
    .replace(/\|\|\|STRUCTURE_SNAPSHOT\|\|\|[\s\S]*$/, '')
    .trim();
}

/**
 * Same shape as the helper inside clarifier.ts (which is module-private). We
 * duplicate it here rather than export it from clarifier.ts to keep the
 * Clarifier untouched in this PR.
 */
interface ReadClarifierResult {
  coverage?: Coverage;
  ready?: boolean;
  brief?: WorkspaceBrief;
  questions_asked?: number;
}
function readClarifierFields(snap: Record<string, unknown> | undefined): ReadClarifierResult {
  if (!snap || typeof snap !== 'object') return {};
  const out: ReadClarifierResult = {};
  if (snap.coverage && typeof snap.coverage === 'object') {
    out.coverage = snap.coverage as Coverage;
  }
  if (typeof snap.ready === 'boolean') out.ready = snap.ready;
  if (snap.brief && typeof snap.brief === 'object') {
    out.brief = snap.brief as WorkspaceBrief;
  }
  if (typeof snap.questions_asked === 'number') out.questions_asked = snap.questions_asked;
  return out;
}
