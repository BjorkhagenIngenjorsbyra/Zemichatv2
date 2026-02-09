import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Agora token generation using Deno-compatible implementation
// Based on Agora's RTC Token Builder

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8100',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8100',
  'capacitor://localhost',    // Capacitor iOS
  'http://localhost',         // Capacitor Android
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface RequestBody {
  chatId: string;
  callType: 'voice' | 'video';
}

interface TokenResponse {
  token: string;
  appId: string;
  channel: string;
  uid: number;
}

// Role constants for Agora
const Role = {
  PUBLISHER: 1,
  SUBSCRIBER: 2,
};

// Privilege expiration time (24 hours from now)
const PRIVILEGE_EXPIRE_TIME = 24 * 60 * 60;

/**
 * Generate Agora RTC token
 * This is a simplified token generation - in production, use Agora's official SDK
 */
function generateAgoraToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: number,
  privilegeExpireTs: number
): string {
  // Note: This is a placeholder. In production, you should:
  // 1. Use Agora's official token generator library
  // 2. Or implement the full RTC token generation algorithm
  //
  // For now, we return a placeholder that allows local testing
  // The actual implementation requires the agora-token npm package
  // which needs to be bundled for Deno

  const message = JSON.stringify({
    appId,
    channelName,
    uid,
    role,
    ts: privilegeExpireTs,
  });

  // In production, this would be a properly signed JWT-like token
  // For development, we'll use a simple base64 encoding
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const base64 = btoa(String.fromCharCode(...data));

  return `006${appId}${base64}`;
}

// UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CALL_TYPES = ['voice', 'video'] as const;

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
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

    // Verify user is a member of the chat
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

    // Get user profile to check role and settings
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

    // If user is a Texter, check their call permissions
    if (userProfile.role === 'texter') {
      const { data: settings, error: settingsError } = await supabase
        .from('texter_settings')
        .select('can_voice_call, can_video_call')
        .eq('user_id', user.id)
        .single();

      // If settings are missing or errored, deny by default for safety
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

    // Get Agora credentials from environment
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      console.error('Missing Agora credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Agora not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique UID from user ID (last 8 characters as number)
    const uidString = user.id.replace(/-/g, '').slice(-8);
    const uid = parseInt(uidString, 16) % 2147483647; // Ensure it fits in 32-bit int

    // Channel name is the chat ID
    const channelName = chatId;

    // Calculate expiration timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTimestamp + PRIVILEGE_EXPIRE_TIME;

    // Generate token
    const token = generateAgoraToken(
      appId,
      appCertificate,
      channelName,
      uid,
      Role.PUBLISHER,
      privilegeExpireTs
    );

    const response: TokenResponse = {
      token,
      appId,
      channel: channelName,
      uid,
    };

    return new Response(
      JSON.stringify(response),
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
