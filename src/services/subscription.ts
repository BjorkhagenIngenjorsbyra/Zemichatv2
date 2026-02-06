import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { PlanType } from '../types/database';
import {
  type SubscriptionStatus,
  type RevenueCatCustomerInfo,
  type RevenueCatOffering,
  type RevenueCatPackage,
  PLAN_FEATURES,
  PLAN_PRICING,
} from '../types/subscription';

// ============================================================
// CONFIGURATION
// ============================================================

const REVENUECAT_API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_ANDROID_KEY || '';
const REVENUECAT_API_KEY_IOS = import.meta.env.VITE_REVENUECAT_IOS_KEY || '';

// Entitlement identifiers in RevenueCat
const ENTITLEMENT_BASIC = 'basic';
const ENTITLEMENT_PRO = 'pro';

// Trial duration in days
const TRIAL_DURATION_DAYS = 10;

// ============================================================
// INITIALIZATION
// ============================================================

let isInitialized = false;

/**
 * Initialize RevenueCat SDK.
 * Should be called once when app starts.
 */
export async function initializeRevenueCat(userId: string): Promise<{ error: Error | null }> {
  try {
    if (isInitialized) {
      return { error: null };
    }

    // Skip on web
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Skipping initialization on web');
      isInitialized = true;
      return { error: null };
    }

    const platform = Capacitor.getPlatform();
    const apiKey = platform === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

    if (!apiKey) {
      return { error: new Error('RevenueCat API key not configured') };
    }

    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

    await Purchases.configure({
      apiKey,
      appUserID: userId,
    });

    isInitialized = true;
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to initialize RevenueCat'),
    };
  }
}

/**
 * Login user to RevenueCat.
 */
export async function loginRevenueCat(userId: string): Promise<{ error: Error | null }> {
  try {
    if (!Capacitor.isNativePlatform()) {
      return { error: null };
    }

    await Purchases.logIn({ appUserID: userId });
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to login to RevenueCat'),
    };
  }
}

/**
 * Logout user from RevenueCat.
 */
export async function logoutRevenueCat(): Promise<{ error: Error | null }> {
  try {
    if (!Capacitor.isNativePlatform()) {
      return { error: null };
    }

    await Purchases.logOut();
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Failed to logout from RevenueCat'),
    };
  }
}

// ============================================================
// MANUAL SUBSCRIPTIONS
// ============================================================

export interface ManualSubscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  expires_at: string | null;
  granted_by: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Check if user has an active manual subscription.
 * Manual subscriptions override RevenueCat subscriptions.
 */
export async function getManualSubscription(userId?: string): Promise<{
  subscription: ManualSubscription | null;
  error: Error | null;
}> {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { subscription: null, error: new Error('Not authenticated') };
      }
      targetUserId = user.id;
    }

    const { data, error } = await supabase
      .from('manual_subscriptions')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found - not an error, just no manual subscription
        return { subscription: null, error: null };
      }
      return { subscription: null, error: new Error(error.message) };
    }

    const subscription = data as ManualSubscription;

    // Check if expired
    if (subscription.expires_at) {
      const expiresAt = new Date(subscription.expires_at);
      if (expiresAt < new Date()) {
        // Expired manual subscription
        return { subscription: null, error: null };
      }
    }

    return { subscription, error: null };
  } catch (err) {
    return {
      subscription: null,
      error: err instanceof Error ? err : new Error('Failed to get manual subscription'),
    };
  }
}

/**
 * Convert manual subscription to SubscriptionStatus.
 */
function manualSubscriptionToStatus(subscription: ManualSubscription): SubscriptionStatus {
  const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;

  return {
    isActive: true,
    plan: subscription.plan_type,
    isTrialActive: false,
    trialEndsAt: null,
    expiresAt,
    willRenew: false, // Manual subscriptions don't auto-renew
  };
}

// ============================================================
// SUBSCRIPTION STATUS
// ============================================================

/**
 * Get current subscription status.
 * Priority: Manual subscription > RevenueCat > Team plan > Free
 */
