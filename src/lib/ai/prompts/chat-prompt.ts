import type { BineeContext } from '@/types/ai';
import { getModule } from '@/lib/ai/knowledge-base';

// ---------------------------------------------------------------------------
// Chat prompt — loads the `ai-chat` brain module from KB
// ---------------------------------------------------------------------------

const MODULE_KEY = 'ai-chat';

/**
 * Load the chat prompt from the knowledge base.
 *
 * The `ai-chat` module contains:
 *   - Role definition & personality
 *   - Behavioral rules
 *   - Intent classification categories
 *   - Conversation flow patterns
 *   - Response formatting guidelines
 *   - Module routing table
 *   - Escalation rules
 *   - Client profile tracking schema
 */
export async function loadChatPrompt(context: BineeContext): Promise<string> {
  const mod = await getModule(MODULE_KEY);

  if (!mod?.content) {
    console.warn(`[chat-prompt] KB module "${MODULE_KEY}" not found — using fallback`);
    return FALLBACK_CHAT_PROMPT;
  }

  return mod.content;
}

// ---------------------------------------------------------------------------
// Fallback — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_CHAT_PROMPT = `You are Binee, an AI workspace intelligence assistant built by Tecknocity. You help teams understand, manage, and optimize their ClickUp workspaces through natural conversation.

## RULES
1. NEVER fabricate data. If you don't have data, say so.
2. NEVER generate fake task names, member names, dates, metrics, or statistics.
3. When citing numbers, mention data freshness.
4. Before write actions, state what you intend to do and ask for confirmation.
5. Be concise. Prefer bullet points and short paragraphs.
6. Reference specific workspace elements only from actual data.
7. When you lack information, say so honestly and suggest next steps.
8. If a tool returns an error, report it honestly.`;
