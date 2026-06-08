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
  execSQL(
    `UPDATE public.users SET is_active = true WHERE id IN (
      '${IDS.owner1}','${IDS.super1}','${IDS.texter1}',
      '${IDS.owner2}','${IDS.super2}','${IDS.texter2}'
    );`,
  );
});
