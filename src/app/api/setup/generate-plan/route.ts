import { NextRequest, NextResponse } from 'next/server';
import { generateSetupPlan } from '@/lib/setup/planner';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { assertSufficientCredits } from '@/lib/credits/guard';
import { MESSAGE_CREDIT_TIERS } from '@/billing/config';
import type { BusinessProfile } from '@/lib/setup/types';

export const maxDuration = 60;

// Same budget as /api/setup/chat so both endpoints see the same conversation
// context. Keeps the chat agreement and the generated plan in sync without
// requiring the client to bundle the history into the request.
const HISTORY_TOKEN_BUDGET = 30_000;

// generate-plan does the same shape of Sonnet call as /api/setup/chat (one
// turn, max_tokens 4096), so it's billed at the premium tier the chat
// route uses. Keeps the user experience predictable: a chat turn and a
// "Generate Structure" click cost the same.
const GENERATE_PLAN_CREDIT_COST = MESSAGE_CREDIT_TIERS.premium;

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
      workspace_id,
      businessProfile,
      workspaceAnalysis,
      conversationContext,
      previousPlan,
      planHistorySummary,
      conversation_id,
    } = await request.json() as {
      workspace_id?: string;
      businessProfile: BusinessProfile;
      workspaceAnalysis?: string;
      conversationContext?: string;
      previousPlan?: Record<string, unknown>;
      planHistorySummary?: string;
      conversation_id?: string;
    };

    if (!businessProfile?.businessDescription) {
      return NextResponse.json({ error: 'Missing business description' }, { status: 400 });
    }
    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }
    // Same UUID guard as the chat route. conversation_id is optional here
    // (callers without one only get the planner's stateless behaviour) but
    // when provided it MUST be a UUID; otherwise both the SELECT for
    // history loading and the setup_drafts upsert below silently fail.
    if (conversation_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversation_id)) {
      return NextResponse.json(
        { error: 'conversation_id must be a UUID' },
        { status: 400 },
      );
    }

    // Platform-wide credit guard: refuse the request before paying
    // Anthropic when the workspace is over its credit limit. Same
    // pattern every billable route now uses.
    const creditCheck = await assertSufficientCredits(supabase, workspace_id, GENERATE_PLAN_CREDIT_COST);
    if (!creditCheck.ok) return creditCheck.response;

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Load conversation + latest draft. setup_drafts is the single source
    // of truth for the snapshot since Phase 1 - chat, manual edits in
    // Review, and generate-plan all read/write the same row. Phase 4
    // dropped the legacy messages.metadata.structure_snapshot fallback;
    // any conversation that does not have a setup_drafts row simply has
    // no prior draft, which the planner handles correctly.
    let resolvedContext = conversationContext;
    let resolvedSnapshot: Record<string, unknown> | undefined;

    if (conversation_id) {
      const [draftResult, messagesResult] = await Promise.all([
        adminClient
          .from('setup_drafts')
          .select('draft')
          .eq('conversation_id', conversation_id)
          .maybeSingle(),
        adminClient
          .from('messages')
          .select('role, content, created_at')
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
          .select('version, draft')
          .eq('conversation_id', conversation_id)
          .maybeSingle();
        const { data: workspaceRow } = await adminClient
          .from('workspaces')
          .select('clickup_team_id')
          .eq('id', convoRow.workspace_id)
          .maybeSingle();

        // Preserve multi-agent discovery state (coverage / ready / brief /
        // questions_asked) when overwriting the draft with the freshly
        // generated plan. Without this, the next chat turn would see
        // ready=undefined and re-route to the Clarifier instead of the
        // Reviser, restarting discovery from scratch. The fields live on
        // the same JSONB row and are additive to whatever the planner
        // emits.
        const priorDraft = (existingDraft?.draft && typeof existingDraft.draft === 'object')
          ? existingDraft.draft as Record<string, unknown>
          : null;
        const carryover: Record<string, unknown> = {};
        if (priorDraft) {
          if (priorDraft.coverage !== undefined) carryover.coverage = priorDraft.coverage;
          if (priorDraft.brief !== undefined) carryover.brief = priorDraft.brief;
          if (priorDraft.questions_asked !== undefined) carryover.questions_asked = priorDraft.questions_asked;
          // Force ready=true on the post-generation draft so the chat route
          // correctly routes the next turn to the Reviser, not the
          // Clarifier. The user clicked Generate Structure - discovery is
          // unambiguously over.
          carryover.ready = true;
        }

        const draftToWrite = {
          ...(plan as unknown as Record<string, unknown>),
          ...carryover,
        };

        const { error: draftError } = await adminClient
          .from('setup_drafts')
          .upsert(
            {
              conversation_id,
              workspace_id: convoRow.workspace_id,
              clickup_team_id: workspaceRow?.clickup_team_id ?? null,
              draft: draftToWrite,
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

    // Bill the request at the premium tier (same shape of Sonnet call as
    // a chat turn). Fire-and-forget after the plan has shipped to the
    // client - the credit guard above already refused the request when
    // the workspace was over its limit, so the deduction is the
    // accounting tail, not the gate. credit_usage gets a corresponding
    // row so analytics can split chat vs generate-plan spend.
    (async () => {
      try {
        await adminClient.rpc('deduct_credits', {
          p_workspace_id: workspace_id,
          p_user_id: user.id,
          p_amount: GENERATE_PLAN_CREDIT_COST,
          p_description: 'Setup: generate plan',
          p_message_id: null,
          p_metadata: {
            credit_tier: 'premium',
            source: 'setup_generate_plan',
          },
        });
      } catch (err) {
        console.error('[setup/generate-plan] Credit deduction failed:', err);
      }

      try {
        await adminClient.from('credit_usage').insert({
          user_id: user.id,
          workspace_id,
          action_type: 'setup',
          session_id: conversation_id ?? null,
          model_used: 'sonnet',
          // Planner does not currently surface input/output token counts;
          // those come from the Anthropic SDK response inside the planner
          // module. Wiring that through is a follow-up - for now we log
          // the row so analytics can count generate-plan invocations.
          input_tokens: 0,
          output_tokens: 0,
          anthropic_cost_cents: 0,
          credits_deducted: GENERATE_PLAN_CREDIT_COST,
        });
      } catch (err) {
        console.error('[setup/generate-plan] credit_usage insert failed:', err);
      }
    })();

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('[POST /api/setup/generate-plan] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plan generation failed' },
      { status: 500 },
    );
  }
}
