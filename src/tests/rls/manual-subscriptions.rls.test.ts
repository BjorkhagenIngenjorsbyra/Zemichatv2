/**
 * RLS tests for manual_subscriptions table.
 *
 * Policies:
 * - SELECT: User can see their own subscription
 * - SELECT: Team owner can see team members' subscriptions
 * - INSERT/UPDATE/DELETE: Only service_role (admin)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestWorld,
  type TestWorld,
  execSQL,
  expectRows,
  expectNoRows,
  expectBlocked,
  IDS,
} from './helpers/setup';

describe('manual_subscriptions RLS', () => {
  let world: TestWorld;

  beforeAll(async () => {
    world = await getTestWorld();
    // Clean up any leftover data from previous test runs
    await world.adminClient
      .from('manual_subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  });

  afterAll(async () => {
    // Clean up all test data
    await world.adminClient
      .from('manual_subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  });

  describe('SELECT policies', () => {
    it('user can see their own manual subscription', async () => {
      // Grant owner1 a manual subscription using service role
      const manualSubId = '77770001-0000-0000-0000-000000000001';

      try {
        // Insert via admin
        const insertResult = await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.owner1,
          plan_type: 'pro',
          reason: 'Test subscription',
        });
        expect(insertResult.error).toBeNull();

        // Owner1 should see their own subscription
        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.owner1);

        expectRows(result, 1);
        expect(result.data![0].plan_type).toBe('pro');
      } finally {
        // Cleanup
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });

    it('user cannot see other users manual subscriptions', async () => {
      const manualSubId = '77770002-0000-0000-0000-000000000002';

      try {
        // Grant texter2 (different team) a subscription
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.texter2,
          plan_type: 'pro',
          reason: 'Test subscription',
        });

        // Owner1 should NOT see texter2's subscription (different team)
        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.texter2);

        expectNoRows(result);
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });

    it('team owner can see team members manual subscriptions', async () => {
      const manualSubId = '77770003-0000-0000-0000-000000000003';

      try {
        // Grant texter1 (same team as owner1) a subscription
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.texter1,
          plan_type: 'pro',
          reason: 'Test subscription',
        });

        // Owner1 should see texter1's subscription (same team)
        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.texter1);

        expectRows(result, 1);
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });

    it('texter cannot see other team members manual subscriptions', async () => {
      const manualSubId = '77770004-0000-0000-0000-000000000004';

      try {
        // Grant super1 a subscription
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.super1,
          plan_type: 'pro',
          reason: 'Test subscription',
        });

        // Texter1 should NOT see super1's subscription (not owner)
        const result = await world.team1.texter.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.super1);

        expectNoRows(result);
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });
  });

  describe('INSERT policies', () => {
    it('regular user cannot insert manual subscription', async () => {
      const result = await world.team1.owner.client
        .from('manual_subscriptions')
        .insert({
          user_id: IDS.owner1,
          plan_type: 'pro',
          reason: 'Self-granted',
        })
        .select();

      expectBlocked(result);
    });

    it('texter cannot grant themselves a subscription', async () => {
      const result = await world.team1.texter.client
        .from('manual_subscriptions')
        .insert({
          user_id: IDS.texter1,
          plan_type: 'pro',
          reason: 'Self-granted',
        })
        .select();

      expectBlocked(result);
    });

    it('admin (service_role) can insert manual subscription', async () => {
      const manualSubId = '77770005-0000-0000-0000-000000000005';

      try {
        const result = await world.adminClient
          .from('manual_subscriptions')
          .insert({
            id: manualSubId,
            user_id: IDS.owner1,
            plan_type: 'pro',
            reason: 'Admin granted',
          })
          .select();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });
  });

  describe('UPDATE policies', () => {
    it('user cannot update their own manual subscription', async () => {
      const manualSubId = '77770006-0000-0000-0000-000000000006';

      try {
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.owner1,
          plan_type: 'basic',
          reason: 'Test',
        });

        // Try to upgrade from basic to pro
        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .update({ plan_type: 'pro' })
          .eq('id', manualSubId)
          .select();

        expectBlocked(result);
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });

    it('admin can update manual subscription', async () => {
      const manualSubId = '77770007-0000-0000-0000-000000000007';

      try {
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.owner1,
          plan_type: 'basic',
          reason: 'Test',
        });

        const result = await world.adminClient
          .from('manual_subscriptions')
          .update({ plan_type: 'pro' })
          .eq('id', manualSubId)
          .select();

        expect(result.error).toBeNull();
        expect(result.data![0].plan_type).toBe('pro');
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });
  });

  describe('DELETE policies', () => {
    it('user cannot delete their own manual subscription', async () => {
      const manualSubId = '77770008-0000-0000-0000-000000000008';

      try {
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.owner1,
          plan_type: 'pro',
          reason: 'Test',
        });

        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);

        expectBlocked(result);

        // Verify still exists
        const checkResult = await world.adminClient
          .from('manual_subscriptions')
          .select('*')
          .eq('id', manualSubId);
        expect(checkResult.data).toHaveLength(1);
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });

    it('admin can delete manual subscription', async () => {
      const manualSubId = '77770009-0000-0000-0000-000000000009';

      await world.adminClient.from('manual_subscriptions').insert({
        id: manualSubId,
        user_id: IDS.owner1,
        plan_type: 'pro',
        reason: 'Test',
      });

      const result = await world.adminClient
        .from('manual_subscriptions')
        .delete()
        .eq('id', manualSubId);

      expect(result.error).toBeNull();

      // Verify deleted
      const checkResult = await world.adminClient
        .from('manual_subscriptions')
        .select('*')
        .eq('id', manualSubId);
      expect(checkResult.data).toHaveLength(0);
    });
  });

  describe('unique constraint', () => {
    it('only one subscription per user allowed', async () => {
      const manualSubId1 = '77770012-0000-0000-0000-000000000012';
      const manualSubId2 = '77770013-0000-0000-0000-000000000013';

      try {
        // First subscription
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId1,
          user_id: IDS.owner1,
          plan_type: 'basic',
          reason: 'First subscription',
        });

        // Try to add second subscription - should fail
        const { error } = await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId2,
          user_id: IDS.owner1,
          plan_type: 'pro',
          reason: 'Second subscription',
        });

        expect(error).not.toBeNull();
        expect(error!.code).toBe('23505'); // Unique violation
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId1);
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId2);
      }
    });
  });

  describe('full flow', () => {
    it('complete flow: user gets Pro features via manual subscription', async () => {
      const manualSubId = '77770014-0000-0000-0000-000000000014';

      try {
        // 1. Verify user initially has no manual subscription
        const initialCheck = await world.team1.texter.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.texter1)
          .maybeSingle();
        expect(initialCheck.data).toBeNull();

        // 2. Admin grants Pro subscription
        const insertResult = await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.texter1,
          plan_type: 'pro',
          expires_at: null, // Permanent
          granted_by: IDS.owner1,
          reason: 'Full flow test',
        });
        expect(insertResult.error).toBeNull();

        // 3. User can now see their Pro subscription
        const { data: subscription, error } = await world.team1.texter.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.texter1)
          .single();

        expect(error).toBeNull();
        expect(subscription).not.toBeNull();
        expect(subscription!.plan_type).toBe('pro');
        expect(subscription!.expires_at).toBeNull(); // Permanent

        // 4. Owner can also see the texter's subscription
        const ownerView = await world.team1.owner.client
          .from('manual_subscriptions')
          .select('*')
          .eq('user_id', IDS.texter1)
          .single();

        expect(ownerView.error).toBeNull();
        expect(ownerView.data!.plan_type).toBe('pro');
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });
  });

  describe('expiration handling', () => {
    it('expired manual subscription is still visible (app handles expiration)', async () => {
      const manualSubId = '77770010-0000-0000-0000-000000000010';
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      try {
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.owner1,
          plan_type: 'pro',
          expires_at: pastDate.toISOString(),
          reason: 'Expired test',
        });

        // User can still see the record (app code handles expiration check)
        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .select('*')
          .eq('id', manualSubId);

        expectRows(result, 1);
        // Compare dates instead of ISO strings (DB may use different timezone format)
        const returnedDate = new Date(result.data![0].expires_at!);
        expect(returnedDate.getTime()).toBe(pastDate.getTime());
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });

    it('permanent subscription has null expires_at', async () => {
      const manualSubId = '77770011-0000-0000-0000-000000000011';

      try {
        await world.adminClient.from('manual_subscriptions').insert({
          id: manualSubId,
          user_id: IDS.owner1,
          plan_type: 'pro',
          expires_at: null,
          reason: 'Permanent subscription',
        });

        const result = await world.team1.owner.client
          .from('manual_subscriptions')
          .select('*')
          .eq('id', manualSubId);

        expectRows(result, 1);
        expect(result.data![0].expires_at).toBeNull();
      } finally {
        await world.adminClient
          .from('manual_subscriptions')
          .delete()
          .eq('id', manualSubId);
      }
    });
  });
});
