import type { SetupPlan, ManualStep } from './session';

export function generateManualSteps(plan: SetupPlan): ManualStep[] {
  const steps: ManualStep[] = [];

  // Automation suggestions based on list types
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      for (const list of folder.lists) {
        if (/onboard|intake|request/i.test(list.name)) {
          steps.push({
            title: `Set up automation for "${list.name}"`,
            instructions: [
              `Open the "${list.name}" list in the "${space.name}" space.`,
              'Click the Automations icon (lightning bolt) in the top-right.',
              'Add a "When task created" trigger.',
              'Set the action to "Assign to" your designated team member.',
              'Add a second action to "Post comment" with a welcome message template.',
              'Save and enable the automation.',
            ],
            category: 'automation',
            completed: false,
          });
        }
        if (/campaign|sprint|pipeline/i.test(list.name)) {
          steps.push({
            title: `Add a Board view to "${list.name}"`,
            instructions: [
              `Navigate to the "${list.name}" list inside "${folder.name}".`,
              'Click the "+ View" button at the top of the list.',
              'Select "Board" from the view options.',
              'Group the board by Status.',
              'Drag columns to arrange statuses in your preferred order.',
              'Save the view as the default.',
            ],
            category: 'view',
            completed: false,
          });
        }
      }
    }
  }

  // View recommendations
  const hasCalendarContent = plan.spaces.some((s) =>
    s.folders.some((f) =>
      f.lists.some((l) => /calendar|schedule|meeting/i.test(l.name))
    )
  );
  if (hasCalendarContent) {
    steps.push({
      title: 'Enable Calendar view for scheduling lists',
      instructions: [
        'Open any list that involves scheduling or meetings.',
        'Click "+ View" and select "Calendar".',
        'Set the date field to "Due Date".',
        'Toggle on "Show weekends" if your team works weekends.',
      ],
      category: 'view',
      completed: false,
    });
  }

  // Always suggest Gantt for project spaces
  const projectSpace = plan.spaces.find((s) =>
    /project|client|engagement/i.test(s.name)
  );
  if (projectSpace) {
    steps.push({
      title: `Add Gantt view to "${projectSpace.name}" space`,
      instructions: [
        `Go to the "${projectSpace.name}" space.`,
        'Click "+ View" at the space level.',
        'Select "Gantt" from the view options.',
        'Set task dependencies by dragging connector lines between related tasks.',
        'Adjust the timeline zoom to "Weeks" for a clear overview.',
      ],
      category: 'view',
      completed: false,
    });
  }

  // Settings suggestions
  steps.push({
    title: 'Enable Time Tracking',
    instructions: [
      'Go to your workspace Settings (click workspace name → Settings).',
      'Navigate to "ClickApps" in the sidebar.',
      'Find "Time Tracking" and toggle it on.',
      'Optionally enable "Time Estimates" to compare planned vs. actual hours.',
      'Return to any task to see the time tracking widget.',
    ],
    category: 'setting',
    completed: false,
  });

  steps.push({
    title: 'Configure notification preferences',
    instructions: [
      'Click your avatar in the bottom-left corner.',
      'Select "Notifications" from the menu.',
      'Under "Desktop", enable notifications for task assignments and comments.',
      'Under "Email", set digest frequency to "Daily" to avoid inbox overload.',
      'Disable notifications for spaces you only need to monitor occasionally.',
    ],
    category: 'setting',
    completed: false,
  });

  // Custom field suggestions
  const hasClientWork = plan.spaces.some((s) =>
    /client|customer|engagement/i.test(s.name)
  );
  if (hasClientWork) {
    steps.push({
      title: 'Add "Client" custom field',
      instructions: [
        'Open any list under your client-facing space.',
        'Click the "+" icon in the list header to add a column.',
        'Select "Dropdown" as the field type.',
        'Name it "Client" and add your current client names as options.',
        'Use distinct colors for each client for easy visual identification.',
        'Set this field to "Visible to all" so it appears across the workspace.',
      ],
      category: 'custom_field',
      completed: false,
    });

    steps.push({
      title: 'Add "Priority Level" custom field',
      instructions: [
        'Open a list where you track work items.',
        'Add a new custom field of type "Dropdown".',
        'Name it "Priority Level" with options: Urgent, High, Medium, Low.',
        'Assign colors: red for Urgent, orange for High, yellow for Medium, gray for Low.',
        'Pin this field so it always shows in list view.',
      ],
      category: 'custom_field',
      completed: false,
    });
  }

  return steps;
}
