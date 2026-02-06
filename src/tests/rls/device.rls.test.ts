import { describe, it, beforeAll } from 'vitest';
import {
  getTestWorld,
  expectRows,
  expectNoRows,
  expectSuccess,
  expectRLSError,
  expectBlocked,
  type TestWorld,
} from './helpers/setup';

let w: TestWorld;

beforeAll(async () => {
  w = await getTestWorld();
});

// =====================================================================
// PUSH_TOKENS
// =====================================================================
describe('push_tokens RLS', () => {
  describe('SELECT', () => {
    it('User can see own push tokens', async () => {
      await w.adminClient.from('push_tokens').insert({
        user_id: w.team1.texter.id,
        token: 'test-token-1',
        platform: 'ios',
      });

      const res = await w.team1.texter.client
        .from('push_tokens')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('push_tokens')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });

    it('Other user cannot see push tokens', async () => {
      await w.adminClient.from('push_tokens').insert({
        user_id: w.team1.texter.id,
        token: 'test-token-2',
        platform: 'android',
      });

      const res = await w.team1.super.client
        .from('push_tokens')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('push_tokens')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });
  });

  describe('INSERT', () => {
    it('User can add own push token', async () => {
      const res = await w.team1.texter.client
        .from('push_tokens')
        .insert({
          user_id: w.team1.texter.id,
          token: 'my-device-token',
          platform: 'ios',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('push_tokens').delete().eq('id', res.data.id);
      }
    });

    it('Cannot add push token for someone else', async () => {
      const res = await w.team1.super.client
        .from('push_tokens')
        .insert({
          user_id: w.team1.texter.id,
          token: 'spoofed-token',
          platform: 'ios',
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  describe('UPDATE', () => {
    it('User can update own push token', async () => {
      const { data: tok } = await w.adminClient
        .from('push_tokens')
        .insert({
          user_id: w.team1.texter.id,
          token: 'old-token',
          platform: 'ios',
        })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('push_tokens')
        .update({ token: 'new-token' })
        .eq('id', tok!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('push_tokens').delete().eq('id', tok!.id);
    });
  });

  describe('DELETE', () => {
    it('User can delete own push token', async () => {
      const { data: tok } = await w.adminClient
        .from('push_tokens')
        .insert({
          user_id: w.team1.texter.id,
          token: 'to-delete',
          platform: 'android',
        })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('push_tokens')
        .delete()
        .eq('id', tok!.id)
        .select();
      expectRows(res, 1);
    });

    it('Cannot delete someone elses push token', async () => {
      const { data: tok } = await w.adminClient
        .from('push_tokens')
        .insert({
          user_id: w.team1.texter.id,
          token: 'protected-token',
          platform: 'ios',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('push_tokens')
        .delete()
        .eq('id', tok!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('push_tokens').delete().eq('id', tok!.id);
    });
  });
});

// =====================================================================
// USER_SESSIONS
// =====================================================================
describe('user_sessions RLS', () => {
  describe('SELECT', () => {
    it('User can see own sessions', async () => {
      await w.adminClient.from('user_sessions').insert({
        user_id: w.team1.texter.id,
        device_name: 'iPhone 15',
      });

      const res = await w.team1.texter.client
        .from('user_sessions')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('user_sessions')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });

    it('Owner can see team members sessions', async () => {
      await w.adminClient.from('user_sessions').insert({
        user_id: w.team1.texter.id,
        device_name: 'iPhone 15',
      });

      const res = await w.team1.owner.client
        .from('user_sessions')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('user_sessions')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });

    it('Other team member cannot see sessions', async () => {
      await w.adminClient.from('user_sessions').insert({
        user_id: w.team1.texter.id,
        device_name: 'iPhone 15',
      });

      const res = await w.team1.super.client
        .from('user_sessions')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('user_sessions')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });

    it('Other team Owner cannot see sessions', async () => {
      await w.adminClient.from('user_sessions').insert({
        user_id: w.team1.texter.id,
        device_name: 'iPhone 15',
      });

      const res = await w.team2.owner.client
        .from('user_sessions')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('user_sessions')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });
  });

  describe('INSERT', () => {
    it('User can create own session', async () => {
      const res = await w.team1.texter.client
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'My Device',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('user_sessions').delete().eq('id', res.data.id);
      }
    });

    it('Cannot create session for someone else', async () => {
      const res = await w.team1.super.client
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'Fake Session',
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  describe('UPDATE', () => {
    it('User can update own session', async () => {
      const { data: sess } = await w.adminClient
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'Old Name',
        })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('user_sessions')
        .update({ device_name: 'New Name' })
        .eq('id', sess!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('user_sessions').delete().eq('id', sess!.id);
    });

    it('Cannot update someone elses session', async () => {
      const { data: sess } = await w.adminClient
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'Protected',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('user_sessions')
        .update({ device_name: 'Hacked' })
        .eq('id', sess!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('user_sessions').delete().eq('id', sess!.id);
    });
  });

  describe('DELETE', () => {
    it('User can delete own session', async () => {
      const { data: sess } = await w.adminClient
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'To Delete',
        })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('user_sessions')
        .delete()
        .eq('id', sess!.id)
        .select();
      expectRows(res, 1);
    });

    it('Owner can remotely log out team member (delete session)', async () => {
      const { data: sess } = await w.adminClient
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'Remote Logout',
        })
        .select()
        .single();

      const res = await w.team1.owner.client
        .from('user_sessions')
        .delete()
        .eq('id', sess!.id)
        .select();
      expectRows(res, 1);
    });

    it('Cannot delete other team members session', async () => {
      const { data: sess } = await w.adminClient
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'Protected Session',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('user_sessions')
        .delete()
        .eq('id', sess!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('user_sessions').delete().eq('id', sess!.id);
    });

    it('Other team Owner cannot delete session', async () => {
      const { data: sess } = await w.adminClient
        .from('user_sessions')
        .insert({
          user_id: w.team1.texter.id,
          device_name: 'Cross Team',
        })
        .select()
        .single();

      const res = await w.team2.owner.client
        .from('user_sessions')
        .delete()
        .eq('id', sess!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('user_sessions').delete().eq('id', sess!.id);
    });
  });
});
