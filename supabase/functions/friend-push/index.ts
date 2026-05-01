import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// Issue #7 — Push notifications for friend requests
// ============================================================
//
// Triggered by DB trigger `notify_friend_request` (see migration
// 20260501110000_friend_push_triggers.sql) when:
//   - A new pending friendship row is inserted (event='request')
//   - A friendship transitions from pending → accepted (event='accepted')
//
// Auth: Bearer shared secret in Authorization header. Same secret as
// send-push (vault key `pg_net_shared_secret`, edge env PG_NET_SHARED_SECRET).
//
// FCM/APNs delivery mirrors send-push but is stripped down — no chat,
// no quiet hours, no rate limiting (DB triggers fire at most a handful of
// times per friendship lifetime, so volume is bounded by user activity).

interface RequestPayload {
  recipient_id: string;
  sender_id: string;
  event: 'request' | 'accepted';
}

interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
}

interface FcmMessage {
  message: {
    token: string;
    notification: {
      title: string;
      body: string;
    };
    data: Record<string, string>;
    android?: {
      priority: string;
    };
    apns?: {
      headers: Record<string, string>;
      payload: {
        aps: {
          sound?: string;
          badge?: number;
        };
      };
    };
  };
}

// ============================================================
// FCM Authentication (Google OAuth2 via Service Account)
// — duplicated from send-push to keep edge functions self-contained
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
// Helpers
// ============================================================

/**
 * Constant-time string compare. Avoids timing oracles on the shared secret.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function buildNotification(
  event: 'request' | 'accepted',
  senderName: string
): { title: string; body: string } {
  if (event === 'request') {
    return {
      title: 'Vänförfrågan',
      body: `${senderName} vill bli vän med dig`,
    };
  }
  return {
    title: 'Vänförfrågan accepterad',
    body: `${senderName} accepterade din vänförfrågan`,
  };
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // No CORS — invoked internally by pg_net
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Authenticate caller against the shared secret. Same pattern as send-push.
    const expectedSecret = Deno.env.get('PG_NET_SHARED_SECRET') ?? '';
    if (!expectedSecret) {
      console.error('PG_NET_SHARED_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const presented = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : '';
    if (!presented || !safeCompare(presented, expectedSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse payload
    const payload: RequestPayload = await req.json();
    const { recipient_id, sender_id, event } = payload;

    if (!recipient_id || !sender_id || !event) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event !== 'request' && event !== 'accepted') {
      return new Response(JSON.stringify({ error: 'Invalid event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Service-role client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify recipient is active and look up their role for the texter check
    const { data: recipient, error: recipientErr } = await supabase
      .from('users')
      .select('id, role, is_active')
      .eq('id', recipient_id)
      .maybeSingle();

    if (recipientErr || !recipient) {
      return new Response(JSON.stringify({ error: 'Recipient not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!recipient.is_active) {
      return new Response(JSON.stringify({ sent: 0, reason: 'inactive' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For Texters, honour the push_enabled toggle in texter_settings.
    if (recipient.role === 'texter') {
      const { data: settings } = await supabase
        .from('texter_settings')
        .select('push_enabled')
        .eq('user_id', recipient_id)
        .maybeSingle();

      if (settings?.push_enabled === false) {
        return new Response(
          JSON.stringify({ sent: 0, reason: 'push_disabled' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Sender display name
    const { data: sender } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', sender_id)
      .maybeSingle();

    const senderName = sender?.display_name || 'Någon';

    // Push tokens for recipient
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('id, user_id, token, platform')
      .eq('user_id', recipient_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // FCM credentials
    const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    if (!fcmServiceAccountJson) {
      console.error('FCM_SERVICE_ACCOUNT_JSON not configured');
      return new Response(JSON.stringify({ error: 'FCM not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(fcmServiceAccountJson);
    const projectId = serviceAccount.project_id;

    const accessToken = await getAccessToken(
      serviceAccount.client_email,
      serviceAccount.private_key
    );

    const { title, body } = buildNotification(event, senderName);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sentCount = 0;
    const invalidTokenIds: string[] = [];

    const sendPromises = tokens.map(async (tokenRow: PushTokenRow) => {
      const fcmMessage: FcmMessage = {
        message: {
          token: tokenRow.token,
          notification: {
            title,
            body,
          },
          data: {
            type: event === 'request' ? 'friend_request' : 'friend_accepted',
            senderId: sender_id,
            recipientId: recipient_id,
          },
          android: {
            priority: 'high',
          },
          ...(tokenRow.platform === 'ios'
            ? {
                apns: {
                  headers: {
                    'apns-priority': '10',
                  },
                  payload: {
                    aps: {
                      sound: 'default',
                      badge: 1,
                    },
                  },
                },
              }
            : {}),
        },
      };

      try {
        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmMessage),
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

    await Promise.all(sendPromises);

    if (invalidTokenIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_tokens')
        .delete()
        .in('id', invalidTokenIds);

      if (deleteError) {
        console.error('Failed to delete invalid tokens:', deleteError.message);
      } else {
        console.log(`Cleaned up ${invalidTokenIds.length} invalid push tokens`);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, cleaned: invalidTokenIds.length }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('friend-push error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
