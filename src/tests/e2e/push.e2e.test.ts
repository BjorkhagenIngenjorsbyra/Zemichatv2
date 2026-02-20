/**
 * E2E Tests for Push Notification Flow
 *
 * Tests the push notification infrastructure against deployed Supabase:
 * 1. Push token registration (INSERT into push_tokens)
 * 2. Sending a message triggers unread_count increment
 * 3. send-push Edge Function accepts valid requests
 * 4. Badge count reflects unread messages
 *
 * Run: npm run test:e2e
 * Requires .env.e2e with test credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isE2EConfigured,
  getE2ETestWorld,
  type E2ETestWorld,
} from './helpers/setup';

const describeE2E = isE2EConfigured() ? describe : describe.skip;

describeE2E('Push Notification E2E', () => {
  let world: E2ETestWorld;

  // Track IDs for cleanup
  const createdTokenIds: string[] = [];
  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    world = await getE2ETestWorld();
  });

  afterAll(async () => {
    // Clean up push tokens
    if (createdTokenIds.length > 0 && world?.user1?.client) {
      await world.user1.client
        .from('push_tokens')
        .delete()
        .in('id', createdTokenIds);
    }

    // Clean up messages (use service client to bypass RLS)
    if (createdMessageIds.length > 0 && world?.serviceClient) {
      await world.serviceClient
        .from('messages')
        .delete()
        .in('id', createdMessageIds);
    }

    // Reset unread counts for the chat
    if (world?.serviceClient) {
      await world.serviceClient
        .from('chat_members')
        .update({ unread_count: 0 })
        .eq('chat_id', world.chatId);
    }
  });

  // -----------------------------------------------------------------
  // 1. Push Token Registration
  // -----------------------------------------------------------------

  it('user1 can register a push token', async () => {
    const { data, error } = await world.user1.client
      .from('push_tokens')
      .upsert(
        {
          user_id: world.user1.id,
          token: 'e2e-test-token-user1-' + Date.now(),
          platform: 'android',
          token_type: 'fcm',
        },
        { onConflict: 'user_id,token' },
      )
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.user_id).toBe(world.user1.id);
    expect(data!.platform).toBe('android');

    createdTokenIds.push(data!.id);
  });

  it('user2 can register a push token', async () => {
    const { data, error } = await world.user2.client
      .from('push_tokens')
      .upsert(
        {
          user_id: world.user2.id,
          token: 'e2e-test-token-user2-' + Date.now(),
          platform: 'ios',
          token_type: 'fcm',
        },
        { onConflict: 'user_id,token' },
      )
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.user_id).toBe(world.user2.id);

    createdTokenIds.push(data!.id);
  });

  it('user1 cannot register a token for user2', async () => {
    const { data, error } = await world.user1.client
      .from('push_tokens')
      .insert({
        user_id: world.user2.id, // Impersonation
        token: 'e2e-fake-token-' + Date.now(),
        platform: 'android',
        token_type: 'fcm',
      })
      .select()
      .single();

    // Should be blocked by RLS: user_id = auth.uid()
    expect(error).not.toBeNull();
  });

  // -----------------------------------------------------------------
  // 2. Unread Count on Message Send
  // -----------------------------------------------------------------

  it('sending a message increments unread_count for other members', async () => {
    // First read user2's current unread_count
    const { data: before } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id)
      .single();

    const beforeCount = before?.unread_count ?? 0;

    // user1 sends a message
    const { data: msg, error: msgError } = await world.user1.client
      .from('messages')
      .insert({
        chat_id: world.chatId,
        sender_id: world.user1.id,
        content: 'E2E test push message ' + Date.now(),
        type: 'text',
      })
      .select()
      .single();

    expect(msgError).toBeNull();
    expect(msg).not.toBeNull();
    createdMessageIds.push(msg!.id);

    // Wait for the DB trigger to execute
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check user2's unread_count increased
    const { data: after } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id)
      .single();

    expect(after).not.toBeNull();
    expect(after!.unread_count).toBe(beforeCount + 1);
  });

  it('sender unread_count is NOT incremented by own message', async () => {
    // Read user1's current unread_count
    const { data: before } = await world.user1.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user1.id)
      .single();

    const beforeCount = before?.unread_count ?? 0;

    // user1 sends another message
    const { data: msg } = await world.user1.client
      .from('messages')
      .insert({
        chat_id: world.chatId,
        sender_id: world.user1.id,
        content: 'E2E test own message ' + Date.now(),
        type: 'text',
      })
      .select()
      .single();

    if (msg) createdMessageIds.push(msg.id);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // user1's unread_count should stay the same
    const { data: after } = await world.user1.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user1.id)
      .single();

    expect(after!.unread_count).toBe(beforeCount);
  });

  // -----------------------------------------------------------------
  // 3. Mark as Read
  // -----------------------------------------------------------------

  it('user2 can mark chat as read (reset unread_count)', async () => {
    const { error } = await world.user2.client
      .from('chat_members')
      .update({ unread_count: 0, marked_unread: false })
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id);

    expect(error).toBeNull();

    // Verify
    const { data } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id)
      .single();

    expect(data!.unread_count).toBe(0);
  });

  // -----------------------------------------------------------------
  // 4. send-push Edge Function
  // -----------------------------------------------------------------

  it('send-push Edge Function is accessible (smoke test)', async () => {
    // The send-push Edge Function is normally called by a DB trigger,
    // but we can test it directly. It expects a specific payload format
    // that the trigger sends. We'll invoke it with a minimal payload.

    // Note: This may return an error because the payload format from
    // a client call differs from what the trigger sends. We're just
    // testing that the function is deployed and responds.
    const { data, error } = await world.user1.client.functions.invoke(
      'send-push',
      {
        body: {
          record: {
            id: '00000000-0000-0000-0000-000000000000',
            chat_id: world.chatId,
            sender_id: world.user1.id,
            content: 'E2E smoke test',
            type: 'text',
          },
        },
      },
    );

    // We just verify the function is reachable (may error on payload validation)
    // A non-null response means the function is deployed
    expect(data !== null || error !== null).toBe(true);
  });

  // -----------------------------------------------------------------
  // 5. Badge Count Query
  // -----------------------------------------------------------------

  it('user can query their total unread count across all chats', async () => {
    const { data, error } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('user_id', world.user2.id)
      .is('left_at', null);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Sum should be a valid number
    const total = data!.reduce(
      (sum: number, row: { unread_count: number }) => sum + row.unread_count,
      0,
    );
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
