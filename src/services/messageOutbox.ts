/**
 * Wires the generic Outbox (services/outbox.ts) to the real message-send path
 * (services/message.ts). Reliability/offline-first B1c.
 *
 * - enqueueMessage() records the message (client id) and tries to send it now;
 *   a failed attempt stays queued and is retried (with backoff) on the next
 *   flush — including automatically when connectivity returns.
 * - Because sendMessage assigns/honours the client id and treats a duplicate
 *   insert as success, retries are idempotent (never duplicate a message).
 */
import { Outbox, localStorageStore, type SendFn, type SendResult, type OutboxItem, type OutboxInput } from './outbox';
import { sendMessage } from './message';
import type { MessageType } from '../types/database';

/**
 * Build the SendFn that drives one outbox item through sendMessage.
 * Factored out so it can be unit-tested with a fake sender.
 */
export function buildSendFn(
  send: typeof sendMessage = sendMessage,
): SendFn {
  return async (item: OutboxItem): Promise<SendResult> => {
    const { error } = await send({
      id: item.id,
      chatId: item.chatId,
      content: item.content,
      type: item.type as MessageType,
      replyToId: item.replyToId,
    });
    // sendMessage already maps a duplicate-id (already-sent) to success, so any
    // remaining error is treated as transient and retried — idempotency makes
    // re-sending safe, and maxAttempts bounds it.
    return error ? { ok: false, retriable: true } : { ok: true };
  };
}

export const messageOutbox = new Outbox({
  send: buildSendFn(),
  store: localStorageStore('zemichat.message-outbox'),
});

/** Enqueue a message and immediately attempt to flush the queue. */
export function enqueueMessage(input: OutboxInput): OutboxItem {
  const item = messageOutbox.enqueue(input);
  void messageOutbox.flush();
  return item;
}

let autoFlushStarted = false;

/**
 * Start background flushing: when the device comes back online, and on a slow
 * heartbeat as a safety net. Call once at app startup. Safe to call repeatedly.
 */
export function startMessageOutboxAutoFlush(intervalMs = 30_000): () => void {
  if (typeof window === 'undefined') return () => {};
  const flush = () => void messageOutbox.flush();
  if (!autoFlushStarted) {
    window.addEventListener('online', flush);
    autoFlushStarted = true;
  }
  const timer = window.setInterval(flush, intervalMs);
  // Flush once now in case there are leftovers from a previous session.
  flush();
  return () => {
    window.removeEventListener('online', flush);
    window.clearInterval(timer);
    autoFlushStarted = false;
  };
}
