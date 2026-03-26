'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
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

export interface DashboardChoiceData {
  id: string;
  type: 'new_dashboard' | 'existing_dashboard';
  label: string;
  dashboardName?: string;
  dashboardId?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  creditsConsumed?: number;
  toolCalls?: ToolCallDisplay[];
  actionConfirmation?: ActionConfirmationData;
  dashboardChoices?: DashboardChoiceData[];
  selectedDashboardChoice?: string | null;
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
  const supabase = createBrowserClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Ref to allow auto-approve to call confirmAction before it's defined in the hook
  const confirmActionRef = useRef<(actionId: string, confirmed: boolean) => void>(() => {});
  // Guard: when sendMessage is in-flight, prevent loadConversation from wiping
  // the optimistic messages (race condition when a new conversation is created)
  const sendingRef = useRef(false);

  // -------------------------------------------------------------------------
  // Load messages from database
  // -------------------------------------------------------------------------

  const loadConversation = useCallback(
    async (id: string | null) => {
      setError(null);

      if (!id || !workspace || !user) {
        setMessages([]);
        totalCredits.current = 0;
        return;
      }

      // If a message is currently being sent (e.g. right after conversation
      // creation), skip reloading to avoid wiping the optimistic user message.
      if (sendingRef.current) return;

      setIsLoadingHistory(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('id, role, content, credits_used, metadata, created_at')
          .eq('conversation_id', id)
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: true })
          .limit(200);

        if (fetchError) {
          console.error('Failed to load messages:', fetchError.message);
          setMessages([]);
          totalCredits.current = 0;
          return;
        }

        const mapped = (data ?? [])
          .map((row) => mapDbMessage(row as DbMessageRow))
          .filter((m): m is ChatMessage => m !== null);

        // Sum up credits from loaded messages
        totalCredits.current = mapped.reduce(
          (sum, m) => sum + (m.creditsConsumed ?? 0),
          0,
        );

        setMessages(mapped);
      } catch {
        setMessages([]);
        totalCredits.current = 0;
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [workspace, user, supabase],
  );

  // Load messages when conversationId changes
  useEffect(() => {
    loadConversation(conversationId);
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

          setMessages((prev) => {
            // Avoid duplicates — optimistic inserts or double deliveries
            if (prev.some((m) => m.id === mapped.id)) return prev;
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
  }, [conversationId, workspace?.id, supabase]);

  // -------------------------------------------------------------------------
  // Send a message via the AI chat API
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (content: string, overrideConversationId?: string) => {
      const effectiveId = overrideConversationId || conversationId;
      if (!effectiveId || !content.trim()) return;

      const workspaceId = workspace?.id ?? '';
      const userId = user?.id ?? '';

      // Prevent loadConversation from wiping our optimistic message
      sendingRef.current = true;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
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
        setMessages((prev) => [...prev, assistantMessage]);

        // Update conversation title (on first message) and summary
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          const isFirstMessage = messages.length === 0;
          const updatePayload: Record<string, string> = {
            summary: content.trim().substring(0, 200),
            updated_at: new Date().toISOString(),
          };
          if (isFirstMessage) {
            updatePayload.title = generateTitleFromMessage(content);
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
        const errorDetail = isTimeout
          ? 'The request timed out. Please try again with a simpler question.'
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred';
        const fallbackContent =
          "I'm sorry, I wasn't able to process your message right now. " +
          'Please try again in a moment. If the issue persists, check that your workspace is properly configured.';
        const fallbackMessage: ChatMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content: fallbackContent,
          timestamp: new Date(),
          creditsConsumed: 0,
        };
        setMessages((prev) => [...prev, fallbackMessage]);
        setError(errorDetail);

        // Persist messages to DB even on error so chat history is saved
        if (workspaceId && effectiveId && !effectiveId.startsWith('conv-')) {
          try {
            // Save user message
            await supabase.from('messages').insert({
              workspace_id: workspaceId,
              conversation_id: effectiveId,
              role: 'user',
              content: content.trim(),
              credits_used: 0,
            });
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
            const isFirstMessage = messages.length === 0;
            const updatePayload: Record<string, string> = {
              summary: content.trim().substring(0, 200),
              updated_at: new Date().toISOString(),
            };
            if (isFirstMessage) {
              updatePayload.title = generateTitleFromMessage(content);
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
    [conversationId, workspace, user],
  );

  // -------------------------------------------------------------------------
  // B-045: Confirm or cancel a pending write action via API
  // -------------------------------------------------------------------------

  const confirmAction = useCallback(
    async (actionId: string, confirmed: boolean) => {
      const workspaceId = workspace?.id ?? '';

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
          const resultMessage: ChatMessage = {
            id: `msg-${Date.now()}-confirm`,
            role: 'assistant',
            content: data.result.message ?? 'Action completed successfully.',
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
        } else if (data.status === 'failed') {
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: `The action failed: ${data.error ?? 'Unknown error'}. Please try again.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
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
    [conversationId, workspace],
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

  const selectDashboardChoice = useCallback((messageId: string, choiceId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          return { ...msg, selectedDashboardChoice: choiceId };
        }
        return msg;
      }),
    );
  }, []);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    confirmAction,
    alwaysAllowAction,
    selectDashboardChoice,
    loadConversation,
    totalCreditsConsumed: totalCredits.current,
  };
}
