import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from './supabase';

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

// ============================================================
// Native plugin
// ============================================================

const CallNotification = Capacitor.isNativePlatform()
  ? registerPlugin<CallNotificationPlugin>('CallNotification')
  : null;

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
 */
export async function getPendingCallAction(): Promise<NativeCallAction | null> {
  if (!CallNotification) return null;
  try {
    const { data } = await CallNotification.getPendingCallAction();
    return data;
  } catch {
    return null;
  }
}

/**
 * Dismiss the native incoming call notification (e.g., when answering from within the app).
 */
export async function dismissNativeCallNotification(): Promise<void> {
  if (!CallNotification) return;
  try {
    await CallNotification.dismissCallNotification();
  } catch {
    // Ignore
  }
}
