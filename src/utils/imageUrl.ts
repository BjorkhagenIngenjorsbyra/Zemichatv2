/**
 * Helpers for serving smaller/optimized image variants from Supabase
 * Storage. Audit #36-P5: avatars and message images otherwise download
 * at their original resolution (often 1024px+) even when rendered in a
 * 48px slot, which burns bandwidth and decode time on mobile.
 *
 * Supabase Storage supports `?width=&height=&resize=cover&quality=`
 * query params for transform-enabled buckets. For external URLs (e.g.
 * Gravatar, third-party CDNs) we return the URL unchanged.
 */

const SUPABASE_STORAGE_HOST_FRAGMENT = '.supabase.co/storage/v1/object/';
const SUPABASE_RENDER_PATH = '.supabase.co/storage/v1/render/image/';

interface TransformOptions {
  /** Target rendered width in CSS pixels — multiplied by DPR internally. */
  width: number;
  /** Target rendered height in CSS pixels (defaults to width). */
  height?: number;
  /** JPEG/WebP quality 20-100. Defaults to 80. */
  quality?: number;
  /** Resize strategy. Defaults to 'cover' (most useful for avatars). */
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Return a Storage-transform URL for an avatar/thumb. Sizes are passed
 * as logical CSS pixels — we multiply by devicePixelRatio (capped at 2)
 * so retina renders crisp without quadrupling the byte cost on phones
 * that report DPR 3+.
 *
 * Non-Supabase URLs and falsy inputs are returned unchanged so the
 * helper is safe to apply broadly.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  opts: TransformOptions
): string {
  if (!url) return '';
  if (!url.includes(SUPABASE_STORAGE_HOST_FRAGMENT) && !url.includes(SUPABASE_RENDER_PATH)) {
    return url;
  }

  const dpr = typeof window !== 'undefined' && window.devicePixelRatio
    ? Math.min(window.devicePixelRatio, 2)
    : 1;
  const width = Math.round(opts.width * dpr);
  const height = Math.round((opts.height ?? opts.width) * dpr);
  const quality = opts.quality ?? 80;
  const resize = opts.resize ?? 'cover';

  // Switch from /object/ to /render/image/ which is the transform
  // endpoint. /render/image/ accepts public/sign URLs interchangeably.
  let transformed = url.replace(
    '/storage/v1/object/',
    '/storage/v1/render/image/'
  );

  const sep = transformed.includes('?') ? '&' : '?';
  transformed += `${sep}width=${width}&height=${height}&resize=${resize}&quality=${quality}`;
  return transformed;
}

/** Convenience wrapper for avatar circles. */
export function getOptimizedAvatarUrl(
  url: string | null | undefined,
  size: number = 48,
): string {
  return getOptimizedImageUrl(url, { width: size, height: size, resize: 'cover' });
}
