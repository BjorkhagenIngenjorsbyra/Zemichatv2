import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
// CRC32 (matches crc-32 npm package used by Agora's Node.js SDK)
// ============================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================
// ByteBuf — little-endian binary packing (matches Agora SDK)
// ============================================================

class ByteBuf {
  private parts: Uint8Array[] = [];

  putUint16(v: number): ByteBuf {
    const buf = new Uint8Array(2);
    buf[0] = v & 0xFF;
    buf[1] = (v >>> 8) & 0xFF;
    this.parts.push(buf);
    return this;
  }

  putUint32(v: number): ByteBuf {
    const buf = new Uint8Array(4);
    buf[0] = v & 0xFF;
    buf[1] = (v >>> 8) & 0xFF;
    buf[2] = (v >>> 16) & 0xFF;
    buf[3] = (v >>> 24) & 0xFF;
    this.parts.push(buf);
    return this;
  }

  /** Pack raw bytes with uint16 length prefix (matches Agora's putString for Buffers) */
  putBytes(bytes: Uint8Array): ByteBuf {
    this.putUint16(bytes.length);
    this.parts.push(new Uint8Array(bytes));
    return this;
  }

  /** Pack a UTF-8 string with uint16 length prefix */
  putString(str: string): ByteBuf {
    return this.putBytes(new TextEncoder().encode(str));
  }

  /** Pack a privilege map: uint16 count + (uint16 key + uint32 value) per entry */
  putPrivilegeMap(map: Map<number, number>): ByteBuf {
    this.putUint16(map.size);
    for (const [key, value] of map) {
      this.putUint16(key);
      this.putUint32(value);
    }
    return this;
  }

  pack(): Uint8Array {
    const totalLength = this.parts.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
}

// ============================================================
// HMAC-SHA256 via Web Crypto API
// ============================================================

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

// ============================================================
// Agora AccessToken (006) Builder
//
// Reference: github.com/AgoraIO/Tools/blob/master/DynamicKey/
//            AgoraDynamicKey/nodejs/src/AccessToken.js
//
// Algorithm:
//   1. msg = salt(u32) + ts(u32) + privilegeMap
//   2. val = putString(appId) + u32(crcChannel) + u32(crcUid) + putBytes(msg)
//   3. sig = HMAC-SHA256(appCertificate, val)
//   4. content = putBytes(sig) + u32(crcChannel) + u32(crcUid) + putBytes(msg)
//   5. token = "006" + appId + base64(content)
// ============================================================

const VERSION = '006';

// RTC Privilege constants
const kJoinChannel = 1;
const kPublishAudioStream = 2;
const kPublishVideoStream = 3;
const kPublishDataStream = 4;

async function buildRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: number,
  privilegeExpireTs: number
): Promise<string> {
  const encoder = new TextEncoder();
  const uidStr = String(uid);

  // Random salt (1–99999999, matches Agora SDK range)
  const salt = Math.floor(Math.random() * 99999998) + 1;
  // Token-level expiry: now + 24h (separate from privilege expiry)
  const ts = Math.floor(Date.now() / 1000) + 24 * 3600;

  // Build privilege map
  const privileges = new Map<number, number>();
  privileges.set(kJoinChannel, privilegeExpireTs);
  if (role === 1) {
    privileges.set(kPublishAudioStream, privilegeExpireTs);
    privileges.set(kPublishVideoStream, privilegeExpireTs);
    privileges.set(kPublishDataStream, privilegeExpireTs);
  }

  // 1. Build message bytes
  const msg = new ByteBuf()
    .putUint32(salt)
    .putUint32(ts)
    .putPrivilegeMap(privileges)
    .pack();

  // 2. CRC32 of channel name and uid string
  const crcChannel = crc32(encoder.encode(channelName));
  const crcUid = crc32(encoder.encode(uidStr));

  // 3. Build signing value (same structure as content but with appId instead of sig)
  const val = new ByteBuf()
    .putString(appId)
    .putUint32(crcChannel)
    .putUint32(crcUid)
    .putBytes(msg)
    .pack();

  // 4. HMAC-SHA256 signature
  const sig = await hmacSha256(encoder.encode(appCertificate), val);

  // 5. Build content: sig + crc + crc + msg
  const content = new ByteBuf()
    .putBytes(sig)
    .putUint32(crcChannel)
    .putUint32(crcUid)
    .putBytes(msg)
    .pack();

  // 6. Base64-encode content
  const base64 = btoa(String.fromCharCode(...content));

  return VERSION + appId + base64;
}

// ============================================================
// VALIDATION
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CALL_TYPES = ['voice', 'video'] as const;

// ============================================================
// EDGE FUNCTION HANDLER
// ============================================================

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Parse & validate body
    const body = await req.json();
    const chatId = typeof body.chatId === 'string' ? body.chatId : '';
    const callType = typeof body.callType === 'string' ? body.callType : '';

    if (!chatId || !UUID_REGEX.test(chatId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing chatId' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_CALL_TYPES.includes(callType as typeof VALID_CALL_TYPES[number])) {
      return new Response(
        JSON.stringify({ error: 'Invalid callType, must be "voice" or "video"' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Verify chat membership
    const { data: membership, error: membershipError } = await supabase
      .from('chat_members')
      .select('id')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this chat' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Check Texter call permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (userProfile.role === 'texter') {
      const { data: settings, error: settingsError } = await supabase
        .from('texter_settings')
        .select('can_voice_call, can_video_call')
        .eq('user_id', user.id)
        .single();

      if (settingsError || !settings) {
        return new Response(
          JSON.stringify({ error: 'Call permission denied' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const canCall = callType === 'video' ? settings.can_video_call : settings.can_voice_call;
      if (!canCall) {
        return new Response(
          JSON.stringify({ error: 'Call permission denied' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get Agora credentials
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      console.error('Missing Agora credentials: AGORA_APP_ID or AGORA_APP_CERTIFICATE not set');
      return new Response(
        JSON.stringify({ error: 'Agora not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Generate UID from user UUID (deterministic, fits in uint32)
    const uidHex = user.id.replace(/-/g, '').slice(-8);
    const uid = parseInt(uidHex, 16) % 2147483647;

    // Channel = chat ID (both users join the same channel)
    const channelName = chatId;

    // Privilege expiry: 1 hour from now
    const privilegeExpireTs = Math.floor(Date.now() / 1000) + 3600;

    // Generate REAL Agora RTC token
    const token = await buildRtcToken(
      appId,
      appCertificate,
      channelName,
      uid,
      1, // PUBLISHER
      privilegeExpireTs
    );

    return new Response(
      JSON.stringify({ token, appId, channel: channelName, uid }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating Agora token:', error);
    const cors = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
