/**
 * Returns the public origin to use when generating shareable Zemichat URLs
 * (invitation links, deep links, etc.).
 *
 * Why this exists:
 * - `window.location.origin` inside a Capacitor WebView resolves to
 *   `http://localhost`, `https://localhost`, `capacitor://localhost` or
 *   `ionic://localhost` depending on platform/version. None of those are
 *   resolvable for an email recipient.
 * - In a regular browser session (dev or hosted webapp on Vercel) we still
 *   want to respect the real origin so test invites point at the correct
 *   environment.
 *
 * Resolution order:
 *  1. `import.meta.env.VITE_APP_URL` if defined and a valid https URL —
 *     authoritative override set by the build pipeline (Codemagic / Vercel).
 *  2. `window.location.origin` if it is NOT one of the Capacitor pseudo-
 *     hosts (`localhost`, `localhost:5173`, `localhost:8100`, etc.).
 *  3. Hard-coded production fallback `https://app.zemichat.com` — matches
 *     `supabase/functions/_shared/escape-html.ts#isAllowedInviteLink` which
 *     refuses to send invitation emails for any other host.
 *
 * The returned string never has a trailing slash, so callers can safely
 * concatenate `/invite/...`.
 */

const PRODUCTION_FALLBACK = 'https://app.zemichat.com';

const CAPACITOR_PSEUDO_HOSTS = new Set([
  'localhost',
  'localhost:5173',
  'localhost:8100',
  '127.0.0.1',
  '127.0.0.1:5173',
  '127.0.0.1:8100',
]);

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isValidPublicHttpsUrl(candidate: string | undefined): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') return false;
    if (CAPACITOR_PSEUDO_HOSTS.has(parsed.host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getPublicAppOrigin(): string {
  // 1. Build-time override.
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (fromEnv && isValidPublicHttpsUrl(fromEnv)) {
    return stripTrailingSlash(fromEnv);
  }

  // 2. Runtime origin — only when not running inside a Capacitor WebView.
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    try {
      const parsed = new URL(origin);
      const isHttps = parsed.protocol === 'https:';
      const isCapacitorScheme =
        parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:';
      const isPseudoHost = CAPACITOR_PSEUDO_HOSTS.has(parsed.host);
      if (isHttps && !isPseudoHost && !isCapacitorScheme) {
        return stripTrailingSlash(origin);
      }
    } catch {
      // fall through to fallback
    }
  }

  // 3. Production fallback.
  return PRODUCTION_FALLBACK;
}
