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

/**
 * Get the current access token for server API calls.
 */
async function getAuthHeaders(supabase: ReturnType<typeof createBrowserClient>): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();

  // Guard: ensure-owner is called at most once per session
  const ensureOwnerDone = useRef(false);
  const ensureOwnerInFlight = useRef<Promise<boolean> | null>(null);

  // Guard: prevent initAuth and onAuthStateChange from racing
  const initAuthDone = useRef(false);

  /**
   * Calls /api/workspace/ensure-owner exactly once per AuthProvider lifetime.
   * Returns true if the call succeeded, false otherwise.
   */
  const callEnsureOwnerOnce = useCallback(async (): Promise<boolean> => {
    if (ensureOwnerDone.current) return true;

    if (ensureOwnerInFlight.current) {
      return ensureOwnerInFlight.current;
    }

    const promise = (async () => {
      try {
        const headers = await getAuthHeaders(supabase);
        const res = await fetch('/api/workspace/ensure-owner', {
          method: 'POST',
          headers,
        });
        if (res.ok) {
          ensureOwnerDone.current = true;
          return true;
        }
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

  /**
   * Load workspaces via server API (bypasses RLS — always works).
   * This is the reliable path that doesn't depend on RLS policy state.
   */
  const loadWorkspacesViaAPI = useCallback(async (): Promise<{
    workspaces: Workspace[];
    members: { workspace_id: string; role: string; email: string; display_name: string | null; avatar_url: string | null; status?: string }[];
  }> => {
    try {
      const headers = await getAuthHeaders(supabase);
      const res = await fetch('/api/workspace/load', {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        console.error('loadWorkspacesViaAPI: failed', res.status);
        return { workspaces: [], members: [] };
      }
      const data = await res.json();
      return {
        workspaces: (data.workspaces ?? []) as Workspace[],
        members: data.members ?? [],
      };
    } catch (err) {
      console.error('loadWorkspacesViaAPI: network error', err);
      return { workspaces: [], members: [] };
    }
  }, [supabase]);

  /**
   * Apply loaded workspace data to React state.
   * Shared by both the direct query path and the API fallback path.
   */
  const applyWorkspaceData = useCallback((
    userId: string,
    fetchedWorkspaces: Workspace[],
    memberRows: { workspace_id: string; role: string; email: string; display_name: string | null; avatar_url: string | null; status?: string }[],
  ) => {
    setWorkspaces(fetchedWorkspaces);

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
    } else {
      setMembership(null);
    }
  }, []);

  /**
   * Load workspaces: try direct Supabase query first (fast, no API hop),
   * fall back to server API if direct query fails or returns empty.
   *
   * The server API uses the service role key and bypasses RLS entirely,
   * so it works even when RLS policies are misconfigured (e.g. the
   * infinite recursion bug in workspace_members self-referencing policies).
   */
  const loadWorkspaces = useCallback(async (userId: string): Promise<Workspace[]> => {
    // --- Attempt 1: Direct Supabase query (fast path) ---
    const { data: memberRows, error: memberErr } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, email, display_name, avatar_url, status')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    // If the direct query succeeded and returned data, use it
    if (!memberErr && memberRows && memberRows.length > 0) {
      const workspaceIds = memberRows.map((m) => m.workspace_id);
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);

      if (!wsErr && ws && ws.length > 0) {
        const fetchedWorkspaces = ws as Workspace[];
        applyWorkspaceData(userId, fetchedWorkspaces, memberRows);
        return fetchedWorkspaces;
      }
    }

    // --- Attempt 2: Server API fallback (bypasses RLS) ---
    // This handles: RLS infinite recursion, missing columns, policy issues,
    // timing races with trigger, or any other reason the direct query fails.
    if (memberErr) {
      console.warn('loadWorkspaces: direct query failed, falling back to API', memberErr.message);
    } else {
      console.warn('loadWorkspaces: direct query returned empty, falling back to API');
    }

    const apiResult = await loadWorkspacesViaAPI();
    if (apiResult.workspaces.length > 0) {
      applyWorkspaceData(userId, apiResult.workspaces, apiResult.members);
      return apiResult.workspaces;
    }

    // Neither path found workspaces
    setWorkspaces([]);
    setWorkspace(null);
    setMembership(null);
    return [];
  }, [supabase, applyWorkspaceData, loadWorkspacesViaAPI]);

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
   * Shared helper: run ensure-owner, then load workspaces.
   * If workspaces are still empty after loading, tries client-side creation
   * as a last resort.
   */
  const ensureAndLoad = useCallback(async (userId: string): Promise<Workspace[]> => {
    // Step 1: Ensure workspace + member exist server-side (bypasses RLS)
    const ensureOk = await callEnsureOwnerOnce();
    console.log('ensureAndLoad: ensure-owner result =', ensureOk);

    // Step 2: Load workspaces (direct query → API fallback)
    let loaded = await loadWorkspaces(userId);
    console.log('ensureAndLoad: loadWorkspaces found', loaded.length, 'workspaces');

    // Step 3: If still empty after both the ensure-owner write and the
    // API-backed read, something is seriously wrong. Try client-side creation.
    if (loaded.length === 0) {
      console.warn('ensureAndLoad: no workspaces found after API fallback, trying client-side creation');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        // Use the ensure-owner API's service role to create (most reliable)
        // by calling it again with a fresh ref
        ensureOwnerDone.current = false;
        await callEnsureOwnerOnce();

        loaded = await loadWorkspaces(userId);
        console.log('ensureAndLoad: after retry, found', loaded.length, 'workspaces');
      }
    }

    return loaded;
  }, [callEnsureOwnerOnce, loadWorkspaces, supabase]);

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
          initAuthDone.current = true;
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
            // Skip if signUp/signIn is already handling this
            if (manualAuthInProgress.current) return;

            // Skip if initAuth already handled this session
            // (onAuthStateChange fires SIGNED_IN on mount when a session exists)
            if (!initAuthDone.current) return;

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
                // Non-critical
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

      // Detect fake signup
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setLoading(false);
        return { error: 'An account with this email may already exist. Try signing in instead.' };
      }

      // Email confirmation required
      if (data.user && !data.session) {
        setLoading(false);
        return { error: 'CONFIRM_EMAIL' };
      }

      // Session exists — set up user + workspace
      if (data.user && data.session) {
        const mappedUser = mapSupabaseUser(data.user);
        setUser(mappedUser);

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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(mapSupabaseUser(session.user));
    }
    return {};
  };

  const signOut = async () => {
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setMembership(null);
    setLoading(false);

    supabase.auth.signOut().catch(() => {});

    if (typeof window !== 'undefined') {
      localStorage.removeItem('binee_active_workspace');
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
