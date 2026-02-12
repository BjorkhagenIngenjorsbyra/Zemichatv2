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
} from '@ionic/react';
import { close, checkmarkCircle, sparkles } from 'ionicons/icons';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanType } from '../../types/database';
import { PLAN_FEATURES, PLAN_PRICING, type RevenueCatPackage } from '../../types/subscription';

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
    purchase,
    restore,
    isLoading,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('plus_ringa');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async () => {
    if (!currentOffering) return;

    setIsProcessing(true);
    const planType = PLAN_ID_TO_TYPE[selectedPlan];
    const pkg = currentOffering.availablePackages.find(
      (p) => p.product.identifier === PLAN_PRICING[planType].productId
    );

    if (pkg) {
      const success = await purchase(pkg);
      if (success) {
        hidePaywall();
      }
    }
    setIsProcessing(false);
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    await restore();
    setIsProcessing(false);
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
                  <span className="amount">{plan.price}</span>
                  <span className="period">
                    {` kr/${t('paywall.month')}`}
                  </span>
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

          {/* Purchase button */}
          <IonButton
            expand="block"
            className="purchase-button"
            onClick={handlePurchase}
            disabled={isProcessing || isLoading}
          >
            {isProcessing ? (
              <IonSpinner name="crescent" />
            ) : (
              t('paywall.subscribe', { plan: t(PLAN_ID_TO_I18N[selectedPlan]) })
            )}
          </IonButton>

          {/* Restore purchases */}
          <IonButton
            expand="block"
            fill="clear"
            className="restore-button"
            onClick={handleRestore}
            disabled={isProcessing}
          >
            {t('paywall.restorePurchases')}
          </IonButton>

          {/* Terms */}
          <p className="terms-text">
            {t('paywall.termsText')}
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
            text-transform: uppercase;
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
            font-size: 0.625rem;
            color: hsl(var(--muted-foreground));
            margin-top: 1rem;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default Paywall;
