import { describe, it, beforeAll, expect } from 'vitest';
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

describe('messages RLS — CRITICAL', () => {
  // ------------------------------------------------------------------
  // SELECT (member)
  // ------------------------------------------------------------------
  describe('SELECT member', () => {
    it('Chat member sees non-deleted messages', async () => {
      const res = await w.team1.texter.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.superToTexter)
        .is('deleted_at', null);
      // normalMsg + editedMsg (deletedMsg has deleted_at set)
      expectRows(res, 2);
    });

    it('Chat member CANNOT see soft-deleted messages from others', async () => {
      const res = await w.team1.super.client
        .from('messages')
        .select('*')
        .eq('id', w.messages.deletedMsg);
      expectNoRows(res);
    });

    it('Sender CAN see own soft-deleted messages', async () => {
      // texter1 is the sender of deletedMsg — messages_select_sender allows this
      const res = await w.team1.texter.client
        .from('messages')
        .select('*')
        .eq('id', w.messages.deletedMsg);
      expectRows(res, 1);
    });

    it('Non-member cannot see any messages', async () => {
      const res = await w.team2.texter.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectNoRows(res);
    });
  });

  // ------------------------------------------------------------------
  // SELECT (owner oversight) — CORE TRANSPARENCY
  // ------------------------------------------------------------------
  describe('SELECT owner oversight', () => {
    it('Owner sees ALL messages including soft-deleted in Texter chat', async () => {
      const res = await w.team1.owner.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      // normalMsg + editedMsg + deletedMsg = 3
      expectRows(res, 3);
    });

    it('Owner sees soft-deleted message content', async () => {
      const res = await w.team1.owner.client
        .from('messages')
        .select('*')
        .eq('id', w.messages.deletedMsg)
        .single();
      expectSuccess(res);
      expect(res.data!.content).toBe('Deleted msg');
      expect(res.data!.deleted_at).not.toBeNull();
    });

    it('Owner CANNOT see messages in Super↔Super chat', async () => {
      const res = await w.team1.owner.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.superToSuper);
      expectNoRows(res);
    });

    it('Owner2 CANNOT see team1 internal Super↔Texter messages', async () => {
      const res = await w.team2.owner.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectNoRows(res);
    });

    it('Cross-team: Owner1 sees Texter1↔Texter2 messages', async () => {
      const res = await w.team1.owner.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.texterToTexter);
      expectRows(res, 1);
    });

    it('Cross-team: Owner2 sees Texter1↔Texter2 messages', async () => {
      const res = await w.team2.owner.client
        .from('messages')
        .select('*')
        .eq('chat_id', w.chats.texterToTexter);
      expectRows(res, 1);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Active chat member can send message', async () => {
      const res = await w.team1.texter.client
        .from('messages')
        .insert({
          chat_id: w.chats.superToTexter,
          sender_id: w.team1.texter.id,
          content: 'Test message',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('messages').delete().eq('id', res.data.id);
      }
    });

    it('Cannot send message as someone else (sender_id != self)', async () => {
      const res = await w.team1.texter.client
        .from('messages')
        .insert({
          chat_id: w.chats.superToTexter,
          sender_id: w.team1.super.id, // impersonation
          content: 'Spoofed',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Non-member cannot send message', async () => {
      const res = await w.team2.texter.client
        .from('messages')
        .insert({
          chat_id: w.chats.superToTexter,
          sender_id: w.team2.texter.id,
          content: 'Intruder',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Deactivated user cannot send message', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.texter.id}';`);
      try {
        const res = await w.team1.texter.client
          .from('messages')
          .insert({
            chat_id: w.chats.superToTexter,
            sender_id: w.team1.texter.id,
            content: 'Should fail',
          })
          .select()
          .single();
        expectRLSError(res);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${w.team1.texter.id}';`);
      }
    });
  });

  // ------------------------------------------------------------------
  // UPDATE (edit)
  // ------------------------------------------------------------------
  describe('UPDATE edit', () => {
    it('Sender can edit own message content', async () => {
      const res = await w.team1.texter.client
        .from('messages')
        .update({ content: 'Updated content' })
        .eq('id', w.messages.normalMsg)
        .select();
      expectRows(res, 1);
      // Restore
      execSQL(`
        UPDATE public.messages SET content = 'Hello from texter', is_edited = false, edited_at = NULL
        WHERE id = '${IDS.msgNormal}';
        DELETE FROM public.message_edits WHERE message_id = '${IDS.msgNormal}'
          AND old_content != 'Original content before edit';
      `);
    });

    it('Other member cannot edit message', async () => {
      // super1 trying to edit texter1's message
      const res = await w.team1.super.client
        .from('messages')
        .update({ content: 'Hacked' })
        .eq('id', w.messages.normalMsg)
        .select();
      expectBlocked(res);
    });

    it('Cannot edit soft-deleted message', async () => {
      const res = await w.team1.texter.client
        .from('messages')
        .update({ content: 'Revive' })
        .eq('id', w.messages.deletedMsg)
        .select();
      expectBlocked(res);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE (soft-delete)
  // ------------------------------------------------------------------
  describe('UPDATE soft-delete', () => {
    it('Sender can soft-delete own message', async () => {
      // Create a message to delete
      const insertRes = await w.team1.texter.client
        .from('messages')
        .insert({
          chat_id: w.chats.superToTexter,
          sender_id: w.team1.texter.id,
          content: 'To be deleted',
        })
        .select()
        .single();
      expectSuccess(insertRes);

      // Soft-delete — sender can see own soft-deleted messages via messages_select_sender
      const res = await w.team1.texter.client
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: w.team1.texter.id,
        })
        .eq('id', insertRes.data!.id)
        .select();
      expectRows(res, 1);
      expect(res.data![0].deleted_at).not.toBeNull();

      // Cleanup
      await w.adminClient.from('messages').delete().eq('id', insertRes.data!.id);
    });

    it('Cannot soft-delete with someone else as deleted_by', async () => {
      const insertRes = await w.team1.texter.client
        .from('messages')
        .insert({
          chat_id: w.chats.superToTexter,
          sender_id: w.team1.texter.id,
          content: 'Another msg',
        })
        .select()
        .single();
      expectSuccess(insertRes);

      const res = await w.team1.texter.client
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: w.team1.super.id, // wrong deleted_by
        })
        .eq('id', insertRes.data!.id);
      expectBlocked(res);

      await w.adminClient.from('messages').delete().eq('id', insertRes.data!.id);
    });

    it('Other member cannot soft-delete message they did not send', async () => {
      const res = await w.team1.super.client
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: w.team1.super.id,
        })
        .eq('id', w.messages.normalMsg)
        .select();
      expectBlocked(res);
    });
  });

  // ------------------------------------------------------------------
  // MESSAGE_EDITS (sub-table)
  // ------------------------------------------------------------------
  describe('message_edits', () => {
    it('Sender can see edit history of own message', async () => {
      const res = await w.team1.texter.client
        .from('message_edits')
        .select('*')
        .eq('message_id', w.messages.editedMsg);
      expectRows(res, 1);
    });

    it('Other member cannot see edit history', async () => {
      // super1 is in the chat but didn't send the message
      const res = await w.team1.super.client
        .from('message_edits')
        .select('*')
        .eq('message_id', w.messages.editedMsg);
      expectNoRows(res);
    });

    it('Owner oversight: Owner sees Texter message edit history', async () => {
      const res = await w.team1.owner.client
        .from('message_edits')
        .select('*')
        .eq('message_id', w.messages.editedMsg);
      expectRows(res, 1);
    });

    it('Owner CANNOT see edit history of Super↔Super chat messages', async () => {
      // First we need to create an edit for the super chat message
      execSQL(`
        INSERT INTO public.message_edits (message_id, old_content)
        VALUES ('${IDS.msgInSuperChat}', 'Old super content');
      `);

      const res = await w.team1.owner.client
        .from('message_edits')
        .select('*')
        .eq('message_id', w.messages.inSuperChat);
      expectNoRows(res);

      // Cleanup
      execSQL(`
        DELETE FROM public.message_edits
        WHERE message_id = '${IDS.msgInSuperChat}' AND old_content = 'Old super content';
      `);
    });
  });
});
