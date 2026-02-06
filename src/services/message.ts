import { supabase } from './supabase';
import { MessageType, type Message, type User } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface MessageWithSender extends Message {
  sender: User;
}

export interface SendMessageData {
  chatId: string;
  content: string;
  type?: MessageType;
  replyToId?: string;
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      return { messages: [], error: new Error(error.message) };
    }

    // Reverse to get oldest first
    const messages = (data || []).reverse() as unknown as MessageWithSender[];
    return { messages, error: null };
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
        content,
        reply_to_id: replyToId || null,
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
 * Subscribe to new messages in a chat.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  chatId: string,
  onMessage: (message: MessageWithSender) => void
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
        // Fetch the message with sender info
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
 * Edit a message.
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
