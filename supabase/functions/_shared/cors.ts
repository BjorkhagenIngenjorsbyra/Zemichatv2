/**
 * Shared CORS configuration for all Zemichat Edge Functions.
 *
 * Add production domains here — every Edge Function imports from this single file.
 */

const ALLOWED_ORIGINS = [
  // Production
  'https://app.zemichat.com',
  'https://zemichat.com',
  // Local development
  'http://localhost:5173',
  'http://localhost:8100',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8100',
  // Capacitor 5+ default Android scheme is `https://localhost`; iOS keeps
  // `capacitor://localhost`. Older Android builds used `http://localhost`.
  // Without these, the WebView fetch is blocked by CORS even though the
  // Edge Function returns a 200, surfacing as "Failed to send a request to
  // the Edge Function" in supabase-js.
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Standard preflight response. Call at the top of every handler:
 *
 *   if (req.method === 'OPTIONS') return corsPreflightResponse(req);
 */
export function corsPreflightResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}
