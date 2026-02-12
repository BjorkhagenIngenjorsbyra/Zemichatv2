import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

// ============================================================
// Types
// ============================================================

interface RequestPayload {
  chatId: string;
  callLogId: string;
  callType: string; // 'voice' | 'video'
  action: string;   // 'ring' | 'cancel'
}

interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  token_type: string;
}

// ============================================================
// FCM Authentication (Google OAuth2 via Service Account)
// ============================================================

function base64url(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createSignedJwt(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  return `${signingInput}.${signatureB64}`;
}

async function getAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const jwt = await createSignedJwt(clientEmail, privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth2 token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================
// APNs JWT Authentication
// ============================================================

async function createApnsJwt(keyId: string, teamId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the ES256 private key
  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput)
  );

  // Convert DER signature to raw r||s format for JWT
  const rawSig = derToRaw(new Uint8Array(signature));
  const signatureB64 = base64url(rawSig);
  return `${signingInput}.${signatureB64}`;
}

/**
 * Convert DER-encoded ECDSA signature to raw r||s (64 bytes).
 * WebCrypto returns DER format but JWT ES256 expects raw.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 <len>

  // Read r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // Read s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 64 - sLen;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

/**
 * Send a VoIP push via APNs HTTP/2.
 */
async function sendApnsPush(
  deviceToken: string,
  apnsJwt: string,
  callData: Record<string, string>,
  bundleId: string
): Promise<{ success: boolean; status?: number }> {
  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${apnsJwt}`,
        'apns-topic': `${bundleId}.voip`,
        'apns-push-type': 'voip',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {},
        ...callData,
      }),
    });

    return { success: response.ok, status: response.status };
  } catch (err) {
    console.error('APNs push error:', err);
    return { success: false };
  }
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the caller's JWT to get their user ID
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client for DB queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limiting: max 10 calls/minute
    const rl = await checkRateLimit(supabase, 'call-push', user.id, 10);
    if (!rl.allowed) {
      return rateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    // Parse payload
    const payload: RequestPayload = await req.json();
    const { chatId, callLogId, callType, action } = payload;

    if (!chatId || !callLogId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['ring', 'cancel'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find recipients: all other active chat members
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', chatId)
      .is('left_at', null)
      .neq('user_id', user.id);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientIds = members.map((m) => m.user_id);

    // Filter to active users only
    const { data: activeUsers } = await supabase
      .from('users')
      .select('id')
      .in('id', recipientIds)
      .eq('is_active', true);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const activeIds = activeUsers.map((u) => u.id);

    // Get push tokens for recipients (include token_type for routing)
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('id, user_id, token, platform, token_type')
      .in('user_id', activeIds);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build call data (shared between FCM and APNs)
    let callData: Record<string, string>;

    if (action === 'ring') {
      // Get caller info for the ring screen
      const { data: caller } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single();

      callData = {
        type: 'incoming_call',
        callLogId,
        chatId,
        callType: callType || 'voice',
        callerId: user.id,
        callerName: caller?.display_name || 'Unknown',
        callerAvatar: caller?.avatar_url || '',
      };
    } else {
      // cancel
      callData = {
        type: 'call_cancelled',
        callLogId,
      };
    }

    // Split tokens by delivery method:
    // - Android tokens (all types) → FCM data-only messages
    // - iOS FCM tokens → FCM data-only messages (for cancel, not ring)
    // - iOS VoIP tokens → APNs direct (for ring, PushKit/CallKit)
    const androidTokens = tokens.filter((t: PushTokenRow) => t.platform === 'android');
    const iosVoipTokens = tokens.filter((t: PushTokenRow) => t.platform === 'ios' && t.token_type === 'voip');
    const iosFcmTokens = tokens.filter((t: PushTokenRow) => t.platform === 'ios' && t.token_type === 'fcm');

    // Tokens to send via FCM:
    // - All Android tokens always go via FCM
    // - iOS FCM tokens used for cancel action (VoIP push is only for ring)
    const fcmTokens = [
      ...androidTokens,
      ...(action === 'cancel' ? iosFcmTokens : []),
    ];

    let sentCount = 0;
    const invalidTokenIds: string[] = [];

    // ============================================================
    // Send via FCM (Android + iOS cancel)
    // ============================================================

    if (fcmTokens.length > 0) {
      const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
      if (!fcmServiceAccountJson) {
        console.error('FCM_SERVICE_ACCOUNT_JSON not configured');
      } else {
        const serviceAccount = JSON.parse(fcmServiceAccountJson);
        const projectId = serviceAccount.project_id;
        const accessToken = await getAccessToken(
          serviceAccount.client_email,
          serviceAccount.private_key
        );

        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

        const fcmPromises = fcmTokens.map(async (tokenRow: PushTokenRow) => {
          const message: Record<string, unknown> = {
            message: {
              token: tokenRow.token,
              data: callData,
              android: {
                priority: 'high',
              },
            },
          };

          try {
            const response = await fetch(fcmUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(message),
            });

            if (response.ok) {
              sentCount++;
            } else {
              const errorData = await response.json();
              const errorCode = errorData?.error?.details?.[0]?.errorCode;

              if (
                response.status === 404 ||
                errorCode === 'UNREGISTERED' ||
                errorCode === 'INVALID_ARGUMENT'
              ) {
                invalidTokenIds.push(tokenRow.id);
              } else {
                console.error(
                  `FCM send failed for token ${tokenRow.id}:`,
                  response.status,
                  JSON.stringify(errorData)
                );
              }
            }
          } catch (err) {
            console.error(`FCM send error for token ${tokenRow.id}:`, err);
          }
        });

        await Promise.all(fcmPromises);
      }
    }

    // ============================================================
    // Send via APNs (iOS VoIP tokens — ring action only)
    // ============================================================

    if (iosVoipTokens.length > 0 && action === 'ring') {
      const apnsKeyJson = Deno.env.get('APNS_KEY_JSON');

      if (!apnsKeyJson) {
        console.warn('APNS_KEY_JSON not configured — skipping iOS VoIP push');
      } else {
        try {
          const apnsConfig = JSON.parse(apnsKeyJson);
          const { keyId, teamId, privateKey } = apnsConfig;
          const bundleId = 'com.zemichat.app';

          const apnsJwt = await createApnsJwt(keyId, teamId, privateKey);

          const apnsPromises = iosVoipTokens.map(async (tokenRow: PushTokenRow) => {
            const result = await sendApnsPush(tokenRow.token, apnsJwt, callData, bundleId);

            if (result.success) {
              sentCount++;
            } else if (result.status === 410 || result.status === 400) {
              // 410 = unregistered, 400 = bad device token
              invalidTokenIds.push(tokenRow.id);
            } else {
              console.error(
                `APNs send failed for token ${tokenRow.id}: status ${result.status}`
              );
            }
          });

          await Promise.all(apnsPromises);
        } catch (err) {
          console.error('APNs push setup error:', err);
        }
      }
    }

    // Clean up invalid tokens
    if (invalidTokenIds.length > 0) {
      await supabase
        .from('push_tokens')
        .delete()
        .in('id', invalidTokenIds);
    }

    return new Response(
      JSON.stringify({ sent: sentCount, cleaned: invalidTokenIds.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('call-push error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
