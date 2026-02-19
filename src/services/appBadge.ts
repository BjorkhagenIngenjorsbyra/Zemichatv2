import { Capacitor } from '@capacitor/core';

/**
 * Set the app icon badge count (native only).
 */
export async function setAppBadge(count: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { Badge } = await import('@capawesome/capacitor-badge');
    await Badge.set({ count });
  } catch (err) {
    console.warn('Failed to set app badge:', err);
  }
}

/**
 * Clear the app icon badge (native only).
 */
export async function clearAppBadge(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { Badge } = await import('@capawesome/capacitor-badge');
    await Badge.clear();
  } catch (err) {
    console.warn('Failed to clear app badge:', err);
  }
}
