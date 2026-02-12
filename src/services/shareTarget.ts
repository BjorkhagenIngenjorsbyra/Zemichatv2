import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// ---------- Types ----------

export interface SharedItem {
  mimeType: string;
  fileName: string;
  base64Data: string;
  size: number;
}

export interface ShareData {
  type: 'text' | 'image';
  text: string;
  items: SharedItem[];
}

interface ShareTargetPlugin {
  getPendingShare(): Promise<{ data: ShareData | null }>;
  clearIntent(): Promise<void>;
  addListener(
    event: 'shareReceived',
    callback: (data: ShareData) => void
  ): Promise<PluginListenerHandle>;
}

// ---------- Plugin registration ----------

const ShareTarget = Capacitor.isNativePlatform()
  ? registerPlugin<ShareTargetPlugin>('ShareTarget')
  : null;

// ---------- State ----------

type ShareHandler = (data: ShareData) => void;

let handler: ShareHandler | null = null;
let bufferedData: ShareData | null = null;
let initialized = false;

// ---------- Public API ----------

/**
 * Set up the native listener and check for cold-start data.
 * Safe to call multiple times — only initializes once.
 */
export async function initializeShareTarget(): Promise<void> {
  if (initialized || !ShareTarget) return;
  initialized = true;

  // Warm-start: intent arrives while app is running
  await ShareTarget.addListener('shareReceived', (data: ShareData) => {
    deliverOrBuffer(data);
  });

  // Cold-start: intent may already have been processed before JS was ready
  const { data } = await ShareTarget.getPendingShare();
  if (data) {
    deliverOrBuffer(data);
  }
}

/**
 * Register a callback to receive share data.
 * If data was buffered before the handler was set, it is delivered immediately.
 */
export function setShareHandler(cb: ShareHandler): void {
  handler = cb;

  if (bufferedData) {
    const data = bufferedData;
    bufferedData = null;
    cb(data);
  }
}

/**
 * Convert a base64 SharedItem to a File object for upload.
 */
export function sharedItemToFile(item: SharedItem): File {
  const byteString = atob(item.base64Data);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new File([bytes], item.fileName, { type: item.mimeType });
}

/**
 * Replace the activity intent so it won't be re-processed on config changes.
 */
export async function clearShareIntent(): Promise<void> {
  if (ShareTarget) {
    await ShareTarget.clearIntent();
  }
}

// ---------- Session storage for not-logged-in case ----------

const STORAGE_KEY = 'zemichat-pending-share';

export function savePendingShare(data: ShareData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export function loadPendingShare(): ShareData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as ShareData;
  } catch {
    return null;
  }
}

// ---------- Internal ----------

function deliverOrBuffer(data: ShareData): void {
  if (handler) {
    handler(data);
  } else {
    bufferedData = data;
  }
}
