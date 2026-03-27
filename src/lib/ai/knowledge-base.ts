import { createClient } from '@supabase/supabase-js';
import type { KBModule, KBQueryResult } from '@/lib/ai/types/knowledge';
import { knowledgeCache } from '@/lib/ai/knowledge-cache';

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Module routing map — maps classifier task types to KB task_types
// ---------------------------------------------------------------------------

const TASK_TYPE_TO_KB_TYPES: Record<string, string[]> = {
  general_chat: [],  // No KB modules for general conversation
  simple_lookup: ['chat', 'general', 'knowledge'],
  complex_query: ['chat', 'general', 'knowledge'],
  action_request: ['action', 'execution'],
  setup_request: ['setup', 'onboarding', 'workspace', 'knowledge'],
  health_check: ['health', 'monitoring', 'audit', 'analysis'],
  dashboard_request: ['dashboard', 'reporting'],
  analysis_audit: ['audit', 'analysis'],
  strategy: ['chat', 'general', 'knowledge'],
  troubleshooting: ['chat', 'general', 'knowledge'],
};

// Task types that should receive full shared knowledge base content
const FULL_KB_TASK_TYPES = new Set(['strategy', 'setup_request']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch modules matching a task type + shared modules.
 * Shared modules are returned as summaries unless the task type warrants full content.
 */
export async function getModulesForTaskType(taskType: string): Promise<KBQueryResult> {
  const kbTypes = TASK_TYPE_TO_KB_TYPES[taskType] ?? ['chat', 'general'];

  // Fetch task-specific modules using array overlap (&&)
  const supabase = getSupabaseAdmin();
  const { data: taskModules, error: taskErr } = await supabase
    .from('ai_knowledge_base')
    .select('*')
    .overlaps('task_types', kbTypes)
    .eq('is_shared', false);

  if (taskErr) {
    console.error('[knowledge-base] Error fetching task modules:', taskErr.message);
  }

  // Fetch shared modules (clickup-knowledge-base-*)
  const { data: sharedModules, error: sharedErr } = await supabase
    .from('ai_knowledge_base')
    .select('*')
    .eq('is_shared', true);

  if (sharedErr) {
    console.error('[knowledge-base] Error fetching shared modules:', sharedErr.message);
  }

  const taskResult = (taskModules ?? []) as KBModule[];
  let sharedResult = (sharedModules ?? []) as KBModule[];

  // For most task types, return shared modules with summary only (save tokens)
  if (!FULL_KB_TASK_TYPES.has(taskType)) {
    sharedResult = sharedResult.map((mod) => ({
      ...mod,
      content: mod.summary ?? mod.content.slice(0, 2000),
    }));
  }

  // Cache individual modules
  for (const mod of [...taskResult, ...sharedResult]) {
    knowledgeCache.set(mod.module_key, mod);
  }

  return { taskModules: taskResult, sharedModules: sharedResult };
}

/**
 * Fetch a single module by its exact key.
 */
export async function getModule(moduleKey: string): Promise<KBModule | null> {
  // Check cache first
  const cached = knowledgeCache.get(moduleKey);
  if (cached) return cached;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ai_knowledge_base')
    .select('*')
    .eq('module_key', moduleKey)
    .single();

  if (error) {
    console.error(`[knowledge-base] Error fetching module "${moduleKey}":`, error.message);
    return null;
  }

  const mod = data as KBModule;
  knowledgeCache.set(moduleKey, mod);
  return mod;
}

/**
 * Fetch all modules whose key starts with a given prefix.
 * Use for split modules like clickup-knowledge-base-1/2/3.
 */
export async function getModulesByPrefix(prefix: string): Promise<KBModule[]> {
  const supabase = getSupabaseAdmin();
  const cacheKey = `prefix:${prefix}`;
  const { data, error } = await supabase
    .from('ai_knowledge_base')
    .select('*')
    .like('module_key', `${prefix}%`)
    .order('module_key', { ascending: true });

  if (error) {
    console.error(`[knowledge-base] Error fetching modules with prefix "${prefix}":`, error.message);
    return [];
  }

  const modules = (data ?? []) as KBModule[];
  for (const mod of modules) {
    knowledgeCache.set(mod.module_key, mod);
  }
  knowledgeCache.setMany(cacheKey, modules);
  return modules;
}

/**
 * Update a module's content. Bumps version and recalculates token estimate.
 */
export async function updateModule(
  moduleKey: string,
  content: string,
): Promise<void> {
  const tokenEstimate = estimateTokens(content);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('ai_knowledge_base')
    .update({
      content,
      token_estimate: tokenEstimate,
      updated_at: new Date().toISOString(),
    })
    .eq('module_key', moduleKey);

  if (error) {
    console.error(`[knowledge-base] Error updating module "${moduleKey}":`, error.message);
    throw new Error(`Failed to update module: ${error.message}`);
  }

  // Bump version via RPC
  const { error: rpcErr } = await supabase.rpc('increment_kb_version', { target_module_key: moduleKey });
  if (rpcErr) {
    console.warn('[knowledge-base] RPC increment_kb_version not available:', rpcErr.message);
  }

  // Invalidate cache
  knowledgeCache.invalidate(moduleKey);
}

/**
 * Generate a summary of the given content.
 * Placeholder: returns truncated content (~500 chars).
 * Future: call Claude Haiku to produce a compressed summary.
 */
export async function generateSummary(content: string): Promise<string> {
  // Placeholder — truncate to ~500 chars at a sentence boundary
  if (content.length <= 500) return content;
  const truncated = content.slice(0, 500);
  const lastPeriod = truncated.lastIndexOf('.');
  return lastPeriod > 300 ? truncated.slice(0, lastPeriod + 1) : truncated + '...';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rough token estimate: ~4 characters per token for English text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build the knowledge base portion of a prompt given a task type.
 * Returns a formatted string ready to inject into the system prompt.
 */
export async function buildKnowledgeContext(taskType: string): Promise<string> {
  const { taskModules, sharedModules } = await getModulesForTaskType(taskType);

  const parts: string[] = [];

  // Shared knowledge base (always included)
  if (sharedModules.length > 0) {
    const sharedContent = sharedModules.map((m) => m.content).join('\n\n');
    parts.push(`## CLICKUP KNOWLEDGE BASE\n${sharedContent}`);
  }

  // Task-specific modules
  for (const mod of taskModules) {
    const header = mod.module_key.replace(/-/g, ' ').toUpperCase();
    parts.push(`## ${header}\n${mod.content}`);
  }

  return parts.join('\n\n---\n\n');
}
