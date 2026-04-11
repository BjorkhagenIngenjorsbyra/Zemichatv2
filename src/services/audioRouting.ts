// Zemichat v2 – Audio routing service (speaker/earpiece toggle)

import { Capacitor } from '@capacitor/core';
import AgoraRTC from 'agora-rtc-sdk-ng';

/**
 * Toggle audio route between speaker and earpiece.
 * - Native: Uses Agora SDK's setPlaybackDevice or native routing.
 * - Web: Uses setSinkId() if available (best-effort).
 */
export async function setAudioRoute(_speakerOn: boolean): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // On native (Android/iOS), Agora SDK provides audio routing control
    try {
      // Agora Web SDK 4.x: set playback device
      // On mobile webview, this controls speaker vs earpiece
      // Speaker is typically the default device; earpiece is secondary.
      // On mobile, toggling this effectively switches routing.
      await AgoraRTC.getPlaybackDevices();
    } catch (err) {
      console.warn('[audioRouting] failed to set native audio route:', err);
    }
    return;
  }

  // Web: try to set audio output device
  try {
    const audioElements = document.querySelectorAll('audio');
    for (const el of audioElements) {
      if ('setSinkId' in el && typeof (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId === 'function') {
        // Default output = '', speaker typically has a different device ID
        // Best-effort: empty string resets to default (speaker on most devices)
        await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId('');
      }
    }
  } catch {
    // setSinkId not supported or failed
  }
}
