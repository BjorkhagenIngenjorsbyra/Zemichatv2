import { supabase } from './supabase';
import { type PushToken, PlatformType } from '../types/database';

// ============================================================
// Types
// ============================================================

export type PermissionStatus = 'granted' | 'denied' | 'default';

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// ============================================================
// Permission Handling
// ============================================================

/**
 * Check if push notifications are supported in the current environment.
 */
export function isPushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get the current notification permission status.
 */
export function getPermissionStatus(): PermissionStatus {
  if (!isPushSupported()) return 'denied';
  return Notification.permission as PermissionStatus;
}

/**
 * Request permission to show notifications.
 */
export async function requestPermission(): Promise<PermissionStatus> {
  if (!isPushSupported()) {
    return 'denied';
  }

  try {
    const result = await Notification.requestPermission();
    return result as PermissionStatus;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return 'denied';
  }
}

// ============================================================
// Token Management
// ============================================================

/**
 * Detect the current platform.
 */
function detectPlatform(): PlatformType {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return PlatformType.IOS;
  }

  return PlatformType.ANDROID; // Default to Android for web/Android
}

/**
 * Generate a pseudo-token for web push (in production, use FCM).
 * This is a placeholder - real implementation would use Firebase Cloud Messaging.
 */
async function generateWebPushToken(): Promise<string | null> {
  try {
    // For web, we'll use a combination of user agent and timestamp as a pseudo-token
    // In production, this should be replaced with proper FCM token generation
    const registration = await navigator.serviceWorker.ready;

    // Try to get existing subscription or create new one
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Note: In production, you'd need a VAPID public key here
      // For now, we'll generate a unique identifier
      const uniqueId = `web-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      return uniqueId;
    }

    // Return the endpoint as the token identifier
    return subscription.endpoint;
  } catch (err) {
    console.error('Failed to generate push token:', err);
    // Fallback to a unique identifier
    return `web-fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Register the push token with the server.
 */
export async function registerPushToken(): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    // Check permission
    const permission = getPermissionStatus();
    if (permission !== 'granted') {
      return { error: new Error('Notification permission not granted') };
    }

    // Generate token
    const token = await generateWebPushToken();
    if (!token) {
      return { error: new Error('Failed to generate push token') };
    }

    const platform = detectPlatform();

    // Upsert the token (update if exists, insert if not)
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          updated_at: new Date().toISOString(),
        } as never,
        {
          onConflict: 'user_id,token',
        }
      );

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
 * Unregister the push token from the server.
 */
export async function unregisterPushToken(): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    // Delete all tokens for this user
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id);

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
 * Get all push tokens for the current user.
 */
export async function getMyPushTokens(): Promise<{
  tokens: PushToken[];
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { tokens: [], error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      return { tokens: [], error: new Error(error.message) };
    }

    return { tokens: (data || []) as unknown as PushToken[], error: null };
  } catch (err) {
    return {
      tokens: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// Local Notifications (for immediate display)
// ============================================================

/**
 * Show a local notification immediately.
 */
export async function showLocalNotification(
  options: PushNotificationOptions
): Promise<{ error: Error | null }> {
  try {
    if (!isPushSupported()) {
      return { error: new Error('Notifications not supported') };
    }

    const permission = getPermissionStatus();
    if (permission !== 'granted') {
      return { error: new Error('Notification permission not granted') };
    }

    // Try to use service worker notification first (more reliable)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/icon-72.png',
        tag: options.tag,
        data: options.data,
      });
    } else {
      // Fallback to basic Notification API
      new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        tag: options.tag,
        data: options.data,
      });
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize push notifications for the app.
 * - Checks/requests permission
 * - Registers service worker if needed
 * - Registers push token with server
 */
export async function initializePushNotifications(): Promise<{
  permissionStatus: PermissionStatus;
  error: Error | null;
}> {
  try {
    if (!isPushSupported()) {
      return {
        permissionStatus: 'denied',
        error: new Error('Push notifications not supported in this browser'),
      };
    }

    // Check current permission
    let permission = getPermissionStatus();

    // If not determined, request permission
    if (permission === 'default') {
      permission = await requestPermission();
    }

    if (permission !== 'granted') {
      return {
        permissionStatus: permission,
        error: null, // Not an error, user just denied
      };
    }

    // Register the service worker if not already registered
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {
        // Service worker registration failed, but we can continue
        console.warn('Service worker registration failed');
      }
    }

    // Register push token
    const { error: tokenError } = await registerPushToken();
    if (tokenError) {
      console.warn('Failed to register push token:', tokenError);
    }

    return {
      permissionStatus: permission,
      error: null,
    };
  } catch (err) {
    return {
      permissionStatus: 'denied',
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Cleanup push notifications on logout.
 */
export async function cleanupPushNotifications(): Promise<void> {
  await unregisterPushToken();
}
