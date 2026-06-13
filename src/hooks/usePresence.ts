// Zemichat v2 – Hook to observe a user's online / last-seen status

import { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { isUserOnline, formatLastSeen } from '../services/presence';
import {
  subscribePresence,
  getPresenceSnapshot,
  type PresenceSnapshot,
} from '../services/presenceStore';

interface PresenceInfo {
  isOnline: boolean;
  lastSeenText: string;
}

const EMPTY: PresenceSnapshot = { lastSeenAt: null };

/**
 * Live online-status + formatted "last seen" text for a user.
 *
 * Backed by a single shared presence store (one realtime channel + one batched
 * fetch + one 30s tick for all observed users) instead of a per-instance
 * channel/fetch/timer — see services/presenceStore.
 */
export function usePresence(userId: string | null | undefined): PresenceInfo {
  const { t } = useTranslation();

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!userId) return () => {};
      return subscribePresence(userId, onChange);
    },
    [userId]
  );

  const getSnapshot = useCallback(
    () => (userId ? getPresenceSnapshot(userId) : EMPTY),
    [userId]
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    isOnline: isUserOnline(snapshot.lastSeenAt),
    lastSeenText: formatLastSeen(snapshot.lastSeenAt, t),
  };
}
