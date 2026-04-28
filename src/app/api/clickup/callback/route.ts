import { NextRequest, NextResponse } from "next/server";
import {
  parseOAuthState,
  exchangeCodeForToken,
  storeTokens,
} from "@/lib/clickup/oauth";
import { performInitialSync } from "@/lib/clickup/sync";
import { registerWebhooks } from "@/lib/clickup/webhooks";
import { ClickUpClient } from "@/lib/clickup/client";
import { createClient } from "@supabase/supabase-js";

// Allow enough time for OAuth token exchange + team info fetch + webhook
// registration + initial sync start. The sync itself runs fire-and-forget
// (background) since we redirect the user to settings immediately.
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/clickup/callback
 *
 * OAuth callback handler for ClickUp. After a user authorizes the app,
 * ClickUp redirects here with an authorization code and state parameter.
 *
 * Flow:
 * 1. Parse the state to get the workspace ID
 * 2. Exchange the code for tokens server-side (client_id + client_secret)
 * 3. Store encrypted tokens in the workspace record
 * 4. Fetch team info and store it
 * 5. Register webhooks for real-time updates
 * 6. Trigger initial data sync (in background)
 * 7. Redirect to the settings page
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors (user denied access, etc.)
  if (error) {
    console.error("[OAuth] ClickUp authorization error:", error);
    const redirectUrl = new URL("/settings", APP_URL);
    redirectUrl.searchParams.set("error", "clickup_auth_denied");
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Validate required parameters
  if (!code || !state) {
    const redirectUrl = new URL("/settings", APP_URL);
    redirectUrl.searchParams.set("error", "clickup_missing_params");
    return NextResponse.redirect(redirectUrl.toString());
  }

  try {
    // Step 1: Parse state to get workspace ID and source
    const { workspaceId, source } = parseOAuthState(state);

    // Step 2: Exchange code for tokens (server-side only, no PKCE)
    const tokens = await exchangeCodeForToken(code);

    // Step 3: Store tokens (ClickUp tokens currently don't expire)
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await storeTokens(
      workspaceId,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt
    );

    // Step 4: Fetch team info and store it
    const client = new ClickUpClient(workspaceId);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    let teamId: string | null = null;

    // Fetch the previous team ID to detect workspace changes
    const { data: prevWorkspace } = await supabase
      .from("workspaces")
      .select("clickup_team_id")
      .eq("id", workspaceId)
      .single();
    const previousTeamId = prevWorkspace?.clickup_team_id ?? null;

    try {
      const teams = await client.getTeams();
      if (teams.length > 0) {
        teamId = teams[0].id;

        // Phase 3 stops scraping ClickUp's /team for plan info. The
        // endpoint does not document a plan field; some accounts return
        // one in an undocumented `plan.name`, most do not, and the
        // resulting `?? "free"` propagation produced a months-long
        // "you are on Free" loop on Business Plus workspaces. Plan tier
        // is now a user-supplied dropdown (see BusinessProfileForm and
        // /api/workspace/clickup-plan), with `clickup_plan_tier_source`
        // = 'user'. The OAuth callback no longer touches the column.

        // If connecting a different ClickUp workspace, purge old cached data
        if (previousTeamId && previousTeamId !== teamId) {
          console.log(`[OAuth] Team changed from ${previousTeamId} to ${teamId}, purging old cached data`);
          const cacheTables = [
            "cached_tasks",
            "cached_time_entries",
            "cached_lists",
            "cached_folders",
            "cached_spaces",
            "cached_team_members",
          ] as const;
          for (const table of cacheTables) {
            await supabase.from(table).delete().eq("workspace_id", workspaceId);
          }
          // Also clear workspace analysis snapshots since they reference old structure
          await supabase.from("workspace_structure_snapshots").delete().eq("workspace_id", workspaceId);
          // Reset sync progress tracking for the new team
          await supabase.from("clickup_connections").update({
            sync_status: "idle",
            sync_phase: null,
            sync_current: null,
            sync_total: null,
            sync_message: null,
            sync_error: null,
            sync_started_at: null,
            sync_completed_at: null,
            synced_spaces: null,
            synced_folders: null,
            synced_lists: null,
            synced_tasks: null,
            synced_members: null,
            synced_time_entries: null,
          }).eq("workspace_id", workspaceId);
        }

        // Plan tier is intentionally not written here. When the team
        // changes we DO clear it, because the new ClickUp account may
        // be on a different plan than the previous one and "user has
        // not yet confirmed plan for this team" (NULL) is the correct
        // state to show the dropdown again.
        const workspaceUpdate: Record<string, unknown> = {
          clickup_team_id: teamId,
          clickup_team_name: teams[0].name,
          clickup_sync_status: "syncing",
          clickup_sync_started_at: new Date().toISOString(),
        };
        if (previousTeamId && previousTeamId !== teamId) {
          workspaceUpdate.clickup_plan_tier = null;
          workspaceUpdate.clickup_plan_tier_source = null;
          workspaceUpdate.clickup_plan_tier_set_at = null;
        }
        await supabase
          .from("workspaces")
          .update(workspaceUpdate)
          .eq("id", workspaceId);
      }
    } catch (teamError) {
      console.error("[OAuth] Failed to fetch ClickUp teams:", teamError);
    }

    // Step 5: Create clickup_connections row for sync progress tracking
    // This MUST exist before sync starts, otherwise progress updates silently fail
    try {
      await supabase
        .from("clickup_connections")
        .upsert(
          {
            workspace_id: workspaceId,
            clickup_team_id: teamId,
            sync_status: "idle",
          },
          { onConflict: "workspace_id" }
        );
    } catch (connError) {
      console.error("[OAuth] Failed to create clickup_connections row:", connError);
      // Non-fatal — sync will still work, but onboarding progress UI won't update
    }

    // Step 6: Register webhooks
    if (teamId) {
      try {
        await registerWebhooks(workspaceId, teamId);
      } catch (webhookError) {
        console.error(
          "[OAuth] Failed to register webhooks:",
          webhookError
        );
        // Non-fatal — sync will still work without webhooks
      }
    }

    // Step 7: Trigger initial sync — fire and forget
    performInitialSync(workspaceId)
      .then(async (result) => {
        const now = new Date().toISOString();
        await supabase
          .from("workspaces")
          .update({
            clickup_sync_status: "complete",
            clickup_last_synced_at: now,
            last_sync_at: now,
            clickup_sync_started_at: null,
            clickup_sync_error:
              result.errors.length > 0
                ? result.errors.join("; ")
                : null,
          })
          .eq("id", workspaceId);
      })
      .catch(async (syncError) => {
        console.error("[OAuth] Initial sync failed:", syncError);
        await supabase
          .from("workspaces")
          .update({
            clickup_sync_status: "error",
            clickup_sync_started_at: null,
            clickup_sync_error:
              syncError instanceof Error
                ? syncError.message
                : "Sync failed",
          })
          .eq("id", workspaceId);
      });

    // Step 8: Redirect back to where the user came from
    const redirectPath = source === "setup" ? "/setup" : "/settings";
    const redirectUrl = new URL(redirectPath, APP_URL);
    redirectUrl.searchParams.set("success", "clickup_connected");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("[OAuth] Callback processing error:", err);
    const redirectUrl = new URL("/settings", APP_URL);
    redirectUrl.searchParams.set("error", "clickup_connection_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
