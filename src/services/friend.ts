import { supabase } from './supabase';
import {
  type Friendship,
  type User,
  type DeniedFriendRequest,
  FriendshipStatus,
  UserRole,
} from '../types/database';

// ============================================================
// Types
// ============================================================

export interface FriendWithUser extends Friendship {
  user: User;
}

export interface PendingRequestWithUser extends Friendship {
  requester: User;
  addressee: User;
}

// ============================================================
// User Search
// ============================================================

/**
 * Search for a user by their Zemi number.
 */
export async function searchUserByZemiNumber(
  zemiNumber: string
): Promise<{ user: User | null; error: Error | null }> {
  try {
    // Normalize the zemi number (uppercase, no extra spaces)
    const normalizedZemi = zemiNumber.trim().toUpperCase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('zemi_number', normalizedZemi)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return { user: null, error: null };
      }
      return { user: null, error: new Error(error.message) };
    }

    return { user: data as unknown as User, error: null };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// Friends List
// ============================================================

/**
 * Get all accepted friends for the current user.
 */
export async function getMyFriends(): Promise<{
  friends: FriendWithUser[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { friends: [], error: new Error('Not authenticated') };
    }

    // Get friendships where current user is requester or addressee and status is accepted
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', FriendshipStatus.ACCEPTED)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) {
      return { friends: [], error: new Error(error.message) };
    }

    if (!friendships || friendships.length === 0) {
      return { friends: [], error: null };
    }

    // Get the friend's user ID for each friendship
    const typedFriendships = friendships as unknown as Friendship[];
    const friendIds = typedFriendships.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    // Get friend user details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('id', friendIds);

    if (usersError) {
      return { friends: [], error: new Error(usersError.message) };
    }

    const typedUsers = (users || []) as unknown as User[];
    const userMap = new Map(typedUsers.map((u) => [u.id, u]));

    // Build friend list with user details
    const friends: FriendWithUser[] = typedFriendships
      .map((f) => {
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const friendUser = userMap.get(friendId);
        if (!friendUser) return null;
        return { ...f, user: friendUser };
      })
      .filter((f): f is FriendWithUser => f !== null);

    // Sort by display name
    friends.sort((a, b) => {
      const nameA = a.user.display_name || '';
      const nameB = b.user.display_name || '';
      return nameA.localeCompare(nameB);
    });

    return { friends, error: null };
  } catch (err) {
    return {
      friends: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// Pending Requests
// ============================================================

/**
 * Get pending friend requests (incoming and outgoing) for the current user.
 */
export async function getPendingRequests(): Promise<{
  incoming: PendingRequestWithUser[];
  outgoing: PendingRequestWithUser[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { incoming: [], outgoing: [], error: new Error('Not authenticated') };
    }

    // Get all pending friendships involving the current user
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', FriendshipStatus.PENDING)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) {
      return { incoming: [], outgoing: [], error: new Error(error.message) };
    }

    if (!friendships || friendships.length === 0) {
      return { incoming: [], outgoing: [], error: null };
    }

    const typedFriendships = friendships as unknown as Friendship[];

    // Get all user IDs involved
    const userIds = new Set<string>();
    typedFriendships.forEach((f) => {
      userIds.add(f.requester_id);
      userIds.add(f.addressee_id);
    });

    // Get user details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('id', Array.from(userIds));

    if (usersError) {
      return { incoming: [], outgoing: [], error: new Error(usersError.message) };
    }

    const typedUsers = (users || []) as unknown as User[];
    const userMap = new Map(typedUsers.map((u) => [u.id, u]));

    // Separate incoming and outgoing
    const incoming: PendingRequestWithUser[] = [];
    const outgoing: PendingRequestWithUser[] = [];

    for (const f of typedFriendships) {
      const requester = userMap.get(f.requester_id);
      const addressee = userMap.get(f.addressee_id);

      if (!requester || !addressee) continue;

      const requestWithUsers = { ...f, requester, addressee };

      if (f.addressee_id === user.id) {
        incoming.push(requestWithUsers);
      } else {
        outgoing.push(requestWithUsers);
      }
    }

    return { incoming, outgoing, error: null };
  } catch (err) {
    return {
      incoming: [],
      outgoing: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// Friend Request Actions
// ============================================================

/**
 * Send a friend request to another user.
 */
export async function sendFriendRequest(
  addresseeId: string
): Promise<{ friendship: Friendship | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { friendship: null, error: new Error('Not authenticated') };
    }

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
      )
      .single();

    if (existing) {
      return { friendship: null, error: new Error('Friendship already exists') };
    }

    // Check if user is denied
    const { data: denied } = await supabase
      .from('denied_friend_requests')
      .select('*')
      .eq('texter_id', addresseeId)
      .eq('denied_user_id', user.id)
      .single();

    if (denied) {
      return { friendship: null, error: new Error('Cannot send request to this user') };
    }

    // Create the friendship request
    const { data: friendship, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: addresseeId,
        status: FriendshipStatus.PENDING,
      } as never)
      .select()
      .single();

    if (error) {
      return { friendship: null, error: new Error(error.message) };
    }

    return { friendship: friendship as unknown as Friendship, error: null };
  } catch (err) {
    return {
      friendship: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Accept a friend request (for Supers only - Texters need Owner approval).
 */
export async function acceptFriendRequest(
  friendshipId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('friendships')
      .update({
        status: FriendshipStatus.ACCEPTED,
        approved_by: user.id,
      } as never)
      .eq('id', friendshipId)
      .eq('addressee_id', user.id)
      .eq('status', FriendshipStatus.PENDING);

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
 * Reject a friend request.
 */
export async function rejectFriendRequest(
  friendshipId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('friendships')
      .update({ status: FriendshipStatus.REJECTED } as never)
      .eq('id', friendshipId)
      .eq('addressee_id', user.id)
      .eq('status', FriendshipStatus.PENDING);

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
 * Unfriend (remove an accepted friendship).
 */
export async function unfriend(friendshipId: string): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    // Delete the friendship (either party can unfriend)
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('status', FriendshipStatus.ACCEPTED)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

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

// ============================================================
// Owner-Only Functions
// ============================================================

/**
 * Get pending friend requests for a specific Texter (Owner only).
 */
export async function getTexterPendingRequests(
  texterId: string
): Promise<{ requests: PendingRequestWithUser[]; error: Error | null }> {
  try {
    // Get pending requests where the texter is the addressee
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', FriendshipStatus.PENDING)
      .eq('addressee_id', texterId);

    if (error) {
      return { requests: [], error: new Error(error.message) };
    }

    if (!friendships || friendships.length === 0) {
      return { requests: [], error: null };
    }

    const typedFriendships = friendships as unknown as Friendship[];

    // Get all user IDs
    const userIds = new Set<string>();
    typedFriendships.forEach((f) => {
      userIds.add(f.requester_id);
      userIds.add(f.addressee_id);
    });

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('id', Array.from(userIds));

    if (usersError) {
      return { requests: [], error: new Error(usersError.message) };
    }

    const typedUsers = (users || []) as unknown as User[];
    const userMap = new Map(typedUsers.map((u) => [u.id, u]));

    const requests: PendingRequestWithUser[] = typedFriendships
      .map((f) => {
        const requester = userMap.get(f.requester_id);
        const addressee = userMap.get(f.addressee_id);
        if (!requester || !addressee) return null;
        return { ...f, requester, addressee };
      })
      .filter((r): r is PendingRequestWithUser => r !== null);

    return { requests, error: null };
  } catch (err) {
    return {
      requests: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all pending friend requests for all Texters in the Owner's team.
 */
export async function getAllTexterPendingRequests(): Promise<{
  requestsByTexter: Map<string, { texter: User; requests: PendingRequestWithUser[] }>;
  totalCount: number;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        requestsByTexter: new Map(),
        totalCount: 0,
        error: new Error('Not authenticated'),
      };
    }

    // Get current user's team_id
    const { data: ownerUser, error: ownerError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', user.id)
      .single();

    if (ownerError || !ownerUser) {
      return {
        requestsByTexter: new Map(),
        totalCount: 0,
        error: new Error('Could not get user info'),
      };
    }

    const typedOwner = ownerUser as unknown as { team_id: string; role: string };

    if (typedOwner.role !== UserRole.OWNER) {
      return {
        requestsByTexter: new Map(),
        totalCount: 0,
        error: new Error('Only owners can view Texter requests'),
      };
    }

    // Get all Texters in the team
    const { data: texters, error: textersError } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', typedOwner.team_id)
      .eq('role', UserRole.TEXTER);

    if (textersError) {
      return {
        requestsByTexter: new Map(),
        totalCount: 0,
        error: new Error(textersError.message),
      };
    }

    const typedTexters = (texters || []) as unknown as User[];

    if (typedTexters.length === 0) {
      return { requestsByTexter: new Map(), totalCount: 0, error: null };
    }

    const texterIds = typedTexters.map((t) => t.id);

    // Get all pending requests for these Texters
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', FriendshipStatus.PENDING)
      .in('addressee_id', texterIds);

    if (friendshipsError) {
      return {
        requestsByTexter: new Map(),
        totalCount: 0,
        error: new Error(friendshipsError.message),
      };
    }

    const typedFriendships = (friendships || []) as unknown as Friendship[];

    if (typedFriendships.length === 0) {
      return { requestsByTexter: new Map(), totalCount: 0, error: null };
    }

    // Get requester details
    const requesterIds = typedFriendships.map((f) => f.requester_id);
    const { data: requesters, error: requestersError } = await supabase
      .from('users')
      .select('*')
      .in('id', requesterIds);

    if (requestersError) {
      return {
        requestsByTexter: new Map(),
        totalCount: 0,
        error: new Error(requestersError.message),
      };
    }

    const typedRequesters = (requesters || []) as unknown as User[];
    const requesterMap = new Map(typedRequesters.map((u) => [u.id, u]));
    const texterMap = new Map(typedTexters.map((t) => [t.id, t]));

    // Group by Texter
    const requestsByTexter = new Map<
      string,
      { texter: User; requests: PendingRequestWithUser[] }
    >();

    for (const f of typedFriendships) {
      const texter = texterMap.get(f.addressee_id);
      const requester = requesterMap.get(f.requester_id);

      if (!texter || !requester) continue;

      if (!requestsByTexter.has(f.addressee_id)) {
        requestsByTexter.set(f.addressee_id, { texter, requests: [] });
      }

      requestsByTexter.get(f.addressee_id)!.requests.push({
        ...f,
        requester,
        addressee: texter,
      });
    }

    return {
      requestsByTexter,
      totalCount: typedFriendships.length,
      error: null,
    };
  } catch (err) {
    return {
      requestsByTexter: new Map(),
      totalCount: 0,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Approve a friend request for a Texter (Owner only).
 */
export async function approveTexterRequest(
  friendshipId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('friendships')
      .update({
        status: FriendshipStatus.ACCEPTED,
        approved_by: user.id,
      } as never)
      .eq('id', friendshipId)
      .eq('status', FriendshipStatus.PENDING);

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
 * Reject a friend request for a Texter (Owner only).
 */
export async function rejectTexterRequest(
  friendshipId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: FriendshipStatus.REJECTED } as never)
      .eq('id', friendshipId)
      .eq('status', FriendshipStatus.PENDING);

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
 * Deny future friend requests from a specific user to a Texter (Owner only).
 */
export async function denyFutureRequests(
  texterId: string,
  deniedUserId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase.from('denied_friend_requests').insert({
      texter_id: texterId,
      denied_user_id: deniedUserId,
      denied_by: user.id,
    } as never);

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
 * Remove a denial, allowing the user to send requests again (Owner only).
 */
export async function removeDenial(
  texterId: string,
  deniedUserId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('denied_friend_requests')
      .delete()
      .eq('texter_id', texterId)
      .eq('denied_user_id', deniedUserId);

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
 * Get the friendship status between current user and another user.
 */
export async function getFriendshipStatus(
  otherUserId: string
): Promise<{
  status: 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'denied';
  friendship: Friendship | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { status: 'none', friendship: null, error: new Error('Not authenticated') };
    }

    // Check for existing friendship
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`
      )
      .single();

    if (friendship) {
      const typedFriendship = friendship as unknown as Friendship;

      if (typedFriendship.status === FriendshipStatus.ACCEPTED) {
        return { status: 'accepted', friendship: typedFriendship, error: null };
      }

      if (typedFriendship.status === FriendshipStatus.PENDING) {
        if (typedFriendship.requester_id === user.id) {
          return { status: 'pending_outgoing', friendship: typedFriendship, error: null };
        } else {
          return { status: 'pending_incoming', friendship: typedFriendship, error: null };
        }
      }
    }

    // Check if denied
    const { data: denied } = await supabase
      .from('denied_friend_requests')
      .select('*')
      .eq('texter_id', otherUserId)
      .eq('denied_user_id', user.id)
      .single();

    if (denied) {
      return { status: 'denied', friendship: null, error: null };
    }

    return { status: 'none', friendship: null, error: null };
  } catch (err) {
    return {
      status: 'none',
      friendship: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
