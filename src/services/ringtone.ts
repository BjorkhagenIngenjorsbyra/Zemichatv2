// Zemichat v2 – Ringtone + vibration service for incoming calls

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();
const isIOS = Capacitor.getPlatform() === 'ios';

let audioElement: HTMLAudioElement | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;
let webVibrating = false;

/**
 * Start playing ringtone + vibration pattern.
 * - iOS: Skip audio (CallKit handles it), vibrate only.
 * - Android: Play audio loop + haptic vibrations.
 * - Web: Play audio loop + navigator.vibrate pattern.
 */
export function startRingtone(): void {
  stopRingtone(); // Clean up any previous

  // Audio (skip on iOS — CallKit provides its own ringtone)
  if (!isIOS) {
    try {
      audioElement = new Audio('/assets/sounds/ringtone.mp3');
      audioElement.loop = true;
      audioElement.volume = 1.0;
      audioElement.play().catch(() => {
        // Autoplay may be blocked — silently ignore
      });
    } catch {
      // Audio API not available
    }
  }

  // Vibration
  if (isNative) {
    // Native: use Capacitor Haptics in a repeated pattern
    vibrationInterval = setInterval(() => {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    }, 2000);
    // Immediate first vibration
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    // Web: use Vibration API with pattern [vibrate, pause, vibrate, long pause]
    webVibrating = true;
    const vibrateLoop = () => {
      if (!webVibrating) return;
      navigator.vibrate([800, 400, 800, 2000]);
      // Total cycle: 4000ms — schedule next
      vibrationInterval = setTimeout(vibrateLoop, 4000) as unknown as ReturnType<typeof setInterval>;
    };
    vibrateLoop();
  }
}

/**
 * Stop ringtone + vibration.
 */
export function stopRingtone(): void {
  // Stop audio
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.src = '';
    audioElement = null;
  }

  // Stop vibration
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    clearTimeout(vibrationInterval as unknown as ReturnType<typeof setTimeout>);
    vibrationInterval = null;
  }

  webVibrating = false;

  // Cancel any ongoing web vibration
  if (!isNative && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
}
