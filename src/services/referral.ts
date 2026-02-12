import { supabase } from './supabase';
import { type ReferralStats } from '../types/database';

/**
 * Validate a referral code (check if it exists and return team name).
 */
export async function validateReferralCode(
  code: string
): Promise<{ valid: boolean; teamName: string | null; error: Error | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('validate_referral_code', {
      code,
    });

    if (error) {
      return { valid: false, teamName: null, error: new Error(error.message) };
    }

    const result = data as { valid: boolean; team_name: string | null };
    return { valid: result.valid, teamName: result.team_name, error: null };
  } catch (err) {
    return {
      valid: false,
      teamName: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Submit a referral after team creation.
 */
export async function submitReferral(
  code: string
): Promise<{ error: Error | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('submit_referral', {
      code,
    });

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

/**
 * Claim pending referral rewards (grants free Plus Ringa months).
 */
export async function claimReferralRewards(): Promise<{
  claimedCount: number;
  error: Error | null;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('claim_referral_rewards');

    if (error) {
      return { claimedCount: 0, error: new Error(error.message) };
    }

    const result = data as { claimed_count: number };
    return { claimedCount: result.claimed_count, error: null };
  } catch (err) {
    return {
      claimedCount: 0,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get referral stats for the current owner.
 */
export async function getReferralStats(): Promise<{
  stats: ReferralStats | null;
  error: Error | null;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_referral_stats');

    if (error) {
      return { stats: null, error: new Error(error.message) };
    }

    return { stats: data as ReferralStats, error: null };
  } catch (err) {
    return {
      stats: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
