'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { queryKeys } from '@/lib/query/keys';
import type { ToolCallResult } from '@/types/ai';
import {
  shouldAutoApprove,
  setActionPreference,
} from '@/lib/ai/action-preferences';

// ---------------------------------------------------------------------------
// Helper: generate a short title from the first user message
// ---------------------------------------------------------------------------

function generateTitleFromMessage(content: string): string {
  // Strip leading/trailing whitespace
  const trimmed = content.trim();
  // Take first sentence or first 60 chars, whichever is shorter
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  if (firstSentence.length <= 60) return firstSentence;
  // Truncate at last word boundary before 60 chars
  const truncated = firstSentence.substring(0, 60);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant';

export type ToolCallStatus = 'pending' | 'success' | 'error';

export interface ToolCallDisplay {
  id: string;
  tool_name: string;
  description: string;
  status: ToolCallStatus;
  result?: string;
  resultSummary?: string;
  error?: string;
  tool_input?: Record<string, unknown>;
  durationMs?: number;
}

export interface ActionConfirmationData {
  id: string;
  tool_name: string;
  trust_tier: 'low' | 'medium' | 'high';
  description: string;
  details: string;
  confirmed: boolean | null; // null = pending
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  creditsConsumed?: number;
  toolCalls?: ToolCallDisplay[];
  actionConfirmation?: ActionConfirmationData;
}

// ---------------------------------------------------------------------------
// B-054: Human-friendly tool call descriptions & result summaries
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, { pending: string; success: string; icon: string }> = {
  clickup_get_tasks: { pending: 'Looking up tasks', success: 'Found tasks', icon: 'search' },
  clickup_get_spaces: { pending: 'Loading workspace structure', success: 'Loaded workspace', icon: 'folder' },
  clickup_get_task: { pending: 'Fetching task details', success: 'Retrieved task', icon: 'file' },
  clickup_get_members: { pending: 'Loading team members', success: 'Loaded members', icon: 'users' },
  clickup_get_lists: { pending: 'Fetching lists', success: 'Retrieved lists', icon: 'list' },
  clickup_get_folders: { pending: 'Loading folders', success: 'Loaded folders', icon: 'folder' },
  clickup_update_task: { pending: 'Updating task', success: 'Task updated', icon: 'edit' },
  clickup_create_task: { pending: 'Creating task', success: 'Task created', icon: 'plus' },
  create_task: { pending: 'Creating task', success: 'Task created', icon: 'plus' },
  update_task: { pending: 'Updating task', success: 'Task updated', icon: 'edit' },
  assign_task: { pending: 'Assigning task', success: 'Task assigned', icon: 'user' },
  move_task: { pending: 'Moving task', success: 'Task moved', icon: 'move' },
  list_dashboards: { pending: 'Checking dashboards', success: 'Found dashboards', icon: 'layout' },
  create_dashboard_widget: { pending: 'Creating widget', success: 'Widget created', icon: 'plus' },
  update_dashboard_widget: { pending: 'Updating widget', success: 'Widget updated', icon: 'edit' },
  write_operation: { pending: 'Executing action', success: 'Action completed', icon: 'check' },
};

function formatToolCallDescription(
  toolName: string,
  toolInput: Record<string, unknown>,
  status: 'pending' | 'success' | 'error',
): string {
  const label = TOOL_LABELS[toolName];
  const base = label
    ? status === 'pending' ? label.pending : label.success
    : status === 'pending' ? `Running ${toolName.replace(/_/g, ' ')}` : `Completed ${toolName.replace(/_/g, ' ')}`;

  // Add context from tool_input
  const context = toolInput.name ?? toolInput.list_name ?? toolInput.title ?? toolInput.assignee_name;
  if (context && typeof context === 'string') {
    return `${base}: "${context}"`;
  }
  return base;
}

function formatResultSummary(toolName: string, result: Record<string, unknown>): string {
  if (result.tasks && Array.isArray(result.tasks)) {
    return `Found ${result.tasks.length} task${result.tasks.length !== 1 ? 's' : ''}`;
  }
  if (result.count !== undefined) {
    return `Found ${result.count} result${result.count !== 1 ? 's' : ''}`;
  }
  if (result.task && typeof result.task === 'object') {
    const task = result.task as Record<string, unknown>;
    return task.name ? `Task: "${task.name}"` : 'Task retrieved';
  }
  if (result.message && typeof result.message === 'string') {
    return result.message;
  }
  if (result.success === true) {
    return TOOL_LABELS[toolName]?.success ?? 'Completed successfully';
  }
  if (typeof result === 'string') return result;
  return TOOL_LABELS[toolName]?.success ?? 'Completed';
}

function formatErrorMessage(error: string): string {
  if (error.toLowerCase().includes('rate limit')) return 'Rate limit reached — try again shortly';
  if (error.toLowerCase().includes('not found')) return 'Resource not found';
  if (error.toLowerCase().includes('permission')) return 'Permission denied';
  if (error.toLowerCase().includes('timeout')) return 'Request timed out';
  return error;
}

// ---------------------------------------------------------------------------
// Map a database message row to ChatMessage
// ---------------------------------------------------------------------------

interface DbMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  credits_used: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function mapDbMessage(row: DbMessageRow): ChatMessage | null {
  // Skip system messages — they're internal context, not displayed
  if (row.role === 'system') return null;

  const msg: ChatMessage = {
    id: row.id,
    role: row.role as MessageRole,
    content: row.content,
    timestamp: new Date(row.created_at),
    creditsConsumed: row.credits_used > 0 ? row.credits_used : undefined,
  };

  // Hydrate tool calls from metadata if present
  if (row.metadata?.tool_calls && Array.isArray(row.metadata.tool_calls)) {
    msg.toolCalls = (row.metadata.tool_calls as ToolCallResult[]).map(
      (tc, i) => ({
        id: `${row.id}-tc-${i}`,
        tool_name: tc.tool_name,
        description: tc.success
          ? formatToolCallDescription(tc.tool_name, tc.tool_input, 'success')
          : formatToolCallDescription(tc.tool_name, tc.tool_input, 'error'),
        status: tc.success ? ('success' as const) : ('error' as const),
        result: tc.success ? JSON.stringify(tc.result) : undefined,
        resultSummary: tc.success ? formatResultSummary(tc.tool_name, tc.result) : undefined,
        error: tc.error ? formatErrorMessage(tc.error) : undefined,
        tool_input: tc.tool_input,
      }),
    );
  }

  // Hydrate pending action from metadata if present
  if (row.metadata?.pending_action && typeof row.metadata.pending_action === 'object') {
    const pa = row.metadata.pending_action as Record<string, unknown>;
    msg.actionConfirmation = {
      id: pa.id as string,
      tool_name: pa.tool_name as string,
      trust_tier: pa.trust_tier as 'low' | 'medium' | 'high',
      description: pa.description as string,
      details: pa.details as string,
      confirmed: (pa.confirmed as boolean | null) ?? null,
    };
  }

  return msg;
}

// Stable module-level Supabase client — prevents dependency-array churn
// that causes message reloads and realtime channel re-subscriptions.
// Lazy-initialized to avoid SSR/prerender crashes (env vars missing).
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createBrowserClient();
  return _supabase;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalCredits = useRef(0);
  const { workspace, user } = useAuth();
  const supabase = getSupabase();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Ref to allow auto-approve to call confirmAction before it's defined in the hook
  const confirmActionRef = useRef<(actionId: string, confirmed: boolean) => void>(() => {});
  // Guard: when sendMessage is in-flight, prevent loadConversation from wiping
  // the optimistic messages (race condition when a new conversation is created)
  const sendingRef = useRef(false);
  // Track whether the auto-generated title has already been set for this conversation.
  // Prevents stale-closure bugs from overwriting the title on every message.
  const titleSetRef = useRef(false);

  // Use React Query's queryClient as a persistent cache for messages.
  // Messages survive navigation: on unmount they stay in the query cache,
  // on remount we read them back instantly (no spinner).
  const queryClient = useQueryClient();

  // Stable IDs for dependency arrays — avoids re-running effects when the
  // workspace/user *object* reference changes but the ID hasn't.
  const workspaceId = workspace?.id ?? null;
  const userId = user?.id ?? null;

  // -------------------------------------------------------------------------
  // Load messages from database
  // -------------------------------------------------------------------------

  const loadConversation = useCallback(
    async (id: string | null) => {
      setError(null);

      if (!id || !workspaceId || !userId) {
        if (!id) {
          setMessages([]);
          totalCredits.current = 0;
        }
        setIsLoadingHistory(false);
        return;
      }

      // If a message is currently being sent (e.g. right after conversation
      // creation), skip reloading to avoid wiping the optimistic user message.
      if (sendingRef.current) {
        setIsLoadingHistory(false);
        return;
      }

      // Check React Query cache first — show cached messages instantly (no spinner).
      // Then refresh from DB in the background.
      const cached = queryClient.getQueryData<ChatMessage[]>(queryKeys.messages(id)) ?? [];
      if (cached.length > 0) {
        setMessages(cached);
        totalCredits.current = cached.reduce(
          (sum, m) => sum + (m.creditsConsumed ?? 0),
          0,
        );
        titleSetRef.current = true;
        // Don't show loading spinner — we already have data to display
      } else {
        setIsLoadingHistory(true);
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('id, role, content, credits_used, metadata, created_at')
          .eq('conversation_id', id)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true })
          .limit(200);

        if (fetchError) {
          console.error('Failed to load messages:', fetchError.message);
          // Keep cached messages if DB fetch fails — don't wipe the screen
          if (cached.length === 0) {
            setMessages([]);
            totalCredits.current = 0;
          }
          return;
        }

        const mapped = (data ?? [])
          .map((row) => mapDbMessage(row as DbMessageRow))
          .filter((m): m is ChatMessage => m !== null);

        // STALE-WHILE-REVALIDATE GUARD: If we already had messages (from cache
        // or previous load) but the DB returned empty, keep the existing data.
        // This happens when Supabase's auth token is briefly stale during a tab
        // switch — RLS silently returns zero rows instead of an error. Without
        // this guard, setMessages([]) would wipe the screen.
        if (mapped.length === 0 && cached.length > 0) {
          console.warn('[useChat] DB returned empty but cache has messages — keeping cached data (likely transient auth gap)');
          return;
        }

        // Sum up credits from loaded messages
        totalCredits.current = mapped.reduce(
          (sum, m) => sum + (m.creditsConsumed ?? 0),
          0,
        );

        // If the conversation already has messages, the title was already set
        if (mapped.length > 0) {
          titleSetRef.current = true;
        }

        setMessages(mapped);
        // Write through to React Query cache (survives navigation)
        if (id) queryClient.setQueryData(queryKeys.messages(id), mapped);
      } catch {
        if (cached.length === 0) {
          setMessages([]);
          totalCredits.current = 0;
        }
      } finally {
        setIsLoadingHistory(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
    [workspaceId, userId],
  );

  // Load messages when conversationId changes
  useEffect(() => {
    // Reset the title-set guard when switching conversations
    titleSetRef.current = false;
    loadConversation(conversationId);
  }, [conversationId, loadConversation]);

  // Re-load messages when tab becomes visible (catches missed realtime events
  // during backgrounding). Uses the standard visibilitychange API with a 10s
  // threshold to avoid refetching on quick alt-tabs.
  const lastHiddenRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const awayMs = Date.now() - lastHiddenRef.current;
        if (awayMs > 10_000 && conversationId) {
          loadConversation(conversationId);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [conversationId, loadConversation]);

  // -------------------------------------------------------------------------
  // Realtime subscription for new messages
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !workspace?.id) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as DbMessageRow;
          const mapped = mapDbMessage(row);
          if (!mapped) return;

          updateMessages((prev) => {
            // Avoid duplicates — check DB ID, but also match optimistic
            // messages (which use msg-* IDs) by content + role to prevent
            // showing the same message twice.
            if (prev.some((m) =>
              m.id === mapped.id ||
              (m.role === mapped.role && m.content === mapped.content)
            )) return prev;
            return [...prev, mapped];
          });

          if (mapped.creditsConsumed) {
            totalCredits.current += mapped.creditsConsumed;
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [conversationId, workspaceId]);

  // Helper: update messages state AND write through to React Query cache
  const updateMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[], convId?: string) => {
      setMessages((prev) => {
        const next = updater(prev);
        const cacheId = convId || conversationId;
        if (cacheId) queryClient.setQueryData(queryKeys.messages(cacheId), next);
        return next;
      });
    },
    [conversationId, queryClient],
  );

  // -------------------------------------------------------------------------
  // Send a message via the AI chat API
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (content: string, overrideConversationId?: string) => {
      const effectiveId = overrideConversationId || conversationId;
      if (!effectiveId || !content.trim()) return;

      // workspaceId and userId are stable (from outer scope, derived from IDs only)

      // Prevent loadConversation from wiping our optimistic message
      sendingRef.current = true;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      updateMessages((prev) => [...prev, userMessage], effectiveId);
      setIsLoading(true);
      setError(null);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65_000); // 65s — slightly above Vercel's 60s max

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId,
            user_id: userId,
            conversation_id: effectiveId,
            message: content.trim(),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          const errorMsg =
            errorBody?.error || `Chat request failed (${res.status})`;
          throw new Error(errorMsg);
        }

        const data = await res.json();

        const toolCallDisplays: ToolCallDisplay[] | undefined =
          data.tool_calls?.map((tc: ToolCallResult, i: number) => ({
            id: `tc-${Date.now()}-${i}`,
            tool_name: tc.tool_name,
            description: tc.success
              ? formatToolCallDescription(tc.tool_name, tc.tool_input, 'success')
              : formatToolCallDescription(tc.tool_name, tc.tool_input, 'error'),
            status: tc.success ? ('success' as const) : ('error' as const),
            result: tc.success ? JSON.stringify(tc.result) : undefined,
            resultSummary: tc.success ? formatResultSummary(tc.tool_name, tc.result) : undefined,
            error: tc.error ? formatErrorMessage(tc.error) : undefined,
            tool_input: tc.tool_input,
          }));

        // B-045: If the response includes a pending action, attach it as actionConfirmation
        const actionConfirmation: ActionConfirmationData | undefined =
          data.pending_action
            ? {
                id: data.pending_action.id,
                tool_name: data.pending_action.tool_name,
                trust_tier: data.pending_action.trust_tier,
                description: data.pending_action.description,
                details: data.pending_action.details,
                confirmed: null, // pending user decision
              }
            : undefined;

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content: data.content,
          timestamp: new Date(),
          creditsConsumed: data.credits_consumed,
          toolCalls: toolCallDisplays,
          actionConfirmation,
        };

        totalCredits.current += data.credits_consumed ?? 0;
        updateMessages((prev) => [...prev, assistantMessage], effectiveId);

        // SAFETY NET: verify the assistant message was saved server-side.
        // The server saves it in handleChat step 10, but if it failed silently
        // (e.g. credits_used type mismatch, timeout), the message only exists
        // in React state and will be lost on page refresh. Check after a short
        // delay and save client-side if missing.
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          setTimeout(async () => {
            try {
              const { data: existing } = await supabase
                .from('messages')
                .select('id')
                .eq('conversation_id', effectiveId)
                .eq('workspace_id', workspaceId)
                .eq('role', 'assistant')
                .order('created_at', { ascending: false })
                .limit(1);
              // If no assistant message found for this conversation's latest,
              // save it client-side as a fallback
              if (!existing || existing.length === 0) {
                console.warn('[useChat] Assistant message not found in DB — saving client-side fallback');
                await supabase.from('messages').insert({
                  workspace_id: workspaceId,
                  conversation_id: effectiveId,
                  role: 'assistant',
                  content: data.content,
                  credits_used: Math.round(data.credits_consumed ?? 0),
                  metadata: {
                    tool_calls: data.tool_calls ?? null,
                    client_fallback: true,
                  },
                });
              }
            } catch {
              // Non-critical — best effort
            }
          }, 3000); // 3s delay to give server time to complete
        }

        // Update conversation title (only on the very first message) and timestamp
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          const updatePayload: Record<string, string> = {
            updated_at: new Date().toISOString(),
          };
          if (!titleSetRef.current) {
            updatePayload.title = generateTitleFromMessage(content);
            titleSetRef.current = true;
          }
          supabase
            .from('conversations')
            .update(updatePayload)
            .eq('id', effectiveId)
            .then(({ error: updateErr }) => {
              if (updateErr) console.error('[useChat] Failed to update conversation:', updateErr.message);
            });
        }

        // B-045: Auto-approve if user has "Always Allow" for this operation type
        if (
          actionConfirmation &&
          shouldAutoApprove(actionConfirmation.tool_name, actionConfirmation.trust_tier)
        ) {
          confirmActionRef.current(actionConfirmation.id, true);
        }
      } catch (err) {
        console.error('[useChat] Chat API error:', err);

        const isTimeout =
          err instanceof DOMException && err.name === 'AbortError';
        const rawDetail = isTimeout
          ? 'The request timed out. Please try again with a simpler question.'
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred';
        // Apply the same user-friendly formatting used for tool call errors
        const errorDetail = formatErrorMessage(rawDetail);
        const fallbackContent =
          `Something went wrong: ${errorDetail}`;
        const fallbackMessage: ChatMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content: fallbackContent,
          timestamp: new Date(),
          creditsConsumed: 0,
        };
        updateMessages((prev) => [...prev, fallbackMessage], effectiveId);
        setError(errorDetail);

        // Persist error message to DB so chat history shows what went wrong.
        // Note: the user message is already saved server-side in handleChat step 3c
        // (before the AI call), so we only save the error response here.
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          try {
            // Save assistant error message
            await supabase.from('messages').insert({
              workspace_id: workspaceId,
              conversation_id: effectiveId,
              role: 'assistant',
              content: fallbackContent,
              credits_used: 0,
              metadata: { error: true, error_detail: errorDetail },
            });
            // Auto-generate title from first message if this is a new conversation
            const updatePayload: Record<string, string> = {
              updated_at: new Date().toISOString(),
            };
            if (!titleSetRef.current) {
              updatePayload.title = generateTitleFromMessage(content);
              titleSetRef.current = true;
            }
            await supabase
              .from('conversations')
              .update(updatePayload)
              .eq('id', effectiveId);
          } catch (saveErr) {
            console.error('[useChat] Failed to persist error messages:', saveErr);
          }
        }
      } finally {
        sendingRef.current = false;
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
    [conversationId, workspaceId, userId],
  );

  // -------------------------------------------------------------------------
  // B-045: Confirm or cancel a pending write action via API
  // -------------------------------------------------------------------------

  const confirmAction = useCallback(
    async (actionId: string, confirmed: boolean) => {
      // workspaceId is used directly from outer scope

      // Optimistically update the UI
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.actionConfirmation?.id === actionId) {
            return {
              ...msg,
              actionConfirmation: {
                ...msg.actionConfirmation,
                confirmed,
              },
            };
          }
          return msg;
        }),
      );

      try {
        const res = await fetch('/api/chat/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId,
            conversation_id: conversationId,
            action_id: actionId,
            confirmed,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to process confirmation');
        }

        const data = await res.json();

        // If confirmed and executed, add a follow-up message with the result
        if (confirmed && data.status === 'executed' && data.result) {
          const resultContent = data.result.message ?? 'Action completed successfully.';
          const resultMessage: ChatMessage = {
            id: `msg-${Date.now()}-confirm`,
            role: 'assistant',
            content: resultContent,
            timestamp: new Date(),
            toolCalls: [
              {
                id: `tc-${Date.now()}`,
                tool_name: data.result.task ? 'write_operation' : 'action',
                description: 'Executed confirmed action',
                status: 'success',
                result: JSON.stringify(data.result),
              },
            ],
          };
          setMessages((prev) => [...prev, resultMessage]);
          // Persist to DB so result survives page reload
          if (workspaceId && conversationId) {
            supabase.from('messages').insert({
              workspace_id: workspaceId,
              conversation_id: conversationId,
              role: 'assistant',
              content: resultContent,
              credits_used: 0,
              metadata: { action_result: true, tool_calls: resultMessage.toolCalls },
            }).then(({ error: insertErr }) => {
              if (insertErr) console.error('[useChat] Failed to persist action result:', insertErr.message);
            });
          }
        } else if (data.status === 'failed') {
          const failContent = `The action failed: ${data.error ?? 'Unknown error'}. Please try again.`;
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: failContent,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          if (workspaceId && conversationId) {
            supabase.from('messages').insert({
              workspace_id: workspaceId,
              conversation_id: conversationId,
              role: 'assistant',
              content: failContent,
              credits_used: 0,
              metadata: { error: true, action_failed: true },
            }).then(({ error: insertErr }) => {
              if (insertErr) console.error('[useChat] Failed to persist action error:', insertErr.message);
            });
          }
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content:
            'Sorry, there was an error processing the confirmation. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [conversationId, workspaceId],
  );

  // Keep ref in sync so auto-approve can call confirmAction
  confirmActionRef.current = confirmAction;

  // B-045: "Always Allow" — stores preference and confirms the action
  const alwaysAllowAction = useCallback(
    (actionId: string, toolName: string) => {
      setActionPreference(toolName, 'always_allow');
      confirmAction(actionId, true);
    },
    [confirmAction],
  );

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    confirmAction,
    alwaysAllowAction,
    loadConversation,
    totalCreditsConsumed: totalCredits.current,
  };
}
