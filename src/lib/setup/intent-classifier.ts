import Anthropic from '@anthropic-ai/sdk';
import type {
  IntentClassificationOutput,
  SetupIntent,
} from './contracts';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';

/**
 * Intent classifier (Haiku, ~150-300ms per call).
 *
 * Reads the latest user message plus minimal state hints and returns one of
 * three intents. Used by the Setupper orchestrator to route each turn to the
 * right downstream agent without conflating routing with response generation.
 *
 * Design invariants (do not violate in future patches):
 * 1. The classifier never generates user-facing text. Only routing JSON.
 * 2. On any error - parse failure, API failure, unknown intent - the result
 *    is `fallbackUsed=true` with `confidence=0`. The caller MUST treat this
 *    as "use legacy routing", not as a real classification.
 * 3. Static prompt is cached (cache_control: ephemeral) so repeated calls
 *    pay only for the dynamic block.
 * 4. The classifier sees no images, no full conversation, no draft body.
 *    Just the message, recent turn context, and four boolean state hints.
 *    Keeping this narrow is what makes Haiku reliable here.
 */

export interface IntentClassifierStateHints {
  /** True when the user's ClickUp account already has spaces/lists/etc. */
  workspaceHasExistingStructure: boolean;
  /** True when the canonical draft has ready=true AND non-empty spaces. */
  draftHasReadyState: boolean;
  /** True when the user uploaded an image on this turn. */
  hasImagesThisTurn: boolean;
  /** How many discovery questions the Clarifier has asked. Cap is 5. */
  questionsAsked: number;
}

export interface IntentClassifierInput {
  userMessage: string;
  /** Last 1-2 turns of history pre-formatted as plain text. Empty string OK. */
  recentTurns: string;
  state: IntentClassifierStateHints;
}

export interface IntentClassification {
  intent: SetupIntent;
  /** 0..1. Always 0 when fallbackUsed=true. */
  confidence: number;
  /** Short human explanation. Always present so logs read well. */
  reasoning: string;
  /** True when parsing or the API failed and a safe default was returned. */
  fallbackUsed: boolean;
  /** Wall-clock for the Anthropic .messages.create() call. 0 on fallback. */
  modelCallMs: number;
  /** Stop reason for the model call. undefined on fallback. */
  modelStopReason?: string;
  /** Token usage for cost analytics. 0 on fallback. */
  inputTokens: number;
  outputTokens: number;
}

const STATIC_PROMPT = `You are Binee's setup-chat intent classifier. Your only job is to read one user message and decide which agent should handle it.

You output JSON. Nothing else. No commentary, no markdown fences.

THREE INTENTS:

1. "discovery" - the user is describing how they work, what their team looks like, what their process is, what they need a workspace to do. They are giving information that helps design a workspace.
   Examples:
   - "I run a small marketing agency, mostly content and social"
   - "We have 3 designers and 1 PM, work goes brief -> draft -> review -> launch"
   - "Mostly retainer clients, 4 of them, long-term"
   - "I'm a solo lawyer doing real estate closings"

2. "refine" - the user wants a specific change to a plan that has already been generated. Renames, additions, removals, status changes, adding a doc/tag/list to the draft.
   Examples:
   - "Rename Sales to Growth"
   - "Add a doc called Onboarding Checklist"
   - "Remove the Internal Projects space, I don't need it"
   - "Change the In Progress status to Active"
   - "Add a list for support tickets under the Operations space"
   Use this ONLY when state.draftHasReadyState is true. If there is no ready draft yet, the user is still designing - prefer discovery.

3. "info" - the user is asking a question, asking for analysis, asking what they have, opting out of structural changes, or making a request that does not require designing or modifying a workspace structure.
   Examples:
   - "What docs do I currently have in ClickUp?"
   - "What's my workspace structure right now?"
   - "Is my current setup good? What would you change?"
   - "I don't want to change my structure, just help me create some docs"
   - "What did I tell you earlier about my industry?"
   - "Continue from where we left off"
   - "Tell me what we discussed so far"

DECISION RULES:

- If state.hasImagesThisTurn is true, NEVER pick info. Images are structural source material - prefer discovery (or refine when draft is ready).
- If the user is reasonably interpreted as describing their work or team, prefer discovery.
- If the user is asking a question (words like "what / how / is / are / can you tell me / show me / describe / why"), prefer info.
- If the user explicitly opts out ("I don't want to change", "leave it alone", "skip this", "I just need", "I'm fine with what I have"), prefer info.
- If state.draftHasReadyState is false and the user is asking for an addition that sounds like a structural change ("add a list", "add a space"), prefer discovery instead of refine - they need to finish discovery first.
- When uncertain between discovery and info, choose discovery. (Better to ask one extra discovery question than to skip discovery entirely.)
- When uncertain between refine and info on a turn where the draft is ready, prefer refine only when the message clearly asks for a specific change. If the message is a question about the draft, choose info.

CONFIDENCE:
- 0.9-1.0 when the message is clearly one intent (asks a direct question, gives a clear description, requests a specific rename).
- 0.6-0.9 when the intent is reasonably clear but could be ambiguous.
- 0.0-0.6 when uncertain. The orchestrator will fall back to legacy routing on confidence below 0.6.

OUTPUT FORMAT (strict JSON, no markdown fences):

{
  "intent": "discovery" | "refine" | "info",
  "confidence": <number between 0 and 1>,
  "reasoning": "<one short sentence explaining the choice>"
}

The first character of your reply must be { and the last must be }.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Classify intent for a single setup chat turn.
 *
 * Returns a structured result. On any error (API failure, JSON parse failure,
 * unknown intent value) returns a safe-default classification with
 * `fallbackUsed=true` and `confidence=0`. The caller is expected to treat
 * fallback results as "do whatever legacy routing would have done".
 */
export async function classifyIntent(
  input: IntentClassifierInput,
): Promise<IntentClassification> {
  const safeFallback = (
    reasoning: string,
  ): IntentClassification => ({
    // Default to discovery on first turn, refine when draft is ready.
    // This mirrors what isReadyDraft-based routing would have picked, so the
    // fallback is bit-identical to legacy behavior.
    intent: input.state.draftHasReadyState ? 'refine' : 'discovery',
    confidence: 0,
    reasoning,
    fallbackUsed: true,
    modelCallMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  const dynamicContext = `STATE:
