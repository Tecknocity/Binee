# Binee - AI Workspace Intelligence Platform

## Stack
- Frontend: Next.js 16 (App Router) + React 19 + TypeScript 5
- Styling: Tailwind CSS 4 (bare, no component libraries)
- Charts: Recharts
- Backend: Supabase (auth, PostgreSQL, realtime, storage)
- Hosting: Vercel (frontend + API routes)
- AI: Anthropic Claude API (Haiku 4.5 + Sonnet 4.6)
- Integration: ClickUp REST API (OAuth 2.1 PKCE)
- Icons: Lucide React
- Forms: React Hook Form + Zod

## Quick Commands
```bash
npm run dev        # Start dev server (Next.js)
npm run build      # Production build
npm run lint       # Run ESLint
```

## Project Structure
```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/                # API route handlers (serverless functions)
│   ├── (auth)/             # Auth pages (login, signup)
│   ├── (app)/              # Authenticated app pages
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── auth/               # PRD-01: Auth forms, providers
│   ├── chat/               # PRD-04: Chat interface
│   ├── dashboard/          # PRD-05: Dashboards & health
│   ├── layout/             # PRD-01: App shell, sidebar, nav
│   ├── onboarding/         # PRD-06: Setup wizard
│   └── settings/           # PRD-01: Settings pages
├── hooks/                  # Custom React hooks
├── lib/                    # Shared utilities
│   ├── supabase/           # PRD-01: Supabase client & types
│   ├── clickup/            # PRD-02: ClickUp API client
│   ├── ai/                 # PRD-03: AI router, prompts, tools
│   ├── health/             # PRD-05: Health check engine
│   ├── credits/            # PRD-01: Credit tracking
│   └── setup/              # PRD-06: Setup execution
├── types/                  # TypeScript type definitions
└── styles/                 # Additional styles

supabase/
├── migrations/             # SQL migrations
└── functions/              # Edge functions (if needed)
```

## Design System
- Dark theme: deep dark (#0A0A0F base, #12121A cards, #1A1A25 elevated)
- Accent: Binee Purple (#854DF9), hover (#9D6FFA), active (#6B3AD4)
- Cards: #12121A with #2A2A3A borders (no shadows on dark theme)
- Text: #F0F0F5 primary, #A0A0B5 secondary, #6B6B80 muted
- Font: Inter for UI, JetBrains Mono for metrics/code
- Logo: Use BineeLogo component or PNG files from /public/
- Use Tailwind utilities, no custom CSS unless necessary

## Git Safety Rules
- NEVER push to any branch without explicit user permission
- NEVER run git reset, git revert, or any destructive git commands without explicit user permission
- NEVER force push under any circumstances without explicit user permission
- Only commit locally — the user will decide when and where to push

## Copy & Text Rules
- NEVER use em dashes (—) or en dashes (–) in user-facing text (UI labels, messages, placeholders, page titles, aria labels, AI prompts shown to users). Use a hyphen (-), a comma, a period, or rephrase the sentence instead.
- This applies to: JSX text, string literals in components, AI prompt templates, error messages shown to users, page titles, button labels, and accessibility labels.
- Code comments are exempt from this rule.

## Key Rules
- All database queries go through Supabase client, never raw SQL in frontend
- All AI calls go through src/lib/ai/ — never call Anthropic directly from components
- All ClickUp API calls go through src/lib/clickup/ — centralized client
- Row Level Security (RLS) on every table — workspace_id scoping
- Every component must handle loading, error, and empty states
- Use the `@/` path alias for all imports
- Use lucide-react for icons
- No component libraries — bare Tailwind only

## Debugging: Loading / Freeze Issues
When the app gets stuck on "Loading conversation..." or any infinite loading state, check these in order:
1. **Lock deadlocks** — `navigator.locks` (Web Locks API) or any custom mutex/promise-queue can deadlock when a browser tab goes to background and returns. The lock is held by the frozen tab and never released, blocking ALL subsequent Supabase queries. Fix: bypass locks entirely (token refresh is idempotent) or use timeouts.
2. **Missing `.catch()` / `.finally()`** — Any `.then()` chain on a Supabase query without `.catch()` means a network failure leaves `setLoading(false)` unreachable, causing permanent loading spinners. Always use `.finally()` for loading state cleanup.
3. **`getSession()` can hang** — Supabase's `getSession()` internally acquires the auth lock. If the lock is stuck, `getSession()` hangs forever, blocking any code that needs auth headers. Always wrap in try-catch.
4. **Missing timeouts on fetch()** — API calls (`/api/workspace/load`, `/api/workspace/ensure-owner`) without AbortController timeouts can hang the entire auth flow if the server is slow.
5. **Tab visibility** — Add `visibilitychange` listener to force-refresh the auth session when the tab becomes visible again (industry standard pattern).
6. **useEffect early returns** — If a useEffect has `if (!workspace?.id) return` before async work, make sure `setLoading(false)` is still reachable when workspace eventually loads (i.e., the effect re-runs when workspace.id changes).
