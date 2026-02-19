// Zemichat v2 – Hook to observe a user's online / last-seen status

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { isUserOnline, formatLastSeen } from '../services/presence';

interface PresenceInfo {
  isOnline: boolean;
  lastSeenText: string;
}

/**
 * Subscribe to a user's `last_seen_at` via Supabase Realtime
 * and return live online-status + formatted text.
 */
export function usePresence(userId: string | null | undefined): PresenceInfo {
  const { t } = useTranslation();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!userId) return;

    const fetchInitial = async () => {
      const { data } = await supabase
        .from('users')
        .select('last_seen_at')
        .eq('id', userId)
        .single();

      if (data) {
        setLastSeenAt((data as { last_seen_at: string | null }).last_seen_at);
      }
    };

    fetchInitial();
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newLastSeen = (payload.new as { last_seen_at: string | null }).last_seen_at;
          if (newLastSeen) {
            setLastSeenAt(newLastSeen);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Recalculate every 30 seconds for "X minutes ago" freshness
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  return {
    isOnline: isUserOnline(lastSeenAt),
    lastSeenText: formatLastSeen(lastSeenAt, t),
  };
}
