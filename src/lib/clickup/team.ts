// Resolve a Binee workspace UUID to its ClickUp `team_id`.
//
// ClickUp's v3 endpoints (Docs, Pages) take the team id in the URL path
// segment they label `{workspaceId}` - this is NOT Binee's Supabase
// workspace UUID. Mixing the two up has historically caused silent
// failures (404 from v3, then a swallowed v2 fallback that no-ops on
// content), so every v3 caller must pass through this helper.

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function getClickUpTeamId(workspaceId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workspaces")
    .select("clickup_team_id")
    .eq("id", workspaceId)
    .single();

  if (error) {
    throw new Error(
      `Failed to load workspace ${workspaceId}: ${error.message}`,
    );
  }

  if (!data?.clickup_team_id) {
    throw new Error(
      `Workspace ${workspaceId} has no clickup_team_id. Reconnect the ClickUp integration.`,
    );
  }

  return data.clickup_team_id;
}
