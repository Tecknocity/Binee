import { createBrowserClient } from './client';

export async function signUp(email: string, password: string, fullName: string) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signOut();
  return { data: null, error };
}

export async function resetPassword(email: string) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}
