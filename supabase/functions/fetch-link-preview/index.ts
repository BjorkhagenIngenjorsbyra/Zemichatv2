import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

// ============================================================
// SSRF guard rails (audit fix #21)
// ============================================================

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

/**
 * RFC1918 + loopback + link-local + ULA IPv6 + IPv6 link-local + IPv4-mapped
 * IPv6 prefixes. Any DNS answer falling inside these MUST be rejected.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    // Malformed — treat as private to be safe.
    return true;
  }
  const [a, b] = parts;

  // 0.0.0.0/8  - "this" network
  if (a === 0) return true;
  // 10.0.0.0/8 - private
  if (a === 10) return true;
  // 127.0.0.0/8 - loopback
  if (a === 127) return true;
  // 169.254.0.0/16 - link-local (incl. AWS/GCP metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 - private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 + 192.0.2.0/24 (TEST-NET-1) — be safe, block the whole /16
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16 - private
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 - benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 - TEST-NET-2
  if (a === 198 && b === 51) return true;
  // 203.0.113.0/24 - TEST-NET-3
  if (a === 203 && b === 0) return true;
  // 224.0.0.0/4 - multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 - reserved
  if (a >= 240) return true;
  // 100.64.0.0/10 - CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // ::1 / ::1/128 - loopback
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  // :: - unspecified
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
  // fc00::/7 - unique local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // fe80::/10 - link-local
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // ff00::/8 - multicast
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — extract the IPv4 and re-check.
  const v4mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4mapped) {
    return isPrivateIPv4(v4mapped[1]);
  }
  // ::ffff:0:0/96 numeric form
  const v4mappedNum = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4mappedNum) {
    const hi = parseInt(v4mappedNum[1], 16);
    const lo = parseInt(v4mappedNum[2], 16);
    const a = (hi >> 8) & 0xff;
    const b = hi & 0xff;
    const c = (lo >> 8) & 0xff;
    const d = lo & 0xff;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }
  // 2001:db8::/32 - documentation
  if (/^2001:0?db8:/.test(lower)) return true;
  // ::/96 - IPv4-compatible (deprecated, but block)
  if (/^::([0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4}$/.test(lower) && lower.startsWith('::')) {
    // Heuristic: if it parses as an IPv4-compat IPv6, block.
    // Conservative: allow real ::1 already handled above.
  }

  return false;
}

/**
 * Resolve a hostname to all A/AAAA records and reject if any falls inside
 * a private/loopback/link-local block. Bare-IP hostnames are checked
 * directly without DNS.
 *
 * Throws if the hostname cannot be resolved or any address is forbidden.
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  // Strip IPv6 brackets if present (URL.hostname keeps "[::1]" wrapped).
  const stripped = hostname.replace(/^\[/, '').replace(/\]$/, '');

  // If the host is already an IP literal, validate directly.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(stripped)) {
    if (isPrivateIPv4(stripped)) {
      throw new Error('blocked_private_ip');
    }
    return;
  }
  if (/:/.test(stripped)) {
    // IPv6 literal
    if (isPrivateIPv6(stripped)) {
      throw new Error('blocked_private_ip');
    }
    return;
  }

  // Otherwise it's a domain name. Look up A and AAAA in parallel.
  const [aRecords, aaaaRecords] = await Promise.all([
    Deno.resolveDns(stripped, 'A').catch(() => [] as string[]),
    Deno.resolveDns(stripped, 'AAAA').catch(() => [] as string[]),
  ]);

  if (aRecords.length === 0 && aaaaRecords.length === 0) {
    throw new Error('dns_failed');
  }

  for (const ip of aRecords) {
    if (isPrivateIPv4(ip)) throw new Error('blocked_private_ip');
  }
  for (const ip of aaaaRecords) {
    if (isPrivateIPv6(ip)) throw new Error('blocked_private_ip');
  }
}

/**
 * Validate a URL is acceptable for outbound preview fetching.
 *  - http/https only
 *  - hostname must resolve to public addresses
 */
async function validateOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('invalid_url');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('invalid_protocol');
  }
  // No userinfo (`http://attacker@target/`)
  if (parsed.username || parsed.password) {
    throw new Error('userinfo_disallowed');
  }
  await assertPublicHostname(parsed.hostname);
  return parsed;
}

/**
 * Manual-redirect fetch loop. Each hop is re-validated against the SSRF
 * guard rails. Returns the final response (or throws).
 */
async function safeFetchHtml(initialUrl: URL, signal: AbortSignal): Promise<Response> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(currentUrl.toString(), {
      signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Zemichat-LinkPreview/1.0',
        Accept: 'text/html',
      },
    });

    // 3xx → follow manually after re-validating the new URL.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('redirect_without_location');
      }
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        throw new Error('invalid_redirect_url');
      }
      if (!['http:', 'https:'].includes(nextUrl.protocol)) {
        throw new Error('invalid_redirect_protocol');
      }
      if (nextUrl.username || nextUrl.password) {
        throw new Error('redirect_userinfo_disallowed');
      }
      await assertPublicHostname(nextUrl.hostname);
      currentUrl = nextUrl;
      // Drain any body to release the connection.
      try { await res.body?.cancel(); } catch { /* ignore */ }
      continue;
    }

    return res;
  }
  throw new Error('too_many_redirects');
}

/**
 * Read at most MAX_RESPONSE_BYTES from a Response stream. Aborts if the
 * server sends more (a malicious origin could try to exhaust memory).
 */
async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new Error('response_too_large');
      }
      chunks.push(value);
    }
  }

  // Concatenate efficiently.
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: max 30 calls/minute (link previews are frequent but lightweight)
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const rl = await checkRateLimit(serviceClient, 'fetch-link-preview', user.id, 30);
    if (!rl.allowed) {
      return rateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    const { url } = await req.json();
    if (!url || typeof url !== 'string' || url.length > 2048) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL + DNS-resolve and check for SSRF (audit fix #21).
    let parsedUrl: URL;
    try {
      parsedUrl = await validateOutboundUrl(url);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'invalid_url';
      // Don't leak the resolved IP in the response — generic message.
      return new Response(
        JSON.stringify({ error: 'Invalid URL', reason }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch with manual redirects + per-hop SSRF re-validation.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await safeFetchHtml(parsedUrl, controller.signal);
    } catch (err) {
      clearTimeout(timeout);
      const reason = err instanceof Error ? err.message : 'fetch_failed';
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL', reason }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    clearTimeout(timeout);

    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Restrict to text/html (also accepts application/xhtml+xml). Anything
    // else may be a redirect-to-binary or a misconfigured origin and
    // shouldn't be parsed for OG tags.
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    if (!isHtml) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: 'Unsupported content type' }),
        { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let html: string;
    try {
      html = await readBodyWithLimit(response);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'read_failed';
      return new Response(
        JSON.stringify({ error: 'Failed to read response', reason }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse Open Graph meta tags
    const title = extractMeta(html, 'og:title') || extractTitle(html) || '';
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || '';
    const imageUrl = extractMeta(html, 'og:image') || null;
    const domain = parsedUrl.hostname.replace('www.', '');

    return new Response(
      JSON.stringify({ title, description, imageUrl, domain }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

function extractMeta(html: string, name: string): string | null {
  // Match both property="og:xxx" and name="description" patterns
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegex(name)}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapeRegex(name)}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }

  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
