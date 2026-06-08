import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { handLeftOutline } from 'ionicons/icons';
import { TillkallaConfirmModal } from './TillkallaConfirmModal';
import { sendTillkalla } from '../../services/tillkalla';

interface TillkallaButtonProps {
  onAlertSent?: () => void;
  size?: 'small' | 'default' | 'large';
}

/**
 * "Tillkalla Vuxen" button for Texters — summons an adult from within a chat.
 * Icon-only (symbol), no text label. Texter-only; lives only inside chats.
 */
export const TillkallaButton: React.FC<TillkallaButtonProps> = ({
  onAlertSent,
  size = 'default',
}) => {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleConfirm = async () => {
    setIsSending(true);

    const { error } = await sendTillkalla();

    if (error) {
      console.error('Failed to send Tillkalla Vuxen alert:', error);
    } else {
      onAlertSent?.();
    }

    setIsSending(false);
    setShowConfirm(false);
  };

  const buttonClass = `tillkalla-button tillkalla-button-${size}`;

  return (
    <>
      <IonButton
        color="danger"
        fill="solid"
        className={buttonClass}
        onClick={() => setShowConfirm(true)}
        disabled={isSending}
        aria-label={t('tillkalla.button')}
        title={t('tillkalla.button')}
        data-testid="tillkalla-button"
      >
        {isSending ? (
          <IonSpinner name="crescent" />
        ) : (
          <IonIcon icon={handLeftOutline} />
        )}
      </IonButton>

      <TillkallaConfirmModal
        isOpen={showConfirm}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        isLoading={isSending}
      />

      <style>{`
        .tillkalla-button {
          --border-radius: 9999px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .tillkalla-button-small {
          --padding-start: 0.75rem;
          --padding-end: 0.75rem;
          font-size: 0.75rem;
        }

        .tillkalla-button-default {
          --padding-start: 1rem;
          --padding-end: 1rem;
        }

        .tillkalla-button-large {
          --padding-start: 2rem;
          --padding-end: 2rem;
          font-size: 1.25rem;
        }
      `}</style>
    </>
  );
};

export default TillkallaButton;
