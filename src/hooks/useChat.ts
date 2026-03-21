'use client';

import { useState, useCallback, useRef } from 'react';
import type { ToolCallResult } from '@/types/ai';

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
  error?: string;
}

export interface ActionConfirmationData {
  id: string;
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
// Mock messages per conversation
// ---------------------------------------------------------------------------

function getMockMessages(conversationId: string): ChatMessage[] {
  const mocks: Record<string, ChatMessage[]> = {
    'conv-1': [
      {
        id: 'msg-1-1',
        role: 'user',
        content: 'Show me all overdue tasks in the Engineering team.',
        timestamp: new Date('2026-03-11T09:00:00'),
      },
      {
        id: 'msg-1-2',
        role: 'assistant',
        content:
          'Let me look up the overdue tasks in your Engineering team workspace.',
        timestamp: new Date('2026-03-11T09:00:02'),
        creditsConsumed: 1,
        toolCalls: [
          {
            id: 'tc-1',
            tool_name: 'clickup_get_tasks',
            description: 'Looking up overdue tasks in Engineering...',
            status: 'success',
            result: 'Found 12 overdue tasks across 3 lists',
          },
        ],
      },
      {
        id: 'msg-1-3',
        role: 'assistant',
        content:
          "Here's a summary of **12 overdue tasks** in the Engineering team:\n\n### Critical (3)\n- **Fix payment processing bug** -due Mar 5, assigned to Sarah\n- **Database migration v2.4** -due Mar 7, assigned to Mike\n- **API rate limiter update** -due Mar 8, unassigned\n\n### High Priority (5)\n- Refactor auth middleware -due Mar 6\n- Update CI pipeline -due Mar 9\n- Add monitoring alerts -due Mar 9\n- Fix memory leak in worker -due Mar 10\n- Update SDK documentation -due Mar 10\n\n### Medium Priority (4)\n- Clean up legacy endpoints *(and 3 others)*\n\nWould you like me to reassign any of these or update their due dates?",
        timestamp: new Date('2026-03-11T09:00:05'),
        creditsConsumed: 3,
      },
      {
        id: 'msg-1-4',
        role: 'user',
        content:
          'Reassign "API rate limiter update" to Jake and push the due date to March 15.',
        timestamp: new Date('2026-03-11T09:01:00'),
      },
      {
        id: 'msg-1-5',
        role: 'assistant',
        content:
          'I\'d like to update the task **"API rate limiter update"** with these changes:',
        timestamp: new Date('2026-03-11T09:01:02'),
        creditsConsumed: 1,
        actionConfirmation: {
          id: 'ac-1',
          description:
            'Update task "API rate limiter update"',
          details:
            'Assignee: unassigned \u2192 Jake Morrison\nDue date: Mar 8 \u2192 Mar 15, 2026',
          confirmed: true,
        },
      },
      {
        id: 'msg-1-6',
        role: 'assistant',
        content:
          'Done! I\'ve updated **"API rate limiter update"**:\n- Assigned to **Jake Morrison**\n- Due date set to **March 15, 2026**',
        timestamp: new Date('2026-03-11T09:01:10'),
        creditsConsumed: 1,
        toolCalls: [
          {
            id: 'tc-2',
            tool_name: 'clickup_update_task',
            description: 'Updating task assignee and due date...',
            status: 'success',
            result: 'Task updated successfully',
          },
        ],
      },
    ],
    'conv-2': [
      {
        id: 'msg-2-1',
        role: 'user',
        content: 'What does our sprint velocity look like over the past month?',
        timestamp: new Date('2026-03-10T14:00:00'),
      },
      {
        id: 'msg-2-2',
        role: 'assistant',
        content:
          "I'll pull up your sprint data to analyze velocity trends.",
        timestamp: new Date('2026-03-10T14:00:03'),
        creditsConsumed: 1,
        toolCalls: [
          {
            id: 'tc-3',
            tool_name: 'clickup_get_tasks',
            description: 'Fetching completed tasks from last 4 sprints...',
            status: 'success',
            result: 'Retrieved data for sprints 21-24',
          },
        ],
      },
      {
        id: 'msg-2-3',
        role: 'assistant',
        content:
          "Here's your sprint velocity over the past 4 sprints:\n\n| Sprint | Points Committed | Points Completed | Velocity |\n|--------|-----------------|------------------|----------|\n| Sprint 21 | 42 | 38 | 90% |\n| Sprint 22 | 45 | 41 | 91% |\n| Sprint 23 | 50 | 35 | 70% |\n| Sprint 24 | 40 | 37 | 93% |\n\n**Average velocity: 86%**\n\nSprint 23 had a noticeable dip. Looking at the data, that coincided with 3 team members being out for the holidays. Sprint 24 shows a strong recovery.\n\n**Recommendation:** Your sustainable velocity is around **38-40 points per sprint**. I'd suggest committing to 40 points for the next sprint to maintain consistency.",
        timestamp: new Date('2026-03-10T14:00:08'),
        creditsConsumed: 3,
      },
      {
        id: 'msg-2-4',
        role: 'user',
        content: 'Create a task to review sprint planning process.',
        timestamp: new Date('2026-03-10T14:02:00'),
      },
      {
        id: 'msg-2-5',
        role: 'assistant',
        content: "I'll create that task for you. Here's what I'm planning:",
        timestamp: new Date('2026-03-10T14:02:02'),
        creditsConsumed: 1,
        actionConfirmation: {
          id: 'ac-2',
          description: 'Create new task in Backlog list',
          details:
            'Title: Review sprint planning process\nPriority: Normal\nList: Backlog\nAssignee: You',
          confirmed: null, // pending confirmation
        },
      },
    ],
    'conv-3': [
      {
        id: 'msg-3-1',
        role: 'user',
        content: 'Summarize what the design team accomplished this week.',
        timestamp: new Date('2026-03-09T16:30:00'),
      },
      {
        id: 'msg-3-2',
        role: 'assistant',
        content: "Let me check the Design team's completed tasks this week.",
        timestamp: new Date('2026-03-09T16:30:02'),
        creditsConsumed: 1,
        toolCalls: [
          {
            id: 'tc-4',
            tool_name: 'clickup_get_tasks',
            description: 'Fetching Design team tasks completed this week...',
            status: 'success',
            result: 'Found 18 completed tasks',
          },
        ],
      },
      {
        id: 'msg-3-3',
        role: 'assistant',
        content:
          "The Design team had a productive week! Here's the summary:\n\n**Completed: 18 tasks** (up from 14 last week)\n\n### Highlights\n- Finalized the **new onboarding flow** mockups (5 screens)\n- Completed **brand guideline v2** documentation\n- Shipped the **settings page redesign** to dev\n- Created **3 new illustration assets** for the marketing site\n\n### In Progress\n- Dashboard analytics redesign (60% complete)\n- Mobile responsive audit (started)\n\n### Blockers\n- Waiting on copy from Marketing for the pricing page redesign\n\nOverall the team is tracking well. The onboarding flow was a major deliverable that's now ready for engineering.",
        timestamp: new Date('2026-03-09T16:30:08'),
        creditsConsumed: 3,
      },
    ],
    'conv-4': [
      {
        id: 'msg-4-1',
        role: 'user',
        content: 'Can you help me set up a new project space for Q2 planning?',
        timestamp: new Date('2026-03-08T10:00:00'),
      },
      {
        id: 'msg-4-2',
        role: 'assistant',
        content:
          "I'd be happy to help set up a Q2 planning space! Let me check your current workspace structure first.",
        timestamp: new Date('2026-03-08T10:00:03'),
        creditsConsumed: 1,
        toolCalls: [
          {
            id: 'tc-5',
            tool_name: 'clickup_get_spaces',
            description: 'Loading workspace structure...',
            status: 'error',
            error: "Couldn't access workspace -rate limit reached. Please try again in a moment.",
          },
        ],
      },
      {
        id: 'msg-4-3',
        role: 'assistant',
        content:
          "It looks like we hit a rate limit with ClickUp's API. This usually resolves in about 30 seconds. Want me to try again, or would you prefer to describe what you'd like and I'll set it up once the limit resets?",
        timestamp: new Date('2026-03-08T10:00:05'),
        creditsConsumed: 1,
      },
    ],
    'conv-5': [
      {
        id: 'msg-5-1',
        role: 'user',
        content: 'Hey Binee, create a dashboard for me to track all overdue tasks by team in October.',
        timestamp: new Date('2026-03-11T11:00:00'),
      },
      {
        id: 'msg-5-2',
        role: 'assistant',
        content: "I can build that for you! I'll create a dashboard with overdue task tracking broken down by team for October.\n\nWould you like me to create a **new dashboard** for this, or **add widgets to an existing dashboard**?",
        timestamp: new Date('2026-03-11T11:00:03'),
        creditsConsumed: 1,
        toolCalls: [
          {
            id: 'tc-5-1',
            tool_name: 'list_dashboards',
            description: 'Checking existing dashboards...',
            status: 'success',
            result: 'Found 2 dashboards: Project Overview, Sprint Tracker',
          },
        ],
        dashboardChoices: [
          {
            id: 'dc-new',
            type: 'new_dashboard',
            label: 'Create a new dashboard',
          },
          {
            id: 'dc-proj',
            type: 'existing_dashboard',
            label: 'Add to existing dashboard',
            dashboardName: 'Project Overview',
            dashboardId: 'dash-1',
          },
          {
            id: 'dc-sprint',
            type: 'existing_dashboard',
            label: 'Add to existing dashboard',
            dashboardName: 'Sprint Tracker',
            dashboardId: 'dash-2',
          },
        ],
        selectedDashboardChoice: 'dc-new',
      },
      {
        id: 'msg-5-3',
        role: 'user',
        content: 'Create a new dashboard for this.',
        timestamp: new Date('2026-03-11T11:00:10'),
      },
      {
        id: 'msg-5-4',
        role: 'assistant',
        content: 'I\'ve created your **"October Overdue Tasks"** dashboard with the following widgets:\n\n- **Overdue by Team** -Bar chart comparing overdue task counts across teams\n- **Total Overdue** -Summary card showing 23 overdue tasks in October\n- **Overdue Tasks Detail** -Table listing each overdue task with assignee, team, and days overdue\n\nYou can view it on the **Dashboards** page. Want me to add anything else to this dashboard?',
        timestamp: new Date('2026-03-11T11:00:15'),
        creditsConsumed: 3,
        toolCalls: [
          {
            id: 'tc-5-2',
            tool_name: 'create_dashboard_widget',
            description: 'Creating bar chart: Overdue by Team...',
            status: 'success',
            result: 'Widget created on "October Overdue Tasks" dashboard',
          },
          {
            id: 'tc-5-3',
            tool_name: 'create_dashboard_widget',
            description: 'Creating summary card: Total Overdue...',
            status: 'success',
            result: 'Widget created',
          },
          {
            id: 'tc-5-4',
            tool_name: 'create_dashboard_widget',
            description: 'Creating table: Overdue Tasks Detail...',
            status: 'success',
            result: 'Widget created',
          },
        ],
      },
    ],
  };

  return mocks[conversationId] ?? [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    conversationId ? getMockMessages(conversationId) : [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalCredits = useRef(0);

  // Reset messages when conversation changes
  const loadConversation = useCallback((id: string | null) => {
    if (id) {
      setMessages(getMockMessages(id));
    } else {
      setMessages([]);
    }
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string, overrideConversationId?: string) => {
      const effectiveId = overrideConversationId || conversationId;
      if (!effectiveId || !content.trim()) return;

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
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: 'ws-mock-001',
            user_id: 'user-mock-001',
            conversation_id: effectiveId,
            message: content.trim(),
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to get response');
        }

        const data = await res.json();

        const toolCallDisplays: ToolCallDisplay[] | undefined =
          data.tool_calls?.map((tc: ToolCallResult, i: number) => ({
            id: `tc-${Date.now()}-${i}`,
            tool_name: tc.tool_name,
            description: tc.success
              ? `Completed ${tc.tool_name}`
              : `Failed ${tc.tool_name}`,
            status: tc.success ? ('success' as const) : ('error' as const),
            result: tc.success ? JSON.stringify(tc.result) : undefined,
            error: tc.error,
          }));

        // B-045: If the response includes a pending action, attach it as actionConfirmation
        const actionConfirmation: ActionConfirmationData | undefined =
          data.pending_action
            ? {
                id: data.pending_action.id,
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
      } catch (err) {
        // On API error, add a mock response so the UI is still functional
        const fallbackMessage: ChatMessage = {
          id: `msg-${Date.now()}-resp`,
          role: 'assistant',
          content:
            "Thanks for your message! I'm currently running in demo mode. In production, I'd connect to your ClickUp workspace to help with that request.",
          timestamp: new Date(),
          creditsConsumed: 1,
        };
        totalCredits.current += 1;
        setMessages((prev) => [...prev, fallbackMessage]);
        setError(
          err instanceof Error ? err.message : 'An unexpected error occurred',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId],
  );

  // B-045: Confirm or cancel a pending write action via API
  const confirmAction = useCallback(
    async (actionId: string, confirmed: boolean) => {
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
            workspace_id: 'ws-mock-001',
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
        // On API error, show error message but keep the UI state
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
    [conversationId],
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
    error,
    sendMessage,
    confirmAction,
    selectDashboardChoice,
    loadConversation,
    totalCreditsConsumed: totalCredits.current,
  };
}
