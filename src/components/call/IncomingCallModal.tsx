import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon } from '@ionic/react';
import { call, close, videocam } from 'ionicons/icons';
import { useCallContext } from '../../contexts/CallContext';
import { CallType } from '../../types/call';

const IncomingCallModal: React.FC = () => {
  const { t } = useTranslation();
  const { incomingCall, answerCall, declineCall } = useCallContext();

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === CallType.VIDEO;
  const callTypeLabel = isVideo ? t('call.incomingVideoCall') : t('call.incomingVoiceCall');

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-content">
        {/* Caller avatar */}
        <div className="caller-avatar">
          {incomingCall.callerAvatar ? (
            <img src={incomingCall.callerAvatar} alt={incomingCall.callerName} />
          ) : (
            <div className="avatar-placeholder">
              {incomingCall.callerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Caller info */}
        <h2 className="caller-name">{incomingCall.callerName}</h2>
        <p className="call-type">{callTypeLabel}</p>

        {/* Action buttons */}
        <div className="call-actions">
          <IonButton
            className="action-button decline"
            fill="solid"
            color="danger"
            onClick={declineCall}
          >
            <IonIcon icon={close} slot="icon-only" />
          </IonButton>

          <IonButton
            className="action-button answer"
            fill="solid"
            color="success"
            onClick={answerCall}
          >
            <IonIcon icon={isVideo ? videocam : call} slot="icon-only" />
          </IonButton>
        </div>

        {/* Labels */}
        <div className="action-labels">
          <span className="label decline-label">{t('call.decline')}</span>
          <span className="label answer-label">{t('call.answer')}</span>
        </div>
      </div>

      <style>{`
        .incoming-call-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(180deg, hsl(var(--primary) / 0.9), hsl(var(--background)));
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .incoming-call-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          text-align: center;
        }

        .caller-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          overflow: hidden;
          border: 4px solid hsl(var(--primary-foreground) / 0.3);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--primary-foreground) / 0.4);
          }
          50% {
            box-shadow: 0 0 0 20px hsl(var(--primary-foreground) / 0);
          }
        }

        .caller-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary-foreground));
          color: hsl(var(--primary));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: 600;
        }

        .caller-name {
          font-size: 1.75rem;
          font-weight: 600;
          color: hsl(var(--primary-foreground));
          margin: 0;
        }

        .call-type {
          font-size: 1rem;
          color: hsl(var(--primary-foreground) / 0.8);
          margin: 0;
        }

        .call-actions {
          display: flex;
          gap: 3rem;
          margin-top: 2rem;
        }

        .action-button {
          --border-radius: 50%;
          width: 4rem;
          height: 4rem;
        }

        .action-button ion-icon {
          font-size: 1.75rem;
        }

        .action-button.answer {
          --background: hsl(142, 76%, 36%);
        }

        .action-labels {
          display: flex;
          gap: 3rem;
          width: 100%;
          justify-content: center;
        }

        .label {
          width: 4rem;
          text-align: center;
          font-size: 0.875rem;
          color: hsl(var(--primary-foreground) / 0.8);
        }
      `}</style>
    </div>
  );
};

export default IncomingCallModal;
