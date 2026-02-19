import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

interface RequestBody {
  token: string;
  email: string;
  password: string;
  displayName?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body: RequestBody = await req.json();
    const { token, email, password, displayName } = body;

    if (!token || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token, email, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find and validate the invitation
    const { data: invitation, error: invError } = await serviceClient
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invitation.claimed_at) {
      return new Response(
        JSON.stringify({ error: 'Invitation already claimed' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify email matches invitation (case-insensitive)
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Email does not match invitation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user via admin API with email pre-confirmed
    const { data: userData, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || invitation.display_name || '',
      },
    });

    if (createError) {
      // If user already exists, it's not necessarily an error — they might have
      // signed up via normal signUp but never confirmed email
      if (createError.message?.includes('already been registered')) {
        // Try to confirm the existing user's email and update password
        const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
          await serviceClient.auth.admin.updateUser(existingUser.id, {
            email_confirm: true,
            password,
            user_metadata: {
              display_name: displayName || invitation.display_name || '',
            },
          });
        } else {
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return success — client will sign in and claim the invitation
    return new Response(
      JSON.stringify({
        success: true,
        userId: userData?.user?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('create-invited-user error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
