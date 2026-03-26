-- Migration 030: SQL RPC functions for server-side aggregation
--
-- Replaces client-side full-table scans with efficient SQL aggregations:
-- 1. compute_workspace_metrics() — replaces JS loop over all cached_tasks
-- 2. get_credit_usage_by_member() — replaces JS GROUP BY over credit_transactions

-- ============================================================================
-- 1. Workspace metrics — aggregated server-side instead of fetching all rows
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_workspace_metrics_rpc(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_7d_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  v_30d_ago TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  v_week_end TIMESTAMPTZ := DATE_TRUNC('day', NOW()) + INTERVAL '7 days';
  v_4w_ago TIMESTAMPTZ := NOW() - INTERVAL '28 days';

  v_total_tasks BIGINT;
  v_active_tasks BIGINT;
  v_overdue_tasks BIGINT;
  v_unassigned_tasks BIGINT;
  v_tasks_due_today BIGINT;
  v_tasks_due_week BIGINT;
  v_completed_7d BIGINT;
  v_completed_30d BIGINT;
  v_created_7d BIGINT;
  v_avg_age_days NUMERIC;
  v_total_members BIGINT;
  v_total_lists BIGINT;
  v_abandoned_lists BIGINT;
  v_time_7d NUMERIC;
  v_time_30d NUMERIC;
  v_closed_4w BIGINT;
  v_velocity_trend TEXT;
BEGIN
  -- Task counts (single pass with conditional aggregation)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status NOT ILIKE '%closed%' AND status NOT ILIKE '%complete%'),
    COUNT(*) FILTER (WHERE status NOT ILIKE '%closed%' AND status NOT ILIKE '%complete%'
                     AND due_date IS NOT NULL AND due_date < v_now),
    COUNT(*) FILTER (WHERE status NOT ILIKE '%closed%' AND status NOT ILIKE '%complete%'
                     AND (assignees IS NULL OR assignees = '[]'::jsonb)),
    COUNT(*) FILTER (WHERE status NOT ILIKE '%closed%' AND status NOT ILIKE '%complete%'
                     AND due_date >= v_today_start AND due_date < v_today_start + INTERVAL '1 day'),
    COUNT(*) FILTER (WHERE status NOT ILIKE '%closed%' AND status NOT ILIKE '%complete%'
                     AND due_date >= v_today_start AND due_date < v_week_end),
    COUNT(*) FILTER (WHERE (status ILIKE '%closed%' OR status ILIKE '%complete%')
                     AND updated_at >= v_7d_ago),
    COUNT(*) FILTER (WHERE (status ILIKE '%closed%' OR status ILIKE '%complete%')
                     AND updated_at >= v_30d_ago),
    COUNT(*) FILTER (WHERE created_at >= v_7d_ago),
    COUNT(*) FILTER (WHERE (status ILIKE '%closed%' OR status ILIKE '%complete%')
                     AND updated_at >= v_4w_ago),
    COALESCE(AVG(EXTRACT(EPOCH FROM (v_now - created_at)) / 86400)
             FILTER (WHERE status NOT ILIKE '%closed%' AND status NOT ILIKE '%complete%'), 0)
  INTO
    v_total_tasks, v_active_tasks, v_overdue_tasks, v_unassigned_tasks,
    v_tasks_due_today, v_tasks_due_week, v_completed_7d, v_completed_30d,
    v_created_7d, v_closed_4w, v_avg_age_days
  FROM cached_tasks
  WHERE workspace_id = p_workspace_id;

  -- Members count
  SELECT COUNT(*) INTO v_total_members
  FROM cached_team_members WHERE workspace_id = p_workspace_id;

  -- Lists
  SELECT COUNT(*), COUNT(*) FILTER (WHERE updated_at < v_30d_ago)
  INTO v_total_lists, v_abandoned_lists
  FROM cached_lists WHERE workspace_id = p_workspace_id;

  -- Time tracking
  SELECT
    COALESCE(SUM(duration) FILTER (WHERE start_time >= v_7d_ago), 0) / 3600000.0,
    COALESCE(SUM(duration) FILTER (WHERE start_time >= v_30d_ago), 0) / 3600000.0
  INTO v_time_7d, v_time_30d
  FROM cached_time_entries WHERE workspace_id = p_workspace_id;

  -- Velocity trend
  IF v_completed_7d > (v_closed_4w::NUMERIC / 4) * 1.15 THEN
    v_velocity_trend := 'improving';
  ELSIF v_completed_7d < (v_closed_4w::NUMERIC / 4) * 0.85 THEN
    v_velocity_trend := 'declining';
  ELSE
    v_velocity_trend := 'stable';
  END IF;

  RETURN jsonb_build_object(
    'totalTasks', v_total_tasks,
    'activeTasks', v_active_tasks,
    'completedTasks7d', v_completed_7d,
    'completedTasks30d', v_completed_30d,
    'overdueTasks', v_overdue_tasks,
    'unassignedTasks', v_unassigned_tasks,
    'tasksDueToday', v_tasks_due_today,
    'tasksDueThisWeek', v_tasks_due_week,
    'avgTaskAgeDays', ROUND(v_avg_age_days::NUMERIC, 1),
    'totalTimeTracked7d', ROUND(v_time_7d::NUMERIC, 2),
    'totalTimeTracked30d', ROUND(v_time_30d::NUMERIC, 2),
    'activeMembers7d', 0,
    'totalMembers', v_total_members,
    'abandonedLists', v_abandoned_lists,
    'totalLists', v_total_lists,
    'tasksCreated7d', v_created_7d,
    'tasksClosed7d', v_completed_7d,
    'velocityTrend', v_velocity_trend
  );
END;
$$;

-- ============================================================================
-- 2. Credit usage by member — aggregated server-side instead of JS loop
-- ============================================================================

CREATE OR REPLACE FUNCTION get_credit_usage_by_member(p_workspace_id UUID)
RETURNS TABLE(user_id UUID, total_credits NUMERIC, transaction_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    ct.user_id,
    SUM(ABS(ct.amount)) AS total_credits,
    COUNT(*) AS transaction_count
  FROM credit_transactions ct
  WHERE ct.workspace_id = p_workspace_id
    AND ct.type = 'deduction'
  GROUP BY ct.user_id;
$$;
