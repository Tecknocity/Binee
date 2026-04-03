import type { SetupPlan, ManualStep } from './types';

/**
 * Generate manual steps from a setup plan.
 *
 * These are things Binee can't automate via the ClickUp API — automations,
 * views, certain settings, and custom fields that require manual configuration.
 *
 * Pattern-based: we examine Space/Folder/List names and generate relevant
 * manual steps. For example, a "Sprint" list gets a Sprint ClickApp suggestion,
 * a "Pipeline" list gets a Board view suggestion, etc.
 */
export function generateManualSteps(plan: SetupPlan): ManualStep[] {
  const steps: ManualStep[] = [];

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

    for (const folder of space.folders) {
      for (const list of folder.lists) {
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
