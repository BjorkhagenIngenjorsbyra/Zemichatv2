import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon } from '@ionic/react';
import { call, videocam, callOutline, videocamOutline } from 'ionicons/icons';
import { type Message } from '../../types/database';

interface CallLogMessageProps {
  message: Message;
  isOwn: boolean;
  onCallBack?: (callType: 'voice' | 'video') => void;
}

const CallLogMessage: React.FC<CallLogMessageProps> = ({
  message,
  isOwn,
  onCallBack,
}) => {
  const { t } = useTranslation();

  // Parse call info from message content and metadata
  const metadata = message.media_metadata as {
    call_log_id?: string;
    call_type?: string;
    call_status?: string;
    duration_seconds?: number;
  } | null;

  const content = message.content || '';
  const isVideo = content.includes('video') || metadata?.call_type === 'video';
  const isMissed = content.includes('missed') || metadata?.call_status === 'missed';
  const isDeclined = content.includes('declined') || metadata?.call_status === 'declined';
  const isEnded = content.includes('ended') || metadata?.call_status === 'answered';

  // Extract duration if present
  const durationMatch = content.match(/\|(\d+:\d+|\d+s)/);
  const duration = durationMatch ? durationMatch[1] : null;

  const getIcon = () => {
    if (isMissed || isDeclined) {
      return isVideo ? videocamOutline : callOutline;
    }
    return isVideo ? videocam : call;
  };

  const getLabel = () => {
    if (isMissed) {
      return isVideo ? t('call.missedVideoCall') : t('call.missedVoiceCall');
    }
    if (isDeclined) {
      return isVideo ? t('call.declinedVideoCall') : t('call.declinedVoiceCall');
    }
    if (isEnded && duration) {
      return isVideo
        ? t('call.videoCallEnded', { duration })
        : t('call.voiceCallEnded', { duration });
    }
    return isVideo ? t('call.videoCall') : t('call.voiceCall');
  };

  const getStatusClass = () => {
    if (isMissed) return 'missed';
    if (isDeclined) return 'declined';
    return 'completed';
  };

  const handleCallBack = () => {
    if (onCallBack) {
      onCallBack(isVideo ? 'video' : 'voice');
    }
  };

  return (
    <div className={`call-log-message ${isOwn ? 'own' : 'other'} ${getStatusClass()}`}>
      <div className="call-icon-container">
        <IonIcon icon={getIcon()} className="call-icon" />
      </div>

      <div className="call-info">
        <span className="call-label">{getLabel()}</span>
        {duration && <span className="call-duration">{duration}</span>}
      </div>

      {(isMissed || isDeclined) && onCallBack && (
        <IonButton
          className="callback-button"
          fill="clear"
          size="small"
          onClick={handleCallBack}
          aria-label={t('call.callBack')}
        >
          <IonIcon icon={isVideo ? videocam : call} />
        </IonButton>
      )}

      <style>{`
        .call-log-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          max-width: 80%;
        }

        .call-log-message.own {
          background: hsl(var(--primary) / 0.1);
          margin-left: auto;
        }

        .call-log-message.other {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
        }

        .call-log-message.missed .call-icon-container,
        .call-log-message.declined .call-icon-container {
          background: hsl(var(--destructive) / 0.1);
        }

        .call-log-message.missed .call-icon,
        .call-log-message.declined .call-icon {
          color: hsl(var(--destructive));
        }

        .call-log-message.completed .call-icon-container {
          background: hsl(var(--primary) / 0.1);
        }

        .call-log-message.completed .call-icon {
          color: hsl(var(--primary));
        }

        .call-icon-container {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .call-icon {
          font-size: 1.25rem;
        }

        .call-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .call-label {
          font-size: 0.875rem;
          color: hsl(var(--foreground));
        }

        .call-duration {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .callback-button {
          --padding-start: 0.5rem;
          --padding-end: 0.5rem;
        }

        .callback-button ion-icon {
          font-size: 1.25rem;
          color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};

export default CallLogMessage;
