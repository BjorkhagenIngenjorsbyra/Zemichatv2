import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { alertCircle, close } from 'ionicons/icons';
import { hapticHeavy } from '../../utils/haptics';

interface SOSConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const AUTO_CANCEL_SECONDS = 5;

/**
 * Confirmation modal for SOS alerts.
 * Auto-cancels after 5 seconds to prevent accidental triggers.
 */
export const SOSConfirmModal: React.FC<SOSConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(AUTO_CANCEL_SECONDS);

  // Auto-cancel countdown
  useEffect(() => {
    if (!isOpen) {
      setCountdown(AUTO_CANCEL_SECONDS);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onCancel();
          return AUTO_CANCEL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onCancel]);

  const handleConfirm = () => {
    hapticHeavy();
    onConfirm();
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onCancel}
      className="sos-confirm-modal"
    >
      <div className="modal-content">
        <div className="sos-icon-container">
          <IonIcon icon={alertCircle} className="sos-icon" />
        </div>

        <h1 className="modal-title">{t('sos.confirmTitle')}</h1>
        <p className="modal-message">{t('sos.confirmMessage')}</p>

        <div className="countdown">
          <span>{t('common.cancel')} in {countdown}s</span>
        </div>

        <div className="button-container">
          <IonButton
            expand="block"
            color="danger"
            className="confirm-button"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <IonSpinner name="crescent" />
            ) : (
              t('sos.confirmYes')
            )}
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            color="medium"
            className="cancel-button"
            onClick={onCancel}
            disabled={isLoading}
          >
            <IonIcon icon={close} slot="start" />
            {t('sos.confirmNo')}
          </IonButton>
        </div>
      </div>

      <style>{`
        .sos-confirm-modal {
          --background: transparent;
        }

        .sos-confirm-modal::part(content) {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }

        .modal-content {
          background: hsl(var(--background));
          border-radius: 1.5rem;
          padding: 2rem;
          margin: 1rem;
          max-width: 320px;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .sos-icon-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .sos-icon {
          font-size: 4rem;
          color: hsl(var(--destructive));
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin: 0 0 0.5rem 0;
        }

        .modal-message {
          font-size: 0.95rem;
          color: hsl(var(--muted-foreground));
          margin: 0 0 1rem 0;
        }

        .countdown {
          font-size: 0.85rem;
          color: hsl(var(--muted-foreground));
          margin-bottom: 1.5rem;
        }

        .button-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .confirm-button {
          --border-radius: 9999px;
          font-weight: 700;
          font-size: 1.1rem;
          --padding-top: 1rem;
          --padding-bottom: 1rem;
        }

        .cancel-button {
          --border-radius: 9999px;
        }
      `}</style>
    </IonModal>
  );
};

export default SOSConfirmModal;
