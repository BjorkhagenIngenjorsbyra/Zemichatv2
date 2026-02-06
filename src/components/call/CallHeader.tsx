import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon } from '@ionic/react';
import { chevronDown, expandOutline } from 'ionicons/icons';
import { useCallContext } from '../../contexts/CallContext';
import { CallState, CallType } from '../../types/call';

interface CallHeaderProps {
  chatName?: string;
}

const CallHeader: React.FC<CallHeaderProps> = ({ chatName }) => {
  const { t } = useTranslation();
  const { activeCall, callDuration, toggleMinimize } = useCallContext();

  if (!activeCall) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateLabel = (): string => {
    switch (activeCall.state) {
      case CallState.INITIATING:
        return t('call.initiating');
      case CallState.RINGING:
        return t('call.ringing');
      case CallState.CONNECTING:
        return t('call.connecting');
      case CallState.CONNECTED:
        return formatDuration(callDuration);
      case CallState.ENDED:
        return t('call.ended');
      default:
        return '';
    }
  };

  const callTypeLabel = activeCall.callType === CallType.VIDEO
    ? t('call.videoCall')
    : t('call.voiceCall');

  return (
    <div className="call-header">
      <IonButton
        className="minimize-button"
        fill="clear"
        onClick={toggleMinimize}
        aria-label={activeCall.isMinimized ? t('call.expand') : t('call.minimize')}
      >
        <IonIcon icon={activeCall.isMinimized ? expandOutline : chevronDown} />
      </IonButton>

      <div className="call-info">
        <span className="call-name">{chatName || t('call.call')}</span>
        <span className="call-status">
          {callTypeLabel} • {getStateLabel()}
        </span>
      </div>

      <div className="header-spacer" />

      <style>{`
        .call-header {
          display: flex;
          align-items: center;
          padding: 1rem;
          background: hsl(var(--background) / 0.9);
          backdrop-filter: blur(10px);
        }

        .minimize-button {
          --padding-start: 0.5rem;
          --padding-end: 0.5rem;
        }

        .minimize-button ion-icon {
          font-size: 1.5rem;
        }

        .call-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .call-name {
          font-size: 1rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .call-status {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
        }

        .header-spacer {
          width: 44px;
        }
      `}</style>
    </div>
  );
};

export default CallHeader;
