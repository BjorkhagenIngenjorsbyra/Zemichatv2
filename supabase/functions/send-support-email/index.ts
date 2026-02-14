import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

const VALID_TYPES = ['bug', 'suggestion', 'support'] as const;
const MAX_SUBJECT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
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

    // Rate limiting: max 5 calls/minute
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const rl = await checkRateLimit(serviceClient, 'send-support-email', user.id, 5);
    if (!rl.allowed) {
      return rateLimitResponse(cors, rl.retryAfterSeconds);
    }

    // Parse and validate request body
    const body = await req.json();
    const type = typeof body.type === 'string' ? body.type : '';
    const subject = typeof body.subject === 'string' ? body.subject : '';
    const description = typeof body.description === 'string' ? body.description : '';
    const email = typeof body.email === 'string' ? body.email : '';

    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return new Response(
        JSON.stringify({ error: 'Invalid type, must be "bug", "suggestion", or "support"' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Subject is required and must be at most ${MAX_SUBJECT_LENGTH} characters` }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Description is required and must be at most ${MAX_DESCRIPTION_LENGTH} characters` }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Send email notification via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const typeLabel = type === 'bug' ? 'Bug Report' : type === 'suggestion' ? 'Suggestion' : 'Support';

    const htmlEmail = `
<h2>Zemichat ${typeLabel}</h2>
<p><strong>From:</strong> ${email} (User: ${user.id})</p>
<p><strong>Subject:</strong> ${subject}</p>
<hr/>
<p>${description.replace(/\n/g, '<br/>')}</p>
`.trim();

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Zemichat Support <noreply@zemichat.com>',
        to: 'support@zemichat.com',
        reply_to: email,
        subject: `[${typeLabel}] ${subject}`,
        html: htmlEmail,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend API error:', resendError);
      return new Response(
        JSON.stringify({ error: 'Failed to send support email' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing support email:', error);
    const cors = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
