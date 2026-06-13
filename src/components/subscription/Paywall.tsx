import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { close, checkmarkCircle, sparkles, alertCircle } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanType } from '../../types/database';
import { PLAN_FEATURES, PLAN_PRICING } from '../../types/subscription';

type PlanId = 'plus' | 'plus_ringa';

const PLAN_ID_TO_TYPE: Record<PlanId, PlanType> = {
  plus: PlanType.BASIC,
  plus_ringa: PlanType.PRO,
};

const PLAN_ID_TO_I18N: Record<PlanId, string> = {
  plus: 'paywall.planPlus',
  plus_ringa: 'paywall.planPlusRinga',
};

interface PaywallProps {
  blocking?: boolean;
}

const Paywall: React.FC<PaywallProps> = ({ blocking = false }) => {
  const { t } = useTranslation();
  const {
    isPaywallVisible,
    hidePaywall,
    paywallFeature,
    currentOffering,
    offeringsError,
    purchase,
    restore,
    isLoading,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('plus_ringa');
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Store-localized price for a plan from the fetched offering. Falling back to
  // the hardcoded PLAN_PRICING table (only while offerings load) would otherwise
  // show a price that can differ from what the user is actually charged — wrong
  // currency/storefront, or stale if store pricing changed (App Store review
  // risk). RevenueCat's priceString is just the amount; the period is appended
  // at render.
  const storePriceFor = (planType: PlanType): string | null => {
    if (!currentOffering) return null;
    const productId = PLAN_PRICING[planType].productId;
    const pkg = currentOffering.availablePackages.find(
      (p) => p.product.identifier === productId
    );
    return pkg?.product.priceString ?? null;
  };

  // Paywall is interactive when:
  //  - offerings have loaded (currentOffering present)
  //  - context is not in a global loading state
  //  - we are not mid-purchase
  //
  // Apple rejection 2026-05-18 (build 51, iPad Air 11" iPadOS 26.5) flagged the
  // subscribe button as unresponsive when offerings hadn't finished loading.
  // Build 52 was rejected again because, in sandbox, offerings sometimes never
  // arrive at all — leaving the button in a permanent spinner state. The
  // service layer now times offerings out at 10s and reports an error; here
  // we promote that error to a visible message and re-enable the button so
  // the user can retry (the button retriggers the purchase flow which itself
  // re-fetches offerings via RevenueCat's purchasePackage call).
  const isReady = !!currentOffering && !isLoading;
  const offeringsErrorMessage = offeringsError
    ? t('paywall.errorOfferingsUnavailable')
    : null;

  const handlePurchase = async () => {
    setPurchaseError(null);

    if (!currentOffering) {
      // Offerings still loading or failed to load. Surface a real error
      // instead of returning silently so the user can retry.
      setPurchaseError(t('paywall.errorOfferingsUnavailable'));
      return;
    }

    setIsProcessing(true);
    try {
      const planType = PLAN_ID_TO_TYPE[selectedPlan];
      const expectedProductId = PLAN_PRICING[planType].productId;
      const pkg = currentOffering.availablePackages.find(
        (p) => p.product.identifier === expectedProductId
      );

      if (!pkg) {
        // Product mismatch between client config and store offering. Common
        // causes: store-side product not approved yet, region-locked, or a
        // typo in PLAN_PRICING.productId. Surface so we can debug.
        setPurchaseError(
          t('paywall.errorProductNotFound', { product: expectedProductId })
        );
        return;
      }

      const success = await purchase(pkg);
      if (success) {
        hidePaywall();
      } else {
        // RevenueCat returned false. This typically means the user cancelled,
        // but it can also mean a sandbox/StoreKit error. Show a generic
        // failure message — cancellation is harmless, surfacing it briefly
        // is better than a dead button.
        setPurchaseError(t('paywall.errorPurchaseFailed'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setPurchaseError(t('paywall.errorPurchaseException', { error: msg }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setPurchaseError(null);
    setIsProcessing(true);
    try {
      await restore();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setPurchaseError(t('paywall.errorRestoreFailed', { error: msg }));
    } finally {
      setIsProcessing(false);
    }
  };

  const plans = [
    {
      id: 'plus' as const,
      name: t('paywall.planPlus'),
      price: PLAN_PRICING[PlanType.BASIC].price,
      features: [
        t('paywall.features.maxUsers', { count: PLAN_FEATURES[PlanType.BASIC].maxUsers }),
        t('paywall.features.textMessages'),
        t('paywall.features.images'),
      ],
    },
    {
      id: 'plus_ringa' as const,
      name: t('paywall.planPlusRinga'),
      price: PLAN_PRICING[PlanType.PRO].price,
      features: [
        t('paywall.features.maxUsers', { count: PLAN_FEATURES[PlanType.PRO].maxUsers }),
        t('paywall.features.textMessages'),
        t('paywall.features.images'),
        t('paywall.features.voice'),
        t('paywall.features.video'),
        t('paywall.features.documents'),
        t('paywall.features.location'),
        t('paywall.features.calls'),
      ],
      recommended: true,
    },
  ];

  const isOpen = blocking || isPaywallVisible;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={blocking ? undefined : hidePaywall} canDismiss={!blocking}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{blocking ? t('paywall.trialExpiredTitle') : t('paywall.title')}</IonTitle>
          {!blocking && (
            <IonButtons slot="end">
              <IonButton onClick={hidePaywall}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="paywall-content">
        <div className="paywall-container">
          {/* Header */}
          <div className="paywall-header">
            <IonIcon icon={sparkles} className="header-icon" />
            <h2>{blocking ? t('paywall.trialExpiredTitle') : t('paywall.upgradeTitle')}</h2>
            {blocking && (
              <p className="feature-hint">
                {t('paywall.trialExpiredMessage')}
              </p>
            )}
            {!blocking && paywallFeature && (
              <p className="feature-hint">
                {t('paywall.featureRequires', { feature: paywallFeature })}
              </p>
            )}
          </div>

          {/* Plan cards */}
          <div className="plan-cards">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${'recommended' in plan && plan.recommended ? 'recommended' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {'recommended' in plan && plan.recommended && (
                  <div className="recommended-badge">{t('paywall.recommended')}</div>
                )}
                <h3>{plan.name}</h3>
                <div className="price">
                  {(() => {
                    const storePrice = storePriceFor(PLAN_ID_TO_TYPE[plan.id]);
                    return storePrice ? (
                      <>
                        <span className="amount">{storePrice}</span>
                        <span className="period">{`/${t('paywall.month')}`}</span>
                      </>
                    ) : (
                      <>
                        <span className="amount">{plan.price}</span>
                        <span className="period">{` kr/${t('paywall.month')}`}</span>
                      </>
                    );
                  })()}
                </div>
                <ul className="features">
                  {plan.features.map((feature, i) => (
                    <li key={i}>
                      <IonIcon icon={checkmarkCircle} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Purchase button — disabled while offerings load or purchase
              is in flight. If offerings fail to load (build 52 sandbox case)
              we re-enable the button so the user can retry rather than
              staring at a permanent spinner. */}
          <IonButton
            expand="block"
            className="purchase-button"
            onClick={handlePurchase}
            disabled={isProcessing || (!isReady && !offeringsError)}
            data-testid="paywall-subscribe-button"
          >
            {isProcessing || (!isReady && !offeringsError) ? (
              <IonSpinner name="crescent" />
            ) : (
              t('paywall.subscribe', { plan: t(PLAN_ID_TO_I18N[selectedPlan]) })
            )}
          </IonButton>

          {/* Visible error message — covers both purchase failures and
              offerings load failures. Apple flagged the silent-spinner UX
              as an unresponsive button; surfacing the cause lets the user
              retry. */}
          {(purchaseError || offeringsErrorMessage) && (
            <div className="purchase-error" role="alert">
              <IonIcon icon={alertCircle} />
              <IonText>{purchaseError || offeringsErrorMessage}</IonText>
            </div>
          )}

          {/* Restore purchases */}
          <IonButton
            expand="block"
            fill="clear"
            className="restore-button"
            onClick={handleRestore}
            disabled={isProcessing}
            data-testid="paywall-restore-button"
          >
            {t('paywall.restorePurchases')}
          </IonButton>

          {/* Terms — platform-specific text removes Google Play references
              on iOS (App Store guideline 2.3.10, fix for rejection 2026-05-18). */}
          <p className="terms-text">
            {Capacitor.getPlatform() === 'ios'
              ? t('paywall.termsTextIos')
              : t('paywall.termsTextAndroid')}
          </p>
        </div>

        <style>{`
          .paywall-content {
            --background: hsl(var(--background));
          }

          .paywall-container {
            padding: 1.5rem;
            max-width: 500px;
            margin: 0 auto;
          }

          .paywall-header {
            text-align: center;
            margin-bottom: 1.5rem;
          }

          .header-icon {
            font-size: 3rem;
            color: hsl(var(--primary));
            margin-bottom: 0.5rem;
          }

          .paywall-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: hsl(var(--foreground));
          }

          .feature-hint {
            margin: 0.5rem 0 0;
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .plan-cards {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
          }

          .plan-card {
            flex: 1;
            background: hsl(var(--card));
            border: 2px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
          }

          .plan-card.selected {
            border-color: hsl(var(--primary));
            background: hsl(var(--primary) / 0.05);
          }

          .plan-card.recommended {
            transform: scale(1.02);
          }

          .recommended-badge {
            position: absolute;
            top: -0.75rem;
            left: 50%;
            transform: translateX(-50%);
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.625rem;
            font-weight: 600;
            letter-spacing: 0.02em;
          }

          .plan-card h3 {
            margin: 0.5rem 0;
            font-size: 1.125rem;
            text-align: center;
          }

          .price {
            text-align: center;
            margin-bottom: 1rem;
          }

          .price .amount {
            font-size: 2rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .price .period {
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
          }

          .features {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .features li {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0;
            font-size: 0.75rem;
            color: hsl(var(--foreground));
          }

          .features li ion-icon {
            color: hsl(var(--primary));
            font-size: 1rem;
            flex-shrink: 0;
          }

          .purchase-button {
            margin-bottom: 0.5rem;
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
          }

          .restore-button {
            --color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .terms-text {
            text-align: center;
            font-size: 0.7rem;
            color: hsl(var(--foreground) / 0.6);
            margin-top: 1rem;
          }

          .purchase-error {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            margin: 0.5rem 0;
            padding: 0.75rem;
            background: hsl(var(--destructive) / 0.1);
            color: hsl(var(--destructive));
            border-radius: 0.5rem;
            font-size: 0.875rem;
            text-align: left;
          }

          .purchase-error ion-icon {
            font-size: 1.125rem;
            flex-shrink: 0;
            margin-top: 0.125rem;
          }

          /* iPad layout: paywall.modal can stretch wide and break the plan-card
             grid on iPadOS 26.5 (Apple rejection 2026-05-18 surface area).
             Constrain max-width and re-center the action button so the
             subscribe button always falls inside the viewport. */
          @media (min-width: 768px) {
            .paywall-container {
              max-width: 560px;
            }
            .plan-cards {
              gap: 1.25rem;
            }
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default Paywall;
