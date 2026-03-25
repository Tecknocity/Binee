// ---------------------------------------------------------------------------
// Knowledge Base types
// ---------------------------------------------------------------------------

export interface KBModule {
  id: string;
  module_key: string;
  content: string;
  summary: string | null;
  task_types: string[];
  token_estimate: number;
  version: number;
  is_shared: boolean;
  updated_at: string;
  created_at: string;
}

export interface CachedModule {
  module: KBModule;
  fetched_at: number;
}

export interface KBQueryResult {
  /** Task-specific modules matching the requested task type */
  taskModules: KBModule[];
  /** Shared modules (knowledge base) — may be summaries or full content */
  sharedModules: KBModule[];
}
