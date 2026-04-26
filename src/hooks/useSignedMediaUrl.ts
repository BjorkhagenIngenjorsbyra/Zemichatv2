import { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../services/storage';

/**
 * Resolve a chat-media storage path (or legacy public URL) to a short-lived
 * signed URL for rendering.
 *
 * The chat-media bucket is private — message rows store the storage PATH
 * (e.g. `userId/chatId/123_pic.jpg`) in `media_url`, not a fully-qualified
 * URL. This hook handles both new path values and legacy http(s):// URLs
 * (which it returns unchanged).
 *
 * Returns `null` while loading, then either the signed URL string or `null`
 * if signing failed.
 */
export function useSignedMediaUrl(
  pathOrUrl: string | null | undefined
): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setResolved(null);
      return;
    }

    // Reset while we resolve to avoid showing the previous image.
    setResolved(null);

    resolveMediaUrl(pathOrUrl).then((url) => {
      if (!cancelled) {
        setResolved(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return resolved;
}
