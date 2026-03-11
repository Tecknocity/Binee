import type Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Tool definitions for the Anthropic API
// ---------------------------------------------------------------------------

export const BINEE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_tasks',
    description:
      'Search and filter tasks in the workspace. Returns matching tasks with their status, assignee, due date, and priority.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: {
          type: 'string',
          description: 'Filter by assignee name (partial match supported)',
        },
        status: {
          type: 'string',
          description:
            'Filter by task status (e.g. "open", "in progress", "complete", "closed")',
        },
        list_name: {
          type: 'string',
          description: 'Filter by list name (partial match supported)',
        },
        due_before: {
          type: 'string',
          description: 'Filter tasks due before this ISO date string',
        },
        due_after: {
          type: 'string',
          description: 'Filter tasks due after this ISO date string',
        },
        overdue: {
          type: 'boolean',
          description: 'If true, only return tasks that are past their due date and not closed',
        },
        query: {
          type: 'string',
          description: 'Free-text search across task names and descriptions',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default: 20, max: 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_task',
    description:
      'Update an existing task. Can change status, assignee, due date, or priority. Requires the task ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to update',
        },
        status: {
          type: 'string',
          description: 'New status for the task',
        },
        assignee_name: {
          type: 'string',
          description:
            'Name of the team member to assign the task to. Will be resolved to their ClickUp user ID.',
        },
        due_date: {
          type: 'string',
          description: 'New due date as ISO date string',
        },
        priority: {
          type: 'number',
          description: 'Priority level: 1=urgent, 2=high, 3=normal, 4=low',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'create_task',
    description:
      'Create a new task in a specified list. Requires at least a list name and task name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_name: {
          type: 'string',
          description: 'The name of the list to create the task in',
        },
        name: {
          type: 'string',
          description: 'The name/title of the new task',
        },
        description: {
          type: 'string',
          description: 'Task description (supports markdown)',
        },
        assignee_name: {
          type: 'string',
          description:
            'Name of the team member to assign. Will be resolved to their ClickUp user ID.',
        },
        due_date: {
          type: 'string',
          description: 'Due date as ISO date string',
        },
        priority: {
          type: 'number',
          description: 'Priority level: 1=urgent, 2=high, 3=normal, 4=low',
        },
        status: {
          type: 'string',
          description: 'Initial status for the task',
        },
      },
      required: ['list_name', 'name'],
    },
  },
  {
    name: 'get_workspace_health',
    description:
      'Run a health check on the workspace. Returns metrics on overdue tasks, unassigned tasks, stale tasks, workload distribution, and missing metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_time_tracking_summary',
    description:
      'Get a summary of time tracking data for the workspace, optionally filtered and grouped.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days'],
          description: 'Time period to summarize (default: "this_week")',
        },
        group_by: {
          type: 'string',
          enum: ['member', 'task', 'list', 'day'],
          description: 'How to group the time entries (default: "member")',
        },
        member_name: {
          type: 'string',
          description: 'Filter to a specific team member by name',
        },
      },
      required: [],
    },
  },
];
