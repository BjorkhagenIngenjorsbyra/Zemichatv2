/**
 * Test-isolation guard for the RLS suite.
 *
 * The RLS tests share ONE Supabase instance seeded once via global-setup. Several
 * tests deactivate a user mid-test to assert the auth_user_is_active() gate. If
 * such a test's restore is skipped (assertion throws before it) or file ordering
 * shifts, a later test's INSERT (which requires auth_user_is_active()) fails with
 * a misleading 42501 — a false failure unrelated to the code under test.
 *
 * Resetting all seeded users to active before every test makes the suite
 * order-independent on that axis. Registered via setupFiles in vitest.config.rls.ts.
 */
import { beforeAll } from 'vitest';
import { execSQL, IDS } from './setup';

// beforeAll (once per test file), NOT beforeEach: fixes cross-file pollution
// where an earlier file leaves a user inactive, without racing the in-test
// deactivate/restore toggles inside individual "deactivated user cannot X" tests.
beforeAll(() => {
  // Re-activate all seeded users (some tests deactivate to assert the
  // auth_user_is_active() gate; cross-file leftovers would falsely fail others).
  execSQL(
    `UPDATE public.users SET is_active = true WHERE id IN (
      '${IDS.owner1}','${IDS.super1}','${IDS.texter1}',
      '${IDS.owner2}','${IDS.super2}','${IDS.texter2}'
    );`,
  );
  // Reset texter capability flags to canonical (all true). call-logs/quick-message
  // tests toggle can_voice_call / can_video_call etc.; leftovers cause flaky
  // cross-file failures on tests that expect the capability enabled.
  execSQL(
    `UPDATE public.texter_settings SET
       can_send_images = true, can_send_voice = true, can_send_video = true,
       can_send_documents = true, can_share_location = true, can_voice_call = true,
       can_video_call = true, can_screen_share = true, can_access_wall = true,
       push_enabled = true
     WHERE user_id IN ('${IDS.texter1}','${IDS.texter2}');`,
  );
});
