import type { SetupPlan, ManualStep } from './session';

// ---------------------------------------------------------------------------
// B-077: Generate contextual manual steps from the setup plan
//
// For things the ClickUp API cannot do (automations, custom fields, views,
// dashboards), show step-by-step instructions using actual workspace names
// from just-created items.
// ---------------------------------------------------------------------------

/** Base URL for ClickUp app — used to build deep links */
const CLICKUP_APP_BASE = 'https://app.clickup.com';

/**
 * Generate manual step instructions from a setup plan.
 * Each step includes a title, description with real workspace item names,
 * numbered instructions, a category, and an optional link to the ClickUp location.
 */
export function generateManualSteps(plan: SetupPlan): ManualStep[] {
  const steps: ManualStep[] = [];

  // -------------------------------------------------------------------------
  // 1. Automation steps — based on list types
  // -------------------------------------------------------------------------
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      for (const list of folder.lists) {
        // Onboarding / intake automation
        if (/onboard|intake|request/i.test(list.name)) {
          steps.push({
            title: `Set up automation for "${list.name}"`,
            description: `Create an auto-assign automation in "${list.name}" (${space.name} › ${folder.name}) so new tasks are automatically assigned and a welcome comment is posted.`,
            instructions: [
              `Open the "${list.name}" list in the "${space.name}" space.`,
              'Click the Automations icon (lightning bolt) in the top-right.',
              'Add a "When task created" trigger.',
              'Set the action to "Assign to" your designated team member.',
              'Add a second action to "Post comment" with a welcome message template.',
              'Save and enable the automation.',
            ],
            category: 'automation',
            clickUpUrl: `${CLICKUP_APP_BASE}`,
            completed: false,
          });
        }

        // Status-change automation for pipelines and sales lists
        if (/pipeline|leads|proposals|sales/i.test(list.name)) {
          steps.push({
            title: `Add status-change automation for "${list.name}"`,
            description: `Automate notifications in "${list.name}" (${space.name} › ${folder.name}) when tasks move to key statuses like "Won" or "Closed".`,
            instructions: [
              `Navigate to "${list.name}" in "${folder.name}" under "${space.name}".`,
              'Click the Automations icon (lightning bolt).',
              'Choose "When status changes to" as the trigger.',
              'Select the closing or winning status from your status list.',
              'Add an action to "Send email" or "Post comment" to notify the team.',
              'Optionally add a "Move to list" action to archive completed items.',
              'Save and enable the automation.',
            ],
            category: 'automation',
            clickUpUrl: `${CLICKUP_APP_BASE}`,
            completed: false,
          });
        }

        // Due date reminder automation for task lists with deadlines
        if (/deliverable|order|fulfillment|invoice|billing/i.test(list.name)) {
          steps.push({
            title: `Set due date reminders for "${list.name}"`,
            description: `Add an automation in "${list.name}" (${space.name} › ${folder.name}) that sends a reminder when a task's due date is approaching.`,
            instructions: [
              `Open "${list.name}" in the "${space.name}" space.`,
              'Click the Automations icon.',
              'Select "When due date arrives" as the trigger.',
              'Set the timing to "1 day before" due date.',
              'Add an action to "Send notification" to the assignee.',
              'Save and enable the automation.',
            ],
            category: 'automation',
            clickUpUrl: `${CLICKUP_APP_BASE}`,
            completed: false,
          });
        }

        // Board view for kanban-style lists
        if (/campaign|sprint|pipeline|backlog|triage/i.test(list.name)) {
          steps.push({
            title: `Add Board view to "${list.name}"`,
            description: `Create a Kanban-style Board view for "${list.name}" in ${folder.name} to visualize task flow across statuses.`,
            instructions: [
              `Navigate to the "${list.name}" list inside "${folder.name}".`,
              'Click the "+ View" button at the top of the list.',
              'Select "Board" from the view options.',
              'Group the board by Status.',
              'Drag columns to arrange statuses in your preferred order.',
              'Save the view as the default.',
            ],
            category: 'view',
            clickUpUrl: `${CLICKUP_APP_BASE}`,
            completed: false,
          });
        }
      }
    }

    // Also check folderless lists for automation and view patterns
    for (const list of space.folderlessLists) {
      if (/onboard|intake|request/i.test(list.name)) {
        steps.push({
          title: `Set up automation for "${list.name}"`,
          description: `Create an auto-assign automation in "${list.name}" (${space.name}) so incoming items are triaged automatically.`,
          instructions: [
            `Open the "${list.name}" list in the "${space.name}" space.`,
            'Click the Automations icon (lightning bolt) in the top-right.',
            'Add a "When task created" trigger.',
            'Set the action to "Assign to" your designated team member.',
            'Save and enable the automation.',
          ],
          category: 'automation',
          clickUpUrl: `${CLICKUP_APP_BASE}`,
          completed: false,
        });
      }

      if (/pipeline|feedback|request/i.test(list.name)) {
        steps.push({
          title: `Add Board view to "${list.name}"`,
          description: `Add a Kanban Board view to "${list.name}" in the "${space.name}" space for visual task management.`,
          instructions: [
            `Navigate to "${list.name}" in the "${space.name}" space.`,
            'Click "+ View" and select "Board".',
            'Group by Status and arrange columns.',
            'Save the view.',
          ],
          category: 'view',
          clickUpUrl: `${CLICKUP_APP_BASE}`,
          completed: false,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. View recommendations — Calendar and Gantt
  // -------------------------------------------------------------------------
  const calendarLists: string[] = [];
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      for (const list of folder.lists) {
        if (/calendar|schedule|meeting|event/i.test(list.name)) {
          calendarLists.push(`"${list.name}" in ${space.name}`);
        }
      }
    }
    for (const list of space.folderlessLists) {
      if (/calendar|schedule|meeting|event/i.test(list.name)) {
        calendarLists.push(`"${list.name}" in ${space.name}`);
      }
    }
  }

  if (calendarLists.length > 0) {
    steps.push({
      title: 'Enable Calendar view for scheduling lists',
      description: `Add a Calendar view to ${calendarLists.join(', ')} to visualize tasks by due date on a calendar.`,
      instructions: [
        `Open one of your scheduling lists (${calendarLists[0]}).`,
        'Click "+ View" and select "Calendar".',
        'Set the date field to "Due Date".',
        'Toggle on "Show weekends" if your team works weekends.',
        'Repeat for other scheduling lists as needed.',
      ],
      category: 'view',
      clickUpUrl: `${CLICKUP_APP_BASE}`,
      completed: false,
    });
  }

  // Gantt for project / client spaces
  const projectSpace = plan.spaces.find((s) =>
    /project|client|engagement|engineering/i.test(s.name)
  );
  if (projectSpace) {
    steps.push({
      title: `Add Gantt view to "${projectSpace.name}" space`,
      description: `Create a Gantt chart in the "${projectSpace.name}" space to track task timelines, dependencies, and critical paths.`,
      instructions: [
        `Go to the "${projectSpace.name}" space.`,
        'Click "+ View" at the space level.',
        'Select "Gantt" from the view options.',
        'Set task dependencies by dragging connector lines between related tasks.',
        'Adjust the timeline zoom to "Weeks" for a clear overview.',
      ],
      category: 'view',
      clickUpUrl: `${CLICKUP_APP_BASE}`,
      completed: false,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Dashboard steps — create ClickUp Dashboards
  // -------------------------------------------------------------------------
  const spaceNames = plan.spaces.map((s) => s.name);

  steps.push({
    title: 'Create a Workspace Overview Dashboard',
    description: `Build a high-level dashboard to monitor activity across ${spaceNames.join(', ')}. Track total tasks, status distribution, and team workload at a glance.`,
    instructions: [
      'Click "Dashboards" in the left sidebar (or use the "+" button).',
      'Click "Create Dashboard" and name it "Workspace Overview".',
      'Add a "Status" widget — select all spaces to see task distribution by status.',
      'Add a "Workload" widget to see task assignments across team members.',
      'Add a "Tasks Completed" widget with a weekly time range.',
      'Arrange widgets by dragging them into your preferred layout.',
      'Click "Save" to finalize the dashboard.',
    ],
    category: 'dashboard',
    clickUpUrl: `${CLICKUP_APP_BASE}`,
    completed: false,
  });

  // Team workload dashboard if multiple spaces suggest team collaboration
  if (plan.spaces.length >= 2) {
    steps.push({
      title: 'Create a Team Workload Dashboard',
      description: `Set up a dashboard to track team capacity and task distribution across ${spaceNames.slice(0, 3).join(', ')}${spaceNames.length > 3 ? ', and more' : ''}.`,
      instructions: [
        'Go to "Dashboards" and click "Create Dashboard".',
        'Name it "Team Workload".',
        'Add a "Workload by Assignee" widget — include all relevant spaces.',
        'Add a "Time Tracking" widget if time tracking is enabled.',
        'Add a "Due Date" widget to highlight upcoming deadlines.',
        'Add a "Sprint Burndown" widget if using sprints.',
        'Save the dashboard.',
      ],
      category: 'dashboard',
      clickUpUrl: `${CLICKUP_APP_BASE}`,
      completed: false,
    });
  }

  // Client/project-specific dashboard
  const clientSpace = plan.spaces.find((s) =>
    /client|customer|engagement/i.test(s.name)
  );
  if (clientSpace) {
    steps.push({
      title: `Create a Client Reporting Dashboard`,
      description: `Build a dashboard for "${clientSpace.name}" to track project health, deliverable status, and client-facing metrics.`,
      instructions: [
        'Go to "Dashboards" and click "Create Dashboard".',
        `Name it "${clientSpace.name} Dashboard".`,
        `Add a "Status" widget scoped to the "${clientSpace.name}" space.`,
        'Add a "Tasks by Due Date" widget to show upcoming deadlines.',
        'Add a "Completed Tasks" widget with a monthly view.',
        'Optionally add a "Custom Field" widget to track client-specific metrics.',
        'Save the dashboard.',
      ],
      category: 'dashboard',
      clickUpUrl: `${CLICKUP_APP_BASE}`,
      completed: false,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Settings suggestions
  // -------------------------------------------------------------------------
  steps.push({
    title: 'Enable Time Tracking',
    description: 'Turn on the Time Tracking ClickApp across your workspace to log hours spent on tasks and compare against estimates.',
    instructions: [
      'Go to your workspace Settings (click workspace name → Settings).',
      'Navigate to "ClickApps" in the sidebar.',
      'Find "Time Tracking" and toggle it on.',
      'Optionally enable "Time Estimates" to compare planned vs. actual hours.',
      'Return to any task to see the time tracking widget.',
    ],
    category: 'setting',
    clickUpUrl: `${CLICKUP_APP_BASE}`,
    completed: false,
  });

  steps.push({
    title: 'Configure notification preferences',
    description: 'Set up desktop and email notifications so your team stays informed without inbox overload.',
    instructions: [
      'Click your avatar in the bottom-left corner.',
      'Select "Notifications" from the menu.',
      'Under "Desktop", enable notifications for task assignments and comments.',
      'Under "Email", set digest frequency to "Daily" to avoid inbox overload.',
      `Disable notifications for spaces you only need to monitor occasionally.`,
    ],
    category: 'setting',
    clickUpUrl: `${CLICKUP_APP_BASE}`,
    completed: false,
  });

  // -------------------------------------------------------------------------
  // 5. Custom field suggestions
  // -------------------------------------------------------------------------
  const hasClientWork = plan.spaces.some((s) =>
    /client|customer|engagement/i.test(s.name)
  );
  const clientSpaceName = plan.spaces.find((s) =>
    /client|customer|engagement/i.test(s.name)
  )?.name;

  if (hasClientWork && clientSpaceName) {
    steps.push({
      title: `Add "Client" custom field to "${clientSpaceName}"`,
      description: `Create a dropdown custom field in "${clientSpaceName}" to tag tasks by client for easy filtering and reporting.`,
      instructions: [
        `Open any list under the "${clientSpaceName}" space.`,
        'Click the "+" icon in the list header to add a column.',
        'Select "Dropdown" as the field type.',
        'Name it "Client" and add your current client names as options.',
        'Use distinct colors for each client for easy visual identification.',
        'Set this field to "Visible to all" so it appears across the workspace.',
      ],
      category: 'custom_field',
      clickUpUrl: `${CLICKUP_APP_BASE}`,
      completed: false,
    });

    steps.push({
      title: `Add "Priority Level" custom field to "${clientSpaceName}"`,
      description: `Create a priority dropdown in "${clientSpaceName}" with color-coded levels (Urgent, High, Medium, Low) for quick visual triage.`,
      instructions: [
        `Open a list in the "${clientSpaceName}" space where you track work items.`,
        'Add a new custom field of type "Dropdown".',
        'Name it "Priority Level" with options: Urgent, High, Medium, Low.',
        'Assign colors: red for Urgent, orange for High, yellow for Medium, gray for Low.',
        'Pin this field so it always shows in list view.',
      ],
      category: 'custom_field',
      clickUpUrl: `${CLICKUP_APP_BASE}`,
      completed: false,
    });
  }

  // Budget / cost custom field for spaces with financial lists
  const hasFinance = plan.spaces.some((s) =>
    s.folders.some((f) =>
      f.lists.some((l) => /budget|invoice|billing|finance|cost/i.test(l.name))
    )
  );
  if (hasFinance) {
    const financeSpace = plan.spaces.find((s) =>
      s.folders.some((f) =>
        f.lists.some((l) => /budget|invoice|billing|finance|cost/i.test(l.name))
      )
    );
    if (financeSpace) {
      steps.push({
        title: `Add "Budget" custom field to "${financeSpace.name}"`,
        description: `Create a currency custom field in "${financeSpace.name}" to track budgets and costs directly on tasks.`,
        instructions: [
          `Open a financial list in the "${financeSpace.name}" space.`,
          'Click the "+" icon in the list header to add a column.',
          'Select "Currency" as the field type.',
          'Name it "Budget" and set your preferred currency.',
          'Pin this field for quick visibility.',
        ],
        category: 'custom_field',
        clickUpUrl: `${CLICKUP_APP_BASE}`,
        completed: false,
      });
    }
  }

  return steps;
}
