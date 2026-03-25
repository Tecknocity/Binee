import { NextResponse } from 'next/server';
import { processDailyCreditAllocations } from '@/jobs/credit-allocation';

// Vercel Cron: runs daily at 00:05 UTC
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await processDailyCreditAllocations();
    return NextResponse.json({
      message: 'Credit allocation complete',
      ...results,
    });
  } catch (err) {
    console.error('Credit allocation cron failed:', err);
    return NextResponse.json(
      { error: 'Credit allocation failed' },
      { status: 500 },
    );
  }
}
