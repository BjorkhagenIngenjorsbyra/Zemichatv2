// Zemichat v2 — shared presence store.
//
// Previously usePresence(userId) created, per instance, its own Supabase
// realtime channel (`presence-${userId}`), its own initial fetch and its own
// 30s interval. A member list rendering N rows therefore opened N channels
// (Supabase has per-client channel limits), ran N+1 initial queries and N
// timers. This module centralises all of that: one channel for users UPDATEs
// (RLS already limits the rows this client receives), one batched initial
// fetch via `.in()`, and one shared 30s tick. Components read it through
// useSyncExternalStore (see usePresence) so only rows whose value actually
// changed re-render — except on the shared tick, which refreshes the
// "x minutes ago" text everywhere.

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceSnapshot {
  lastSeenAt: string | null;
}

type Listener = () => void;

const lastSeen = new Map<string, string | null>();
// Cached snapshot objects so getSnapshot() returns a stable reference between
// changes (required by useSyncExternalStore to avoid render loops). Rebuilt for
// a user when their value changes, and for everyone on the shared tick.
const snapshots = new Map<string, PresenceSnapshot>();
const listeners = new Map<string, Set<Listener>>();
const refCounts = new Map<string, number>();

let channel: RealtimeChannel | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const pendingFetch = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const EMPTY_SNAPSHOT: PresenceSnapshot = { lastSeenAt: null };

function snapshotFor(userId: string): PresenceSnapshot {
  return snapshots.get(userId) ?? EMPTY_SNAPSHOT;
}

function setLastSeen(userId: string, value: string | null): void {
  lastSeen.set(userId, value);
  snapshots.set(userId, { lastSeenAt: value });
  notify(userId);
}

function notify(userId: string): void {
  const set = listeners.get(userId);
  if (set) for (const l of set) l();
}

function ensureChannel(): void {
  if (channel) return;
  // One channel for all visible users' presence. No per-id filter — RLS limits
  // realtime payloads to rows this client can SELECT, and we ignore ids nobody
  // is observing.
  channel = supabase
    .channel('presence-shared')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users' },
      (payload) => {
        const row = payload.new as { id?: string; last_seen_at?: string | null };
        if (!row?.id || !listeners.has(row.id)) return;
        if (lastSeen.get(row.id) === (row.last_seen_at ?? null)) return;
        setLastSeen(row.id, row.last_seen_at ?? null);
      }
    )
    .subscribe();
}

function ensureTick(): void {
  if (tickTimer) return;
  // One shared 30s tick: rebuild every cached snapshot (new refs) and notify so
  // relative "x minutes ago" text stays fresh across all consumers.
  tickTimer = setInterval(() => {
    for (const [userId, value] of lastSeen) {
      snapshots.set(userId, { lastSeenAt: value });
      notify(userId);
    }
  }, 30_000);
}

function teardownIfIdle(): void {
  if (refCounts.size > 0) return;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function scheduleFetch(userId: string): void {
  if (lastSeen.has(userId)) return; // already known
  pendingFetch.add(userId);
  if (flushTimer) return;
  // Coalesce all ids requested in the same tick into one `.in()` query.
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const ids = Array.from(pendingFetch);
    pendingFetch.clear();
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('users')
      .select('id, last_seen_at')
      .in('id', ids);
    if (data) {
      for (const r of data as { id: string; last_seen_at: string | null }[]) {
        setLastSeen(r.id, r.last_seen_at);
      }
    }
  }, 30);
}

/** Subscribe to a user's presence. Returns an unsubscribe fn. */
export function subscribePresence(userId: string, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);
  refCounts.set(userId, (refCounts.get(userId) ?? 0) + 1);

  ensureChannel();
  ensureTick();
  scheduleFetch(userId);

  return () => {
    const s = listeners.get(userId);
    s?.delete(listener);
    const n = (refCounts.get(userId) ?? 1) - 1;
    if (n <= 0) {
      refCounts.delete(userId);
      if (s && s.size === 0) listeners.delete(userId);
    } else {
      refCounts.set(userId, n);
    }
    teardownIfIdle();
  };
}

export function getPresenceSnapshot(userId: string): PresenceSnapshot {
  return snapshotFor(userId);
}
