import { useEffect, useState } from 'react';
import {
  getCachedMediaUrl,
  resolveMediaUrl,
  type MediaTransform,
} from '../services/storage';

/**
 * Resolve a chat-media storage path (or legacy public URL) to a short-lived
 * signed URL for rendering.
 *
 * The chat-media bucket is private — message rows store the storage PATH
 * (e.g. `userId/chatId/123_pic.jpg`) in `media_url`, not a fully-qualified
 * URL. This hook handles both new path values and legacy http(s):// URLs
 * (which it returns unchanged).
 *
 * Pass `transform` to request a Storage-side resized variant (thumbnails,
 * avatars) instead of the full-size source. The cache is keyed per
 * path + transform, so the same source can be served at multiple sizes
 * without re-signing (audit fix #36-17).
 *
 * Initialises from the in-memory signed-URL cache to avoid flicker on
 * rerender — if a fresh signed URL already exists for this path, useState
 * starts with it instead of null (audit fix #36-18).
 *
 * Returns `null` while loading, then either the signed URL string or
 * `null` if signing failed.
 */
export function useSignedMediaUrl(
  pathOrUrl: string | null | undefined,
  transform?: MediaTransform
): string | null {
  // Stable serialisation so a fresh `{width:96}` object on every render
  // doesn't retrigger the effect or invalidate the cached state.
  const transformKey = transform
    ? JSON.stringify({
        w: transform.width,
        h: transform.height,
        q: transform.quality,
        r: transform.resize,
        f: transform.format,
      })
    : '';

  const [resolved, setResolved] = useState<string | null>(() =>
    getCachedMediaUrl(pathOrUrl, transform)
  );

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setResolved(null);
      return;
    }

    // If the cache already has a fresh entry, surface it synchronously
    // (covers the case where pathOrUrl changed between renders to
    // something already cached).
    const cached = getCachedMediaUrl(pathOrUrl, transform);
    if (cached) {
      setResolved(cached);
      return;
    }

    // Don't reset to null when we already had a value — that's what
    // caused the flicker. We just kick off the resolution and overwrite
    // when it returns.
    resolveMediaUrl(pathOrUrl, transform).then((url) => {
      if (!cancelled) {
        setResolved(url);
      }
    });

    return () => {
      cancelled = true;
    };
    // transformKey carries the transform identity; transform itself is
    // not in deps to avoid re-running on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathOrUrl, transformKey]);

  return resolved;
}
