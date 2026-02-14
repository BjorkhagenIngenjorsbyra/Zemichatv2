import { supabase } from './supabase';
import { type User, type TexterSettings } from '../types/database';

export interface CreateTexterData {
  displayName: string;
  password: string;
  teamId: string;
}

export interface CreateTexterResult {
  user: User | null;
  zemiNumber: string | null;
  error: Error | null;
}

/**
 * Create a Texter account.
 * Uses SECURITY DEFINER RPC function that creates auth user and profile atomically.
 * Only team owners can call this.
 */
export async function createTexter({
  displayName,
  password,
}: CreateTexterData): Promise<CreateTexterResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('create_texter', {
      texter_display_name: displayName,
      texter_password: password,
    });

    if (error) {
      return { user: null, zemiNumber: null, error: new Error(error.message) };
    }

    // The RPC returns { user: {...}, zemi_number: '...', password: '...' }
    const result = data as { user: User; zemi_number: string };
    return { user: result.user, zemiNumber: result.zemi_number, error: null };
  } catch (err) {
    return {
      user: null,
      zemiNumber: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all team members for the current user's team.
 */
export async function getTeamMembers(): Promise<{ members: User[]; error: Error | null }> {
  // First get the current user's team_id
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return { members: [], error: new Error('Not authenticated') };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', authUser.id)
    .single();

  if (!profile) {
    return { members: [], error: new Error('Profile not found') };
  }

  // Filter by team_id to exclude friends from other teams
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('team_id', (profile as { team_id: string }).team_id)
    .order('role', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    return { members: [], error: new Error(error.message) };
  }

  return { members: data as unknown as User[], error: null };
}

/**
 * Get texter settings for a specific user.
 */
export async function getTexterSettings(
  userId: string
): Promise<{ settings: TexterSettings | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('texter_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { settings: null, error: new Error(error.message) };
  }

  return { settings: data as unknown as TexterSettings, error: null };
}

/**
 * Update texter settings.
 */
export async function updateTexterSettings(
  userId: string,
  settings: Partial<TexterSettings>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('texter_settings')
    .update(settings as never)
    .eq('user_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Deactivate a team member.
 */
export async function deactivateMember(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false } as never)
    .eq('id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Reactivate a team member.
 */
export async function reactivateMember(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: true } as never)
    .eq('id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Pause a team member (due to plan member limit).
 * Paused members cannot log in but are not deactivated.
 */
export async function pauseMember(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('users')
    .update({ is_paused: true } as never)
    .eq('id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Unpause a team member.
 */
export async function unpauseMember(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('users')
    .update({ is_paused: false } as never)
    .eq('id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
