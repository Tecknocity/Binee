/**
 * Attachment ingestion for the setup chat.
 *
 * Phase 2 architectural piece: every file or image the user uploads is
 * persisted as a chat_attachments row with a Haiku-generated digest. The
 * full bytes / text are sent to Sonnet on the turn the upload happened;
 * on every later turn the system prompt only carries the short digest, so
 * the model "remembers" past uploads without us paying token cost to
 * re-send megabytes of base64.
 *
 * Boundaries enforced here:
 *  - Image base64 is capped at IMAGE_BASE64_CAP (~5MB binary).
 *  - Extracted text is head+tail truncated above EXTRACTED_TEXT_CAP.
 *  - Exactly one of (raw_base64, extracted_text) is populated per row,
 *    matching the chat_attachments_content_oneof CHECK constraint.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';

const IMAGE_BASE64_CAP = 7_000_000;        // ~5MB binary after base64
const EXTRACTED_TEXT_CAP = 64_000;         // chars; longer is head+tail truncated
const DIGEST_MAX_TOKENS = 280;             // ~200 tokens of prose + buffer

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface AttachmentUploadInput {
  workspace_id: string;
  conversation_id: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  /** Base64-encoded bytes for image uploads (no data: prefix). */
  raw_base64?: string;
  /** Pre-parsed plain text for CSV/XLSX/TXT/MD (client parses these today). */
  extracted_text?: string;
}

export interface PersistedAttachment {
  id: string;
  filename: string;
  media_type: string;
  digest: string | null;
}

/**
 * Persist a single attachment and generate its digest. Used by
 * /api/setup/attachments/upload. The caller is responsible for auth and
 * workspace-membership checks; this function just does the storage +
 * digest pipeline.
 */
export async function persistAttachment(
  supabase: SupabaseClient,
  input: AttachmentUploadInput,
): Promise<PersistedAttachment> {
  const isImage = SUPPORTED_IMAGE_TYPES.has(input.media_type);

  if (isImage) {
    if (!input.raw_base64) {
      throw new Error('Image attachment requires raw_base64');
    }
    if (input.raw_base64.length > IMAGE_BASE64_CAP) {
      throw new Error('Image too large (max 5MB)');
    }
  } else {
    if (!input.extracted_text || input.extracted_text.trim().length === 0) {
      throw new Error('File attachment requires extracted_text');
    }
  }

  const extracted = isImage
    ? null
    : capTextWithMarker(input.extracted_text!.trim(), EXTRACTED_TEXT_CAP);

  // Generate the digest BEFORE inserting so that if Haiku errors out we do
  // not end up with a half-baked row. A null digest is acceptable (we
  // tolerate it in the prompt builder); a wrong-shape digest is not.
  let digest: string | null = null;
  try {
    digest = isImage
      ? await digestImage(input.raw_base64!, input.media_type, input.filename)
      : await digestText(extracted!, input.media_type, input.filename);
  } catch (err) {
    console.error('[attachments] Haiku digest failed; persisting without digest:', err);
    digest = null;
  }

  const { data, error } = await supabase
    .from('chat_attachments')
    .insert({
      workspace_id: input.workspace_id,
      conversation_id: input.conversation_id,
      filename: input.filename,
      media_type: input.media_type,
      size_bytes: input.size_bytes,
      raw_base64: isImage ? input.raw_base64 : null,
      extracted_text: extracted,
      digest,
    })
    .select('id, filename, media_type, digest')
    .single();

  if (error || !data) {
    throw new Error(`Failed to persist attachment: ${error?.message ?? 'unknown error'}`);
  }

  return {
    id: data.id as string,
    filename: data.filename as string,
    media_type: data.media_type as string,
    digest: data.digest as string | null,
  };
}

/**
 * Load attachments belonging to a conversation. The chat route uses this to
 * (a) include full bytes/text on the turn an attachment was first
 * referenced, and (b) build the ATTACHMENTS IN THIS CONVERSATION block
 * (digests only) for every later turn.
 */
