/**
 * Send outbox — reliability/offline-first (Phase B1).
 *
 * A small, persisted queue that makes message sending feel instant and survive
 * flaky networks / app restarts:
 *  - enqueue() records a message with a client-generated id and returns immediately
 *    (the UI shows it optimistically as "pending").
 *  - flush() attempts the pending sends; transient failures stay queued and are
 *    retried with exponential backoff; permanent failures (or too many attempts)
 *    are marked "failed" for the UI to surface a retry affordance.
 *  - The client id makes retries idempotent (see services/message.ts sendMessage),
 *    so a resend after a lost response never duplicates a message.
 *
 * Storage and the send function are injected, so the core is unit-testable with no
 * database, network, or Capacitor dependency.
 */

export type OutboxStatus = 'pending' | 'sent' | 'failed';

export interface OutboxItem {
  id: string;
  chatId: string;
  content?: string;
  type: string;
  replyToId?: string;
  attempts: number;
  status: OutboxStatus;
  createdAt: number;
}

export interface OutboxInput {
  id?: string;
  chatId: string;
  content?: string;
  type?: string;
  replyToId?: string;
}

/** Outcome of a single send attempt. `retriable` only matters when ok=false. */
export type SendResult = { ok: true } | { ok: false; retriable: boolean };
export type SendFn = (item: OutboxItem) => Promise<SendResult>;

export interface OutboxStore {
  load(): OutboxItem[];
  save(items: OutboxItem[]): void;
}

export interface OutboxOptions {
  send: SendFn;
  store: OutboxStore;
  maxAttempts?: number;
  /** Backoff (ms) before the Nth retry (n = attempts already made). */
  backoffMs?: (attempts: number) => number;
  now?: () => number;
  newId?: () => string;
}

const DEFAULT_MAX_ATTEMPTS = 6;
const defaultBackoff = (attempts: number): number => Math.min(30_000, 500 * 2 ** attempts);

/** In-memory store (handy for tests / SSR). */
export function memoryStore(initial: OutboxItem[] = []): OutboxStore {
  let items = [...initial];
  return {
    load: () => [...items],
    save: (next) => {
      items = [...next];
    },
  };
}

/** localStorage-backed store (works in browser + Capacitor webview). */
export function localStorageStore(key = 'zemichat.outbox'): OutboxStore {
  return {
    load() {
      try {
        return JSON.parse(localStorage.getItem(key) ?? '[]') as OutboxItem[];
      } catch {
        return [];
      }
    },
    save(items) {
      try {
        localStorage.setItem(key, JSON.stringify(items));
      } catch {
        /* storage full / unavailable — best effort */
      }
    },
  };
}

export class Outbox {
  private items: OutboxItem[];
  private listeners = new Set<(items: OutboxItem[]) => void>();
  private readonly maxAttempts: number;
  private readonly backoffMs: (attempts: number) => number;
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(private readonly opts: OutboxOptions) {
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.backoffMs = opts.backoffMs ?? defaultBackoff;
    this.now = opts.now ?? (() => Date.now());
    this.newId = opts.newId ?? (() => crypto.randomUUID());
    this.items = opts.store.load();
  }

  all(): OutboxItem[] {
    return this.items.map((i) => ({ ...i }));
  }

  pending(): OutboxItem[] {
    return this.items.filter((i) => i.status === 'pending');
  }

  failed(): OutboxItem[] {
    return this.items.filter((i) => i.status === 'failed');
  }

  subscribe(fn: (items: OutboxItem[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.opts.store.save(this.items);
    const snapshot = this.all();
    for (const l of this.listeners) l(snapshot);
  }

  /** Queue a message. Idempotent on id — enqueuing the same id twice is a no-op. */
  enqueue(input: OutboxInput): OutboxItem {
    const id = input.id ?? this.newId();
    const existing = this.items.find((i) => i.id === id);
    if (existing) return { ...existing };
    const item: OutboxItem = {
      id,
      chatId: input.chatId,
      content: input.content,
      type: input.type ?? 'text',
      replyToId: input.replyToId,
      attempts: 0,
      status: 'pending',
      createdAt: this.now(),
    };
    this.items.push(item);
    this.emit();
    return { ...item };
  }

  /** Attempt every pending item once. Transient failures stay pending. */
  async flush(): Promise<void> {
    for (const item of this.items) {
      if (item.status !== 'pending') continue;
      item.attempts += 1;
      let res: SendResult;
      try {
        res = await this.opts.send({ ...item });
      } catch {
        res = { ok: false, retriable: true };
      }
      if (res.ok) {
        item.status = 'sent';
      } else if (!res.retriable || item.attempts >= this.maxAttempts) {
        item.status = 'failed';
      }
      this.emit();
    }
  }

  /** Re-queue a failed item for another round of attempts. */
  retry(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.attempts = 0;
      this.emit();
    }
  }

  /** Drop a queued/failed item (user discards a stuck message). */
  remove(id: string): void {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length !== before) this.emit();
  }

  /** Clear successfully-sent items from the queue. */
  clearSent(): void {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.status !== 'sent');
    if (this.items.length !== before) this.emit();
  }

  /** Suggested delay before the next flush for an item (UI/scheduler hint). */
  nextDelayMs(item: OutboxItem): number {
    return this.backoffMs(item.attempts);
  }
}
