import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

const TrialBanner: React.FC = () => {
  const { t } = useTranslation();
  const { status, isLoading, showPaywall } = useSubscription();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('trial-banner-dismissed') === 'true');

  // Only show banner on main tabs (not in chat view, dashboard, or sub-pages)
  const isMainTab = ['/chats', '/wall', '/friends', '/calls', '/settings'].includes(location.pathname);

  const daysLeft = status?.trialEndsAt
    ? Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / 86_400_000)
    : 99;

  // Show banner only on main tabs, and always if 3 days or fewer remain
  const isVisible = !isLoading && status?.isTrialActive && !!status.trialEndsAt && isMainTab
    && (!dismissed || daysLeft <= 3);

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

  return (
    <>
      <div className="trial-countdown-banner">
        <span className="trial-countdown-text" onClick={() => showPaywall()}>
          {daysLeft <= 0
            ? t('trial.bannerLastDay')
            : t('trial.bannerUnlocked', { days: daysLeft })}
        </span>
        <button
          className="trial-dismiss-btn"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
            localStorage.setItem('trial-banner-dismissed', 'true');
          }}
          aria-label="Stäng"
        >
          ✕
        </button>
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
          cursor: pointer;
        }

        .trial-dismiss-btn {
          background: none;
          border: none;
          color: hsl(var(--primary) / 0.6);
          font-size: 0.75rem;
          padding: 0 8px;
          cursor: pointer;
          line-height: 1;
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
