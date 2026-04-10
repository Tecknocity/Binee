import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { getReconciliationRecommendations } from '@/lib/setup/reconciliation-recommender';
import type { ExecutionItem } from '@/lib/setup/executor';
import type { SetupPlan } from '@/lib/setup/types';

export const maxDuration = 30;

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
      existingItems,
      proposedPlan,
      businessDescription,
      planTier,
      maxSpaces,
      existingSpaceCount,
      newSpaceCount,
    } = await request.json() as {
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
