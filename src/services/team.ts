import { supabase } from './supabase';
import { type Team, type User } from '../types/database';

export interface CreateTeamData {
  name: string;
  ownerId: string;
  ownerDisplayName?: string;
}

export interface CreateTeamResult {
  team: Team | null;
  user: User | null;
  error: Error | null;
}

/**
 * Create a new team and set up the owner user profile.
 * Uses SECURITY DEFINER RPC function to handle circular FK atomically.
 */
export async function createTeam({
  name,
  ownerDisplayName,
}: CreateTeamData): Promise<CreateTeamResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('create_team_with_owner', {
      team_name: name,
      owner_display_name: ownerDisplayName || null,
    });

    if (error) {
      return { team: null, user: null, error: new Error(error.message) };
    }

    // The RPC returns { team: {...}, user: {...} }
    const result = data as { team: Team; user: User };
    return { team: result.team, user: result.user, error: null };
  } catch (err) {
    return {
      team: null,
      user: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get the current user's team.
 */
export async function getMyTeam(): Promise<{ team: Team | null; error: Error | null }> {
  const { data, error } = await supabase.from('teams').select('*').single();

  if (error) {
    return { team: null, error: new Error(error.message) };
  }

  return { team: data as unknown as Team, error: null };
}

/**
 * Get the current user's profile.
 */
export async function getMyProfile(): Promise<{ user: User | null; error: Error | null }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { user: null, error: new Error('Not authenticated') };
  }

  const { data, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();

  if (error) {
    return { user: null, error: new Error(error.message) };
  }

  return { user: data as unknown as User, error: null };
}

/**
 * Check if the current user has a team/profile set up.
 */
export async function hasTeamProfile(): Promise<boolean> {
  const { user } = await getMyProfile();
  return user !== null;
}
