import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { PlatformType, PushTokenType } from '../types/database';

// ============================================================
// Types
// ============================================================

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

type NavigationHandler = (chatId: string) => void;

let navigationHandler: NavigationHandler | null = null;
let listenersRegistered = false;

// ============================================================
// Navigation
// ============================================================

/**
 * Set the handler called when a user taps a push notification.
 * The handler receives the chatId from the notification payload.
 */
export function setNavigationHandler(handler: NavigationHandler): void {
  navigationHandler = handler;
}

// ============================================================
// Permission Handling
// ============================================================

/**
 * Check if push notifications are available (native platform only).
 */
function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current notification permission status.
 */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (!isNative()) return 'denied';

  try {
    const result = await PushNotifications.checkPermissions();
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
}

/**
 * Request permission to show notifications.
 */
export async function requestPermission(): Promise<PermissionStatus> {
  if (!isNative()) return 'denied';

  try {
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
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
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? PlatformType.IOS : PlatformType.ANDROID;
}

/**
 * Save an FCM token to the push_tokens table (upsert).
 */
async function saveToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const platform = detectPlatform();

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        token_type: PushTokenType.FCM,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id,token,token_type' }
    );

  if (error) {
    console.error('Failed to save push token:', error.message);
  }
}

/**
 * Save a VoIP token to the push_tokens table (upsert).
 * Used on iOS for PushKit/CallKit incoming call notifications.
 */
export async function saveVoipToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        platform: PlatformType.IOS,
        token_type: PushTokenType.VOIP,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id,token,token_type' }
    );

  if (error) {
    console.error('Failed to save VoIP token:', error.message);
  }
}

/**
 * Delete all push tokens for the current user.
 */
async function deleteTokens(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to delete push tokens:', error.message);
  }
}

// ============================================================
// Listener Registration
// ============================================================

/**
 * Register native push notification listeners.
 * Safe to call multiple times — listeners are only added once.
 */
function registerListeners(): void {
  if (listenersRegistered || !isNative()) return;
  listenersRegistered = true;

  // FCM token received (initial registration + refreshes)
  PushNotifications.addListener('registration', (token) => {
    saveToken(token.value);
  });

  // Registration failed
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration failed:', error);
  });

  // Notification received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // Foreground notification received — handled by Realtime
  });

  // User tapped on a notification
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const chatId = action.notification.data?.chatId;
    if (chatId && navigationHandler) {
      navigationHandler(chatId);
    }
  });
}

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize push notifications for the app.
 * - Requests permission if needed
 * - Registers with FCM to get a token
 * - Sets up listeners for token refresh and notification taps
 *
 * Returns the resulting permission status.
 */
export async function initializePushNotifications(): Promise<{
  permissionStatus: PermissionStatus;
  error: Error | null;
}> {
  if (!isNative()) {
    return { permissionStatus: 'denied', error: null };
  }

  try {
    // Check current permission
    let permission = await getPermissionStatus();

    // If not determined yet, request permission
    if (permission === 'prompt') {
      permission = await requestPermission();
    }

    if (permission !== 'granted') {
      return { permissionStatus: permission, error: null };
    }

    // Set up listeners before registering (so we catch the token event)
    registerListeners();

    // Register with FCM — triggers 'registration' listener with token
    await PushNotifications.register();

    return { permissionStatus: 'granted', error: null };
  } catch (err) {
    return {
      permissionStatus: 'denied',
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Cleanup push notifications on logout.
 * Removes listeners and deletes tokens from the server.
 */
export async function cleanupPushNotifications(): Promise<void> {
  if (isNative()) {
    await PushNotifications.removeAllListeners();
    listenersRegistered = false;
  }
  await deleteTokens();
}
