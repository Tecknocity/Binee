import { createClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "@/lib/clickup/encryption";
import { refreshAccessToken } from "@/lib/clickup/oauth";

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Buffer before expiry to trigger a refresh (5 minutes) */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------

interface ClickUpConnection {
  id: string;
  workspace_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  sync_status: string | null;
}

async function getConnection(
  workspaceId: string
): Promise<ClickUpConnection | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("clickup_connections")
    .select(
      "id, workspace_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, sync_status"
    )
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) return null;
  return data as ClickUpConnection;
}

async function updateConnectionTokens(
  connectionId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date | undefined
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const updateData: Record<string, unknown> = {
    access_token_encrypted: encryptToken(accessToken),
    updated_at: new Date().toISOString(),
  };

  if (refreshToken) {
    updateData.refresh_token_encrypted = encryptToken(refreshToken);
  }
  if (expiresAt) {
    updateData.token_expires_at = expiresAt.toISOString();
  }

  const { error } = await supabase
    .from("clickup_connections")
    .update(updateData)
    .eq("id", connectionId);

  if (error) {
    throw new Error(`Failed to update connection tokens: ${error.message}`);
  }
}

async function markConnectionError(
  connectionId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("clickup_connections")
    .update({
      sync_status: "error",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  // Also update the workspace so the UI can show the error state
  const { data: connection } = await supabase
    .from("clickup_connections")
    .select("workspace_id")
    .eq("id", connectionId)
    .single();

  if (connection) {
    await supabase
      .from("workspaces")
      .update({
        clickup_connected: false,
        clickup_sync_status: "error",
        clickup_sync_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.workspace_id);
  }
}

// ---------------------------------------------------------------------------
// Token refresh functions
// ---------------------------------------------------------------------------

/**
 * Checks the token expiry for a workspace and refreshes if within 5 minutes
 * of expiration. Returns a valid access token.
 *
 * Falls back to the workspaces table if no clickup_connections row exists
 * OR if the clickup_connections row has no tokens stored (the OAuth callback
 * stores tokens in the workspaces table, not clickup_connections).
 */
export async function refreshTokenIfNeeded(
  workspaceId: string
): Promise<string> {
  const connection = await getConnection(workspaceId);

  if (!connection || !connection.access_token_encrypted) {
    // Fall back to legacy workspaces-based token retrieval.
    // This is the normal path because the OAuth callback stores tokens in
    // the workspaces table, while clickup_connections is used for sync tracking.
    const { getAccessToken } = await import("@/lib/clickup/oauth");
    const token = await getAccessToken(workspaceId);
    if (!token) {
      throw new Error("No valid ClickUp connection found for workspace");
    }
    return token;
  }

  // Check if refresh is needed
  if (connection.token_expires_at && connection.refresh_token_encrypted) {
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();

    if (expiresAt.getTime() - now.getTime() < REFRESH_BUFFER_MS) {
      return performRefresh(connection);
    }
  }

  return decryptToken(connection.access_token_encrypted);
}

/**
 * Forces a token refresh regardless of expiry time.
 * Useful when an API call returns 401, indicating the token may have been
 * revoked or invalidated early.
 *
 * If the clickup_connections table has no refresh token (normal case when
 * tokens live in the workspaces table), falls back to legacy token retrieval
 * WITHOUT marking the connection as errored.
 */
export async function forceRefreshToken(
  workspaceId: string
): Promise<string> {
  const connection = await getConnection(workspaceId);

  if (!connection || !connection.refresh_token_encrypted) {
    // No refresh token in clickup_connections — try legacy path.
    // ClickUp tokens often don't expire, so the existing token may still be
    // valid even after a 401 (transient issue). Don't mark connection as
    // errored, just return the legacy token.
    const { getAccessToken } = await import("@/lib/clickup/oauth");
    const token = await getAccessToken(workspaceId);
    if (!token) {
      // Only mark error if we truly have no token anywhere
      if (connection) {
        await markConnectionError(
          connection.id,
          "No valid access token available. Please reconnect ClickUp."
        );
      }
      throw new Error(
        "No valid access token available. User must reconnect ClickUp."
      );
    }
    return token;
  }

  return performRefresh(connection);
}

/**
 * Core refresh logic shared by refreshTokenIfNeeded and forceRefreshToken.
 */
async function performRefresh(connection: ClickUpConnection): Promise<string> {
  if (!connection.refresh_token_encrypted) {
    throw new Error("No refresh token available");
  }

  try {
    const decryptedRefresh = decryptToken(connection.refresh_token_encrypted);
    const newTokens = await refreshAccessToken(decryptedRefresh);

    const newExpiresAt = newTokens.expires_in
      ? new Date(Date.now() + newTokens.expires_in * 1000)
      : undefined;

    await updateConnectionTokens(
      connection.id,
      newTokens.access_token,
      newTokens.refresh_token,
      newExpiresAt
    );

    return newTokens.access_token;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown refresh error";

    await markConnectionError(
      connection.id,
      `Token refresh failed: ${message}. Please reconnect ClickUp.`
    );

    throw new Error(
      `ClickUp token refresh failed: ${message}. User must reconnect.`
    );
  }
}
