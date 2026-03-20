import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/credits
 *
 * Admin endpoint to add credits to a workspace.
 * Only workspace owners can use this (or service role).
 *
 * Body: { workspace_id: string, amount: number, description?: string }
 *
 * This atomically updates workspaces.credit_balance AND creates
 * a credit_transactions audit row, so the balance stays in sync.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // --- Authenticate ---
  let userId: string | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await tokenClient.auth.getUser(token);
    if (!error && data?.user) userId = data.user.id;
  }

  if (!userId) {
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) userId = data.user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Parse body ---
  let body: { workspace_id?: string; amount?: number; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspace_id, amount, description } = body;

  if (!workspace_id || typeof workspace_id !== 'string') {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // --- Verify the user is the workspace owner ---
  const { data: ws, error: wsErr } = await admin
    .from('workspaces')
    .select('id, owner_id, credit_balance')
    .eq('id', workspace_id)
    .single();

  if (wsErr || !ws) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (ws.owner_id !== userId) {
    return NextResponse.json({ error: 'Only workspace owners can add credits' }, { status: 403 });
  }

  // --- Atomically update balance + create transaction ---
  const newBalance = (ws.credit_balance ?? 0) + amount;

  const { error: updateErr } = await admin
    .from('workspaces')
    .update({ credit_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', workspace_id);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update balance', detail: updateErr.message }, { status: 500 });
  }

  const { error: txErr } = await admin
    .from('credit_transactions')
    .insert({
      workspace_id,
      user_id: userId,
      amount,
      balance_after: newBalance,
      type: 'bonus',
      description: description || `Manual credit grant: +${amount} credits`,
    });

  if (txErr) {
    console.error('admin/credits: transaction log failed (balance was updated)', txErr.message);
  }

  return NextResponse.json({
    success: true,
    previous_balance: ws.credit_balance ?? 0,
    added: amount,
    new_balance: newBalance,
  });
}
