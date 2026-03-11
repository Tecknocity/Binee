import { createClient } from "@supabase/supabase-js";
import type { ClickUpOAuthTokens } from "@/types/clickup";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const CLICKUP_CLIENT_ID = process.env.CLICKUP_CLIENT_ID ?? "";
const CLICKUP_CLIENT_SECRET = process.env.CLICKUP_CLIENT_SECRET ?? "";
const CLICKUP_REDIRECT_URI =
  process.env.CLICKUP_REDIRECT_URI ??
  "http://localhost:3000/api/clickup/callback";
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? "";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// OAuth URL generation
// ---------------------------------------------------------------------------

/**
 * Generates a ClickUp OAuth authorization URL.
 * The state parameter encodes the workspace ID so we can associate
 * the callback with the correct workspace.
 */
export function getClickUpAuthUrl(workspaceId: string): string {
  const state = Buffer.from(
    JSON.stringify({ workspaceId, ts: Date.now() })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: CLICKUP_CLIENT_ID,
    redirect_uri: CLICKUP_REDIRECT_URI,
    state,
  });

  return `https://app.clickup.com/api?${params.toString()}`;
}

/**
 * Parses the state parameter from the OAuth callback to extract the workspace ID.
 */
export function parseOAuthState(state: string): { workspaceId: string } {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    );
    if (!decoded.workspaceId) {
      throw new Error("Missing workspaceId in OAuth state");
    }
    return { workspaceId: decoded.workspaceId };
  } catch {
    throw new Error("Invalid OAuth state parameter");
  }
}

// ---------------------------------------------------------------------------
// Token exchange & refresh
// ---------------------------------------------------------------------------

/**
 * Exchanges an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<ClickUpOAuthTokens> {
  const res = await fetch("https://api.clickup.com/api/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLICKUP_CLIENT_ID,
      client_secret: CLICKUP_CLIENT_SECRET,
      code,
    }),
  });

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
// Token encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypts a token using AES-256-GCM.
 * Returns a base64-encoded string containing IV + ciphertext + auth tag.
 */
export function encryptToken(token: string): string {
  const key = deriveKey(TOKEN_ENCRYPTION_KEY);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Concatenate IV + encrypted + tag
  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString("base64");
}

/**
 * Decrypts a token that was encrypted with encryptToken().
 */
export function decryptToken(encrypted: string): string {
  const key = deriveKey(TOKEN_ENCRYPTION_KEY);
  const buffer = Buffer.from(encrypted, "base64");

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Derives a 32-byte key from the encryption key string using SHA-256.
 */
function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Stores encrypted OAuth tokens in the workspace record.
 */
export async function storeTokens(
  workspaceId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const encryptedAccess = encryptToken(accessToken);
  const encryptedRefresh = encryptToken(refreshToken);

  const { error } = await supabase
    .from("workspaces")
    .update({
      clickup_access_token: encryptedAccess,
      clickup_refresh_token: encryptedRefresh,
      clickup_token_expires_at: expiresAt.toISOString(),
      clickup_connected: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  if (error) {
    throw new Error(`Failed to store tokens: ${error.message}`);
  }
}

/**
 * Retrieves a valid access token for the workspace, refreshing if expired.
 * Returns null if no tokens are stored.
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

  const expiresAt = new Date(workspace.clickup_token_expires_at);
  const now = new Date();

  // If the token expires within 5 minutes, refresh it
  const bufferMs = 5 * 60 * 1000;
  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    try {
      const decryptedRefresh = decryptToken(
        workspace.clickup_refresh_token
      );
      const newTokens = await refreshAccessToken(decryptedRefresh);

      const newExpiresAt = new Date(
        Date.now() + (newTokens.expires_in ?? 3600) * 1000
      );

      await storeTokens(
        workspaceId,
        newTokens.access_token,
        newTokens.refresh_token,
        newExpiresAt
      );

      return newTokens.access_token;
    } catch (refreshError) {
      console.error("Failed to refresh ClickUp token:", refreshError);

      // Mark workspace as disconnected
      await supabase
        .from("workspaces")
        .update({
          clickup_connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      return null;
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
