import { NextRequest, NextResponse } from "next/server";
import { generatePKCE, getClickUpAuthUrl } from "@/lib/clickup/oauth";
import { encryptToken } from "@/lib/clickup/encryption";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/clickup/auth?workspace_id=xxx
 *
 * Initiates the ClickUp OAuth 2.1 PKCE flow:
 * 1. Verifies the user is an owner or admin of the workspace
 * 2. Generates a PKCE code_verifier / code_challenge pair
 * 3. Encrypts the code_verifier and stores it in an httpOnly cookie
 * 4. Redirects the user to ClickUp's authorization page
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

  // Verify user is authenticated and has owner/admin role
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can connect ClickUp" },
      { status: 403 }
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
