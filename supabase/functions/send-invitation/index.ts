import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { escapeHtml, isAllowedInviteLink } from '../_shared/escape-html.ts';

interface RequestBody {
  email: string;
  invitationId: string;
  inviteLink: string;
  locale?: string;
}

type Strings = {
  greeting: (name: string) => string;
  body: (inviter: string, team: string) => string;
  cta: string;
  copyLink: string;
  footer: string;
  subject: (inviter: string, team: string) => string;
};

// Localised email copy. Keyed by 2-letter language; defaults to Swedish (the
// primary market). The recipient's own locale is unknown at invite time, so we
// use the inviter's app language.
const EMAIL_STRINGS: Record<string, Strings> = {
  sv: {
    greeting: (n) => (n ? `Hej ${n}!` : 'Hej!'),
    body: (i, t) => `<strong style="color:#F3F4F6;">${i}</strong> har bjudit in dig till <strong style="color:#F3F4F6;">${t}</strong> på Zemichat.`,
    cta: 'Acceptera inbjudan',
    copyLink: 'Eller kopiera den här länken till din webbläsare:',
    footer: 'Inbjudan går ut om 7 dagar. Om du inte väntade dig detta mejl kan du ignorera det.',
    subject: (i, t) => `${i} bjöd in dig till ${t} på Zemichat`,
  },
  en: {
    greeting: (n) => (n ? `Hi ${n}!` : 'Hi!'),
    body: (i, t) => `<strong style="color:#F3F4F6;">${i}</strong> has invited you to join <strong style="color:#F3F4F6;">${t}</strong> on Zemichat.`,
    cta: 'Accept Invitation',
    copyLink: 'Or copy this link into your browser:',
    footer: "This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.",
    subject: (i, t) => `${i} invited you to join ${t} on Zemichat`,
  },
  da: {
    greeting: (n) => (n ? `Hej ${n}!` : 'Hej!'),
    body: (i, t) => `<strong style="color:#F3F4F6;">${i}</strong> har inviteret dig til <strong style="color:#F3F4F6;">${t}</strong> på Zemichat.`,
    cta: 'Acceptér invitation',
    copyLink: 'Eller kopiér dette link til din browser:',
    footer: 'Invitationen udløber om 7 dage. Hvis du ikke forventede denne e-mail, kan du ignorere den.',
    subject: (i, t) => `${i} inviterede dig til ${t} på Zemichat`,
  },
  fi: {
    greeting: (n) => (n ? `Hei ${n}!` : 'Hei!'),
    body: (i, t) => `<strong style="color:#F3F4F6;">${i}</strong> on kutsunut sinut ryhmään <strong style="color:#F3F4F6;">${t}</strong> Zemichatissa.`,
    cta: 'Hyväksy kutsu',
    copyLink: 'Tai kopioi tämä linkki selaimeesi:',
    footer: 'Kutsu vanhenee 7 päivässä. Jos et odottanut tätä viestiä, voit jättää sen huomiotta.',
    subject: (i, t) => `${i} kutsui sinut ryhmään ${t} Zemichatissa`,
  },
  no: {
    greeting: (n) => (n ? `Hei ${n}!` : 'Hei!'),
    body: (i, t) => `<strong style="color:#F3F4F6;">${i}</strong> har invitert deg til <strong style="color:#F3F4F6;">${t}</strong> på Zemichat.`,
    cta: 'Godta invitasjon',
    copyLink: 'Eller kopier denne lenken til nettleseren din:',
    footer: 'Invitasjonen utløper om 7 dager. Hvis du ikke ventet denne e-posten, kan du se bort fra den.',
    subject: (i, t) => `${i} inviterte deg til ${t} på Zemichat`,
  },
};

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
    // Allow overriding the From address per environment. Falls back to the
    // verified production sender. Misconfiguration (e.g. an unverified
    // sender) is one of the common causes that #40 is meant to surface.
    const fromAddress = Deno.env.get('INVITE_FROM_ADDRESS') ?? 'Zemichat <noreply@zemichat.com>';

    // Diagnostic: surface configuration gaps in logs so a missing env var
    // doesn't masquerade as a generic "Failed to send" 5xx (issue #40).
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('send-invitation: Supabase env vars missing', {
        hasUrl: !!supabaseUrl,
        hasAnon: !!supabaseAnonKey,
        hasServiceRole: !!supabaseServiceKey,
      });
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: Supabase env vars missing' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!resendApiKey || !resendApiKey.startsWith('re_')) {
      console.error('send-invitation: RESEND_API_KEY missing or malformed', {
        present: !!resendApiKey,
        prefixOk: resendApiKey.startsWith('re_'),
      });
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
    const { email, invitationId, inviteLink, locale } = body;
    const s = EMAIL_STRINGS[(locale || 'sv').slice(0, 2).toLowerCase()] || EMAIL_STRINGS.sv;

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
                ${s.greeting(safeRecipientName)}
              </p>
              <p style="color:#9CA3AF;font-size:15px;line-height:1.6;margin:0 0 24px;">
                ${s.body(safeInviterName, safeTeamName)}
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${safeInviteLink}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:9999px;">
                      ${s.cta}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#6B7280;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center;">
                ${s.copyLink}<br>
                <a href="${safeInviteLink}" style="color:#A78BFA;word-break:break-all;">${safeInviteLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1E293B;">
              <p style="color:#4B5563;font-size:12px;text-align:center;margin:0;">
                ${s.footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    // Send email via Resend API. We log the call with a correlation id so a
    // failure can be traced back to a specific invitation row (#40).
    const correlationId = invitationId.slice(0, 8);
    console.log(`send-invitation[${correlationId}]: posting to Resend`, {
      to: email,
      from: fromAddress,
      invitationId,
    });

    let resendResponse: Response;
    try {
      resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: email,
          // Subject is plain text in the SMTP envelope — no HTML escaping
          // needed, but we strip control characters / newlines to prevent
          // header injection.
          subject: s.subject(inviterName.replace(/[\r\n]+/g, ' '), teamName.replace(/[\r\n]+/g, ' ')),
          html: htmlEmail,
        }),
      });
    } catch (networkErr) {
      // Network-level failure (DNS, TLS, fetch abort). Distinguish from a
      // 4xx/5xx so the client can prompt a retry rather than show "config".
      console.error(`send-invitation[${correlationId}]: network failure calling Resend`, networkErr);
      return new Response(
        JSON.stringify({
          error: 'Could not reach email provider',
          correlationId,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!resendResponse.ok) {
      const resendErrorBody = await resendResponse.text();
      console.error(
        `send-invitation[${correlationId}]: Resend rejected request`,
        {
          status: resendResponse.status,
          body: resendErrorBody.slice(0, 500),
        }
      );

      // Pick a friendly client-facing error that hints at the real cause.
      // The raw Resend body is logged server-side only — we don't leak
      // their wording in case it changes.
      let clientMsg = 'Failed to send invitation email';
      let clientStatus = 502;
      if (resendResponse.status === 401 || resendResponse.status === 403) {
        clientMsg = 'Email service authentication failed';
        clientStatus = 500;
      } else if (resendResponse.status === 422) {
        clientMsg = 'Email rejected by provider (invalid recipient or sender)';
        clientStatus = 400;
      } else if (resendResponse.status === 429) {
        clientMsg = 'Email provider rate limit hit, please try again shortly';
        clientStatus = 429;
      }

      return new Response(
        JSON.stringify({
          error: clientMsg,
          correlationId,
          providerStatus: resendResponse.status,
        }),
        {
          status: clientStatus,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the Resend response so we can include the provider message-id
    // in logs — invaluable if a recipient says "didn't receive it".
    let resendBody: { id?: string } | null = null;
    try {
      resendBody = await resendResponse.json();
    } catch {
      // Resend should always return JSON on 2xx; tolerate the edge case.
    }
    console.log(`send-invitation[${correlationId}]: Resend accepted`, {
      messageId: resendBody?.id ?? null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent',
        correlationId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    // Log the full error so the cause isn't hidden behind a generic 500.
    // Issue #40 originally surfaced as "internal server error" with no
    // breadcrumbs — that's what this branch addresses.
    console.error('send-invitation: unhandled error', {
      name: err instanceof Error ? err.name : 'unknown',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
