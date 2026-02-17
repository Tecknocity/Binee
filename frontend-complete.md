# PRD: Binee Command Center — Complete Frontend

> **Status:** Ready for Implementation
> **Created:** 2026-02-16
> **Priority:** P0 (Critical)
> **Repository:** https://github.com/Tecknocity/command-center

## Overview

This PRD defines the complete frontend for Binee (Business Command Center) — an AI-powered business intelligence platform that goes beyond dashboards to provide diagnostic and prescriptive insights. The frontend includes the core dashboard with 7 tabs, supporting pages (Settings, Integrations, Billing, Profile), onboarding flow, AI chat interface, and data mapping system. All pages use placeholder/mock data with no backend wiring required.

## Problem Statement

The current codebase has the 7-tab dashboard built (Overview, Intelligence, Revenue, Operations, Goals, Issues, Suggestions) but is missing critical SaaS infrastructure pages and flows needed for a production-ready application. Without these, the product cannot onboard users, manage integrations, handle billing, or provide a complete user experience.

## Goals

- [ ] Complete all frontend pages and flows needed for a launchable SaaS product
- [ ] Maintain consistent dark theme design system (navy-purple gradients, orange accents)
- [ ] Build all UI with placeholder data — no backend integration required
- [ ] Create a codebase structure that's ready for backend wiring in the next phase
- [ ] Ensure every page is responsive (desktop, tablet, mobile)

## Non-Goals (Out of Scope)

- Backend API development or database setup
- Real OAuth flows or actual API connections
- Payment processing (Stripe integration)
- Email sending or notification delivery
- Landing page / marketing site (separate project)
- Multi-user / team features
- Mobile native app

---

## Application Structure

### Page Map

| Route | Page | Status | Description |
|-------|------|--------|-------------|
| `/` | Dashboard | Existing — Enhance | 7-tab main interface |
| `/settings` | Settings | New | User preferences with sidebar sections |
| `/settings/profile` | Profile Section | New | Name, email, avatar, timezone |
| `/settings/security` | Security Section | New | Password, 2FA placeholder |
| `/settings/notifications` | Notifications Section | New | Email & in-app toggle preferences |
| `/settings/appearance` | Appearance Section | New | Theme, density, default tab |
| `/settings/data-privacy` | Data & Privacy Section | New | Export, delete account |
| `/integrations` | Integrations | New | Connect/manage business tools |
| `/integrations/:tool` | Integration Detail | New | Per-tool settings, mapping, sync history |
| `/billing` | Billing | New | Plan, payment, invoices |
| `/chat` | AI Chat (Full) | New | Full-page conversational AI interface |
| `/onboarding` | Onboarding Wizard | New | First-run setup flow |
| `/404` | Not Found | New | Error page |

### Navigation Structure

**Sidebar (persistent, collapsible):**
- Dashboard (home icon) — links to `/`
- AI Chat (message icon) — links to `/chat`
- Integrations (plug icon) — links to `/integrations`
- Settings (gear icon) — links to `/settings`

**Header (top bar):**
- Left: Binee logo + page title
- Center: (empty or breadcrumb on sub-pages)
- Right: Notification bell (badge count) + User avatar dropdown

**User Avatar Dropdown:**
- User name + email
- Profile link → `/settings/profile`
- Settings link → `/settings`
- Billing link → `/billing`
- Divider
- Sign out (non-functional, just UI)

---

## Page Specifications

### 1. Dashboard (Existing — Enhance)

**Route:** `/`

The dashboard is the core product with 7 tabs. The existing implementation includes Overview, Intelligence, Revenue, Operations, Goals, Issues, and Suggestions. Enhancements needed:

#### 1.1 Overview Tab

Current: Buildable widget dashboard where users add widgets from other tabs.

**Enhance with:**
- Business Health Score — large circular gauge (0-100) at the top, color-coded (red/yellow/green), with a one-sentence AI summary like "Your business is healthy but pipeline coverage needs attention"
- Quick Actions row — 3-4 contextual action cards based on issues detected (e.g., "3 deals stale for 15+ days → Review pipeline", "Churn rate up 2% → Check at-risk customers")
- "Last updated" timestamp showing most recent data sync
- Empty state when no integrations connected: "Connect your first tool to see your business health" with a CTA button linking to `/integrations`

#### 1.2 Intelligence Tab

Current: Ask AI input, predictions, pattern recognition, anomaly detection.

