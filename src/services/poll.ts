import { supabase } from './supabase';
import { type Poll, type PollOption, type PollVote, type PollWithOptions } from '../types/database';

export interface CreatePollData {
  chatId: string;
  messageId?: string;
  question: string;
  options: string[];
  allowsMultiple?: boolean;
  isAnonymous?: boolean;
}

/**
 * Create a poll with options.
 */
export async function createPoll(data: CreatePollData): Promise<{ poll: Poll | null; error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { poll: null, error: new Error('Not authenticated') };
  }

  const { data: pollData, error: pollError } = await supabase
    .from('polls')
    .insert({
      chat_id: data.chatId,
      message_id: data.messageId || null,
      creator_id: user.id,
      question: data.question,
      allows_multiple: data.allowsMultiple || false,
      is_anonymous: data.isAnonymous || false,
    } as never)
    .select()
    .single();

  if (pollError) {
    return { poll: null, error: new Error(pollError.message) };
  }

  const poll = pollData as unknown as Poll;

  // Insert options
  const optionInserts = data.options.map((text, i) => ({
    poll_id: poll.id,
    text,
    sort_order: i,
  }));

  const { error: optionsError } = await supabase
    .from('poll_options')
    .insert(optionInserts as never);

  if (optionsError) {
    return { poll: null, error: new Error(optionsError.message) };
  }

  return { poll, error: null };
}

/**
 * Get a poll with its options and votes.
 */
export async function getPoll(pollId: string): Promise<{ poll: PollWithOptions | null; error: Error | null }> {
  const { data: pollData, error: pollError } = await supabase
    .from('polls')
    .select('*')
    .eq('id', pollId)
    .single();

  if (pollError) {
    return { poll: null, error: new Error(pollError.message) };
  }

  const poll = pollData as unknown as Poll;

  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('*')
    .eq('poll_id', pollId)
    .order('sort_order');

  const options = (optionsData || []) as unknown as PollOption[];

  const { data: votesData } = await supabase
    .from('poll_votes')
    .select('*')
    .eq('poll_id', pollId);

  const votes = (votesData || []) as unknown as PollVote[];

  const optionsWithVotes = options.map((opt) => ({
    ...opt,
    votes: votes.filter((v) => v.option_id === opt.id),
  }));

  return {
    poll: {
      ...poll,
      options: optionsWithVotes,
      totalVotes: votes.length,
    },
    error: null,
  };
}

/**
 * Get a poll by its message ID.
 */
export async function getPollByMessageId(messageId: string): Promise<{ poll: PollWithOptions | null; error: Error | null }> {
  const { data: pollData, error: pollError } = await supabase
    .from('polls')
    .select('*')
    .eq('message_id', messageId)
    .single();

  if (pollError) {
    return { poll: null, error: null }; // Not found is not an error
  }

  return getPoll((pollData as unknown as Poll).id);
}

/**
 * Vote on a poll option.
 */
export async function votePoll(pollId: string, optionId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('poll_votes')
    .insert({
      poll_id: pollId,
      option_id: optionId,
      user_id: user.id,
    } as never);

  if (error) {
    // Handle duplicate vote (unique constraint)
    if (error.code === '23505') {
      return { error: null };
    }
    return { error: new Error(error.message) };
  }

  return { error: null };
}

/**
 * Remove a vote from a poll option.
 */
export async function unvotePoll(pollId: string, optionId: string): Promise<{ error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('option_id', optionId)
    .eq('user_id', user.id);

  if (error) {
    return { error: new Error(error.message) };
  }

  return { error: null };
}
