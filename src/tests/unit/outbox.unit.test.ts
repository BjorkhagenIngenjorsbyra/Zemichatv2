import { describe, it, expect, beforeEach } from 'vitest';
import {
  Outbox,
  memoryStore,
  type OutboxItem,
  type SendFn,
  type SendResult,
} from '../../services/outbox';

/** Build an Outbox with a scripted send function and deterministic ids. */
function makeOutbox(send: SendFn, opts: Partial<{ maxAttempts: number }> = {}) {
  let seq = 0;
  const store = memoryStore();
  const ob = new Outbox({
    send,
    store,
    maxAttempts: opts.maxAttempts ?? 6,
    now: () => 1_000,
    newId: () => `id-${++seq}`,
    backoffMs: () => 0,
  });
  return { ob, store };
}

const ok: SendResult = { ok: true };
const transient: SendResult = { ok: false, retriable: true };
const permanent: SendResult = { ok: false, retriable: false };

describe('Outbox', () => {
  it('enqueue returns a pending item with a generated id and persists it', () => {
    const { ob, store } = makeOutbox(async () => ok);
    const item = ob.enqueue({ chatId: 'c1', content: 'hi' });
    expect(item.status).toBe('pending');
    expect(item.id).toBe('id-1');
    expect(ob.pending()).toHaveLength(1);
    expect(store.load()).toHaveLength(1);
  });

  it('flush marks a successful send as sent', async () => {
    const { ob } = makeOutbox(async () => ok);
    ob.enqueue({ chatId: 'c1', content: 'hi' });
    await ob.flush();
    expect(ob.pending()).toHaveLength(0);
    expect(ob.all()[0].status).toBe('sent');
  });

  it('transient failure stays pending and succeeds on a later flush', async () => {
    let calls = 0;
    const send: SendFn = async () => (++calls < 3 ? transient : ok);
    const { ob } = makeOutbox(send);
    ob.enqueue({ chatId: 'c1', content: 'hi' });
    await ob.flush(); // attempt 1 -> transient
    expect(ob.all()[0].status).toBe('pending');
    await ob.flush(); // attempt 2 -> transient
    expect(ob.all()[0].status).toBe('pending');
    await ob.flush(); // attempt 3 -> ok
    expect(ob.all()[0].status).toBe('sent');
    expect(ob.all()[0].attempts).toBe(3);
  });

  it('permanent failure is marked failed immediately', async () => {
    const { ob } = makeOutbox(async () => permanent);
    ob.enqueue({ chatId: 'c1', content: 'nope' });
    await ob.flush();
    expect(ob.failed()).toHaveLength(1);
  });

  it('gives up after maxAttempts of transient failures', async () => {
    const { ob } = makeOutbox(async () => transient, { maxAttempts: 3 });
    ob.enqueue({ chatId: 'c1', content: 'hi' });
    await ob.flush();
    await ob.flush();
    expect(ob.all()[0].status).toBe('pending');
    await ob.flush(); // 3rd attempt hits the cap
    expect(ob.all()[0].status).toBe('failed');
    expect(ob.all()[0].attempts).toBe(3);
  });

  it('a thrown send is treated as a transient failure', async () => {
    let calls = 0;
    const send: SendFn = async () => {
      if (++calls === 1) throw new Error('network down');
      return ok;
    };
    const { ob } = makeOutbox(send);
    ob.enqueue({ chatId: 'c1', content: 'hi' });
    await ob.flush();
    expect(ob.all()[0].status).toBe('pending');
    await ob.flush();
    expect(ob.all()[0].status).toBe('sent');
  });

  it('enqueue is idempotent on id', () => {
    const { ob } = makeOutbox(async () => ok);
    ob.enqueue({ id: 'fixed', chatId: 'c1', content: 'a' });
    ob.enqueue({ id: 'fixed', chatId: 'c1', content: 'a' });
    expect(ob.all()).toHaveLength(1);
  });

  it('retry() re-queues a failed item', async () => {
    let calls = 0;
    const send: SendFn = async () => (++calls === 1 ? permanent : ok);
    const { ob } = makeOutbox(send);
    const item = ob.enqueue({ chatId: 'c1', content: 'hi' });
    await ob.flush();
    expect(ob.all()[0].status).toBe('failed');
    ob.retry(item.id);
    expect(ob.all()[0].status).toBe('pending');
    await ob.flush();
    expect(ob.all()[0].status).toBe('sent');
  });

  it('survives a restart: a new Outbox loads persisted pending items', async () => {
    const store = memoryStore();
    const first = new Outbox({ send: async () => ok, store, newId: () => 'persist-1' });
    first.enqueue({ chatId: 'c1', content: 'hi' });

    // New instance over the same store (simulates app restart).
    const second = new Outbox({ send: async () => ok, store });
    expect(second.pending()).toHaveLength(1);
    await second.flush();
    expect(second.all()[0].status).toBe('sent');
  });

  it('clearSent removes only sent items', async () => {
    const { ob } = makeOutbox(async () => ok);
    ob.enqueue({ chatId: 'c1', content: 'a' });
    await ob.flush();
    ob.enqueue({ chatId: 'c1', content: 'b' }); // pending
    ob.clearSent();
    const items: OutboxItem[] = ob.all();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
  });
});
