import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 15;

// conversations.id (and therefore setup_drafts.conversation_id, since it
// FKs to it) is a uuid column. Reject non-UUID ids at the API boundary so
// a malformed client cannot trigger a Postgres-level error and exercise
// the silent-failure mode that Phase 1.5 fixed.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * GET /api/setup/draft?conversation_id=...
 *
 * Returns the canonical setup draft for a conversation. The draft is the
 * single source of truth shared by the setup chat, generate-plan, the
 * Review screen, and the build executor. Frontend zustand caches the
 * result; this endpoint is what the cache reads from on mount, on tab
 * visibility change, and after Review-side manual edits.
 *
 * Returns 200 with `{ draft: null }` (and version 0) when the conversation
 * has no draft yet - that is the legitimate state for a fresh setup
 * session before the first chat turn.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = request.nextUrl.searchParams.get('conversation_id');
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }
    if (!isUuid(conversationId)) {
      return NextResponse.json({ error: 'conversation_id must be a UUID' }, { status: 400 });
    }

    // Use the user-scoped client so RLS verifies workspace membership for us
    // - the SELECT policy on setup_drafts already requires the caller to be
    // a member of the draft's workspace.
    const { data, error } = await supabase
      .from('setup_drafts')
      .select('conversation_id, workspace_id, clickup_team_id, draft, version, updated_by, updated_at')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/setup/draft] read failed:', error);
      return NextResponse.json({ error: 'Failed to load draft' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        conversation_id: conversationId,
        draft: null,
        version: 0,
        updated_by: null,
        updated_at: null,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[GET /api/setup/draft] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/setup/draft
 *
 * Replaces the canonical draft for a conversation. Used by the Review
 * screen when the user manually edits the structure (rename a list,
 * delete a space, change statuses) so those edits are visible to the
 * next chat turn and to the build executor without round-tripping
 * through the chat AI.
 *
 * The body shape mirrors the chat-emitted snapshot so chat and review
 * can share a merge-free update path:
 *   { conversation_id, draft, expected_version? }
 *
 * `expected_version` is optional optimistic concurrency: when provided
 * we reject the write if the stored version no longer matches, so two
 * clients editing simultaneously cannot silently overwrite each other.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      conversation_id?: string;
      draft?: Record<string, unknown>;
      expected_version?: number;
    };
    const { conversation_id, draft, expected_version } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }
    if (!isUuid(conversation_id)) {
      return NextResponse.json({ error: 'conversation_id must be a UUID' }, { status: 400 });
    }
    if (!draft || typeof draft !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid draft' }, { status: 400 });
    }

    // Resolve the workspace from the conversation so the upsert can
    // populate workspace_id / clickup_team_id even when the row does not
    // exist yet (Review-first manual edit before any chat turn). We use
    // the service role client here because conversations RLS may not
    // allow this kind of cross-row read for non-owners; existence has
    // already been guaranteed by the user's session and we additionally
    // verify the user is a member of the resolved workspace below.
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

    // Verify membership before writing. RLS on setup_drafts only covers
    // SELECT (writes go through the service role); this check is the
    // equivalent gate for PATCH.
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', convoRow.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optimistic concurrency: if the caller passed expected_version, only
    // proceed when the stored version matches. The chat route does not
    // pass this (its merge already handles concurrent intent at the data
    // layer); the Review screen does.
    const { data: existing } = await adminClient
      .from('setup_drafts')
      .select('version, clickup_team_id')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    if (
      typeof expected_version === 'number'
      && existing
      && existing.version !== expected_version
    ) {
      return NextResponse.json(
        {
          error: 'Draft has been updated by another session',
          server_version: existing.version,
        },
        { status: 409 },
      );
    }

    const { data: workspaceRow } = await adminClient
      .from('workspaces')
      .select('clickup_team_id')
      .eq('id', convoRow.workspace_id)
      .maybeSingle();

    const { data: upserted, error: upsertError } = await adminClient
      .from('setup_drafts')
      .upsert(
        {
          conversation_id,
          workspace_id: convoRow.workspace_id,
          clickup_team_id: existing?.clickup_team_id ?? workspaceRow?.clickup_team_id ?? null,
          draft,
          updated_by: 'manual_edit',
          version: (existing?.version ?? 0) + 1,
        },
        { onConflict: 'conversation_id' },
      )
      .select('conversation_id, workspace_id, clickup_team_id, draft, version, updated_by, updated_at')
      .single();

    if (upsertError) {
      console.error('[PATCH /api/setup/draft] upsert failed:', upsertError);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }

    return NextResponse.json(upserted);
  } catch (error) {
    console.error('[PATCH /api/setup/draft] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
