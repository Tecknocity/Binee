// src/lib/ai/tools.ts
// REWRITTEN — Sub-Agent Tools + Direct Tools + ClickUp Tool Registry

import type Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// CLICKUP TOOL REGISTRY
// Complete tool definitions used by both DIRECT_TOOLS and sub-agent executor.
// ---------------------------------------------------------------------------

export const CLICKUP_TOOL_REGISTRY: Anthropic.Tool[] = [
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
    name: 'get_overdue_tasks',
    description:
      'Get all tasks that are past their due date and not yet completed or closed. Returns task details sorted by how overdue they are.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: {
          type: 'string',
          description: 'Filter overdue tasks by assignee name (partial match supported)',
        },
        list_name: {
          type: 'string',
          description: 'Filter overdue tasks by list name (partial match supported)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of overdue tasks to return (default: 25, max: 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'assign_task',
    description:
      'Assign or reassign a task to a team member. Can optionally remove existing assignees first for a clean reassignment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to assign',
        },
        assignee_name: {
          type: 'string',
          description:
            'Name of the team member to assign. Will be resolved to their ClickUp user ID.',
        },
        replace_existing: {
          type: 'boolean',
          description:
            'If true, removes all current assignees before assigning the new one. Default: false.',
        },
      },
      required: ['task_id', 'assignee_name'],
    },
  },
  {
    name: 'move_task',
    description:
      'Move a task from its current list to a different list. Requires the task ID and the target list name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to move',
        },
        target_list_name: {
          type: 'string',
          description: 'Name of the destination list (partial match supported)',
        },
      },
      required: ['task_id', 'target_list_name'],
    },
  },
  {
    name: 'get_workspace_summary',
    description:
      'Get a high-level summary of the workspace including total tasks, tasks by status, tasks by assignee, lists, and team members.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_weekly_summary',
    description:
      'Get a time-scoped progress summary showing tasks completed, tasks due, tasks created, and tasks currently in progress within a date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom'],
          description: 'Predefined time period (default: "this_week")',
        },
        start_date: {
          type: 'string',
          description: 'Custom start date as ISO date string (only used when period is "custom")',
        },
        end_date: {
          type: 'string',
          description: 'Custom end date as ISO date string (only used when period is "custom")',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_team_activity',
    description:
      'Get recent team activity from webhook events. Shows task creations, updates, completions, comments, and other actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hours: {
          type: 'number',
          description: 'How many hours back to look for activity (default: 24, max: 168)',
        },
        member_name: {
          type: 'string',
          description: 'Filter activity to a specific team member by name',
        },
        event_type: {
          type: 'string',
          enum: ['taskCreated', 'taskUpdated', 'taskStatusUpdated', 'taskAssigneeUpdated', 'taskCommentPosted', 'taskDeleted', 'taskMoved'],
          description: 'Filter to a specific type of activity event',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of activity events to return (default: 30, max: 100)',
        },
      },
      required: [],
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
  {
    name: 'create_dashboard_widget',
    description:
      'Create a new widget on the user\'s dashboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        widget_type: {
          type: 'string',
          description: 'Type of widget',
        },
        title: {
          type: 'string',
          description: 'Title for the widget',
        },
        data_query: {
          type: 'object',
          description: 'Query definition for what data to display. Properties: data_source, metric, group_by, filters, sort_by, limit.',
        },
        config: {
          type: 'object',
          description: 'Widget-specific configuration (filters, date range, grouping, display options)',
        },
        dashboard_id: {
          type: 'string',
          description: 'Target dashboard ID (optional, uses active dashboard if not provided)',
        },
        dashboard_name: {
          type: 'string',
          description: 'Name of the dashboard to add the widget to. If it does not exist, it will be created.',
        },
      },
      required: ['widget_type', 'title', 'data_query'],
    },
  },
  {
    name: 'update_dashboard_widget',
    description:
      'Update an existing widget\'s configuration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        widget_id: {
          type: 'string',
          description: 'ID of the widget to update',
        },
        updates: {
          type: 'object',
          description: 'Config changes to apply to the widget',
          properties: {
            title: { type: 'string', description: 'New title for the widget' },
            date_range: { type: 'object', description: 'New date range filter' },
            filters: { type: 'array', description: 'Array of filter objects to apply' },
            grouping: { type: 'string', description: 'New grouping dimension' },
            sort: { type: 'object', description: 'Sort configuration' },
            widget_type: { type: 'string', description: 'New widget type' },
          },
        },
      },
      required: ['widget_id', 'updates'],
    },
  },
  {
    name: 'delete_dashboard_widget',
    description:
      'Delete a widget from a dashboard. Always confirm with the user before deleting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        widget_id: {
          type: 'string',
          description: 'The ID of the widget to delete',
        },
      },
      required: ['widget_id'],
    },
  },
  {
    name: 'list_dashboards',
    description:
      'List all dashboards in the workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_dashboard_widgets',
    description:
      'List all widgets on a specific dashboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dashboard_id: {
          type: 'string',
          description: 'The ID of the dashboard to list widgets for.',
        },
        dashboard_name: {
          type: 'string',
          description: 'The name of the dashboard to list widgets for (alternative to dashboard_id).',
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// SUB-AGENT TOOLS
// These are the tools the master agent uses to delegate to specialized sub-agents.
// ---------------------------------------------------------------------------

export const SUB_AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'task_manager',
    description: `Delegate to the Task Manager sub-agent for creating, updating, searching, moving, or organizing tasks in ClickUp. Use this when the user wants to:
- Create a new task (with name, assignee, due date, priority, list)
- Update an existing task (status, assignee, due date, priority, custom fields)
- Search for tasks by name, assignee, status, list, or due date
- Find overdue tasks or tasks matching specific criteria
- Assign or reassign tasks to team members
- Move tasks between lists
- Add time entries or manage time tracking
- Perform bulk operations on multiple tasks

DO NOT use this for: workspace structure changes (use setupper), dashboard creation (use dashboard_builder), or workspace analysis (use workspace_analyst). For simple one-off task lookups where you just need a quick count or list, you can use the direct lookup_tasks or get_overdue_tasks tools instead of spinning up the full task manager.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what the user wants to do with tasks. Include all relevant details from the user message.',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'workspace_analyst',
    description: `Delegate to the Workspace Analyst sub-agent for analyzing workspace health, structure, and usage patterns. Use this when the user wants to:
- Get an overview or health check of their workspace
- Understand what's working and what's not in their ClickUp setup
- See workspace metrics, trends, or comparisons over time
- Audit their workspace structure (spaces, folders, lists, statuses)
- Identify bottlenecks, unused areas, or problematic patterns
- Get recommendations for workspace improvements
- Run a full workspace scan (for the Setup flow)

DO NOT use this for: creating or modifying workspace structure (use setupper), managing tasks (use task_manager), or building dashboards (use dashboard_builder).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what analysis the user wants.',
        },
        mode: {
          type: 'string',
          enum: ['audit', 'snapshot'],
          description: 'audit = human-readable analysis for chat. snapshot = structured data for the Setup flow.',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'setupper',
    description: `Delegate to the Setupper sub-agent for creating or improving ClickUp workspace structure. Use this when the user wants to:
- Set up their ClickUp workspace for the first time
- Create new Spaces, Folders, or Lists
- Add or modify status configurations
- Create custom fields
- Restructure or reorganize their workspace
- Apply industry-specific workspace templates
- Improve their current workspace structure based on analysis

DO NOT use this for: analyzing workspace health (use workspace_analyst first, then setupper to act on findings), managing individual tasks (use task_manager), or building dashboards (use dashboard_builder). The Setupper NEVER deletes existing structures — it only creates new ones alongside existing ones.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what workspace structure the user wants to create or change.',
        },
        analyst_snapshot: {
          type: 'string',
          description: 'Optional: JSON snapshot from the Workspace Analyst if a scan was run first.',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'dashboard_builder',
    description: `Delegate to the Dashboard Builder sub-agent for creating, modifying, or managing dashboards and widgets. Use this when the user wants to:
- Create a new dashboard
- Add widgets to a dashboard (charts, tables, summary cards, etc.)
- Modify existing widget configurations (filters, grouping, time range)
- Remove widgets from a dashboard
- Get suggestions for dashboard layouts based on their needs
- Build specific dashboard types (project overview, team performance, sprint, client)

DO NOT use this for: analyzing workspace data outside of dashboards (use workspace_analyst), managing tasks (use task_manager), or modifying workspace structure (use setupper).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'Natural language description of what the user wants on their dashboard.',
        },
      },
      required: ['request'],
    },
  },
];

