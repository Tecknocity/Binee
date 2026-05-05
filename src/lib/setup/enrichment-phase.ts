// Phase 7 + 8 of the setup pipeline: post-confirm enrichment.
//
// Runs AFTER the executor has created spaces/folders/lists/tags/docs/goals in
// ClickUp. Uses Haiku 4.5 to generate:
//   1. Starter tasks per successfully-created list
//   2. Rich markdown content per successfully-created doc
//
// Writes results directly to ClickUp. Failures here are SILENT: every error is
// logged to the error_logs table via src/lib/errors/log.ts and the offending
// item is skipped. The user never sees a failure message from this phase -
// enrichment is a nice-to-have, not core functionality.

import { ClickUpClient } from '@/lib/clickup/client';
import { generateTasksForList } from '@/lib/ai/task-generator';
import { generateDocContent } from '@/lib/ai/doc-generator';
import { findReferenceSnippet } from '@/lib/setup/knowledge-base-context';
import { logError, errorToMessage } from '@/lib/errors/log';
import type {
  SetupPlan,
  SpacePlan,
  ListPlan,
  RecommendedDoc,
  RecommendedTask,
} from '@/lib/setup/types';
import type { ExecutionResult, ExecutionItem } from '@/lib/setup/executor';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EnrichmentInput {
  plan: SetupPlan;
  executionResult: ExecutionResult;
  client: ClickUpClient;
  /** Binee Supabase workspace UUID (for error logging + cache writes). */
  workspaceId: string;
  /** ClickUp team_id (required for v3 Docs API URLs). */
  teamId: string;
  userId?: string;
}

export interface EnrichmentResult {
  listsEnriched: number;
  tasksCreated: number;
  docsEnriched: number;
}

