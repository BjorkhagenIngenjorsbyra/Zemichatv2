import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonButton, IonIcon } from '@ionic/react';
import { expand, call as callIcon } from 'ionicons/icons';
import { useCallContext } from '../../contexts/CallContext';
import { CallType, CallState } from '../../types/call';

const CallPiP: React.FC = () => {
  const { t } = useTranslation();
  const { activeCall, callDuration, toggleMinimize, endCall } = useCallContext();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 100 });

  if (!activeCall || !activeCall.isMinimized) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isConnected = activeCall.state === CallState.CONNECTED;
  const isVideo = activeCall.callType === CallType.VIDEO;

  // Get other participant(s) for display
  const otherParticipants = activeCall.participants.slice(1);
  const displayName = otherParticipants.length > 0
    ? otherParticipants[0].displayName
    : t('call.call');

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const pipWidth = 140;
    const pipHeight = 100;

    const newX = Math.max(8, Math.min(windowWidth - pipWidth - 8, touch.clientX - pipWidth / 2));
    const newY = Math.max(8, Math.min(windowHeight - pipHeight - 8, touch.clientY - pipHeight / 2));

    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`call-pip ${isDragging ? 'dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => !isDragging && toggleMinimize()}
    >
      {/* Video preview or avatar */}
      <div className="pip-content">
        {otherParticipants.length > 0 && (
          otherParticipants[0].avatarUrl ? (
            <img
              src={otherParticipants[0].avatarUrl}
              alt={displayName}
              className="pip-avatar"
            />
          ) : (
            <div className="pip-avatar-placeholder">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )
        )}

        {/* Call info overlay */}
        <div className="pip-overlay">
          <span className="pip-name">{displayName}</span>
          <span className="pip-status">
            {isConnected ? formatDuration(callDuration) : t('call.connecting')}
          </span>
        </div>

        {/* Quick actions */}
        <div className="pip-actions">
          <IonButton
            className="pip-action expand"
            fill="clear"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize();
            }}
            aria-label={t('call.expand')}
          >
            <IonIcon icon={expand} />
          </IonButton>

          <IonButton
            className="pip-action end"
            fill="clear"
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            aria-label={t('call.endCall')}
          >
            <IonIcon icon={callIcon} className="rotate-135" />
          </IonButton>
        </div>
      </div>

      <style>{`
        .call-pip {
          position: fixed;
          z-index: 9997;
          width: 140px;
          height: 100px;
          border-radius: 0.75rem;
          overflow: hidden;
          box-shadow: 0 4px 20px hsl(var(--background) / 0.5);
          background: hsl(var(--card));
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .call-pip.dragging {
          transform: scale(1.05);
          box-shadow: 0 8px 30px hsl(var(--background) / 0.6);
          cursor: grabbing;
        }

        .pip-content {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.1));
        }

        .pip-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
        }

        .pip-avatar-placeholder {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .pip-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0.25rem 0.5rem;
          background: linear-gradient(transparent, hsl(var(--background) / 0.8));
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .pip-name {
          font-size: 0.625rem;
          font-weight: 500;
          color: hsl(var(--foreground));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .pip-status {
          font-size: 0.6rem;
          color: hsl(var(--foreground) / 0.7);
        }

        .pip-actions {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .call-pip:hover .pip-actions {
          opacity: 1;
        }

        .pip-action {
          --padding-start: 0.25rem;
          --padding-end: 0.25rem;
          width: 24px;
          height: 24px;
          min-height: 24px;
        }

        .pip-action ion-icon {
          font-size: 0.875rem;
          color: hsl(var(--foreground));
        }

        .pip-action.end ion-icon {
          color: hsl(var(--destructive));
        }

        .rotate-135 {
          transform: rotate(135deg);
        }
      `}</style>
    </div>
  );
};

export default CallPiP;
