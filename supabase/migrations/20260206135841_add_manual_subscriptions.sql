-- Manual subscriptions table for granting Pro plan without RevenueCat
-- Used for free trials, partnerships, testing, etc.

CREATE TABLE manual_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type plan_type NOT NULL DEFAULT 'pro',
  expires_at timestamptz, -- NULL means permanent/never expires
  granted_by uuid REFERENCES users(id),
  reason text, -- Optional reason for granting (e.g., "Beta tester", "Partner")
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Only one active subscription per user
  UNIQUE(user_id)
);

-- Index for quick lookups
CREATE INDEX idx_manual_subscriptions_user ON manual_subscriptions(user_id);
CREATE INDEX idx_manual_subscriptions_expires ON manual_subscriptions(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE manual_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own manual subscription
CREATE POLICY manual_subscriptions_select_own ON manual_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Team owners can see their team members' subscriptions
CREATE POLICY manual_subscriptions_select_owner ON manual_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE u.id = manual_subscriptions.user_id
      AND t.owner_id = auth.uid()
    )
  );

-- Only service role can insert/update/delete (admin operations)
-- No policies for INSERT/UPDATE/DELETE means only service_role can do it

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE manual_subscriptions;