// Concurrency caps. Tuned for Anthropic Haiku rate limits and ClickUp write
// throughput. Per-workspace one-shot work, so we don't need to be aggressive.
const AI_CONCURRENCY = 5;
const DOC_WRITE_CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runEnrichmentPhase(
  input: EnrichmentInput,
): Promise<EnrichmentResult> {
  const { plan, executionResult, client, workspaceId, teamId, userId } = input;

  const result: EnrichmentResult = {
    listsEnriched: 0,
    tasksCreated: 0,
    docsEnriched: 0,
  };

  if (!plan.context) {
    await logError({
      source: 'setup.enrichment',
      errorCode: 'missing_context',
      message: 'Plan has no context; skipping enrichment',
      workspaceId,
      userId,
    });
    return result;
  }

  const availableTags = (plan.recommended_tags ?? []).map((t) => t.name);

  // -------------------------------------------------------------------------
  // Phase 7a: tasks per list (AI gen -> ClickUp writes)
  // -------------------------------------------------------------------------
  const listJobs = buildListJobs(plan, executionResult);

  const listOutcomes = await runPool(listJobs, AI_CONCURRENCY, async (job) => {
    try {
      // Best-effort reference snippet from the knowledge base. Never blocks
      // generation - an empty string just means the generator falls back to
      // chat context alone.
      const referenceSnippet = await findReferenceSnippet(
        [job.spaceName, job.listPlan.name, job.listPlan.purpose ?? '', job.listPlan.description ?? '']
          .filter((s) => s.length > 0)
          .join(' '),
      ).catch(() => '');

      const tasks = await generateTasksForList({
        context: plan.context!,
        spaceName: job.spaceName,
        spacePurpose: job.spacePurpose,
        listName: job.listPlan.name,
        listDescription: job.listPlan.description,
        listPurpose: job.listPlan.purpose,
        taskExamples: job.listPlan.taskExamples,
        availableTags,
        referenceSnippet,
      });
      return { job, tasks };
    } catch (err) {
      await logError({
        source: 'setup.enrichment.task_generation',
        errorCode: 'haiku_failed',
        message: errorToMessage(err),
        workspaceId,
        userId,
        metadata: {
          listId: job.listId,
          listName: job.listPlan.name,
          spaceName: job.spaceName,
        },
      });
      return { job, tasks: null };
    }
  });

  // Write tasks sequentially per list (ClickUp rate limits), parallel across
  // lists with a small pool.
  const writeJobs = listOutcomes.filter(
    (o): o is { job: ListJob; tasks: RecommendedTask[] } =>
      o.tasks !== null && o.tasks.length > 0,
  );

  const writeOutcomes = await runPool(writeJobs, DOC_WRITE_CONCURRENCY, async ({ job, tasks }) => {
    let createdCount = 0;
    // Track each task's ClickUp ID by its index in the input array so we can
    // wire dependencies after all tasks are created. null means the task
    // failed to create or was skipped, so any task depending on it will skip
    // its dependency wiring without erroring.
    const createdTaskIds: Array<string | null> = [];

    for (const task of tasks) {
      let createdTaskId: string | null = null;
      try {
        const result = await client.createTask(job.listId, {
          name: task.name,
          ...(task.description ? { description: task.description } : {}),
          ...(task.priority ? { priority: task.priority } : {}),
          ...(task.tags && task.tags.length > 0 ? { tags: task.tags } : {}),
        });
        createdTaskId = result.id;
        createdCount++;
      } catch (err) {
        await logError({
          source: 'setup.enrichment.task_create',
          errorCode: 'clickup_failed',
          message: errorToMessage(err),
          workspaceId,
          userId,
          metadata: {
            listId: job.listId,
            listName: job.listPlan.name,
            taskName: task.name,
          },
        });
      }

      createdTaskIds.push(createdTaskId);

      // Best-effort checklist. A failure to create the checklist or any
      // single item never blocks the rest of the task pipeline.
      if (createdTaskId && task.checklist && task.checklist.length > 0) {
        try {
          const checklist = await client.createChecklist(createdTaskId, 'Steps');
          for (const item of task.checklist) {
            try {
              await client.createChecklistItem(checklist.id, item);
            } catch (itemErr) {
              await logError({
                source: 'setup.enrichment.checklist_item',
                errorCode: 'clickup_failed',
                message: errorToMessage(itemErr),
                workspaceId,
                userId,
                metadata: { taskId: createdTaskId, item },
              });
            }
          }
        } catch (checklistErr) {
          await logError({
            source: 'setup.enrichment.checklist',
            errorCode: 'clickup_failed',
            message: errorToMessage(checklistErr),
            workspaceId,
            userId,
            metadata: { taskId: createdTaskId, taskName: task.name },
          });
        }
      }
    }

    // Wire dependencies once all tasks for this list are written. Skip
    // entries where either side failed to create.
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (typeof task.dependsOnIndex !== 'number') continue;
      const dependentId = createdTaskIds[i];
      const blockerId = createdTaskIds[task.dependsOnIndex];
      if (!dependentId || !blockerId || dependentId === blockerId) continue;
      try {
        await client.addDependency(dependentId, blockerId);
      } catch (depErr) {
        await logError({
          source: 'setup.enrichment.dependency',
          errorCode: 'clickup_failed',
          message: errorToMessage(depErr),
          workspaceId,
          userId,
          metadata: {
            taskId: dependentId,
            dependsOn: blockerId,
            listName: job.listPlan.name,
          },
        });
      }
    }

    return createdCount;
  });

  for (const created of writeOutcomes) {
    if (created > 0) {
      result.listsEnriched++;
      result.tasksCreated += created;
    }
  }

  // -------------------------------------------------------------------------
  // Phase 7b: doc content generation + writes
  // -------------------------------------------------------------------------
  const docJobs = buildDocJobs(plan, executionResult);

  const docOutcomes = await runPool(docJobs, AI_CONCURRENCY, async (job) => {
    try {
      const referenceSnippet = await findReferenceSnippet(
        [job.docPlan.name, job.docPlan.description ?? '', (job.docPlan.outline ?? []).join(' ')]
          .filter((s) => s.length > 0)
          .join(' '),
      ).catch(() => '');

      const content = await generateDocContent({
        context: plan.context!,
        docName: job.docPlan.name,
        purpose: job.docPlan.description,
        audience: job.docPlan.audience,
        outline: job.docPlan.outline,
        referenceSnippet,
      });
      return { job, content };
    } catch (err) {
      await logError({
        source: 'setup.enrichment.doc_generation',
        errorCode: 'haiku_failed',
        message: errorToMessage(err),
        workspaceId,
        userId,
        metadata: { docId: job.docId, docName: job.docPlan.name },
      });
      return { job, content: null };
    }
  });

  const docWriteJobs = docOutcomes.filter(
    (o): o is { job: DocJob; content: string } => o.content !== null,
  );

  await runPool(docWriteJobs, DOC_WRITE_CONCURRENCY, async ({ job, content }) => {
    const contentLength = content.length;
    let pageId: string | null = null;

    try {
      // The executor lets ClickUp auto-create a default first page. We PUT
      // content into that page so the user opens the doc and lands on the
      // generated body. Only fall back to POSTing a fresh page if the GET
      // came back empty (rare; e.g. v2 fallback path or plan limitation).
      let targetPageId: string | undefined;
      try {
        const pages = await client.getDocPages(teamId, job.docId);
        targetPageId = pages[0]?.id;
      } catch {
        // Non-fatal; fall through to create a new page below.
      }

      if (targetPageId) {
        const updated = await client.updateDocPage(
          teamId,
          job.docId,
          targetPageId,
          { name: job.docPlan.name, content },
        );
        pageId = updated?.id ?? targetPageId;
      } else {
        const created = await client.createDocPage(
          teamId,
          job.docId,
          job.docPlan.name,
          content,
        );
        pageId = created?.id ?? null;
      }

      // Verify the page actually got content. v3 has been seen to accept a
      // request and persist nothing (e.g. when content_format trips a
      // server-side parse). Read back and log when we can't find the
      // content - this is the diagnostic that flagged the original bug.
      let verified = false;
      try {
        const pages = await client.getDocPages(teamId, job.docId);
        const match = pageId
          ? pages.find((p) => p.id === pageId)
          : pages.find((p) => p.name === job.docPlan.name);
        const written = match?.content ?? '';
        verified = written.trim().length > 0;
      } catch {
        // Lack of read access should not escalate to an error state.
        verified = true;
      }

      if (!verified) {
        await logError({
          source: 'setup.enrichment.doc_write',
          errorCode: 'content_not_persisted',
          message: 'doc page write returned success but readback shows no content',
          workspaceId,
          userId,
          metadata: {
            docId: job.docId,
            docName: job.docPlan.name,
            pageId: pageId ?? null,
            contentLength,
          },
        });
      }

      result.docsEnriched++;
    } catch (err) {
      await logError({
        source: 'setup.enrichment.doc_write',
        errorCode: 'clickup_failed',
        message: errorToMessage(err),
        workspaceId,
        userId,
        metadata: {
          docId: job.docId,
          docName: job.docPlan.name,
          pageId: pageId ?? null,
          contentLength,
        },
      });
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// Job builders
// ---------------------------------------------------------------------------

interface ListJob {
  listId: string;
  listPlan: ListPlan;
  spaceName: string;
  spacePurpose?: string;
}

function buildListJobs(plan: SetupPlan, exec: ExecutionResult): ListJob[] {
  const successfulLists = exec.items.filter(
    (i): i is ExecutionItem & { clickupId: string } =>
      i.type === 'list' && i.status === 'success' && !!i.clickupId,
  );

  const jobs: ListJob[] = [];

  for (const item of successfulLists) {
    const match = findListInPlan(plan, item.name, item.parentName);
    if (!match) continue;
    jobs.push({
      listId: item.clickupId,
      listPlan: match.list,
      spaceName: match.space.name,
      spacePurpose: match.space.purpose,
    });
  }

  return jobs;
}

function findListInPlan(
  plan: SetupPlan,
  listName: string,
  parentName: string | undefined,
): { list: ListPlan; space: SpacePlan } | null {
  for (const space of plan.spaces) {
    if (space.lists && parentName === space.name) {
      const hit = space.lists.find((l) => l.name === listName);
      if (hit) return { list: hit, space };
    }
    for (const folder of space.folders) {
      if (folder.name === parentName) {
        const hit = folder.lists.find((l) => l.name === listName);
        if (hit) return { list: hit, space };
      }
    }
  }
  return null;
}

interface DocJob {
  docId: string;
  docPlan: RecommendedDoc;
}

function buildDocJobs(plan: SetupPlan, exec: ExecutionResult): DocJob[] {
  if (!plan.recommended_docs?.length) return [];

  const successfulDocs = exec.items.filter(
    (i): i is ExecutionItem & { clickupId: string } =>
      i.type === 'doc' && i.status === 'success' && !!i.clickupId,
  );

  const jobs: DocJob[] = [];
  for (const item of successfulDocs) {
    const match = plan.recommended_docs.find((d) => d.name === item.name);
    if (!match) continue;
    // Only enrich docs that don't already have inline content baked into the
    // plan (legacy plans) - those were already created with their content.
    if (match.content && match.content.trim().length > 0) continue;
    jobs.push({ docId: item.clickupId, docPlan: match });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Concurrency pool (no external deps)
// ---------------------------------------------------------------------------

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, items.length);

  for (let w = 0; w < workerCount; w++) {
    runners.push(
      (async () => {
        while (true) {
          const i = nextIndex++;
          if (i >= items.length) return;
          results[i] = await worker(items[i]);
        }
      })(),
    );
  }

  await Promise.all(runners);
  return results;
}
