import { useEffect, useRef } from 'react';
import type { IRemoteVideoTrack, ICameraVideoTrack, ILocalVideoTrack } from '../../services/agora';

interface VideoTileProps {
  videoTrack?: IRemoteVideoTrack | ICameraVideoTrack | ILocalVideoTrack | null;
  displayName: string;
  avatarUrl?: string;
  isMuted?: boolean;
  isLocal?: boolean;
  isScreenShare?: boolean;
  size?: 'small' | 'medium' | 'large' | 'full';
}

const VideoTile: React.FC<VideoTileProps> = ({
  videoTrack,
  displayName,
  avatarUrl,
  isMuted = false,
  isLocal = false,
  isScreenShare = false,
  size = 'medium',
}) => {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.play(videoRef.current);

      return () => {
        videoTrack.stop();
      };
    }
  }, [videoTrack]);

  const hasVideo = !!videoTrack;

  return (
    <div className={`video-tile ${size} ${isLocal ? 'local' : ''} ${isScreenShare ? 'screen-share' : ''}`}>
      {hasVideo ? (
        <div ref={videoRef} className="video-container" />
      ) : (
        <div className="avatar-container">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="avatar" />
          ) : (
            <div className="avatar-placeholder">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="tile-overlay">
        <span className="display-name">
          {displayName}
          {isMuted && <span className="muted-indicator">🔇</span>}
        </span>
      </div>

      <style>{`
        .video-tile {
          position: relative;
          background: hsl(var(--card));
          border-radius: 0.75rem;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .video-tile.small {
          width: 120px;
          height: 160px;
        }

        .video-tile.medium {
          width: 200px;
          height: 270px;
        }

        .video-tile.large {
          width: 100%;
          height: 300px;
        }

        .video-tile.full {
          width: 100%;
          height: 100%;
        }

        .video-tile.local {
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
          border: 2px solid hsl(var(--primary));
          box-shadow: 0 4px 12px hsl(var(--background) / 0.3);
        }

        .video-tile.local.small {
          width: 100px;
          height: 133px;
        }

        .video-tile.screen-share {
          border-radius: 0;
        }

        .video-container {
          width: 100%;
          height: 100%;
        }

        .video-container video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-tile.local .video-container video {
          transform: scaleX(-1);
        }

        .avatar-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.1));
        }

        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
        }

        .video-tile.small .avatar {
          width: 50px;
          height: 50px;
        }

        .avatar-placeholder {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 600;
        }

        .video-tile.small .avatar-placeholder {
          width: 50px;
          height: 50px;
          font-size: 1.25rem;
        }

        .tile-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0.5rem;
          background: linear-gradient(transparent, hsl(var(--background) / 0.7));
        }

        .display-name {
          font-size: 0.75rem;
          color: hsl(var(--foreground));
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .muted-indicator {
          font-size: 0.625rem;
        }
      `}</style>
    </div>
  );
};

export default VideoTile;
