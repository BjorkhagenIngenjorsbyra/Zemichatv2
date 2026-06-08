/**
 * Simulation: a group chat with MIXED roles (Owner + Super + Texter).
 *
 * Verifies cross-role behaviour in a group: everyone can send, everyone sees
 * each other's messages, emoji reactions propagate, and the transparency model
 * still holds (a Texter's "deleted for everyone" message stays visible to the
 * Owner). Acts through real RLS via the sim agents.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getSimWorld, type SimWorld } from './agent';

let sim: SimWorld;
const GROUP_ID = 'cccc0099-0000-0000-0000-000000000099';

beforeAll(async () => {
  sim = await getSimWorld();
  const admin = sim.world.adminClient;

  // Set up a mixed-role group in team1: owner + super + texter.
  await admin.from('chats').delete().eq('id', GROUP_ID);
  await admin.from('chats').insert({
    id: GROUP_ID,
    name: 'Familjegrupp',
    is_group: true,
    created_by: sim.team1.owner.id,
  } as never);
  await admin.from('chat_members').insert([
    { chat_id: GROUP_ID, user_id: sim.team1.owner.id },
    { chat_id: GROUP_ID, user_id: sim.team1.super.id },
    { chat_id: GROUP_ID, user_id: sim.team1.texter.id },
  ] as never);
});

describe('mixed-role group chat', () => {
  it('every role can send and everyone sees every message', async () => {
    await sim.team1.texter.sendMessage(GROUP_ID, 'grupp: hej från texter');
    await sim.team1.super.sendMessage(GROUP_ID, 'grupp: hej från super');
    await sim.team1.owner.sendMessage(GROUP_ID, 'grupp: hej från owner');

    for (const agent of [sim.team1.owner, sim.team1.super, sim.team1.texter]) {
      const view = await agent.waitForMessages(GROUP_ID, (m) => m.length >= 3);
      const contents = view.map((m) => m.content);
      expect(contents).toContain('grupp: hej från texter');
      expect(contents).toContain('grupp: hej från super');
      expect(contents).toContain('grupp: hej från owner');
    }
  });

  it('an emoji reaction by one member is visible to the others', async () => {
    const sent = await sim.team1.texter.sendMessage(GROUP_ID, 'grupp: reagera på detta');
    const msgId = sent.data!.id;

    const react = await sim.team1.super.client
      .from('message_reactions')
      .insert({ message_id: msgId, user_id: sim.team1.super.id, emoji: '👍' } as never)
      .select()
      .single();
    expect(react.error).toBeNull();

    // Owner (full visibility) sees the reaction row.
    const seenByOwner = await sim.team1.owner.client
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', msgId);
    expect((seenByOwner.data ?? []).some((r: { emoji: string }) => r.emoji === '👍')).toBe(true);
  });

  it('transparency holds in groups: texter delete stays visible to owner', async () => {
    const sent = await sim.team1.texter.sendMessage(GROUP_ID, 'grupp: hemlis');
    const msgId = sent.data!.id;
    await sim.team1.texter.deleteMessage(msgId);

    // Owner still sees it (transparency); the row is not gone.
    expect(await sim.team1.owner.canSee(msgId)).toBe(true);
  });
});
