// Helpers for pulling targeted reference snippets from `ai_knowledge_base` for
// use during enrichment (per-list task generation, per-doc content generation).
//
// Templates are reference inspiration only. The chat-derived purpose, examples,
// and outline are always the source of truth. Reference snippets are kept short
// and topical so they tilt the model toward shape/tone without hijacking the
// user's intent.
//
// All loads are best-effort. Failures return empty content; the generator falls
// back to chat context alone.

import { createClient } from '@supabase/supabase-js';

const MAX_SNIPPET_CHARS = 3500;

interface KbRow {
  module_key: string;
  content: string;
  summary?: string | null;
  task_types?: string[] | null;
}

let _cache: KbRow[] | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60_000;

async function loadAllTemplates(): Promise<KbRow[]> {
  if (_cache && Date.now() - _cacheLoadedAt < CACHE_TTL_MS) return _cache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  try {
    const admin = createClient(url, key);
    const { data, error } = await admin
      .from('ai_knowledge_base')
      .select('module_key, content, summary, task_types')
      .or('module_key.like.clickup-templates-database%,module_key.like.clickup-knowledge-base%');
    if (error || !data) return [];
    _cache = data as KbRow[];
    _cacheLoadedAt = Date.now();
    return _cache;
  } catch {
    return [];
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function scoreRow(row: KbRow, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystack = `${row.module_key} ${row.summary ?? ''} ${(row.task_types ?? []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (haystack.includes(t)) score += 2;
  }
  return score;
}

/**
 * Find a topical reference snippet from the knowledge base that loosely
 * matches the given query (e.g. a list name + space name + purpose). Returns
 * a short excerpt around the best match, or empty string if no useful match.
 *
 * The snippet is meant as inspiration, not authority. Generators are
 * instructed to treat chat-derived context as the source of truth.
 */
export async function findReferenceSnippet(query: string): Promise<string> {
  const rows = await loadAllTemplates();
  if (rows.length === 0) return '';

  const tokens = tokenize(query);
  if (tokens.length === 0) return '';

  let best: { row: KbRow; score: number } | null = null;
  for (const row of rows) {
    const s = scoreRow(row, tokens);
    if (s > 0 && (!best || s > best.score)) best = { row, score: s };
  }
  if (!best || best.score < 2) return '';

  return excerptForQuery(best.row.content, tokens);
}

function excerptForQuery(content: string, tokens: string[]): string {
  if (!content) return '';

  const lower = content.toLowerCase();
  let bestIdx = -1;
  let bestHits = 0;

  // Walk over headings (## or # blocks) and pick the section with the most
  // token hits. Keeps the snippet topical instead of dumping the start.
  const sectionRegex = /^#{1,3}\s.+$/gm;
  const headings: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(content)) !== null) {
    headings.push(match.index);
  }
  if (headings.length === 0) headings.push(0);

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i];
    const end = i + 1 < headings.length ? headings[i + 1] : content.length;
    const slice = lower.slice(start, end);
    let hits = 0;
    for (const t of tokens) {
      if (slice.includes(t)) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestIdx = start;
    }
  }

  if (bestIdx < 0) bestIdx = 0;
  const snippet = content.slice(bestIdx, bestIdx + MAX_SNIPPET_CHARS).trim();
  return snippet.length < 200 ? '' : snippet;
}