// ---------------------------------------------------------------------------
// DIRECT TOOLS
// ClickUp tools the master agent can call directly for simple operations.
// ---------------------------------------------------------------------------

export const DIRECT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_tasks',
    description: 'Quick task search. Use for simple lookups like "show me tasks assigned to Sarah" or "how many tasks are in the Marketing list." For complex task operations (create, update, bulk), use the task_manager sub-agent instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: { type: 'string', description: 'Filter by assignee name' },
        status: { type: 'string', description: 'Filter by status name' },
        list_name: { type: 'string', description: 'Filter by list name' },
        search_term: { type: 'string', description: 'Search task names' },
        include_closed: { type: 'boolean', description: 'Include closed tasks (default false)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_overdue_tasks',
    description: 'Get all overdue tasks. Quick read-only lookup. For taking action on overdue tasks (reassigning, updating), use the task_manager sub-agent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee: { type: 'string', description: 'Filter by assignee name' },
        space_name: { type: 'string', description: 'Filter by space name' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_workspace_summary',
    description: 'Get high-level workspace metrics: total tasks, by status, by priority, by assignee. Use for quick stats. For deep analysis, use workspace_analyst.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_weekly_summary',
    description: 'Get time-scoped task metrics (today, this week, this month). Quick stats on recent progress.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time period' },
      },
      required: [],
    },
  },
];

// For backward compatibility
export const ALL_TOOLS = [...SUB_AGENT_TOOLS, ...DIRECT_TOOLS];

// Legacy export name — referenced by sub-agent executor and other modules
export const BINEE_TOOLS = CLICKUP_TOOL_REGISTRY;
