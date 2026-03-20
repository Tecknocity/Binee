-- Migration 007: Add subscription_grant credit type (B-020)
-- Updates add_credits function to accept 'subscription_grant' type
-- for tier-based credit allocation on subscription renewal.

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
  if p_type not in ('purchase', 'bonus', 'refund', 'monthly_reset', 'subscription_grant') then
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
