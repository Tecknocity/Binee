import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { getReconciliationRecommendations } from '@/lib/setup/reconciliation-recommender';
import { assertSufficientCredits } from '@/lib/credits/guard';
import type { ExecutionItem } from '@/lib/setup/executor';
import type { SetupPlan } from '@/lib/setup/types';

export const maxDuration = 30;

// Reconciliation runs a Sonnet call but is not separately billed - it is
// part of the Review experience the user already paid for via the chat
// turns and the generate-plan call. Guard on having ANY credits left.
const RECONCILIATION_MIN_CREDITS = 0.01;

/**
 * POST /api/setup/reconciliation-recommendations
 *
 * Get AI recommendations for existing workspace items: keep or delete,
 * with reasoning. Uses Haiku for fast, cheap classification.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup-reconciliation:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const {
      workspace_id,
      existingItems,
      proposedPlan,
      businessDescription,
      planTier,
      maxSpaces,
      existingSpaceCount,
      newSpaceCount,
    } = await request.json() as {
      workspace_id?: string;
      existingItems: ExecutionItem[];
      proposedPlan: SetupPlan;
      businessDescription?: string;
      planTier?: string;
      maxSpaces?: number | null;
      existingSpaceCount?: number;
      newSpaceCount?: number;
    };

    if (!existingItems || !proposedPlan) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    // Platform-wide credit guard.
    const creditCheck = await assertSufficientCredits(supabase, workspace_id, RECONCILIATION_MIN_CREDITS);
    if (!creditCheck.ok) return creditCheck.response;

    const recommendations = await getReconciliationRecommendations(
      existingItems,
      proposedPlan,
      {
        businessDescription,
        planTier,
        maxSpaces,
        existingSpaceCount,
        newSpaceCount,
      },
    );

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('[POST /api/setup/reconciliation-recommendations] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recommendation failed' },
      { status: 500 },
    );
  }
}
