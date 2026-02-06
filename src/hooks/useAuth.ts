import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange, signOut as authSignOut } from '../services/auth';
import { getMyProfile, hasTeamProfile } from '../services/team';
import {
  initializePushNotifications,
  cleanupPushNotifications,
  getPermissionStatus,
  type PermissionStatus,
} from '../services/push';
import type { User } from '../types/database';

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  authUser: SupabaseUser | null;
  session: Session | null;
  profile: User | null;
  hasProfile: boolean;
  pushPermission: PermissionStatus;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  initializePush: () => Promise<void>;
}

/**
 * Hook to manage authentication state.
 * Provides auth user, session, and Zemichat user profile.
 */
export function useAuth(): AuthState {
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [pushPermission, setPushPermission] = useState<PermissionStatus>(getPermissionStatus());

  const refreshProfile = useCallback(async () => {
    if (!authUser) {
      setProfile(null);
      setHasProfile(false);
      return;
    }

    const has = await hasTeamProfile();
    setHasProfile(has);

    if (has) {
      const { user } = await getMyProfile();
      setProfile(user);
    } else {
      setProfile(null);
    }
  }, [authUser]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { session: initialSession } = await getSession();

      if (!mounted) return;

      if (initialSession) {
        setSession(initialSession);
        setAuthUser(initialSession.user);
      }

      setIsLoading(false);
    };

    initialize();

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setAuthUser(newSession?.user ?? null);

      if (!newSession) {
        setProfile(null);
        setHasProfile(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Refresh profile when auth user changes
  useEffect(() => {
    if (authUser && !isLoading) {
      refreshProfile();
    }
  }, [authUser, isLoading, refreshProfile]);

  const signOut = useCallback(async () => {
    // Cleanup push notifications before signing out
    await cleanupPushNotifications();
    await authSignOut();
    setAuthUser(null);
    setSession(null);
    setProfile(null);
    setHasProfile(false);
  }, []);

  const initializePush = useCallback(async () => {
    const { permissionStatus } = await initializePushNotifications();
    setPushPermission(permissionStatus);
  }, []);

  return {
    isLoading,
    isAuthenticated: !!authUser,
    authUser,
    session,
    profile,
    hasProfile,
    pushPermission,
    signOut,
    refreshProfile,
    initializePush,
  };
}
