import { supabase } from './supabase';
import { type Message, type User, type Chat } from '../types/database';

// ============================================================
// Types
// ============================================================

export interface SearchResultMessage extends Message {
  sender: User;
  chat: Chat;
}

export interface SearchResult {
  messages: SearchResultMessage[];
  total: number;
}

// ============================================================
// Search Functions
// ============================================================

/**
 * Search messages within a specific chat.
 */
export async function searchInChat(
  chatId: string,
  query: string,
  limit = 50
): Promise<{ results: SearchResultMessage[]; error: Error | null }> {
  try {
    if (!query || query.trim().length === 0) {
      return { results: [], error: null };
    }

    const searchTerm = `%${query.toLowerCase()}%`;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (*),
        chat:chats!messages_chat_id_fkey (*)
      `)
      .eq('chat_id', chatId)
      .is('deleted_at', null)
      .ilike('content', searchTerm)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { results: [], error: new Error(error.message) };
    }

    return { results: (data || []) as unknown as SearchResultMessage[], error: null };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Search messages across all user's chats.
 */
export async function searchGlobal(
  query: string,
  limit = 50
): Promise<{ results: SearchResultMessage[]; error: Error | null }> {
  try {
    if (!query || query.trim().length === 0) {
      return { results: [], error: null };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { results: [], error: new Error('Not authenticated') };
    }

    // First, get all chat IDs the user is a member of
    const { data: memberData, error: memberError } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id)
      .is('left_at', null);

    if (memberError) {
      return { results: [], error: new Error(memberError.message) };
    }

    if (!memberData || memberData.length === 0) {
      return { results: [], error: null };
    }

    const typedMemberData = memberData as unknown as { chat_id: string }[];
    const chatIds = typedMemberData.map((m) => m.chat_id);
    const searchTerm = `%${query.toLowerCase()}%`;

    // Search messages in those chats
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (*),
        chat:chats!messages_chat_id_fkey (*)
      `)
      .in('chat_id', chatIds)
      .is('deleted_at', null)
      .ilike('content', searchTerm)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { results: [], error: new Error(error.message) };
    }

    return { results: (data || []) as unknown as SearchResultMessage[], error: null };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Search messages by date range within a chat.
 */
export async function searchByDateRange(
  chatId: string,
  startDate: Date,
  endDate: Date,
  limit = 100
): Promise<{ results: SearchResultMessage[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (*),
        chat:chats!messages_chat_id_fkey (*)
      `)
      .eq('chat_id', chatId)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { results: [], error: new Error(error.message) };
    }

    return { results: (data || []) as unknown as SearchResultMessage[], error: null };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Search messages from a specific sender within a chat.
 */
export async function searchBySender(
  chatId: string,
  senderId: string,
  query?: string,
  limit = 50
): Promise<{ results: SearchResultMessage[]; error: Error | null }> {
  try {
    let queryBuilder = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (*),
        chat:chats!messages_chat_id_fkey (*)
      `)
      .eq('chat_id', chatId)
      .eq('sender_id', senderId)
      .is('deleted_at', null);

    if (query && query.trim().length > 0) {
      const searchTerm = `%${query.toLowerCase()}%`;
      queryBuilder = queryBuilder.ilike('content', searchTerm);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { results: [], error: new Error(error.message) };
    }

    return { results: (data || []) as unknown as SearchResultMessage[], error: null };
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get recent messages that match a query for autocomplete suggestions.
 */
export async function getSearchSuggestions(
  query: string,
  limit = 5
): Promise<{ suggestions: string[]; error: Error | null }> {
  try {
    if (!query || query.trim().length < 2) {
      return { suggestions: [], error: null };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { suggestions: [], error: new Error('Not authenticated') };
    }

    // Get user's chats
    const { data: memberData } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id)
      .is('left_at', null);

    if (!memberData || memberData.length === 0) {
      return { suggestions: [], error: null };
    }

    const typedMemberData = memberData as unknown as { chat_id: string }[];
    const chatIds = typedMemberData.map((m) => m.chat_id);
    const searchTerm = `%${query.toLowerCase()}%`;

    // Find messages that start with the query
    const { data, error } = await supabase
      .from('messages')
      .select('content')
      .in('chat_id', chatIds)
      .is('deleted_at', null)
      .ilike('content', searchTerm)
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit * 3); // Get more than needed to filter unique

    if (error) {
      return { suggestions: [], error: new Error(error.message) };
    }

    // Extract unique content snippets
    const seen = new Set<string>();
    const suggestions: string[] = [];

    const typedData = (data || []) as unknown as { content: string }[];
    for (const msg of typedData) {
      const content = msg.content?.toLowerCase();
      if (content && !seen.has(content)) {
        seen.add(content);
        // Take first 50 chars as suggestion
        suggestions.push(msg.content.slice(0, 50));
        if (suggestions.length >= limit) break;
      }
    }

    return { suggestions, error: null };
  } catch (err) {
    return {
      suggestions: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
