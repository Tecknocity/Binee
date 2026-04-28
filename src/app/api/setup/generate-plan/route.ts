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

    // Load conversation + latest draft. The setup_drafts row is the single
    // source of truth for the snapshot - chat, manual edits in Review, and
    // generate-plan all read/write the same row. Falling back to
    // messages.metadata.structure_snapshot keeps us compatible with any
    // conversation that started before setup_drafts existed; falling back
    // to the client-sent value is a last resort for callers that pre-date
    // both server stores.
    let resolvedContext = conversationContext;
    let resolvedSnapshot = chatStructureSnapshot;

    if (conversation_id) {
      const [draftResult, messagesResult] = await Promise.all([
        adminClient
          .from('setup_drafts')
          .select('draft')
          .eq('conversation_id', conversation_id)
          .maybeSingle(),
        adminClient
          .from('messages')
          .select('role, content, metadata, created_at')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (draftResult.data?.draft && typeof draftResult.data.draft === 'object') {
        const candidate = draftResult.data.draft as Record<string, unknown>;
        if (candidate.spaces) {
          resolvedSnapshot = candidate;
        }
      }

      const messages = messagesResult.data;
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

        // Legacy fallback: messages.metadata.structure_snapshot. Only used
        // when setup_drafts has no row for this conversation yet (e.g.
        // conversations that started before this migration).
        if (!resolvedSnapshot) {
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

    // Write the freshly generated plan back to setup_drafts so the next
    // chat turn (and the Review screen, and the build executor) all see
    // the same canonical structure. We deliberately store the plan under
    // the same `draft` JSONB column even though the shape is slightly
    // richer than a chat snapshot - the Review screen and chat both
    // tolerate the extra fields, and keeping one column avoids the dual-
    // store drift this phase is fixing.
    if (conversation_id && plan && typeof plan === 'object') {
      const { data: convoRow } = await adminClient
        .from('conversations')
        .select('workspace_id')
        .eq('id', conversation_id)
        .maybeSingle();
      if (convoRow?.workspace_id) {
        const { data: existingDraft } = await adminClient
          .from('setup_drafts')
          .select('version')
          .eq('conversation_id', conversation_id)
          .maybeSingle();
        const { data: workspaceRow } = await adminClient
          .from('workspaces')
          .select('clickup_team_id')
          .eq('id', convoRow.workspace_id)
          .maybeSingle();
        const { error: draftError } = await adminClient
          .from('setup_drafts')
          .upsert(
            {
              conversation_id,
              workspace_id: convoRow.workspace_id,
              clickup_team_id: workspaceRow?.clickup_team_id ?? null,
              draft: plan as unknown as Record<string, unknown>,
              updated_by: 'generate_plan',
              version: (existingDraft?.version ?? 0) + 1,
            },
            { onConflict: 'conversation_id' },
          );
        if (draftError) {
          console.error('[setup/generate-plan] setup_drafts upsert failed:', draftError);
        }
      }
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('[POST /api/setup/generate-plan] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plan generation failed' },
      { status: 500 },
    );
  }
}
