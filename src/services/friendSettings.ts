import { supabase } from './supabase';
import { type FriendSettings } from '../types/database';

/**
 * Get all friend settings for the current user.
 * Returns a Map keyed by friend_user_id for easy lookup.
 */
export async function getAllFriendSettings(): Promise<{
  settings: Map<string, FriendSettings>;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { settings: new Map(), error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('friend_settings')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      return { settings: new Map(), error: new Error(error.message) };
    }

    const typedData = (data || []) as unknown as FriendSettings[];
    const settings = new Map<string, FriendSettings>(
      typedData.map((s) => [s.friend_user_id, s])
    );

    return { settings, error: null };
  } catch (err) {
    return {
      settings: new Map(),
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Upsert friend settings (nickname, categories) for a specific friend.
 */
export async function upsertFriendSettings(
  friendUserId: string,
  updates: { nickname?: string; categories?: string[]; show_real_name?: boolean }
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('friend_settings')
      .upsert(
        {
          user_id: user.id,
          friend_user_id: friendUserId,
          nickname: updates.nickname ?? '',
          categories: updates.categories ?? [],
          show_real_name: updates.show_real_name ?? false,
        } as never,
        { onConflict: 'user_id,friend_user_id' }
      );

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
