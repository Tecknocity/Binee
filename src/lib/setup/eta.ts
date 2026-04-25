// Build-time estimate, computed once at build start.
//
// The honest floor on build time is ClickUp's documented rate limit: 100
// requests per minute per token. Everything else (Haiku latency, parallelism)
// is faster than that. So the ETA is essentially "how many ClickUp calls do
// we have to make, divided by 100, in minutes" with a small overhead pad.
//
// We deliberately produce a static estimate (not a live countdown). Live
// countdowns lie when ClickUp returns a 429 with a 30-second Retry-After,
// or when Anthropic is overloaded. A static "Started at 3:30 PM, estimated
// completion ~5 minutes" sets expectations correctly: it's an estimate,
// the user can leave the page, and we keep working until done.

import type { SetupPlan } from "./types";

// Average ClickUp calls per generated task: createTask + createChecklist +
// 3 createChecklistItems. Pessimistic on purpose so the estimate feels
// realistic rather than optimistic.
const CLICKUP_CALLS_PER_TASK = 5;

// Tasks the enrichment phase generates per list, on average (5-8 from Haiku,
// occasionally fewer when the prompt is sparse).
const AVG_TASKS_PER_LIST = 6;

// Per-doc ClickUp writes (createDocPage + sometimes a verification read).
const CLICKUP_CALLS_PER_DOC = 2;

// Per-list view creation (board + calendar + a couple others depending on tier).
// The planner tells us which views to create; we use 3 as the typical baseline.
const CLICKUP_CALLS_PER_LIST_VIEWS = 3;

// ClickUp's documented rate limit, calls per minute per token.
const CLICKUP_CALLS_PER_MINUTE = 100;

// Padding for retries, network jitter, and the structural creation phase
// that happens before enrichment kicks in.
const OVERHEAD_SECONDS = 30;

export interface EtaInput {
  plan: SetupPlan;
}

export interface EtaResult {
  /** Total seconds we expect the build to take, end to end. */
  totalSeconds: number;
  /** Same value rounded up to whole minutes for UI display. */
  minutes: number;
  /** ISO timestamp of estimated completion if started now. */
  completionAtIso: string;
  /** Breakdown for diagnostics / tooltip. */
  breakdown: {
    structuralCalls: number;
    taskCalls: number;
    docCalls: number;
    viewCalls: number;
    totalCalls: number;
  };
}

export function estimateBuildTime(input: EtaInput): EtaResult {
  const { plan } = input;

  let lists = 0;
  let folders = 0;
  for (const space of plan.spaces) {
    folders += space.folders.length;
    lists += (space.lists?.length ?? 0);
    for (const folder of space.folders) {
      lists += folder.lists.length;
    }
  }

  const docs = plan.recommended_docs?.length ?? 0;
  const tags = plan.recommended_tags?.length ?? 0;
  const goals = plan.recommended_goals?.length ?? 0;
  const spaces = plan.spaces.length;

  // Structural calls: one per space/folder/list/tag/doc-shell/goal.
  const structuralCalls = spaces + folders + lists + tags + docs + goals;

  // Task generation produces roughly AVG_TASKS_PER_LIST tasks per list,
  // each costing CLICKUP_CALLS_PER_TASK writes.
  const taskCalls = lists * AVG_TASKS_PER_LIST * CLICKUP_CALLS_PER_TASK;

  const docCalls = docs * CLICKUP_CALLS_PER_DOC;
  const viewCalls = lists * CLICKUP_CALLS_PER_LIST_VIEWS;

  const totalCalls = structuralCalls + taskCalls + docCalls + viewCalls;

  // Wall-clock time = max(rate-limit floor, fixed overhead).
  // Haiku time is dominated by ClickUp time at any reasonable concurrency.
  const rateLimitedSeconds = (totalCalls / CLICKUP_CALLS_PER_MINUTE) * 60;
  const totalSeconds = Math.ceil(rateLimitedSeconds + OVERHEAD_SECONDS);

  const minutes = Math.max(1, Math.ceil(totalSeconds / 60));
  const completionAtIso = new Date(Date.now() + totalSeconds * 1000).toISOString();

  return {
    totalSeconds,
    minutes,
    completionAtIso,
    breakdown: {
      structuralCalls,
      taskCalls,
      docCalls,
      viewCalls,
      totalCalls,
    },
  };
}

/** Human-friendly minute string for the UI banner. */
export function formatEtaMinutes(minutes: number): string {
  if (minutes <= 1) return "about a minute";
  if (minutes <= 5) return `about ${minutes} minutes`;
  if (minutes <= 15) return `${minutes - 1} to ${minutes + 2} minutes`;
  if (minutes <= 60) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (remMin < 10) return `about ${hours} hour${hours === 1 ? "" : "s"}`;
  return `about ${hours}h ${remMin}m`;
}
