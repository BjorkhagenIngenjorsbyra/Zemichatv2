import { supabase } from './supabase';
import { type SosAlert, type User, UserRole } from '../types/database';

// ============================================================
// Types
// ============================================================

export interface SosAlertWithTexter extends SosAlert {
  texter: User;
}

// Simple location type for geolocation
export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

// ============================================================
// Location Helpers
// ============================================================

/**
 * Get the current location using the browser's Geolocation API.
 * Returns null if location is unavailable or denied.
 */
export async function getCurrentLocation(): Promise<Location | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        // Location denied or unavailable
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

// ============================================================
// SOS Alerts
// ============================================================

/**
 * Send an SOS alert (Texter only).
 * This function works even when is_active=false - safety is critical.
 */
export async function sendSosAlert(): Promise<{
  alert: SosAlert | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { alert: null, error: new Error('Not authenticated') };
    }

    // Get current location (best effort)
    const location = await getCurrentLocation();

    // Create the SOS alert
    const { data, error } = await supabase
      .from('sos_alerts')
      .insert({
        texter_id: user.id,
        location: location
          ? { type: 'Point', coordinates: [location.lng, location.lat] }
          : null,
      } as never)
      .select()
      .single();

    if (error) {
      return { alert: null, error: new Error(error.message) };
    }

    return { alert: data as unknown as SosAlert, error: null };
  } catch (err) {
    return {
      alert: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get unacknowledged SOS alerts for the current Owner's team.
 */
export async function getUnacknowledgedAlerts(): Promise<{
  alerts: SosAlertWithTexter[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { alerts: [], error: new Error('Not authenticated') };
    }

    // Get user's team_id and role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !currentUser) {
      return { alerts: [], error: new Error('Could not get user info') };
    }

    const typedUser = currentUser as unknown as { team_id: string; role: string };

    if (typedUser.role !== UserRole.OWNER) {
      return { alerts: [], error: new Error('Only owners can view SOS alerts') };
    }

    // Get all Texters in the team
    const { data: texters, error: textersError } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', typedUser.team_id)
      .eq('role', UserRole.TEXTER);

    if (textersError) {
      return { alerts: [], error: new Error(textersError.message) };
    }

    const typedTexters = (texters || []) as unknown as User[];

    if (typedTexters.length === 0) {
      return { alerts: [], error: null };
    }

    const texterIds = typedTexters.map((t) => t.id);
    const texterMap = new Map(typedTexters.map((t) => [t.id, t]));

    // Get unacknowledged alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('sos_alerts')
      .select('*')
      .in('texter_id', texterIds)
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false });

    if (alertsError) {
      return { alerts: [], error: new Error(alertsError.message) };
    }

    const typedAlerts = (alerts || []) as unknown as SosAlert[];

    // Attach texter details
    const alertsWithTexter: SosAlertWithTexter[] = typedAlerts
      .map((alert) => {
        const texter = texterMap.get(alert.texter_id);
        if (!texter) return null;
        return { ...alert, texter };
      })
      .filter((a): a is SosAlertWithTexter => a !== null);

    return { alerts: alertsWithTexter, error: null };
  } catch (err) {
    return {
      alerts: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get all SOS alerts (including acknowledged) for the current Owner's team.
 */
export async function getAllAlerts(limit = 50): Promise<{
  alerts: SosAlertWithTexter[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { alerts: [], error: new Error('Not authenticated') };
    }

    // Get user's team_id and role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !currentUser) {
      return { alerts: [], error: new Error('Could not get user info') };
    }

    const typedUser = currentUser as unknown as { team_id: string; role: string };

    if (typedUser.role !== UserRole.OWNER) {
      return { alerts: [], error: new Error('Only owners can view SOS alerts') };
    }

    // Get all Texters in the team
    const { data: texters, error: textersError } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', typedUser.team_id)
      .eq('role', UserRole.TEXTER);

    if (textersError) {
      return { alerts: [], error: new Error(textersError.message) };
    }

    const typedTexters = (texters || []) as unknown as User[];

    if (typedTexters.length === 0) {
      return { alerts: [], error: null };
    }

    const texterIds = typedTexters.map((t) => t.id);
    const texterMap = new Map(typedTexters.map((t) => [t.id, t]));

    // Get alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('sos_alerts')
      .select('*')
      .in('texter_id', texterIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (alertsError) {
      return { alerts: [], error: new Error(alertsError.message) };
    }

    const typedAlerts = (alerts || []) as unknown as SosAlert[];

    // Attach texter details
    const alertsWithTexter: SosAlertWithTexter[] = typedAlerts
      .map((alert) => {
        const texter = texterMap.get(alert.texter_id);
        if (!texter) return null;
        return { ...alert, texter };
      })
      .filter((a): a is SosAlertWithTexter => a !== null);

    return { alerts: alertsWithTexter, error: null };
  } catch (err) {
    return {
      alerts: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Acknowledge an SOS alert (Owner only).
 */
export async function acknowledgeSosAlert(
  alertId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('sos_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      } as never)
      .eq('id', alertId)
      .is('acknowledged_at', null);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Parse location from SOS alert.
 */
export function parseAlertLocation(
  alert: SosAlert
): Location | null {
  if (!alert.location) return null;

  // Handle PostGIS point format
  const loc = alert.location as { type?: string; coordinates?: number[] };

  if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return {
      lng: loc.coordinates[0],
      lat: loc.coordinates[1],
    };
  }

  return null;
}

/**
 * Get Google Maps URL for a location.
 */
export function getGoogleMapsUrl(location: Location): string {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}
