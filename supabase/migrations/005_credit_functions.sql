-- Migration 004: Atomic Credit Functions
-- Adds message_id column to credit_transactions,
-- updates deduct_credits with p_message_id parameter,
-- and creates atomic add_credits function.

-- ============================================================
-- Add message_id column to credit_transactions
-- ============================================================
alter table credit_transactions
  add column if not exists message_id uuid default null;

create index if not exists idx_credit_transactions_message
  on credit_transactions(message_id) where message_id is not null;

-- ============================================================
-- Updated deduct_credits: adds p_message_id parameter
-- ============================================================
create or replace function deduct_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_message_id uuid default null,
  p_metadata jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  -- Lock the workspace row to prevent concurrent deductions
  select credit_balance into v_current_balance
  from workspaces
  where id = p_workspace_id
  for update;

  if v_current_balance is null then
    return jsonb_build_object('success', false, 'error', 'Workspace not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_current_balance,
      'required', p_amount
    );
  end if;

  v_new_balance := v_current_balance - p_amount;

  -- Update workspace balance
  update workspaces
  set credit_balance = v_new_balance, updated_at = now()
  where id = p_workspace_id;

  -- Record the transaction
  insert into credit_transactions (workspace_id, user_id, amount, balance_after, type, description, message_id, metadata)
  values (p_workspace_id, p_user_id, -p_amount, v_new_balance, 'deduction', p_description, p_message_id, p_metadata)
  returning id into v_transaction_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_balance,
    'deducted', p_amount
  );
end;
$$;

-- ============================================================
-- Atomic add_credits function
-- ============================================================
create or replace function add_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_description text,
  p_metadata jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  -- Validate type
  if p_type not in ('purchase', 'bonus', 'refund', 'monthly_reset') then
    return jsonb_build_object('success', false, 'error', 'Invalid credit type: ' || p_type);
  end if;

  -- Validate amount
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock the workspace row to prevent concurrent modifications
  select credit_balance into v_current_balance
  from workspaces
  where id = p_workspace_id
  for update;

  if v_current_balance is null then
    return jsonb_build_object('success', false, 'error', 'Workspace not found');
  end if;

  v_new_balance := v_current_balance + p_amount;

  -- Update workspace balance
  update workspaces
  set credit_balance = v_new_balance, updated_at = now()
  where id = p_workspace_id;

  -- Record the transaction
  insert into credit_transactions (workspace_id, user_id, amount, balance_after, type, description, metadata)
  values (p_workspace_id, p_user_id, p_amount, v_new_balance, p_type::text, p_description, p_metadata)
  returning id into v_transaction_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance', v_new_balance,
    'added', p_amount
  );
end;
$$;