**Enhance with:**
- AI chat preview — last 3 messages from the AI chat, with "Open full chat" link to `/chat`
- Diagnostic Cards — each insight should have: severity level (Critical / Warning / Info), affected metric with actual value, trend direction (↑↓→), source tools that contributed to the insight, suggested action as a one-liner
- "Run Full Analysis" button that shows a loading animation then reveals refreshed insights
- Data confidence indicator — show what % of data sources are connected and synced, nudging to connect more

#### 1.3 Revenue Tab

Current: Revenue metrics, trend chart, pipeline, expenses, deals table.

**Ensure these widgets exist:**
- KPI Cards: MRR, ARR, Revenue Growth %, Average Deal Size, Customer LTV, CAC
- Revenue Trend — area chart (monthly), toggleable between Revenue / Expenses / Profit / Net
- Revenue by Source — pie/donut chart (Subscriptions, Services, One-time, etc.)
- Sales Pipeline — horizontal funnel or bar chart showing deal count and value per stage
- Pipeline Coverage Ratio — single metric with health indicator (3x+ = green, 2-3x = yellow, <2x = red)
- Deal Velocity — average days per stage, with stuck deal alerts
- Top Deals Table — columns: Deal Name, Value, Stage, Days in Stage, Owner, Health Status
- Cohort Revenue — if data exists, show revenue retention by customer cohort month
- Company View / Binee View toggle — shows pipeline in user's actual stages vs. Binee's standardized stages

#### 1.4 Operations Tab

Current: Project health cards, team performance, task trends.

**Ensure these widgets exist:**
- KPI Cards: Active Projects, Team Utilization %, Tasks Completed This Week, Overdue Tasks
- Project Health Grid — cards showing each project with: name, progress bar, budget used vs. total, status indicator (on-track/at-risk/behind), days until deadline
- Team Performance — bar chart comparing team members on tasks completed, hours logged
- Task Flow — line chart: tasks created vs. completed over time (identify if backlog is growing)
- Capacity Utilization — stacked bar per team member showing allocated vs. available hours
- Blocked Items — list of tasks/projects flagged as blocked with reason and duration
- Calendar Density — heatmap or visual showing meeting load vs. focus time from Google Calendar data

#### 1.5 Goals Tab

Current: Goal cards with progress, AI suggestions, create new goal modal.

**Enhance with:**
- Goals Dashboard Summary — 3 mini cards at top: On Track (count, green), At Risk (count, yellow), Behind (count, red)
- Active Goals Grid — each goal card shows: goal name, target metric + value, current progress (% + bar), deadline, contributing data sources, trend sparkline, status badge
- AI-Suggested Goals Section — 3 recommended goals based on business data with "Add Goal" button, each showing: suggested target, reasoning ("Based on your 15% MoM growth, you could reach $50K MRR by Q3"), impact level
- Create Goal Modal — fields: Goal Name, Category (Revenue/Operations/Growth/Custom), Target Metric (dropdown from connected integrations), Target Value, Deadline, Milestones (add multiple), Notify when (on track/at risk/behind)
- Goal Detail Drill-down — clicking a goal expands to show: milestone timeline, contributing metrics breakdown, historical progress chart, AI commentary on trajectory

#### 1.6 Issues Tab

Current: Issues list with severity and status.

**Enhance with:**
- Issues should auto-generate from business data analysis (placeholder: show 5-8 mock issues)
- Each issue card: title, severity (Critical/Warning/Info with color), affected area (Revenue/Operations/Growth), description (2-3 sentences), impacted metrics with values, suggested fix (one-liner), source tools, timestamp detected, status (New/Acknowledged/In Progress/Resolved)
- Filter bar: by severity, by area, by status
- Sort by: severity, date detected, impact
- "Mark as Resolved" and "Acknowledge" buttons on each issue

#### 1.7 Suggestions Tab

Current: Improvement suggestions with categories.

**Enhance with:**
- Suggestions grouped by category: Quick Wins (< 1 hour), This Week, Strategic (longer term)
- Each suggestion card: title, category, description, expected impact ("Could increase close rate by ~5%"), effort level (Low/Medium/High), related issues (link to Issues tab), implementation steps (collapsible, 3-5 steps), "Implement" button (opens detail or links to relevant tool), "Dismiss" button
- Knowledge Base Suggestions — separate section for best practices from Binee's knowledge base (e.g., "Your pipeline has 5 stages with unclear names. Industry best practice suggests 6 clearly defined stages: Lead → Qualified → Meeting → Proposal → Negotiation → Closed")
- Suggestion effectiveness — if a suggestion was implemented, show before/after metric comparison

