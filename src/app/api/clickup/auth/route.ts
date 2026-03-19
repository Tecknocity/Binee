import { NextRequest, NextResponse } from "next/server";
import { generatePKCE, getClickUpAuthUrl } from "@/lib/clickup/oauth";
import { encryptToken } from "@/lib/clickup/encryption";

/**
 * GET /api/clickup/auth?workspace_id=xxx
 *
 * Initiates the ClickUp OAuth 2.1 PKCE flow:
 * 1. Generates a PKCE code_verifier / code_challenge pair
 * 2. Encrypts the code_verifier and stores it in an httpOnly cookie
 * 3. Redirects the user to ClickUp's authorization page
 *
 * The code_verifier is retrieved later by the callback route to complete
 * the token exchange, ensuring the client_secret never leaves the server.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspace_id query parameter is required" },
      { status: 400 }
    );
  }

  // Generate PKCE pair
  const { verifier, challenge } = generatePKCE();

  // Build the ClickUp authorization URL with PKCE code_challenge
  const authUrl = getClickUpAuthUrl(workspaceId, challenge);

  // Store the code_verifier in an encrypted httpOnly cookie so it
  // survives the redirect and can be used server-side in the callback.
  const encryptedVerifier = encryptToken(verifier);

  const response = NextResponse.redirect(authUrl);

  response.cookies.set("clickup_pkce_verifier", encryptedVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/clickup/callback",
    maxAge: 600, // 10 minutes — plenty of time to complete auth
  });

  return response;
}
