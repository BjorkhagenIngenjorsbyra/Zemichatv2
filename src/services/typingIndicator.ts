import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface TypingEvent {
  userId: string;
  displayName: string;
}

let typingChannels = new Map<string, RealtimeChannel>();
let lastTypingSent = new Map<string, number>();

const TYPING_DEBOUNCE_MS = 2000;
const TYPING_TIMEOUT_MS = 3000;

/**
 * Send a typing indicator to a chat channel via Realtime Broadcast.
 * Debounced to max 1 event per 2 seconds per chat.
 */
export function sendTyping(chatId: string, userId: string, displayName: string): void {
  const now = Date.now();
  const lastSent = lastTypingSent.get(chatId) || 0;

  if (now - lastSent < TYPING_DEBOUNCE_MS) return;

  lastTypingSent.set(chatId, now);

  const channel = getOrCreateChannel(chatId);
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId, displayName },
  });
}

/**
 * Subscribe to typing indicators in a chat.
 * Returns an unsubscribe function.
 */
export function subscribeToTyping(
  chatId: string,
  currentUserId: string,
  onTyping: (typers: TypingEvent[]) => void
): () => void {
  const channel = getOrCreateChannel(chatId);
  const activeTypers = new Map<string, { event: TypingEvent; timeout: ReturnType<typeof setTimeout> }>();

  channel.on('broadcast', { event: 'typing' }, (payload) => {
    const data = payload.payload as TypingEvent;
    if (data.userId === currentUserId) return;

    // Clear existing timeout for this user
    const existing = activeTypers.get(data.userId);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Set new timeout to remove after TYPING_TIMEOUT_MS
    const timeout = setTimeout(() => {
      activeTypers.delete(data.userId);
      onTyping(Array.from(activeTypers.values()).map((v) => v.event));
    }, TYPING_TIMEOUT_MS);

    activeTypers.set(data.userId, { event: data, timeout });
    onTyping(Array.from(activeTypers.values()).map((v) => v.event));
  });

  return () => {
    // Clear all timeouts
    for (const entry of activeTypers.values()) {
      clearTimeout(entry.timeout);
    }
    activeTypers.clear();
  };
}

function getOrCreateChannel(chatId: string): RealtimeChannel {
  let channel = typingChannels.get(chatId);
  if (!channel) {
    channel = supabase.channel(`typing:${chatId}`);
    channel.subscribe();
    typingChannels.set(chatId, channel);
  }
  return channel;
}

/**
 * Cleanup typing channel for a chat.
 */
export function cleanupTypingChannel(chatId: string): void {
  const channel = typingChannels.get(chatId);
  if (channel) {
    supabase.removeChannel(channel);
    typingChannels.delete(chatId);
  }
  lastTypingSent.delete(chatId);
}
