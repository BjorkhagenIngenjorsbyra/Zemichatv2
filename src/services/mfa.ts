import { supabase } from './supabase';

// ============================================================
// Types
// ============================================================

export interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: 'totp';
  status: 'unverified' | 'verified';
  created_at: string;
  updated_at: string;
}

export interface MFAChallenge {
  id: string;
  expires_at: number;
}

export interface EnrollResult {
  factorId: string;
  qrCode: string;
  secret: string;
  error: Error | null;
}

// ============================================================
// MFA Status
// ============================================================

/**
 * Check if the current user has MFA enabled.
 */
export async function isMFAEnabled(): Promise<{
  enabled: boolean;
  factors: MFAFactor[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      return { enabled: false, factors: [], error: new Error(error.message) };
    }

    const factors = (data?.totp || []) as MFAFactor[];
    const verifiedFactors = factors.filter((f) => f.status === 'verified');

    return {
      enabled: verifiedFactors.length > 0,
      factors: verifiedFactors,
      error: null,
    };
  } catch (err) {
    return {
      enabled: false,
      factors: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get the current MFA assurance level.
 */
export async function getMFAAssuranceLevel(): Promise<{
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      return { currentLevel: null, nextLevel: null, error: new Error(error.message) };
    }

    return {
      currentLevel: data?.currentLevel || null,
      nextLevel: data?.nextLevel || null,
      error: null,
    };
  } catch (err) {
    return {
      currentLevel: null,
      nextLevel: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

// ============================================================
// MFA Enrollment
// ============================================================

/**
 * Start MFA enrollment - generates QR code and secret.
 */
export async function enrollMFA(friendlyName?: string): Promise<EnrollResult> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: friendlyName || 'Zemichat Authenticator',
    });

    if (error) {
      return { factorId: '', qrCode: '', secret: '', error: new Error(error.message) };
    }

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      error: null,
    };
  } catch (err) {
    return {
      factorId: '',
      qrCode: '',
      secret: '',
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Verify the MFA enrollment with a TOTP code.
 */
export async function verifyMFAEnrollment(
  factorId: string,
  code: string
): Promise<{ error: Error | null }> {
  try {
    // First create a challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      return { error: new Error(challengeError.message) };
    }

    // Then verify the challenge with the code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      return { error: new Error(verifyError.message) };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Cancel MFA enrollment if user decides not to proceed.
 */
export async function cancelMFAEnrollment(
  factorId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });

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
// MFA Verification (on login)
// ============================================================

/**
 * Create an MFA challenge for verification.
 */
export async function createMFAChallenge(
  factorId: string
): Promise<{ challenge: MFAChallenge | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });

    if (error) {
      return { challenge: null, error: new Error(error.message) };
    }

    return {
      challenge: {
        id: data.id,
        expires_at: data.expires_at,
      },
      error: null,
    };
  } catch (err) {
    return {
      challenge: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Verify an MFA challenge with a TOTP code.
 */
export async function verifyMFAChallenge(
  factorId: string,
  challengeId: string,
  code: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
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

// ============================================================
// MFA Management
// ============================================================

/**
 * Disable MFA by unenrolling all factors.
 */
export async function disableMFA(): Promise<{ error: Error | null }> {
  try {
    const { factors, error: listError } = await isMFAEnabled();

    if (listError) {
      return { error: listError };
    }

    // Unenroll all factors
    for (const factor of factors) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        return { error: new Error(error.message) };
      }
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get the first verified TOTP factor for verification.
 */
export async function getVerifiedFactor(): Promise<{
  factor: MFAFactor | null;
  error: Error | null;
}> {
  try {
    const { factors, error } = await isMFAEnabled();

    if (error) {
      return { factor: null, error };
    }

    const verifiedFactor = factors.find((f) => f.status === 'verified');
    return { factor: verifiedFactor || null, error: null };
  } catch (err) {
    return {
      factor: null,
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
