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
import { logError, errorToMessage } from '@/lib/errors/log';
import type {
  SetupPlan,
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
  workspaceId: string;
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
  const { plan, executionResult, client, workspaceId, userId } = input;

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
      const tasks = await generateTasksForList({
        context: plan.context!,
        spaceName: job.spaceName,
        listName: job.listPlan.name,
        listDescription: job.listPlan.description,
        availableTags,
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
    let created = 0;
    for (const task of tasks) {
      try {
        await client.createTask(job.listId, {
          name: task.name,
          ...(task.description ? { description: task.description } : {}),
          ...(task.priority ? { priority: task.priority } : {}),
          ...(task.tags && task.tags.length > 0 ? { tags: task.tags } : {}),
        });
        created++;
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
    }
    return created;
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
      const content = await generateDocContent({
        context: plan.context!,
        docName: job.docPlan.name,
        purpose: job.docPlan.description,
        audience: job.docPlan.audience,
        outline: job.docPlan.outline,
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
    try {
      await client.createDocPage(job.docId, job.docPlan.name, content);
      result.docsEnriched++;
    } catch (err) {
      await logError({
        source: 'setup.enrichment.doc_write',
        errorCode: 'clickup_failed',
        message: errorToMessage(err),
        workspaceId,
        userId,
        metadata: { docId: job.docId, docName: job.docPlan.name },
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
      spaceName: match.spaceName,
    });
  }

  return jobs;
}

function findListInPlan(
  plan: SetupPlan,
  listName: string,
  parentName: string | undefined,
): { list: ListPlan; spaceName: string } | null {
  for (const space of plan.spaces) {
    if (space.lists && parentName === space.name) {
      const hit = space.lists.find((l) => l.name === listName);
      if (hit) return { list: hit, spaceName: space.name };
    }
    for (const folder of space.folders) {
      if (folder.name === parentName) {
        const hit = folder.lists.find((l) => l.name === listName);
        if (hit) return { list: hit, spaceName: space.name };
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
