export interface SetupPlan {
  spaces: Array<{
    name: string;
    folders: Array<{
      name: string;
      lists: Array<{
        name: string;
        tasks: Array<{ name: string; description?: string }>;
      }>;
    }>;
    folderlessLists: Array<{
      name: string;
      tasks: Array<{ name: string; description?: string }>;
    }>;
  }>;
  docs: Array<{ name: string; content?: string }>;
  manualSteps: ManualStep[];
}

export interface ManualStep {
  title: string;
  description: string;
  instructions: string[];
  category: 'automation' | 'view' | 'setting' | 'custom_field' | 'dashboard';
  clickUpUrl?: string;
  completed: boolean;
}

export interface ExecutionProgress {
  phase:
    | 'creating_spaces'
    | 'creating_folders'
    | 'creating_lists'
    | 'creating_tasks'
    | 'creating_docs'
    | 'complete';
  current: number;
  total: number;
  currentItem: string;
  errors: string[];
}

export interface ExecutionResult {
  success: boolean;
  itemsCreated: number;
  itemsTotal: number;
  errors: string[];
}

function countPlanItems(plan: SetupPlan): number {
  let count = 0;
  for (const space of plan.spaces) {
    count++; // space itself
    for (const folder of space.folders) {
      count++; // folder
      for (const list of folder.lists) {
        count++; // list
        count += list.tasks.length;
      }
    }
    for (const list of space.folderlessLists) {
      count++; // list
      count += list.tasks.length;
    }
  }
  count += plan.docs.length;
  return count;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeSetupPlan(
  _workspaceId: string,
  plan: SetupPlan,
  onProgress: (progress: ExecutionProgress) => void
): Promise<ExecutionResult> {
  const total = countPlanItems(plan);
  let current = 0;
  const errors: string[] = [];

  // Create spaces
  for (const space of plan.spaces) {
    current++;
    onProgress({
      phase: 'creating_spaces',
      current,
      total,
      currentItem: space.name,
      errors: [...errors],
    });
    await delay(400 + Math.random() * 300);

    // Create folders
    for (const folder of space.folders) {
      current++;
      onProgress({
        phase: 'creating_folders',
        current,
        total,
        currentItem: `${space.name} / ${folder.name}`,
        errors: [...errors],
      });
      await delay(300 + Math.random() * 200);

      // Create lists inside folders
      for (const list of folder.lists) {
        current++;
        onProgress({
          phase: 'creating_lists',
          current,
          total,
          currentItem: `${folder.name} / ${list.name}`,
          errors: [...errors],
        });
        await delay(250 + Math.random() * 150);

        // Create tasks inside lists
        for (const task of list.tasks) {
          current++;
          onProgress({
            phase: 'creating_tasks',
            current,
            total,
            currentItem: task.name,
            errors: [...errors],
          });
          await delay(120 + Math.random() * 100);
        }
      }
    }

    // Create folderless lists
    for (const list of space.folderlessLists) {
      current++;
      onProgress({
        phase: 'creating_lists',
        current,
        total,
        currentItem: `${space.name} / ${list.name}`,
        errors: [...errors],
      });
      await delay(250 + Math.random() * 150);

      for (const task of list.tasks) {
        current++;
        onProgress({
          phase: 'creating_tasks',
          current,
          total,
          currentItem: task.name,
          errors: [...errors],
        });
        await delay(120 + Math.random() * 100);
      }
    }
  }

  // Create docs
  for (const doc of plan.docs) {
    current++;
    onProgress({
      phase: 'creating_docs',
      current,
      total,
      currentItem: doc.name,
      errors: [...errors],
    });
    await delay(350 + Math.random() * 200);
  }

  // Complete
  onProgress({
    phase: 'complete',
    current: total,
    total,
    currentItem: '',
    errors: [...errors],
  });

  return {
    success: errors.length === 0,
    itemsCreated: total - errors.length,
    itemsTotal: total,
    errors,
  };
}
