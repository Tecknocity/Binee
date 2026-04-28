import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { assertSufficientCredits } from '@/lib/credits/guard';
import { persistAttachment } from '@/lib/setup/attachments';

// Attachment uploads are not billed per-file (intentional: bundling the
// cost into the chat turn that follows is the user-friendly default),
// but the Haiku digest call still costs us. Gate on the workspace
// having ANY credits left so a depleted workspace cannot burn Haiku
// budget. 0.01 is chosen to be smaller than every MESSAGE_CREDIT_TIERS
// value so it acts purely as a "must have credits" check, not a charge.
const UPLOAD_MIN_CREDITS = 0.01;

// Haiku digest generation usually returns inside ~2-4s; image vision can
// stretch a little. 30s gives comfortable headroom for both, well under
// the 60s Vercel hobby cap and the 90s setup-chat cap.
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * POST /api/setup/attachments/upload
 *
 * Stages an attachment for an in-progress setup conversation. The client
 * uploads BEFORE sending the chat message, gets back an attachment_id,
 * then references that id in the next /api/setup/chat call. The digest
 * pipeline runs synchronously here so the chat turn never has to wait
 * for Haiku.
 *
 * Body shape (one of raw_base64 or extracted_text must be present):
 *   {
 *     conversation_id: uuid,
 *     filename: string,
 *     media_type: string,
 *     size_bytes: int,
 *     raw_base64?: string,    // for image/png|jpeg|gif|webp
 *     extracted_text?: string // for parsed CSV/XLSX/TXT/MD
 *   }
 *
 * Returns { id, filename, media_type, digest } on success. The chat
 * route looks up the row by id and reads raw_base64 / extracted_text /
 * digest as needed.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Per-user rate limit so a misbehaving client cannot pile up Haiku
    // calls. 20 uploads per minute is plenty for a setup session and
    // catches obvious runaway scripts.
    const rl = rateLimit(`setup-upload:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many uploads.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      conversation_id,
      filename,
      media_type,
      size_bytes,
      raw_base64,
      extracted_text,
    } = body as {
      conversation_id?: string;
      filename?: string;
      media_type?: string;
      size_bytes?: number;
      raw_base64?: string;
      extracted_text?: string;
    };

    if (!conversation_id || !isUuid(conversation_id)) {
      return NextResponse.json({ error: 'conversation_id must be a UUID' }, { status: 400 });
    }
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }
    if (!media_type || typeof media_type !== 'string') {
      return NextResponse.json({ error: 'Missing media_type' }, { status: 400 });
    }
    if (typeof size_bytes !== 'number' || size_bytes < 0) {
      return NextResponse.json({ error: 'Missing or invalid size_bytes' }, { status: 400 });
    }
    if (!raw_base64 && !extracted_text) {
      return NextResponse.json(
        { error: 'Either raw_base64 (for images) or extracted_text (for files) is required' },
        { status: 400 },
      );
    }
    if (raw_base64 && extracted_text) {
      return NextResponse.json(
        { error: 'Send raw_base64 OR extracted_text, not both' },
        { status: 400 },
      );
    }

    // Verify the user is a member of the workspace that owns this
    // conversation. We resolve workspace_id from the conversations row
    // rather than trusting the client to send it - keeps the FK chain
    // honest and prevents cross-workspace attachment writes.
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: convoRow } = await adminClient
      .from('conversations')
      .select('workspace_id')
      .eq('id', conversation_id)
      .maybeSingle();
    if (!convoRow?.workspace_id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', convoRow.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Platform-wide credit guard. We do not deduct here (uploads are
    // bundled into the chat turn that follows), but we refuse uploads
    // for a workspace that has run out of credits.
    const creditCheck = await assertSufficientCredits(supabase, convoRow.workspace_id, UPLOAD_MIN_CREDITS);
    if (!creditCheck.ok) return creditCheck.response;

    const persisted = await persistAttachment(adminClient, {
      workspace_id: convoRow.workspace_id,
      conversation_id,
      filename,
      media_type,
      size_bytes,
      raw_base64,
      extracted_text,
    });

    return NextResponse.json(persisted);
  } catch (error) {
    console.error('[POST /api/setup/attachments/upload] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
