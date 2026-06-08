/**
 * Regression: a Team Owner's per-texter permission toggle must actually gate the
 * feature in the texter's UI — not only in the DB. Verified with the team on the
 * PRO plan so the subscription layer allows the feature, isolating the toggle.
 *
 * Covers can_send_voice (was previously gated only by the subscription, so the
 * owner's toggle had no effect). Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';
const OWNER_TEXTER_CHAT = 'cccc0004-0000-0000-0000-000000000004';
const TEXTER1 = 'aaaa0003-0000-0000-0000-000000000003';

// Well-known local Supabase demo service key (same as the RLS global setup).
const admin = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function setVoice(allowed: boolean) {
  await admin.from('texter_settings').update({ can_send_voice: allowed }).eq('user_id', TEXTER1);
}

test('owner toggle can_send_voice gates the texter voice recorder in the UI', async ({ browser }) => {
  // Put the team on PRO so the subscription layer allows voice — isolating the toggle.
  await admin.from('teams').update({ plan: 'pro' }).eq('name', 'Team Alpha');

  try {
    // Toggle OFF → voice recorder must be hidden for the texter.
    await setVoice(false);
    let u = await loginUser(browser, 'user-aaaa0003@test.local', 'test-password-123!', BASE_URL);
    try {
      await u.page.goto(`${BASE_URL}/chat/${OWNER_TEXTER_CHAT}`);
      await u.page.waitForLoadState('networkidle');
      await u.page.waitForTimeout(1000);
      await expect(u.page.getByRole('button', { name: 'Tap to record' })).toHaveCount(0);
    } finally {
      await u.context.close();
    }

    // Toggle ON → voice recorder must be present.
    await setVoice(true);
    u = await loginUser(browser, 'user-aaaa0003@test.local', 'test-password-123!', BASE_URL);
    try {
      await u.page.goto(`${BASE_URL}/chat/${OWNER_TEXTER_CHAT}`);
      await u.page.waitForLoadState('networkidle');
      await u.page.waitForTimeout(1000);
      await expect(u.page.getByRole('button', { name: 'Tap to record' })).toHaveCount(1);
    } finally {
      await u.context.close();
    }
  } finally {
    // Restore seed defaults.
    await setVoice(true);
    await admin.from('teams').update({ plan: 'free' }).eq('name', 'Team Alpha');
  }
});
