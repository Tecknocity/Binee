import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// POST /api/chat/welcome
// Creates the first conversation with an auto-generated welcome message
// containing workspace stats. Called once after onboarding completes.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, user_id } = body as {
      workspace_id?: string;
      user_id?: string;
    };

    if (!workspace_id || !user_id) {
      return NextResponse.json(
        { error: 'workspace_id and user_id are required' },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Fetch user profile for personalized greeting
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferred_name')
      .eq('user_id', user_id)
      .single();

    const firstName = profile?.preferred_name?.split(' ')[0] || null;

    // Fetch workspace stats from clickup_connections
    const { data: connection } = await supabase
      .from('clickup_connections')
      .select('synced_spaces, synced_lists, synced_tasks')
      .eq('workspace_id', workspace_id)
      .single();

    const spaces = connection?.synced_spaces ?? 0;
    const lists = connection?.synced_lists ?? 0;
    const tasks = connection?.synced_tasks ?? 0;

    // Build the welcome message content
    const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';

    const statsLine =
      spaces > 0 || lists > 0 || tasks > 0
        ? ` I synced your workspace — ${spaces} space${spaces !== 1 ? 's' : ''}, ${lists} list${lists !== 1 ? 's' : ''}, ${tasks.toLocaleString()} task${tasks !== 1 ? 's' : ''}.`
        : " I've connected to your workspace and I'm ready to help.";

    const content = `${greeting}${statsLine}\n\nHere are some things I can help you with:\n\n- **Show me my overdue tasks** — I'll find tasks that need attention\n- **What actions can you take in my workspace?** — See everything I can do\n- **Help me organize my workspace** — Set up structures and workflows\n- **Create a dashboard for my team** — Build visual project overviews\n- **Run a health check on my workspace** — Get insights on workspace health`;

    // Create the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        workspace_id,
        user_id,
        title: 'Welcome to Binee',
        context_type: 'general',
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('[POST /api/chat/welcome] Failed to create conversation:', convError?.message);
      return NextResponse.json(
        { error: 'Failed to create welcome conversation' },
        { status: 500 },
      );
    }

    // Insert the welcome message as an assistant message
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      workspace_id,
      role: 'assistant',
      content,
      credits_used: 0,
      metadata: { type: 'welcome', auto_generated: true },
    });

    if (msgError) {
      console.error('[POST /api/chat/welcome] Failed to create welcome message:', msgError.message);
      // Still return the conversation — the user can chat even without the welcome message
    }

    return NextResponse.json({
      conversation_id: conversation.id,
    });
  } catch (error) {
    console.error('[POST /api/chat/welcome] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create welcome conversation' },
      { status: 500 },
    );
  }
}
