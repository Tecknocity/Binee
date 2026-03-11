# Binee — AI Workspace Intelligence Platform (Core API)

## Stack
- Runtime: Next.js 16 (API Routes only) + TypeScript 5
- Database: Supabase (auth, PostgreSQL, realtime, storage)
- Hosting: Vercel (serverless API routes)
- AI: Anthropic Claude API (Haiku 4.5 + Sonnet 4.6)
- Integration: ClickUp REST API (OAuth 2.1 PKCE)
- Validation: Zod

## Quick Commands
```bash
npm run dev        # Start dev server (Next.js)
npm run build      # Production build
npm run lint       # Run ESLint
```

## Project Structure
```
src/
├── app/
│   ├── api/                    # API route handlers (serverless functions)
│   │   ├── chat/               # POST /api/chat — AI chat endpoint
│   │   ├── clickup/callback/   # GET /api/clickup/callback — OAuth callback
│   │   ├── cron/sync-reconcile/# GET /api/cron/sync-reconcile — Scheduled sync
│   │   └── webhooks/clickup/   # POST /api/webhooks/clickup — Webhook receiver
│   ├── layout.tsx              # Minimal root layout (required by Next.js)
│   └── page.tsx                # Health check landing
├── lib/                        # Core business logic
│   ├── ai/                     # AI router, prompts, tools, context
│   ├── clickup/                # ClickUp API client, OAuth, sync, webhooks
│   ├── supabase/               # Supabase admin + server clients
│   ├── health/                 # Health check engine & metrics
│   ├── credits/                # Credit tracking system
│   ├── setup/                  # Setup planner & execution engine
│   └── utils.ts                # Shared utilities
├── types/                      # TypeScript type definitions
│   ├── database.ts             # Supabase schema types
│   ├── ai.ts                   # AI message & tool types
│   └── clickup.ts              # ClickUp API types
└── styles/                     # (unused)

supabase/
├── migrations/                 # SQL migrations (RLS-enabled)
└── functions/                  # Edge functions (placeholders)
```

## Architecture
This repo is the **core product API**. The frontend lives in a separate repository
and communicates with these API endpoints. OAuth callbacks redirect to `FRONTEND_URL`.

## Key Rules
- All database queries go through Supabase client (`src/lib/supabase/`)
- All AI calls go through `src/lib/ai/` — never call Anthropic directly from routes
- All ClickUp API calls go through `src/lib/clickup/` — centralized client
- Row Level Security (RLS) on every table — workspace_id scoping
- Use `createAdminClient()` for server-side operations that bypass RLS
- Use `createServerClient()` for user-scoped operations respecting RLS
- Use the `@/` path alias for all imports
