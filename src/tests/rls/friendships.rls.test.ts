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

describe('friendships RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Requester can see own friendship', async () => {
      const res = await w.team1.texter.client
        .from('friendships')
        .select('*')
        .eq('id', w.friendships.acceptedCrossTeam);
      expectRows(res, 1);
    });

    it('Addressee can see friendship', async () => {
      const res = await w.team2.texter.client
        .from('friendships')
        .select('*')
        .eq('id', w.friendships.acceptedCrossTeam);
      expectRows(res, 1);
    });

    it('Owner can see friendships of team members', async () => {
      // Owner1 sees texter1's friendships
      const res = await w.team1.owner.client
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${w.team1.texter.id},addressee_id.eq.${w.team1.texter.id}`);
      expectRows(res, 2); // accepted + pending
    });

    it('Stranger cannot see friendship', async () => {
      // super1 is not party to texter1↔texter2 friendship, but owner oversight applies
      // Actually super1 is NOT an owner, so owner oversight doesn't apply
      // And super1 is neither requester nor addressee
      const res = await w.team1.super.client
        .from('friendships')
        .select('*')
        .eq('id', w.friendships.acceptedCrossTeam);
      expectNoRows(res);
    });

    it('Owner from other team can see friendship if their member is involved', async () => {
      // Owner2 sees texter2's friendships
      const res = await w.team2.owner.client
        .from('friendships')
        .select('*')
        .eq('id', w.friendships.acceptedCrossTeam);
      expectRows(res, 1);
    });

    it('Pending friendship visible to addressee', async () => {
      const res = await w.team1.texter.client
        .from('friendships')
        .select('*')
        .eq('id', w.friendships.pendingForTexter);
      expectRows(res, 1);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Active user can send friend request (requester = self, status = pending)', async () => {
      const res = await w.team1.super.client
        .from('friendships')
        .insert({
          requester_id: w.team1.super.id,
          addressee_id: w.team2.texter.id,
          status: 'pending',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('friendships').delete().eq('id', res.data.id);
      }
    });

    it('Cannot send friend request as someone else', async () => {
      const res = await w.team1.super.client
        .from('friendships')
        .insert({
          requester_id: w.team1.texter.id, // impersonation
          addressee_id: w.team2.super.id,
          status: 'pending',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Cannot insert with status = accepted directly', async () => {
      const res = await w.team1.super.client
        .from('friendships')
        .insert({
          requester_id: w.team1.super.id,
          addressee_id: w.team2.owner.id,
          status: 'accepted',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Deactivated user cannot send friend request', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.super.id}';`);
      try {
        const res = await w.team1.super.client
          .from('friendships')
          .insert({
            requester_id: w.team1.super.id,
            addressee_id: w.team2.owner.id,
            status: 'pending',
          })
          .select()
          .single();
        expectRLSError(res);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${w.team1.super.id}';`);
      }
    });
  });

  // ------------------------------------------------------------------
  // UPDATE (accept) — CRITICAL
  // ------------------------------------------------------------------
  describe('UPDATE accept', () => {
    it('Super can accept incoming friend request to self', async () => {
      // Create a pending request to super1
      const { data: req } = await w.adminClient
        .from('friendships')
        .insert({
          requester_id: w.team2.owner.id,
          addressee_id: w.team1.super.id,
          status: 'pending',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', req!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('friendships').delete().eq('id', req!.id);
    });

    it('Owner can accept incoming friend request to self', async () => {
      const { data: req } = await w.adminClient
        .from('friendships')
        .insert({
          requester_id: w.team2.super.id,
          addressee_id: w.team1.owner.id,
          status: 'pending',
        })
        .select()
        .single();

      const res = await w.team1.owner.client
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', req!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('friendships').delete().eq('id', req!.id);
    });

    it('Owner can accept friend request on behalf of Texter', async () => {
      // pendingForTexter: super2 → texter1 (pending)
      const res = await w.team1.owner.client
        .from('friendships')
        .update({ status: 'accepted', approved_by: w.team1.owner.id })
        .eq('id', w.friendships.pendingForTexter)
        .select();
      expectRows(res, 1);

      // Restore to pending
      await w.adminClient
        .from('friendships')
        .update({ status: 'pending', approved_by: null })
        .eq('id', w.friendships.pendingForTexter);
    });

    it('TEXTER CANNOT accept incoming friend request — CRITICAL', async () => {
      const res = await w.team1.texter.client
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', w.friendships.pendingForTexter)
        .select();
      expectBlocked(res);
    });

    it('Requester cannot accept their own outgoing request', async () => {
      // super2 sent the pending request, cannot accept it
      const res = await w.team2.super.client
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', w.friendships.pendingForTexter)
        .select();
      expectBlocked(res);
    });
  });

  // ------------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------------
  describe('DELETE', () => {
    it('Either party can unfriend', async () => {
      // Create a friendship to delete
      const { data: f } = await w.adminClient
        .from('friendships')
        .insert({
          requester_id: w.team1.super.id,
          addressee_id: w.team2.super.id,
          status: 'accepted',
        })
        .select()
        .single();

      const res = await w.team2.super.client
        .from('friendships')
        .delete()
        .eq('id', f!.id)
        .select();
      expectRows(res, 1);
    });

    it('Owner can delete friendship for team member', async () => {
      // Create a friendship between texter1 and super2
      const { data: f } = await w.adminClient
        .from('friendships')
        .insert({
          requester_id: w.team1.texter.id,
          addressee_id: w.team2.owner.id,
          status: 'accepted',
        })
        .select()
        .single();

      // Owner1 deletes on behalf of texter1
      const res = await w.team1.owner.client
        .from('friendships')
        .delete()
        .eq('id', f!.id)
        .select();
      expectRows(res, 1);
    });

    it('Stranger cannot delete friendship', async () => {
      // super1 cannot delete texter1↔texter2 friendship (not party, not owner via policy)
      // Actually, friendships_delete_owner checks is_team_owner_of
      // super1 is not an owner, so this should be blocked
      const res = await w.team1.super.client
        .from('friendships')
        .delete()
        .eq('id', w.friendships.acceptedCrossTeam)
        .select();
      expectBlocked(res);
    });
  });
});
