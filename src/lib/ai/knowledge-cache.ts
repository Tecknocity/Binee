import type { KBModule, CachedModule } from '@/lib/ai/types/knowledge';

// ---------------------------------------------------------------------------
// In-memory TTL cache for knowledge base modules
// ---------------------------------------------------------------------------

const TTL = 5 * 60 * 1000; // 5 minutes

class KnowledgeCache {
  private cache = new Map<string, CachedModule>();

  get(key: string): KBModule | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetched_at > TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.module;
  }

  set(key: string, module: KBModule): void {
    this.cache.set(key, { module, fetched_at: Date.now() });
  }

  setMany(key: string, modules: KBModule[]): void {
    // Store a list under a composite key (e.g. "taskType:chat")
    // Each individual module is also cached by module_key
    for (const mod of modules) {
      this.cache.set(mod.module_key, { module: mod, fetched_at: Date.now() });
    }
    // Store the list reference as a special entry
    this.cache.set(key, {
      module: { id: key, module_key: key, content: '', summary: null, task_types: [], token_estimate: 0, version: 0, is_shared: false, updated_at: '', created_at: '' },
      fetched_at: Date.now(),
    });
  }

  getList(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.fetched_at <= TTL;
  }

  invalidate(moduleKey?: string): void {
    if (moduleKey) {
      this.cache.delete(moduleKey);
      // Also invalidate any list keys that might contain this module
      for (const k of this.cache.keys()) {
        if (k.startsWith('taskType:') || k.startsWith('prefix:') || k === 'shared') {
          this.cache.delete(k);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

// Singleton instance
export const knowledgeCache = new KnowledgeCache();
