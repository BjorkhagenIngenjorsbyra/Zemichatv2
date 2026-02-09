import { supabase } from './supabase';
import type { MessageReadReceipt } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Insert a read receipt for a message (upsert - idempotent).
 */
export async function insertReadReceipt(
  messageId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('message_read_receipts')
      .upsert(
        { message_id: messageId, user_id: user.id } as never,
        { onConflict: 'message_id,user_id' }
      );

    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

/**
 * Insert read receipts for multiple messages at once.
 */
export async function insertReadReceipts(
  messageIds: string[]
): Promise<{ error: Error | null }> {
  if (messageIds.length === 0) return { error: null };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: new Error('Not authenticated') };

    const rows = messageIds.map((messageId) => ({
      message_id: messageId,
      user_id: user.id,
    }));

    const { error } = await supabase
      .from('message_read_receipts')
      .upsert(rows as never[], { onConflict: 'message_id,user_id' });

    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export interface ReadReceiptSummary {
  messageId: string;
  readBy: string[]; // user IDs that have read this message
  totalMembers: number;
}

/**
 * Get read receipts for messages in a chat.
 */
export async function getReadReceiptsForMessages(
  messageIds: string[]
): Promise<{ receipts: Map<string, string[]>; error: Error | null }> {
  if (messageIds.length === 0) return { receipts: new Map(), error: null };

  try {
    const { data, error } = await supabase
      .from('message_read_receipts')
      .select('message_id, user_id')
      .in('message_id', messageIds);

    if (error) return { receipts: new Map(), error: new Error(error.message) };

    const receipts = new Map<string, string[]>();
    for (const row of (data || []) as MessageReadReceipt[]) {
      const existing = receipts.get(row.message_id) || [];
      existing.push(row.user_id);
      receipts.set(row.message_id, existing);
    }

    return { receipts, error: null };
  } catch (err) {
    return {
      receipts: new Map(),
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Subscribe to read receipt changes for a chat.
 * Returns an unsubscribe function.
 */
export function subscribeToReadReceipts(
  chatId: string,
  onReceipt: (receipt: { messageId: string; userId: string }) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`read_receipts:${chatId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_read_receipts',
      },
      (payload) => {
        const receipt = payload.new as { message_id: string; user_id: string };
        onReceipt({
          messageId: receipt.message_id,
          userId: receipt.user_id,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
