import { supabase } from './supabase';
import { type QuickMessage, UserRole } from '../types/database';

// ============================================================
// Quick Messages Service
// ============================================================

/**
 * Get quick messages for the current user.
 */
export async function getMyQuickMessages(): Promise<{
  messages: QuickMessage[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { messages: [], error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('quick_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) {
      return { messages: [], error: new Error(error.message) };
    }

    return { messages: (data || []) as unknown as QuickMessage[], error: null };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get quick messages for a specific user (Owner viewing Texter's messages).
 */
export async function getQuickMessagesForUser(
  userId: string
): Promise<{ messages: QuickMessage[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('quick_messages')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) {
      return { messages: [], error: new Error(error.message) };
    }

    return { messages: (data || []) as unknown as QuickMessage[], error: null };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create a quick message for a user (Owner creating for Texter).
 */
export async function createQuickMessage(
  userId: string,
  content: string
): Promise<{ message: QuickMessage | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { message: null, error: new Error('Not authenticated') };
    }

    // Get the highest sort_order for this user
    const { data: existing } = await supabase
      .from('quick_messages')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const typedExisting = existing as unknown as { sort_order: number }[] | null;
    const maxOrder = typedExisting && typedExisting.length > 0 ? typedExisting[0].sort_order : 0;

    const { data, error } = await supabase
      .from('quick_messages')
      .insert({
        user_id: userId,
        created_by: user.id,
        content: content.trim(),
        sort_order: maxOrder + 1,
      } as never)
      .select()
      .single();

    if (error) {
      return { message: null, error: new Error(error.message) };
    }

    return { message: data as unknown as QuickMessage, error: null };
  } catch (err) {
    return {
      message: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Update a quick message's content.
 */
export async function updateQuickMessage(
  messageId: string,
  content: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('quick_messages')
      .update({ content: content.trim() } as never)
      .eq('id', messageId);

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
 * Delete a quick message.
 */
export async function deleteQuickMessage(
  messageId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('quick_messages')
      .delete()
      .eq('id', messageId);

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
 * Reorder quick messages by setting new sort_order values.
 */
export async function reorderQuickMessages(
  messageIds: string[]
): Promise<{ error: Error | null }> {
  try {
    // Update each message with its new sort order
    for (let i = 0; i < messageIds.length; i++) {
      const { error } = await supabase
        .from('quick_messages')
        .update({ sort_order: i + 1 } as never)
        .eq('id', messageIds[i]);

      if (error) {
        return { error: new Error(error.message) };
      }
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create default quick messages for a Texter.
 * @param texterId - The Texter's user ID
 * @param suggestions - Translated default messages from i18n (quickMessages.suggestions)
 */
export async function createDefaultQuickMessages(
  texterId: string,
  suggestions: string[]
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const inserts = suggestions.map((content, index) => ({
      user_id: texterId,
      created_by: user.id,
      content,
      sort_order: index + 1,
    }));

    const { error } = await supabase
      .from('quick_messages')
      .insert(inserts as never);

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
