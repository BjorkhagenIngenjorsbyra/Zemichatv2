// Zemichat v2 – Audio routing service (speaker/earpiece toggle)

import { Capacitor } from '@capacitor/core';

/**
 * Toggle audio route between speaker and earpiece.
 * - Web: Uses setSinkId() if available (best-effort).
 * - Native: Agora SDK handles routing internally; this is a no-op placeholder.
 */
export async function setAudioRoute(speakerOn: boolean): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // On native, Agora SDK manages audio routing.
    // When full Agora integration is ready, use:
    // AgoraRTC.setAudioRouteToSpeaker(speakerOn)
    console.log(`[audioRouting] native speaker: ${speakerOn}`);
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
