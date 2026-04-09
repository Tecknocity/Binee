import { createClient } from "@supabase/supabase-js";
import type { ClickUpOAuthTokens } from "@/types/clickup";
import { encryptToken, decryptToken } from "@/lib/clickup/encryption";

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const CLICKUP_CLIENT_ID = process.env.CLICKUP_CLIENT_ID ?? "";
const CLICKUP_CLIENT_SECRET = process.env.CLICKUP_CLIENT_SECRET ?? "";
const CLICKUP_REDIRECT_URI =
  process.env.CLICKUP_REDIRECT_URI ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/clickup/callback`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ---------------------------------------------------------------------------
// OAuth URL generation
// ---------------------------------------------------------------------------

/**
 * Generates a ClickUp OAuth 2.0 authorization URL.
 *
 * ClickUp does NOT support PKCE — we use a standard OAuth 2.0 flow with
 * client_id + client_secret exchanged server-side.
 *
 * The state parameter encodes the workspace ID so we can associate
 * the callback with the correct workspace.
 */
export function getClickUpAuthUrl(workspaceId: string, source?: string): string {
  if (!CLICKUP_CLIENT_ID) {
    throw new Error("CLICKUP_CLIENT_ID environment variable is not configured");
  }
  if (!CLICKUP_REDIRECT_URI) {
    throw new Error(
      "CLICKUP_REDIRECT_URI environment variable is not configured"
    );
  }

  const state = Buffer.from(
    JSON.stringify({ workspaceId, ts: Date.now(), source: source || "settings" })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: CLICKUP_CLIENT_ID,
    redirect_uri: CLICKUP_REDIRECT_URI,
    response_type: "code",
    state,
  });

  return `https://app.clickup.com/api?${params.toString()}`;
}

/**
 * Parses the state parameter from the OAuth callback to extract the workspace ID.
 */
export function parseOAuthState(state: string): { workspaceId: string; source: string } {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );
    if (!decoded.workspaceId) {
      throw new Error("Missing workspaceId in OAuth state");
    }
    return { workspaceId: decoded.workspaceId, source: decoded.source || "settings" };
  } catch {
    throw new Error("Invalid OAuth state parameter");
  }
}

// ---------------------------------------------------------------------------
// Token exchange & refresh
// ---------------------------------------------------------------------------

/**
 * Exchanges an authorization code for access and refresh tokens.
 *
 * IMPORTANT: ClickUp's token endpoint expects parameters as **query params**
 * on the URL, NOT as a JSON body. This is unlike most of their other endpoints.
 *
 * ClickUp tokens currently do not expire.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<ClickUpOAuthTokens> {
  const params = new URLSearchParams({
    client_id: CLICKUP_CLIENT_ID,
    client_secret: CLICKUP_CLIENT_SECRET,
    code,
  });

  const res = await fetch(
    `https://api.clickup.com/api/v2/oauth/token?${params.toString()}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to exchange code for token: ${res.status} ${errorText}`
    );
  }

  return (await res.json()) as ClickUpOAuthTokens;
}

/**
 * Refreshes an expired access token using the refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<ClickUpOAuthTokens> {
  const res = await fetch("https://api.clickup.com/api/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLICKUP_CLIENT_ID,
      client_secret: CLICKUP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Failed to refresh token: ${res.status} ${errorText}`
    );
  }

  return (await res.json()) as ClickUpOAuthTokens;
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Stores encrypted OAuth tokens in the workspace record.
 *
 * ClickUp tokens currently do not expire, so refreshToken and expiresAt
 * are optional.
 */
export async function storeTokens(
  workspaceId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const encryptedAccess = encryptToken(accessToken);

  const updateData: Record<string, unknown> = {
    clickup_access_token: encryptedAccess,
    clickup_connected: true,
    updated_at: new Date().toISOString(),
  };

  if (refreshToken) {
    updateData.clickup_refresh_token = encryptToken(refreshToken);
  }
  if (expiresAt) {
    updateData.clickup_token_expires_at = expiresAt.toISOString();
  }

  const { error } = await supabase
    .from("workspaces")
    .update(updateData)
    .eq("id", workspaceId);

  if (error) {
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
}

/**
 * Retrieves a valid access token for the workspace.
 *
 * ClickUp tokens currently do not expire. If an expiry is set and the token
 * is close to expiring, we attempt a refresh. Otherwise we return the stored
 * token directly.
 */
export async function getAccessToken(
  workspaceId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      "clickup_access_token, clickup_refresh_token, clickup_token_expires_at, clickup_connected"
    )
    .eq("id", workspaceId)
    .single();

  if (error || !workspace) {
    return null;
  }

  if (!workspace.clickup_connected || !workspace.clickup_access_token) {
    return null;
  }

  // If an expiry is set and the token expires within 5 minutes, try to refresh
  if (workspace.clickup_token_expires_at && workspace.clickup_refresh_token) {
    const expiresAt = new Date(workspace.clickup_token_expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() < bufferMs) {
      try {
        const decryptedRefresh = decryptToken(
          workspace.clickup_refresh_token
        );
        const newTokens = await refreshAccessToken(decryptedRefresh);

        const newExpiresAt = newTokens.expires_in
          ? new Date(Date.now() + newTokens.expires_in * 1000)
          : undefined;

        await storeTokens(
          workspaceId,
          newTokens.access_token,
          newTokens.refresh_token,
          newExpiresAt
        );

        return newTokens.access_token;
      } catch (refreshError) {
        console.error("Failed to refresh ClickUp token:", refreshError);
        // Return null to signal the token is unavailable, but do NOT mark
        // workspace as disconnected. The token may still be valid (ClickUp
        // tokens often don't expire), and setting clickup_connected=false
        // permanently breaks the connection for all other code paths.
        return null;
      }
    }
  }

  return decryptToken(workspace.clickup_access_token);
}

/**
 * Disconnects ClickUp by clearing stored tokens.
 */
export async function disconnectClickUp(
  workspaceId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("workspaces")
    .update({
      clickup_access_token: null,
      clickup_refresh_token: null,
      clickup_token_expires_at: null,
      clickup_connected: false,
      clickup_team_id: null,
      clickup_team_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  if (error) {
    throw new Error(`Failed to disconnect ClickUp: ${error.message}`);
  }
}

