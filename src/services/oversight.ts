import { supabase } from './supabase';
import { type Chat, type ChatMember, type Message, type User } from '../types/database';

export interface TexterChatOverview {
  chat: Chat;
  texter: User;
  otherMembers: User[];
  lastMessage?: Message;
  messageCount: number;
}

/**
 * Get all chats where team Texters are participants.
 * Only callable by team owners.
 */
export async function getTexterChats(): Promise<{
  chats: TexterChatOverview[];
  error: Error | null;
}> {
  try {
    // Get current user's team ID
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { chats: [], error: new Error('Not authenticated') };
    }

    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      return { chats: [], error: new Error('Profile not found') };
    }

    const profile = profileData as unknown as { team_id: string; role: string };

    if (profile.role !== 'owner') {
      return { chats: [], error: new Error('Only owners can view Texter chats') };
    }

    // Get all Texters in the team
    const { data: texters, error: textersError } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', profile.team_id)
      .eq('role', 'texter');

    if (textersError) {
      return { chats: [], error: new Error(textersError.message) };
    }

    if (!texters || texters.length === 0) {
      return { chats: [], error: null };
    }

    const typedTexters = texters as unknown as User[];
    const texterIds = typedTexters.map((t) => t.id);

    // Get all chat memberships for these Texters
    const { data: memberships, error: membershipsError } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        user_id,
        chats (*)
      `)
      .in('user_id', texterIds)
      .is('left_at', null);

    if (membershipsError) {
      return { chats: [], error: new Error(membershipsError.message) };
    }

    if (!memberships || memberships.length === 0) {
      return { chats: [], error: null };
    }

    const typedMemberships = memberships as unknown as {
      chat_id: string;
      user_id: string;
      chats: Chat;
    }[];

    // Get unique chat IDs
    const chatIds = [...new Set(typedMemberships.map((m) => m.chat_id))];

    // Get all members for these chats
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

    // Get last message for each chat
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false });

    const typedMessages = (lastMessages || []) as unknown as Message[];

    // Get message counts per chat
    const messageCounts = new Map<string, number>();
    for (const chatId of chatIds) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId);
      messageCounts.set(chatId, count || 0);
    }

    // Group members by chat
    const membersByChat = new Map<string, { chat_id: string; user_id: string; user: User }[]>();
    for (const member of typedAllMembers) {
      const chatMembers = membersByChat.get(member.chat_id) || [];
      chatMembers.push(member);
      membersByChat.set(member.chat_id, chatMembers);
    }

    // Get last message per chat
    const lastMessageByChat = new Map<string, Message>();
    for (const msg of typedMessages) {
      if (!lastMessageByChat.has(msg.chat_id)) {
        lastMessageByChat.set(msg.chat_id, msg);
      }
    }

    // Build chat overview list
    const chats: TexterChatOverview[] = [];

    for (const membership of typedMemberships) {
      const chat = membership.chats;
      const texter = typedTexters.find((t) => t.id === membership.user_id);
      if (!texter) continue;

      const chatMembers = membersByChat.get(membership.chat_id) || [];
      const otherMembers = chatMembers
        .filter((m) => m.user_id !== texter.id)
        .map((m) => m.user);

      chats.push({
        chat,
        texter,
        otherMembers,
        lastMessage: lastMessageByChat.get(chat.id),
        messageCount: messageCounts.get(chat.id) || 0,
      });
    }

    // Sort by last message time (most recent first)
    chats.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || a.chat.created_at;
      const bTime = b.lastMessage?.created_at || b.chat.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
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
        sender:users (*)
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
