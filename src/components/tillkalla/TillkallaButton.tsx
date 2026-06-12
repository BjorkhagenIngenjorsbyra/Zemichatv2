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
 * A soft danger pill with icon + label (Fable round-3 flagged the old icon-only
 * red circle as mistakable for an avatar; Erik picked the calm-pill variant).
 * The countdown confirm dialog still guards against accidental taps.
 * Texter-only; lives only inside chats.
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
        fill="outline"
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
          <>
            <IonIcon icon={handLeftOutline} slot="start" />
            {t('tillkalla.button')}
          </>
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
          --background: hsl(var(--destructive) / 0.12);
          --background-hover: hsl(var(--destructive) / 0.2);
          --background-activated: hsl(var(--destructive) / 0.25);
          --border-width: 1px;
          font-weight: 700;
          text-transform: none;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        .tillkalla-button ion-icon {
          margin-inline-end: 0.35rem;
          font-size: 1.05em;
        }

        .tillkalla-button-small {
          --padding-start: 0.7rem;
          --padding-end: 0.85rem;
          font-size: 0.78rem;
        }

        .tillkalla-button-default {
          --padding-start: 0.9rem;
          --padding-end: 1.1rem;
          font-size: 0.9rem;
        }

        .tillkalla-button-large {
          --padding-start: 1.5rem;
          --padding-end: 1.75rem;
          font-size: 1.1rem;
        }
      `}</style>
    </>
  );
};

export default TillkallaButton;
