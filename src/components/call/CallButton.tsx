import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { call, videocam } from 'ionicons/icons';
import { useCallContext } from '../../contexts/CallContext';
import { CallType } from '../../types/call';

interface CallButtonProps {
  chatId: string;
  type: 'voice' | 'video';
  disabled?: boolean;
}

const CallButton: React.FC<CallButtonProps> = ({ chatId, type, disabled = false }) => {
  const { t } = useTranslation();
  const { initiateCall, activeCall } = useCallContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading || activeCall) return;

    setIsLoading(true);
    try {
      await initiateCall(chatId, type === 'video' ? CallType.VIDEO : CallType.VOICE);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = disabled || isLoading || !!activeCall;
  const icon = type === 'video' ? videocam : call;
  const label = type === 'video' ? t('call.videoCall') : t('call.voiceCall');

  return (
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
    </IonButton>
  );
};

export default CallButton;
