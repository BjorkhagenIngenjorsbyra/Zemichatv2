import { supabase } from './supabase';
import { MessageType, type Message, type User } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface MessageWithSender extends Message {
  sender: User;
  reply_to?: Message & { sender: User };
}

export interface SendMessageData {
  chatId: string;
  content?: string;
  type?: MessageType;
  replyToId?: string;
  mediaUrl?: string;
  mediaMetadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  message: Message | null;
  error: Error | null;
}

/**
 * Get messages for a chat.
 */
export async function getChatMessages(
  chatId: string,
  limit = 50,
  before?: string
): Promise<{ messages: MessageWithSender[]; error: Error | null }> {
  try {
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey (*)
      `)
      .eq('chat_id', chatId)
      .or('deleted_at.is.null,deleted_for_all.eq.true')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      return { messages: [], error: new Error(error.message) };
    }

    const messages = (data || []) as unknown as MessageWithSender[];

    // Fetch reply_to messages separately for messages that have replies
    const replyIds = messages
      .filter((m) => m.reply_to_id)
      .map((m) => m.reply_to_id as string);

    if (replyIds.length > 0) {
      const { data: replyMessages } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey (*)
        `)
        .in('id', replyIds);

      if (replyMessages) {
        const replyMap = new Map(
          (replyMessages as unknown as MessageWithSender[]).map((m) => [m.id, m])
        );
        for (const msg of messages) {
          if (msg.reply_to_id && replyMap.has(msg.reply_to_id)) {
            msg.reply_to = replyMap.get(msg.reply_to_id);
          }
        }
      }
    }

    // Reverse to get oldest first
    return { messages: messages.reverse(), error: null };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Send a message in a chat.
 */
export async function sendMessage({
  chatId,
  content,
  type = MessageType.TEXT,
  replyToId,
  mediaUrl,
  mediaMetadata,
}: SendMessageData): Promise<SendMessageResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { message: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        type,
        content: content || null,
        reply_to_id: replyToId || null,
        media_url: mediaUrl || null,
        media_metadata: mediaMetadata || null,
      } as never)
      .select()
      .single();

    if (error) {
      return { message: null, error: new Error(error.message) };
    }

    return { message: data as unknown as Message, error: null };
  } catch (err) {
    return {
      message: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Subscribe to new and updated messages in a chat.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  chatId: string,
  onMessage: (message: MessageWithSender) => void,
  onUpdate?: (message: MessageWithSender) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${chatId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      },
      async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_id_fkey (*)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage(data as unknown as MessageWithSender);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      },
      async (payload) => {
        if (!onUpdate) return;
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_id_fkey (*)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onUpdate(data as unknown as MessageWithSender);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Soft-delete a message.
 */
export async function deleteMessage(
  messageId: string
): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    } as never)
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Edit a message (within 15 min window).
 */
export async function editMessage(
  messageId: string,
  newContent: string
): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('messages')
    .update({
      content: newContent,
      is_edited: true,
      edited_at: new Date().toISOString(),
    } as never)
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Delete a message for all participants.
 * Sets deleted_at and clears content to show placeholder.
 */
export async function deleteMessageForAll(
  messageId: string
): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_for_all: true,
    } as never)
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Forward a message to another chat.
 */
export async function forwardMessage(
  originalMessage: { content: string | null; type: MessageType; media_url: string | null; media_metadata: Record<string, unknown> | null; id: string },
  targetChatId: string
): Promise<SendMessageResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: null, error: new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: targetChatId,
      sender_id: user.id,
      type: originalMessage.type,
      content: originalMessage.content || null,
      media_url: originalMessage.media_url || null,
      media_metadata: originalMessage.media_metadata || null,
      forwarded_from_id: originalMessage.id,
    } as never)
    .select()
    .single();

  if (error) {
    return { message: null, error: new Error(error.message) };
  }

  return { message: data as unknown as Message, error: null };
}

/**
 * Check if a message can be edited (within 15 min window).
 */
export function canEditMessage(message: { sender_id: string; created_at: string; deleted_at: string | null }, userId: string): boolean {
  if (message.sender_id !== userId) return false;
  if (message.deleted_at) return false;
  const elapsed = Date.now() - new Date(message.created_at).getTime();
  return elapsed < 15 * 60 * 1000; // 15 minutes
}

/**
 * Check if a message can be deleted for all (within 1 hour window).
 */
export function canDeleteForAll(message: { sender_id: string; created_at: string; deleted_at: string | null }, userId: string): boolean {
  if (message.sender_id !== userId) return false;
  if (message.deleted_at) return false;
  const elapsed = Date.now() - new Date(message.created_at).getTime();
  return elapsed < 60 * 60 * 1000; // 1 hour
}
