import { useState, useRef, useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import { play, pause } from 'ionicons/icons';

interface VoiceMessageProps {
  mediaUrl: string | null;
  mediaMetadata?: Record<string, unknown> | null;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({
  mediaUrl,
  mediaMetadata,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const metadata = mediaMetadata as {
    duration?: number;
  } | null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || metadata?.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // Set initial duration from metadata if available
    if (metadata?.duration) {
      setDuration(metadata.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [metadata?.duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const togglePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];

    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!mediaUrl) {
    return (
      <div className="voice-error">
        <span>Voice message unavailable</span>
      </div>
    );
  }

  return (
    <div className="voice-message">
      <audio ref={audioRef} src={mediaUrl} preload="metadata" />

      <button
        className="play-button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <IonIcon icon={isPlaying ? pause : play} />
      </button>

      <div className="voice-controls">
        <div className="progress-container">
          <input
            type="range"
            className="progress-slider"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            style={{
              background: `linear-gradient(to right, currentColor ${progress}%, hsl(var(--muted) / 0.3) ${progress}%)`,
            }}
          />
        </div>

        <div className="time-row">
          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button
            className="rate-button"
            onClick={togglePlaybackRate}
            aria-label={`Playback speed: ${playbackRate}x`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      <style>{`
        .voice-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 200px;
          padding: 0.25rem 0;
        }

        .play-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border: none;
          cursor: pointer;
          flex-shrink: 0;
          font-size: 1.25rem;
        }

        .message-bubble.own .play-button {
          background: hsl(var(--primary-foreground));
          color: hsl(var(--primary));
        }

        .play-button:active {
          transform: scale(0.95);
        }

        .voice-controls {
          flex: 1;
          min-width: 0;
        }

        .progress-container {
          width: 100%;
          padding: 0.25rem 0;
        }

        .progress-slider {
          width: 100%;
          height: 4px;
          appearance: none;
          border-radius: 2px;
          cursor: pointer;
        }

        .progress-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
        }

        .progress-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          border: none;
        }

        .time-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.25rem;
        }

        .time-display {
          font-size: 0.75rem;
          opacity: 0.85;
        }

        .rate-button {
          font-size: 0.7rem;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          background: hsl(var(--muted) / 0.3);
          border: none;
          cursor: pointer;
          color: inherit;
          opacity: 0.85;
        }

        .rate-button:hover {
          opacity: 1;
        }

        .voice-error {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 50px;
          color: hsl(var(--muted-foreground));
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
};

export default VoiceMessage;
