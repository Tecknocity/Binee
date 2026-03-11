import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { performReconciliationSync } from "@/lib/clickup/sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET ?? "";

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * GET /api/cron/sync-reconcile
 *
 * Triggered by Vercel Cron (or similar scheduler) to run a lightweight
 * reconciliation sync for all active ClickUp-connected workspaces.
 *
 * Protected by CRON_SECRET — the request must include either:
 *   - Authorization: Bearer <CRON_SECRET>
 *   - ?secret=<CRON_SECRET> query parameter
 *
 * This catches any changes that webhooks may have missed (network issues,
 * webhook downtime, etc.) and keeps cached data in sync.
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  const providedSecret =
    authHeader?.replace("Bearer ", "") ?? querySecret ?? "";

  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find all workspaces with active ClickUp connections
  const { data: workspaces, error: queryError } = await supabase
    .from("workspaces")
    .select("id, clickup_team_name")
    .eq("clickup_connected", true)
    .not("clickup_team_id", "is", null);

  if (queryError) {
    console.error("[Cron] Failed to query workspaces:", queryError);
    return NextResponse.json(
      { error: "Failed to query workspaces" },
      { status: 500 }
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({
      message: "No active ClickUp workspaces to reconcile",
      count: 0,
    });
  }

  const results: Array<{
    workspaceId: string;
    teamName: string | null;
    success: boolean;
    tasks?: number;
    errors?: string[];
  }> = [];

  // Process each workspace sequentially to avoid rate-limit issues
  for (const workspace of workspaces) {
    try {
      console.log(
        `[Cron] Starting reconciliation for workspace: ${workspace.id} (${workspace.clickup_team_name})`
      );

      const syncResult = await performReconciliationSync(workspace.id);

      results.push({
        workspaceId: workspace.id,
        teamName: workspace.clickup_team_name,
        success: syncResult.errors.length === 0,
        tasks: syncResult.tasks,
        errors:
          syncResult.errors.length > 0 ? syncResult.errors : undefined,
      });

      console.log(
        `[Cron] Reconciliation complete for workspace: ${workspace.id} — ${syncResult.tasks} tasks synced`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      console.error(
        `[Cron] Reconciliation failed for workspace: ${workspace.id}`,
        err
      );

      results.push({
        workspaceId: workspace.id,
        teamName: workspace.clickup_team_name,
        success: false,
        errors: [errorMessage],
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    message: `Reconciliation complete: ${successCount}/${results.length} workspaces synced`,
    count: results.length,
    results,
  });
}
