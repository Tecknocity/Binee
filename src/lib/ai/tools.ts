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
  // ---------------------------------------------------------------------------
  // Time tracking action tools
  // ---------------------------------------------------------------------------
  {
    name: 'start_time_tracking',
    description:
      'Start a timer on a task. The timer will run until stopped. Only one timer can be active at a time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to start tracking time on',
        },
        description: {
          type: 'string',
          description: 'Optional description of what work is being done',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'stop_time_tracking',
    description:
      'Stop the currently running timer. Returns the time entry that was recorded.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_manual_time_entry',
    description:
      'Add a manual time entry to a task. Use when the user wants to log time they already spent (e.g. "I worked 3 hours on this yesterday").',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to log time on',
        },
        duration_hours: {
          type: 'number',
          description: 'Duration in hours (e.g. 2.5 for 2 hours 30 minutes)',
        },
        date: {
          type: 'string',
          description: 'The date the work was done as ISO date string (defaults to today)',
        },
        description: {
          type: 'string',
          description: 'Optional description of what work was done',
        },
      },
      required: ['task_id', 'duration_hours'],
    },
  },
  // ---------------------------------------------------------------------------
  // Docs tools
  // ---------------------------------------------------------------------------
  {
    name: 'search_docs',
    description:
      'Search and list all ClickUp Docs in the workspace. Returns doc names and IDs for further reading.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_doc_pages',
    description:
      'Get all pages of a ClickUp Doc. Returns page names, content, and structure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        doc_id: {
          type: 'string',
          description: 'The ClickUp Doc ID to get pages from',
        },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'create_doc',
    description:
      'Create a new ClickUp Doc in the workspace with optional initial content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name/title of the new document',
        },
        content: {
          type: 'string',
          description: 'Optional initial content for the document (supports markdown)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_doc_page',
    description:
      'Create a new page inside an existing ClickUp Doc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        doc_id: {
          type: 'string',
          description: 'The ClickUp Doc ID to add a page to',
        },
        name: {
          type: 'string',
          description: 'Name/title of the new page',
        },
        content: {
          type: 'string',
          description: 'Page content (supports markdown)',
        },
      },
      required: ['doc_id', 'name'],
    },
  },
  {
    name: 'update_doc_page',
    description:
      'Update the content or title of an existing page in a ClickUp Doc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        doc_id: {
          type: 'string',
          description: 'The ClickUp Doc ID',
        },
        page_id: {
          type: 'string',
          description: 'The page ID to update',
        },
        name: {
          type: 'string',
          description: 'New name/title for the page',
        },
        content: {
          type: 'string',
          description: 'New content for the page (supports markdown)',
        },
      },
      required: ['doc_id', 'page_id'],
    },
  },
  // ---------------------------------------------------------------------------
  // Goals & Key Results tools
  // ---------------------------------------------------------------------------
  {
    name: 'get_goals',
    description:
      'Get all goals in the workspace. Shows goal names, progress percentage, due dates, and status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_goal',
    description:
      'Create a new goal in the workspace with a name, due date, and optional description.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name of the goal',
        },
        due_date: {
          type: 'string',
          description: 'Due date as ISO date string',
        },
        description: {
          type: 'string',
          description: 'Optional description of the goal',
        },
        owner_name: {
          type: 'string',
          description: 'Name of the goal owner. Will be resolved to their ClickUp user ID.',
        },
        color: {
          type: 'string',
          description: 'Goal color hex code (e.g. "#854DF9")',
        },
      },
      required: ['name', 'due_date'],
    },
  },
  {
    name: 'update_goal',
    description:
      'Update an existing goal. Can change name, due date, description, or color.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'The ClickUp Goal ID to update',
        },
        name: {
          type: 'string',
          description: 'New name for the goal',
        },
        due_date: {
          type: 'string',
          description: 'New due date as ISO date string',
        },
        description: {
          type: 'string',
          description: 'New description',
        },
        color: {
          type: 'string',
          description: 'New color hex code',
        },
      },
      required: ['goal_id'],
    },
  },
  {
    name: 'get_key_results',
    description:
      'Get all key results for a specific goal. Shows progress, completion status, and targets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'The ClickUp Goal ID to get key results for',
        },
      },
      required: ['goal_id'],
    },
  },
  {
    name: 'create_key_result',
    description:
      'Create a new key result under a goal. Defines a measurable target.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'The Goal ID to add the key result to',
        },
        name: {
          type: 'string',
          description: 'Name of the key result',
        },
        type: {
          type: 'string',
          enum: ['number', 'currency', 'boolean', 'percentage', 'automatic'],
          description: 'Type of key result metric (default: "number")',
        },
        steps_start: {
          type: 'number',
          description: 'Starting value (e.g. 0)',
        },
        steps_end: {
          type: 'number',
          description: 'Target value (e.g. 100)',
        },
        unit: {
          type: 'string',
          description: 'Unit of measurement (e.g. "tasks", "users", "%")',
        },
        owner_name: {
          type: 'string',
          description: 'Name of the key result owner. Will be resolved to their ClickUp user ID.',
        },
      },
      required: ['goal_id', 'name', 'steps_start', 'steps_end'],
    },
  },
  // ---------------------------------------------------------------------------
  // Comments tools
  // ---------------------------------------------------------------------------
  {
    name: 'get_task_comments',
    description:
      'Get all comments on a specific task. Returns comment text, author, and timestamp.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to get comments from',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_task_comment',
    description:
      'Add a comment to a task. Can optionally assign the comment to a team member.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID to comment on',
        },
        comment_text: {
          type: 'string',
          description: 'The comment text to add',
        },
        assignee_name: {
          type: 'string',
          description: 'Optional: Name of team member to assign the comment to',
        },
      },
      required: ['task_id', 'comment_text'],
    },
  },
  // ---------------------------------------------------------------------------
  // Tags tools
  // ---------------------------------------------------------------------------
  {
    name: 'get_tags',
    description:
      'Get all available tags in the workspace across all spaces.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_tag_to_task',
    description:
      'Add a tag to a task. The tag must already exist in the space.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID',
        },
        tag_name: {
          type: 'string',
          description: 'The tag name to add',
        },
      },
      required: ['task_id', 'tag_name'],
    },
  },
  {
    name: 'remove_tag_from_task',
    description:
      'Remove a tag from a task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID',
        },
        tag_name: {
          type: 'string',
          description: 'The tag name to remove',
        },
      },
      required: ['task_id', 'tag_name'],
    },
  },
  // ---------------------------------------------------------------------------
  // Custom Fields tools
  // ---------------------------------------------------------------------------
  {
    name: 'set_custom_field',
    description:
      'Set a custom field value on a task. Requires the field ID and the value to set.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The ClickUp task ID',
        },
        field_id: {
          type: 'string',
          description: 'The custom field ID',
        },
        field_name: {
          type: 'string',
          description: 'The custom field name (used to look up the field ID if field_id is not provided)',
        },
        value: {
          type: 'string',
          description: 'The value to set (will be parsed based on field type)',
        },
      },
      required: ['task_id', 'value'],
    },
  },
  // ---------------------------------------------------------------------------
  // Dependencies & Task Links tools
  // ---------------------------------------------------------------------------
  {
    name: 'add_dependency',
    description:
      'Add a dependency between two tasks. Makes one task depend on (wait for) another.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The task that will depend on another (the waiting task)',
        },
        depends_on_task_id: {
          type: 'string',
          description: 'The task that must be completed first (the blocking task)',
        },
      },
      required: ['task_id', 'depends_on_task_id'],
    },
  },
  {
    name: 'remove_dependency',
    description:
      'Remove a dependency between two tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The task that depends on another',
        },
        depends_on_task_id: {
          type: 'string',
          description: 'The task that it depends on',
        },
      },
      required: ['task_id', 'depends_on_task_id'],
    },
  },
  {
    name: 'add_task_link',
    description:
      'Link two tasks together (bidirectional relationship, not a dependency).',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The first task ID',
        },
        links_to_task_id: {
          type: 'string',
          description: 'The second task ID to link to',
        },
      },
      required: ['task_id', 'links_to_task_id'],
    },
  },
  {
    name: 'remove_task_link',
    description:
      'Remove a link between two tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The first task ID',
        },
        links_to_task_id: {
          type: 'string',
          description: 'The linked task ID to unlink',
        },
      },
      required: ['task_id', 'links_to_task_id'],
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
- Add, read, or manage comments on tasks
- Add or remove tags on tasks
- Set custom field values on tasks
- Add or remove task dependencies and links

DO NOT use this for: workspace structure changes (use setupper), workspace analysis (use workspace_analyst), or doc/goal operations (use workspace_analyst). For simple one-off task lookups where you just need a quick count or list, you can use the direct lookup_tasks or get_overdue_tasks tools instead of spinning up the full task manager.`,
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
    description: `Delegate to the Workspace Analyst sub-agent for analyzing workspace health, structure, usage patterns, goals, and docs. Use this when the user wants to:
- Get an overview or health check of their workspace
- Understand what's working and what's not in their ClickUp setup
- See workspace metrics, trends, or comparisons over time
- Audit their workspace structure (spaces, folders, lists, statuses)
- Identify bottlenecks, unused areas, or problematic patterns
- Get recommendations for workspace improvements
- Run a full workspace scan (for the Setup flow)
- View, create, or manage goals and key results (OKRs)
- Search, read, create, or update ClickUp Docs
- Review available tags across the workspace

DO NOT use this for: creating or modifying workspace structure (use setupper) or managing individual tasks (use task_manager).`,
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

DO NOT use this for: analyzing workspace health (use workspace_analyst first, then setupper to act on findings) or managing individual tasks (use task_manager). The Setupper NEVER deletes existing structures — it only creates new ones alongside existing ones.`,
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
