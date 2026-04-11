import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';

// ============================================================
// INTERNAL ANALYTICS — GDPR-safe, no third-party tracking
// ============================================================

type EventType =
  | 'signup'
  | 'login'
  | 'logout'
  | 'session_start'
  | 'message_sent'
  | 'message_read'
  | 'call_started'
  | 'call_ended'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'team_created'
  | 'texter_created'
  | 'plan_upgraded'
  | 'plan_downgraded'
  | 'sos_triggered'
  | 'feedback_submitted'
  | 'onboarding_completed'
  | 'app_error';

const APP_VERSION = '1.3.1';

function getPlatform(): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform(); // 'ios' or 'android'
  }
  return 'web';
}

/**
 * Track an analytics event. Fire-and-forget — never blocks UI.
 */
export async function trackEvent(
  eventType: EventType,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // analytics_events isn't in the generated Database types
    await (supabase.from as any)('analytics_events').insert({
      event_type: eventType,
      user_id: user.id,
      metadata: metadata ?? {},
      platform: getPlatform(),
      app_version: APP_VERSION,
    });
  } catch {
    // Silent fail — analytics should never break the app
  }
}

/**
 * Track event with team context.
 */
export async function trackTeamEvent(
  eventType: EventType,
  teamId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // analytics_events isn't in the generated Database types
    await (supabase.from as any)('analytics_events').insert({
      event_type: eventType,
      user_id: user.id,
      team_id: teamId,
      metadata: metadata ?? {},
      platform: getPlatform(),
      app_version: APP_VERSION,
    });
  } catch {
    // Silent fail
  }
}
