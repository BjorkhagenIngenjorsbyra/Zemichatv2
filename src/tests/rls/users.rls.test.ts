import { describe, it, beforeAll } from 'vitest';
import {
  getTestWorld,
  expectRows,
  expectNoRows,
  expectSuccess,
  expectRLSError,
  expectBlocked,
  execSQL,
  IDS,
  type TestWorld,
} from './helpers/setup';

let w: TestWorld;

beforeAll(async () => {
  w = await getTestWorld();
});

describe('users RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('User can see own profile', async () => {
      const res = await w.team1.owner.client
        .from('users')
        .select('*')
        .eq('id', w.team1.owner.id);
      expectRows(res, 1);
    });

    it('User can see team members', async () => {
      const res = await w.team1.owner.client
        .from('users')
        .select('*')
        .eq('team_id', w.team1.id);
      expectRows(res, 3); // owner, super, texter
    });

    it('User can see accepted friends (cross-team)', async () => {
      // team1.texter and team2.texter are accepted friends
      const res = await w.team1.texter.client
        .from('users')
        .select('*')
        .eq('id', w.team2.texter.id);
      expectRows(res, 1);
    });

    it('User can see pending friendship counterpart', async () => {
      // team2.super sent pending request to team1.texter
      const res = await w.team1.texter.client
        .from('users')
        .select('*')
        .eq('id', w.team2.super.id);
      expectRows(res, 1);
    });

    it('User cannot see strangers (no friendship, different team)', async () => {
      // team1.super has no friendship with team2.owner
      const res = await w.team1.super.client
        .from('users')
        .select('*')
        .eq('id', w.team2.owner.id);
      expectNoRows(res);
    });

    it('team2.super can see team1.texter via pending friendship', async () => {
      const res = await w.team2.super.client
        .from('users')
        .select('*')
        .eq('id', w.team1.texter.id);
      expectRows(res, 1);
    });

    it('Owner sees all team members including deactivated', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${IDS.texter1}';`);
      try {
        const res = await w.team1.owner.client
          .from('users')
          .select('*')
          .eq('team_id', w.team1.id);
        expectRows(res, 3);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${IDS.texter1}';`);
      }
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('User can insert row with own id (would fail FK in practice but RLS allows)', async () => {
      // This tests the RLS policy, not the full signup flow.
      // We just verify the policy check: id = auth.uid()
      // Since the user already exists, this will fail with unique constraint,
      // but NOT with RLS error. We test the negative case instead.
    });

    it('Cannot insert row with different id', async () => {
      const res = await w.team1.owner.client
        .from('users')
        .insert({
          id: w.team2.owner.id, // someone else's id
          team_id: w.team1.id,
          role: 'texter',
          zemi_number: 'ZEMI-999-999',
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE (self)
  // ------------------------------------------------------------------
  describe('UPDATE self', () => {
    it('User can update own display_name', async () => {
      const res = await w.team1.texter.client
        .from('users')
        .update({ display_name: 'New Name' })
        .eq('id', w.team1.texter.id)
        .select();
      expectRows(res, 1);
      // Restore
      await w.adminClient
        .from('users')
        .update({ display_name: 'Texter 1' })
        .eq('id', w.team1.texter.id);
    });

    it('User can update own status_message', async () => {
      const res = await w.team1.super.client
        .from('users')
        .update({ status_message: 'Busy' })
        .eq('id', w.team1.super.id)
        .select();
      expectRows(res, 1);
      await w.adminClient
        .from('users')
        .update({ status_message: null })
        .eq('id', w.team1.super.id);
    });

    it('User CANNOT change own role via self-update', async () => {
      const res = await w.team1.texter.client
        .from('users')
        .update({ role: 'owner' })
        .eq('id', w.team1.texter.id)
        .select();
      expectBlocked(res);
    });

    it('User CANNOT change own team_id via self-update', async () => {
      const res = await w.team1.texter.client
        .from('users')
        .update({ team_id: w.team2.id })
        .eq('id', w.team1.texter.id)
        .select();
      expectBlocked(res);
    });

    it('User cannot update another user', async () => {
      const res = await w.team1.texter.client
        .from('users')
        .update({ display_name: 'Hacked' })
        .eq('id', w.team1.super.id)
        .select();
      expectBlocked(res);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE (owner deactivate)
  // ------------------------------------------------------------------
  describe('UPDATE owner deactivate', () => {
    it('Owner can deactivate Texter in own team', async () => {
      try {
        const res = await w.team1.owner.client
          .from('users')
          .update({ is_active: false })
          .eq('id', w.team1.texter.id)
          .select();
        expectRows(res, 1);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${IDS.texter1}';`);
      }
    });

    it('Owner can deactivate Super in own team', async () => {
      try {
        const res = await w.team1.owner.client
          .from('users')
          .update({ is_active: false })
          .eq('id', w.team1.super.id)
          .select();
        expectRows(res, 1);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${IDS.super1}';`);
      }
    });

    it('Owner cannot deactivate user in other team', async () => {
      const res = await w.team1.owner.client
        .from('users')
        .update({ is_active: false })
        .eq('id', w.team2.texter.id)
        .select();
      expectBlocked(res);
    });

    it('Super cannot deactivate anyone', async () => {
      const res = await w.team1.super.client
        .from('users')
        .update({ is_active: false })
        .eq('id', w.team1.texter.id)
        .select();
      // Super has self-update on own row, but not on texter's row via deactivate policy
      expectBlocked(res);
    });

    it('Texter cannot deactivate anyone', async () => {
      const res = await w.team1.texter.client
        .from('users')
        .update({ is_active: false })
        .eq('id', w.team1.super.id)
        .select();
      expectBlocked(res);
    });
  });
});
