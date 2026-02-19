// Zemichat v2 – Call history service

import { supabase } from './supabase';
import { type CallLog, type User, CallStatus } from '../types/database';

export interface CallHistoryEntry extends CallLog {
  initiator: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
  otherParticipant?: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
}

type CallFilter = 'all' | 'missed';

/**
 * Get call history for the current user.
 */
export async function getCallHistory(
  filter: CallFilter = 'all',
  limit = 50
): Promise<{ calls: CallHistoryEntry[]; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { calls: [], error: new Error('Not authenticated') };

  // Get call_logs where user is a member of the chat
  let query = supabase
    .from('call_logs')
    .select(`
      *,
      initiator:users!call_logs_initiator_id_fkey(id, display_name, avatar_url),
      chats!inner(
        chat_members!inner(user_id)
      )
    `)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (filter === 'missed') {
    query = query
      .eq('status', CallStatus.MISSED)
      .neq('initiator_id', user.id);
  }

  const { data, error } = await query;

  if (error) {
    return { calls: [], error: new Error(error.message) };
  }

  // Filter to only calls where the user is a chat member
  const calls: CallHistoryEntry[] = (data || [])
    .filter((row: Record<string, unknown>) => {
      const chats = row.chats as { chat_members: { user_id: string }[] } | null;
      return chats?.chat_members?.some((m) => m.user_id === user.id);
    })
    .map((row: Record<string, unknown>) => {
      const { chats: _chats, ...callLog } = row;
      return callLog as unknown as CallHistoryEntry;
    });

  // Fetch other participants for each call
  for (const call of calls) {
    if (call.initiator_id !== user.id) {
      // The other person is the initiator — already have their info
      continue;
    }
    // Current user is the initiator — fetch the other member
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id, users:user_id(id, display_name, avatar_url)')
      .eq('chat_id', call.chat_id)
      .neq('user_id', user.id)
      .is('left_at', null)
      .limit(1);

    if (members && members.length > 0) {
      const m = members[0] as unknown as {
        users: Pick<User, 'id' | 'display_name' | 'avatar_url'>;
      };
      call.otherParticipant = m.users;
    }
  }

  return { calls, error: null };
}