---

### 2. AI Chat Interface

**Route:** `/chat`

A full-page conversational AI interface for asking questions about business data.

**Layout:**
- Left sidebar (optional, collapsible): conversation history list with timestamps
- Main area: chat messages
- Bottom: input bar

**Chat Features:**
- Message input with send button and "Enter to send" support
- User messages right-aligned (purple bubble)
- AI messages left-aligned (dark card with Binee avatar)
- AI responses should include: natural language text, inline metric citations (e.g., "Your MRR is **$32,450** ↑12%"), mini chart embeds within responses where relevant, source attribution ("Based on Stripe + HubSpot data as of 2 hours ago"), suggested follow-up questions (3 clickable pills below the response)
- Suggested starter questions when chat is empty: "What's my business health score?", "Which deals are at risk?", "How's my cash runway?", "What should I focus on this week?"
- Typing indicator animation when AI is "thinking"
- "Data as of" timestamp on each AI response
- Copy response button
- Thumbs up/down feedback on each response

**Mock Behavior:**
- On any user message, show typing indicator for 2 seconds, then display a pre-written mock response with realistic data and formatting. Include 3-5 different mock responses that cycle.

---

### 3. Settings Page

**Route:** `/settings` (with sub-routes for each section)

**Layout:** Sidebar navigation on the left listing all sections, content area on the right.

#### 3.1 Profile Section (`/settings/profile`)
- Avatar upload area (circular, with camera overlay icon for edit)
- Name field (text input)
- Email field (text input, shows "verified" badge)
- Company name field
- Role/Title field
- Timezone dropdown
- "Save Changes" button (shows success toast on click)

#### 3.2 Security Section (`/settings/security`)
- Current password field
- New password field
- Confirm new password field
- Password requirements checklist (8+ chars, uppercase, lowercase, special char) — show green checks as met
- "Change Password" button
- Two-Factor Authentication section — toggle switch labeled "Coming Soon" (disabled)
- Active Sessions list — show current session with device/browser info and "Sign out all other sessions" button

#### 3.3 Notifications Section (`/settings/notifications`)
- **Email Notifications** group:
  - Weekly business digest (toggle, default ON)
  - Critical alerts (toggle, default ON)
  - Goal updates (toggle, default ON)
  - Product news & tips (toggle, default OFF)
- **In-App Notifications** group:
  - New issues detected (toggle, default ON)
  - Goal milestone reached (toggle, default ON)
  - Integration sync errors (toggle, default ON)
  - AI suggestions (toggle, default ON)
- **Notification Schedule:**
  - "Do not disturb" time range picker (e.g., 10pm - 8am)

#### 3.4 Appearance Section (`/settings/appearance`)
- Theme selector — visual cards for Dark (default, selected) and Light, with a preview thumbnail
- Dashboard Density — radio: Comfortable (default) / Compact
- Default Landing Tab — dropdown: Overview, Intelligence, Revenue, Operations, Goals
- Sidebar Behavior — radio: Expanded (default) / Collapsed / Auto-hide

#### 3.5 Data & Privacy Section (`/settings/data-privacy`)
- "Export My Data" button — on click, show modal: "We'll prepare your data export and email you a download link within 24 hours." with Confirm/Cancel
- "Delete Account" button (red, outlined) — on click, show confirmation modal: "This will permanently delete your account and all associated data. This cannot be undone." with text input "Type DELETE to confirm" and Delete/Cancel buttons
- Data Retention info — text explaining: "Binee retains your synced business data for as long as your account is active. Data from disconnected integrations is deleted within 30 days."

---

### 4. Integrations Page

**Route:** `/integrations`

**Header:** "Integrations" title + "Connect a Tool" button

**Integration Cards Grid (3 columns on desktop, 2 tablet, 1 mobile):**

Each integration card:
- Tool icon/logo (use Lucide icons or simple colored circles with tool initials as placeholder)
- Tool name
- Brief description (one line, e.g., "CRM, deals, and pipeline data")
- Connection status badge: Connected (green) / Not Connected (gray)
- If connected: Last synced timestamp, data points synced count, "Manage" dropdown (Sync Now, Settings, Disconnect)
- If not connected: "Connect" button

**Tools to display (organized by category):**

