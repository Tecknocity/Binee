'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
} from '@/lib/supabase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    (email: string, password: string, fullName: string) =>
      authSignUp(email, password, fullName),
    [],
  );

  const signIn = useCallback(
    (email: string, password: string) => authSignIn(email, password),
    [],
  );

  const signOut = useCallback(() => authSignOut(), []);

  return { user, session, loading, signUp, signIn, signOut };
}
