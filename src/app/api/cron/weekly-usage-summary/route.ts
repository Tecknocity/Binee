import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyUsageSummaries } from '@/jobs/weekly-usage-summary';

/**
 * Vercel Cron endpoint for weekly usage summary generation.
 * Schedule: Every Monday at 01:00 UTC
 *
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/weekly-usage-summary", "schedule": "0 1 * * 1" }] }
 */
export async function GET(req: NextRequest) {
  // Verify the request comes from Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateWeeklyUsageSummaries();

  return NextResponse.json(result);
}
