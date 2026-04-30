'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  /** True while determining if the user has a session. Resolves fast (<200ms). */
  loading: boolean;
  /** True while workspace data is being loaded (after auth is determined). */
  workspaceLoading: boolean;
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
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (err) {
    console.warn('[binee:auth] getAuthHeaders: getSession() failed:', err);
  }
  return {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const queryClient = useQueryClient();

  // Lazy-initialize the Supabase client. During SSR (server-side rendering),
  // typeof window === 'undefined' so we skip creation. The client is only
  // needed in useEffect/callbacks which run on the client.
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  if (!supabaseRef.current && typeof window !== 'undefined') {
    supabaseRef.current = createBrowserClient();
  }
  const supabase = supabaseRef.current!;

  // Guard: ensure-owner is called at most once per browser session.
  // Uses sessionStorage so the guard persists across AuthProvider remounts
  // (e.g. navigating from (auth) to (app) route groups which mount separate
  // AuthProvider instances with fresh refs).
  const ensureOwnerDone = useRef(
    typeof window !== 'undefined' && sessionStorage.getItem('binee_ensure_owner_done') === '1',
  );
  const ensureOwnerInFlight = useRef<Promise<boolean> | null>(null);

  // Guard: prevent initAuth and onAuthStateChange from racing
  const initAuthDone = useRef(false);
  // Guard: prevent concurrent initAuth execution (e.g. rapid remounts)
  const initializingRef = useRef(false);

  /**
   * Calls /api/workspace/ensure-owner exactly once per browser session.
   * The guard persists in sessionStorage so it survives AuthProvider remounts
   * when navigating between route groups (auth → app).
   */
  const callEnsureOwnerOnce = useCallback(async (): Promise<boolean> => {
    if (ensureOwnerDone.current) return true;

    if (ensureOwnerInFlight.current) {
      return ensureOwnerInFlight.current;
    }

    const promise = (async () => {
      try {
        const headers = await getAuthHeaders(supabase);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch('/api/workspace/ensure-owner', {
          method: 'POST',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          ensureOwnerDone.current = true;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('binee_ensure_owner_done', '1');
          }
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/workspace/load', {
        method: 'POST',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
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
    // --- Run direct query and API fallback in parallel ---
    // The direct Supabase query is fast when RLS works. The API fallback
    // bypasses RLS entirely. By racing them we avoid the sequential waterfall
    // of "try direct → wait for failure → then try API".

    type MemberRow = { workspace_id: string; role: string; email: string; display_name: string | null; avatar_url: string | null; status?: string };

    const directQueryPromise = (async (): Promise<{ members: MemberRow[] | null; error: boolean }> => {
      const firstAttempt = await supabase
        .from('workspace_members')
        .select('workspace_id, role, email, display_name, avatar_url, status')
        .eq('user_id', userId)
        .in('status', ['active', 'pending']);

      if (firstAttempt.error) {
        // Status column may not exist — retry without it
        const fallback = await supabase
          .from('workspace_members')
          .select('workspace_id, role, email, display_name, avatar_url')
          .eq('user_id', userId);
        return { members: fallback.data, error: !!fallback.error };
      }
      return { members: firstAttempt.data, error: false };
    })();

    const apiPromise = loadWorkspacesViaAPI();

    // Wait for both to complete
    const [directResult, apiResult] = await Promise.all([directQueryPromise, apiPromise]);

    // Prefer direct query result if it succeeded with data
    if (!directResult.error && directResult.members && directResult.members.length > 0) {
      const workspaceIds = [...new Set(directResult.members.map((m) => m.workspace_id))];
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);

      if (!wsErr && ws && ws.length > 0) {
        const fetchedWorkspaces = ws as Workspace[];
        applyWorkspaceData(userId, fetchedWorkspaces, directResult.members);
        return fetchedWorkspaces;
      }
    }

    // Fall back to API result
    if (apiResult.workspaces.length > 0) {
      applyWorkspaceData(userId, apiResult.workspaces, apiResult.members);
      return apiResult.workspaces;
    }

    setWorkspaces([]);
    setWorkspace(null);
    setMembership(null);
    return [];
  }, [supabase, applyWorkspaceData, loadWorkspacesViaAPI]);

  // Use refs so refreshWorkspace always reads the latest user/workspace
  // without needing them in useCallback deps (which would cause the function
  // reference to change on every state update, re-triggering consumer effects).
  const userRef = useRef(user);
  userRef.current = user;
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const refreshWorkspace = useCallback(async () => {
    const currentUser = userRef.current;
    const currentWorkspace = workspaceRef.current;
    if (!currentUser || !currentWorkspace) return;
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', currentWorkspace.id)
      .maybeSingle();
    if (ws) {
      // Only update state if something structurally changed.
      // This prevents cascading re-renders when only credit_balance or
      // updated_at changed (e.g. after every chat message credit deduction).
      const changed = Object.keys(ws).some(
        (k) => JSON.stringify((ws as unknown as Record<string, unknown>)[k]) !== JSON.stringify((currentWorkspace as unknown as Record<string, unknown>)[k]),
      );
      if (changed) {
        setWorkspace(ws as Workspace);
        setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? (ws as Workspace) : w)));
      }
    }
  }, [supabase]);

  /**
   * Shared helper: run ensure-owner, then load workspaces.
   * If workspaces are still empty after loading, tries client-side creation
   * as a last resort.
   *
   * Optimization: when ensure-owner was already completed this session,
   * we skip straight to loading workspaces (the common case for in-session
   * page navigations). When ensure-owner must run, we fire it in parallel
   * with the workspace load — if the load finds existing workspaces, the
   * ensure-owner result is just a no-op confirmation.
   */
  const ensureAndLoad = useCallback(async (userId: string): Promise<Workspace[]> => {
    const alreadyEnsured = ensureOwnerDone.current;

    if (alreadyEnsured) {
      // Fast path: skip ensure-owner entirely
      return await loadWorkspaces(userId);
    }

    // Run ensure-owner and workspace load in parallel.
    // ensure-owner is idempotent, so it's safe to race with loadWorkspaces.
    const [, loaded] = await Promise.all([
      callEnsureOwnerOnce(),
      loadWorkspaces(userId),
    ]);

    // If workspaces were found, we're done
    if (loaded.length > 0) return loaded;

    // ensure-owner may have just created the workspace — retry once.
    // No artificial delay needed: ensure-owner already completed above
    // (via Promise.all), so any workspace it created is already committed.
    console.warn('ensureAndLoad: no workspaces found, retrying load');
    return await loadWorkspaces(userId);
  }, [callEnsureOwnerOnce, loadWorkspaces]);

  // Flag to prevent onAuthStateChange from duplicating signUp/signIn work
  const manualAuthInProgress = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    // Phase 1: Determine auth session (FAST — <200ms).
    // Sets user + loading=false immediately. Does NOT wait for workspace data.
    // This unblocks ProtectedRoute so the app shell renders instantly.
    const initAuth = async () => {
      if (initializingRef.current) return;
      initializingRef.current = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          const mappedUser = mapSupabaseUser(session.user);

          // If JWT doesn't have avatar_url, check user_profiles table.
          // Uploaded avatars are stored in DB only (data URIs are too large
          // for JWT metadata), so we need this fallback.
          if (!mappedUser.avatar_url) {
            try {
              const { data: profileData } = await supabase
                .from('user_profiles')
                .select('avatar_url')
                .eq('user_id', session.user.id)
                .maybeSingle();
              if (profileData?.avatar_url) {
                mappedUser.avatar_url = profileData.avatar_url;
              }
            } catch {
              // Non-critical — avatar is cosmetic
            }
          }

          setUser(mappedUser);
          // Phase 1 done — auth determined. Unblock rendering.
          initAuthDone.current = true;
          setLoading(false);

          // Phase 2: Load workspace data ASYNCHRONOUSLY.
          // The app shell (sidebar, nav) renders while this runs in background.
          try {
            await ensureAndLoad(session.user.id);
          } finally {
            if (!cancelled) setWorkspaceLoading(false);
          }
        } else {
          // No session — not authenticated
          setWorkspaceLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (!cancelled) setWorkspaceLoading(false);
      } finally {
        initializingRef.current = false;
        if (!cancelled) {
          initAuthDone.current = true;
          setLoading(false);
        }
      }
    };

    // Safety timeout: if auth init takes too long, stop loading anyway
    const timeout = setTimeout(() => {
      setLoading(false);
      setWorkspaceLoading(false);
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

            // Timeout guard: don't let workspace load block forever
            await Promise.race([
              ensureAndLoad(session.user.id),
              new Promise((resolve) => setTimeout(resolve, 8000)),
            ]);
            // Invalidate all React Query caches so child hooks refetch
            queryClient.invalidateQueries();
            setLoading(false);
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            setUser(mapSupabaseUser(session.user));
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

    // Force-refresh session when tab becomes visible. Debounced to 2s so
    // rapidly switching to DevTools and back does not fire multiple parallel
    // getSession() calls (each of which acquires the Supabase auth lock).
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        if (visibilityTimer) clearTimeout(visibilityTimer);
        visibilityTimer = setTimeout(() => {
          if (cancelled) return;
          console.log('[binee:auth] Tab visible - refreshing session');
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return;
            if (session?.user) {
              setUser(mapSupabaseUser(session.user));
            }
          }).catch(() => {
            // Non-critical - next API call will trigger refresh anyway
          });
        }, 2000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (visibilityTimer) clearTimeout(visibilityTimer);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWorkspaces and queryClient are stable references; including them would cause unnecessary effect re-runs
  }, [supabase, ensureAndLoad]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setWorkspaceLoading(true);
    manualAuthInProgress.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        setWorkspaceLoading(false);
        if (error.message === 'Invalid login credentials') {
          return { error: 'NO_ACCOUNT_OR_WRONG_PASSWORD' };
        }
        return { error: error.message };
      }

      if (data.user) {
        const mappedUser = mapSupabaseUser(data.user);
        setUser(mappedUser);
        setLoading(false); // Auth determined — unblock rendering
        await ensureAndLoad(data.user.id);
      } else {
        setLoading(false);
      }

      setWorkspaceLoading(false);
      return {};
    } catch (err) {
      setLoading(false);
      setWorkspaceLoading(false);
      return { error: 'Unable to connect. Please check your network and try again.' };
    } finally {
      manualAuthInProgress.current = false;
    }
  }, [supabase, ensureAndLoad]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    setWorkspaceLoading(true);
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
        setWorkspaceLoading(false);
        return { error: error.message };
      }

      // Detect fake signup
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setLoading(false);
        setWorkspaceLoading(false);
        return { error: 'An account with this email may already exist. Try signing in instead.' };
      }

      // Email confirmation required
      if (data.user && !data.session) {
        setLoading(false);
        setWorkspaceLoading(false);
        return { error: 'CONFIRM_EMAIL' };
      }

      // Session exists — set up user + workspace
      if (data.user && data.session) {
        const mappedUser = mapSupabaseUser(data.user);
        setUser(mappedUser);
        setLoading(false); // Auth determined — unblock rendering

        const loaded = await ensureAndLoad(data.user.id);

        if (loaded.length === 0) {
          console.error('signUp: workspace creation failed — no workspaces after ensureAndLoad');
          setWorkspaceLoading(false);
          return { error: 'Account created but workspace setup failed. Please try signing out and back in, or contact support.' };
        }
      } else {
        setLoading(false);
      }

      setWorkspaceLoading(false);
      return {};
    } catch (err) {
      console.error('signUp: unexpected error', err);
      setLoading(false);
      setWorkspaceLoading(false);
      return { error: 'Unable to connect. Please check your network and try again.' };
    } finally {
      manualAuthInProgress.current = false;
    }
  }, [supabase, ensureAndLoad]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  }, [supabase]);

  const updateUser = useCallback(async (data: { display_name?: string; avatar_url?: string | null }) => {
    // Only write fields that actually changed to avoid bloating user_metadata
    // (which lives in the JWT cookie and can trigger Vercel 494 errors).
    const currentMeta = user ?? { display_name: '', avatar_url: null };
    const patch: Record<string, unknown> = {};

    if (data.display_name !== undefined && data.display_name !== currentMeta.display_name) {
      patch.display_name = data.display_name;
    }
    if (data.avatar_url !== undefined && data.avatar_url !== currentMeta.avatar_url) {
      // Never store large data-URIs in user_metadata - they bloat the JWT.
      // Avatar URLs from Supabase Storage or Google are short HTTP URLs.
      if (data.avatar_url && data.avatar_url.length > 500) {
        console.warn('[binee:auth] Skipping avatar_url in JWT metadata (too large). Store in user_profiles table instead.');
      } else {
        patch.avatar_url = data.avatar_url;
      }
    }

    if (Object.keys(patch).length === 0) {
      // Nothing changed - skip the updateUser call entirely
      return {};
    }

    const { error } = await supabase.auth.updateUser({ data: patch });
    if (error) return { error: error.message };
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(mapSupabaseUser(session.user));
    }
    return {};
  }, [supabase, user]);

  const signOut = useCallback(async () => {
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setMembership(null);
    setLoading(false);
    setWorkspaceLoading(false);
    ensureOwnerDone.current = false;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('binee_ensure_owner_done');
    }

    // Clear all cached data (conversations, messages, profile, etc.)
    queryClient.clear();
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
  }, [supabase, queryClient]);

  // Use a ref for workspaces so switchWorkspace doesn't need it as a dep
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;

  const switchWorkspace = useCallback((workspaceId: string) => {
    const ws = workspacesRef.current.find((w) => w.id === workspaceId);
    if (ws) {
      setWorkspace(ws);
      if (typeof window !== 'undefined') {
        localStorage.setItem('binee_active_workspace', workspaceId);
      }
    }
  }, []);

  // Memoize context value so consumers only re-render when actual state
  // values change — not on every AuthProvider render. Without this, every
  // setUser/setWorkspace call creates a new object reference, causing the
  // entire component tree (ProtectedRoute → WorkspaceProvider → Sidebar →
  // ChatPage → …) to re-render even when nothing meaningful changed.
  const contextValue = useMemo(() => ({
    user,
    workspace,
    workspaces,
    membership,
    loading,
    workspaceLoading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    switchWorkspace,
    refreshWorkspace,
    updateUser,
  }), [user, workspace, workspaces, membership, loading, workspaceLoading, signIn, signUp, signInWithGoogle, signOut, switchWorkspace, refreshWorkspace, updateUser]);

  return (
    <AuthContext.Provider value={contextValue}>
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
