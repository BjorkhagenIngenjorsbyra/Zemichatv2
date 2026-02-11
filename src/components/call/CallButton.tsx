import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon, IonSpinner, IonToast } from '@ionic/react';
import { call, videocam } from 'ionicons/icons';
import { useCallContext } from '../../contexts/CallContext';
import { CallType } from '../../types/call';

interface CallButtonProps {
  chatId: string;
  type: 'voice' | 'video';
  disabled?: boolean;
  hidden?: boolean;
}

const CallButton: React.FC<CallButtonProps> = ({ chatId, type, disabled = false, hidden = false }) => {
  const { t } = useTranslation();
  const { initiateCall, activeCall, callError, clearCallError } = useCallContext();
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (callError && !activeCall) {
      setShowToast(true);
    }
  }, [callError, activeCall]);

  if (hidden) return null;

  const handleClick = async () => {
    if (isLoading || activeCall) return;

    setIsLoading(true);
    try {
      await initiateCall(chatId, type === 'video' ? CallType.VIDEO : CallType.VOICE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToastDismiss = () => {
    setShowToast(false);
    clearCallError();
  };

  const isDisabled = disabled || isLoading || !!activeCall;
  const icon = type === 'video' ? videocam : call;
  const label = type === 'video' ? t('call.videoCall') : t('call.voiceCall');

  return (
    <>
      <IonButton
        fill="clear"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        className="call-button"
      >
        {isLoading ? (
          <IonSpinner name="crescent" />
        ) : (
          <IonIcon icon={icon} />
        )}
      </IonButton>

      <IonToast
        isOpen={showToast}
        onDidDismiss={handleToastDismiss}
        message={callError ? t(callError) : ''}
        duration={3000}
        position="top"
        color="danger"
      />

      <style>{`
        .call-button {
          --padding-start: 8px;
          --padding-end: 8px;
        }

        .call-button ion-icon {
          font-size: 1.25rem;
        }

        .call-button ion-spinner {
          width: 1.25rem;
          height: 1.25rem;
        }
      `}</style>
    </>
  );
};

export default CallButton;
