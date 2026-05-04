// Per-job worker: processes a single setup_enrichment_jobs row.
//
// Three job types:
//   - list_tasks  : Haiku generates tasks, write them + checklists + deps to ClickUp
//   - doc_content : Haiku generates markdown, create the doc page on ClickUp
//   - list_views  : create the per-tier default views (board/calendar/etc) on a list
//
// The worker is intentionally stateless and scoped to one job at a time. It
// handles its own ClickUp / Anthropic errors and returns a structured result
// telling the caller (run-enrichment endpoint) whether to mark the job done
// or failed. Parallelism, leasing, and retry policy live in the caller.

import { ClickUpClient } from "@/lib/clickup/client";
import { getClickUpTeamId } from "@/lib/clickup/team";
import { generateTasksForList } from "@/lib/ai/task-generator";
import { generateDocContent } from "@/lib/ai/doc-generator";
import { findReferenceSnippet } from "@/lib/setup/knowledge-base-context";
import { getDefaultListViews } from "@/lib/clickup/plan-capabilities";
import type {
  ListPlan,
  RecommendedDoc,
  RecommendedTask,
  WorkspaceContext,
} from "@/lib/setup/types";

export interface ListTasksPayload {
  type: "list_tasks";
  context: WorkspaceContext;
  spaceName: string;
  spacePurpose?: string;
  listPlan: ListPlan;
  availableTags: string[];
}

export interface DocContentPayload {
  type: "doc_content";
  context: WorkspaceContext;
  docPlan: RecommendedDoc;
}

export interface ListViewsPayload {
  type: "list_views";
  planTier: string;
}

export type JobPayload = ListTasksPayload | DocContentPayload | ListViewsPayload;

export interface JobOutcome {
  ok: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}

