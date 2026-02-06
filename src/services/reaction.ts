import { supabase } from './supabase';
import { type MessageReaction, type User } from '../types/database';

export interface ReactionWithUser extends MessageReaction {
  user: User;
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  users: User[];
  hasReacted: boolean;
}

/**
 * Add a reaction to a message.
 */
export async function addReaction(
  messageId: string,
  emoji: string
): Promise<{ reaction: MessageReaction | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { reaction: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      } as never)
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (already reacted with this emoji)
      if (error.code === '23505') {
        return { reaction: null, error: new Error('Already reacted with this emoji') };
      }
      return { reaction: null, error: new Error(error.message) };
    }

    return { reaction: data as unknown as MessageReaction, error: null };
  } catch (err) {
    return {
      reaction: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Remove a reaction from a message.
 */
export async function removeReaction(
  messageId: string,
  emoji: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);

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
 * Toggle a reaction on a message (add if not present, remove if present).
 */
export async function toggleReaction(
  messageId: string,
  emoji: string
): Promise<{ added: boolean; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { added: false, error: new Error('Not authenticated') };
    }

    // Check if reaction exists
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      const { error } = await removeReaction(messageId, emoji);
      return { added: false, error };
    } else {
      const { error } = await addReaction(messageId, emoji);
      return { added: true, error };
    }
  } catch (err) {
    return {
      added: false,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all reactions for a message, grouped by emoji.
 */
export async function getReactions(
  messageId: string
): Promise<{ reactions: GroupedReaction[]; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('message_reactions')
      .select(`
        *,
        user:users (*)
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      return { reactions: [], error: new Error(error.message) };
    }

    const typedData = (data || []) as unknown as ReactionWithUser[];

    // Group reactions by emoji
    const groupedMap = new Map<string, GroupedReaction>();

    for (const reaction of typedData) {
      const existing = groupedMap.get(reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.users.push(reaction.user);
        if (user && reaction.user_id === user.id) {
          existing.hasReacted = true;
        }
      } else {
        groupedMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.user],
          hasReacted: user ? reaction.user_id === user.id : false,
        });
      }
    }

    return { reactions: Array.from(groupedMap.values()), error: null };
  } catch (err) {
    return {
      reactions: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get reactions for multiple messages at once (for efficient loading).
 */
export async function getReactionsForMessages(
  messageIds: string[]
): Promise<{ reactionsByMessage: Map<string, GroupedReaction[]>; error: Error | null }> {
  try {
    if (messageIds.length === 0) {
      return { reactionsByMessage: new Map(), error: null };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('message_reactions')
      .select(`
        *,
        user:users (*)
      `)
      .in('message_id', messageIds)
      .order('created_at', { ascending: true });

    if (error) {
      return { reactionsByMessage: new Map(), error: new Error(error.message) };
    }

    const typedData = (data || []) as unknown as ReactionWithUser[];

    // Group by message, then by emoji
    const reactionsByMessage = new Map<string, GroupedReaction[]>();

    for (const reaction of typedData) {
      let messageReactions = reactionsByMessage.get(reaction.message_id);
      if (!messageReactions) {
        messageReactions = [];
        reactionsByMessage.set(reaction.message_id, messageReactions);
      }

      const existingEmoji = messageReactions.find((r) => r.emoji === reaction.emoji);
      if (existingEmoji) {
        existingEmoji.count += 1;
        existingEmoji.users.push(reaction.user);
        if (user && reaction.user_id === user.id) {
          existingEmoji.hasReacted = true;
        }
      } else {
        messageReactions.push({
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.user],
          hasReacted: user ? reaction.user_id === user.id : false,
        });
      }
    }

    return { reactionsByMessage, error: null };
  } catch (err) {
    return {
      reactionsByMessage: new Map(),
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Default quick reaction emojis.
 */
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
