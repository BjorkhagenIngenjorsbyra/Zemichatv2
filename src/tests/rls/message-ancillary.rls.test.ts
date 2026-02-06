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
// MESSAGE_REACTIONS
// =====================================================================
describe('message_reactions RLS', () => {
  describe('SELECT', () => {
    it('Chat member can see reactions', async () => {
      const res = await w.team1.super.client
        .from('message_reactions')
        .select('*')
        .eq('message_id', w.messages.normalMsg);
      expectRows(res, 1);
    });

    it('Non-member cannot see reactions', async () => {
      const res = await w.team2.texter.client
        .from('message_reactions')
        .select('*')
        .eq('message_id', w.messages.normalMsg);
      expectNoRows(res);
    });

    it('Owner oversight: sees reactions in Texter chats', async () => {
      const res = await w.team1.owner.client
        .from('message_reactions')
        .select('*')
        .eq('message_id', w.messages.normalMsg);
      expectRows(res, 1);
    });

    it('Owner CANNOT see reactions in Super↔Super chat', async () => {
      // Seed a reaction in super chat
      await w.adminClient.from('message_reactions').insert({
        message_id: w.messages.inSuperChat,
        user_id: w.team1.super.id,
        emoji: '🔒',
      });

      const res = await w.team1.owner.client
        .from('message_reactions')
        .select('*')
        .eq('message_id', w.messages.inSuperChat);
      expectNoRows(res);

      await w.adminClient
        .from('message_reactions')
        .delete()
        .eq('message_id', w.messages.inSuperChat)
        .eq('user_id', w.team1.super.id);
    });
  });

  describe('INSERT', () => {
    it('Active chat member can add reaction', async () => {
      const res = await w.team1.super.client
        .from('message_reactions')
        .insert({
          message_id: w.messages.normalMsg,
          user_id: w.team1.super.id,
          emoji: '❤️',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('message_reactions').delete().eq('id', res.data.id);
      }
    });

    it('Cannot add reaction as someone else', async () => {
      const res = await w.team1.super.client
        .from('message_reactions')
        .insert({
          message_id: w.messages.normalMsg,
          user_id: w.team1.texter.id, // impersonation
          emoji: '💀',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Non-member cannot add reaction', async () => {
      const res = await w.team2.texter.client
        .from('message_reactions')
        .insert({
          message_id: w.messages.normalMsg,
          user_id: w.team2.texter.id,
          emoji: '👎',
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  describe('DELETE', () => {
    it('User can remove own reaction', async () => {
      const res = await w.team1.texter.client
        .from('message_reactions')
        .delete()
        .eq('id', w.reactionId)
        .select();
      expectRows(res, 1);
      // Restore
      await w.adminClient.from('message_reactions').insert({
        id: w.reactionId,
        message_id: w.messages.normalMsg,
        user_id: w.team1.texter.id,
        emoji: '👍',
      });
    });

    it('Cannot remove someone elses reaction', async () => {
      const res = await w.team1.super.client
        .from('message_reactions')
        .delete()
        .eq('id', w.reactionId)
        .select();
      expectBlocked(res);
    });
  });
});

// =====================================================================
// STARRED_MESSAGES
// =====================================================================
describe('starred_messages RLS', () => {
  describe('SELECT + INSERT + DELETE (personal only)', () => {
    it('User can star a message and see it', async () => {
      const insertRes = await w.team1.texter.client
        .from('starred_messages')
        .insert({
          user_id: w.team1.texter.id,
          message_id: w.messages.normalMsg,
        })
        .select()
        .single();
      expectSuccess(insertRes);

      const selectRes = await w.team1.texter.client
        .from('starred_messages')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(selectRes, 1);

      // Cleanup
      if (insertRes.data) {
        await w.team1.texter.client
          .from('starred_messages')
          .delete()
          .eq('id', insertRes.data.id);
      }
    });

    it('Other user cannot see stars', async () => {
      await w.adminClient.from('starred_messages').insert({
        user_id: w.team1.texter.id,
        message_id: w.messages.normalMsg,
      });

      const res = await w.team1.super.client
        .from('starred_messages')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('starred_messages')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });

    it('Cannot star as someone else', async () => {
      const res = await w.team1.super.client
        .from('starred_messages')
        .insert({
          user_id: w.team1.texter.id,
          message_id: w.messages.normalMsg,
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Cannot delete someone elses star', async () => {
      const { data: star } = await w.adminClient
        .from('starred_messages')
        .insert({
          user_id: w.team1.texter.id,
          message_id: w.messages.normalMsg,
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('starred_messages')
        .delete()
        .eq('id', star!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('starred_messages').delete().eq('id', star!.id);
    });
  });
});

// =====================================================================
// MESSAGE_READ_RECEIPTS
// =====================================================================
describe('message_read_receipts RLS', () => {
  describe('SELECT', () => {
    it('Chat member can see read receipts', async () => {
      const res = await w.team1.texter.client
        .from('message_read_receipts')
        .select('*')
        .eq('message_id', w.messages.normalMsg);
      expectRows(res, 1);
    });

    it('Non-member cannot see read receipts', async () => {
      const res = await w.team2.texter.client
        .from('message_read_receipts')
        .select('*')
        .eq('message_id', w.messages.normalMsg);
      expectNoRows(res);
    });

    it('Owner oversight: sees read receipts in Texter chats', async () => {
      const res = await w.team1.owner.client
        .from('message_read_receipts')
        .select('*')
        .eq('message_id', w.messages.normalMsg);
      expectRows(res, 1);
    });
  });

  describe('INSERT', () => {
    it('User can mark message as read (own user_id)', async () => {
      const res = await w.team1.texter.client
        .from('message_read_receipts')
        .insert({
          message_id: w.messages.normalMsg,
          user_id: w.team1.texter.id,
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient
          .from('message_read_receipts')
          .delete()
          .eq('id', res.data.id);
      }
    });

    it('Cannot mark as read for someone else', async () => {
      const res = await w.team1.super.client
        .from('message_read_receipts')
        .insert({
          message_id: w.messages.normalMsg,
          user_id: w.team1.texter.id,
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });
});
