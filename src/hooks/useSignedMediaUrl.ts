import { useEffect, useRef, useState } from 'react';
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
  // The path the current `resolved` value belongs to. Used to tell a real
  // path change (recycled/virtualized row, message whose media changed) from a
  // transform-only change or a plain rerender.
  const resolvedForPathRef = useRef<string | null | undefined>(pathOrUrl);

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setResolved(null);
      resolvedForPathRef.current = pathOrUrl;
      return;
    }

    // If the cache already has a fresh entry, surface it synchronously
    // (covers the case where pathOrUrl changed between renders to
    // something already cached).
    const cached = getCachedMediaUrl(pathOrUrl, transform);
    if (cached) {
      setResolved(cached);
      resolvedForPathRef.current = pathOrUrl;
      return;
    }

    // Keep the previous value only when the PATH is unchanged (transform-only
    // change / rerender) — that's the intended anti-flicker. When the path
    // actually changed to a different uncached value, clear it first so a
    // recycled row doesn't display the previous image until the new URL lands.
    if (resolvedForPathRef.current !== pathOrUrl) {
      setResolved(null);
    }
    resolvedForPathRef.current = pathOrUrl;

    resolveMediaUrl(pathOrUrl, transform)
      .then((url) => {
        if (!cancelled) setResolved(url);
      })
      .catch(() => {
        // A rejected signing promise was previously an unhandled rejection that
        // left the stale URL on screen forever.
        if (!cancelled) setResolved(null);
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
