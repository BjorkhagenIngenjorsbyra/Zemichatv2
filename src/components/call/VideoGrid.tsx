import { type CallParticipant } from '../../types/call';
import type { IRemoteVideoTrack, ICameraVideoTrack, ILocalVideoTrack } from '../../services/agora';
import VideoTile from './VideoTile';

interface VideoGridProps {
  participants: CallParticipant[];
  localVideoTrack?: ICameraVideoTrack | ILocalVideoTrack | null;
  remoteVideoTracks: Map<string, IRemoteVideoTrack>;
  localUserId: string;
  screenShareTrack?: ILocalVideoTrack | null;
}

const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  localVideoTrack,
  remoteVideoTracks,
  localUserId,
  screenShareTrack,
}) => {
  const remoteParticipants = participants.filter((p) => p.id !== localUserId);
  const localParticipant = participants.find((p) => p.id === localUserId);
  const participantCount = participants.length;

  // Determine grid layout based on participant count
  const getGridClass = (): string => {
    if (screenShareTrack) return 'grid-screen-share';
    if (participantCount === 1) return 'grid-1';
    if (participantCount === 2) return 'grid-2';
    if (participantCount <= 4) return 'grid-4';
    if (participantCount <= 6) return 'grid-6';
    return 'grid-9';
  };

  const getTileSize = (): 'small' | 'medium' | 'large' | 'full' => {
    if (screenShareTrack) return 'medium';
    if (participantCount === 1) return 'full';
    if (participantCount === 2) return 'large';
    return 'medium';
  };

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {/* Screen share view */}
      {screenShareTrack && (
        <div className="screen-share-container">
          <VideoTile
            videoTrack={screenShareTrack}
            displayName="Screen Share"
            isScreenShare
            size="full"
          />
        </div>
      )}

      {/* Main video grid */}
      <div className="participants-grid">
        {remoteParticipants.map((participant) => (
          <VideoTile
            key={participant.id}
            videoTrack={remoteVideoTracks.get(participant.id)}
            displayName={participant.displayName}
            avatarUrl={participant.avatarUrl}
            isMuted={!participant.hasAudio}
            size={getTileSize()}
          />
        ))}

        {/* Local video as main tile when alone */}
        {participantCount === 1 && localParticipant && (
          <VideoTile
            videoTrack={localVideoTrack}
            displayName={localParticipant.displayName}
            avatarUrl={localParticipant.avatarUrl}
            isMuted={!localParticipant.hasAudio}
            isLocal
            size="full"
          />
        )}
      </div>

      {/* Local video PiP when there are other participants */}
      {participantCount > 1 && localParticipant && (
        <VideoTile
          videoTrack={localVideoTrack}
          displayName={localParticipant.displayName}
          avatarUrl={localParticipant.avatarUrl}
          isMuted={!localParticipant.hasAudio}
          isLocal
          size="small"
        />
      )}

      <style>{`
        .video-grid {
          position: relative;
          width: 100%;
          height: 100%;
          background: hsl(var(--background));
        }

        .screen-share-container {
          width: 100%;
          height: calc(100% - 180px);
        }

        .participants-grid {
          display: grid;
          gap: 0.5rem;
          padding: 0.5rem;
          width: 100%;
          height: 100%;
        }

        .grid-screen-share .participants-grid {
          height: 180px;
          display: flex;
          overflow-x: auto;
          padding: 0.5rem;
        }

        .grid-1 .participants-grid {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr;
        }

        .grid-2 .participants-grid {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr;
        }

        .grid-4 .participants-grid {
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(2, 1fr);
        }

        .grid-6 .participants-grid {
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(3, 1fr);
        }

        .grid-9 .participants-grid {
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          overflow-y: auto;
        }

        @media (orientation: landscape) {
          .grid-2 .participants-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: 1fr;
          }

          .grid-6 .participants-grid {
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default VideoGrid;
