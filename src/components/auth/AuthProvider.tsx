'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Workspace, WorkspaceMember } from '@/types/database';

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
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Mock data for visual development
const mockUser: User = {
  id: 'usr_mock_001',
  email: 'demo@binee.dev',
  display_name: 'Alex Chen',
  avatar_url: null,
};

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws_mock_001',
    name: 'Acme Corp',
    slug: 'acme-corp',
    owner_id: 'usr_mock_001',
    plan: 'starter',
    credit_balance: 487,
    clickup_team_id: 'cu_team_123',
    clickup_access_token: null,
    settings: {},
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'ws_mock_002',
    name: 'Side Project',
    slug: 'side-project',
    owner_id: 'usr_mock_001',
    plan: 'free',
    credit_balance: 42,
    clickup_team_id: null,
    clickup_access_token: null,
    settings: {},
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-03-08T00:00:00Z',
  },
];

const mockMembership: WorkspaceMember = {
  id: 'mem_mock_001',
  workspace_id: 'ws_mock_001',
  user_id: 'usr_mock_001',
  role: 'owner',
  email: 'demo@binee.dev',
  display_name: 'Alex Chen',
  avatar_url: null,
  created_at: '2025-12-01T00:00:00Z',
  updated_at: '2026-03-10T00:00:00Z',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate auth check — in production this would call Supabase
    const timer = setTimeout(() => {
      // For visual dev, check if we're on an app route and auto-login
      const isAppRoute = window.location.pathname.startsWith('/chat') ||
        window.location.pathname.startsWith('/dashboards') ||
        window.location.pathname.startsWith('/health') ||
        window.location.pathname.startsWith('/setup') ||
        window.location.pathname.startsWith('/settings');

      if (isAppRoute) {
        setUser(mockUser);
        setWorkspaces(mockWorkspaces);
        setWorkspace(mockWorkspaces[0]);
        setMembership(mockMembership);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    // Placeholder: would call supabase.auth.signInWithPassword
    await new Promise((r) => setTimeout(r, 500));
    setUser(mockUser);
    setWorkspaces(mockWorkspaces);
    setWorkspace(mockWorkspaces[0]);
    setMembership(mockMembership);
    setLoading(false);
    return {};
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    // Placeholder: would call supabase.auth.signUp
    await new Promise((r) => setTimeout(r, 500));
    setUser({ ...mockUser, email, display_name: name });
    setWorkspaces(mockWorkspaces);
    setWorkspace(mockWorkspaces[0]);
    setMembership(mockMembership);
    setLoading(false);
    return {};
  };

  const signInWithGoogle = async () => {
    // Placeholder: would call supabase.auth.signInWithOAuth({ provider: 'google' })
    setUser(mockUser);
    setWorkspaces(mockWorkspaces);
    setWorkspace(mockWorkspaces[0]);
    setMembership(mockMembership);
  };

  const signOut = async () => {
    // Placeholder: would call supabase.auth.signOut()
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setMembership(null);
  };

  const switchWorkspace = (workspaceId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws) setWorkspace(ws);
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
