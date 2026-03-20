'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Workspace, WorkspaceMember } from '@/types/database';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  membership: WorkspaceMember | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspace: () => Promise<void>;
  updateUser: (data: { display_name?: string; avatar_url?: string | null }) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function mapSupabaseUser(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    display_name:
      supabaseUser.user_metadata?.display_name ??
      supabaseUser.user_metadata?.full_name ??
      supabaseUser.email?.split('@')[0] ??
      'User',
    avatar_url: supabaseUser.user_metadata?.avatar_url ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();

  // Guard: ensure-owner is called at most once per session, only marked
  // as done when it actually succeeds (HTTP 2xx).
  const ensureOwnerDone = useRef(false);
  const ensureOwnerInFlight = useRef<Promise<boolean> | null>(null);

  /**
   * Calls /api/workspace/ensure-owner exactly once per AuthProvider lifetime.
   * Passes the access token as a Bearer header so the API works immediately
   * after signup (before cookies propagate).
   * Returns true if the call succeeded, false otherwise.
   * Concurrent callers share the same in-flight promise.
   */
  const callEnsureOwnerOnce = useCallback(async (): Promise<boolean> => {
    if (ensureOwnerDone.current) return true;

    // If already in-flight, wait for that same request
    if (ensureOwnerInFlight.current) {
      return ensureOwnerInFlight.current;
    }

    const promise = (async () => {
      try {
        // Get the current access token to send as Bearer header
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/workspace/ensure-owner', {
          method: 'POST',
          headers,
        });
        if (res.ok) {
          ensureOwnerDone.current = true;
          return true;
        }
        // Log server errors so we can debug
        const body = await res.text().catch(() => '');
        console.error('ensure-owner failed:', res.status, body);
        return false;
      } catch (err) {
        console.error('ensure-owner network error:', err);
        return false;
      } finally {
        ensureOwnerInFlight.current = null;
      }
    })();

    ensureOwnerInFlight.current = promise;
    return promise;
  }, [supabase]);

  const loadWorkspaces = useCallback(async (userId: string): Promise<Workspace[]> => {
    // Try with status filter first; if the column doesn't exist, retry without it
    let memberRows: { workspace_id: string; role: string; email: string; display_name: string | null; avatar_url: string | null; status?: string }[] | null = null;

    const firstAttempt = await supabase
      .from('workspace_members')
      .select('workspace_id, role, email, display_name, avatar_url, status')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    if (firstAttempt.error && firstAttempt.error.message.includes('status')) {
      console.warn('loadWorkspaces: status column missing, retrying without filter');
      const fallback = await supabase
        .from('workspace_members')
        .select('workspace_id, role, email, display_name, avatar_url')
        .eq('user_id', userId);
      memberRows = fallback.data;
      if (fallback.error) {
        console.error('loadWorkspaces: fallback query failed', fallback.error.message);
      }
    } else {
      memberRows = firstAttempt.data;
      if (firstAttempt.error) {
        console.error('loadWorkspaces: failed to query workspace_members', firstAttempt.error.message);
      }
    }

    if (!memberRows || memberRows.length === 0) {
      setWorkspaces([]);
      setWorkspace(null);
      setMembership(null);
      return [];
    }

    const workspaceIds = memberRows.map((m) => m.workspace_id);

    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds);

    const fetchedWorkspaces = (ws as Workspace[]) ?? [];
    setWorkspaces(fetchedWorkspaces);

    // Select the first workspace or persist the last selected one
    const storedWsId = typeof window !== 'undefined'
      ? localStorage.getItem('binee_active_workspace')
      : null;
    const activeWs = fetchedWorkspaces.find((w) => w.id === storedWsId) ?? fetchedWorkspaces[0] ?? null;
    setWorkspace(activeWs);

    if (activeWs) {
      const memberRow = memberRows.find((m) => m.workspace_id === activeWs.id);
      if (memberRow) {
        setMembership({
          id: '',
          workspace_id: activeWs.id,
          user_id: userId,
          role: memberRow.role as 'owner' | 'admin' | 'member',
          email: memberRow.email,
          display_name: memberRow.display_name,
          avatar_url: memberRow.avatar_url,
          invited_email: null,
          status: 'active',
          joined_at: null,
          created_at: '',
          updated_at: '',
        });
      }
    }

    return fetchedWorkspaces;
  }, [supabase]);

  const refreshWorkspace = useCallback(async () => {
    if (!user || !workspace) return;
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace.id)
      .single();
    if (ws) {
      setWorkspace(ws as Workspace);
      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? (ws as Workspace) : w)));
    }
  }, [user, workspace, supabase]);

  /**
   * Client-side fallback: create workspace directly when ensure-owner API fails.
   * This works because RLS allows owner_id = auth.uid() for workspace INSERT
   * and the "Owners can insert own member row" policy allows the member INSERT.
   */
  const createWorkspaceClientSide = useCallback(async (userId: string, email: string, displayName: string): Promise<boolean> => {
    console.log('createWorkspaceClientSide: attempting client-side workspace creation');
    const slug = (displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-workspace') + '-' + Date.now().toString(36);

    const { data: newWs, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        name: `${displayName}'s Workspace`,
        slug,
        owner_id: userId,
        plan: 'free',
        credit_balance: 10,
      })
      .select()
      .single();

    if (wsErr || !newWs) {
      console.error('createWorkspaceClientSide: workspace insert failed', wsErr?.message);
      return false;
    }

    let memberErr = (await supabase
      .from('workspace_members')
      .insert({
        workspace_id: newWs.id,
        user_id: userId,
        role: 'owner',
        email,
        display_name: displayName,
        invited_email: email,
        status: 'active',
        joined_at: new Date().toISOString(),
      })).error;

    // Retry with minimal columns if some don't exist yet
    if (memberErr && (memberErr.message.includes('status') || memberErr.message.includes('invited_email') || memberErr.message.includes('joined_at'))) {
      console.warn('createWorkspaceClientSide: retrying member insert with minimal columns');
      memberErr = (await supabase
        .from('workspace_members')
        .insert({
          workspace_id: newWs.id,
          user_id: userId,
          role: 'owner',
          email,
          display_name: displayName,
        })).error;
    }

    if (memberErr) {
      console.error('createWorkspaceClientSide: member insert failed', memberErr.message);
      // Clean up orphan
      await supabase.from('workspaces').delete().eq('id', newWs.id);
      return false;
    }

    // Credit transaction (best-effort)
    await supabase.from('credit_transactions').insert({
      workspace_id: newWs.id,
      user_id: userId,
      amount: 10,
      balance_after: 10,
      type: 'bonus',
      description: 'Welcome to Binee! 10 free credits.',
    });

    console.log('createWorkspaceClientSide: success');
    return true;
  }, [supabase]);

  /**
   * Shared helper: run ensure-owner, then load workspaces.
   * If the first loadWorkspaces finds nothing (e.g. race with DB trigger),
   * waits briefly and retries once. As a last resort, tries client-side creation.
   */
  const ensureAndLoad = useCallback(async (userId: string): Promise<Workspace[]> => {
    const ensureOk = await callEnsureOwnerOnce();
    console.log('ensureAndLoad: ensure-owner result =', ensureOk);

    let loaded = await loadWorkspaces(userId);
    console.log('ensureAndLoad: first loadWorkspaces found', loaded.length, 'workspaces');

    // If still empty, the DB trigger or ensure-owner may not have committed yet.
    // Brief wait + one retry.
    if (loaded.length === 0) {
      await new Promise((r) => setTimeout(r, 800));
      loaded = await loadWorkspaces(userId);
      console.log('ensureAndLoad: retry loadWorkspaces found', loaded.length, 'workspaces');
    }

    // Last resort: try client-side creation regardless of ensure-owner result.
    // The ensure-owner API may have succeeded (200) but the DB trigger may not
    // have created anything (e.g. trigger doesn't exist), or the ensure-owner
    // found existing member rows for a different workspace.
    if (loaded.length === 0) {
      console.log('ensureAndLoad: no workspaces found, attempting client-side creation');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const name =
          currentUser.user_metadata?.display_name ??
          currentUser.user_metadata?.full_name ??
          currentUser.email?.split('@')[0] ??
          'User';
        const created = await createWorkspaceClientSide(userId, currentUser.email ?? '', name);
        console.log('ensureAndLoad: client-side creation result =', created);
        if (created) {
          loaded = await loadWorkspaces(userId);
          console.log('ensureAndLoad: after client-side creation, found', loaded.length, 'workspaces');
        }
      }
    }

    return loaded;
  }, [callEnsureOwnerOnce, loadWorkspaces, createWorkspaceClientSide, supabase]);

  // Flag to prevent onAuthStateChange from duplicating signUp/signIn work
  const manualAuthInProgress = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          const mappedUser = mapSupabaseUser(session.user);
          setUser(mappedUser);
          await ensureAndLoad(session.user.id);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Safety timeout: if auth init takes too long, stop loading anyway
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    initAuth().then(() => clearTimeout(timeout));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            // If signUp/signIn is already handling this, skip to avoid races
            if (manualAuthInProgress.current) return;

            const mappedUser = mapSupabaseUser(session.user);
            setUser(mappedUser);

            // Auto-accept pending invitations for this user's email
            if (session.user.email) {
              try {
                await fetch('/api/invitations/auto-accept', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    user_id: session.user.id,
                    email: session.user.email,
                  }),
                });
              } catch {
                // Non-critical — don't block sign-in if auto-accept fails
              }
            }

            await ensureAndLoad(session.user.id);
            setLoading(false);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setWorkspace(null);
            setWorkspaces([]);
            setMembership(null);
            setLoading(false);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          setLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [supabase, ensureAndLoad]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    manualAuthInProgress.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        if (error.message === 'Invalid login credentials') {
          return { error: 'NO_ACCOUNT_OR_WRONG_PASSWORD' };
        }
        return { error: error.message };
      }

      if (data.user) {
        const mappedUser = mapSupabaseUser(data.user);
        setUser(mappedUser);
        await ensureAndLoad(data.user.id);
      }

      setLoading(false);
      return {};
    } catch (err) {
      setLoading(false);
      return { error: 'Unable to connect. Please check your network and try again.' };
    } finally {
      manualAuthInProgress.current = false;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    manualAuthInProgress.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
        },
      });

      if (error) {
        setLoading(false);
        return { error: error.message };
      }

      // Detect fake signup: Supabase returns data.user without error even
      // for already-registered emails (security feature to not reveal
      // whether an account exists). Check identities array.
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setLoading(false);
        return { error: 'An account with this email may already exist. Try signing in instead.' };
      }

      // If email confirmation is required, data.session will be null.
      // In that case, inform the user to check their email.
      if (data.user && !data.session) {
        setLoading(false);
        return { error: 'CONFIRM_EMAIL' };
      }

      // Session exists (email confirmation disabled) — set up user + workspace.
      if (data.user && data.session) {
        const mappedUser = mapSupabaseUser(data.user);
        setUser(mappedUser);

        // ensure-owner (server-side, bypasses RLS) creates the workspace
        // and member row if the handle_new_user() trigger didn't fire yet.
        const loaded = await ensureAndLoad(data.user.id);

        if (loaded.length === 0) {
          console.error('signUp: workspace creation failed — no workspaces after ensureAndLoad');
          setLoading(false);
          return { error: 'Account created but workspace setup failed. Please try signing out and back in, or contact support.' };
        }
      }

      setLoading(false);
      return {};
    } catch (err) {
      console.error('signUp: unexpected error', err);
      setLoading(false);
      return { error: 'Unable to connect. Please check your network and try again.' };
    } finally {
      manualAuthInProgress.current = false;
    }
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  const updateUser = async (data: { display_name?: string; avatar_url?: string | null }) => {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) return { error: error.message };
    // Re-fetch session to get updated metadata
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(mapSupabaseUser(session.user));
    }
    return {};
  };

  const signOut = async () => {
    // Clear React state immediately
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setMembership(null);
    setLoading(false);

    // Fire Supabase signOut but don't wait — it may hang or fail
    supabase.auth.signOut().catch(() => {});

    if (typeof window !== 'undefined') {
      localStorage.removeItem('binee_active_workspace');
      // Clear all Supabase auth cookies so the middleware
      // won't redirect back to /chat with a stale session
      document.cookie.split(';').forEach((c) => {
        const name = c.trim().split('=')[0];
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      });
      window.location.href = '/login';
    }
  };

  const switchWorkspace = (workspaceId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws) {
      setWorkspace(ws);
      if (typeof window !== 'undefined') {
        localStorage.setItem('binee_active_workspace', workspaceId);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces,
        membership,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        switchWorkspace,
        refreshWorkspace,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
