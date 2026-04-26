import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// RevenueCat → Supabase webhook
//
// RevenueCat is the source of truth for subscriptions. The mobile clients
// MUST NOT update teams.plan — RLS policy `teams_update_owner_no_plan`
// forbids it. Instead, RevenueCat is configured (Dashboard → Project →
// Integrations → Webhooks) to POST events to this endpoint with a fixed
// `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>` header.
//
// Required Edge Function secrets:
//   - REVENUECAT_WEBHOOK_AUTH        : opaque shared secret matching the
//                                       value in the RevenueCat dashboard
//   - SUPABASE_URL                   : auto-set by Supabase
//   - SUPABASE_SERVICE_ROLE_KEY      : auto-set by Supabase
//
// We map the event_type to a SubscriptionStatus and update the team that
// owns the user identified by `app_user_id`. RevenueCat sets the app user
// ID to the Supabase auth.user.id when calling Purchases.configure().
//
// Audit fix #20.
// ============================================================

interface RevenueCatEvent {
  api_version?: string;
  event: {
    id: string;
    type: string; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
    //                BILLING_ISSUE, SUBSCRIBER_ALIAS, NON_RENEWING_PURCHASE,
    //                PRODUCT_CHANGE, TRANSFER, UNCANCELLATION, ...
    app_user_id: string;
    original_app_user_id?: string;
    product_id?: string;
    entitlement_ids?: string[] | null;
    expiration_at_ms?: number | null;
    period_type?: 'NORMAL' | 'TRIAL' | 'INTRO' | 'PROMOTIONAL' | string;
    environment?: 'PRODUCTION' | 'SANDBOX';
  };
}

// Match the entitlement identifiers used in src/services/subscription.ts.
const ENTITLEMENT_BASIC = 'plus';
const ENTITLEMENT_PRO = 'plus_ringa';

// PlanType values mirror src/types/database.ts.
type PlanType = 'free' | 'basic' | 'pro';

function mapEntitlementsToPlan(entitlements: string[] | null | undefined): PlanType {
  if (!entitlements || entitlements.length === 0) return 'free';
  if (entitlements.includes(ENTITLEMENT_PRO)) return 'pro';
  if (entitlements.includes(ENTITLEMENT_BASIC)) return 'basic';
  return 'free';
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify webhook authentication. RevenueCat sends a fixed Authorization
  // header value configured in the dashboard. We compare in constant time.
  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
  if (!expectedAuth) {
    console.error('REVENUECAT_WEBHOOK_AUTH not configured');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const presented = req.headers.get('Authorization') ?? '';
  // RevenueCat lets the operator pick the exact value (some configure
  // "Bearer <secret>", some just "<secret>") — accept either form.
  const presentedNormalized = presented.startsWith('Bearer ')
    ? presented.slice('Bearer '.length)
    : presented;
  const expectedNormalized = expectedAuth.startsWith('Bearer ')
    ? expectedAuth.slice('Bearer '.length)
    : expectedAuth;

  if (!presentedNormalized || !safeCompare(presentedNormalized, expectedNormalized)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RevenueCatEvent;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = body?.event;
  if (!event || !event.type || !event.app_user_id) {
    return new Response(JSON.stringify({ error: 'Missing event payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the user's team. app_user_id must equal the Supabase auth user id.
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', event.app_user_id)
    .maybeSingle();

  if (userErr) {
    console.error('rc-webhook user lookup failed:', userErr.message);
    return new Response(JSON.stringify({ error: 'User lookup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!userRow) {
    // Unknown user — return 200 so RevenueCat doesn't retry forever, but log.
    console.warn(`rc-webhook: no user with id=${event.app_user_id}`);
    return new Response(JSON.stringify({ ok: true, skipped: 'unknown_user' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const teamId = (userRow as { team_id: string }).team_id;

  // Map event → desired plan. Most events carry the active entitlements;
  // for cancellation/expiration we explicitly downgrade to 'free'.
  let nextPlan: PlanType;
  let trialEndsAt: string | null = null;

  switch (event.type) {
    case 'CANCELLATION':
      // CANCELLATION fires when the user opts out — the entitlement is still
      // active until expiration. Don't downgrade yet; rely on EXPIRATION.
      // We still record any trial end if present.
      nextPlan = mapEntitlementsToPlan(event.entitlement_ids);
      if (event.period_type === 'TRIAL' && event.expiration_at_ms) {
        trialEndsAt = new Date(event.expiration_at_ms).toISOString();
      }
      break;
    case 'EXPIRATION':
    case 'BILLING_ISSUE':
      // Treat as downgrade — entitlements are no longer active.
      nextPlan = 'free';
      trialEndsAt = null;
      break;
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
    case 'TRANSFER':
      nextPlan = mapEntitlementsToPlan(event.entitlement_ids);
      if (event.period_type === 'TRIAL' && event.expiration_at_ms) {
        trialEndsAt = new Date(event.expiration_at_ms).toISOString();
      }
      break;
    case 'SUBSCRIBER_ALIAS':
    case 'TEST':
      // No state change required.
      return new Response(JSON.stringify({ ok: true, skipped: event.type }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    default:
      // Unknown event type — apply entitlements if provided, otherwise no-op.
      nextPlan = mapEntitlementsToPlan(event.entitlement_ids);
      break;
  }

  // Build the update. We touch only `plan` (and trial_ends_at when relevant)
  // — do NOT clobber other team fields.
  const update: Record<string, unknown> = { plan: nextPlan };
  if (trialEndsAt !== null) {
    update.trial_ends_at = trialEndsAt;
  } else if (event.type === 'EXPIRATION' || event.type === 'BILLING_ISSUE') {
    update.trial_ends_at = null;
  }

  const { error: updateErr } = await supabase
    .from('teams')
    .update(update as never)
    .eq('id', teamId);

  if (updateErr) {
    console.error('rc-webhook team update failed:', updateErr.message);
    return new Response(JSON.stringify({ error: 'Update failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      event_id: event.id,
      type: event.type,
      team_id: teamId,
      plan: nextPlan,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
