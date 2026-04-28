import { NextRequest, NextResponse } from 'next/server';
import { handleSetupMessage } from '@/lib/setup/setupper-brain';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { summarizeOlderMessages } from '@/lib/ai/conversation-summary';

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

export const maxDuration = 90;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup:${authUser.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const body = await request.json();
    const { workspace_id, conversation_id, message, workspace_analysis, proposed_plan, profile_data, file_context, image_attachments } = body;

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

    // Validate image_attachments if provided (mirrors /api/chat validation)
    if (image_attachments) {
      if (!Array.isArray(image_attachments) || image_attachments.length > 3) {
        return NextResponse.json(
          { error: 'image_attachments must be an array of 3 or fewer images' },
          { status: 400 },
        );
      }
      const validMediaTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
      for (const img of image_attachments) {
        if (!img.base64 || typeof img.base64 !== 'string') {
          return NextResponse.json({ error: 'Each image must have a base64 string' }, { status: 400 });
        }
        if (!validMediaTypes.has(img.media_type)) {
          return NextResponse.json({ error: `Unsupported image type: ${img.media_type}` }, { status: 400 });
        }
        if (img.base64.length > 7_000_000) {
          return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 });
        }
      }
    }

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

    // Save user message to DB immediately — before the AI call.
    // Stash a small metadata marker when the turn included image attachments
    // so future turns know an image was in scope here, even though the image
    // bytes themselves are not re-sent. Without this, the model loses all
    // memory of past uploads and tells the user "I don't see any screenshot"
    // when they refer back to one.
    const hasImages = Array.isArray(image_attachments) && image_attachments.length > 0;
    const userMessageMetadata: Record<string, unknown> = {};
    if (hasImages) {
      userMessageMetadata.image_count = image_attachments.length;
      const names = (image_attachments as Array<{ name?: unknown }>)
        .map((img) => (typeof img?.name === 'string' ? img.name : null))
        .filter((n): n is string => !!n);
      if (names.length > 0) userMessageMetadata.image_names = names;
    }
    // Stash parsed file content so subsequent turns can still see what the
    // user uploaded (e.g. an Excel of goals). Capped at FILE_CONTEXT_CAP to
    // keep the message row and downstream conversation-history tokens
    // bounded; longer content is preserved as head + tail with a truncation
    // marker, which is enough for the model to remember structure and key
    // values without duplicating the full file every turn.
    const FILE_CONTEXT_CAP = 8_000;
    if (typeof file_context === 'string' && file_context.trim().length > 0) {
      const fc = file_context.trim();
      if (fc.length <= FILE_CONTEXT_CAP) {
        userMessageMetadata.file_context = fc;
      } else {
        const head = fc.slice(0, Math.floor(FILE_CONTEXT_CAP * 0.7));
        const tail = fc.slice(-Math.floor(FILE_CONTEXT_CAP * 0.25));
        const omitted = fc.length - head.length - tail.length;
        userMessageMetadata.file_context = `${head}\n...[file content truncated, ${omitted} chars omitted]...\n${tail}`;
      }
    }
    const userInsert = await adminClient.from('messages').insert({
      workspace_id,
      conversation_id,
      role: 'user',
      content: message.trim(),
      credits_used: 0,
      ...(Object.keys(userMessageMetadata).length > 0 ? { metadata: userMessageMetadata } : {}),
    });
    if (userInsert.error) {
      // Same rationale as the conversations upsert above: surfacing the
      // error keeps us honest about persistence failures instead of
      // letting the AI respond to a message we never actually stored.
      console.error('[setup/chat] user message insert failed:', userInsert.error);
      return NextResponse.json(
        {
          error: 'Could not save your message. Please try again.',
          detail: userInsert.error.message,
        },
        { status: 500 },
      );
    }

    // Load context in parallel
    const [workspaceResult, historyResult, conversationResult, draftResult] = await Promise.all([
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
        .select('role, content, metadata')
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
    ]);

    const planTier = workspaceResult.data?.clickup_plan_tier || 'free';
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

    // Render each persisted row to the exact text that goes to the model, so
    // image-attachment markers from past turns are visible in conversation
    // history. The model's prior reply (which describes what it saw) is also
    // in history, giving it full memory of earlier uploads even though the
    // raw image bytes are only sent on the turn they were attached to.
    const renderHistoryContent = (row: { role: string; content: string; metadata?: unknown }): string => {
      if (row.role !== 'user') return row.content;
      const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : null;
      if (!meta) return row.content;

      const imageCount = typeof meta.image_count === 'number' ? meta.image_count : 0;
      const fileContext = typeof meta.file_context === 'string' ? meta.file_context : null;
      if (imageCount <= 0 && !fileContext) return row.content;

      let prefix = '';
      if (imageCount > 0) {
        const names = Array.isArray(meta.image_names)
          ? (meta.image_names as unknown[]).filter((n): n is string => typeof n === 'string')
          : [];
        const namesPart = names.length > 0 ? `: ${names.join(', ')}` : '';
        const noun = imageCount === 1 ? 'image' : 'images';
        prefix = `[Earlier in this chat the user attached ${imageCount} ${noun}${namesPart}. The image bytes are not re-attached on this turn, but your description of what they contained is in your reply that follows; treat that as your memory of the upload.]\n\n`;
      }
      const suffix = fileContext
        ? `\n\n--- ATTACHED FILE CONTENT ---\n${fileContext}\n--- END ATTACHED FILE CONTENT ---`
        : '';
      return `${prefix}${row.content}${suffix}`;
    };

    // Count tokens from newest to oldest, keeping messages that fit the budget
    let tokenCount = 0;
    let cutoffIndex = 0; // Index where we start including messages
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(renderHistoryContent(allMessages[i]));
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
        content: renderHistoryContent(recentMessages[i]),
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

    // Enrich message with file context if the user attached files
    const enrichedMessage = file_context
      ? `${message.trim()}\n\n--- ATTACHED FILE CONTENT ---\n${file_context}\n--- END ATTACHED FILE CONTENT ---`
      : message.trim();

    // -----------------------------------------------------------------------
    // PHASE 2: Call the AI brain.
    // Conversation history from DB already includes all messages (including
    // the one the user just sent), so the AI always has full context.
    // -----------------------------------------------------------------------

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
      imageAttachments: Array.isArray(image_attachments) && image_attachments.length > 0 ? image_attachments : undefined,
    });

    // -----------------------------------------------------------------------
    // PHASE 3: Save AI response immediately, then send response to client.
    // Credits and summarization happen AFTER the client gets the response.
    // -----------------------------------------------------------------------

    // Save assistant message right away (don't wait for billing).
    // We still mirror structure_snapshot into messages.metadata for legacy
    // consumers and audit trail, but the canonical store is setup_drafts
    // below. Phase 5 will drop the metadata mirror once the migration has
    // been live long enough that no in-flight conversations rely on it.
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
        ...(result.structureSnapshot ? { structure_snapshot: result.structureSnapshot } : {}),
      },
    });
    if (assistantInsert.error) {
      // Non-fatal: the AI already responded and we still want to deliver
      // the text to the user. Loud log so silent persistence loss never
      // creeps back in.
      console.error('[setup/chat] assistant message insert failed:', assistantInsert.error);
    }

    // Persist the merged snapshot to setup_drafts. mergeSnapshot has already
    // applied monotonicity (preserving user-named items the model dropped),
    // the userAskedForRebuild downgrade (no unauthorized full_replace), and
    // the truncation guard (parse failure leaves structureSnapshot
    // undefined). When undefined, we leave the existing draft alone - that
    // is the whole point of having a server-side source of truth: a
    // mis-formatted or skipped snapshot from the model never destroys the
    // approved draft.
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
    }

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
        await adminClient.from('credit_usage').insert({
          user_id: authUser.id,
          workspace_id,
          action_type: 'chat',
          session_id: conversation_id,
          model_used: 'sonnet',
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
    });
  } catch (error) {
    console.error('[POST /api/setup/chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup error' },
      { status: 500 },
    );
  }
}
