import { useEffect, useRef, useState } from 'react';
import { useCallContext } from '../../contexts/CallContext';
import { CallType, CallState } from '../../types/call';
import type { ICameraVideoTrack, ILocalVideoTrack, IRemoteVideoTrack } from '../../services/agora';
import CallHeader from './CallHeader';
import CallControls from './CallControls';
import VideoGrid from './VideoGrid';
import VideoTile from './VideoTile';

interface CallViewProps {
  chatName?: string;
}

const CallView: React.FC<CallViewProps> = ({ chatName }) => {
  const { activeCall, isAgoraReady } = useCallContext();

  // For now, we'll use placeholder state for tracks
  // In a real implementation, these would come from CallContext
  const [localVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [screenShareTrack] = useState<ILocalVideoTrack | null>(null);
  const [remoteVideoTracks] = useState<Map<string, IRemoteVideoTrack>>(new Map());

  if (!activeCall || activeCall.isMinimized) return null;

  const isVideoCall = activeCall.callType === CallType.VIDEO;
  const isConnected = activeCall.state === CallState.CONNECTED;
  const localParticipant = activeCall.participants.find((p) => p.id === activeCall.initiatorId);

  return (
    <div className="call-view">
      <CallHeader chatName={chatName} />

      <div className="call-content">
        {isVideoCall ? (
          <VideoGrid
            participants={activeCall.participants}
            localVideoTrack={localVideoTrack}
            remoteVideoTracks={remoteVideoTracks}
            localUserId={localParticipant?.id || ''}
            screenShareTrack={activeCall.isScreenSharing ? screenShareTrack : null}
          />
        ) : (
          <div className="voice-call-view">
            {/* Show participant avatars for voice calls */}
            <div className="voice-participants">
              {activeCall.participants.map((participant) => (
                <div key={participant.id} className="voice-participant">
                  {participant.avatarUrl ? (
                    <img
                      src={participant.avatarUrl}
                      alt={participant.displayName}
                      className="participant-avatar"
                    />
                  ) : (
                    <div className="participant-avatar-placeholder">
                      {participant.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="participant-name">{participant.displayName}</span>
                  {!participant.hasAudio && (
                    <span className="muted-badge">🔇</span>
                  )}
                </div>
              ))}
            </div>

            {/* Connecting animation */}
            {!isConnected && (
              <div className="connecting-animation">
                <div className="pulse-ring" />
                <div className="pulse-ring delay-1" />
                <div className="pulse-ring delay-2" />
              </div>
            )}
          </div>
        )}
      </div>

      <CallControls
        showVideoToggle={isVideoCall}
        showScreenShare={isVideoCall}
      />

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

        .voice-participants {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2rem;
          z-index: 1;
        }

        .voice-participant {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .participant-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid hsl(var(--primary) / 0.3);
        }

        .participant-avatar-placeholder {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          font-weight: 600;
          border: 3px solid hsl(var(--primary) / 0.3);
        }

        .participant-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: hsl(var(--foreground));
        }

        .muted-badge {
          font-size: 0.75rem;
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
