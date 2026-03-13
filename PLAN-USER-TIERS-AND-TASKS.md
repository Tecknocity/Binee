# Upcoming Work Plan — User Tiers, Tasks Section & AI Awareness

## 1. User Tiers & Permissions

### Tier Definitions
- **Admin** — Full access to the entire platform (dashboards, health checks, settings, billing, user permissions, everything).
- **Manager** — Can see everything operational (dashboards, health checks, tasks, chat) but **cannot** access settings like billing information or manage user permissions.
- **Member** — Limited access. Cannot see dashboards, health checks, etc. Primarily uses tasks and chat.

### Permission System
- Admins can manage permissions per user (grant/revoke access to specific features).
- Only admins can see billing information and the user permissions settings page.
- Managers cannot grant permissions to other users.
- Need a permissions management UI in settings (admin-only).

---

## 2. Tasks Section (ClickUp Integration)

### Core Functionality
- New "Tasks" section in the app that pulls all tasks assigned to the logged-in user from ClickUp.
- Simplified view inspired by the ClickUp homepage "My Tasks" layout.
- Group tasks by time buckets: **Past Due**, **Today**, **Tomorrow**, **Next Week** — no specific dates shown, just these categories.
- Each task should have a **hyperlink** that opens the task directly in ClickUp.

### In-App Task Actions
- **Update status** of a task directly from Binee (without going to ClickUp).
- **Mark complete** — simple one-click action.
- Goal: Users (especially busy managers) can manage their day-to-day tasks without ever leaving Binee.

---

## 3. "Work with AI" Side Panel in Tasks

- Add a **"Work with AI"** button at the top of the Tasks section (similar to "Built with AI" on dashboards).
- Clicking it opens a **chat panel on the right side** so the user can see their tasks on the left and interact with the AI on the right.
- Users can issue commands like:
  - "Mark this task complete"
  - "Leave a comment under this task saying ..."
  - "Update the status of task X to Y"
- The AI executes these actions via the ClickUp API so the user never has to leave Binee's tasks page.

---

## 4. Cross-Chat AI Awareness

### The Vision
- Every AI interaction in Binee (dashboard builder, task work, setup wizard, standalone chat) opens as a **separate chat**.
- Ideally, the AI assistant ("Biny") should have **awareness across all chats and interactions** within the system — so context from a dashboard conversation carries over when working on tasks, etc.

### Implementation Considerations
- This requires storing and retrieving chat history across all sessions and surfacing relevant context to the AI.
- **If straightforward**: Implement by feeding summarized/relevant prior chat history into each new conversation's system context.
- **If too complex**: Defer to a later iteration. The core functionality (tiers, tasks, per-section AI chat) works fine without cross-chat awareness — each chat just operates independently.
- Key question to evaluate: token cost and latency of injecting cross-chat context vs. the UX benefit.

---

## Summary of Feasibility Notes

- **User tiers & permissions**: Standard RBAC — fully doable with Supabase RLS + a roles/permissions table.
- **Tasks section**: Doable via ClickUp API (get tasks, update status, mark complete, post comments). The API supports all of this.
- **Work with AI in tasks**: Same pattern as the dashboard "Built with AI" — opens a chat panel scoped to task operations.
- **Cross-chat AI awareness**: Possible but adds complexity (context window management, summarization, storage). Evaluate effort vs. value — can be deferred if needed.
