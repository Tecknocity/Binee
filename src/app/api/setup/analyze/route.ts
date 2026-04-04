import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { syncWorkspaceStructure } from '@/lib/clickup/sync';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

import { takeWorkspaceSnapshot } from '@/lib/setup/snapshots';

export const maxDuration = 45;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * POST /api/setup/analyze
 *
 * 1. Syncs fresh workspace structure from ClickUp (spaces, folders, lists)
 * 2. Reads hard counts directly from Supabase cached tables (reliable)
 * 3. Runs workspace_analyst sub-agent (Haiku) for qualitative analysis
 * 4. Returns both structured counts AND AI summary
 *
 * This way, the UI gets accurate numbers from the DB and uses the AI
 * only for insights/findings — not for counting.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup-analyze:${user.id}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const { workspace_id } = await request.json();
    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Step 1: Sync fresh workspace structure from ClickUp
    let structureCounts = { spaces: 0, folders: 0, lists: 0 };
    try {
      structureCounts = await syncWorkspaceStructure(workspace_id);
    } catch (syncErr) {
      console.error('[setup/analyze] Structure sync failed:', syncErr);
    }

    // Step 1b: Take initial snapshot of workspace structure (safety net)
    takeWorkspaceSnapshot(workspace_id, 'initial_connect', user.id).catch((err) => {
      console.error('[setup/analyze] Snapshot failed (non-blocking):', err);
    });

    // Step 2: Read hard counts from cached Supabase tables (source of truth for numbers)
    const [spacesRes, foldersRes, listsRes, tasksRes, membersRes] = await Promise.all([
      adminClient.from('cached_spaces').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_folders').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_lists').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
    ]);

    const counts = {
      spaces: spacesRes.count ?? 0,
      folders: foldersRes.count ?? 0,
      lists: listsRes.count ?? 0,
      tasks: tasksRes.count ?? 0,
      members: membersRes.count ?? 0,
    };

    // Step 3: Run workspace_analyst for qualitative analysis (findings, recommendations)
    const analysisContext = `Analyze this ClickUp workspace as a ClickUp expert and project management consultant.
Use the tools to inspect the workspace structure, tasks, and team.

CRITICAL: Your ENTIRE response must be valid JSON. No text before or after. No markdown. No code fences.
Respond with EXACTLY this JSON structure:

{"findings":[{"type":"good","text":"..."},{"type":"warning","text":"..."}],"recommendations":[{"action":"keep","text":"..."},{"action":"improve","text":"..."}]}

FINDING TYPES:
- "good": Something working well (e.g. "Engineering space has consistent status workflow across all 4 lists")
- "warning": A problem or risk (e.g. "135 of 200 tasks (67.5%) are overdue, indicating a severe deadline management issue")
- "info": Neutral observation about structure quality, naming, or organization (e.g. "All lists use consistent 4-stage status workflows")

IMPORTANT: Do NOT include findings that simply restate counts (e.g. "Workspace has 3 spaces and 8 lists with 200 tasks"). The counts are already displayed separately. Focus on qualitative insights: what's working well, what's broken, what's missing, and patterns you notice.

RECOMMENDATION ACTIONS:
- "keep": What to preserve (e.g. "Keep the Website & Tech space, active with 29 tasks and clear structure")
- "improve": What to fix (e.g. "Review and close or reschedule the 135 overdue tasks before adding new structure")
- "add": What to create (e.g. "Add Board views to pipeline lists for better visual workflow tracking")

Be specific with space/folder/list names and task counts. Write like a senior ClickUp consultant.
Return EXACTLY 5 findings and 3-4 recommendations. Always provide 5 findings — dig deeper into the workspace structure, statuses, task distribution, naming conventions, and team utilization.
If workspace is empty: {"findings":[{"type":"info","text":"Clean slate, perfect opportunity to build an optimized structure from day one"},{"type":"good","text":"No legacy clutter to clean up or migrate"},{"type":"info","text":"No existing workflows to work around, giving full flexibility in design"},{"type":"info","text":"Status workflows can be designed to match your exact process"},{"type":"info","text":"Folder and list hierarchy can be purpose-built for your team size"}],"recommendations":[{"action":"add","text":"Build workspace structure from scratch based on business needs"}]}`;

    const result = await executeSubAgent(
      getClient(),
      'workspace_analyst',
      analysisContext,
      workspace_id,
    );

    // Parse structured findings from AI response
    let findings: Array<{ type: string; text: string }> = [];
    let recommendations: Array<{ action: string; text: string }> = [];

    try {
      const raw = result.summary || '';

      // Strip markdown code fences if present: ```json ... ``` or ```...```
      const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

      // Find the outermost JSON object — use a balanced-brace approach
      const startIdx = stripped.indexOf('{');
      if (startIdx >= 0) {
        let depth = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < stripped.length; i++) {
          if (stripped[i] === '{') depth++;
          if (stripped[i] === '}') depth--;
          if (depth === 0) { endIdx = i; break; }
        }
        const jsonStr = stripped.slice(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.findings)) {
          findings = parsed.findings.filter((f: { type?: string; text?: string }) => f.type && f.text);
        }
        if (Array.isArray(parsed.recommendations)) {
          recommendations = parsed.recommendations.filter((r: { action?: string; text?: string }) => r.action && r.text);
        }
      }
    } catch (parseErr) {
      console.error('[setup/analyze] JSON parse failed:', parseErr);
    }

    // Filter out findings that just restate counts (redundant with stat cards)
    findings = findings.filter((f) => {
      const lower = f.text.toLowerCase();
      // Remove findings that are just "workspace has X spaces, Y folders, Z lists..."
      return !/^workspace has \d+ spaces?[,\s]/.test(lower);
    });

    // If parsing failed completely, generate basic findings from counts
    if (findings.length === 0) {
      if (counts.spaces === 0 && counts.lists === 0) {
        findings = [
          { type: 'info', text: 'Clean slate, perfect opportunity to build an optimized structure from day one' },
          { type: 'good', text: 'No legacy clutter to clean up or migrate' },
          { type: 'info', text: 'No existing workflows to work around, giving full flexibility in design' },
          { type: 'info', text: 'Status workflows can be designed to match your exact process' },
          { type: 'info', text: 'Folder and list hierarchy can be purpose-built for your team size' },
        ];
      } else {
        findings = [];
        if (counts.tasks > 0 && counts.members <= 1) {
          findings.push({ type: 'warning', text: `${counts.tasks} tasks managed by only ${counts.members} team member. Consider inviting your team.` });
        }
        if (counts.lists > 0 && counts.folders === 0) {
          findings.push({ type: 'info', text: 'Lists are not organized into folders — adding folders would improve navigation' });
        }
        if (counts.spaces > 0) {
          findings.push({ type: 'good', text: `Workspace has an existing foundation with ${counts.spaces > 1 ? 'multiple spaces' : 'a space'} to build on` });
        }
        if (counts.tasks === 0) {
          findings.push({ type: 'info', text: 'No tasks created yet — structure exists but is not actively used' });
        }
        if (counts.tasks > 50 && counts.members <= 2) {
          findings.push({ type: 'warning', text: 'High task-to-member ratio may indicate workload imbalance' });
        }
        // Pad to 5 if needed
        const padFindings = [
          { type: 'info', text: 'Status workflows should be reviewed to ensure they match your actual process stages' },
          { type: 'info', text: 'Consider adding descriptions to lists to clarify their purpose for team members' },
          { type: 'info', text: 'Naming conventions across spaces and lists should follow a consistent pattern' },
          { type: 'info', text: 'Board and Calendar views can be added to lists for better visual workflow management' },
          { type: 'info', text: 'Custom fields can be added to track business-specific data like priority, client, or due dates' },
        ];
        while (findings.length < 5 && padFindings.length > 0) {
          findings.push(padFindings.shift()!);
        }
      }
      recommendations = [
        { action: counts.spaces >= 3 ? 'improve' : 'add', text: counts.spaces >= 3
          ? "Let's discuss what's working and what could be restructured for better workflow"
          : "Build a workspace structure tailored to your business needs" },
      ];
    }

    // Ensure we always have exactly 5 findings (pad if AI returned fewer)
    if (findings.length < 5) {
      const extraFindings = [
        { type: 'info', text: 'Status workflows should be reviewed to ensure they match your actual process stages' },
        { type: 'info', text: 'Consider adding descriptions to lists to clarify their purpose for team members' },
        { type: 'info', text: 'Board and Calendar views can improve visual workflow tracking' },
        { type: 'info', text: 'Custom fields can track business-specific data like priority, client, or budget' },
        { type: 'info', text: 'Naming conventions across spaces and lists should follow a consistent pattern' },
      ];
      for (const ef of extraFindings) {
        if (findings.length >= 5) break;
        // Don't duplicate existing findings
        if (!findings.some((f) => f.text === ef.text)) {
          findings.push(ef);
        }
      }
    }

    // Cap at 5 findings
    findings = findings.slice(0, 5);

    // Step 4: Charge credits (simple tier = 0.55)
    const creditsToCharge = 0.55;
    try {
      await adminClient.rpc('deduct_credits', {
        p_workspace_id: workspace_id,
        p_user_id: user.id,
        p_amount: creditsToCharge,
        p_description: 'Setup: workspace analysis',
        p_message_id: null,
        p_metadata: {
          credit_tier: 'simple',
          source: 'setup_analysis',
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          structure_synced: structureCounts,
        },
      });

      await adminClient.from('credit_usage').insert({
        user_id: user.id,
        workspace_id,
        action_type: 'chat',
        session_id: `setup-analysis-${Date.now()}`,
        model_used: 'haiku',
        input_tokens: result.inputTokens ?? 0,
        output_tokens: result.outputTokens ?? 0,
        anthropic_cost_cents: 0,
        credits_deducted: creditsToCharge,
      });
    } catch (creditErr) {
      console.error('[setup/analyze] Credit deduction failed:', creditErr);
    }

    return NextResponse.json({
      summary: result.summary,
      counts,
      findings,
      recommendations,
      error: result.error || null,
      credits_consumed: creditsToCharge,
    });
  } catch (error) {
    console.error('[POST /api/setup/analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}
