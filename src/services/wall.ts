import { supabase } from './supabase';
import { type WallPost, type WallComment, type WallReaction, type User } from '../types/database';
import { type MediaMetadata } from './storage';

// ============================================================
// Types
// ============================================================

export interface WallPostWithAuthor extends WallPost {
  author: User;
}

export interface WallCommentWithAuthor extends WallComment {
  author: User;
}

export interface WallGroupedReaction {
  emoji: string;
  count: number;
  users: User[];
  hasReacted: boolean;
}

// ============================================================
// Posts
// ============================================================

/**
 * Get wall posts for a team, paginated newest-first.
 */
export async function getWallPosts(
  teamId: string,
  limit = 20,
  before?: string
): Promise<{ posts: WallPostWithAuthor[]; error: Error | null }> {
  try {
    let query = supabase
      .from('wall_posts')
      .select('*, author:users!author_id(*)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      return { posts: [], error: new Error(error.message) };
    }

    return { posts: (data || []) as unknown as WallPostWithAuthor[], error: null };
  } catch (err) {
    return {
      posts: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Create a new wall post.
 */
export async function createWallPost(params: {
  content?: string;
  mediaUrl?: string;
  mediaMetadata?: MediaMetadata;
}): Promise<{ post: WallPost | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { post: null, error: new Error('Not authenticated') };
    }

    // Get user's team_id
    const { data: profile } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { post: null, error: new Error('User profile not found') };
    }

    const teamId = (profile as unknown as { team_id: string }).team_id;

    const { data, error } = await supabase
      .from('wall_posts')
      .insert({
        team_id: teamId,
        author_id: user.id,
        content: params.content || null,
        media_url: params.mediaUrl || null,
        media_metadata: (params.mediaMetadata as unknown as Record<string, unknown>) || null,
      } as never)
      .select()
      .single();

    if (error) {
      return { post: null, error: new Error(error.message) };
    }

    return { post: data as unknown as WallPost, error: null };
  } catch (err) {
    return {
      post: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Soft-delete a wall post.
 */
export async function deleteWallPost(
  postId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('wall_posts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      } as never)
      .eq('id', postId);

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

// ============================================================
// Comments
// ============================================================

/**
 * Get all comments for a post.
 */
export async function getPostComments(
  postId: string
): Promise<{ comments: WallCommentWithAuthor[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('wall_comments')
      .select('*, author:users!author_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return { comments: [], error: new Error(error.message) };
    }

    return { comments: (data || []) as unknown as WallCommentWithAuthor[], error: null };
  } catch (err) {
    return {
      comments: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Add a comment to a post.
 */
export async function addComment(
  postId: string,
  content: string,
  parentCommentId?: string
): Promise<{ comment: WallComment | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { comment: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('wall_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content,
        parent_comment_id: parentCommentId || null,
      } as never)
      .select()
      .single();

    if (error) {
      return { comment: null, error: new Error(error.message) };
    }

    return { comment: data as unknown as WallComment, error: null };
  } catch (err) {
    return {
      comment: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Soft-delete a comment.
 */
export async function deleteComment(
  commentId: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('wall_comments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      } as never)
      .eq('id', commentId);

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

// ============================================================
// Reactions
// ============================================================

/**
 * Toggle a reaction on a wall post (add if not present, remove if present).
 */
export async function toggleWallReaction(
  postId: string,
  emoji: string
): Promise<{ added: boolean; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { added: false, error: new Error('Not authenticated') };
    }

    // Check if reaction exists
    const { data: existing } = await supabase
      .from('wall_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      // Remove
      const { error } = await supabase
        .from('wall_reactions')
        .delete()
        .eq('id', (existing as unknown as { id: string }).id);

      if (error) {
        return { added: false, error: new Error(error.message) };
      }
      return { added: false, error: null };
    } else {
      // Add
      const { error } = await supabase
        .from('wall_reactions')
        .insert({
          post_id: postId,
          user_id: user.id,
          emoji,
        } as never);

      if (error) {
        if (error.code === '23505') {
          return { added: false, error: new Error('Already reacted') };
        }
        return { added: true, error: new Error(error.message) };
      }
      return { added: true, error: null };
    }
  } catch (err) {
    return {
      added: false,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get reactions for multiple posts at once, grouped by emoji.
 */
export async function getWallReactions(
  postIds: string[]
): Promise<{ reactionsByPost: Map<string, WallGroupedReaction[]>; error: Error | null }> {
  try {
    if (postIds.length === 0) {
      return { reactionsByPost: new Map(), error: null };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('wall_reactions')
      .select('*, user:users(*)')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    if (error) {
      return { reactionsByPost: new Map(), error: new Error(error.message) };
    }

    const typedData = (data || []) as unknown as (WallReaction & { user: User })[];

    const reactionsByPost = new Map<string, WallGroupedReaction[]>();

    for (const reaction of typedData) {
      let postReactions = reactionsByPost.get(reaction.post_id);
      if (!postReactions) {
        postReactions = [];
        reactionsByPost.set(reaction.post_id, postReactions);
      }

      const existingEmoji = postReactions.find((r) => r.emoji === reaction.emoji);
      if (existingEmoji) {
        existingEmoji.count += 1;
        existingEmoji.users.push(reaction.user);
        if (user && reaction.user_id === user.id) {
          existingEmoji.hasReacted = true;
        }
      } else {
        postReactions.push({
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.user],
          hasReacted: user ? reaction.user_id === user.id : false,
        });
      }
    }

    return { reactionsByPost, error: null };
  } catch (err) {
    return {
      reactionsByPost: new Map(),
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// Storage
// ============================================================

const BUCKET_NAME = 'chat-media';

/**
 * Upload an image for a wall post.
 * Path: {userId}/wall/{timestamp}_{filename}
 */
export async function uploadWallImage(
  file: File
): Promise<{ url: string; metadata: MediaMetadata; error: null } | { url: null; metadata: null; error: Error }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { url: null, metadata: null, error: new Error('Not authenticated') };
    }

    if (!file.type.startsWith('image/')) {
      return { url: null, metadata: null, error: new Error('File must be an image') };
    }

    // Get image dimensions
    let width = 0;
    let height = 0;
    try {
      const dims = await getImageDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch {
      // Continue without dimensions
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/wall/${timestamp}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      return { url: null, metadata: null, error: new Error(uploadError.message) };
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const metadata: MediaMetadata = {
      width,
      height,
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    };

    return { url: urlData.publicUrl, metadata, error: null };
  } catch (err) {
    return {
      url: null,
      metadata: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get image dimensions from a File.
 */
function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
