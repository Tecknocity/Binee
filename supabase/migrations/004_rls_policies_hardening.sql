-- Migration: RLS Policy Hardening (B-002)
-- Fills gaps in existing RLS implementation:
-- 1. Add status column to workspace_members (needed by helper function)
-- 2. Create get_user_workspace_ids() helper function
-- 3. Enable RLS on plan_configurations (the only table without it)
-- 4. Refine credit_transactions: admin sees all, member sees own

-- ============================================================
-- 1. Add status column to workspace_members
-- ============================================================
alter table workspace_members
  add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive', 'suspended'));

-- ============================================================
-- 2. Helper function: get_user_workspace_ids()
-- Returns workspace IDs for the current authenticated user
-- Used by RLS policies for workspace-scoped access control
-- ============================================================
create or replace function get_user_workspace_ids()
returns setof uuid as $$
  select workspace_id
  from workspace_members
  where user_id = auth.uid()
    and status = 'active'
$$ language sql security definer stable;

-- ============================================================
-- 3. Enable RLS on plan_configurations
-- This is a read-only system table, all authenticated users can read
-- ============================================================
alter table plan_configurations enable row level security;

create policy "Authenticated users can view plan configurations"
  on plan_configurations
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- 4. Refine credit_transactions SELECT policy
-- Admin/owner sees all workspace transactions, member sees only own
-- ============================================================
drop policy if exists "Workspace members can view credit transactions" on credit_transactions;

create policy "Admins can view all credit transactions" on credit_transactions
  for select using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'admin')
    )
  );

create policy "Members can view own credit transactions" on credit_transactions
  for select using (
    user_id = auth.uid()
    and workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );
