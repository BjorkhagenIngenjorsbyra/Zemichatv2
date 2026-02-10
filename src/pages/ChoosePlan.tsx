import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { checkmarkCircle, sparkles } from 'ionicons/icons';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PlanType } from '../types/database';
import { PLAN_FEATURES, PLAN_PRICING } from '../types/subscription';

const ChoosePlan: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { status, isLoading, startTrial } = useSubscription();

  // Skip for returning users who already have a trial or paid plan
  useEffect(() => {
    if (isLoading) return;
    if (status?.isTrialActive || (status?.plan && status.plan !== PlanType.FREE)) {
      history.replace('/chats');
    }
  }, [isLoading, status, history]);

  const handleStartTrial = async () => {
    await startTrial();
    history.replace('/chats');
  };

  const plans = [
    {
      id: 'start',
      name: t('paywall.planStart'),
      price: PLAN_PRICING[PlanType.FREE].price,
      isOneTime: true,
      features: [
        t('paywall.features.maxUsers', { count: PLAN_FEATURES[PlanType.FREE].maxUsers }),
        t('paywall.features.textMessages'),
      ],
    },
    {
      id: 'plus',
      name: t('paywall.planPlus'),
      price: PLAN_PRICING[PlanType.BASIC].price,
      isOneTime: false,
      features: [
        t('paywall.features.maxUsers', { count: PLAN_FEATURES[PlanType.BASIC].maxUsers }),
        t('paywall.features.textMessages'),
        t('paywall.features.images'),
      ],
    },
    {
      id: 'plus_ringa',
      name: t('paywall.planPlusRinga'),
      price: PLAN_PRICING[PlanType.PRO].price,
      isOneTime: false,
      recommended: true,
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
    },
  ];

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="choose-plan-container">
          <div className="choose-plan-header">
            <div className="step-indicator">
              <span className="step-badge">{t('team.stepOf', { current: 2, total: 2 })}</span>
            </div>
            <IonIcon icon={sparkles} className="choose-plan-icon" />
            <h1 className="choose-plan-title">{t('choosePlan.title')}</h1>
            <p className="choose-plan-subtitle">{t('choosePlan.subtitle')}</p>
          </div>

          {/* Trial banner */}
          <div className="choose-plan-trial-banner">
            <p>{t('choosePlan.trialBanner')}</p>
          </div>

          {/* Plan cards */}
          <div className="choose-plan-cards">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`choose-plan-card ${plan.recommended ? 'recommended' : ''}`}
              >
                {plan.recommended && (
                  <div className="recommended-badge">{t('paywall.recommended')}</div>
                )}
                <h3>{plan.name}</h3>
                <div className="choose-plan-price">
                  <span className="amount">{plan.price}</span>
                  <span className="period">
                    {plan.isOneTime
                      ? ` kr (${t('choosePlan.oneTime')})`
                      : ` kr${t('choosePlan.perMonth')}`}
                  </span>
                </div>
                <ul className="choose-plan-features">
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

          {/* CTA */}
          <IonButton
            expand="block"
            className="choose-plan-cta glow-primary"
            onClick={handleStartTrial}
            disabled={isLoading}
          >
            {isLoading ? <IonSpinner name="crescent" /> : t('choosePlan.startTrial')}
          </IonButton>
        </div>

        <style>{`
          .choose-plan-container {
            display: flex;
            flex-direction: column;
            min-height: 100%;
            max-width: 500px;
            margin: 0 auto;
            padding: 1.5rem;
          }

          .choose-plan-header {
            text-align: center;
            margin-bottom: 1.5rem;
          }

          .step-indicator {
            margin-bottom: 1rem;
          }

          .step-badge {
            background: hsl(var(--primary) / 0.15);
            color: hsl(var(--primary));
            padding: 0.375rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 600;
          }

          .choose-plan-icon {
            font-size: 3rem;
            color: hsl(var(--primary));
            margin: 1rem 0 0.5rem;
          }

          .choose-plan-title {
            font-size: 2rem;
            font-weight: 800;
            color: hsl(var(--foreground));
            margin: 0 0 0.5rem 0;
            letter-spacing: -0.02em;
          }

          .choose-plan-subtitle {
            font-size: 1rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            line-height: 1.5;
          }

          .choose-plan-trial-banner {
            background: linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05));
            border: 1px solid hsl(var(--primary) / 0.2);
            border-radius: 1rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
            text-align: center;
          }

          .choose-plan-trial-banner p {
            margin: 0;
            font-weight: 500;
            color: hsl(var(--foreground));
          }

          .choose-plan-cards {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }

          .choose-plan-card {
            flex: 1;
            background: hsl(var(--card));
            border: 2px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1rem;
            position: relative;
            transition: all 0.2s ease;
          }

          .choose-plan-card.recommended {
            border-color: hsl(var(--primary));
            background: hsl(var(--primary) / 0.05);
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
            white-space: nowrap;
          }

          .choose-plan-card h3 {
            margin: 0.5rem 0;
            font-size: 1rem;
            text-align: center;
            color: hsl(var(--foreground));
          }

          .choose-plan-price {
            text-align: center;
            margin-bottom: 0.75rem;
          }

          .choose-plan-price .amount {
            font-size: 1.75rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .choose-plan-price .period {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
          }

          .choose-plan-features {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .choose-plan-features li {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.2rem 0;
            font-size: 0.7rem;
            color: hsl(var(--foreground));
          }

          .choose-plan-features li ion-icon {
            color: hsl(var(--primary));
            font-size: 0.875rem;
            flex-shrink: 0;
          }

          .choose-plan-cta {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            margin-top: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default ChoosePlan;
