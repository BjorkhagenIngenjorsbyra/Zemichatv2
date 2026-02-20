import AgoraRTC, {
  type IAgoraRTCClient,
  type IMicrophoneAudioTrack,
  type ICameraVideoTrack,
  type ILocalVideoTrack,
  type IRemoteAudioTrack,
  type IRemoteVideoTrack,
  type IAgoraRTCRemoteUser,
  type UID,
} from 'agora-rtc-sdk-ng';
import { supabase } from './supabase';
import { type AgoraToken, CallType } from '../types/call';

// ============================================================
// AGORA CLIENT MANAGEMENT
// ============================================================

/**
 * Create an Agora RTC client instance.
 */
export function createAgoraClient(): IAgoraRTCClient {
  return AgoraRTC.createClient({
    mode: 'rtc',
    codec: 'vp8',
  });
}

/**
 * Get Agora token from the Edge Function.
 * The Edge Function verifies chat membership and texter settings.
 */
export async function getAgoraToken(
  chatId: string,
  callType: CallType
): Promise<{ token: AgoraToken | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke<AgoraToken>('agora-token', {
      body: { chatId, callType },
    });

    if (error) {
      // Try to extract the server error message (e.g. "Agora not configured")
      const msg = (error as { context?: { body?: string } })?.context?.body || error.message;
      try {
        const parsed = JSON.parse(msg);
        return { token: null, error: new Error(parsed.error || error.message) };
      } catch {
        return { token: null, error: new Error(error.message) };
      }
    }

    if (!data) {
      return { token: null, error: new Error('No token received') };
    }

    return { token: data, error: null };
  } catch (err) {
    return {
      token: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// PERMISSION PRE-CHECK
// ============================================================

/**
 * Pre-check microphone (and optionally camera) permission by requesting
 * a test MediaStream. This surfaces permission errors with a clear error
 * before Agora tries to create tracks (which gives cryptic failures on
 * Android webviews).
 */
export async function requestMediaPermissions(
  withVideo: boolean
): Promise<{ granted: boolean; error?: Error }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo,
    });
    // Immediately release the test stream
    stream.getTracks().forEach((t) => t.stop());
    return { granted: true };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { granted: false, error };
  }
}

// ============================================================
// TRACK MANAGEMENT
// ============================================================

/**
 * Create local audio and optionally video tracks.
 */
export async function createLocalTracks(
  withVideo: boolean
): Promise<{
  audioTrack: IMicrophoneAudioTrack | null;
  videoTrack: ICameraVideoTrack | null;
  error: Error | null;
}> {
  try {
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'speech_standard',
    });

    let videoTrack: ICameraVideoTrack | null = null;
    if (withVideo) {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          // 720p max resolution
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: 30,
          bitrateMin: 600,
          bitrateMax: 1500,
        },
        facingMode: 'user',
      });
    }

    return { audioTrack, videoTrack, error: null };
  } catch (err) {
    return {
      audioTrack: null,
      videoTrack: null,
      error: err instanceof Error ? err : new Error('Failed to create local tracks'),
    };
  }
}

/**
 * Create screen share video track.
 */
export async function createScreenShareTrack(): Promise<{
  screenTrack: ILocalVideoTrack | null;
  error: Error | null;
}> {
  try {
    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      {
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 15,
          bitrateMin: 600,
          bitrateMax: 1500,
        },
      },
      'disable' // No audio from screen share
    );

    // Handle both single track and array return
    const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;

    return { screenTrack: track, error: null };
  } catch (err) {
    // User may have cancelled the screen share dialog
    if (err instanceof Error && err.message.includes('NotAllowedError')) {
      return { screenTrack: null, error: new Error('Screen share cancelled') };
    }
    return {
      screenTrack: null,
      error: err instanceof Error ? err : new Error('Failed to create screen share'),
    };
  }
}

// ============================================================
// CHANNEL OPERATIONS
// ============================================================

/**
 * Join an Agora channel.
 */
export async function joinChannel(
  client: IAgoraRTCClient,
  appId: string,
  token: string,
  channelName: string,
  uid: UID
): Promise<{ error: Error | null }> {
  try {
    await client.join(appId, channelName, token, uid);
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to join channel'),
    };
  }
}

/**
 * Leave the current channel.
 */
export async function leaveChannel(
  client: IAgoraRTCClient
): Promise<{ error: Error | null }> {
  try {
    await client.leave();
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to leave channel'),
    };
  }
}

/**
 * Publish local tracks to the channel.
 */
export async function publishTracks(
  client: IAgoraRTCClient,
  audioTrack: IMicrophoneAudioTrack | null,
  videoTrack: ICameraVideoTrack | ILocalVideoTrack | null
): Promise<{ error: Error | null }> {
  try {
    const tracks = [audioTrack, videoTrack].filter(Boolean) as (
      | IMicrophoneAudioTrack
      | ICameraVideoTrack
      | ILocalVideoTrack
    )[];

    if (tracks.length > 0) {
      await client.publish(tracks);
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to publish tracks'),
    };
  }
}

/**
 * Unpublish local tracks from the channel.
 */
export async function unpublishTracks(
  client: IAgoraRTCClient,
  tracks: (IMicrophoneAudioTrack | ICameraVideoTrack | ILocalVideoTrack)[]
): Promise<{ error: Error | null }> {
  try {
    const validTracks = tracks.filter(Boolean);
    if (validTracks.length > 0) {
      await client.unpublish(validTracks);
    }
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to unpublish tracks'),
    };
  }
}

// ============================================================
// TRACK CLEANUP
// ============================================================

/**
 * Stop and close local tracks.
 */
export function closeLocalTracks(
  audioTrack: IMicrophoneAudioTrack | null,
  videoTrack: ICameraVideoTrack | ILocalVideoTrack | null
): void {
  if (audioTrack) {
    audioTrack.stop();
    audioTrack.close();
  }
  if (videoTrack) {
    videoTrack.stop();
    videoTrack.close();
  }
}

// ============================================================
// TYPE EXPORTS FOR EXTERNAL USE
// ============================================================

export type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  ILocalVideoTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  IAgoraRTCRemoteUser,
  UID,
};

export { AgoraRTC };
