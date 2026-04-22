// Silent server-side error logger. Writes to the `error_logs` table via the
// Supabase service role. Used by features whose failures should never surface
// in the UI (e.g. template task/doc enrichment during workspace setup).
//
// This logger NEVER throws. If logging itself fails, it console.errors and
// returns. The calling code should treat logging as a best-effort side effect.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // error_logs is not in the generated schema types yet. Cast to SupabaseClient
  // to get a permissive client that lets us insert arbitrary rows.
  _admin = createClient(url, key, { auth: { persistSession: false } }) as SupabaseClient;
  return _admin;
}

export interface LogErrorInput {
  source: string;
  errorCode: string;
  message: string;
  workspaceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const admin = getAdmin();
    if (!admin) return;
    const row = {
      workspace_id: input.workspaceId ?? null,
      user_id: input.userId ?? null,
      source: input.source,
      error_code: input.errorCode,
      message: input.message.slice(0, 2000),
      metadata: input.metadata ?? {},
    };
    await admin.from('error_logs').insert(row);
  } catch (err) {
    console.error('[errors/log] failed to write error_log entry:', err);
  }
}

export function errorToMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}