export async function getSubscriptionStatus(): Promise<{
  status: SubscriptionStatus | null;
  error: Error | null;
}> {
  try {
    // First, check for manual subscription (overrides everything)
    const { subscription: manualSub, error: manualError } = await getManualSubscription();
    if (manualError) {
      console.warn('Error checking manual subscription:', manualError);
      // Continue to check other sources
    }

    if (manualSub) {
      const status = manualSubscriptionToStatus(manualSub);
      return { status, error: null };
    }

    // On web, get status from database
    if (!Capacitor.isNativePlatform()) {
      return getSubscriptionStatusFromDatabase();
    }

    const { customerInfo } = await Purchases.getCustomerInfo();
    const info = customerInfo as unknown as RevenueCatCustomerInfo;

    // Check active entitlements
    const hasBasic = info.entitlements.active[ENTITLEMENT_BASIC]?.isActive || false;
    const hasPro = info.entitlements.active[ENTITLEMENT_PRO]?.isActive || false;

    let plan = PlanType.FREE;
    let isTrialActive = false;
    let expiresAt: Date | null = null;
    let willRenew = false;

    if (hasPro) {
      plan = PlanType.PRO;
      const proEntitlement = info.entitlements.active[ENTITLEMENT_PRO];
      isTrialActive = proEntitlement.periodType === 'TRIAL';
      expiresAt = proEntitlement.expirationDate ? new Date(proEntitlement.expirationDate) : null;
      willRenew = proEntitlement.willRenew;
    } else if (hasBasic) {
      plan = PlanType.BASIC;
      const basicEntitlement = info.entitlements.active[ENTITLEMENT_BASIC];
      isTrialActive = basicEntitlement.periodType === 'TRIAL';
      expiresAt = basicEntitlement.expirationDate ? new Date(basicEntitlement.expirationDate) : null;
      willRenew = basicEntitlement.willRenew;
    }

    const status: SubscriptionStatus = {
      isActive: plan !== PlanType.FREE,
      plan,
      isTrialActive,
      trialEndsAt: isTrialActive ? expiresAt : null,
      expiresAt,
      willRenew,
    };

    // Sync with database
    await syncSubscriptionToDatabase(status);

    return { status, error: null };
  } catch (err) {
    return {
      status: null,
      error: err instanceof Error ? err : new Error('Failed to get subscription status'),
    };
  }
}

/**
 * Get subscription status from database (for web or fallback).
 * Note: Manual subscriptions are already checked in getSubscriptionStatus.
 */
async function getSubscriptionStatusFromDatabase(): Promise<{
  status: SubscriptionStatus | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { status: null, error: new Error('Not authenticated') };
    }

    // Get user's team
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return { status: null, error: new Error('User not found') };
    }

    // Get team's plan
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('plan, trial_ends_at')
      .eq('id', (userData as { team_id: string }).team_id)
      .single();

    if (teamError || !teamData) {
      return { status: null, error: new Error('Team not found') };
    }

    const team = teamData as { plan: PlanType; trial_ends_at: string | null };
    const trialEndsAt = team.trial_ends_at ? new Date(team.trial_ends_at) : null;
    const isTrialActive = trialEndsAt ? trialEndsAt > new Date() : false;

    const status: SubscriptionStatus = {
      isActive: team.plan !== PlanType.FREE || isTrialActive,
      plan: isTrialActive ? PlanType.PRO : team.plan,
      isTrialActive,
      trialEndsAt,
      expiresAt: trialEndsAt,
      willRenew: false,
    };

    return { status, error: null };
  } catch (err) {
    return {
      status: null,
      error: err instanceof Error ? err : new Error('Failed to get subscription from database'),
    };
  }
}

/**
 * Check subscription status for a specific user (admin function).
 * This is useful for checking other users' subscriptions.
 */
export async function getSubscriptionStatusForUser(userId: string): Promise<{
  status: SubscriptionStatus | null;
  error: Error | null;
}> {
  try {
    // Check for manual subscription first
    const { subscription: manualSub, error: manualError } = await getManualSubscription(userId);
    if (manualError) {
      console.warn('Error checking manual subscription:', manualError);
    }

    if (manualSub) {
      return { status: manualSubscriptionToStatus(manualSub), error: null };
    }

    // Get user's team
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return { status: null, error: new Error('User not found') };
    }

    // Get team's plan
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('plan, trial_ends_at')
      .eq('id', (userData as { team_id: string }).team_id)
      .single();

    if (teamError || !teamData) {
      return { status: null, error: new Error('Team not found') };
    }

    const team = teamData as { plan: PlanType; trial_ends_at: string | null };
    const trialEndsAt = team.trial_ends_at ? new Date(team.trial_ends_at) : null;
    const isTrialActive = trialEndsAt ? trialEndsAt > new Date() : false;

    const status: SubscriptionStatus = {
      isActive: team.plan !== PlanType.FREE || isTrialActive,
      plan: isTrialActive ? PlanType.PRO : team.plan,
      isTrialActive,
      trialEndsAt,
      expiresAt: trialEndsAt,
      willRenew: false,
    };

    return { status, error: null };
  } catch (err) {
    return {
      status: null,
      error: err instanceof Error ? err : new Error('Failed to get subscription status'),
    };
  }
}

/**
 * Sync RevenueCat subscription status to Supabase.
 */
async function syncSubscriptionToDatabase(status: SubscriptionStatus): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's team
    const { data: userData } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', user.id)
      .single();

    if (!userData) return;

    // Update team's plan
    await supabase
      .from('teams')
      .update({
        plan: status.plan,
        trial_ends_at: status.trialEndsAt?.toISOString() || null,
      } as never)
      .eq('id', (userData as { team_id: string }).team_id);
  } catch (err) {
    console.error('Failed to sync subscription to database:', err);
  }
}

// ============================================================
// OFFERINGS & PACKAGES
// ============================================================

/**
 * Get available offerings from RevenueCat.
 */
