import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from './supabase';
import { saveVoipToken } from './push';

// ============================================================
// Types
// ============================================================

export interface NativeCallAction {
  action: 'answer';
  callLogId: string;
  chatId: string;
  callType: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
}

interface CallNotificationPlugin {
  getPendingCallAction(): Promise<{ data: NativeCallAction | null }>;
  dismissCallNotification(): Promise<void>;
}

interface CallKitServicePlugin {
  registerVoipPush(): Promise<void>;
  getPendingCallAction(): Promise<{ data: NativeCallAction | null }>;
  dismissCallNotification(): Promise<void>;
  reportCallConnected(options: { callLogId: string }): Promise<void>;
  reportCallEnded(options: { callLogId: string; reason: string }): Promise<void>;
  addListener(eventName: string, callback: (data: { token: string }) => void): Promise<{ remove: () => void }>;
}

// ============================================================
// Native plugin (platform-aware)
// ============================================================

const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

// Android uses CallNotification plugin (full-screen activity)
const CallNotification = isAndroid
  ? registerPlugin<CallNotificationPlugin>('CallNotification')
  : null;

// iOS uses CallKitService plugin (PushKit + CallKit)
const CallKitService = isIOS
  ? registerPlugin<CallKitServicePlugin>('CallKitService')
  : null;

// ============================================================
// iOS VoIP Push Registration
// ============================================================

let voipRegistered = false;

/**
 * Register for VoIP pushes on iOS via PushKit.
 * This must be called after the user is authenticated.
 * The native plugin will emit a 'voipTokenReceived' event with the token.
 */
export async function registerVoipPushIfNeeded(): Promise<void> {
  if (!CallKitService || voipRegistered) return;
  voipRegistered = true;

  // Listen for the VoIP token event from the native plugin
  CallKitService.addListener('voipTokenReceived', (event: { token: string }) => {
    if (event?.token) {
      saveVoipToken(event.token);
    }
  });

  try {
    await CallKitService.registerVoipPush();
  } catch (err) {
    console.error('VoIP push registration failed:', err);
    voipRegistered = false;
  }
}

// ============================================================
// Edge Function: call-push
// ============================================================

/**
 * Send a push notification to the call recipient(s) via the call-push Edge Function.
 * action: 'ring' sends an incoming call notification, 'cancel' dismisses it.
 */
export async function sendCallPush(
  chatId: string,
  callLogId: string,
  callType: string,
  action: 'ring' | 'cancel'
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('call-push', {
      body: { chatId, callLogId, callType, action },
    });
    if (error) {
      console.error('call-push error:', error.message);
    }
  } catch (err) {
    console.error('call-push failed:', err);
  }
}

// ============================================================
// Native call notification bridge
// ============================================================

/**
 * Check if the app was opened from the native incoming call screen (Answer button).
 * Returns the call action data, or null if no pending action.
 * Works identically on iOS (CallKit) and Android (full-screen activity).
 */
export async function getPendingCallAction(): Promise<NativeCallAction | null> {
  const plugin = CallKitService || CallNotification;
  if (!plugin) return null;
  try {
    const { data } = await plugin.getPendingCallAction();
    return data;
  } catch {
    return null;
  }
}

/**
 * Dismiss the native incoming call notification / CallKit call UI.
 */
export async function dismissNativeCallNotification(): Promise<void> {
  const plugin = CallKitService || CallNotification;
  if (!plugin) return;
  try {
    await plugin.dismissCallNotification();
  } catch {
    // Ignore
  }
}

// ============================================================
// CallKit lifecycle (iOS only — no-ops on Android)
// ============================================================

/**
 * Tell CallKit that the call has connected (stops the ringing UI).
 * No-op on Android.
 */
export async function reportCallConnected(callLogId: string): Promise<void> {
  if (!CallKitService) return;
  try {
    await CallKitService.reportCallConnected({ callLogId });
  } catch {
    // Ignore — non-critical
  }
}

/**
 * Tell CallKit that the call has ended (removes the call from the system call log).
 * No-op on Android.
 */
export async function reportCallEnded(
  callLogId: string,
  reason: 'answeredElsewhere' | 'declinedElsewhere' | 'remoteEnded' | 'failed' = 'remoteEnded'
): Promise<void> {
  if (!CallKitService) return;
  try {
    await CallKitService.reportCallEnded({ callLogId, reason });
  } catch {
    // Ignore — non-critical
  }
}
