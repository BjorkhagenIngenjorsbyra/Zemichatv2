import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

const TrialBanner: React.FC = () => {
  const { t } = useTranslation();
  const { status, isLoading, showPaywall } = useSubscription();
  const location = useLocation();

  // Hide banner in chat view — screen real-estate is too precious there
  const isChatView = /^\/chat\/[^/]+$/.test(location.pathname);

  const isVisible = !isLoading && status?.isTrialActive && !!status.trialEndsAt && !isChatView;

  // Override --ion-safe-area-top so Ionic headers push down below the banner
  useEffect(() => {
    if (isVisible) {
      document.documentElement.style.setProperty(
        '--ion-safe-area-top',
        'calc(32px + env(safe-area-inset-top, 0px))'
      );
    }
    return () => {
      document.documentElement.style.removeProperty('--ion-safe-area-top');
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const daysLeft = Math.ceil(
    (new Date(status!.trialEndsAt!).getTime() - Date.now()) / 86_400_000
  );

  return (
    <>
      <div className="trial-countdown-banner" onClick={() => showPaywall()}>
        <span className="trial-countdown-text">
          {daysLeft <= 0
            ? t('trial.bannerLastDay')
            : t('trial.bannerUnlocked', { days: daysLeft })}
        </span>
      </div>

      <style>{`
        .trial-countdown-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99998;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-top: env(safe-area-inset-top, 0px);
          min-height: 32px;
          background: hsl(var(--primary) / 0.1);
          cursor: pointer;
          animation: trial-slide-down 0.3s ease-out;
        }

        .trial-countdown-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: hsl(var(--primary));
        }

        @keyframes trial-slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export { TrialBanner };
