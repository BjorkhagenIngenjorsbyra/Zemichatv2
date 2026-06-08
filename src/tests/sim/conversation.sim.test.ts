/**
 * Simulation scenario: a real conversation between roles, exercising the
 * transparency model dynamically (not just static RLS fixtures).
 *
 * Uses the seeded Super↔Texter chat in team1; Owner-1 oversees team1.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { getSimWorld, type SimWorld } from './agent';

let sim: SimWorld;

beforeAll(async () => {
  sim = await getSimWorld();
});

describe('Conversation flow + transparency', () => {
  it('Texter and Super exchange messages; the Super sees the thread in order', async () => {
    const chat = sim.world.chats.superToTexter;

    const m1 = await sim.team1.texter.sendMessage(chat, 'sim: hej från texter');
    expect(m1.error).toBeNull();
    const m2 = await sim.team1.super.sendMessage(chat, 'sim: svar från super');
    expect(m2.error).toBeNull();

    const superView = await sim.team1.super.waitForMessages(
      chat,
      (msgs) =>
        msgs.some((m) => m.content === 'sim: hej från texter') &&
        msgs.some((m) => m.content === 'sim: svar från super'),
    );
    const simContents = superView
      .filter((m) => m.content?.startsWith('sim:'))
      .map((m) => m.content);
    expect(simContents).toEqual(['sim: hej från texter', 'sim: svar från super']);
  });

  it('Owner sees the Texter conversation (oversight)', async () => {
    const chat = sim.world.chats.superToTexter;
    const ownerView = await sim.team1.owner.waitForMessages(chat, (msgs) =>
      msgs.some((m) => m.content === 'sim: hej från texter'),
    );
    expect(ownerView.some((m) => m.content === 'sim: hej från texter')).toBe(true);
    expect(ownerView.some((m) => m.content === 'sim: svar från super')).toBe(true);
  });

  it('Deleted message disappears for the Super but stays visible to the Owner', async () => {
    const chat = sim.world.chats.superToTexter;

    const sent = await sim.team1.texter.sendMessage(chat, 'sim: raderas snart');
    expect(sent.error).toBeNull();
    const msgId = sent.data!.id;

    const del = await sim.team1.texter.deleteMessage(msgId);
    expect(del.error).toBeNull();

    // Super can no longer see the deleted message
    const superView = await sim.team1.super.waitForMessages(
      chat,
      (msgs) => !msgs.some((m) => m.id === msgId),
    );
    expect(superView.some((m) => m.id === msgId)).toBe(false);

    // Owner STILL sees it — core transparency guarantee
    expect(await sim.team1.owner.canSee(msgId)).toBe(true);
  });

  it('A cross-team member (other Owner) cannot see this conversation', async () => {
    const chat = sim.world.chats.superToTexter;
    const outsiderView = await sim.team2.owner.visibleMessages(chat);
    expect(outsiderView.length).toBe(0);
  });
});
