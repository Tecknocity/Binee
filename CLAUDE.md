# Binee — AI Workspace Intelligence Platform

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
- Dark theme: navy-purple gradients (#1A1A2E base)
- Accent: orange (#FF6B35)
- Cards: semi-transparent with subtle borders (surface color)
- Text: #F0F0F0 primary, #A0A0B8 secondary, #6B6B80 muted
- Font: Inter or system fonts
- Use Tailwind utilities, no custom CSS unless necessary

## Key Rules
- All database queries go through Supabase client, never raw SQL in frontend
- All AI calls go through src/lib/ai/ — never call Anthropic directly from components
- All ClickUp API calls go through src/lib/clickup/ — centralized client
- Row Level Security (RLS) on every table — workspace_id scoping
- Every component must handle loading, error, and empty states
- Use the `@/` path alias for all imports
- Use lucide-react for icons
- No component libraries — bare Tailwind only
