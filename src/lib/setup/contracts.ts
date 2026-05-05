/**
 * Typed contracts for the multi-agent setup flow.
 *
 * Three roles share the same setup_drafts row in Postgres:
 *   - Clarifier (Haiku): every chat turn until coverage is complete
 *   - Generator (Sonnet): one-shot full plan when the user hits Generate Structure
 *   - Reviser  (Sonnet): plan deltas after the user gives feedback in Review
 *
 * The contracts below are the integration glue. Each role reads/writes JSON
 * that conforms to these shapes; the TS compiler enforces the schema so
 * context never silently drops between roles.
 */

// ---------------------------------------------------------------------------
// Coverage state - the deterministic gate that decides when discovery is done.
// ---------------------------------------------------------------------------

export type SlotState = 'unfilled' | 'filled' | 'user_skipped';

/** Five discovery topics, each mapped 1:1 to a ClickUp output. */
export interface Coverage {
  /** T1 - Main work areas. Drives Lists and the shared-vs-per-entity decision. */
  primary_entities: SlotState;
  /** T2 - How work is organized inside the main area. Drives folder boundaries. */
  organization: SlotState;
  /** T3 - Lifecycle stages of one work unit. Drives Statuses. */
  lifecycle: SlotState;
  /** T4 - Handoffs / who else touches the work. Drives assignees, review stages. */
  collaboration: SlotState;
  /** T5 - Per-item info the user tracks. Drives Custom fields, Tags, Docs. */
  tracking_data: SlotState;
}

export const COVERAGE_TOPICS = [
  'primary_entities',
  'organization',
  'lifecycle',
  'collaboration',
  'tracking_data',
] as const satisfies ReadonlyArray<keyof Coverage>;

export function emptyCoverage(): Coverage {
  return {
    primary_entities: 'unfilled',
    organization: 'unfilled',
    lifecycle: 'unfilled',
    collaboration: 'unfilled',
    tracking_data: 'unfilled',
  };
}

export function isCoverageReady(c: Coverage): boolean {
  return COVERAGE_TOPICS.every((t) => c[t] !== 'unfilled');
}

// ---------------------------------------------------------------------------
// WorkspaceBrief - the Clarifier's output that the Generator consumes.
// ---------------------------------------------------------------------------

/**
 * Plain-language summary of everything the Clarifier learned. Generator
 * consumes this in addition to the conversation history; persisted on the
 * setup_drafts row so a Generator call days later still has the brief.
 *
 * The `summary` field is also shown to the user as the "Here's what I've
 * gathered" checkpoint above the input when ready=true.
 */
export interface WorkspaceBrief {
  /** One-paragraph plain-language recap shown to the user. */
  summary: string;
  /** T1 narrative, e.g. "AI implementation projects, 3-5 active retainer clients" */
  primary_entities: string;
  /** T2 narrative, e.g. "List per client (long-term retainers)" */
  organization: string;
  /** T3 stages in order, e.g. ["Discovery","Strategy","Build","Deploy"] */
  lifecycle: string[];
  /** T4 narrative, e.g. "Solo, no handoffs" */
  collaboration: string;
  /** T5 list of per-item attributes, e.g. ["Budget","Deadline","Source"] */
  tracking_data: string[];
  /** Topics that fell back to industry defaults rather than user-stated answers. */
  industry_defaults_used: Array<keyof Coverage>;
}

// ---------------------------------------------------------------------------
// ClarifierOutput - what every Clarifier turn returns.
// ---------------------------------------------------------------------------

/**
 * One Clarifier turn. The model returns either an `ask` (more discovery
 * needed) or a `brief` (ready to generate), never both. The `message` field
 * is always shown to the user.
 */
export interface ClarifierOutput {
  /** What Binee says this turn. Always shown to the user. */
  message: string;
  /** Present iff ready=false. The next question to ask. */
  ask?: ClarifierAsk;
  /** Required. Updated coverage state for the deterministic gate. */
  coverage: Coverage;
  /** Required. True iff coverage is complete or hard cap reached. */
  ready: boolean;
  /** Present iff ready=true. The brief that the Generator consumes. */
  brief?: WorkspaceBrief;
}

export interface ClarifierAsk {
  /** Which topic this question targets. */
  topic: keyof Coverage;
  /** The question text shown to the user. Open-ended, in plain language. */
  question: string;
  /**
   * 0-5 short suggestion chips. Optional but typical. Empty array means the
   * UI should render the question without chips.
   */
  suggested_options: string[];
}

// ---------------------------------------------------------------------------
// PlanDelta - the Reviser's output. Emit changes, not the whole plan.
// ---------------------------------------------------------------------------

/**
 * Changes to apply to an existing plan. The Reviser produces these instead
 * of regenerating the full plan, so user-named items are never accidentally
 * dropped. mergeSnapshotWithDiagnostics applies the deltas additively.
 */
export interface PlanDelta {
  /** What changed and why, shown to the user above the updated plan. */
  notes: string;
  /** Renames using slash-paths, e.g. { from:"Sales/Leads", to:"Sales/Pipeline" } */
  rename: Array<{ from: string; to: string }>;
  /** Adds: spaces / lists / tags / docs. Each becomes a top-level field. */
  add: PlanDeltaAdds;
  /** Removes by slash-path. Always wins over additive merges. */
  remove: Array<{ path: string }>;
  /** Status changes per list path. Replaces the list's statuses array. */
  status_changes?: Array<{
    list_path: string;
    statuses: Array<{ name: string; type: 'open' | 'active' | 'done' | 'closed' }>;
  }>;
}

export interface PlanDeltaAdds {
  /** New spaces to add. Each can include lists/folders. */
  spaces?: Array<Record<string, unknown>>;
  /** New tags to add to recommended_tags. */
  tags?: Array<{ name: string; tag_bg?: string; tag_fg?: string }>;
  /** New docs to add to recommended_docs. */
  docs?: Array<{ name: string; description?: string; outline?: string[] }>;
}

// ---------------------------------------------------------------------------
// Intent classification - Phase 0 of the adaptive routing rollout.
//
// A small Haiku classifier reads the user's latest message and returns one
// of three intents. The Setupper orchestrator uses this to decide which
// downstream agent should handle the turn:
//   - discovery -> Clarifier (existing, Haiku)
//   - refine    -> Reviser (existing, Sonnet)
//   - info      -> Info Handler (new, Sonnet, read-only on the draft)
//
// The classifier is gated by SETUP_INTENT_CLASSIFIER. When that env var is
// 'disabled' (the default) the classifier is never called and routing falls
// through to the legacy isReadyDraft-based logic. See setupper-brain.ts.
// ---------------------------------------------------------------------------

export type SetupIntent = 'discovery' | 'refine' | 'info';

/**
 * Strict JSON shape the Haiku classifier emits. Anything outside this shape
 * is rejected by the parser and the orchestrator falls back to legacy routing.
 */
export interface IntentClassificationOutput {
  intent: SetupIntent;
  confidence: number;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Snapshot extension - additive fields the Clarifier adds to setup_drafts.
// ---------------------------------------------------------------------------

/**
 * The clarifier writes these alongside the existing plan structure. All
 * fields are optional in the schema so legacy snapshots (no coverage state)
 * are still valid; absence means "no slots filled yet".
 */
export interface DraftClarifierFields {
  coverage?: Coverage;
  ready?: boolean;
  brief?: WorkspaceBrief;
  /** How many questions the Clarifier has asked. Hard cap is 5. */
  questions_asked?: number;
}
