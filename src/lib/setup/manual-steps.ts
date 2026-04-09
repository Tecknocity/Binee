import type { SetupPlan, ManualStep } from './types';

/**
 * Generate manual steps from a setup plan.
 *
 * These are things Binee can't automate via the ClickUp API — statuses,
 * automations, views, certain settings, and custom fields that require
 * manual configuration.
 *
 * IMPORTANT: The ClickUp API does NOT support creating or modifying task
 * statuses. Status configuration is always a manual step. We generate
 * per-Space status setup instructions because ClickUp statuses are
 * inherited: setting them on a Space applies to all child Folders/Lists.
 *
 * Pattern-based: we examine Space/Folder/List names and generate relevant
 * manual steps. For example, a "Sprint" list gets a Sprint ClickApp suggestion,
 * a "Pipeline" list gets a Board view suggestion, etc.
 */
export function generateManualSteps(plan: SetupPlan): ManualStep[] {
  const steps: ManualStep[] = [];

  // -----------------------------------------------------------------------
  // Status configuration steps (per-Space, since statuses cascade down)
  // The ClickUp API cannot create statuses, so this is always manual.
  // -----------------------------------------------------------------------
  for (const space of plan.spaces) {
    // Collect all unique statuses across lists in this space
    const allLists = [
      ...(space.lists ?? []),
      ...space.folders.flatMap((f) => f.lists),
    ];

    // Use the first list's statuses as the representative set for the space
    // (the planner is instructed to keep statuses consistent within a space)
    const representativeStatuses = allLists[0]?.statuses ?? [];

    if (representativeStatuses.length > 0) {
      const statusNames = representativeStatuses.map((s) => s.name).join(', ');
      const statusInstructions = [
        `Open the "${space.name}" Space in ClickUp`,
        'Click the Space name or gear icon to open Space settings',
        'Go to the "Statuses" section',
      ];

      // Add instructions for each status to create
      for (const status of representativeStatuses) {
        const typeLabel = status.type === 'open' ? '(start status)'
          : status.type === 'done' || status.type === 'closed' ? '(done/closed status)'
          : '(active status)';
        statusInstructions.push(
          `Add status "${status.name}" ${typeLabel}`
        );
      }

      statusInstructions.push(
        'Save your changes. All lists in this space will inherit these statuses automatically.'
      );

      steps.push({
        title: `Configure statuses for "${space.name}" Space`,
        description: `Set up workflow statuses: ${statusNames}. All lists in this space will inherit them.`,
        instructions: statusInstructions,
        category: 'setting',
        completed: false,
      });
    }
  }

  // -----------------------------------------------------------------------
  // ClickApp, view, automation, and custom field suggestions
  // -----------------------------------------------------------------------
  for (const space of plan.spaces) {
    // ClickApp suggestions per space
    if (hasNamePattern(space.name, ['engineering', 'development', 'product', 'sprint'])) {
      steps.push({
        title: `Enable Sprints ClickApp in "${space.name}"`,
        description: 'The Sprints ClickApp adds sprint planning, velocity tracking, and burndown charts.',
        instructions: [
          `Open the "${space.name}" Space in ClickUp`,
          'Click the Space settings (gear icon)',
          'Go to "ClickApps" tab',
          'Find "Sprints" and toggle it on',
          'Configure sprint duration (e.g., 2 weeks)',
        ],
        category: 'setting',
        completed: false,
      });
    }

    if (hasNamePattern(space.name, ['client', 'agency', 'accounts'])) {
      steps.push({
        title: `Enable Time Tracking in "${space.name}"`,
        description: 'Track billable hours for client work.',
        instructions: [
          `Open the "${space.name}" Space in ClickUp`,
          'Click the Space settings (gear icon)',
          'Go to "ClickApps" tab',
          'Find "Time Tracking" and toggle it on',
          'Optionally enable "Billable" time entries',
        ],
        category: 'setting',
        completed: false,
      });
    }

    // Process all lists (both folderless and folder-based)
    const allLists = [
      ...(space.lists ?? []),
      ...space.folders.flatMap((f) => f.lists),
    ];

    for (const list of allLists) {
        // Board view for pipeline/kanban-style lists
        if (hasNamePattern(list.name, ['pipeline', 'kanban', 'board', 'sales', 'deals', 'leads'])) {
          steps.push({
            title: `Create Board view for "${list.name}"`,
            description: 'A Board (Kanban) view is ideal for pipeline-style workflows.',
            instructions: [
              `Open the "${list.name}" list in ClickUp`,
              'Click "+ View" at the top',
              'Select "Board"',
              'Group by "Status" (default)',
              'Save the view',
            ],
            category: 'view',
            completed: false,
          });
        }

        // Calendar view for time-based lists
        if (hasNamePattern(list.name, ['calendar', 'schedule', 'campaigns', 'launches', 'content', 'editorial'])) {
          steps.push({
            title: `Create Calendar view for "${list.name}"`,
            description: 'Visualize tasks on a calendar by due date.',
            instructions: [
              `Open the "${list.name}" list in ClickUp`,
              'Click "+ View" at the top',
              'Select "Calendar"',
              'Tasks will display by due date',
              'Save the view',
            ],
            category: 'view',
            completed: false,
          });
        }

        // Automation for onboarding/intake lists
        if (hasNamePattern(list.name, ['onboarding', 'intake', 'new client', 'kickoff'])) {
          steps.push({
            title: `Add auto-assign automation for "${list.name}"`,
            description: 'Automatically assign new tasks to the team lead for triage.',
            instructions: [
              `Open the "${list.name}" list in ClickUp`,
              'Click "Automations" in the toolbar',
              'Click "Add Automation"',
              'Choose trigger: "When task is created"',
              'Choose action: "Assign to" → select the team lead',
              'Save the automation',
            ],
            category: 'automation',
            completed: false,
          });
        }

        // Status-change notification automation
        if (hasNamePattern(list.name, ['review', 'approval', 'sign-off', 'qa'])) {
          steps.push({
            title: `Add notification automation for "${list.name}"`,
            description: 'Notify the team when tasks move to review/approval status.',
            instructions: [
              `Open the "${list.name}" list in ClickUp`,
              'Click "Automations" in the toolbar',
              'Click "Add Automation"',
              'Choose trigger: "When status changes to" → select your review status',
              'Choose action: "Send notification" → select channel or assignee',
              'Save the automation',
            ],
            category: 'automation',
            completed: false,
          });
        }

        // Custom fields for client/project-tracking lists
        if (hasNamePattern(list.name, ['projects', 'client work', 'engagements', 'retainers'])) {
          steps.push({
            title: `Add custom fields to "${list.name}"`,
            description: 'Track client-specific data with custom fields.',
            instructions: [
              `Open the "${list.name}" list in ClickUp`,
              'Click "Fields" or the "+" button in the table header',
              'Add a "Dropdown" field called "Client Name"',
              'Add a "Currency" field called "Budget" (optional)',
              'Add a "Date" field called "Deadline" if not using due dates',
            ],
            category: 'custom_field',
            completed: false,
          });
        }
      }
  }

  // Mention tags if they were created
  if (plan.recommended_tags && plan.recommended_tags.length > 0) {
    const tagNames = plan.recommended_tags.map((t) => t.name).join(', ');
    steps.push({
      title: 'Start using your workspace tags',
      description: `We created ${plan.recommended_tags.length} tags for you: ${tagNames}. Apply them to tasks for cross-cutting categorization.`,
      instructions: [
        'Open any task in ClickUp',
        'Click the "Tags" field (or use the tag icon)',
        'Select from your pre-configured tags',
        'Use tags consistently across spaces for better filtering',
        'Tip: You can filter any view by tag to see tasks across all lists',
      ],
      category: 'setting',
      completed: false,
    });
  }

  // Mention docs if they were created
  if (plan.recommended_docs && plan.recommended_docs.length > 0) {
    const docNames = plan.recommended_docs.map((d) => d.name).join(', ');
    steps.push({
      title: 'Customize your starter docs',
      description: `We created ${plan.recommended_docs.length} starter docs: ${docNames}. Customize them with your team's specific processes.`,
      instructions: [
        'Go to the Docs section in your ClickUp sidebar',
        'Open each starter doc and update it with your team\'s specifics',
        'Share docs with your team by adjusting permissions',
        'Tip: You can embed docs inside tasks for easy reference',
      ],
      category: 'setting',
      completed: false,
    });
  }

  // Mention goals if they were created
  if (plan.recommended_goals && plan.recommended_goals.length > 0) {
    steps.push({
      title: 'Review and customize your goals',
      description: `We created ${plan.recommended_goals.length} goal(s) to track your objectives. Add key results and link tasks to them.`,
      instructions: [
        'Go to the Goals section in your ClickUp sidebar',
        'Review each goal and adjust due dates if needed',
        'Add Key Results to define measurable targets',
        'Link tasks to goals to automatically track progress',
        'Tip: Use Binee\'s chat to check goal progress anytime',
      ],
      category: 'setting',
      completed: false,
    });
  }

  // If no specific patterns matched, add general best-practice steps
  if (steps.length === 0 && plan.spaces.length > 0) {
    steps.push({
      title: 'Create your preferred views',
      description: 'Set up Board, Calendar, or Table views for your most-used lists.',
      instructions: [
        'Open any list in ClickUp',
        'Click "+ View" at the top',
        'Choose Board (for status-based workflows) or Calendar (for deadline-based work)',
        'Save the view',
      ],
      category: 'view',
      completed: false,
    });

    steps.push({
      title: 'Set up task automations',
      description: 'Automate repetitive work like task assignments and status notifications.',
      instructions: [
        'Open a list where you want automation',
        'Click "Automations" in the toolbar',
        'Browse pre-built templates or create a custom automation',
        'Common: auto-assign on creation, notify on status change, move to list on completion',
      ],
      category: 'automation',
      completed: false,
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasNamePattern(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}
