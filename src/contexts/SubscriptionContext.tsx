import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuthContext } from './AuthContext';
import { PlanType } from '../types/database';
import {
  type SubscriptionStatus,
  type RevenueCatOffering,
  type RevenueCatPackage,
  PLAN_FEATURES,
} from '../types/subscription';
import {
  initializeRevenueCat,
  loginRevenueCat,
  logoutRevenueCat,
  getSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  startFreeTrial,
  isFeatureAvailable,
} from '../services/subscription';

// ============================================================
// CONTEXT TYPE
// ============================================================

interface SubscriptionContextValue {
  // State
  status: SubscriptionStatus | null;
  offerings: RevenueCatOffering[];
  currentOffering: RevenueCatOffering | null;
  offeringsError: Error | null;
  isLoading: boolean;
  error: Error | null;

  // Computed
  currentPlan: PlanType;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysLeft: number;
  canUseFeature: (feature: keyof typeof PLAN_FEATURES[PlanType.FREE]) => boolean;

  // Actions
  refreshStatus: () => Promise<void>;
  purchase: (pkg: RevenueCatPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  startTrial: (planType?: PlanType) => Promise<boolean>;
  showPaywall: (feature?: string) => void;
  hidePaywall: () => void;

  // Paywall state
  isPaywallVisible: boolean;
  paywallFeature: string | null;
}

// ============================================================
// CONTEXT
// ============================================================

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ============================================================
// PROVIDER
// ============================================================

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { profile, isAuthenticated } = useAuthContext();

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [offerings, setOfferings] = useState<RevenueCatOffering[]>([]);
  const [currentOffering, setCurrentOffering] = useState<RevenueCatOffering | null>(null);
  const [offeringsError, setOfferingsError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Paywall state
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  // Initialize RevenueCat when user logs in
  // Key on profile.id, not the whole profile object: AuthContext hands out a
  // fresh profile reference on any profile change, which would otherwise
  // re-initialize and re-login RevenueCat on every such update.
  const profileId = profile?.id;
  useEffect(() => {
    if (!isAuthenticated || !profileId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    const init = async () => {
      setIsLoading(true);
      setError(null);

      // Initialize SDK
      const { error: initError } = await initializeRevenueCat(profileId);
      if (initError) {
        console.error('Failed to initialize RevenueCat:', initError);
      }

      // Login to RevenueCat
      const { error: loginError } = await loginRevenueCat(profileId);
      if (loginError) {
        console.error('Failed to login to RevenueCat:', loginError);
      }

      // Get subscription status
      const { status: subStatus, error: statusError } = await getSubscriptionStatus();
      if (statusError) {
        console.warn('Subscription status error:', statusError);
        setError(statusError);
      }
      // Always set status if we got one, even alongside an error
      if (subStatus) {
        setStatus(subStatus);
      }

      // Get offerings — Apple rejection 2026-05-20 (build 52) flagged the
      // paywall as "loading indefinitely" when offerings failed to arrive.
      // We now expose the error so the paywall can render an actionable
      // message instead of holding a spinner forever.
      const { offerings: off, current, error: offErr } = await getOfferings();
      setOfferings(off);
      setCurrentOffering(current);
      setOfferingsError(offErr);

      setIsLoading(false);
    };

    init();
  }, [isAuthenticated, profileId]);

  // Cleanup on logout
  useEffect(() => {
    if (!isAuthenticated) {
      logoutRevenueCat();
    }
  }, [isAuthenticated]);

  // ============================================================
  // COMPUTED
  // ============================================================

  const currentPlan = status?.plan || PlanType.FREE;
  const isTrialActive = status?.isTrialActive || false;

  // Trial expired: had a trial that ended, and no active paid subscription
  const isTrialExpired = !!(
    status?.trialEndsAt &&
    !status.isTrialActive &&
    status.plan === PlanType.FREE &&
    !status.isActive
  );

  // Days left in trial (0 if no trial or expired)
  const trialDaysLeft = (() => {
    if (!status?.trialEndsAt || !status.isTrialActive) return 0;
    const diff = status.trialEndsAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const canUseFeature = useCallback(
    (feature: keyof typeof PLAN_FEATURES[PlanType.FREE]): boolean => {
      const plan = status?.isTrialActive ? PlanType.PRO : (status?.plan || PlanType.FREE);
      return isFeatureAvailable(plan, feature);
    },
    [status]
  );

  // ============================================================
  // ACTIONS
  // ============================================================

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    const { status: newStatus, error: statusError } = await getSubscriptionStatus();
    if (statusError) {
      setError(statusError);
    } else {
      setStatus(newStatus);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  const purchase = useCallback(async (pkg: RevenueCatPackage): Promise<boolean> => {
    setIsLoading(true);
    const { success, status: newStatus, error: purchaseError } = await purchasePackage(pkg);
    if (purchaseError) {
      setError(purchaseError);
    } else if (newStatus) {
      setStatus(newStatus);
      setError(null);
    }
    setIsLoading(false);
    return success;
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    const { status: newStatus, error: restoreError } = await restorePurchases();
    if (restoreError) {
      setError(restoreError);
      setIsLoading(false);
      return false;
    }
    if (newStatus) {
      setStatus(newStatus);
      setError(null);
    }
    setIsLoading(false);
    return true;
  }, []);

  const startTrial = useCallback(async (planType?: PlanType): Promise<boolean> => {
    setIsLoading(true);
    const { success, error: trialError } = await startFreeTrial(planType);
    if (trialError) {
      setError(trialError);
      setIsLoading(false);
      return false;
    }
    // Refresh status to get trial
    await refreshStatus();
    return success;
  }, [refreshStatus]);

  const showPaywall = useCallback((feature?: string) => {
    setPaywallFeature(feature || null);
    setIsPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
    setPaywallFeature(null);
  }, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  // Audit fix #36-5: memo:a context-värdet.
  const value: SubscriptionContextValue = useMemo(
    () => ({
      status,
      offerings,
      currentOffering,
      offeringsError,
      isLoading,
      error,
      currentPlan,
      isTrialActive,
      isTrialExpired,
      trialDaysLeft,
      canUseFeature,
      refreshStatus,
      purchase,
      restore,
      startTrial,
      showPaywall,
      hidePaywall,
      isPaywallVisible,
      paywallFeature,
    }),
    [
      status,
      offerings,
      currentOffering,
      offeringsError,
      isLoading,
      error,
      currentPlan,
      isTrialActive,
      isTrialExpired,
      trialDaysLeft,
      canUseFeature,
      refreshStatus,
      purchase,
      restore,
      startTrial,
      showPaywall,
      hidePaywall,
      isPaywallVisible,
      paywallFeature,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