**CRM & Sales:**
- HubSpot — "CRM, deals, pipeline, and contacts"
- Salesforce — "Coming Soon" badge (disabled)

**Finance & Payments:**
- Stripe — "Subscriptions, payments, and revenue"
- QuickBooks — "Accounting, expenses, and invoices"

**Project Management:**
- ClickUp — "Tasks, projects, and team workload"
- Asana — "Coming Soon" badge
- Notion — "Documents, databases, and wikis"

**Communication:**
- Gmail — "Email activity and response times"
- Slack — "Team communication and channels"
- Google Calendar — "Meetings, availability, and focus time"

**Connect Flow (mock):**
When user clicks "Connect" on any tool:
1. Modal opens: "Connect to [Tool Name]"
2. Shows: tool icon, brief description of what data Binee will access, permissions list (read-only for V1)
3. "Connect with [Tool]" button — on click, show loading spinner for 2 seconds, then switch card to "Connected" state with mock data
4. After connection: trigger Data Mapping popup (see section 6)

**Integration Detail Page (`/integrations/:tool`):**
When user clicks "Settings" from the Manage dropdown:
- Tool name + logo
- Connection status
- Connected account info (e.g., "tecknocity.com — HubSpot CRM")
- Sync Settings: frequency dropdown (Every 15 min / 30 min / 1 hour / 6 hours / Daily)
- Data Mapping section — link to data mapping interface (see section 6)
- Sync History — table: Date, Status (Success/Partial/Failed), Records Synced, Duration
- "Disconnect" button (red, with confirmation modal)

---

### 5. Billing Page

**Route:** `/billing`

#### Current Plan Card
- Plan badge: "Pro Plan" (or whatever is active)
- Price: "$49/month" with "billed monthly" subtitle
- Renewal date: "Next billing: March 16, 2026"
- "Change Plan" button
- "Cancel Subscription" link (smaller, gray text)

#### Plan Comparison (shown when "Change Plan" clicked)
- 3 columns: Free / Pro / Enterprise
- **Free:** $0/month — 2 integrations, basic dashboards, 7-day data history, community support
- **Pro:** $49/month — 10 integrations, AI intelligence, unlimited history, email support, goals & suggestions
- **Enterprise:** Custom — unlimited integrations, custom playbooks, dedicated support, API access, team features
- Current plan highlighted, others show "Upgrade" or "Downgrade" button

#### Usage Section
- Integrations: progress bar (e.g., "3 of 10 connected")
- Data syncs this month: count with limit
- AI queries this month: count with limit (if applicable)

#### Payment Method
- Card icon + "Visa ending in 4242"
- "Update payment method" button

#### Billing History
- Table: Date, Description, Amount, Status (Paid/Pending/Failed), Download Invoice link
- Show 5 mock invoices

---

### 6. Data Mapping Interface

**Accessed from:** Integration connection flow (post-connect popup) and Integration detail page

This is a key differentiator — the mapping system that lets users map their tool's stages/statuses to Binee's standardized framework while preserving their original structure.

