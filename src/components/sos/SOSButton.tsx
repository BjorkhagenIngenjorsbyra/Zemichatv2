import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { alertCircle } from 'ionicons/icons';
import { SOSConfirmModal } from './SOSConfirmModal';
import { sendSosAlert } from '../../services/sos';

interface SOSButtonProps {
  onAlertSent?: () => void;
  size?: 'small' | 'default' | 'large';
}

/**
 * SOS button for Texters to send emergency alerts.
 * This button CANNOT be disabled - safety is critical.
 */
export const SOSButton: React.FC<SOSButtonProps> = ({
  onAlertSent,
  size = 'default',
}) => {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleConfirm = async () => {
    setIsSending(true);

    const { error } = await sendSosAlert();

    if (error) {
      console.error('Failed to send SOS:', error);
    } else {
      onAlertSent?.();
    }

    setIsSending(false);
    setShowConfirm(false);
  };

  const buttonClass = `sos-button sos-button-${size}`;

  return (
    <>
      <IonButton
        color="danger"
        fill="solid"
        className={buttonClass}
        onClick={() => setShowConfirm(true)}
        disabled={isSending}
      >
        {isSending ? (
          <IonSpinner name="crescent" />
        ) : (
          <>
            <IonIcon icon={alertCircle} slot="start" />
            {t('sos.button')}
          </>
        )}
      </IonButton>

      <SOSConfirmModal
        isOpen={showConfirm}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        isLoading={isSending}
      />

      <style>{`
        .sos-button {
          --border-radius: 9999px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sos-button-small {
          --padding-start: 0.75rem;
          --padding-end: 0.75rem;
          font-size: 0.75rem;
        }

        .sos-button-default {
          --padding-start: 1rem;
          --padding-end: 1rem;
        }

        .sos-button-large {
          --padding-start: 2rem;
          --padding-end: 2rem;
          font-size: 1.25rem;
        }
      `}</style>
    </>
  );
};

export default SOSButton;
