import { NextRequest, NextResponse } from 'next/server';
import { handleChat } from '@/lib/ai/chat-handler';
import type { ChatRequest } from '@/types/ai';

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { workspace_id, user_id, conversation_id, message } = body as Partial<ChatRequest>;

    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json(
        { error: 'workspace_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { error: 'user_id is required and must be a string' },
        { status: 400 },
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

    // Provide actionable messages for known configuration issues
    const isConfigError =
      errorMessage.includes('ANTHROPIC_API_KEY') ||
      errorMessage.includes('SUPABASE') ||
      errorMessage.includes('environment variable');

    const isProduction = process.env.NODE_ENV === 'production';
    const safeMessage = isProduction && !isConfigError
      ? 'An error occurred while processing your request. Please try again.'
      : errorMessage;

    return NextResponse.json(
      { error: safeMessage },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
