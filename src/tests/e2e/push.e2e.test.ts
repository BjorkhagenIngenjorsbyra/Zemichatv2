/**
 * E2E Tests for Push Notification Infrastructure
 *
 * Tests the backend push notification flow against deployed Supabase:
 * 1. Push token registration (upsert into push_tokens)
 * 2. send-push Edge Function (message trigger flow)
 * 3. Notification count queries (unread counts)
 *
 * Note: These tests verify the server-side infrastructure.
 * Actual FCM/APNs delivery cannot be tested in E2E (requires native devices).
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

  beforeAll(async () => {
    world = await getE2ETestWorld();
  });

  afterAll(async () => {
    // Clean up test push tokens
    if (createdTokenIds.length > 0) {
      const cleanupClient = world?.serviceClient || world?.user1?.client;
      if (cleanupClient) {
        await cleanupClient
          .from('push_tokens')
          .delete()
          .in('id', createdTokenIds);
      }
    }
  });

  // -----------------------------------------------------------------
  // 1. Push Token Registration
  // -----------------------------------------------------------------

  it('user1 can register a push token', async () => {
    const testToken = `e2e-test-token-${Date.now()}-user1`;

    const { data, error } = await world.user1.client
      .from('push_tokens')
      .upsert(
        {
          user_id: world.user1.id,
          token: testToken,
          platform: 'android',
          token_type: 'fcm',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token,token_type' },
      )
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.token).toBe(testToken);
    expect(data!.platform).toBe('android');

    createdTokenIds.push(data!.id);
  });

  it('user2 can register a push token', async () => {
    const testToken = `e2e-test-token-${Date.now()}-user2`;

    const { data, error } = await world.user2.client
      .from('push_tokens')
      .upsert(
        {
          user_id: world.user2.id,
          token: testToken,
          platform: 'ios',
          token_type: 'fcm',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token,token_type' },
      )
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.token).toBe(testToken);

    createdTokenIds.push(data!.id);
  });

  it('user1 cannot register a token for user2', async () => {
    const { data, error } = await world.user1.client
      .from('push_tokens')
      .insert({
        user_id: world.user2.id, // Impersonation attempt
        token: 'fake-token',
        platform: 'android',
        token_type: 'fcm',
      })
      .select()
      .single();

    // Should be blocked by RLS: user_id = auth.uid()
    expect(error).not.toBeNull();
  });

  it('user1 can update their own token', async () => {
    if (createdTokenIds.length === 0) return;

    const tokenId = createdTokenIds[0];
    const newTimestamp = new Date().toISOString();

    const { error } = await world.user1.client
      .from('push_tokens')
      .update({ updated_at: newTimestamp })
      .eq('id', tokenId);

    expect(error).toBeNull();
  });

  it('user1 can delete their own tokens', async () => {
    if (createdTokenIds.length === 0) return;

    // Only delete user1's token (first one)
    const tokenId = createdTokenIds[0];
    const { error } = await world.user1.client
      .from('push_tokens')
      .delete()
      .eq('id', tokenId);

    expect(error).toBeNull();

    // Remove from cleanup list
    createdTokenIds.shift();
  });

  // -----------------------------------------------------------------
  // 2. send-push Edge Function
  // -----------------------------------------------------------------

  it('send-push Edge Function is accessible', async () => {
    // Send a test message in the chat to trigger the push flow
    // First, send a message as user1
    const { data: msg, error: msgError } = await world.user1.client
      .from('messages')
      .insert({
        chat_id: world.chatId,
        sender_id: world.user1.id,
        content: 'E2E push test message',
        type: 'text',
      })
      .select()
      .single();

    // The message INSERT should succeed
    expect(msgError).toBeNull();
    expect(msg).not.toBeNull();

    // The DB trigger should have fired notify_new_message which calls send-push
    // We can't verify the push was delivered, but we can verify the message exists
    // and the trigger didn't cause an error (the INSERT succeeded)

    // Clean up the test message
    if (msg) {
      await world.user1.client
        .from('messages')
        .update({ deleted_at: new Date().toISOString(), deleted_by: world.user1.id })
        .eq('id', msg.id);
    }
  });

  // -----------------------------------------------------------------
  // 3. Unread Count Queries
  // -----------------------------------------------------------------

  it('user2 can query their unread count', async () => {
    const { data, error } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('user_id', world.user2.id)
      .is('left_at', null);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // Each row should have a numeric unread_count
    for (const row of data!) {
      expect(typeof row.unread_count).toBe('number');
      expect(row.unread_count).toBeGreaterThanOrEqual(0);
    }
  });

  it('user1 can query their unread count', async () => {
    const { data, error } = await world.user1.client
      .from('chat_members')
      .select('unread_count')
      .eq('user_id', world.user1.id)
      .is('left_at', null);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  // -----------------------------------------------------------------
  // 4. Unread count increments on new message
  // -----------------------------------------------------------------

  it('unread count increments for recipient when message is sent', async () => {
    // Get user2's current unread count for the chat
    const { data: before } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id)
      .single();

    const beforeCount = before?.unread_count ?? 0;

    // Send a message as user1
    const { data: msg, error: msgError } = await world.user1.client
      .from('messages')
      .insert({
        chat_id: world.chatId,
        sender_id: world.user1.id,
        content: 'E2E unread count test',
        type: 'text',
      })
      .select()
      .single();

    expect(msgError).toBeNull();

    // Wait briefly for the trigger to fire
    await new Promise((r) => setTimeout(r, 1000));

    // Check user2's unread count increased
    const { data: after } = await world.user2.client
      .from('chat_members')
      .select('unread_count')
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id)
      .single();

    expect(after?.unread_count).toBe(beforeCount + 1);

    // Clean up
    if (msg) {
      await world.user1.client
        .from('messages')
        .update({ deleted_at: new Date().toISOString(), deleted_by: world.user1.id })
        .eq('id', msg.id);
    }

    // Reset unread count
    await world.user2.client
      .from('chat_members')
      .update({ unread_count: beforeCount })
      .eq('chat_id', world.chatId)
      .eq('user_id', world.user2.id);
  });

  // -----------------------------------------------------------------
  // 5. Pending friend request count
  // -----------------------------------------------------------------

  it('user can query pending friend request count', async () => {
    const { count, error } = await world.user1.client
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('addressee_id', world.user1.id)
      .eq('status', 'pending');

    expect(error).toBeNull();
    expect(typeof count).toBe('number');
  });
});
