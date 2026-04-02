'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const trimmed = content.trim();
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  if (firstSentence.length <= 60) return firstSentence;
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
  if (row.role === 'system') return null;

  const msg: ChatMessage = {
    id: row.id,
    role: row.role as MessageRole,
    content: row.content,
    timestamp: new Date(row.created_at),
    creditsConsumed: row.credits_used > 0 ? row.credits_used : undefined,
  };

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

// Stable module-level Supabase client — singleton, never recreated.
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createBrowserClient();
  return _supabase;
}

// ---------------------------------------------------------------------------
// Hook — React Query is the SINGLE source of truth for messages.
//
// Industry standard pattern:
//   - useQuery fetches messages from DB, caches them, survives navigation
//   - Optimistic updates via queryClient.setQueryData (for sent messages)
//   - Realtime patches the query cache (for incoming messages)
//   - NO local useState for messages — React Query IS the state
// ---------------------------------------------------------------------------

export function useChat(conversationId: string | null) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalCredits = useRef(0);
  const { workspace, user } = useAuth();
  const supabase = getSupabase();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const confirmActionRef = useRef<(actionId: string, confirmed: boolean) => void>(() => {});
  const sendingRef = useRef(false);
  const titleSetRef = useRef(false);

  const workspaceId = workspace?.id ?? null;
  const userId = user?.id ?? null;

  // -------------------------------------------------------------------------
  // React Query: messages are the SINGLE source of truth.
  // No useState for messages — useQuery manages fetch, cache, and display.
  // -------------------------------------------------------------------------

  const isValidConvId = !!conversationId && !conversationId.startsWith('conv-');
  const isReady = isValidConvId && !!workspaceId && !!userId;

  const {
    data: messages = [],
    isLoading: isLoadingHistory,
  } = useQuery({
    queryKey: conversationId ? queryKeys.messages(conversationId) : ['messages', 'none'],
    queryFn: async () => {
      console.log('[binee:chat] useQuery queryFn fired', { conversationId, workspaceId, userId });

      if (sendingRef.current) {
        console.log('[binee:chat] queryFn skip — sending in progress');
        // Return current cache to avoid wiping optimistic messages
        return queryClient.getQueryData<ChatMessage[]>(queryKeys.messages(conversationId!)) ?? [];
      }

      console.log('[binee:chat] queryFn — querying Supabase...');
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('id, role, content, credits_used, metadata, created_at')
        .eq('conversation_id', conversationId!)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: true })
        .limit(200);

      console.log('[binee:chat] queryFn — query done', { error: fetchError?.message, rows: data?.length });

      if (fetchError) {
        console.error('[binee:chat] Failed to load messages:', fetchError.message);
        throw fetchError;
      }

      const mapped = (data ?? [])
        .map((row) => mapDbMessage(row as DbMessageRow))
        .filter((m): m is ChatMessage => m !== null);

      totalCredits.current = mapped.reduce(
        (sum, m) => sum + (m.creditsConsumed ?? 0),
        0,
      );

      if (mapped.length > 0) {
        titleSetRef.current = true;
      }

      return mapped;
    },
    enabled: isReady,
    // Keep messages cached for 30 min after navigating away
    gcTime: 30 * 60 * 1000,
    // Consider fresh for 60s — avoids redundant refetches on rapid navigation
    staleTime: 60 * 1000,
    // Keep previous data while refetching (prevents flash to empty)
    placeholderData: (previousData) => previousData,
  });

  // Reset title guard when conversation changes
  const prevConvIdRef = useRef(conversationId);
  if (prevConvIdRef.current !== conversationId) {
    prevConvIdRef.current = conversationId;
    titleSetRef.current = false;
    totalCredits.current = 0;
  }

  // Log for diagnostics
  console.log('[binee:chat] useChat render', {
    conversationId,
    messagesCount: messages.length,
    isLoadingHistory,
    isReady,
  });

  // -------------------------------------------------------------------------
  // Helper: patch messages in React Query cache (the single source of truth)
  // -------------------------------------------------------------------------

  const patchMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[], convId?: string) => {
      const cacheId = convId || conversationId;
      if (!cacheId) return;
      queryClient.setQueryData<ChatMessage[]>(
        queryKeys.messages(cacheId),
        (prev = []) => updater(prev),
      );
    },
    [conversationId, queryClient],
  );

  // -------------------------------------------------------------------------
  // Realtime subscription — patches React Query cache directly
  // -------------------------------------------------------------------------

  const subscribeToMessages = useCallback((convId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`messages-${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const row = payload.new as DbMessageRow;
          const mapped = mapDbMessage(row);
          if (!mapped) return;

          patchMessages((prev) => {
            if (prev.some((m) =>
              m.id === mapped.id ||
              (m.role === mapped.role && m.content === mapped.content)
            )) return prev;
            return [...prev, mapped];
          }, convId);

          if (mapped.creditsConsumed) {
            totalCredits.current += mapped.creditsConsumed;
          }
        },
      )
      .subscribe();

    channelRef.current = channel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, patchMessages]);

  const subscribeToMessagesRef = useRef(subscribeToMessages);
  subscribeToMessagesRef.current = subscribeToMessages;

  useEffect(() => {
    if (!conversationId || !workspaceId) return;

    console.log('[binee:chat] subscribing to realtime', { conversationId });
    subscribeToMessagesRef.current(conversationId);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [conversationId, workspaceId]);

  // -------------------------------------------------------------------------
  // Send a message via the AI chat API
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (content: string, overrideConversationId?: string) => {
      const effectiveId = overrideConversationId || conversationId;
      if (!effectiveId || !content.trim()) return;

      sendingRef.current = true;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      // Optimistic update: add user message to React Query cache
      patchMessages((prev) => [...prev, userMessage], effectiveId);
      setIsLoading(true);
      setError(null);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65_000);

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

        const actionConfirmation: ActionConfirmationData | undefined =
          data.pending_action
            ? {
                id: data.pending_action.id,
                tool_name: data.pending_action.tool_name,
                trust_tier: data.pending_action.trust_tier,
                description: data.pending_action.description,
                details: data.pending_action.details,
                confirmed: null,
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
        patchMessages((prev) => [...prev, assistantMessage], effectiveId);

        // SAFETY NET: verify assistant message was saved server-side
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
              // Non-critical
            }
          }, 3000);
        }

        // Update conversation title (first message only) and timestamp
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          const updatePayload: Record<string, string> = {
            updated_at: new Date().toISOString(),
          };
          if (!titleSetRef.current) {
            updatePayload.title = generateTitleFromMessage(content);
            titleSetRef.current = true;
          }
          Promise.resolve(
            supabase
              .from('conversations')
              .update(updatePayload)
              .eq('id', effectiveId),
          )
            .then(({ error: updateErr }) => {
              if (updateErr) console.error('[useChat] Failed to update conversation:', updateErr.message);
            })
            .catch((err: unknown) => console.error('[useChat] Conversation update network error:', err));
        }

        // B-045: Auto-approve
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
        patchMessages((prev) => [...prev, fallbackMessage], effectiveId);
        setError(errorDetail);

        // Persist error message to DB
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          try {
            await supabase.from('messages').insert({
              workspace_id: workspaceId,
              conversation_id: effectiveId,
              role: 'assistant',
              content: fallbackContent,
              credits_used: 0,
              metadata: { error: true, error_detail: errorDetail },
            });
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
    [conversationId, workspaceId, userId, patchMessages],
  );

  // -------------------------------------------------------------------------
  // B-045: Confirm or cancel a pending write action
  // -------------------------------------------------------------------------

  const confirmAction = useCallback(
    async (actionId: string, confirmed: boolean) => {
      // Optimistic update in React Query cache
      patchMessages((prev) =>
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
          patchMessages((prev) => [...prev, resultMessage]);
          if (workspaceId && conversationId) {
            Promise.resolve(
              supabase.from('messages').insert({
                workspace_id: workspaceId,
                conversation_id: conversationId,
                role: 'assistant',
                content: resultContent,
                credits_used: 0,
                metadata: { action_result: true, tool_calls: resultMessage.toolCalls },
              }),
            ).then(({ error: insertErr }) => {
              if (insertErr) console.error('[useChat] Failed to persist action result:', insertErr.message);
            }).catch((err: unknown) => console.error('[useChat] Action result persist error:', err));
          }
        } else if (data.status === 'failed') {
          const failContent = `The action failed: ${data.error ?? 'Unknown error'}. Please try again.`;
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: failContent,
            timestamp: new Date(),
          };
          patchMessages((prev) => [...prev, errorMessage]);
          if (workspaceId && conversationId) {
            Promise.resolve(
              supabase.from('messages').insert({
                workspace_id: workspaceId,
                conversation_id: conversationId,
                role: 'assistant',
                content: failContent,
                credits_used: 0,
                metadata: { error: true, action_failed: true },
              }),
            ).then(({ error: insertErr }) => {
              if (insertErr) console.error('[useChat] Failed to persist action error:', insertErr.message);
            }).catch((err: unknown) => console.error('[useChat] Action error persist error:', err));
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
        patchMessages((prev) => [...prev, errorMessage]);
      }
    },
    [conversationId, workspaceId, patchMessages],
  );

  confirmActionRef.current = confirmAction;

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
    totalCreditsConsumed: totalCredits.current,
  };
}
