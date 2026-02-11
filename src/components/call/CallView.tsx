import { useCallContext } from '../../contexts/CallContext';
import { useTranslation } from 'react-i18next';
import { CallType, CallState } from '../../types/call';
import type { ICameraVideoTrack, ILocalVideoTrack, IRemoteVideoTrack } from '../../services/agora';
import { useState } from 'react';
import CallHeader from './CallHeader';
import CallControls from './CallControls';
import VideoGrid from './VideoGrid';

const CallView: React.FC = () => {
  const { t } = useTranslation();
  const { activeCall, callError, isAgoraReady } = useCallContext();

  // Placeholder tracks – in a real implementation, these come from CallContext
  const [localVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [screenShareTrack] = useState<ILocalVideoTrack | null>(null);
  const [remoteVideoTracks] = useState<Map<string, IRemoteVideoTrack>>(new Map());

  if (!activeCall || activeCall.isMinimized) return null;

  const isVideoCall = activeCall.callType === CallType.VIDEO;
  const isConnected = activeCall.state === CallState.CONNECTED;
  const isEnded = activeCall.state === CallState.ENDED;

  // Find the OTHER participant (not self)
  const otherParticipant = activeCall.participants.find(
    (p) => p.id !== activeCall.initiatorId
  );

  const displayName = otherParticipant?.displayName || t('call.call');
  const avatarUrl = otherParticipant?.avatarUrl;
  const initial = displayName.charAt(0).toUpperCase();

  const getStatusText = (): string => {
    if (callError) return t(callError);
    switch (activeCall.state) {
      case CallState.RINGING:
        return t('call.ringing');
      case CallState.CONNECTING:
        return t('call.connecting');
      case CallState.ENDED:
        return t('call.ended');
      default:
        return '';
    }
  };

  return (
    <div className="call-view">
      <CallHeader chatName={displayName} />

      <div className="call-content">
        {isVideoCall && isConnected ? (
          <VideoGrid
            participants={activeCall.participants}
            localVideoTrack={localVideoTrack}
            remoteVideoTracks={remoteVideoTracks}
            localUserId={activeCall.initiatorId}
            screenShareTrack={activeCall.isScreenSharing ? screenShareTrack : null}
          />
        ) : (
          <div className="voice-call-view">
            {/* Main callee display */}
            <div className="callee-display">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="callee-avatar"
                />
              ) : (
                <div className="callee-avatar-placeholder">
                  {initial}
                </div>
              )}
              <span className="callee-name">{displayName}</span>
              {!isConnected && (
                <span className={`callee-status ${isEnded || callError ? 'error' : ''}`}>
                  {getStatusText()}
                </span>
              )}
            </div>

            {/* Connecting animation */}
            {!isConnected && !isEnded && !callError && (
              <div className="connecting-animation">
                <div className="pulse-ring" />
                <div className="pulse-ring delay-1" />
                <div className="pulse-ring delay-2" />
              </div>
            )}
          </div>
        )}
      </div>

      {!isEnded && (
        <CallControls
          showVideoToggle={isVideoCall}
          showScreenShare={isVideoCall}
        />
      )}

      <style>{`
        .call-view {
          position: fixed;
          inset: 0;
          background: hsl(var(--background));
          z-index: 9998;
          display: flex;
          flex-direction: column;
        }

        .call-content {
          flex: 1;
          overflow: hidden;
        }

        .voice-call-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          background: linear-gradient(180deg, hsl(var(--primary) / 0.1), hsl(var(--background)));
          position: relative;
        }

        .callee-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          z-index: 1;
        }

        .callee-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid hsl(var(--primary) / 0.4);
        }

        .callee-avatar-placeholder {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: 600;
          border: 3px solid hsl(var(--primary) / 0.4);
        }

        .callee-name {
          font-size: 1.5rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .callee-status {
          font-size: 1rem;
          color: hsl(var(--muted-foreground));
          animation: statusPulse 1.5s ease-in-out infinite;
        }

        .callee-status.error {
          color: hsl(var(--destructive));
          animation: none;
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .connecting-animation {
          position: absolute;
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid hsl(var(--primary) / 0.3);
          animation: pulse-out 2s infinite;
        }

        .pulse-ring.delay-1 {
          animation-delay: 0.5s;
        }

        .pulse-ring.delay-2 {
          animation-delay: 1s;
        }

        @keyframes pulse-out {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default CallView;
