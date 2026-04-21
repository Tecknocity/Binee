import { NextRequest, NextResponse } from 'next/server';
import { generateSetupPlan } from '@/lib/setup/planner';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import type { BusinessProfile } from '@/lib/setup/types';

export const maxDuration = 60;

// Same budget as /api/setup/chat so both endpoints see the same conversation
// context. Keeps the chat agreement and the generated plan in sync without
// requiring the client to bundle the history into the request.
const HISTORY_TOKEN_BUDGET = 30_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * POST /api/setup/generate-plan
 *
 * Generates a ClickUp workspace plan. When a conversation_id is provided,
 * loads the full conversation + latest structure snapshot from the DB so the
 * planner sees the same context that the chat AI used. This keeps the plan
 * aligned with what the user agreed to in chat.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup-generate:${user.id}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const {
      businessProfile,
      workspaceAnalysis,
      conversationContext,
      chatStructureSnapshot,
      previousPlan,
      planHistorySummary,
      conversation_id,
    } = await request.json() as {
      businessProfile: BusinessProfile;
      workspaceAnalysis?: string;
      conversationContext?: string;
      chatStructureSnapshot?: Record<string, unknown>;
      previousPlan?: Record<string, unknown>;
      planHistorySummary?: string;
      conversation_id?: string;
    };

    if (!businessProfile?.businessDescription) {
      return NextResponse.json({ error: 'Missing business description' }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Load conversation + latest snapshot from DB when conversation_id is
    // provided. This is the single source of truth: whatever the chat AI
    // wrote to the DB is what the planner sees. Client-sent values are used
    // only as fallback (for legacy callers or when DB loading fails).
    let resolvedContext = conversationContext;
    let resolvedSnapshot = chatStructureSnapshot;

    if (conversation_id) {
      const { data: messages } = await adminClient
        .from('messages')
        .select('role, content, metadata, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (messages && messages.length > 0) {
        const ordered = [...messages].reverse();

        // Fit as many recent messages as possible within the token budget.
        let tokenCount = 0;
        let cutoffIndex = 0;
        for (let i = ordered.length - 1; i >= 0; i--) {
          const msgTokens = estimateTokens(ordered[i].content as string);
          if (tokenCount + msgTokens > HISTORY_TOKEN_BUDGET) {
            cutoffIndex = i + 1;
            break;
          }
          tokenCount += msgTokens;
        }
        const recent = ordered.slice(cutoffIndex);

        resolvedContext = recent
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n');

        // Extract the latest structure_snapshot from assistant message
        // metadata. This is what the chat AI most recently agreed with the
        // user on - the authoritative baseline for the plan.
        for (let i = ordered.length - 1; i >= 0; i--) {
          const meta = ordered[i].metadata as Record<string, unknown> | null;
          const snap = meta?.structure_snapshot as Record<string, unknown> | undefined;
          if (snap && typeof snap === 'object' && snap.spaces) {
            resolvedSnapshot = snap;
            break;
          }
        }
      }
    }

    // Load template knowledge base so the planner can reference proven structures
    const { data: templateModules } = await adminClient
      .from('ai_knowledge_base')
      .select('content')
      .like('module_key', 'clickup-templates-database%');
    const templates = templateModules?.map(m => m.content).join('\n\n') || '';

    const plan = await generateSetupPlan(businessProfile, workspaceAnalysis, {
      conversationContext: resolvedContext,
      chatStructureSnapshot: resolvedSnapshot,
      previousPlan,
      planHistorySummary,
      templates,
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('[POST /api/setup/generate-plan] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plan generation failed' },
      { status: 500 },
    );
  }
}
