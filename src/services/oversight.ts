import { supabase } from './supabase';
import { type Chat, type Message, type User } from '../types/database';

export interface TexterChatOverview {
  chat: Chat;
  texter: User;
  otherMembers: User[];
  lastMessage?: Message;
  messageCount: number;
}

interface OverviewRpcRow {
  chat_id: string;
  chat_name: string | null;
  chat_is_group: boolean;
  chat_created_at: string;
  texter_id: string;
  texter_zemi_number: string;
  texter_display_name: string | null;
  texter_avatar_url: string | null;
  texter_is_active: boolean;
  texter_is_paused: boolean;
  last_message_id: string | null;
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  last_message_deleted_at: string | null;
  message_count: number;
}

/**
 * Get all chats where team Texters are participants.
 * Only callable by team owners.
 *
 * Audit fix #25: this used to fetch ALL messages for all relevant chats
 * (no limit) and then loop through chats running a count(*) per chat.
 * On a team with 100 chats x 100 messages that was ~10k row transit + 100
 * sequential queries (~5-10s, often 504). It now calls the SECURITY
 * DEFINER RPC `get_texter_chat_overview` which returns the dashboard's
 * full payload in a single round-trip, plus one additional batched query
 * for the per-chat member lists.
 */
export async function getTexterChats(): Promise<{
  chats: TexterChatOverview[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { chats: [], error: new Error('Not authenticated') };
    }

    // Need the caller's team_id — the RPC validates that the caller is the
    // Owner of the team it's called for, so we have to know which team we
    // are owner of.
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      return { chats: [], error: new Error('Profile not found') };
    }

    const profile = profileData as unknown as { team_id: string; role: string };

    if (profile.role !== 'owner') {
      return { chats: [], error: new Error('Only owners can view Texter chats') };
    }

    // Single RPC call — returns one row per (chat, texter) pair.
    const { data: overviewRows, error: rpcError } = await supabase.rpc(
      'get_texter_chat_overview' as never,
      { p_team_id: profile.team_id } as never
    );

    if (rpcError) {
      return { chats: [], error: new Error((rpcError as { message?: string }).message ?? 'RPC failed') };
    }

    const rows = (overviewRows as unknown as OverviewRpcRow[]) || [];
    if (rows.length === 0) {
      return { chats: [], error: null };
    }

    // Single batched query for "other members" of each chat.
    const chatIds = Array.from(new Set(rows.map((r) => r.chat_id)));
    const { data: allMembers, error: allMembersError } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        user_id,
        user:users (*)
      `)
      .in('chat_id', chatIds)
      .is('left_at', null);

    if (allMembersError) {
      return { chats: [], error: new Error(allMembersError.message) };
    }

    const typedAllMembers = (allMembers || []) as unknown as {
      chat_id: string;
      user_id: string;
      user: User;
    }[];

    const membersByChat = new Map<string, { chat_id: string; user_id: string; user: User }[]>();
    for (const member of typedAllMembers) {
      const list = membersByChat.get(member.chat_id) || [];
      list.push(member);
      membersByChat.set(member.chat_id, list);
    }

    // Assemble TexterChatOverview entries. The RPC already orders by last
    // activity desc, so we preserve order.
    const chats: TexterChatOverview[] = rows.map((row) => {
      const chat: Chat = {
        id: row.chat_id,
        // Cast: server returns nullable but the Chat type might not match.
        name: row.chat_name,
        is_group: row.chat_is_group,
        created_at: row.chat_created_at,
        // The RPC didn't return these — they're not used in the dashboard
        // overview view. If callers need them they should fetch the chat
        // separately. We fill with safe defaults.
      } as unknown as Chat;

      const texter: User = {
        id: row.texter_id,
        zemi_number: row.texter_zemi_number,
        display_name: row.texter_display_name,
        avatar_url: row.texter_avatar_url,
        is_active: row.texter_is_active,
        is_paused: row.texter_is_paused,
        role: 'texter',
        team_id: profile.team_id,
        // Other User fields default-filled where missing.
      } as unknown as User;

      const otherMembers = (membersByChat.get(row.chat_id) || [])
        .filter((m) => m.user_id !== row.texter_id)
        .map((m) => m.user);

      const lastMessage: Message | undefined = row.last_message_id
        ? ({
            id: row.last_message_id,
            chat_id: row.chat_id,
            content: row.last_message_content,
            type: row.last_message_type,
            sender_id: row.last_message_sender_id,
            created_at: row.last_message_created_at,
            deleted_at: row.last_message_deleted_at,
          } as unknown as Message)
        : undefined;

      return {
        chat,
        texter,
        otherMembers,
        lastMessage,
        messageCount: row.message_count ?? 0,
      };
    });

    return { chats, error: null };
  } catch (err) {
    return {
      chats: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get messages for a chat (Owner oversight view).
 * Includes soft-deleted messages for transparency.
 */
export async function getOversightMessages(
  chatId: string
): Promise<{ messages: (Message & { sender?: User })[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (*)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      return { messages: [], error: new Error(error.message) };
    }

    return { messages: data as unknown as (Message & { sender?: User })[], error: null };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
