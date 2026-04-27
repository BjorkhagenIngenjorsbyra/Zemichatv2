// Edge function: report-handler
//
// Called fire-and-forget from src/services/report.ts after a new
// `reports` row is inserted. Responsibilities:
//
//   1. Verify the caller actually authored the report (defence in
//      depth — RLS already restricts INSERT, but we re-check before
//      acting on it).
//   2. Count distinct reporters against the same target. If we have
//      >= 3, mail support@zemichat.com so a human can review.
//   3. Push the team Owner when their team's threshold is hit, so
//      they know to take action / contact Zemi support.
//
// No state is mutated by this function — escalation itself is owned
// by the AFTER INSERT trigger `check_report_escalation()` in
// 20260427160000_extend_reports_for_moderation.sql. We only read +
// notify here so RLS / DB stay the source of truth.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { escapeHtml } from '../_shared/escape-html.ts';

const ESCALATION_THRESHOLD = 3;
const SUPPORT_INBOX = 'support@zemichat.com';

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_message_id: string | null;
  reported_chat_id: string | null;
  target_type: 'message' | 'chat' | 'user' | null;
  category: string | null;
  description: string | null;
  reason: string | null;
  status: string;
  created_at: string;
}

interface UserRow {
  id: string;
  team_id: string;
  display_name: string | null;
  zemi_number: string | null;
  role: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Modest rate limit — a single client should not invoke this more
    // than ~5 times per minute under any legitimate flow.
    const rl = await checkRateLimit(serviceClient, 'report-handler', user.id, 5);
    if (!rl.allowed) {
      return rateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    const body = await req.json().catch(() => ({}));
    const reportId = typeof body.reportId === 'string' ? body.reportId : '';
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(reportId)) {
      return new Response(JSON.stringify({ error: 'Invalid reportId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role read so we don't depend on the caller's RLS view.
    const { data: report, error: reportError } = await serviceClient
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (reportError || !report) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const reportRow = report as ReportRow;

    // Defence in depth: only the reporter (or an Owner who is
    // tracking it) may trigger this notification flow.
    if (reportRow.reporter_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count distinct reporters against the same target. Match the
    // DB trigger's logic so Edge + DB agree on when to escalate.
    let countQuery = serviceClient
      .from('reports')
      .select('reporter_id', { count: 'exact', head: false });

    if (reportRow.reported_message_id) {
      countQuery = countQuery.eq('reported_message_id', reportRow.reported_message_id);
    } else if (reportRow.reported_chat_id) {
      countQuery = countQuery.eq('reported_chat_id', reportRow.reported_chat_id);
    } else if (reportRow.reported_user_id) {
      countQuery = countQuery.eq('reported_user_id', reportRow.reported_user_id);
    } else {
      // Nothing to count — bail out cleanly.
      return new Response(JSON.stringify({ ok: true, escalated: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: rows, error: countError } = await countQuery
      .in('status', ['pending', 'reviewed', 'escalated'])
      .limit(1000);
    if (countError) {
      console.error('report-handler count error:', countError.message);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const distinctReporters = new Set(
      (rows ?? []).map((r) => (r as { reporter_id: string }).reporter_id),
    );
    const escalated = distinctReporters.size >= ESCALATION_THRESHOLD;

    if (!escalated) {
      return new Response(
        JSON.stringify({ ok: true, escalated: false, reporters: distinctReporters.size }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ----------------------------------------------------------------
    // Threshold met. Email support and (best effort) push the Owner.
    // ----------------------------------------------------------------
    let reportedUser: UserRow | null = null;
    if (reportRow.reported_user_id) {
      const { data } = await serviceClient
        .from('users')
        .select('id, team_id, display_name, zemi_number, role')
        .eq('id', reportRow.reported_user_id)
        .maybeSingle();
      reportedUser = (data as UserRow | null) ?? null;
    }

    let reportedChatTeamId: string | null = null;
    if (reportRow.reported_chat_id) {
      // Find a Texter member of the chat — that gives us a team to
      // notify the Owner of (matches the RLS policy we wrote).
      const { data: members } = await serviceClient
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', reportRow.reported_chat_id)
        .is('left_at', null);
      const memberIds = (members ?? []).map((m) => (m as { user_id: string }).user_id);
      if (memberIds.length > 0) {
        const { data: usersInChat } = await serviceClient
          .from('users')
          .select('id, team_id, role')
          .in('id', memberIds);
        const texter = (usersInChat ?? []).find(
          (u) => (u as { role: string }).role === 'texter',
        ) as UserRow | undefined;
        if (texter) reportedChatTeamId = texter.team_id;
      }
    }

    if (resendApiKey) {
      const safeId = escapeHtml(reportRow.id);
      const safeCategory = escapeHtml(reportRow.category ?? reportRow.reason ?? 'unknown');
      const safeDescription = escapeHtml(reportRow.description ?? '').replace(
        /\n/g,
        '<br/>',
      );
      const safeTargetType = escapeHtml(reportRow.target_type ?? 'unknown');
      const safeTargetId = escapeHtml(
        reportRow.reported_message_id ??
          reportRow.reported_chat_id ??
          reportRow.reported_user_id ??
          '',
      );
      const safeReportedDisplay = escapeHtml(
        reportedUser?.display_name ?? reportedUser?.zemi_number ?? '',
      );

      const html = `
<h2>Zemichat — report threshold reached</h2>
<p>A target has crossed the ${ESCALATION_THRESHOLD}-distinct-reporter threshold.</p>
<table cellpadding="6" style="border-collapse:collapse;">
  <tr><td><strong>Triggering report id:</strong></td><td>${safeId}</td></tr>
  <tr><td><strong>Target type:</strong></td><td>${safeTargetType}</td></tr>
  <tr><td><strong>Target id:</strong></td><td>${safeTargetId}</td></tr>
  <tr><td><strong>Category:</strong></td><td>${safeCategory}</td></tr>
  <tr><td><strong>Distinct reporters:</strong></td><td>${distinctReporters.size}</td></tr>
  ${reportedUser ? `<tr><td><strong>Reported user:</strong></td><td>${safeReportedDisplay}</td></tr>` : ''}
</table>
${safeDescription ? `<p><strong>Latest description:</strong></p><p>${safeDescription}</p>` : ''}
<p style="color:#888;font-size:12px;">
  This message is generated automatically. The DB trigger has already
  flipped affected reports to <code>escalated</code>.
</p>`.trim();

      const subject = `[Zemichat] Reports escalated for ${reportRow.target_type ?? 'target'}`
        .replace(/[\r\n]+/g, ' ');

      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Zemichat Moderation <noreply@zemichat.com>',
          to: SUPPORT_INBOX,
          subject,
          html,
        }),
      });
      if (!resendResp.ok) {
        const txt = await resendResp.text();
        console.error('report-handler Resend error:', txt);
        // Fall through — we still want to push the Owner.
      }
    } else {
      console.warn('RESEND_API_KEY missing — escalation email skipped');
    }

    // Best-effort push to the relevant Team Owner.
    const ownerTeamId =
      reportedUser?.team_id ?? reportedChatTeamId ?? null;
    if (ownerTeamId) {
      const { data: team } = await serviceClient
        .from('teams')
        .select('owner_id')
        .eq('id', ownerTeamId)
        .maybeSingle();
      const ownerId = (team as { owner_id: string } | null)?.owner_id ?? null;
      if (ownerId) {
        await serviceClient.functions
          .invoke('send-push', {
            body: {
              userId: ownerId,
              title: 'Reports escalated',
              body: 'A user, message, or chat in your team has been reported by 3+ people. Tap to review.',
              data: { type: 'report_escalated', reportId: reportRow.id },
            },
          })
          .catch((e: unknown) => {
            console.error(
              'report-handler push failed:',
              e instanceof Error ? e.message : String(e),
            );
          });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        escalated: true,
        reporters: distinctReporters.size,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('report-handler unhandled error:', err);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
