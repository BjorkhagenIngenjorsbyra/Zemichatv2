import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { escapeHtml, isAllowedInviteLink } from '../_shared/escape-html.ts';

interface RequestBody {
  email: string;
  invitationId: string;
  inviteLink: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    // Rate limiting: max 5 calls/minute
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const rl = await checkRateLimit(serviceClient, 'send-invitation', user.id, 5);
    if (!rl.allowed) {
      return rateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { email, invitationId, inviteLink } = body;

    if (!email || !invitationId || !inviteLink) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, invitationId, inviteLink' }),
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

    // Validate inviteLink belongs to our app — stops Owner-controlled URLs
    // from being used to phish through the trusted Zemichat email template
    // (audit fix #22).
    if (!isAllowedInviteLink(inviteLink)) {
      return new Response(JSON.stringify({ error: 'Invalid invitation link' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client to fetch invitation details
    const { data: invitation, error: invError } = await serviceClient
      .from('team_invitations')
      .select('*, teams(name), users!team_invitations_invited_by_fkey(display_name)')
      .eq('id', invitationId)
      .maybeSingle();

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

    const teamName = invitation.teams?.name || 'Zemichat';
    const inviterName = invitation.users?.display_name || 'Someone';
    const recipientName = invitation.display_name || '';

    // Escape every user-controlled value before placing in HTML — names can
    // contain characters that would otherwise break out of the attribute /
    // text context (audit fix #22). inviteLink already passed
    // isAllowedInviteLink so its origin is fixed; we still escape the
    // characters that could close an attribute.
    const safeRecipientName = escapeHtml(recipientName);
    const safeInviterName = escapeHtml(inviterName);
    const safeTeamName = escapeHtml(teamName);
    const safeInviteLink = escapeHtml(inviteLink);

    // Build HTML email
    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0B1221;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1221;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#141B2D;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#A78BFA;">Zemichat</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="color:#F3F4F6;font-size:18px;font-weight:600;margin:0 0 8px;">
                ${safeRecipientName ? `Hi ${safeRecipientName}!` : 'Hi!'}
              </p>
              <p style="color:#9CA3AF;font-size:15px;line-height:1.6;margin:0 0 24px;">
                <strong style="color:#F3F4F6;">${safeInviterName}</strong> has invited you to join
                <strong style="color:#F3F4F6;">${safeTeamName}</strong> on Zemichat.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${safeInviteLink}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:9999px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#6B7280;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center;">
                Or copy this link into your browser:<br>
                <a href="${safeInviteLink}" style="color:#A78BFA;word-break:break-all;">${safeInviteLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1E293B;">
              <p style="color:#4B5563;font-size:12px;text-align:center;margin:0;">
                This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Zemichat <noreply@zemichat.com>',
        to: email,
        // Subject is plain text in the SMTP envelope — no HTML escaping
        // needed, but we strip control characters / newlines to prevent
        // header injection.
        subject: `${inviterName.replace(/[\r\n]+/g, ' ')} invited you to join ${teamName.replace(/[\r\n]+/g, ' ')} on Zemichat`,
        html: htmlEmail,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend API error:', resendError);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation email' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('send-invitation error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
