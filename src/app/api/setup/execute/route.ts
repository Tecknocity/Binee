import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { executeSetupPlan } from '@/lib/setup/executor';
import type { SetupPlan } from '@/lib/setup/types';
import type { ExistingWorkspaceStructure } from '@/stores/setupStore';

export const maxDuration = 120;

/**
 * POST /api/setup/execute
 *
 * Runs the setup execution plan server-side where ClickUp tokens are accessible.
 * Streams progress events back as NDJSON so the client can update the UI in real time.
 *
 * Body: { workspace_id, plan, existing_structure? }
 * Response: NDJSON stream of { type: 'progress' | 'complete' | 'error', data: ... }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { workspace_id, plan, existing_structure } = body as {
      workspace_id: string;
      plan: SetupPlan;
      existing_structure?: ExistingWorkspaceStructure | null;
    };

    if (!workspace_id || !plan) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id or plan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify user belongs to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', authUser.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this workspace' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await executeSetupPlan(
            plan,
            workspace_id,
            '', // accessToken is unused - ClickUpClient fetches its own token server-side
            (completedItem, progress) => {
              const event = JSON.stringify({
                type: 'progress',
                item: completedItem,
                progress,
              });
              controller.enqueue(encoder.encode(event + '\n'));
            },
            existing_structure,
          );

          const completeEvent = JSON.stringify({
            type: 'complete',
            result,
          });
          controller.enqueue(encoder.encode(completeEvent + '\n'));
        } catch (err) {
          const errorEvent = JSON.stringify({
            type: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
          controller.enqueue(encoder.encode(errorEvent + '\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    console.error('[setup/execute] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
