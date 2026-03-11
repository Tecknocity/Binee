import { NextRequest, NextResponse } from "next/server";
import {
  parseOAuthState,
  exchangeCodeForToken,
  storeTokens,
} from "@/lib/clickup/oauth";
import { performInitialSync } from "@/lib/clickup/sync";
import { registerWebhooks } from "@/lib/clickup/webhooks";
import { ClickUpClient } from "@/lib/clickup/client";

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
    const redirectUrl = new URL("/settings/integrations", APP_URL);
    redirectUrl.searchParams.set("error", "clickup_auth_denied");
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Validate required parameters
  if (!code || !state) {
    const redirectUrl = new URL("/settings/integrations", APP_URL);
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

    // Step 4: Fetch team info
    const client = new ClickUpClient(workspaceId);
    let teamId: string | null = null;

    try {
      const teams = await client.getTeams();
      if (teams.length > 0) {
        teamId = teams[0].id;
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
    // Run in the background so the user isn't kept waiting
    performInitialSync(workspaceId).catch((syncError) => {
      console.error("[OAuth] Initial sync failed:", syncError);
    });

    // Step 7: Redirect to settings with success
    const redirectUrl = new URL("/settings/integrations", APP_URL);
    redirectUrl.searchParams.set("success", "clickup_connected");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("[OAuth] Callback processing error:", err);
    const redirectUrl = new URL("/settings/integrations", APP_URL);
    redirectUrl.searchParams.set("error", "clickup_connection_failed");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
