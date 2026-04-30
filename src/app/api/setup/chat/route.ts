import { NextRequest, NextResponse } from 'next/server';
import { handleSetupMessage } from '@/lib/setup/setupper-brain';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { summarizeOlderMessages } from '@/lib/ai/conversation-summary';
import { assertSufficientCredits } from '@/lib/credits/guard';
import { MESSAGE_CREDIT_TIERS } from '@/billing/config';
import {
  loadConversationAttachments,
  attachAttachmentsToMessage,
  buildAttachmentDigestBlock,
  type ConversationAttachment,
} from '@/lib/setup/attachments';

// Setup chat charges the premium tier (matches classifyMessageCost for
// isSetup === true). The credit guard at request entry uses the same
// constant so the pre-check and the eventual deduct_credits agree.
const SETUP_CHAT_CREDIT_COST = MESSAGE_CREDIT_TIERS.premium;

// ---------------------------------------------------------------------------
// Token budget for conversation history.
// Setup is always premium (2.0 credits = $0.24 revenue). At 30K history
// tokens the Anthropic cost is ~$0.105 per message, keeping margin above 50%.
// Typical setup conversations (10-30 messages) use ~6K-20K tokens and never
// hit this limit, so they always get full history with zero summarization.
// ---------------------------------------------------------------------------
const HISTORY_TOKEN_BUDGET = 30_000;

