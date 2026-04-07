import { createClient } from '@supabase/supabase-js';

const MAX_MEMORIES = 50; // Cap to keep token usage bounded (~500-750 tokens)

interface UserMemory {
  content: string;
  category: string;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Load active user memories for prompt injection.
 * Returns a formatted string block ready to embed in a system prompt.
 * Returns empty string if no memories exist.
 */
export async function loadUserMemories(
  userId: string,
  workspaceId: string,
): Promise<string> {
  try {
    const supabase = getAdminClient();
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('content, category')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(MAX_MEMORIES);

    if (error || !memories || memories.length === 0) return '';

    // Deduplicate by content similarity (exact match for now)
    const seen = new Set<string>();
    const unique: UserMemory[] = [];
    for (const m of memories) {
      const normalized = m.content.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(m);
      }
    }

    if (unique.length === 0) return '';

    const lines = unique.map(m => `- ${m.content}`).join('\n');
    return `USER MEMORY (facts learned from previous conversations):\n${lines}`;
  } catch (error) {
    console.error('[user-memory] Failed to load memories:', error);
    return '';
  }
}
