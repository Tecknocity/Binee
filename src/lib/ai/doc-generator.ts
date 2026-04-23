// Per-doc starter content generator. Called in the post-confirm enrichment
// phase (see src/lib/setup/enrichment-phase.ts). Uses Haiku 4.5 to produce
// rich, domain-aware markdown bodies so docs don't feel empty after setup.
//
// Priority of inputs (highest first):
//   1. purpose + outline from the planner (derived from the chat).
//   2. workspace context (domain, goal, team).
//   3. referenceSnippet: a topical excerpt from the knowledge base. Inspiration
//      for structure and voice only; never to override chat-derived context.
//
// Failures in this module must NEVER surface to the user. Callers are expected
// to catch, log silently via src/lib/errors/log.ts, and skip the doc.

import type Anthropic from '@anthropic-ai/sdk';
import type { WorkspaceContext } from '@/lib/setup/types';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2500;

let _anthropic: Anthropic | null = null;

async function getClient(): Promise<Anthropic> {
  if (!_anthropic) {
    const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
    _anthropic = new AnthropicSDK({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export interface DocGenerationInput {
  context: WorkspaceContext;
  docName: string;
  purpose: string;
  audience?: string;
  outline?: string[];
  /**
   * Optional topical snippet from ai_knowledge_base. Inspiration for structure
   * and voice only. The chat-derived purpose and outline always win.
   */
  referenceSnippet?: string;
}

const SYSTEM_PROMPT = `You write starter documentation for a newly-created ClickUp doc.

Your output is the raw markdown body of the doc. It must feel like real, useful documentation - not placeholder boilerplate.

SOURCE OF TRUTH ORDER:
1. The doc purpose and outline. These describe what the user actually wants documented.
2. The workspace context (domain, goal, team).
3. The reference snippet. Inspiration for section shape and voice only. If it suggests headings or content that do not fit this specific doc's purpose, discard them. Never copy the snippet verbatim.

OUTPUT CONTRACT:
- Return ONLY the markdown content. No JSON, no code fences wrapping the whole output, no meta commentary.
- Open with a short italicized lead-in sentence that states what the doc is for.
- Follow with H2 sections (## Heading) that match the provided outline when one is given. If no outline is given, pick 3-6 sections that fit the doc's purpose.
- Use bullet lists, numbered lists, short paragraphs. Bold key terms sparingly.
- Include at least one concrete worked example grounded in the user's domain. Reference the domain by name when natural. Do NOT use "[Company Name]" style placeholders - write real examples as if you know the business.
- Length: 400-1000 words. Dense and useful beats long and fluffy.
- End with a short "## How to use this doc" section describing how the team should treat and maintain it.

FORBIDDEN:
- No em dashes (-) or en dashes. Use hyphens, commas, or rephrase.
- No "Lorem ipsum", "TBD", "[Insert X here]", or placeholder brackets.
- No meta phrases like "As an AI" or "Here is your document".
- No generic boilerplate that would apply to any business.
- Never invent specifics (client names, numbers, dates, vendors) that do not appear in the purpose, outline, or workspace context. If a placeholder is needed, phrase generically.`;

function buildUserMessage(input: DocGenerationInput): string {
  const ctx = input.context;
  const lines: string[] = [
    '## Workspace context',
    `Domain: ${ctx.domain}`,
    `Primary goal: ${ctx.primaryGoal}`,
  ];
  if (ctx.teamShape) lines.push(`Team: ${ctx.teamShape}`);

  lines.push('', '## Doc to write');
  lines.push(`Title: ${input.docName}`);
  lines.push(`Purpose: ${input.purpose}`);
  if (input.audience) lines.push(`Audience: ${input.audience}`);

  if (input.outline?.length) {
    lines.push('', 'Section outline (use as H2 headings in order):');
    for (const section of input.outline) {
      lines.push(`- ${section}`);
    }
  }

  if (input.referenceSnippet && input.referenceSnippet.trim().length > 0) {
    lines.push('', '## Reference snippet (inspiration only, NEVER override the purpose/outline above)');
    lines.push(input.referenceSnippet.trim());
  }

  lines.push('', 'Write the markdown body now. Ground all examples in the domain above.');

  return lines.join('\n');
}

/**
 * Generate rich markdown content for a single doc. Throws on failure - caller
 * must catch and log silently.
 */
export async function generateDocContent(
  input: DocGenerationInput,
): Promise<string> {
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

  return cleanMarkdownResponse(text);
}

function cleanMarkdownResponse(text: string): string {
  let out = text.trim();

  if (out.startsWith('```')) {
    out = out.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```$/, '');
  }

  // Strip stray em/en dashes that may have slipped past the prompt. Replace
  // with " - " so sentence structure remains readable.
  out = out.replace(/[–—]/g, ' - ');

  if (out.length === 0) {
    throw new Error('Doc generator returned empty content');
  }

  return out;
}
