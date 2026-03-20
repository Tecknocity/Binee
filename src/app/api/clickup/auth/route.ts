import { NextRequest, NextResponse } from "next/server";
import { getClickUpAuthUrl } from "@/lib/clickup/oauth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/clickup/auth?workspace_id=xxx
 *
 * Initiates the ClickUp OAuth 2.0 flow:
 * 1. Verifies the user is an owner or admin of the workspace
 * 2. Redirects the user to ClickUp's authorization page
 *
 * ClickUp does NOT support PKCE. Token exchange uses client_id +
 * client_secret server-side in the callback route.
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

  const authUrl = getClickUpAuthUrl(workspaceId);
  return NextResponse.redirect(authUrl);
}
