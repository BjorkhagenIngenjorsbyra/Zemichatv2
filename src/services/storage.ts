import { supabase } from './supabase';

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  size: number;
  mimeType: string;
  fileName: string;
}

export interface UploadResult {
  /**
   * Storage path inside the chat-media bucket. Persist this in
   * messages.media_url — the bucket is private, so only paths are stored.
   * Use resolveMediaUrl(path) to get a short-lived signed URL when rendering.
   */
  url: string;
  path: string;
  metadata: MediaMetadata;
  error: Error | null;
}

export interface UploadError {
  url: null;
  path: null;
  metadata: null;
  error: Error;
}

const BUCKET_NAME = 'chat-media';
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour
// Re-issue a new signed URL slightly before expiry to avoid races.
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a unique file path for storage.
 * Structure: {userId}/{chatId}/{timestamp}_{filename}
 */
function generateFilePath(
  userId: string,
  chatId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${chatId}/${timestamp}_${sanitizedName}`;
}

/**
 * Get image dimensions from a File.
 */
async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload an image file to chat-media storage.
 * Returns the storage PATH (not a URL) — the bucket is private.
 */
export async function uploadImage(
  file: File,
  chatId: string
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { url: null, path: null, metadata: null, error: new Error('File must be an image') };
    }

    // Get dimensions
    let dimensions = { width: 0, height: 0 };
    try {
      dimensions = await getImageDimensions(file);
    } catch {
      // Continue without dimensions
    }

    const filePath = generateFilePath(user.id, chatId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const metadata: MediaMetadata = {
      width: dimensions.width,
      height: dimensions.height,
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return {
      // Persist path as media_url — clients resolve to signed URL on demand.
      url: filePath,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upload a voice message blob to chat-media storage.
 */
export async function uploadVoice(
  blob: Blob,
  chatId: string,
  duration: number,
  mimeType = 'audio/webm'
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    // Determine file extension from mime type
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/aac': 'aac',
    };
    const ext = extensions[mimeType] || 'webm';
    const fileName = `voice_message.${ext}`;

    const filePath = generateFilePath(user.id, chatId, fileName);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: mimeType,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const metadata: MediaMetadata = {
      duration,
      size: blob.size,
      mimeType,
      fileName,
    };

    return {
      url: filePath,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upload a document file to chat-media storage.
 */
export async function uploadDocument(
  file: File,
  chatId: string
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    const filePath = generateFilePath(user.id, chatId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const metadata: MediaMetadata = {
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return {
      url: filePath,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upload a video file to chat-media storage.
 */
export async function uploadVideo(
  file: File,
  chatId: string,
  duration?: number
): Promise<UploadResult | UploadError> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, path: null, metadata: null, error: new Error('Not authenticated') };
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      return { url: null, path: null, metadata: null, error: new Error('File must be a video') };
    }

    const filePath = generateFilePath(user.id, chatId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, path: null, metadata: null, error: new Error(uploadError.message) };
    }

    const metadata: MediaMetadata = {
      duration,
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return {
      url: filePath,
      path: filePath,
      metadata,
      error: null,
    };
  } catch (err) {
    return {
      url: null,
      path: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

const AVATAR_BUCKET = 'avatars';

/**
 * Upload a profile avatar image.
 * Stores in avatars bucket at: {userId}/avatar.{ext}
 * Overwrites previous avatar.
 */
export async function uploadAvatar(
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, error: new Error('Not authenticated') };
    }

    if (!file.type.startsWith('image/')) {
      return { url: null, error: new Error('File must be an image') };
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '60',
        upsert: true,
      });

    if (uploadError) {
      // Fallback: try chat-media bucket if avatars bucket doesn't exist.
      // chat-media is private — we store the path and resolve to a signed
      // URL here so the existing avatar consumer (which expects a URL string)
      // still works.
      const { error: fallbackError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(`avatars/${filePath}`, file, {
          contentType: file.type,
          cacheControl: '60',
          upsert: true,
        });

      if (fallbackError) {
        return { url: null, error: new Error(fallbackError.message) };
      }

      const { data: signedData, error: signedErr } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(`avatars/${filePath}`, SIGNED_URL_TTL_SECONDS);

      if (signedErr || !signedData) {
        return { url: null, error: new Error(signedErr?.message || 'Failed to sign avatar URL') };
      }

      // Update user profile with the signed URL (will need refresh client-side).
      await supabase.rpc('update_user_profile' as never, { new_avatar_url: signedData.signedUrl } as never);

      return { url: signedData.signedUrl, error: null };
    }

    const { data: urlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath);

    // Update user profile
    await supabase.rpc('update_user_profile' as never, { new_avatar_url: urlData.publicUrl } as never);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Supabase Storage Image Transformation options.
 *
 * Resizes/recompresses on the CDN edge so we don't ship the full-size
 * source down to thumbnails (audit fix #36-17). Only applied to images
 * via createSignedUrl({ transform }).
 */
export interface MediaTransform {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
  format?: 'origin';
}

/**
 * Get a signed URL for accessing a private file.
 * Useful when the bucket is private.
 *
 * Pass `transform` to apply Supabase Image Transformation (Pro feature).
 * Storage returns a smaller, recompressed version for thumbnails.
 */
export async function getSignedUrl(
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
  transform?: MediaTransform
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(
        path,
        expiresIn,
        transform ? { transform } : undefined
      );

    if (error) {
      return { url: null, error: new Error(error.message) };
    }

    return { url: data.signedUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(
  path: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

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
// Signed URL resolution for chat media
// ============================================================
//
// chat-media is a PRIVATE bucket. messages.media_url stores the storage
// path; UI components must resolve to a short-lived signed URL before
// rendering. resolveMediaUrl() caches signed URLs in-memory so a single
// chat view doesn't generate N requests when the same path is referenced
// multiple times (gallery + bubble + quoted message).

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

const signedUrlCache = new Map<string, CachedSignedUrl>();
const inflightSigning = new Map<string, Promise<string | null>>();

/**
 * Detect whether a value is a fully-qualified URL or a storage path.
 * Old messages from before #18 was fixed may still have public URLs in
 * media_url — we pass those through unchanged.
 */
function isAbsoluteUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
}

/**
 * Cache key includes transform options so a 96px avatar request and a
 * 600px thumb request for the same path don't clobber each other.
 */
function cacheKey(path: string, transform?: MediaTransform): string {
  if (!transform) return path;
  const t = [
    transform.width ?? '',
    transform.height ?? '',
    transform.quality ?? '',
    transform.resize ?? '',
    transform.format ?? '',
  ].join(':');
  return `${path}#${t}`;
}

