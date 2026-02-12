import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8100',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8100',
  'capacitor://localhost',    // Capacitor iOS
  'http://localhost',         // Capacitor Android
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

const VALID_TYPES = ['bug', 'suggestion', 'support'] as const;
const MAX_SUBJECT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

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

    // TODO: Send actual email notification (e.g. via Resend, SendGrid, etc.)
    // For now, log the support request for manual review
    console.log('Support request received:', {
      userId: user.id,
      email: user.email,
      type,
      subject,
      descriptionLength: description.length,
      contactEmail: email,
    });

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
