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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/clickup/callback
 *
 * OAuth callback handler for ClickUp. After a user authorizes the app,
 * ClickUp redirects here with an authorization code and state parameter.
 *
 * Flow:
 * 1. Parse the state to get the workspace ID
 * 2. Exchange the code for access/refresh tokens
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

  // Handle OAuth errors
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
    // Step 1: Parse state to get workspace ID
    const { workspaceId } = parseOAuthState(state);

    // Step 2: Exchange code for tokens
    const tokens = await exchangeCodeForToken(code);

    // Step 3: Calculate token expiry and store tokens
    const expiresAt = new Date(
      Date.now() + (tokens.expires_in ?? 3600) * 1000
    );

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
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    let teamId: string | null = null;

    try {
      const teams = await client.getTeams();
      if (teams.length > 0) {
        teamId = teams[0].id;
        await supabase
          .from("workspaces")
          .update({
            clickup_team_id: teamId,
            clickup_team_name: teams[0].name,
            clickup_sync_status: 'syncing',
          })
          .eq("id", workspaceId);
      }
    } catch (teamError) {
      console.error("[OAuth] Failed to fetch ClickUp teams:", teamError);
    }

    // Step 5: Register webhooks
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

    // Step 6: Trigger initial sync (fire and forget)
    performInitialSync(workspaceId).then(async (result) => {
      const now = new Date().toISOString();
      await supabase
        .from("workspaces")
        .update({
          clickup_sync_status: 'complete',
          clickup_last_synced_at: now,
          last_sync_at: now,
          clickup_sync_error: result.errors.length > 0 ? result.errors.join('; ') : null,
        })
        .eq("id", workspaceId);
    }).catch(async (syncError) => {
      console.error("[OAuth] Initial sync failed:", syncError);
      await supabase
        .from("workspaces")
        .update({
          clickup_sync_status: 'error',
          clickup_sync_error: syncError instanceof Error ? syncError.message : 'Sync failed',
        })
        .eq("id", workspaceId);
    });

    // Step 7: Redirect to settings with success
    const redirectUrl = new URL("/settings", APP_URL);
    redirectUrl.searchParams.set("success", "clickup_connected");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("[OAuth] Callback processing error:", err);
    const redirectUrl = new URL("/settings", APP_URL);
    redirectUrl.searchParams.set("error", "clickup_connection_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
