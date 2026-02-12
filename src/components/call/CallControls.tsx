import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon } from '@ionic/react';
import {
  mic,
  micOff,
  videocam,
  videocamOff,
  desktop,
  call as callIcon,
} from 'ionicons/icons';
import { useCallContext } from '../../contexts/CallContext';
import { CallType } from '../../types/call';

interface CallControlsProps {
  showVideoToggle?: boolean;
  showScreenShare?: boolean;
}

const CallControls: React.FC<CallControlsProps> = ({
  showVideoToggle = true,
  showScreenShare = true,
}) => {
  const { t } = useTranslation();
  const {
    activeCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    endCall,
  } = useCallContext();

  if (!activeCall) return null;

  return (
    <div className="call-controls">
      {/* Mute button */}
      <IonButton
        className={`control-button ${activeCall.isMuted ? 'active' : ''}`}
        fill="clear"
        onClick={toggleMute}
        aria-label={activeCall.isMuted ? t('call.unmute') : t('call.mute')}
      >
        <IonIcon icon={activeCall.isMuted ? micOff : mic} />
      </IonButton>

      {/* Video toggle button (for video calls) */}
      {showVideoToggle && activeCall.callType === CallType.VIDEO && (
        <IonButton
          className={`control-button ${!activeCall.isVideoEnabled ? 'active' : ''}`}
          fill="clear"
          onClick={toggleVideo}
          aria-label={activeCall.isVideoEnabled ? t('call.videoOff') : t('call.videoOn')}
        >
          <IonIcon icon={activeCall.isVideoEnabled ? videocam : videocamOff} />
        </IonButton>
      )}

      {/* Screen share button (for video calls) */}
      {showScreenShare && activeCall.callType === CallType.VIDEO && (
        <IonButton
          className={`control-button ${activeCall.isScreenSharing ? 'active' : ''}`}
          fill="clear"
          onClick={toggleScreenShare}
          aria-label={activeCall.isScreenSharing ? t('call.stopShare') : t('call.shareScreen')}
        >
          <IonIcon icon={desktop} />
        </IonButton>
      )}

      {/* End call button */}
      <IonButton
        className="control-button end-call"
        fill="solid"
        color="danger"
        onClick={endCall}
        aria-label={t('call.endCall')}
      >
        <IonIcon icon={callIcon} className="rotate-135" />
      </IonButton>

      <style>{`
        .call-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
          background: hsl(var(--background) / 0.9);
          backdrop-filter: blur(10px);
        }

        .control-button {
          --border-radius: 50%;
          --padding-start: 1rem;
          --padding-end: 1rem;
          width: 3.5rem;
          height: 3.5rem;
          background: hsl(var(--card));
          border-radius: 50%;
        }

        .control-button ion-icon {
          font-size: 1.5rem;
        }

        .control-button.active {
          background: hsl(var(--muted));
        }

        .control-button.end-call {
          background: hsl(var(--destructive));
          --background: hsl(var(--destructive));
        }

        .control-button.end-call ion-icon {
          color: hsl(var(--destructive-foreground));
        }

        .rotate-135 {
          transform: rotate(135deg);
        }
      `}</style>
    </div>
  );
};

export default CallControls;
