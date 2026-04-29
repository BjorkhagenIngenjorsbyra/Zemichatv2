// Zemichat v2 – Ringtone + ringback service
//
// Two distinct sounds:
//   • Incoming ringtone — what the callee hears (mp3 loop + vibration)
//   • Outgoing ringback — what the caller hears while waiting for the
//     callee to answer (Web Audio synthesised tone, no asset needed)

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();
const isIOS = Capacitor.getPlatform() === 'ios';

// ============================================================
// Shared Web Audio context (lazy)
// ============================================================

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new AC();
    return sharedCtx;
  } catch {
    return null;
  }
}

// ============================================================
// INCOMING RINGTONE (callee side)
// ============================================================

let audioElement: HTMLAudioElement | null = null;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;
let webVibrating = false;
let incomingFallbackInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Synthesised incoming ringer using two oscillators in a 2s on / 4s off
 * pattern. Used as a fallback when the mp3 asset can't autoplay (common
 * on Android WebView when the app is opened cold from a push).
 */
function startIncomingFallbackTone(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const playOnce = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = 440; // standard ring tone freqs
    osc2.frequency.value = 480;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.setValueAtTime(0.25, now + 1.95);
    gain.gain.linearRampToValueAtTime(0, now + 2.0);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.0);
    osc2.stop(now + 2.0);
  };

  playOnce();
  incomingFallbackInterval = setInterval(playOnce, 6000);
}

function stopIncomingFallbackTone(): void {
  if (incomingFallbackInterval) {
    clearInterval(incomingFallbackInterval);
    incomingFallbackInterval = null;
  }
}

/**
 * Start playing ringtone + vibration pattern for incoming call.
 * - iOS: Skip audio (CallKit handles it), vibrate only.
 * - Android/Web: Try mp3 loop, fall back to Web Audio-synthesised tone
 *   if the mp3 can't play (autoplay block or missing asset).
 */
export function startRingtone(): void {
  stopRingtone();

  if (!isIOS) {
    let mp3Playing = false;
    try {
      audioElement = new Audio('/assets/sounds/ringtone.mp3');
      audioElement.loop = true;
      audioElement.volume = 1.0;
      const playPromise = audioElement.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            mp3Playing = true;
          })
          .catch((err) => {
            console.warn('[ringtone] mp3 autoplay blocked, using fallback tone', err?.message);
            startIncomingFallbackTone();
          });
      } else {
        mp3Playing = true;
      }
    } catch (err) {
      console.warn('[ringtone] Audio() construction failed, using fallback tone', err);
      startIncomingFallbackTone();
    }
    // If the play() promise hasn't resolved within 200ms we assume the
    // mp3 is gated and start the fallback tone in parallel — better to
    // double-ring briefly than to miss the call.
    setTimeout(() => {
      if (!mp3Playing && !incomingFallbackInterval) {
        startIncomingFallbackTone();
      }
    }, 200);
  }

  if (isNative) {
    vibrationInterval = setInterval(() => {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    }, 2000);
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    webVibrating = true;
    const vibrateLoop = () => {
      if (!webVibrating) return;
      try {
        navigator.vibrate([800, 400, 800, 2000]);
      } catch { /* no-op */ }
      vibrationInterval = setTimeout(vibrateLoop, 4000) as unknown as ReturnType<typeof setInterval>;
    };
    vibrateLoop();
  }
}

/**
 * Stop incoming ringtone + vibration.
 */
export function stopRingtone(): void {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.src = '';
    audioElement = null;
  }
  stopIncomingFallbackTone();

  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    clearTimeout(vibrationInterval as unknown as ReturnType<typeof setTimeout>);
    vibrationInterval = null;
  }
  webVibrating = false;
  if (!isNative && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
}

// ============================================================
// OUTGOING RINGBACK (caller side)
// ============================================================

let ringbackInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the "tut … tut …" ringback the caller hears while waiting for
 * the callee to answer. Synthesised via Web Audio so we don't need an
 * extra asset and so the autoplay policy is satisfied — the caller just
 * tapped the call button, which counts as a user gesture.
 *
 * Pattern: 425 Hz tone, 1s on / 4s off (Swedish PSTN convention).
 */
export function startOutgoingRingback(): void {
  stopOutgoingRingback();
  const ctx = getCtx();
  if (!ctx) return;

  const playOnce = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 425;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain.gain.setValueAtTime(0.18, now + 0.96);
    gain.gain.linearRampToValueAtTime(0, now + 1.0);
    osc.start(now);
    osc.stop(now + 1.0);
  };

  playOnce();
  ringbackInterval = setInterval(playOnce, 5000);
}

/**
 * Stop the outgoing ringback tone. Must be called when the call connects
 * or ends.
 */
export function stopOutgoingRingback(): void {
  if (ringbackInterval) {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
  }
}
