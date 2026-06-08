/**
 * Active sessions / devices.
 *
 * Records a row in user_sessions on each login so the user can see where they're
 * signed in, and lets them sign out other devices. Actual token revocation uses
 * Supabase's signOut({ scope: 'others' }) — the user_sessions rows are the
 * human-readable display layer on top of that.
 */
import { supabase } from './supabase';

const CURRENT_SESSION_KEY = 'zemichat-session-id';

export interface UserSession {
  id: string;
  device_name: string | null;
  last_active_at: string;
  created_at: string;
}

async function deviceName(): Promise<string> {
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    const model = info.model && info.model !== 'unknown' ? info.model : info.operatingSystem;
    return `${model} · ${info.platform}`;
  } catch {
    return 'Okänd enhet';
  }
}

/** Record the current login as a session row. Call after a successful sign-in. */
export async function recordSession(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const name = await deviceName();
  const { data } = await supabase
    .from('user_sessions')
    .insert({ user_id: user.id, device_name: name } as never)
    .select('id')
    .single();
  const id = (data as { id: string } | null)?.id;
  if (id) localStorage.setItem(CURRENT_SESSION_KEY, id);
}

/** List the user's own sessions, newest activity first, plus which is current. */
export async function listSessions(): Promise<{ sessions: UserSession[]; currentId: string | null }> {
  const { data } = await supabase
    .from('user_sessions')
    .select('id, device_name, last_active_at, created_at')
    .order('last_active_at', { ascending: false });
  return {
    sessions: (data ?? []) as unknown as UserSession[],
    currentId: localStorage.getItem(CURRENT_SESSION_KEY),
  };
}

/** Bump last_active_at for the current session (e.g. on app resume). */
export async function touchCurrentSession(): Promise<void> {
  const id = localStorage.getItem(CURRENT_SESSION_KEY);
  if (!id) return;
  await supabase
    .from('user_sessions')
    .update({ last_active_at: new Date().toISOString() } as never)
    .eq('id', id);
}

/** Remove a single session row from the list (display cleanup). */
export async function removeSession(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('user_sessions').delete().eq('id', id);
  return { error: error ? new Error(error.message) : null };
}

/**
 * Sign out every OTHER device (revokes their refresh tokens) and clear their
 * rows from the list. The current session stays signed in.
 */
export async function signOutOtherDevices(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) return { error: new Error(error.message) };

  const id = localStorage.getItem(CURRENT_SESSION_KEY);
  const del = supabase.from('user_sessions').delete();
  await (id ? del.neq('id', id) : del.neq('id', '00000000-0000-0000-0000-000000000000'));
  return { error: null };
}
