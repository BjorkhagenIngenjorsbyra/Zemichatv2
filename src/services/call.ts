import { supabase } from './supabase';
import { sendMessage } from './message';
import {
  type CallLog,
  type CallSignal,
  CallType as DBCallType,
  CallStatus,
  SignalType,
  MessageType,
  type User,
  type TexterSettings,
  UserRole,
} from '../types/database';
import { CallType } from '../types/call';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================
// CALL LOG MANAGEMENT
// ============================================================

export interface CreateCallLogResult {
  callLog: CallLog | null;
  error: Error | null;
}

/**
 * Create a new call log entry. Initially set to 'missed' status.
 */
export async function createCallLog(
  chatId: string,
  callType: CallType
): Promise<CreateCallLogResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { callLog: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('call_logs')
      .insert({
        chat_id: chatId,
        initiator_id: user.id,
        type: callType === CallType.VIDEO ? DBCallType.VIDEO : DBCallType.VOICE,
        status: CallStatus.MISSED,
      } as never)
      .select()
      .single();

    if (error) {
      return { callLog: null, error: new Error(error.message) };
    }

    return { callLog: data as unknown as CallLog, error: null };
  } catch (err) {
    return {
      callLog: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Update the call log status.
 */
export async function updateCallStatus(
  callLogId: string,
  status: CallStatus
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('call_logs')
      .update({ status } as never)
      .eq('id', callLogId);

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
 * End the call and update the call log with duration.
 */
export async function endCallLog(
  callLogId: string,
  startedAt: Date
): Promise<{ error: Error | null }> {
  try {
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    const { error } = await supabase
      .from('call_logs')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      } as never)
      .eq('id', callLogId);

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

// ============================================================
// CALL SIGNALING
// ============================================================

const SIGNAL_EXPIRY_SECONDS = 60; // Signals expire after 60 seconds

/**
 * Send a call signal to the chat.
 */
export async function sendCallSignal(
  chatId: string,
  callLogId: string,
  signalType: SignalType
): Promise<{ signal: CallSignal | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { signal: null, error: new Error('Not authenticated') };
    }

    const expiresAt = new Date(Date.now() + SIGNAL_EXPIRY_SECONDS * 1000);

    const { data, error } = await supabase
      .from('call_signals')
      .insert({
        chat_id: chatId,
        call_log_id: callLogId,
        caller_id: user.id,
        signal_type: signalType,
        expires_at: expiresAt.toISOString(),
      } as never)
      .select()
      .single();

    if (error) {
      return { signal: null, error: new Error(error.message) };
    }

    return { signal: data as unknown as CallSignal, error: null };
  } catch (err) {
    return {
      signal: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Cancel/delete a call signal.
 */
export async function cancelCallSignal(
  signalId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('call_signals')
      .delete()
      .eq('id', signalId);

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
 * Delete all signals for a call log.
 */
export async function deleteCallSignals(
  callLogId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('call_signals')
      .delete()
      .eq('call_log_id', callLogId);

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
 * Subscribe to call signals for user's chats.
 * Returns an unsubscribe function.
 */
export function subscribeToCallSignals(
  onSignal: (signal: CallSignal, caller: User) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel('call-signals')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
      },
      async (payload) => {
        const signal = payload.new as CallSignal;

        // Only process 'ring' signals
        if (signal.signal_type !== SignalType.RING) {
          return;
        }

        // Don't process our own signals
        const { data: { user } } = await supabase.auth.getUser();
        if (user && signal.caller_id === user.id) {
          return;
        }

        // Fetch caller info
        const { data: caller } = await supabase
          .from('users')
          .select('*')
          .eq('id', signal.caller_id)
          .single();

        if (caller) {
          onSignal(signal, caller as User);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================
// CALL HISTORY MESSAGE
// ============================================================

/**
 * Create a system message in the chat for call history.
 */
export async function createCallMessage(
  chatId: string,
  callLog: CallLog
): Promise<{ error: Error | null }> {
  try {
    const callTypeLabel = callLog.type === DBCallType.VIDEO ? 'video' : 'voice';
    let content: string;

    switch (callLog.status) {
      case CallStatus.ANSWERED:
        if (callLog.duration_seconds) {
          const minutes = Math.floor(callLog.duration_seconds / 60);
          const seconds = callLog.duration_seconds % 60;
          const duration = minutes > 0
            ? `${minutes}:${seconds.toString().padStart(2, '0')}`
            : `${seconds}s`;
          content = `${callTypeLabel}_call_ended|${duration}`;
        } else {
          content = `${callTypeLabel}_call_ended`;
        }
        break;
      case CallStatus.MISSED:
        content = `${callTypeLabel}_call_missed`;
        break;
      case CallStatus.DECLINED:
        content = `${callTypeLabel}_call_declined`;
        break;
      default:
        content = `${callTypeLabel}_call`;
    }

    const { error } = await sendMessage({
      chatId,
      content,
      type: MessageType.SYSTEM,
      mediaMetadata: {
        call_log_id: callLog.id,
        call_type: callLog.type,
        call_status: callLog.status,
        duration_seconds: callLog.duration_seconds,
      },
    });

    return { error };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// PERMISSION CHECKS
// ============================================================

/**
 * Check if a user can make a specific type of call.
 * Texters may have call permissions disabled by Owner.
 */
export async function canMakeCall(
  userId: string,
  callType: CallType
): Promise<{ canCall: boolean; error: Error | null }> {
  try {
    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return { canCall: false, error: new Error('User not found') };
    }

    const userRole = (userData as unknown as { role: string }).role;

    // Owners and Supers can always call
    if (userRole === UserRole.OWNER || userRole === UserRole.SUPER) {
      return { canCall: true, error: null };
    }

    // Check Texter settings
    const { data: settings, error: settingsError } = await supabase
      .from('texter_settings')
      .select('can_voice_call, can_video_call')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) {
      // Default to allowed if no settings exist
      return { canCall: true, error: null };
    }

    const typedSettings = settings as unknown as TexterSettings;
    const canCall =
      callType === CallType.VIDEO
        ? typedSettings.can_video_call
        : typedSettings.can_voice_call;

    return { canCall, error: null };
  } catch (err) {
    return {
      canCall: false,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Check if a user can screen share.
 */
export async function canScreenShare(
  userId: string
): Promise<{ canShare: boolean; error: Error | null }> {
  try {
    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return { canShare: false, error: new Error('User not found') };
    }

    const userRole = (userData as unknown as { role: string }).role;

    // Owners and Supers can always screen share
    if (userRole === UserRole.OWNER || userRole === UserRole.SUPER) {
      return { canShare: true, error: null };
    }

    // Check Texter settings
    const { data: settings, error: settingsError } = await supabase
      .from('texter_settings')
      .select('can_screen_share')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) {
      // Default to allowed if no settings exist
      return { canShare: true, error: null };
    }

    return { canShare: (settings as unknown as TexterSettings).can_screen_share, error: null };
  } catch (err) {
    return {
      canShare: false,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// CALL HISTORY
// ============================================================

export interface CallLogWithParticipants extends CallLog {
  initiator: User;
}

/**
 * Get call history for a chat.
 */
export async function getChatCallHistory(
  chatId: string,
  limit = 20
): Promise<{ calls: CallLogWithParticipants[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .select(`
        *,
        initiator:users!call_logs_initiator_id_fkey (*)
      `)
      .eq('chat_id', chatId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { calls: [], error: new Error(error.message) };
    }

    return { calls: data as unknown as CallLogWithParticipants[], error: null };
  } catch (err) {
    return {
      calls: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
