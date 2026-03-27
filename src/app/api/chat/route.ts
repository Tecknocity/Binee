import { NextRequest, NextResponse } from 'next/server';
import { handleChat } from '@/lib/ai/chat-handler';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import type { ChatRequest } from '@/types/ai';

// ---------------------------------------------------------------------------
// Vercel serverless function config — AI calls need more time than the 10s default
// ---------------------------------------------------------------------------
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user via session cookie
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 chat requests per minute per user
    const rl = rateLimit(`chat:${authUser.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before sending another message.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
      );
    }

    const body = await request.json();

    // Validate required fields
    const { workspace_id, user_id, conversation_id, message } = body as Partial<ChatRequest>;

    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json(
        { error: 'workspace_id is required and must be a string' },
        { status: 400 },
      );
    }

    // Ensure the authenticated user matches the claimed user_id
    if (user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'user_id does not match authenticated user' },
        { status: 403 },
      );
    }

    if (!conversation_id || typeof conversation_id !== 'string') {
      return NextResponse.json(
        { error: 'conversation_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    if (message.length > 10_000) {
      return NextResponse.json(
        { error: 'message must be 10,000 characters or fewer' },
        { status: 400 },
      );
    }

    const chatRequest: ChatRequest = {
      workspace_id,
      user_id,
      conversation_id,
      message: message.trim(),
    };

    const response = await handleChat(chatRequest);

    // Strip orchestration metadata in production (observability only)
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      const { _orchestration: _, ...publicResponse } = response;
      return NextResponse.json(publicResponse);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/chat] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    // Classify error for appropriate status code
    const isConfigError =
      errorMessage.includes('ANTHROPIC_API_KEY') ||
      errorMessage.includes('SUPABASE') ||
      errorMessage.includes('environment variable');

    // Always surface the error category so users can report issues.
    // Strip only truly internal details (stack traces, raw SQL).
    const safeMessage = errorMessage
      .replace(/at\s+\S+\s+\(.*?\)/g, '')   // strip stack frames
      .replace(/SELECT.*?FROM/gi, '[query]') // strip raw SQL
      .trim();

    // Persist the error as an assistant message SERVER-SIDE so it survives
    // page reloads. Previously, error messages were only saved client-side
    // (browser Supabase client), which meant they were lost on refresh —
    // leaving conversations with user messages but no responses.
    const body = await request.clone().json().catch(() => null);
    if (body?.workspace_id && body?.conversation_id) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && serviceKey) {
          const adminClient = createClient(url, serviceKey);
          const errorContent = `Something went wrong: ${safeMessage || 'An unexpected error occurred'}`;
          await adminClient.from('messages').insert({
            workspace_id: body.workspace_id,
            conversation_id: body.conversation_id,
            role: 'assistant',
            content: errorContent,
            credits_used: 0,
            metadata: { error: true, error_detail: safeMessage },
          });
        }
      } catch (saveErr) {
        console.error('[POST /api/chat] Failed to persist error message:', saveErr);
      }
    }

    return NextResponse.json(
      { error: safeMessage || 'An unexpected error occurred' },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
