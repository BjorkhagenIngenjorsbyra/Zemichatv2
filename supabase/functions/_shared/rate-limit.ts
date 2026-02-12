/**
 * Shared rate-limiting helper for Edge Functions.
 *
 * Uses the `rate_limits` table: (function_name, user_id, created_at).
 * Call `checkRateLimit()` early in every handler. It inserts a row,
 * counts recent calls, and returns { allowed, retryAfterSeconds }.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Check and record an API call against the rate limit.
 *
 * @param supabase   – A service-role Supabase client (bypasses RLS).
 * @param fnName     – The Edge Function name (e.g. 'agora-token').
 * @param userId     – The calling user's ID.
 * @param maxPerMin  – Maximum allowed calls per 60-second window.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  fnName: string,
  userId: string,
  maxPerMin: number
): Promise<RateLimitResult> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

  // Count existing calls in the last minute
  const { count, error: countError } = await supabase
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('function_name', fnName)
    .eq('user_id', userId)
    .gte('created_at', oneMinuteAgo);

  if (countError) {
    // On DB error, allow the request (fail-open) but log
    console.error('Rate limit check failed:', countError.message);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if ((count ?? 0) >= maxPerMin) {
    return { allowed: false, retryAfterSeconds: 60 };
  }

  // Record this call
  await supabase
    .from('rate_limits')
    .insert({ function_name: fnName, user_id: userId });

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Build a standard 429 JSON response.
 */
export function rateLimitResponse(
  corsHeaders: Record<string, string>,
  retryAfter: number
): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}
