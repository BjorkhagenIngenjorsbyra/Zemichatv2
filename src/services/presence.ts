// Zemichat v2 – Presence / online-status service

import { supabase } from './supabase';
import type { TFunction } from 'i18next';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const UPDATE_INTERVAL_MS = 60 * 1000; // 1 minute

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Update current user's last_seen_at to now.
 */
export async function updateLastSeen(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() } as never)
    .eq('id', user.id);
}

/**
 * Start periodic presence updates.
 * Updates immediately, then every 60 seconds, plus on visibility changes.
 */
export function startPresenceUpdates(): void {
  stopPresenceUpdates();

  // Immediate update
  updateLastSeen();

  // Periodic updates
  intervalId = setInterval(updateLastSeen, UPDATE_INTERVAL_MS);

  // Update when tab becomes visible again
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Stop periodic presence updates.
 */
export function stopPresenceUpdates(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    updateLastSeen();
  }
}

/**
 * Check if a user is considered "online" based on their last_seen_at.
 */
export function isUserOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

/**
 * Format last seen timestamp into a human-readable string.
 */
export function formatLastSeen(lastSeenAt: string | null | undefined, t: TFunction): string {
  if (!lastSeenAt) return '';

  if (isUserOnline(lastSeenAt)) {
    return t('presence.online');
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return t('presence.lastSeenMinutes', { count: Math.max(1, diffMinutes) });
  }
  if (diffHours < 24) {
    return t('presence.lastSeenHours', { count: diffHours });
  }
  return t('presence.lastSeenDays', { count: diffDays });
}