/**
 * Resolve a chat-media storage path to a signed URL.
 *
 * Accepts:
 *   - storage paths like "userId/chatId/123_pic.jpg" (preferred)
 *   - legacy absolute URLs (returned as-is — Storage transforms only
 *     work on paths in our private bucket, not on public/external URLs)
 *   - null/empty (returned as null)
 *
 * Pass `transform` to request a CDN-resized variant for thumbnails /
 * avatars instead of the full-size source (audit fix #36-17).
 *
 * Caches signed URLs (per path + transform combo) until 5 minutes before
 * expiry to avoid round-trips.
 */
export async function resolveMediaUrl(
  pathOrUrl: string | null | undefined,
  transform?: MediaTransform
): Promise<string | null> {
  if (!pathOrUrl) return null;
  // Absolute URLs (https://, data:, blob:) include Tenor/Giphy GIFs,
  // legacy public URLs from before #18, and local previews. Pass them
  // through unchanged — we can't apply Storage transforms to them.
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;

  const key = cacheKey(pathOrUrl, transform);

  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt - Date.now() > SIGNED_URL_REFRESH_MARGIN_MS) {
    return cached.url;
  }

  // Coalesce concurrent requests for the same path+transform.
  const inflight = inflightSigning.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const { url, error } = await getSignedUrl(
      pathOrUrl,
      SIGNED_URL_TTL_SECONDS,
      transform
    );
    if (error || !url) {
      return null;
    }
    signedUrlCache.set(key, {
      url,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return url;
  })();

  inflightSigning.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightSigning.delete(key);
  }
}

/**
 * Synchronously read a cached signed URL (only fresh, non-expiring entries).
 * Used by useSignedMediaUrl to avoid render-flicker — if we already have a
 * valid signed URL for this path, return it immediately and skip the
 * loading state on rerender (audit fix #36-18).
 */
export function getCachedMediaUrl(
  pathOrUrl: string | null | undefined,
  transform?: MediaTransform
): string | null {
  if (!pathOrUrl) return null;
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;

  const cached = signedUrlCache.get(cacheKey(pathOrUrl, transform));
  if (cached && cached.expiresAt - Date.now() > SIGNED_URL_REFRESH_MARGIN_MS) {
    return cached.url;
  }
  return null;
}

/**
 * Resolve multiple chat-media paths in a single batch.
 * Returns a map of path -> signed URL. Failed entries are omitted.
 */
export async function resolveMediaUrls(
  pathsOrUrls: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = Array.from(
    new Set(pathsOrUrls.filter((v): v is string => !!v))
  );

  await Promise.all(
    unique.map(async (key) => {
      const resolved = await resolveMediaUrl(key);
      if (resolved) {
        result.set(key, resolved);
      }
    })
  );

  return result;
}

/**
 * Clear the signed URL cache. Use when a user signs out, or when the
 * media might have been changed/deleted.
 */
export function clearMediaUrlCache(): void {
  signedUrlCache.clear();
}
