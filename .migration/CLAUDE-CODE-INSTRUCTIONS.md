# Instructions for Claude Code

You are migrating Binee from a monolithic AI pipeline to a master agent + sub-agent architecture. Everything you need is in this `.migration/` directory.

## Files in this directory

- `IMPLEMENTATION-SPEC.md` — The complete migration spec with 11 phases. Read this FIRST and follow it exactly.
- `prompts/master-agent.md` — The master agent system prompt. Copy this content into `src/lib/ai/prompts/master-agent.ts` as a string constant.
- `prompts/task-manager.md` — Task Manager sub-agent prompt. Goes into `src/lib/ai/prompts/sub-agents.ts`.
- `prompts/workspace-analyst.md` — Workspace Analyst sub-agent prompt. Goes into `src/lib/ai/prompts/sub-agents.ts`.
- `prompts/setupper.md` — Setupper sub-agent prompt. Goes into `src/lib/ai/prompts/sub-agents.ts`.
- `prompts/dashboard-builder.md` — Dashboard Builder sub-agent prompt. Goes into `src/lib/ai/prompts/sub-agents.ts`.

## What to do

1. Read `IMPLEMENTATION-SPEC.md` in full before writing any code.
2. Execute all 11 phases in the order specified.
3. After each phase, verify no TypeScript errors are introduced (`npx tsc --noEmit`).
4. After all phases, run `npm run build` and fix any errors.
5. Do NOT modify any files listed in the "DO NOT TOUCH" section of the spec.
6. When deleting files, verify no other files import from them first. Fix imports before deleting.
7. The prompt .md files should be embedded as template literal strings in their respective .ts files.

## Critical rules

- **Never break the ClickUp API integration.** The tool-executor.ts, confirmation.ts, and all ClickUp sync files must not be modified.
- **Never break billing.** The billing.ts and all Stripe files must not be modified.
- **Never break the dashboard widgets.** All widget components stay as-is.
- **The master agent ALWAYS uses Sonnet (claude-sonnet-4-6).** There is no more Haiku/Sonnet routing.
- **Sub-agents are Anthropic tools** the master calls, not separate API endpoints.
- **The existing BINEE_TOOLS tool definitions** (the input_schema for each ClickUp tool like lookup_tasks, create_task, etc.) must be preserved — they're used by the sub-agent executor to pass to sub-agents. Move them into a CLICKUP_TOOL_REGISTRY or similar, so both DIRECT_TOOLS and the sub-agent executor can reference them.
- **Search the entire codebase for `TaskType`** before removing it. Update or remove all references.
- **Search for all imports from deleted files** and fix them before the delete.

## After completion

- Run `npm run build` — must pass with zero errors
- Run `npm run lint` if available — fix any issues
- Delete the `.migration/` directory (it was only for the migration)
- Commit all changes with a clear commit message
