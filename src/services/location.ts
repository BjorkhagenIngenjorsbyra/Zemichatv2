// Zemichat v2 – Location service

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from './supabase';
import { UserRole } from '../types/database';
import type { LocationData } from '../types/location';

/**
 * Get the current device position.
 */
export async function getCurrentPosition(): Promise<{
  location: LocationData | null;
  error: Error | null;
}> {
  try {
    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted') {
          return { location: null, error: new Error('permission_denied') };
        }
      }
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      location: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      },
      error: null,
    };
  } catch (err) {
    // Fallback for web without native plugin
    if (!Capacitor.isNativePlatform() && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            error: null,
          }),
          (err) => resolve({
            location: null,
            error: new Error(err.code === 1 ? 'permission_denied' : 'position_unavailable'),
          }),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
    return { location: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

/**
 * Check if a user can share location in a specific chat.
 * Owner/Super: always allowed.
 * Texter: only if Team Owner is a member of the chat.
 */
export async function canShareLocation(chatId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Get current user's role
  const { data: profile } = await supabase
    .from('users')
    .select('role, team_id')
    .eq('id', user.id)
    .single();

  if (!profile) return false;

  const typedProfile = profile as unknown as { role: string; team_id: string };

  // Owner and Super can always share
  if (typedProfile.role !== UserRole.TEXTER) return true;

  // Texter: check if team owner is in this chat
  const { data: teamOwner } = await supabase
    .from('users')
    .select('id')
    .eq('team_id', typedProfile.team_id)
    .eq('role', UserRole.OWNER)
    .single();

  if (!teamOwner) return false;

  const { data: ownerMember } = await supabase
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId)
    .eq('user_id', (teamOwner as { id: string }).id)
    .is('left_at', null)
    .maybeSingle();

  return !!ownerMember;
}
