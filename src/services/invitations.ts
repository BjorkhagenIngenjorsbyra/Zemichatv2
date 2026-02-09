import { supabase } from './supabase';
import { type User } from '../types/database';

export interface Invitation {
  id: string;
  team_id: string;
  invited_by: string;
  email: string;
  role: string;
  token: string;
  display_name: string | null;
  expires_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  created_at: string;
}

export interface InvitationPublicInfo {
  id: string;
  role: string;
  email: string;
  invited_display_name: string | null;
  team_name: string;
  inviter_name: string;
  expires_at: string;
}

/**
 * Create a new Super invitation (Owner only).
 * Calls the create_super_invitation SECURITY DEFINER RPC.
 */
export async function createInvitation(
  email: string,
  displayName?: string
): Promise<{ invitation: Invitation | null; error: Error | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('create_super_invitation', {
      invitation_email: email,
      invitation_display_name: displayName || null,
    });

    if (error) {
      return { invitation: null, error: new Error(error.message) };
    }

    return { invitation: data as Invitation, error: null };
  } catch (err) {
    return {
      invitation: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all invitations for the current Owner's team.
 */
export async function getTeamInvitations(): Promise<{
  invitations: Invitation[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { invitations: [], error: new Error(error.message) };
    }

    return { invitations: (data as unknown as Invitation[]) ?? [], error: null };
  } catch (err) {
    return {
      invitations: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Delete a pending invitation (Owner only).
 */
export async function deleteInvitation(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Claim an invitation by token (new authenticated user without profile).
 * Calls the claim_super_invitation SECURITY DEFINER RPC.
 */
export async function claimInvitation(
  token: string
): Promise<{ user: User | null; error: Error | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('claim_super_invitation', {
      invitation_token: token,
    });

    if (error) {
      return { user: null, error: new Error(error.message) };
    }

    return { user: data as User, error: null };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get public invitation info by token (no auth required).
 * Calls the get_invitation_public SECURITY DEFINER RPC.
 */
export async function getInvitationByToken(
  token: string
): Promise<{ invitation: InvitationPublicInfo | null; error: Error | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_invitation_public', {
      invitation_token: token,
    });

    if (error) {
      return { invitation: null, error: new Error(error.message) };
    }

    return { invitation: data as InvitationPublicInfo, error: null };
  } catch (err) {
    return {
      invitation: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