- workspaceHasExistingStructure: ${input.state.workspaceHasExistingStructure}
- draftHasReadyState: ${input.state.draftHasReadyState}
- hasImagesThisTurn: ${input.state.hasImagesThisTurn}
- questionsAsked: ${input.state.questionsAsked}

RECENT CONVERSATION:
${input.recentTurns.trim() || '(none)'}

USER MESSAGE:
${input.userMessage}`;

  let response: Anthropic.Message;
  const modelStart = Date.now();
  try {
    response = await getClient().messages.create({
      model: HAIKU_MODEL_ID,
      max_tokens: 200,
      system: [
        {
          type: 'text',
          text: STATIC_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: dynamicContext,
        },
      ],
      messages: [
        {
          role: 'user',
          content: 'Classify the user message above into one of {discovery, refine, info} and emit the JSON object.',
        },
      ],
    });
  } catch (err) {
    console.error('[setup-intent] classifier API call failed:', err);
    return safeFallback('classifier API call failed; using legacy routing equivalent');
  }
  const modelCallMs = Date.now() - modelStart;

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const parsed = parseIntent(rawText);
  if (!parsed) {
    console.warn('[setup-intent] classifier emitted unparseable output:', rawText);
    return {
      ...safeFallback('classifier emitted unparseable output; using legacy routing equivalent'),
      modelCallMs,
      modelStopReason: response.stop_reason ?? undefined,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  return {
    intent: parsed.intent,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    fallbackUsed: false,
    modelCallMs,
    modelStopReason: response.stop_reason ?? undefined,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Parse strict JSON. Strip optional markdown fences if Haiku adds them.
 * Returns null on any shape mismatch.
 */
function parseIntent(raw: string): IntentClassificationOutput | null {
  if (!raw) return null;
  const trimmed = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const tryParse = (s: string): IntentClassificationOutput | null => {
    try {
      const obj = JSON.parse(s) as Record<string, unknown>;
      if (!isValidIntent(obj.intent)) return null;
      const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0;
      const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : '';
      return { intent: obj.intent, confidence, reasoning };
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return tryParse(match[0]);
}

function isValidIntent(v: unknown): v is SetupIntent {
  return v === 'discovery' || v === 'refine' || v === 'info';
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Format the last few turns of conversation history into a compact string for
 * the classifier. Pulls from the tail of the Anthropic message array; assumes
 * the array alternates user/assistant correctly (the route enforces that).
 */
export function formatRecentTurnsForClassifier(
  history: Anthropic.MessageParam[],
  turnCount = 2,
): string {
  if (history.length === 0) return '';
  const tail = history.slice(-turnCount * 2);
  const lines: string[] = [];
  for (const m of tail) {
    const text = extractTextFromContent(m.content);
    if (!text) continue;
    const role = m.role === 'user' ? 'User' : 'Assistant';
    lines.push(`${role}: ${text.slice(0, 280)}`);
  }
  return lines.join('\n');
}

function extractTextFromContent(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b): b is Anthropic.TextBlockParam => (b as { type?: string }).type === 'text')
    .map((b) => b.text)
    .join(' ');
}