export async function loadConversationAttachments(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationAttachment[]> {
  const { data, error } = await supabase
    .from('chat_attachments')
    .select('id, filename, media_type, raw_base64, extracted_text, digest, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[attachments] loadConversationAttachments failed:', error);
    return [];
  }
  if (!data) return [];
  return data.map((row) => ({
    id: row.id as string,
    filename: row.filename as string,
    media_type: row.media_type as string,
    raw_base64: row.raw_base64 as string | null,
    extracted_text: row.extracted_text as string | null,
    digest: row.digest as string | null,
  }));
}

/**
 * Mark previously-uploaded attachments as belonging to a specific user
 * message. Called after the user message row is inserted in the chat
 * route, so chat_attachments.message_id reflects exactly which turn
 * brought the file into the conversation.
 */
export async function attachAttachmentsToMessage(
  supabase: SupabaseClient,
  attachmentIds: string[],
  messageId: string,
): Promise<void> {
  if (attachmentIds.length === 0) return;
  const { error } = await supabase
    .from('chat_attachments')
    .update({ message_id: messageId })
    .in('id', attachmentIds);
  if (error) {
    console.error('[attachments] attachAttachmentsToMessage failed:', error);
  }
}

/**
 * Build the system-prompt block listing every attachment in this
 * conversation, with each digest included so the model can reference
 * earlier uploads without us re-sending bytes. Returns empty string when
 * there are no attachments.
 */
export function buildAttachmentDigestBlock(attachments: ConversationAttachment[]): string {
  if (attachments.length === 0) return '';
  const lines = ['ATTACHMENTS IN THIS CONVERSATION (you have already analyzed each one; treat the digest as your durable memory of it - the bytes are not re-sent every turn):'];
  for (const att of attachments) {
    const digest = att.digest ?? '(no digest available - rely on your earlier description in the conversation history)';
    lines.push(`- [${att.media_type}] "${att.filename}": ${digest}`);
  }
  return lines.join('\n');
}

export interface ConversationAttachment {
  id: string;
  filename: string;
  media_type: string;
  raw_base64: string | null;
  extracted_text: string | null;
  digest: string | null;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function capTextWithMarker(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const headLen = Math.floor(cap * 0.7);
  const tailLen = Math.floor(cap * 0.25);
  const head = text.slice(0, headLen);
  const tail = text.slice(-tailLen);
  const omitted = text.length - head.length - tail.length;
  return `${head}\n...[file content truncated, ${omitted} chars omitted]...\n${tail}`;
}

async function digestImage(base64: string, mediaType: string, filename: string): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: HAIKU_MODEL_ID,
    max_tokens: DIGEST_MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `You are summarizing an image a user uploaded ("${filename}") so that another AI can recall it on later turns without re-receiving the bytes. In 2-4 sentences, capture: what kind of artifact this is (process map, org chart, screenshot, photo, etc.), what entities or stages or structures it shows, and any specific names/labels visible. Be concrete - the goal is for a future reader to be able to act on your description as if they had seen the image themselves.`,
          },
        ],
      },
    ],
  });
  return joinTextBlocks(res);
}

async function digestText(text: string, mediaType: string, filename: string): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: HAIKU_MODEL_ID,
    max_tokens: DIGEST_MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: `You are summarizing a file a user uploaded so that another AI can recall its contents on later turns without re-reading the full text.\n\nFile: ${filename} (${mediaType})\n\nIn 2-4 sentences, capture: what kind of file this is, the columns/sections/structure, and the most important specific values or names a future reader would need to act on it. Be concrete.\n\n--- FILE CONTENT ---\n${text}\n--- END FILE CONTENT ---`,
      },
    ],
  });
  return joinTextBlocks(res);
}

function joinTextBlocks(res: Anthropic.Message): string {
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
