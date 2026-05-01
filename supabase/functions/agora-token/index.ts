import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Official agora-token package generates AccessToken2 (007) format. Agora's
// gateway has deprecated AccessToken (006) for projects created in 2025+,
// so we must use 007 to get past "invalid token, authorized failed".
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.5';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CALL_TYPES = ['voice', 'video'] as const;

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
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

    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const rl = await checkRateLimit(serviceClient, 'agora-token', user.id, 10);
    if (!rl.allowed) {
      return rateLimitResponse(cors, rl.retryAfterSeconds);
    }

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

    const { data: membership, error: membershipError } = await supabase
      .from('chat_members')
      .select('id')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this chat' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

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
        .maybeSingle();

      if (settingsError) {
        console.error('texter_settings query failed:', settingsError);
        return new Response(
          JSON.stringify({ error: 'Settings lookup failed' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Saknad rad i texter_settings = nya texters defaults (allt tillåtet).
      // Owner som vill stänga av samtal måste explicit skapa raden med false.
      const canCall = settings
        ? (callType === 'video' ? settings.can_video_call : settings.can_voice_call)
        : true;

      if (!canCall) {
        return new Response(
          JSON.stringify({ error: 'Call permission denied' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }

    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      console.error('Missing Agora credentials: AGORA_APP_ID or AGORA_APP_CERTIFICATE not set');
      return new Response(
        JSON.stringify({ error: 'Agora not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Deterministic uint32 UID from user UUID (fits Agora's int-uid range).
    const uidHex = user.id.replace(/-/g, '').slice(-8);
    const uid = parseInt(uidHex, 16) % 2147483647;
    const channelName = chatId;

    // AccessToken2 (007 prefix). Agora's backend rejects legacy 006 tokens
    // for projects created in 2025+ with "invalid token, authorized failed".
    const tokenExpireSeconds = 24 * 3600; // 24h overall token lifetime
    const privilegeExpireSeconds = 3600;  // 1h join/publish privilege
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      tokenExpireSeconds,
      privilegeExpireSeconds
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