**Mapping Popup (post-connection):**
- Title: "Map your [Tool Name] data to Binee"
- Subtitle: "This helps us provide better insights. You can skip this and do it later."
- Show two columns: "Your [Tool] Stages" (left) and "Binee Standard Stages" (right)
- Drag-and-drop or dropdown mapping — each of their stages maps to one Binee stage
- Multiple-to-one mapping supported (e.g., their "Send Contract" + "Meeting Booked" + "Collect Payment" → Binee's "Negotiation")
- Unmapped stages shown in gray with "Assign" button
- "Skip for now" link at bottom
- "Save Mapping" button

**Binee Standard Stages (for Sales Pipeline):**
- Lead
- Qualified
- Meeting
- Proposal
- Negotiation
- Closed Won
- Closed Lost

**Binee Standard Stages (for Projects):**
- Not Started
- In Progress
- Review
- Completed
- On Hold

**Mapping Detail Page (from integration settings):**
- Full-page version of the mapping interface
- Editable — user can change mappings at any time
- Shows mapping completeness percentage
- "Reset to Default" button
- View mode toggle: "Their View" / "Binee View" — preview how data will look in each mode

---

### 7. Onboarding Wizard

**Route:** `/onboarding`

Shown on first login (check a `hasCompletedOnboarding` flag). 4-step wizard with progress indicator.

**Step 1: Welcome**
- "Welcome to Binee" heading
- Brief value prop: "Your AI-powered business command center. Let's get you set up in 2 minutes."
- User's name pre-filled from auth
- Company name input
- Industry dropdown (SaaS, E-commerce, Agency, Consulting, Other)
- Company size (Just me, 2-10, 11-50, 50+)
- "Continue" button

**Step 2: Connect Your Tools**
- "Connect your business tools" heading
- "We recommend starting with at least 2 tools for the best insights"
- Show top 6 integration cards (HubSpot, Stripe, QuickBooks, ClickUp, Gmail, Google Calendar)
- Each with "Connect" button (mock flow same as Integrations page)
- Connected count indicator: "2 of 6 connected" with a progress ring
- "Skip for now" link + "Continue" button

**Step 3: Data Mapping (conditional)**
- Only show if tools were connected in Step 2
- Simplified mapping interface for connected tools
- "We'll use smart defaults — you can customize later"
- "Continue" button

**Step 4: Your Dashboard is Ready**
- Celebratory animation/illustration
- "Your command center is set up!" heading
- Quick stats: "Connected 2 tools, syncing 47 metrics"
- 3 suggested first actions: "Explore your business health score", "Ask AI a question", "Set your first goal"
- "Go to Dashboard" button

---

### 8. Error Pages

**404 Page (`/404` or any unmatched route):**
- Large "404" text
- "Page not found" subtitle
- "The page you're looking for doesn't exist or has been moved."
- "Go to Dashboard" button
- "Go back" link

**Error Page (generic):**
- Warning icon
- "Something went wrong" heading
- "We're working on it. Please try again."
- "Try Again" button + "Go to Dashboard" link

---

## Design System

### Colors

| Token | Dark Theme | Light Theme | Usage |
|-------|------------|-------------|-------|
| `bg-primary` | `#0a0b1a` | `#f8f9fc` | Page background |
| `bg-card` | `rgba(26, 21, 53, 0.4)` with gradient | `#ffffff` | Card backgrounds |
| `border-default` | `rgba(139, 92, 246, 0.2)` | `rgba(0, 0, 0, 0.1)` | Card borders |
| `text-primary` | `#ffffff` | `#1a1a2e` | Primary text |
| `text-secondary` | `#94a3b8` | `#64748b` | Secondary text |
| `accent-orange` | `#f97316` | `#f97316` | CTAs, primary actions |
| `accent-purple` | `#8b5cf6` | `#8b5cf6` | Interactive elements, highlights |
| `gradient-primary` | `linear-gradient(135deg, #f97316, #8b5cf6)` | same | Primary buttons, key CTAs |
| `success` | `#10b981` | `#10b981` | Positive metrics, connected states |
| `warning` | `#f59e0b` | `#f59e0b` | At-risk states |
| `danger` | `#ef4444` | `#ef4444` | Critical issues, errors, destructive actions |
| `info` | `#3b82f6` | `#3b82f6` | Informational states |

### Typography

- Font family: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Page title: 1.5rem, weight 600
- Section title: 1.25rem, weight 600
- Card title: 1rem, weight 600
- Body text: 0.95rem, weight 400
- Small/caption: 0.875rem, weight 400
- Metric values: 1.5-2rem, weight 700

### Components

| Component | Description |
|-----------|-------------|
| MetricCard | KPI display with value, label, trend indicator, source icon |
| ChartCard | Wrapper for Recharts visualizations with title and controls |
| IssueCard | Severity-coded card with title, description, metrics, actions |
| SuggestionCard | Categorized suggestion with impact, effort, steps |
| GoalCard | Progress bar, target, deadline, status badge |
| IntegrationCard | Tool icon, name, status, connect/manage actions |
| StatusBadge | Color-coded pill (Connected/Disconnected, Critical/Warning/Info, etc.) |
| Toggle | Styled switch for boolean settings |
| Modal | Centered overlay with backdrop blur, close button, action buttons |
| Toast | Bottom-right notification for success/error/info feedback |
| EmptyState | Centered icon + message + CTA for pages with no data |
| Dropdown | Custom styled select/menu matching dark theme |
| Sidebar | Collapsible navigation with icons and labels |
| DataTable | Sortable, filterable table with pagination |

### Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Desktop | ≥1280px | Full sidebar, 3-column grids, side-by-side charts |
| Tablet | 768-1279px | Collapsed sidebar (icons only), 2-column grids |
| Mobile | <768px | Hidden sidebar (hamburger menu), 1-column, stacked layout |

---

## Technical Requirements

### Data Model

```typescript
// User
interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  company: string;
  role: string;
  timezone: string;
  hasCompletedOnboarding: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

// Integration
interface Integration {
  id: string;
  name: string;
  slug: string; // 'hubspot', 'stripe', etc.
  category: 'crm' | 'finance' | 'project-management' | 'communication';
  description: string;
  isConnected: boolean;
  isComingSoon: boolean;
  lastSyncedAt?: string;
  datapointsSynced?: number;
  syncFrequency?: '15min' | '30min' | '1hour' | '6hours' | 'daily';
  connectedAccount?: string;
  mapping?: DataMapping;
}

// Data Mapping
interface DataMapping {
  integrationId: string;
  mappings: StageMapping[];
  completeness: number; // 0-100
}

interface StageMapping {
  sourceStages: string[]; // User's tool stages (can be multiple)
  bineeStage: string; // Our standard stage
}

// Business Metrics (displayed on dashboard)
interface BusinessMetrics {
  mrr: number;
  mrrGrowth: number;
  arr: number;
  totalRevenue: number;
  expenses: number;
  netProfit: number;
  customerCount: number;
  churnRate: number;
  cac: number;
  ltv: number;
  pipelineCoverage: number;
  cashRunway: number; // months
  averageDealSize: number;
  dealVelocity: number; // days
  activeProjects: number;
  teamUtilization: number;
  tasksCompleted: number;
  overdueTaskCount: number;
}

// Goal
interface Goal {
  id: string;
  name: string;
  category: 'revenue' | 'operations' | 'growth' | 'custom';
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  progress: number; // 0-100
  status: 'on-track' | 'at-risk' | 'behind';
  deadline: string;
  milestones: Milestone[];
  sources: string[]; // integration names contributing data
  createdAt: string;
}

interface Milestone {
  id: string;
  name: string;
  targetDate: string;
  completed: boolean;
}

// Issue (auto-detected)
interface Issue {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  area: 'revenue' | 'operations' | 'growth';
  description: string;
  impactedMetrics: { name: string; value: string; trend: 'up' | 'down' | 'flat' }[];
  suggestedFix: string;
  sources: string[];
  detectedAt: string;
  status: 'new' | 'acknowledged' | 'in-progress' | 'resolved';
}

// Suggestion
interface Suggestion {
  id: string;
  title: string;
  category: 'quick-win' | 'this-week' | 'strategic';
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  relatedIssueIds: string[];
  steps: string[];
  isFromKnowledgeBase: boolean;
}

// AI Chat
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metrics?: InlineMetric[];
  suggestedFollowups?: string[];
  dataAsOf?: string;
  timestamp: string;
}

interface InlineMetric {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  source: string;
}

// Notification
interface AppNotification {
  id: string;
  type: 'issue' | 'goal' | 'sync-error' | 'suggestion' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// Billing
interface BillingInfo {
  plan: 'free' | 'pro' | 'enterprise';
  price: number;
  billingCycle: 'monthly' | 'annual';
  nextBillingDate: string;
  paymentMethod: {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
  invoices: Invoice[];
}

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  downloadUrl: string;
}
```

### UI Components Needed

| Component | Description | Location |
|-----------|-------------|----------|
| AppShell | Main layout with sidebar + header + content | `src/components/layout/AppShell` |
| Sidebar | Collapsible nav with icons/labels | `src/components/layout/Sidebar` |
| Header | Top bar with breadcrumb, notifications, avatar | `src/components/layout/Header` |
| UserDropdown | Avatar menu with profile/settings/billing/logout | `src/components/layout/UserDropdown` |
| NotificationPanel | Dropdown list of notifications from bell icon | `src/components/layout/NotificationPanel` |
| DashboardTabs | Tab navigation for the 7 dashboard tabs | `src/components/dashboard/DashboardTabs` |
| MetricCard | KPI display card | `src/components/shared/MetricCard` |
| ChartCard | Chart wrapper with title/controls | `src/components/shared/ChartCard` |
| HealthGauge | Circular business health score (0-100) | `src/components/dashboard/HealthGauge` |
| IssueCard | Issue display with severity/actions | `src/components/dashboard/IssueCard` |
| SuggestionCard | Suggestion with impact/effort/steps | `src/components/dashboard/SuggestionCard` |
| GoalCard | Goal progress display | `src/components/dashboard/GoalCard` |
| CreateGoalModal | Multi-field goal creation form | `src/components/dashboard/CreateGoalModal` |
| IntegrationCard | Tool connection card | `src/components/integrations/IntegrationCard` |
| ConnectModal | OAuth connection flow (mock) | `src/components/integrations/ConnectModal` |
| DataMappingInterface | Drag-drop stage mapping | `src/components/integrations/DataMappingInterface` |
| ChatInterface | Full conversational AI UI | `src/components/chat/ChatInterface` |
| ChatMessage | Individual message bubble | `src/components/chat/ChatMessage` |
| SettingsSidebar | Settings section navigation | `src/components/settings/SettingsSidebar` |
| OnboardingWizard | Multi-step first-run flow | `src/components/onboarding/OnboardingWizard` |
| PlanCard | Pricing plan display | `src/components/billing/PlanCard` |
| InvoiceTable | Billing history table | `src/components/billing/InvoiceTable` |
| Modal | Reusable modal wrapper | `src/components/shared/Modal` |
| Toast | Notification toast | `src/components/shared/Toast` |
| EmptyState | No-data state with CTA | `src/components/shared/EmptyState` |
| StatusBadge | Color-coded status pill | `src/components/shared/StatusBadge` |
| Toggle | Switch input | `src/components/shared/Toggle` |
| DataTable | Sortable/filterable table | `src/components/shared/DataTable` |

---

## Implementation Notes

### Approach

1. Set up routing and the AppShell layout first (sidebar + header + content area)
2. Migrate existing dashboard into the new layout structure
3. Build Settings, Integrations, Billing pages
4. Build AI Chat full-page interface
5. Build Onboarding Wizard
6. Add Data Mapping interface
7. Enhance existing dashboard tabs with specified widgets
8. Add error pages and empty states
9. Ensure responsive behavior across all pages
10. Polish transitions, hover states, loading states

### Dependencies

- **Existing:** React, Recharts, Lucide React icons
- **Add if not present:** React Router DOM (for page routing), Framer Motion (for onboarding animations and transitions — optional)
- **Mock data:** Create a `src/data/mock/` folder with JSON/TS files for all placeholder data

### File Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── UserDropdown.tsx
│   │   └── NotificationPanel.tsx
│   ├── dashboard/
│   │   ├── DashboardTabs.tsx
│   │   ├── HealthGauge.tsx
│   │   ├── MetricCard.tsx
│   │   ├── ChartCard.tsx
│   │   ├── IssueCard.tsx
│   │   ├── SuggestionCard.tsx
│   │   ├── GoalCard.tsx
│   │   ├── CreateGoalModal.tsx
│   │   └── WidgetToggle.tsx
│   ├── integrations/
│   │   ├── IntegrationCard.tsx
│   │   ├── IntegrationGrid.tsx
│   │   ├── ConnectModal.tsx
│   │   ├── IntegrationDetail.tsx
│   │   └── DataMappingInterface.tsx
│   ├── chat/
│   │   ├── ChatInterface.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ChatInput.tsx
│   │   └── ChatSidebar.tsx
│   ├── settings/
│   │   ├── SettingsLayout.tsx
│   │   ├── ProfileSection.tsx
│   │   ├── SecuritySection.tsx
│   │   ├── NotificationsSection.tsx
│   │   ├── AppearanceSection.tsx
│   │   └── DataPrivacySection.tsx
│   ├── billing/
│   │   ├── CurrentPlan.tsx
│   │   ├── PlanComparison.tsx
│   │   ├── PaymentMethod.tsx
│   │   └── InvoiceTable.tsx
│   ├── onboarding/
│   │   ├── OnboardingWizard.tsx
│   │   ├── WelcomeStep.tsx
│   │   ├── ConnectToolsStep.tsx
│   │   ├── DataMappingStep.tsx
│   │   └── ReadyStep.tsx
│   └── shared/
│       ├── Modal.tsx
│       ├── Toast.tsx
│       ├── EmptyState.tsx
│       ├── StatusBadge.tsx
│       ├── Toggle.tsx
│       ├── DataTable.tsx
│       └── LoadingSpinner.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── ChatPage.tsx
│   ├── IntegrationsPage.tsx
│   ├── IntegrationDetailPage.tsx
│   ├── SettingsPage.tsx
│   ├── BillingPage.tsx
│   ├── OnboardingPage.tsx
│   ├── NotFoundPage.tsx
│   └── ErrorPage.tsx
├── data/
│   └── mock/
│       ├── user.ts
│       ├── integrations.ts
│       ├── metrics.ts
│       ├── goals.ts
│       ├── issues.ts
│       ├── suggestions.ts
│       ├── chatMessages.ts
│       ├── notifications.ts
│       └── billing.ts
├── hooks/
│   ├── useTheme.ts
│   ├── useDashboardWidgets.ts
│   ├── useIntegrations.ts
│   └── useNotifications.ts
├── types/
│   ├── user.ts
│   ├── integration.ts
│   ├── metrics.ts
│   ├── goal.ts
│   ├── issue.ts
│   ├── suggestion.ts
│   ├── chat.ts
│   └── billing.ts
├── contexts/
│   ├── ThemeContext.tsx
│   ├── UserContext.tsx
│   └── IntegrationContext.tsx
└── App.tsx (router setup)
```

---

## Acceptance Criteria

- [ ] All pages render without errors
- [ ] Navigation between all pages works via sidebar and links
- [ ] Dark theme is consistent across all pages
- [ ] Light theme toggle works and is consistent
- [ ] All 7 dashboard tabs display their widgets with mock data
- [ ] Overview tab shows Business Health Score and quick actions
- [ ] Company View / Binee View toggle works on pipeline charts
- [ ] AI Chat interface shows mock conversations with proper formatting
- [ ] Settings page has all 5 sections with functional form controls
- [ ] Integrations page shows all tools with connect/disconnect mock flow
- [ ] Data Mapping interface allows drag-drop or dropdown mapping
- [ ] Billing page shows plan, usage, payment method, and invoice history
- [ ] Plan comparison modal displays Free/Pro/Enterprise tiers
- [ ] Onboarding wizard completes all 4 steps
- [ ] Onboarding flag prevents re-showing after completion
- [ ] 404 page renders for unknown routes
- [ ] All pages are responsive at desktop/tablet/mobile breakpoints
- [ ] Modals (create goal, connect tool, delete account, etc.) open and close properly
- [ ] Toast notifications appear for save/connect/disconnect actions
- [ ] Empty states display when no data/integrations exist
- [ ] Widget toggle system works (add/remove widgets from Overview)
- [ ] Notification bell shows count badge and dropdown panel

---

## Claude Code Instructions

```
Repository: https://github.com/Tecknocity/command-center

When implementing this PRD:

1. Start by examining the existing codebase structure — understand current routing, 
   components, styling approach, and what already exists.

2. Set up the AppShell layout FIRST (sidebar + header + content area) and migrate 
   the existing dashboard into this new structure. Make sure nothing breaks.

3. Add React Router if not present. Set up all routes listed in the Page Map.

4. Build pages in this order:
   a. Settings (all 5 sections)
   b. Integrations (grid + connect modal + detail page)
   c. Billing (plan + usage + payment + invoices)
   d. AI Chat (full-page interface)
   e. Onboarding Wizard (4 steps)
   f. Data Mapping Interface
   g. Error pages (404 + generic)

5. Create all mock data files in src/data/mock/ with realistic business data.

6. Enhance existing dashboard tabs per the specifications — add any missing widgets.

7. Key design rules:
   - Dark theme default: navy-purple gradients (#0a0b1a, #1a1535, #0f172a)
   - Orange (#f97316) for primary CTAs
   - Purple (#8b5cf6) for interactive elements
   - Gradient buttons: linear-gradient(135deg, #f97316, #8b5cf6)
   - Card backgrounds: rgba(26, 21, 53, 0.4) with subtle border
   - All text white/light gray (#ffffff, #94a3b8)
   - Border radius: 12-16px for cards, 8px for buttons/inputs
   - Use Lucide React for all icons

8. Test by: 
   - Navigating every route
   - Clicking every button and toggle
   - Testing responsive layout at 1440px, 1024px, 768px, 375px
   - Verifying modals open/close
   - Checking empty states render when data is removed
```

---

## Open Questions

- [ ] Should the AI chat be a slide-over panel from dashboard (like Intercom) or a full separate page? (Currently spec'd as full page with dashboard preview in Intelligence tab)
- [ ] Exact pricing tiers and limits for Free/Pro/Enterprise — placeholder values used
- [ ] Should there be a "Workspace" concept for future multi-user support, or strictly single-user for now? (Currently single-user)
- [ ] Do we want in-app help tooltips / product tour on first visit to each page?

---

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-16 | Arman / Claude | Initial comprehensive frontend PRD |
