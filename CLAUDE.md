# Binee — Claude Code Project Guide

Binee is a business intelligence and analytics dashboard SaaS application. It aggregates data from CRM, project management, and billing integrations to provide real-time insights, AI-powered suggestions, and decision support.

## Tech Stack

- **Framework:** React 18 + TypeScript 5.8, built with Vite 5 (SWC)
- **Styling:** TailwindCSS 3.4 with CSS variables for theming (dark mode via `class`)
- **UI Components:** shadcn-ui (Radix UI primitives) — components live in `src/components/ui/`
- **Icons:** Lucide React
- **Charts:** Recharts
- **Routing:** React Router DOM 6 (BrowserRouter, nested routes)
- **State:** React Context for app state; TanStack React Query for server state
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase (auth, PostgreSQL, realtime) — currently using mock data
- **Testing:** Vitest + @testing-library/react + jsdom
- **Linting:** ESLint 9 with typescript-eslint + react-hooks + react-refresh plugins

## Quick Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build (vite build)
npm run test       # Run tests (vitest run)
npm run test:watch # Run tests in watch mode
npm run lint       # Run ESLint
```

## Project Structure

```
src/
├── main.tsx                    # Entry point — mounts <App />
├── App.tsx                     # Root: providers + routing
├── index.css                   # Global styles + CSS variables
├── components/
│   ├── ui/                     # shadcn-ui primitives (DO NOT edit manually — use shadcn CLI)
│   ├── Dashboard/              # Main dashboard: tabs, widgets, modals
│   │   ├── Dashboard.tsx       # Dashboard container with tab/widget state
│   │   ├── tabs/               # Tab content (Overview, Revenue, Operations, etc.)
│   │   ├── widgets/            # Individual chart/metric widgets
│   │   └── modals/             # Dashboard modal dialogs
│   ├── layout/                 # AppShell, Sidebar, Header, panels
│   ├── settings/               # Settings page sections
│   ├── integrations/           # Integration-specific components
│   └── shared/                 # Reusable components across features
├── pages/                      # Route-level page components
├── contexts/                   # React Context providers
├── hooks/                      # Custom React hooks
├── types/                      # TypeScript type definitions
│   └── dashboard.ts            # Core domain types
├── data/
│   └── mock/                   # Mock data files (metrics, integrations, etc.)
├── integrations/
│   └── supabase/               # Supabase client + DB types
├── lib/
│   └── utils.ts                # Utility functions (cn helper)
├── styles/                     # Additional style files
└── test/
    └── setup.ts                # Vitest setup (jest-dom, matchMedia mock)
```

## Architecture & Patterns

### Routing
All routes are defined in `App.tsx`. Pages inside `<AppShell />` get the sidebar + header layout. The `/onboarding` route renders without the shell.

### Provider Hierarchy (in App.tsx)
```
ErrorBoundary → QueryClientProvider → ThemeProvider → AppearanceProvider → ProfileProvider → TooltipProvider
```

### State Management
- **AppearanceContext** — UI preferences (density, sidebar behavior, default tab). Persists to localStorage.
- **ProfileContext** — User profile data shared between sidebar and settings.
- **ViewModeContext** — Toggle between "company" and "binee" view modes (inside AppShell).
- **UserContext, IntegrationContext, NotificationContext** — Domain-specific state.

### Component Conventions
- Use **functional components** with arrow function syntax.
- Import the `cn()` utility from `@/lib/utils` for conditional class merging.
- Use the `@/` path alias for all imports (maps to `src/`).
- Use shadcn-ui components from `@/components/ui/` — do not install alternative UI libraries.
- Icons come from `lucide-react`.
- Tailwind classes for styling — no CSS modules or styled-components.

### Adding New shadcn-ui Components
```bash
npx shadcn-ui@latest add <component-name>
```
This generates into `src/components/ui/`. Do not hand-edit these files.

### TypeScript
- `tsconfig.json` has relaxed settings: `noImplicitAny: false`, `strictNullChecks: false`.
- Define shared types in `src/types/`.
- Use interfaces for object shapes; use type aliases for unions/intersections.

### Mock Data
All mock data lives in `src/data/mock/` and is re-exported from `src/data/mockData.ts`. When adding new features, add corresponding mock data here until the Supabase backend is connected.

### Testing
- Test files go in `src/test/` or co-located as `*.test.ts(x)`.
- Setup file: `src/test/setup.ts` (jest-dom matchers, matchMedia polyfill).
- Use `describe`/`it`/`expect` from Vitest.
- Use `@testing-library/react` for component tests.

## Key Routes

| Path | Page | Description |
|---|---|---|
| `/` | Index | Main dashboard with tabbed widgets |
| `/chat` | ChatPage | AI chat interface |
| `/integrations` | IntegrationsPage | Integration management |
| `/integrations/:slug` | IntegrationDetailPage | Single integration detail |
| `/tools/health-scorecard` | HealthScorecardPage | Business health metrics |
| `/tools/price-architect` | PriceArchitectPage | Pricing analysis |
| `/data-mapping` | DataMappingPage | Data source mapping |
| `/data-quality` | DataQualityPage | Integration health monitoring |
| `/rules` | RulesPage | Data validation rules engine |
| `/billing` | BillingPage | Subscription/billing management |
| `/settings/*` | SettingsLayout | Settings sub-routes (profile, security, notifications, appearance, data-privacy) |
| `/onboarding` | OnboardingPage | Multi-step setup wizard (no AppShell) |

## Development Guidelines

### Adding a New Page
1. Create the page component in `src/pages/`.
2. Add its route in `App.tsx` under the `<AppShell />` route (or outside for shell-less pages).
3. Add navigation link in `src/components/layout/Sidebar.tsx`.
4. If the page needs mock data, add it in `src/data/mock/`.

### Adding a New Dashboard Widget
1. Create the widget component in `src/components/Dashboard/widgets/`.
2. Add the widget ID to the `WidgetId` type in `src/types/dashboard.ts`.
3. Register it in `src/components/Dashboard/Dashboard.tsx`.

### Adding a New Context
1. Create the context file in `src/contexts/`.
2. Export from `src/contexts/index.ts`.
3. Add the provider in the hierarchy in `App.tsx`.

### Adding a New Integration
1. Add mock data in `src/data/mock/integrations.ts`.
2. Create integration-specific components in `src/components/integrations/`.

## Known Issues
- ESLint reports a `@typescript-eslint/no-require-imports` error in `tailwind.config.ts` (the `require("tailwindcss-animate")` plugin). This is expected for Tailwind config files.
- Build produces a large JS chunk (>500 kB) — code-splitting with dynamic imports is a future improvement.

## Agent Team Notes

When working as sub-agents on this codebase:
- Always run `npm run build` after making changes to verify nothing is broken.
- Run `npm run test` to verify tests pass.
- Use the `@/` path alias for all imports, never relative paths that go above `src/`.
- Respect the existing provider hierarchy — do not wrap providers out of order.
- New UI should use existing shadcn-ui components and Tailwind classes for consistency.
- Check `src/types/dashboard.ts` and `src/types/index.ts` before creating new types — the type you need may already exist.
