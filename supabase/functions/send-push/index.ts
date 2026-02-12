import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// ============================================================
// Types
// ============================================================

interface RequestPayload {
  message_id: string;
  chat_id: string;
  sender_id: string;
  message_type: string;
  content: string;
}

interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
}

interface TexterSettingsRow {
  user_id: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_days: number[] | null;
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
  };
}

// ============================================================
// FCM Authentication (Google OAuth2 via Service Account)
// ============================================================

/**
 * Base64url encode bytes.
 */
function base64url(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import an RSA private key (PKCS#8 PEM) for signing.
 */
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

/**
 * Create a signed JWT for Google OAuth2.
 */
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

/**
 * Exchange a signed JWT for a Google OAuth2 access token.
 */
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
// Quiet Hours Check
// ============================================================

/**
 * Check if a user is currently in quiet hours.
 * Quiet hours use UTC — times are HH:MM strings, days are 0=Sunday..6=Saturday.
 */
function isInQuietHours(settings: TexterSettingsRow): boolean {
  const { quiet_hours_start, quiet_hours_end, quiet_hours_days } = settings;

  if (!quiet_hours_start || !quiet_hours_end || !quiet_hours_days) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getUTCDay();

  // Check if today is an active quiet hours day
  if (!quiet_hours_days.includes(currentDay)) {
    return false;
  }

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [startH, startM] = quiet_hours_start.split(':').map(Number);
  const [endH, endM] = quiet_hours_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight ranges (e.g., 22:00 - 07:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

// ============================================================
// Notification Body Helper
// ============================================================

/**
 * Build the notification body text based on message type.
 */
function getNotificationBody(messageType: string, content: string): string {
  switch (messageType) {
    case 'text':
      return content || 'Nytt meddelande';
    case 'image':
      return '📷 Bild';
    case 'voice':
      return '🎤 Röstmeddelande';
    case 'video':
      return '🎥 Video';
    case 'document':
      return '📄 Dokument';
    case 'location':
      return '📍 Plats';
    case 'contact':
      return '👤 Kontakt';
    case 'gif':
      return 'GIF';
    case 'sticker':
      return '🏷️ Sticker';
    case 'poll':
      return '📊 Omröstning';
    default:
      return 'Nytt meddelande';
  }
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // No CORS needed — this is triggered internally by pg_net
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Parse payload (sent by pg_net trigger — no auth header)
    const payload: RequestPayload = await req.json();
    const { message_id, chat_id, sender_id, message_type, content } = payload;

    if (!message_id || !chat_id || !sender_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create admin Supabase client (service role, bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limiting: max 60 calls/minute per sender
    const rl = await checkRateLimit(supabase, 'send-push', sender_id, 60);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify message exists and was created recently (< 5 minutes)
    // This replaces Bearer auth — only the DB trigger sends valid, fresh message IDs
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, sender_id')
      .eq('id', message_id)
      .gte('created_at', fiveMinutesAgo)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: 'Invalid or expired message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get sender name
    const { data: sender } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', sender_id)
      .single();

    const senderName = sender?.display_name || 'Någon';

    // Find recipients: active chat members who are not the sender
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id, is_muted')
      .eq('chat_id', chat_id)
      .is('left_at', null)
      .neq('user_id', sender_id);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter out muted members
    const unmutedMemberIds = members
      .filter((m) => !m.is_muted)
      .map((m) => m.user_id);

    if (unmutedMemberIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter out inactive users
    const { data: activeUsers } = await supabase
      .from('users')
      .select('id, role')
      .in('id', unmutedMemberIds)
      .eq('is_active', true);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check quiet hours for Texters
    const texterIds = activeUsers
      .filter((u) => u.role === 'texter')
      .map((u) => u.id);

    let quietHoursBlockedIds: Set<string> = new Set();

    if (texterIds.length > 0) {
      const { data: texterSettings } = await supabase
        .from('texter_settings')
        .select('user_id, quiet_hours_start, quiet_hours_end, quiet_hours_days')
        .in('user_id', texterIds);

      if (texterSettings) {
        for (const settings of texterSettings) {
          if (isInQuietHours(settings)) {
            quietHoursBlockedIds.add(settings.user_id);
          }
        }
      }
    }

    // Final eligible user IDs
    const eligibleUserIds = activeUsers
      .map((u) => u.id)
      .filter((id) => !quietHoursBlockedIds.has(id));

    if (eligibleUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get push tokens for eligible users
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('id, user_id, token, platform')
      .in('user_id', eligibleUserIds);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get FCM service account credentials
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

    // Get OAuth2 access token
    const accessToken = await getAccessToken(
      serviceAccount.client_email,
      serviceAccount.private_key
    );

    // Send notifications
    const notificationBody = getNotificationBody(message_type, content);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sentCount = 0;
    const invalidTokenIds: string[] = [];

    const sendPromises = tokens.map(async (tokenRow: PushTokenRow) => {
      const fcmMessage: FcmMessage = {
        message: {
          token: tokenRow.token,
          notification: {
            title: senderName,
            body: notificationBody,
          },
          data: {
            chatId: chat_id,
            messageId: message_id,
            type: 'new_message',
          },
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
          body: JSON.stringify(fcmMessage),
        });

        if (response.ok) {
          sentCount++;
        } else {
          const errorData = await response.json();
          const errorCode = errorData?.error?.details?.[0]?.errorCode;

          // Token is invalid or unregistered — mark for deletion
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
    console.error('send-push error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