/** Rough token estimate: ~4 chars per token (conservative for English text). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Per-stage timing collector. We log a single structured perf line at the
  // end of the request (and on the catch path) so a 504 in production can be
  // diagnosed from logs without extra plumbing. Stage names match the actual
  // code blocks below so a non-zero stage points at the offending block.
  const t0 = Date.now();
  const stages: Record<string, number> = {};
  const mark = (name: string, since: number) => {
    stages[name] = Date.now() - since;
  };
  const perfMeta: {
    convoId?: string;
    userId?: string;
    historyMessages?: number;
    historyTokens?: number;
    aiTimings?: import('@/lib/setup/setupper-brain').SetupperTimings;
  } = {};

  try {
    const tAuth = Date.now();
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    mark('auth', tAuth);

    const rl = rateLimit(`setup:${authUser.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      workspace_id,
      conversation_id,
      message,
      workspace_analysis,
      proposed_plan,
      profile_data,
      // Phase 2: every attachment lives in chat_attachments and is
      // referenced here by id. The legacy file_context / image_attachments
      // request fields are gone - the upload endpoint owns persistence
      // and digest generation.
      attachment_ids,
    } = body;

    if (!workspace_id || !conversation_id || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // conversations.id is a uuid column. A non-UUID conversation_id used
    // to silently fail every downstream upsert (Phase 1.5 root cause).
    // Reject at the boundary so the server-side error path is the only
    // path that can fail and the client gets a clear 400 instead of 500.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversation_id)) {
      return NextResponse.json(
        { error: 'conversation_id must be a UUID' },
        { status: 400 },
      );
    }

    // Platform-wide credit guard: refuse before paying Anthropic when the
    // workspace is over its credit limit. The previous behaviour deducted
    // AFTER the model call, which meant a user at 0 credits still got a
    // free response (deduct_credits would correctly fail, but we'd
    // already eaten the API cost).
    const tCredit = Date.now();
    const creditCheck = await assertSufficientCredits(supabase, workspace_id, SETUP_CHAT_CREDIT_COST);
    if (!creditCheck.ok) return creditCheck.response;
    mark('credit', tCredit);

    perfMeta.convoId = conversation_id;
    perfMeta.userId = authUser.id;

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // -----------------------------------------------------------------------
    // PHASE 1: Persist user message FIRST, then load context in parallel.
    // This ensures conversation history is always complete even if the AI
    // call times out or fails — the next retry will see all prior messages.
    // -----------------------------------------------------------------------

    // Ensure conversation record exists (must happen before message insert).
    // We surface the error explicitly here because conversations.id is a
    // uuid column - if the client sends anything that is not a UUID the
    // upsert silently fails and every downstream insert (messages,
    // setup_drafts) cascades into the same silent failure. Better to
    // refuse the request than to drop the user's data on the floor.
    const tConvoUpsert = Date.now();
    const convoUpsert = await adminClient
      .from('conversations')
      .upsert(
        {
          id: conversation_id,
          workspace_id,
          user_id: authUser.id,
          context_type: 'setup',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    if (convoUpsert.error) {
      console.error('[setup/chat] conversations upsert failed:', convoUpsert.error);
      return NextResponse.json(
        {
          error: 'Could not persist conversation. Please refresh the page and try again.',
          detail: convoUpsert.error.message,
        },
        { status: 500 },
      );
    }
    mark('convoUpsert', tConvoUpsert);

    // Save user message to DB immediately — before the AI call. Phase 2
    // moved attachment durability into chat_attachments (with Haiku
    // digests), so the metadata image_count / image_names / file_context
    // band-aids that used to live on this row are gone; the row carries
    // only the user's text now.
    const tUserMsg = Date.now();
    const userInsert = await adminClient
      .from('messages')
      .insert({
        workspace_id,
        conversation_id,
        role: 'user',
        content: message.trim(),
        credits_used: 0,
      })
      .select('id')
      .single();
    if (userInsert.error || !userInsert.data) {
      console.error('[setup/chat] user message insert failed:', userInsert.error);
      return NextResponse.json(
        {
          error: 'Could not save your message. Please try again.',
          detail: userInsert.error?.message ?? 'unknown insert error',
        },
        { status: 500 },
      );
    }

    const userMessageId = userInsert.data.id as string;

    // Phase 2: link any attachments the client uploaded ahead of this turn
    // to the user message we just persisted, so we can later show "this
    // file was attached to that turn" in the UI and so chat_attachments
    // rows have a valid message_id FK once the message exists. Validation
    // of the attachment ids themselves happens implicitly: if any id does
    // not belong to this conversation (RLS / membership), the UPDATE
    // matches zero rows and we move on.
    const incomingAttachmentIds = Array.isArray(attachment_ids)
      ? (attachment_ids as unknown[]).filter(
          (x): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x),
        )
      : [];
    if (incomingAttachmentIds.length > 0) {
      await attachAttachmentsToMessage(adminClient, incomingAttachmentIds, userMessageId);
    }
    mark('userMsg', tUserMsg);

    // Load context in parallel
    const tCtxLoad = Date.now();
    const [workspaceResult, historyResult, conversationResult, draftResult, allAttachments] = await Promise.all([
      adminClient
        .from('workspaces')
        .select('clickup_plan_tier, clickup_team_id')
        .eq('id', workspace_id)
        .single(),
      // Load full conversation history (up to 200 messages safety cap).
      // We send as many messages as fit within the HISTORY_TOKEN_BUDGET so
      // the AI always has maximum context. Summarization only kicks in for
      // very long conversations that exceed the budget.
      adminClient
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(200),
      // Conversation summary (used only when history exceeds token budget)
      adminClient
        .from('conversations')
        .select('summary')
        .eq('id', conversation_id)
        .single(),
      // The canonical workspace draft for this conversation. This is the
      // single source of truth - chat, generate-plan, the Review screen, and
      // the build executor all read/write this row. We deliberately ignore
      // the client-sent chat_structure_snapshot here; it can drift from the
      // server (manual edits in Review, switched device, cleared
      // localStorage) and we never want chat to start from a stale draft.
      adminClient
        .from('setup_drafts')
        .select('draft, version, updated_by, updated_at')
        .eq('conversation_id', conversation_id)
        .maybeSingle(),
      // Every attachment in this conversation. We need:
      //   - the digest of every one for the system-prompt block
      //   - the full content of the attachments referenced on THIS turn
      //     so the model can analyze them fresh
      // Ordering is by created_at ASC so the digest list reads in upload
      // order (matches the conversation timeline).
      loadConversationAttachments(adminClient, conversation_id),
    ]);
    mark('ctxLoad', tCtxLoad);

    const conversationAttachments: ConversationAttachment[] = allAttachments;
    const currentTurnAttachments = conversationAttachments.filter((a) =>
      incomingAttachmentIds.includes(a.id),
    );

    // Phase 3: planTier may legitimately be null when the user has not yet
    // selected a plan in the profile form. Pass null through to the brain
    // so it knows to skip the CLICKUP PLAN block in the system prompt
    // rather than telling the model a fabricated default.
    const planTier = workspaceResult.data?.clickup_plan_tier ?? null;
    const clickupTeamId = workspaceResult.data?.clickup_team_id ?? null;
    const serverDraft = (draftResult.data?.draft && typeof draftResult.data.draft === 'object')
      ? draftResult.data.draft as Record<string, unknown>
      : null;

    // Build conversation history with token-budget approach:
    // - Send full history when it fits within the budget (most conversations)
    // - When history exceeds the budget, keep as many recent messages as fit
    //   and prepend the summary for older context (same as Claude/ChatGPT but
    //   with a lower ceiling since we pay per token)
    const allMessages = (historyResult.data || []).reverse();
    const summary = conversationResult.data?.summary;

    // Phase 2 made attachments first-class: their digests live in the
    // ATTACHMENTS IN THIS CONVERSATION block injected by the brain, not
    // in per-message metadata. So conversation history is now just the
    // user/assistant text - no marker injection, no metadata read.
    // Count tokens from newest to oldest, keeping messages that fit the budget.
    let tokenCount = 0;
    let cutoffIndex = 0;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(allMessages[i].content as string);
      if (tokenCount + msgTokens > HISTORY_TOKEN_BUDGET) {
        cutoffIndex = i + 1;
        break;
      }
      tokenCount += msgTokens;
    }

    const recentMessages = allMessages.slice(cutoffIndex);

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Only prepend summary when some messages were cut off (history exceeded budget)
    if (cutoffIndex > 0 && summary) {
      conversationHistory.push(
        { role: 'user', content: `[Previous conversation summary: ${summary}]` },
        { role: 'assistant', content: 'Understood, I have the context from our earlier discussion.' },
      );
    }

    // Ensure the first real message has role 'user' for valid API alternation.
    // If the window starts with an assistant message, skip it (summary covers it).
    let startIdx = 0;
    if (recentMessages.length > 0 && recentMessages[0].role === 'assistant') {
      startIdx = 1;
    }

    for (let i = startIdx; i < recentMessages.length; i++) {
      conversationHistory.push({
        role: recentMessages[i].role as 'user' | 'assistant',
        content: recentMessages[i].content as string,
      });
    }

    // Save profile data as persistent user memories (fire-and-forget)
    if (profile_data) {
      const { industry, workStyle, services, teamSize } = profile_data;
      const profileFacts: string[] = [];
      if (industry) profileFacts.push(`User's industry is ${industry}`);
      if (workStyle) profileFacts.push(`User's work style is ${workStyle}`);
      if (services) profileFacts.push(`User's services/products: ${services}`);
      if (teamSize) profileFacts.push(`User's team size is ${teamSize}`);

      if (profileFacts.length > 0) {
        (async () => {
          try {
            await adminClient
              .from('user_memories')
              .delete()
              .eq('user_id', authUser.id)
              .eq('workspace_id', workspace_id)
              .eq('category', 'profile');
            await adminClient.from('user_memories').insert(
              profileFacts.map(fact => ({
                user_id: authUser.id,
                workspace_id,
                category: 'profile',
                content: fact,
                source_conversation_id: conversation_id,
              })),
            );
          } catch (err) {
            console.error('[setup/chat] Profile memory save failed:', err);
          }
        })();
      }
    }

    // Phase 2: build the user message from this turn's chat_attachments.
    // Text files inlined as ATTACHED FILE CONTENT, images sent as vision
    // blocks via the brain's imageAttachments path. There is no longer a
    // legacy inline path - all attachments go through chat_attachments.
    const inlineTextSections: string[] = [];
    for (const att of currentTurnAttachments) {
      if (att.extracted_text) {
        inlineTextSections.push(
          `--- ATTACHED FILE CONTENT (${att.filename}) ---\n${att.extracted_text}\n--- END ATTACHED FILE CONTENT ---`,
        );
      }
    }
    const enrichedMessage = inlineTextSections.length > 0
      ? `${message.trim()}\n\n${inlineTextSections.join('\n\n')}`
      : message.trim();

    const turnImageAttachments = currentTurnAttachments
      .filter((a) => a.raw_base64 && a.media_type.startsWith('image/'))
      .map((a) => ({
        base64: a.raw_base64 as string,
        media_type: a.media_type as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        name: a.filename,
      }));
    const allImageAttachments = turnImageAttachments.length > 0 ? turnImageAttachments : undefined;

    // ATTACHMENTS IN THIS CONVERSATION block - one entry per attachment in
    // the conversation, with its digest. Replayed in the system prompt so
    // the model can recall earlier uploads on later turns without us
    // re-sending the bytes.
    const attachmentDigestBlock = buildAttachmentDigestBlock(conversationAttachments);

    // -----------------------------------------------------------------------
    // PHASE 2: Call the AI brain.
    // Conversation history from DB already includes all messages (including
    // the one the user just sent), so the AI always has full context.
    // -----------------------------------------------------------------------

    perfMeta.historyMessages = conversationHistory.length;
    perfMeta.historyTokens = tokenCount;

    const tAI = Date.now();
    const result = await handleSetupMessage({
      userMessage: enrichedMessage,
      workspaceId: workspace_id,
      userId: authUser.id,
      conversationId: conversation_id,
      conversationHistory,
      precomputedAnalysis: workspace_analysis || undefined,
      planTier,
      proposedPlan: proposed_plan || undefined,
      // Previous draft comes from setup_drafts (Phase 1). On the first
      // turn of a new conversation this is null; mergeSnapshot handles the
      // missing-prev case by treating the model's emission as the initial
      // draft.
      chatStructureSnapshot: serverDraft ?? undefined,
      profileData: profile_data || undefined,
      imageAttachments: allImageAttachments,
      // Phase 2: digests of every attachment in this conversation. The
      // brain injects this block into the system prompt so the model can
      // reference earlier uploads without us re-sending bytes.
      attachmentDigestBlock,
    });
    mark('ai', tAI);
    perfMeta.aiTimings = result.timings;

    // -----------------------------------------------------------------------
    // PHASE 3: Save AI response immediately, then send response to client.
    // Credits and summarization happen AFTER the client gets the response.
    // -----------------------------------------------------------------------

    // Save assistant message right away (don't wait for billing).
    // Phase 4 dropped the messages.metadata.structure_snapshot mirror -
    // setup_drafts is the canonical store for the workspace draft, and
    // generate-plan reads from there directly. Keeping a duplicate copy
    // on every assistant message just bloated the messages table and
    // gave the impression of two sources of truth.
    const tAsstSave = Date.now();
    const assistantInsert = await adminClient.from('messages').insert({
      workspace_id,
      conversation_id,
      role: 'assistant',
      content: result.content,
      credits_used: result.creditsToCharge,
      metadata: {
        source: 'setup',
        tool_calls: result.toolCalls,
        anthropic_cost_cents: result.anthropicCostCents,
      },
    });
    if (assistantInsert.error) {
      // Non-fatal: the AI already responded and we still want to deliver
      // the text to the user. Loud log so silent persistence loss never
      // creeps back in.
      console.error('[setup/chat] assistant message insert failed:', assistantInsert.error);
    }
    mark('asstSave', tAsstSave);

    // Persist the merged snapshot to setup_drafts. mergeSnapshot has already
    // applied monotonicity (preserving user-named items the model dropped),
    // the userAskedForRebuild downgrade (no unauthorized full_replace), and
    // the truncation guard (parse failure leaves structureSnapshot
    // undefined). When undefined, we leave the existing draft alone - that
    // is the whole point of having a server-side source of truth: a
    // mis-formatted or skipped snapshot from the model never destroys the
    // approved draft.
    const tDraftSave = Date.now();
    if (result.structureSnapshot) {
      const { error: draftError } = await adminClient
        .from('setup_drafts')
        .upsert(
          {
            conversation_id,
            workspace_id,
            clickup_team_id: clickupTeamId,
            draft: result.structureSnapshot,
            updated_by: 'chat',
            // version is bumped by the upsert when the row already existed;
            // we increment manually here so concurrent reads see the change
            // even if the trigger ordering surprises us.
            version: (draftResult.data?.version ?? 0) + 1,
          },
          { onConflict: 'conversation_id' },
        );
      if (draftError) {
        console.error('[setup/chat] setup_drafts upsert failed:', draftError);
      }

      // Phase 4: write a setup_draft_changes audit row so we can spot
      // regressions without reading server logs. The diagnostics object
      // is produced by mergeSnapshot itself and includes intent
      // downgrades, truncation flags, and before/after counts. Failure
      // to log is non-fatal - the draft itself is already saved above.
      if (result.snapshotDiagnostics) {
        const d = result.snapshotDiagnostics;
        // source: 'chat' when legacy single-Sonnet ran; 'clarifier' or
        // 'reviser' when multi-agent routed. Helps us slice the audit
        // trail by role without reading every row.
        const auditSource: string = result.role ?? 'chat';
        const { error: auditError } = await adminClient
          .from('setup_draft_changes')
          .insert({
            workspace_id,
            conversation_id,
            source: auditSource,
            intent: d.intent,
            intent_full_replace_downgraded: d.intentFullReplaceDowngraded,
            truncated_response: d.truncatedResponse,
            spaces_before: d.spacesBefore,
            spaces_after: d.spacesAfter,
            lists_before: d.listsBefore,
            lists_after: d.listsAfter,
            rename_count: d.renameCount,
            remove_count: d.removeCount,
          });
        if (auditError) {
          console.error('[setup/chat] setup_draft_changes insert failed:', auditError);
        }
      }
    }
    mark('draftSave', tDraftSave);

    logSetupChatPerf(t0, stages, perfMeta, 'ok');

    // Fire-and-forget: billing, summarization, session updates.
    // These don't block the response to the client.
    (async () => {
      try {
        await adminClient.rpc('deduct_credits', {
          p_workspace_id: workspace_id,
          p_user_id: authUser.id,
          p_amount: result.creditsToCharge,
          p_description: 'Setup: workspace configuration',
          p_message_id: null,
          p_metadata: {
            credit_tier: 'premium',
            source: 'setup',
            input_tokens: result.totalInputTokens,
            output_tokens: result.totalOutputTokens,
            anthropic_cost_cents: result.anthropicCostCents,
            tool_calls: result.toolCalls,
          },
        });
      } catch (err) {
        console.error('[setup/chat] Credit deduction failed:', err);
      }

      try {
        // Multi-agent: when role === 'clarifier' the call was Haiku, otherwise
        // Sonnet (legacy generator-chat or Reviser). Logging the actual model
        // matters for the cost analytics dashboards.
        const modelUsed = result.role === 'clarifier' ? 'haiku' : 'sonnet';
        await adminClient.from('credit_usage').insert({
          user_id: authUser.id,
          workspace_id,
          action_type: 'chat',
          session_id: conversation_id,
          model_used: modelUsed,
          input_tokens: result.totalInputTokens ?? 0,
          output_tokens: result.totalOutputTokens ?? 0,
          anthropic_cost_cents: result.anthropicCostCents ?? 0,
          credits_deducted: result.creditsToCharge,
        });
      } catch (err) {
        console.error('[setup/chat] credit_usage insert failed:', err);
      }

      try {
        await adminClient
          .from('setup_sessions')
          .update({
            credits_used: adminClient.rpc('add_setup_credits', {
              p_conversation_id: conversation_id,
              p_amount: result.creditsToCharge,
            }),
          })
          .eq('conversation_id', conversation_id);
      } catch (err) {
        console.error('[setup/chat] setup_sessions update failed:', err);
      }

      // Summarize only the messages that fell outside the token budget window.
      // This passes the EXACT cutoff messages to the summarizer, so it captures
      // the right content. For most setup conversations (10-30 messages) cutoff
      // is 0 and this never triggers — full history, zero summarization.
      if (cutoffIndex > 0) {
        const olderMessages = allMessages.slice(0, cutoffIndex);
        summarizeOlderMessages(conversation_id, olderMessages, summary || null).catch(err =>
          console.error('[setup/chat] Background summarization failed:', err),
        );
      }
    })();

    return NextResponse.json({
      content: result.content,
      credits_consumed: result.creditsToCharge,
      tool_calls: result.toolCalls,
      // Return the merged snapshot so the client cache (zustand) updates
      // immediately, plus the new version stamp from setup_drafts so a
      // future mount can detect that its cache is fresh. The draft itself
      // is now authoritative on the server; this payload is for cache
      // priming, not source of truth.
      ...(result.structureSnapshot
        ? {
            structure_snapshot: result.structureSnapshot,
            draft_version: (draftResult.data?.version ?? 0) + 1,
          }
        : {}),
      // Multi-agent: extra fields for the chat UI. `ask` powers the chip
      // bubble, `brief` powers the "What I've gathered" checkpoint, `ready`
      // tells the client whether to highlight Generate Structure. All fields
      // are optional - the legacy single-Sonnet path returns none of them
      // and the client treats their absence as "behave as before".
      ...(result.role ? { role: result.role } : {}),
      ...(result.ask ? { ask: result.ask } : {}),
      ...(result.brief ? { brief: result.brief } : {}),
      ...(typeof result.ready === 'boolean' ? { ready: result.ready } : {}),
    });
  } catch (error) {
    console.error('[POST /api/setup/chat] Error:', error);
    logSetupChatPerf(t0, stages, perfMeta, 'error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup error' },
      { status: 500 },
    );
  }
}

/**
 * Single structured perf log per request. We log unconditionally (success or
 * error) so a 504 in production - which truncates the response but lets the
 * function finish on Vercel's side - still tells us where the time went.
 */
function logSetupChatPerf(
  t0: number,
  stages: Record<string, number>,
  meta: {
    convoId?: string;
    userId?: string;
    historyMessages?: number;
    historyTokens?: number;
    aiTimings?: import('@/lib/setup/setupper-brain').SetupperTimings;
  },
  status: 'ok' | 'error',
) {
  const totalMs = Date.now() - t0;
  // The slowest stage is almost always the AI call; surface it explicitly so
  // we don't have to scroll through the JSON every time.
  const slowest = Object.entries(stages).sort((a, b) => b[1] - a[1])[0];
  console.log(
    '[setup/chat:perf]',
    JSON.stringify({
      status,
      totalMs,
      slowest: slowest ? { stage: slowest[0], ms: slowest[1] } : null,
      stages,
      ai: meta.aiTimings,
      convoId: meta.convoId,
      userId: meta.userId,
      historyMessages: meta.historyMessages,
      historyTokens: meta.historyTokens,
    }),
  );
}
