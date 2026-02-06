import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Agora token generation using Deno-compatible implementation
// Based on Agora's RTC Token Builder

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { chatId, callType }: RequestBody = await req.json();

    if (!chatId) {
      return new Response(
        JSON.stringify({ error: 'Missing chatId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user is a Texter, check their call permissions
    if (userProfile.role === 'texter') {
      const { data: settings, error: settingsError } = await supabase
        .from('texter_settings')
        .select('can_voice_call, can_video_call')
        .eq('user_id', user.id)
        .single();

      if (!settingsError && settings) {
        const canCall = callType === 'video' ? settings.can_video_call : settings.can_voice_call;
        if (!canCall) {
          return new Response(
            JSON.stringify({ error: 'Call permission denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get Agora credentials from environment
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      console.error('Missing Agora credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Agora not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating Agora token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