/** Run a single job. Returns a JobOutcome rather than throwing. */
export async function runJob(
  jobType: string,
  targetClickupId: string,
  payload: JobPayload,
  workspaceId: string,
): Promise<JobOutcome> {
  const client = new ClickUpClient(workspaceId);

  try {
    switch (jobType) {
      case "list_tasks":
        return await runListTasksJob(client, targetClickupId, payload as ListTasksPayload);
      case "doc_content":
        return await runDocContentJob(client, targetClickupId, payload as DocContentPayload, workspaceId);
      case "list_views":
        return await runListViewsJob(client, targetClickupId, payload as ListViewsPayload);
      default:
        return { ok: false, errorMessage: `Unknown job type: ${jobType}` };
    }
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// list_tasks: Haiku -> tasks + checklists + deps on one ClickUp list
// ---------------------------------------------------------------------------

async function runListTasksJob(
  client: ClickUpClient,
  listId: string,
  payload: ListTasksPayload,
): Promise<JobOutcome> {
  const { context, spaceName, spacePurpose, listPlan, availableTags } = payload;

  // Best-effort knowledge base snippet (never blocks).
  const referenceSnippet = await findReferenceSnippet(
    [spaceName, listPlan.name, listPlan.purpose ?? "", listPlan.description ?? ""]
      .filter((s) => s.length > 0)
      .join(" "),
  ).catch(() => "");

  let tasks: RecommendedTask[];
  try {
    tasks = await generateTasksForList({
      context,
      spaceName,
      spacePurpose,
      listName: listPlan.name,
      listDescription: listPlan.description,
      listPurpose: listPlan.purpose,
      taskExamples: listPlan.taskExamples,
      availableTags,
      referenceSnippet,
    });
  } catch (err) {
    return {
      ok: false,
      errorMessage: `AI task generation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (tasks.length === 0) {
    return { ok: true, result: { tasksCreated: 0, note: "Haiku returned no tasks" } };
  }

  // Create all tasks in parallel. ClickUp's per-list rate is generous and the
  // operations are independent. We wire dependencies after all tasks return
  // so dependsOnIndex pointers always resolve to a real created task.
  const taskCreations = await Promise.all(
    tasks.map(async (task) => {
      try {
        const created = await client.createTask(listId, {
          name: task.name,
          ...(task.description ? { description: task.description } : {}),
          ...(task.priority ? { priority: task.priority } : {}),
          ...(task.tags && task.tags.length > 0 ? { tags: task.tags } : {}),
        });
        return { ok: true as const, id: created.id, task };
      } catch (err) {
        return {
          ok: false as const,
          id: null,
          task,
          err: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // Checklists in parallel across tasks AND in parallel across items within a
  // task. ClickUp handles this fine and it cuts the per-list wall time hard.
  await Promise.all(
    taskCreations.map(async (tc) => {
      if (!tc.ok || !tc.id) return;
      const checklist = tc.task.checklist;
      if (!checklist || checklist.length === 0) return;
      try {
        const cl = await client.createChecklist(tc.id, "Steps");
        await Promise.all(
          checklist.map((item) =>
            client.createChecklistItem(cl.id, item).catch(() => undefined),
          ),
        );
      } catch {
        // Checklist creation is best-effort.
      }
    }),
  );

  // Wire dependencies after all tasks exist.
  await Promise.all(
    tasks.map(async (task, i) => {
      if (typeof task.dependsOnIndex !== "number") return;
      const dependent = taskCreations[i];
      const blocker = taskCreations[task.dependsOnIndex];
      if (!dependent?.ok || !blocker?.ok) return;
      if (!dependent.id || !blocker.id || dependent.id === blocker.id) return;
      try {
        await client.addDependency(dependent.id, blocker.id);
      } catch {
        // Best-effort.
      }
    }),
  );

  const createdCount = taskCreations.filter((tc) => tc.ok).length;
  const failedCount = taskCreations.length - createdCount;

  // Treat partial success as success: it's better to mark the job done with
  // 5/6 tasks than to fail it and re-run from scratch (which would create
  // duplicates of the 5 that already succeeded).
  return {
    ok: true,
    result: {
      tasksRequested: tasks.length,
      tasksCreated: createdCount,
      tasksFailed: failedCount,
    },
  };
}

// ---------------------------------------------------------------------------
// doc_content: Haiku -> markdown -> ClickUp doc page
// ---------------------------------------------------------------------------

async function runDocContentJob(
  client: ClickUpClient,
  docId: string,
  payload: DocContentPayload,
  workspaceId: string,
): Promise<JobOutcome> {
  const { context, docPlan } = payload;

  const referenceSnippet = await findReferenceSnippet(
    [docPlan.name, docPlan.description ?? "", (docPlan.outline ?? []).join(" ")]
      .filter((s) => s.length > 0)
      .join(" "),
  ).catch(() => "");

  let content: string;
  try {
    content = await generateDocContent({
      context,
      docName: docPlan.name,
      purpose: docPlan.description,
      audience: docPlan.audience,
      outline: docPlan.outline,
      referenceSnippet,
    });
  } catch (err) {
    return {
      ok: false,
      errorMessage: `AI doc generation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let teamId: string;
  try {
    teamId = await getClickUpTeamId(workspaceId);
  } catch (err) {
    return {
      ok: false,
      errorMessage: `Could not resolve ClickUp team id: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Prefer PUT into the doc's default page so the content shows up as the
  // doc's body. Fall back to POSTing a new page if the doc has none.
  try {
    const pages = await client.getDocPages(teamId, docId);
    const defaultPageId = pages[0]?.id;

    if (defaultPageId) {
      await client.updateDocPage(teamId, docId, defaultPageId, {
        name: docPlan.name,
        content,
      });
    } else {
      await client.createDocPage(teamId, docId, docPlan.name, content);
    }
  } catch (err) {
    return {
      ok: false,
      errorMessage: `ClickUp doc write failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true, result: { contentLength: content.length } };
}

// ---------------------------------------------------------------------------
// list_views: per-tier default views per newly-created list
// ---------------------------------------------------------------------------

async function runListViewsJob(
  client: ClickUpClient,
  listId: string,
  payload: ListViewsPayload,
): Promise<JobOutcome> {
  // ClickUp creates a default "List view" automatically, so skip recreating it.
  const viewTypes = getDefaultListViews(payload.planTier).filter((t) => t !== "list");

  let createdCount = 0;
  let failedCount = 0;

  await Promise.all(
    viewTypes.map(async (viewType) => {
      try {
        await client.createListView(listId, viewLabelFor(viewType), viewType);
        createdCount++;
      } catch {
        failedCount++;
      }
    }),
  );

  return {
    ok: true,
    result: { viewsCreated: createdCount, viewsFailed: failedCount },
  };
}

function viewLabelFor(type: string): string {
  const labels: Record<string, string> = {
    board: "Board",
    calendar: "Calendar",
    gantt: "Gantt",
    timeline: "Timeline",
    workload: "Workload",
    activity: "Activity",
    table: "Table",
    map: "Map",
    mind_map: "Mind Map",
    form: "Form",
  };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
