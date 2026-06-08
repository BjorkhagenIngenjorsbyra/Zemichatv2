import { describe, it, expect } from 'vitest';
import { buildSendFn } from '../../services/messageOutbox';
import type { OutboxItem } from '../../services/outbox';

const item: OutboxItem = {
  id: 'm1',
  chatId: 'c1',
  content: 'hi',
  type: 'text',
  attempts: 0,
  status: 'pending',
  createdAt: 0,
};

describe('messageOutbox buildSendFn', () => {
  it('maps a successful send to ok', async () => {
    const fn = buildSendFn(async () => ({ message: { id: 'm1' } as never, error: null }));
    expect(await fn(item)).toEqual({ ok: true });
  });

  it('maps a failed send to a retriable failure', async () => {
    const fn = buildSendFn(async () => ({ message: null, error: new Error('network') }));
    expect(await fn(item)).toEqual({ ok: false, retriable: true });
  });

  it('forwards the client id so retries are idempotent', async () => {
    let seenId: string | undefined;
    const fn = buildSendFn(async (args) => {
      seenId = args.id;
      return { message: { id: args.id } as never, error: null };
    });
    await fn(item);
    expect(seenId).toBe('m1');
  });
});
