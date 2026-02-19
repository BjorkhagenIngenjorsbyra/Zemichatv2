import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuthContext } from './AuthContext';
import { supabase } from '../services/supabase';
import {
  getUnreadChatCount,
  getPendingFriendRequestCount,
  hasNewWallPosts,
  markWallVisited as markWallVisitedService,
} from '../services/notification';
import { setAppBadge, clearAppBadge } from '../services/appBadge';

interface NotificationState {
  /** Number of chats with unread messages (for Chats tab badge) */
  unreadChatCount: number;
  /** Sum of all unread messages (for app icon badge) */
  totalUnreadMessages: number;
  /** Pending incoming friend requests (for Friends tab badge) */
  pendingFriendRequests: number;
  /** Whether there are new wall posts since last visit */
  hasNewWallPosts: boolean;
  /** Manually refresh all notification counts */
  refreshCounts: () => Promise<void>;
  /** Mark wall as visited — clears the wall dot */
  markWallVisited: () => void;
}

const NotificationContext = createContext<NotificationState | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuthContext();

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [wallHasNew, setWallHasNew] = useState(false);

  // Debounce timer ref for chat_members updates
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshUnreadCounts = useCallback(async () => {
    const result = await getUnreadChatCount();
    setUnreadChatCount(result.count);
    setTotalUnreadMessages(result.total);
  }, []);

  const refreshFriendCounts = useCallback(async () => {
    const count = await getPendingFriendRequestCount();
    setPendingFriendRequests(count);
  }, []);

  const refreshWallStatus = useCallback(async () => {
    if (!profile?.team_id) return;
    const hasNew = await hasNewWallPosts(profile.team_id);
    setWallHasNew(hasNew);
  }, [profile?.team_id]);

  const refreshCounts = useCallback(async () => {
    await Promise.all([refreshUnreadCounts(), refreshFriendCounts(), refreshWallStatus()]);
  }, [refreshUnreadCounts, refreshFriendCounts, refreshWallStatus]);

  const markWallVisited = useCallback(() => {
    markWallVisitedService();
    setWallHasNew(false);
  }, []);

  // Initial load when profile becomes available
  useEffect(() => {
    if (!profile?.id) return;
    refreshCounts();
  }, [profile?.id, refreshCounts]);

  // Realtime: chat_members changes → refresh unread counts (debounced)
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('notification-chat-members')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_members',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          // Debounce rapid updates (e.g. multiple messages arriving)
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            refreshUnreadCounts();
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, refreshUnreadCounts]);

  // Realtime: friendships changes → refresh friend count
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('notification-friendships')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${profile.id}`,
        },
        () => {
          refreshFriendCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, refreshFriendCounts]);

  // Realtime: wall_posts INSERT → set hasNewWallPosts
  useEffect(() => {
    if (!profile?.team_id) return;

    const channel = supabase
      .channel('notification-wall-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wall_posts',
          filter: `team_id=eq.${profile.team_id}`,
        },
        () => {
          setWallHasNew(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.team_id]);

  // App badge: sync with totalUnreadMessages
  useEffect(() => {
    if (totalUnreadMessages > 0) {
      setAppBadge(totalUnreadMessages);
    } else {
      clearAppBadge();
    }
  }, [totalUnreadMessages]);

  return (
    <NotificationContext.Provider
      value={{
        unreadChatCount,
        totalUnreadMessages,
        pendingFriendRequests,
        hasNewWallPosts: wallHasNew,
        refreshCounts,
        markWallVisited,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationState {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
