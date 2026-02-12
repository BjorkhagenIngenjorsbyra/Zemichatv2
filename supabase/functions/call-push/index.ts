import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
}

// ============================================================
// CORS
// ============================================================

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8100',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8100',
  'capacitor://localhost',
  'http://localhost',
  'https://app.zemichat.com',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ============================================================
// FCM Authentication (same as send-push — Google OAuth2)
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
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
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

    // Service role client for DB queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    // Get push tokens for recipients
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('id, user_id, token, platform')
      .in('user_id', activeIds);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get FCM credentials
    const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    if (!fcmServiceAccountJson) {
      console.error('FCM_SERVICE_ACCOUNT_JSON not configured');
      return new Response(JSON.stringify({ error: 'FCM not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(fcmServiceAccountJson);
    const projectId = serviceAccount.project_id;
    const accessToken = await getAccessToken(
      serviceAccount.client_email,
      serviceAccount.private_key
    );

    // Build FCM data based on action
    let fcmData: Record<string, string>;

    if (action === 'ring') {
      // Get caller info for the ring screen
      const { data: caller } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single();

      fcmData = {
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
      fcmData = {
        type: 'call_cancelled',
        callLogId,
      };
    }

    // Send FCM data-only messages (no 'notification' field — handled natively)
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    let sentCount = 0;
    const invalidTokenIds: string[] = [];

    const sendPromises = tokens.map(async (tokenRow: PushTokenRow) => {
      const message: Record<string, unknown> = {
        message: {
          token: tokenRow.token,
          data: fcmData,
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

    await Promise.all(sendPromises);

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
