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

  // Guard: ensure-owner is called at most once per session
  const ensureOwnerCalled = useRef(false);
  const ensureOwnerInFlight = useRef(false);

  const callEnsureOwnerOnce = useCallback(async () => {
    if (ensureOwnerCalled.current || ensureOwnerInFlight.current) return;
    ensureOwnerInFlight.current = true;
    try {
      await fetch('/api/workspace/ensure-owner', { method: 'POST' });
      ensureOwnerCalled.current = true;
    } catch {
      // Non-critical — will be retried on next sign-in if needed
    } finally {
      ensureOwnerInFlight.current = false;
    }
  }, []);

  const loadWorkspaces = useCallback(async (userId: string): Promise<Workspace[]> => {
    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, email, display_name, avatar_url, status')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

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

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          const mappedUser = mapSupabaseUser(session.user);
          setUser(mappedUser);
          await callEnsureOwnerOnce();
          await loadWorkspaces(session.user.id);
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

            await callEnsureOwnerOnce();
            let loadedWorkspaces = await loadWorkspaces(session.user.id);

            // If no workspaces after initial load (e.g. OAuth user whose
            // trigger hasn't fired yet), reload once more.
            if (loadedWorkspaces.length === 0) {
              loadedWorkspaces = await loadWorkspaces(session.user.id);
            }

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
  }, [supabase, loadWorkspaces, callEnsureOwnerOnce]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        // Supabase returns "Invalid login credentials" for both wrong password
        // and non-existent user. Provide a friendlier message.
        if (error.message === 'Invalid login credentials') {
          return { error: 'NO_ACCOUNT_OR_WRONG_PASSWORD' };
        }
        return { error: error.message };
      }
      // onAuthStateChange will handle setting user & loading=false
      return {};
    } catch (err) {
      setLoading(false);
      return { error: 'Unable to connect. Please check your network and try again.' };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
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

      // If a session was returned (email confirmation disabled),
      // set up user + workspace immediately — don't rely on the async
      // onAuthStateChange event which may fire after SignupPage navigates.
      if (data.user && data.session) {
        const mappedUser = mapSupabaseUser(data.user);
        setUser(mappedUser);

        // ensure-owner (server-side, bypasses RLS) creates the workspace
        // and member row if the handle_new_user() trigger didn't fire.
        await callEnsureOwnerOnce();

        await loadWorkspaces(data.user.id);
      }

      return {};
    } catch (err) {
      setLoading(false);
      return { error: 'Unable to connect. Please check your network and try again.' };
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
