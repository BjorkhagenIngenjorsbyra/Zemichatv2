import { supabase } from './supabase';
import { PlanType, UserRole, type Team, type User } from '../types/database';

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
 * Generate a unique Zemi number for a user.
 * Format: ZEMI-XXX-XXX where X is alphanumeric.
 */
function generateZemiNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: I, O, 0, 1
  const segment = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `ZEMI-${segment()}-${segment()}`;
}

/**
 * Create a new team and set up the owner user profile.
 * This is called after successful auth signup.
 */
export async function createTeam({
  name,
  ownerId,
  ownerDisplayName,
}: CreateTeamData): Promise<CreateTeamResult> {
  try {
    // Generate a unique Zemi number for the owner
    const zemiNumber = generateZemiNumber();

    // Use a transaction via RPC or do sequential inserts
    // Since we have circular FK (team.owner_id -> users, users.team_id -> teams),
    // we need to insert team first with owner_id, then user with team_id.
    // The RLS policies and schema allow this flow for owners.

    // 1. Insert team with owner_id set to the auth user id
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        owner_id: ownerId,
        plan: PlanType.FREE,
      } as never)
      .select()
      .single();

    if (teamError) {
      return { team: null, user: null, error: new Error(teamError.message) };
    }

    const team = teamData as unknown as Team;

    // 2. Insert user profile as owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: ownerId,
        team_id: team.id,
        role: UserRole.OWNER,
        zemi_number: zemiNumber,
        display_name: ownerDisplayName || null,
      } as never)
      .select()
      .single();

    if (userError) {
      // Rollback: delete the team we just created
      await supabase.from('teams').delete().eq('id', team.id);
      return { team: null, user: null, error: new Error(userError.message) };
    }

    return { team, user: userData as unknown as User, error: null };
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
