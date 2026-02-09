import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8100',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8100',
  'capacitor://localhost',
  'http://localhost',
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
  email: string;
  invitationId: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with the user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { email, invitationId } = body;

    if (!email || !invitationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, invitationId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate invitationId is UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(invitationId)) {
      return new Response(JSON.stringify({ error: 'Invalid invitation ID format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client to fetch invitation details
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invitation, error: invError } = await serviceClient
      .from('team_invitations')
      .select('*, teams(name), users!team_invitations_invited_by_fkey(display_name)')
      .eq('id', invitationId)
      .single();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller is the one who created the invitation
    if (invitation.invited_by !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build invitation link
    // TODO: Replace with actual app URL in production
    const inviteLink = `${supabaseUrl.replace('.supabase.co', '')}/invite/${invitation.token}`;

    // TODO: Implement actual email sending via Resend, SendGrid, or similar
    // For MVP, we return the link for the Owner to share manually
    // Example future implementation:
    //
    // const resendApiKey = Deno.env.get('RESEND_API_KEY');
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     from: 'Zemichat <noreply@zemichat.com>',
    //     to: email,
    //     subject: `You're invited to join ${invitation.teams?.name} on Zemichat`,
    //     html: `<p>Click here to join: <a href="${inviteLink}">${inviteLink}</a></p>`,
    //   }),
    // });

    return new Response(
      JSON.stringify({
        success: true,
        inviteLink,
        message: 'Invitation link generated. Email sending is not yet configured.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
