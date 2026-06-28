import { useEffect, useRef, memo } from 'react';
import type { IRemoteVideoTrack, ICameraVideoTrack, ILocalVideoTrack } from '../../services/agora';
import './VideoTile.css';

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
    </div>
  );
};

export default memo(VideoTile);
