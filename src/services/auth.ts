import { supabase } from './supabase';
import type { AuthError, User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface AuthResult {
  user: SupabaseUser | null;
  session: Session | null;
  error: AuthError | null;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface TexterSignInData {
  zemiNumber: string;
  password: string;
}

/**
 * Sign up a new Team Owner with email and password.
 * After successful auth signup, the user still needs to create their team.
 */
export async function signUp({ email, password, displayName }: SignUpData): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  return {
    user: data.user,
    session: data.session,
    error,
  };
}

/**
 * Sign in with email and password.
 * After successful auth, checks if the user account is active.
 */
export async function signIn({ email, password }: SignInData): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (data.user && !error) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', data.user.id)
      .single<{ is_active: boolean }>();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return {
        user: null,
        session: null,
        error: { message: 'Account is deactivated', name: 'AuthApiError', status: 403 } as AuthError,
      };
    }
  }

  return {
    user: data.user,
    session: data.session,
    error,
  };
}

/**
 * Sign in as a Texter using Zemi-number and password.
 * Texters don't have email - they use a fake email based on their Zemi-number.
 * After successful auth, checks if the user account is active.
 */
export async function signInAsTexter({ zemiNumber, password }: TexterSignInData): Promise<AuthResult> {
  // Convert Zemi-number to fake email used during account creation
  // Format: ZEMI-XXX-XXX -> zemixxx@texter.zemichat.local
  const fakeEmail = zemiNumber.toLowerCase().replace(/-/g, '') + '@texter.zemichat.local';

  const { data, error } = await supabase.auth.signInWithPassword({
    email: fakeEmail,
    password,
  });

  if (data.user && !error) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', data.user.id)
      .single<{ is_active: boolean }>();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return {
        user: null,
        session: null,
        error: { message: 'Account is deactivated', name: 'AuthApiError', status: 403 } as AuthError,
      };
    }
  }

  return {
    user: data.user,
    session: data.session,
    error,
  };
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the current session.
 */
export async function getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

/**
 * Get the current user.
 */
export async function getUser(): Promise<{ user: SupabaseUser | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Send password reset email.
 */
export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
}