export async function getOfferings(): Promise<{
  offerings: RevenueCatOffering[];
  current: RevenueCatOffering | null;
  error: Error | null;
}> {
  try {
    if (!Capacitor.isNativePlatform()) {
      // Return mock offerings for web testing
      return {
        offerings: [],
        current: createMockOffering(),
        error: null,
      };
    }

    const offerings = await Purchases.getOfferings();

    return {
      offerings: offerings?.all
        ? Object.values(offerings.all as unknown as Record<string, RevenueCatOffering>)
        : [],
      current: offerings?.current as unknown as RevenueCatOffering | null,
      error: null,
    };
  } catch (err) {
    return {
      offerings: [],
      current: null,
      error: err instanceof Error ? err : new Error('Failed to get offerings'),
    };
  }
}

/**
 * Create mock offering for web testing.
 */
function createMockOffering(): RevenueCatOffering {
  return {
    identifier: 'default',
    serverDescription: 'Default Offering',
    availablePackages: [
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: PLAN_PRICING[PlanType.BASIC].productId,
          priceString: `${PLAN_PRICING[PlanType.BASIC].monthlyPrice} kr/mån`,
          price: PLAN_PRICING[PlanType.BASIC].monthlyPrice,
          currencyCode: 'SEK',
          title: 'Basic',
          description: 'Text + Bilder, max 10 användare',
        },
      },
      {
        identifier: '$rc_monthly_pro',
        packageType: 'MONTHLY',
        product: {
          identifier: PLAN_PRICING[PlanType.PRO].productId,
          priceString: `${PLAN_PRICING[PlanType.PRO].monthlyPrice} kr/mån`,
          price: PLAN_PRICING[PlanType.PRO].monthlyPrice,
          currencyCode: 'SEK',
          title: 'Pro',
          description: 'Allt inklusive samtal, max 10 användare',
        },
      },
    ],
    monthly: undefined,
    annual: undefined,
  };
}

// ============================================================
// PURCHASES
// ============================================================

/**
 * Purchase a package.
 */
export async function purchasePackage(pkg: RevenueCatPackage): Promise<{
  success: boolean;
  status: SubscriptionStatus | null;
  error: Error | null;
}> {
  try {
    if (!Capacitor.isNativePlatform()) {
      return {
        success: false,
        status: null,
        error: new Error('Purchases are only available on mobile devices'),
      };
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg as never });

    // Get updated status
    const { status } = await getSubscriptionStatus();

    return {
      success: true,
      status,
      error: null,
    };
  } catch (err) {
    // Check if user cancelled
    const error = err as { userCancelled?: boolean };
    if (error.userCancelled) {
      return {
        success: false,
        status: null,
        error: null, // Not an error, just cancelled
      };
    }

    return {
      success: false,
      status: null,
      error: err instanceof Error ? err : new Error('Purchase failed'),
    };
  }
}

/**
 * Restore previous purchases.
 */
export async function restorePurchases(): Promise<{
  status: SubscriptionStatus | null;
  error: Error | null;
}> {
  try {
    if (!Capacitor.isNativePlatform()) {
      return {
        status: null,
        error: new Error('Restore is only available on mobile devices'),
      };
    }

    await Purchases.restorePurchases();
    return getSubscriptionStatus();
  } catch (err) {
    return {
      status: null,
      error: err instanceof Error ? err : new Error('Failed to restore purchases'),
    };
  }
}

// ============================================================
// TRIAL
// ============================================================

/**
 * Start a free trial (Pro features for 10 days).
 */
export async function startFreeTrial(): Promise<{
  success: boolean;
  trialEndsAt: Date | null;
  error: Error | null;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, trialEndsAt: null, error: new Error('Not authenticated') };
    }

    // Get user's team
    const { data: userData } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return { success: false, trialEndsAt: null, error: new Error('User not found') };
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    // Update team with trial
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        trial_ends_at: trialEndsAt.toISOString(),
      } as never)
      .eq('id', (userData as { team_id: string }).team_id);

    if (updateError) {
      return { success: false, trialEndsAt: null, error: new Error(updateError.message) };
    }

    return { success: true, trialEndsAt, error: null };
  } catch (err) {
    return {
      success: false,
      trialEndsAt: null,
      error: err instanceof Error ? err : new Error('Failed to start trial'),
    };
  }
}

// ============================================================
// FEATURE CHECKS
// ============================================================

/**
 * Check if a feature is available for the current plan.
 */
export function isFeatureAvailable(
  plan: PlanType,
  feature: keyof typeof PLAN_FEATURES[PlanType.FREE]
): boolean {
  return PLAN_FEATURES[plan][feature] as boolean;
}

/**
 * Get the minimum plan required for a feature.
 */
export function getMinimumPlanForFeature(
  feature: keyof typeof PLAN_FEATURES[PlanType.FREE]
): PlanType {
  if (PLAN_FEATURES[PlanType.FREE][feature]) return PlanType.FREE;
  if (PLAN_FEATURES[PlanType.BASIC][feature]) return PlanType.BASIC;
  return PlanType.PRO;
}

// ============================================================
// EXPORTS
// ============================================================

export { PLAN_FEATURES, PLAN_PRICING };
