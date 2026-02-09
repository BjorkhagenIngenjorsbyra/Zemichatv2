import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      // Native: use Capacitor Network plugin
      Network.getStatus().then((status) => {
        setIsOffline(!status.connected);
        setShowBanner(!status.connected);
      });

      const listenerPromise = Network.addListener('networkStatusChange', (status) => {
        setIsOffline(!status.connected);
        if (!status.connected) {
          setShowBanner(true);
        } else {
          // Show "back online" briefly, then hide
          setTimeout(() => setShowBanner(false), 2000);
        }
      });

      removeListener = () => {
        listenerPromise.then((l) => l.remove());
      };
    } else {
      // Web: use navigator.onLine
      setIsOffline(!navigator.onLine);
      setShowBanner(!navigator.onLine);

      const handleOnline = () => {
        setIsOffline(false);
        setTimeout(() => setShowBanner(false), 2000);
      };

      const handleOffline = () => {
        setIsOffline(true);
        setShowBanner(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      removeListener = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      removeListener?.();
    };
  }, []);

  if (!showBanner) return null;

  return (
    <>
      <div className={`offline-banner ${isOffline ? 'offline' : 'online'}`}>
        <span className="offline-dot" />
        <span className="offline-text">
          {isOffline ? t('network.offline') : t('network.backOnline')}
        </span>
      </div>

      <style>{`
        .offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.8rem;
          font-weight: 600;
          animation: banner-slide-down 0.3s ease-out;
        }

        .offline-banner.offline {
          background: hsl(0 72% 65%);
          color: #fff;
        }

        .offline-banner.online {
          background: hsl(142 76% 36%);
          color: #fff;
          animation: banner-slide-down 0.3s ease-out;
        }

        .offline-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.8;
        }

        .offline-banner.offline .offline-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        @keyframes banner-slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default OfflineBanner;
