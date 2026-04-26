import { supabase } from './supabase';
import type { AuthError, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { trackEvent } from './analytics';

export interface AuthResult {
  user: SupabaseUser | null;
  session: Session | null;
  error: AuthError | null;
  /**
   * For Texter sign-ins where the account is paused or deactivated:
   * the session is preserved (so the SOS button still works — RLS for
   * sos_alerts intentionally has no is_active check) but the UI must
   * restrict the user to a SOS-only screen. Audit fix #23.
   */
  sosOnly?: boolean;
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

  if (data.user && !error) {
    trackEvent('signup', { method: 'email' });
  }

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
      .select('is_active, is_paused')
      .eq('id', data.user.id)
      .single<{ is_active: boolean; is_paused: boolean }>();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return {
        user: null,
        session: null,
        error: { message: 'Account is deactivated', name: 'AuthApiError', status: 403 } as AuthError,
      };
    }

    if (profile && profile.is_paused === true) {
      await supabase.auth.signOut();
      return {
        user: null,
        session: null,
        error: { message: 'Account is paused', name: 'AuthApiError', status: 403 } as AuthError,
      };
    }
  }

  if (data.user && !error) {
    trackEvent('login', { method: 'email' });
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
 *
 * Audit fix #23: paused/deactivated Texters MUST still be able to log in
 * so they can press SOS. The RLS policy `sos_alerts_insert_texter` is
 * intentionally written with no is_active/is_paused check ("SOS can NEVER
 * be disabled"). The previous behaviour of forcing signOut() defeated this.
 *
 * We now keep the session and return `sosOnly: true`. The UI uses this flag
 * to render only the SOS-only view and block every other navigation.
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
      .select('is_active, is_paused, role')
      .eq('id', data.user.id)
      .maybeSingle<{ is_active: boolean; is_paused: boolean; role: string }>();

    // SOS-only path: paused or deactivated Texter. We keep the session
    // alive so they can fire SOS. Owner/Super accounts that hit this path
    // (rare but possible if Owner deactivated themselves) still get signed
    // out — only Texters benefit from the SOS-emergency exception.
    if (profile && profile.role === 'texter' && (profile.is_active === false || profile.is_paused === true)) {
      trackEvent('login', { method: 'zemi_number', sos_only: true });
      return {
        user: data.user,
        session: data.session,
        error: null,
        sosOnly: true,
      };
    }

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return {
        user: null,
        session: null,
        error: { message: 'Account is deactivated', name: 'AuthApiError', status: 403 } as AuthError,
      };
    }

    if (profile && profile.is_paused === true) {
      await supabase.auth.signOut();
      return {
        user: null,
        session: null,
        error: { message: 'Account is paused', name: 'AuthApiError', status: 403 } as AuthError,
      };
    }
  }

  if (data.user && !error) {
    trackEvent('login', { method: 'zemi_number' });
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

/**
 * Update the current user's password.
 * Must be called while the user has an active session (e.g. after clicking the reset link).
 */
export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}
