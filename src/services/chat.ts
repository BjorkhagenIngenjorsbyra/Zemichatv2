import { supabase } from './supabase';
import { type Chat, type ChatMember, type Message, type User } from '../types/database';

export interface ChatWithDetails extends Chat {
  members: (ChatMember & { user: User })[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  markedUnread: boolean;
}

export interface CreateChatData {
  memberIds: string[];
  name?: string;
  isGroup?: boolean;
}

export interface CreateChatResult {
  chat: Chat | null;
  error: Error | null;
}

// Helper types for Supabase query results
interface ChatMemberWithChat {
  chat_id: string;
  unread_count: number;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  marked_unread: boolean;
  chats: Chat;
}

interface ChatMemberWithUser extends ChatMember {
  user: User;
}

/**
 * Get all chats for the current user with member details and last message.
 */
export async function getMyChats(): Promise<{ chats: ChatWithDetails[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { chats: [], error: new Error('Not authenticated') };
    }

    // Get chat IDs where current user is a member
    const { data: memberData, error: memberError } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        unread_count,
        is_pinned,
        is_archived,
        is_muted,
        marked_unread,
        chats (
          id,
          name,
          description,
          avatar_url,
          is_group,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .is('left_at', null)
      .order('is_pinned', { ascending: false });

    if (memberError) {
      return { chats: [], error: new Error(memberError.message) };
    }

    if (!memberData || memberData.length === 0) {
      return { chats: [], error: null };
    }

    const typedMemberData = memberData as unknown as ChatMemberWithChat[];
    const chatIds = typedMemberData.map((m) => m.chat_id);

    // Get all members for these chats with user details
    const { data: allMembers, error: allMembersError } = await supabase
      .from('chat_members')
      .select(`
        *,
        user:users (*)
      `)
      .in('chat_id', chatIds)
      .is('left_at', null);

    if (allMembersError) {
      return { chats: [], error: new Error(allMembersError.message) };
    }

    // Get last message for each chat
    const { data: lastMessages, error: lastMessagesError } = await supabase
      .from('messages')
      .select('*')
      .in('chat_id', chatIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (lastMessagesError) {
      console.error('Failed to get last messages:', lastMessagesError);
    }

    const typedMembers = (allMembers || []) as unknown as ChatMemberWithUser[];
    const typedMessages = (lastMessages || []) as unknown as Message[];

    // Group members by chat
    const membersByChat = new Map<string, ChatMemberWithUser[]>();
    for (const member of typedMembers) {
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

    // Build chat list with details
    const chats: ChatWithDetails[] = typedMemberData.map((m) => {
      const chat = m.chats;
      return {
        ...chat,
        members: membersByChat.get(m.chat_id) || [],
        lastMessage: lastMessageByChat.get(m.chat_id),
        unreadCount: m.unread_count,
        isPinned: m.is_pinned,
        isArchived: m.is_archived,
        isMuted: m.is_muted,
        markedUnread: m.marked_unread,
      };
    });

    // Sort by last message time (most recent first)
    chats.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || a.created_at;
      const bTime = b.lastMessage?.created_at || b.created_at;
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
 * Create a new chat (1-on-1 or group).
 */
export async function createChat({
  memberIds,
  name,
  isGroup = false,
}: CreateChatData): Promise<CreateChatResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { chat: null, error: new Error('Not authenticated') };
    }

    // For 1-on-1 chats, check if one already exists
    if (!isGroup && memberIds.length === 1) {
      const existingChat = await findExisting1on1Chat(memberIds[0]);
      if (existingChat) {
        return { chat: existingChat, error: null };
      }
    }

    // Create the chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert({
        name: name || null,
        is_group: isGroup,
        created_by: user.id,
      } as never)
      .select()
      .single();

    if (chatError) {
      return { chat: null, error: new Error(chatError.message) };
    }

    const chat = chatData as unknown as Chat;

    // Add all members including self
    const allMemberIds = [user.id, ...memberIds.filter((id) => id !== user.id)];

    const memberInserts = allMemberIds.map((userId) => ({
      chat_id: chat.id,
      user_id: userId,
    }));

    const { error: membersError } = await supabase
      .from('chat_members')
      .insert(memberInserts as never);

    if (membersError) {
      // Cleanup: delete the chat
      await supabase.from('chats').delete().eq('id', chat.id);
      return { chat: null, error: new Error(membersError.message) };
    }

    return { chat, error: null };
  } catch (err) {
    return {
      chat: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Add a member to an existing chat.
 */
export async function addMemberToChat(
  chatId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('add_member_to_chat' as never, {
    p_chat_id: chatId,
    p_user_id: userId,
  } as never);

  if (error) {
    return { error: new Error((error as { message: string }).message) };
  }

  return { error: null };
}

/**
 * Find an existing 1-on-1 chat with a specific user.
 */
async function findExisting1on1Chat(otherUserId: string): Promise<Chat | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Find chats where current user is a member and it's not a group
  const { data } = await supabase
    .from('chats')
    .select(`
      *,
      chat_members!inner (user_id)
    `)
    .eq('is_group', false);

  if (!data) return null;

  const typedData = data as unknown as (Chat & { chat_members: { user_id: string }[] })[];

  for (const chat of typedData) {
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', chat.id)
      .is('left_at', null);

    const typedMembers = members as unknown as { user_id: string }[] | null;

    if (
      typedMembers &&
      typedMembers.length === 2 &&
      typedMembers.some((m) => m.user_id === user.id) &&
      typedMembers.some((m) => m.user_id === otherUserId)
    ) {
      return chat;
    }
  }

  return null;
}

/**
 * Get a single chat with all details.
 */
export async function getChat(
  chatId: string
): Promise<{ chat: ChatWithDetails | null; error: Error | null }> {
  try {
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError) {
      return { chat: null, error: new Error(chatError.message) };
    }

    const { data: members, error: membersError } = await supabase
      .from('chat_members')
      .select(`
        *,
        user:users (*)
      `)
      .eq('chat_id', chatId)
      .is('left_at', null);

    if (membersError) {
      return { chat: null, error: new Error(membersError.message) };
    }

    const { data: currentMember } = await supabase
      .from('chat_members')
      .select('unread_count, is_pinned, is_archived, is_muted, marked_unread')
      .eq('chat_id', chatId)
      .single();

    const typedCurrentMember = currentMember as unknown as {
      unread_count: number;
      is_pinned: boolean;
      is_archived: boolean;
      is_muted: boolean;
      marked_unread: boolean;
    } | null;

    return {
      chat: {
        ...(chatData as unknown as Chat),
        members: (members || []) as unknown as ChatMemberWithUser[],
        unreadCount: typedCurrentMember?.unread_count || 0,
        isPinned: typedCurrentMember?.is_pinned || false,
        isArchived: typedCurrentMember?.is_archived || false,
        isMuted: typedCurrentMember?.is_muted || false,
        markedUnread: typedCurrentMember?.marked_unread || false,
      },
      error: null,
    };
  } catch (err) {
    return {
      chat: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Mark a chat as read (reset unread count).
 */
export async function markChatAsRead(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ unread_count: 0, marked_unread: false, last_read_at: new Date().toISOString() } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Pin a chat.
 */
export async function pinChat(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ is_pinned: true } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Unpin a chat.
 */
export async function unpinChat(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ is_pinned: false } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Archive a chat.
 */
export async function archiveChat(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ is_archived: true } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Unarchive a chat.
 */
export async function unarchiveChat(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ is_archived: false } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Mute a chat with optional duration.
 */
export async function muteChat(
  chatId: string,
  duration?: 'hour' | '8hours' | 'week' | 'always'
): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  let mutedUntil: string | null = null;
  if (duration && duration !== 'always') {
    const now = new Date();
    switch (duration) {
      case 'hour':
        now.setHours(now.getHours() + 1);
        break;
      case '8hours':
        now.setHours(now.getHours() + 8);
        break;
      case 'week':
        now.setDate(now.getDate() + 7);
        break;
    }
    mutedUntil = now.toISOString();
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ is_muted: true, muted_until: mutedUntil } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Unmute a chat.
 */
export async function unmuteChat(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ is_muted: false, muted_until: null } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Mark a chat as unread (reminder to respond later).
 */
export async function markChatUnread(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ marked_unread: true } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Clear the marked_unread flag.
 */
export async function clearMarkedUnread(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('chat_members')
    .update({ marked_unread: false } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Pin a chat (max 3 pinned).
 */
export async function pinChatWithLimit(chatId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  // Check current pinned count
  const { data: pinned } = await supabase
    .from('chat_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_pinned', true)
    .is('left_at', null);

  if (pinned && pinned.length >= 3) {
    return { error: new Error('Maximum 3 pinned chats allowed') };
  }

  return pinChat(chatId);
}
