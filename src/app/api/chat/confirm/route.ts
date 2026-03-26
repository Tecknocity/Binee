import { NextRequest, NextResponse } from 'next/server';
import { resolvePendingAction } from '@/lib/ai/confirmation';
import { createServerClient } from '@/lib/supabase/server';
import type { ConfirmActionRequest } from '@/types/ai';

// ---------------------------------------------------------------------------
// POST /api/chat/confirm — Confirm or cancel a pending write action (B-045)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user via session cookie
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { workspace_id, conversation_id, action_id, confirmed } =
      body as Partial<ConfirmActionRequest>;

    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json(
        { error: 'workspace_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (!conversation_id || typeof conversation_id !== 'string') {
      return NextResponse.json(
        { error: 'conversation_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (!action_id || typeof action_id !== 'string') {
      return NextResponse.json(
        { error: 'action_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (typeof confirmed !== 'boolean') {
      return NextResponse.json(
        { error: 'confirmed is required and must be a boolean' },
        { status: 400 },
      );
    }

    const result = await resolvePendingAction({
      workspace_id,
      conversation_id,
      action_id,
      confirmed,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/chat/confirm] Error:', error);

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    const isProduction = process.env.NODE_ENV === 'production';
    const safeMessage = isProduction
      ? 'An error occurred while processing your confirmation. Please try again.'
      : message;

    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
