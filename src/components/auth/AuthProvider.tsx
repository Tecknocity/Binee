'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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

  const loadWorkspaces = useCallback(async (userId: string): Promise<Workspace[]> => {
    // Auto-fix: ensure user has 'owner' role in workspaces they own
    try {
      await fetch('/api/workspace/ensure-owner', { method: 'POST' });
    } catch {
      // Non-critical — don't block workspace loading
    }

    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, email, display_name, avatar_url')
      .eq('user_id', userId);

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

            const loadedWorkspaces = await loadWorkspaces(session.user.id);

            // Auto-create a workspace for new OAuth users who have none
            if (loadedWorkspaces.length === 0) {
              const displayName = mappedUser.display_name || 'My';
              const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-workspace';
              const { data: newWorkspace } = await supabase
                .from('workspaces')
                .insert({
                  name: `${displayName}'s Workspace`,
                  slug: `${slug}-${Date.now().toString(36)}`,
                  owner_id: session.user.id,
                  plan: 'free',
                  credit_balance: 10,
                })
                .select()
                .single();

              if (newWorkspace) {
                await supabase.from('workspace_members').insert({
                  workspace_id: newWorkspace.id,
                  user_id: session.user.id,
                  role: 'owner',
                  email: session.user.email ?? '',
                  display_name: mappedUser.display_name,
                });
                // Reload workspaces to pick up the new one
                await loadWorkspaces(session.user.id);
              }
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
  }, [supabase, loadWorkspaces]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
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

      // Create a default workspace for the new user
      if (data.user) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-workspace';
        const { data: newWorkspace } = await supabase
          .from('workspaces')
          .insert({
            name: `${name}'s Workspace`,
            slug: `${slug}-${Date.now().toString(36)}`,
            owner_id: data.user.id,
            plan: 'free',
            credit_balance: 10,
          })
          .select()
          .single();

        if (newWorkspace) {
          await supabase.from('workspace_members').insert({
            workspace_id: newWorkspace.id,
            user_id: data.user.id,
            role: 'owner',
            email,
            display_name: name,
          });
        }
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
    try {
      await supabase.auth.signOut();
    } catch {
      // Clear state even if Supabase signOut fails
    }
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setMembership(null);
    setLoading(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('binee_active_workspace');
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
