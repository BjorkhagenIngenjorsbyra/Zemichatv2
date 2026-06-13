import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon } from '@ionic/react';
import { play, pause } from 'ionicons/icons';
import { useSignedMediaUrl } from '../../hooks/useSignedMediaUrl';
import { formatSeconds } from '../../utils/datetime';
import './VoiceMessage.css';

interface VoiceMessageProps {
  /** Storage path (preferred) or legacy public URL. */
  mediaUrl: string | null;
  mediaMetadata?: Record<string, unknown> | null;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({
  mediaUrl,
  mediaMetadata,
}) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  // chat-media is a private bucket — resolve path to signed URL (audit fix #18).
  const resolvedUrl = useSignedMediaUrl(mediaUrl);

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
      // Chrome's MediaRecorder webm blobs carry no duration header, so
      // audio.duration is Infinity here (and Infinity is truthy, so a plain
      // `||` fallback doesn't catch it). Prefer the duration captured at record
      // time; only fall back to audio.duration when it is finite.
      const audioDur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(metadata?.duration || audioDur);
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
      // play() rejects if the media can't start (autoplay policy, decode error,
      // src not ready) — catch it so it isn't an unhandled rejection and the UI
      // doesn't get stuck showing a "playing" state.
      audio.play().catch((err) => {
        console.error('[VoiceMessage] play failed:', err);
        setIsPlaying(false);
      });
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
      <audio ref={audioRef} src={resolvedUrl || undefined} preload="metadata" />

      <button
        className="play-button"
        onClick={togglePlay}
        aria-label={isPlaying ? t('a11y.pauseVoice') : t('a11y.playVoice')}
      >
        <IonIcon icon={isPlaying ? pause : play} />
      </button>

      <div className="voice-controls">
        <div className="progress-container">
          <input
            type="range"
            className="progress-slider"
            aria-label={t('a11y.seek')}
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
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </span>
          <button
            className="rate-button"
            onClick={togglePlaybackRate}
            aria-label={t('a11y.playbackSpeed', { rate: playbackRate })}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;
