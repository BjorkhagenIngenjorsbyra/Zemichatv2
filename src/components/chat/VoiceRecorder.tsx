import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon, IonSpinner } from '@ionic/react';
import { mic, close, send } from 'ionicons/icons';

interface VoiceRecorderProps {
  onRecord: (blob: Blob, duration: number, mimeType: string) => Promise<void>;
  disabled?: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecord,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('audio/webm');

  // Update duration while recording
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (isRecording) {
      intervalId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRecording]);

  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  };

  const startRecording = useCallback(async () => {
    if (disabled || isRecording) return;

    setIsPreparing(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const recordingDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        setRecordedBlob(blob);
        setRecordedDuration(recordingDuration);
        setRecordedMimeType(mimeType.split(';')[0]);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
    } finally {
      setIsPreparing(false);
    }
  }, [disabled, isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordedDuration(0);
    setDuration(0);
  }, [isRecording]);

  const sendRecording = useCallback(async () => {
    if (!recordedBlob) return;

    setIsSending(true);
    try {
      await onRecord(recordedBlob, recordedDuration, recordedMimeType);
      setRecordedBlob(null);
      setRecordedDuration(0);
    } catch (error) {
      console.error('Failed to send recording:', error);
    } finally {
      setIsSending(false);
    }
  }, [recordedBlob, recordedDuration, recordedMimeType, onRecord]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show recorded preview
  if (recordedBlob) {
    return (
      <div className="voice-recorded">
        <button
          className="cancel-button"
          onClick={cancelRecording}
          disabled={isSending}
          aria-label="Cancel"
        >
          <IonIcon icon={close} />
        </button>

        <div className="recorded-info">
          <div className="recorded-indicator" />
          <span className="recorded-duration">{formatDuration(recordedDuration)}</span>
        </div>

        <button
          className="send-recording-button"
          onClick={sendRecording}
          disabled={isSending}
          aria-label="Send voice message"
        >
          {isSending ? (
            <IonSpinner name="crescent" />
          ) : (
            <IonIcon icon={send} />
          )}
        </button>

        <style>{`
          .voice-recorded {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem;
            background: hsl(var(--card));
            border-radius: 1.5rem;
            border: 1px solid hsl(var(--border));
          }

          .cancel-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            border-radius: 50%;
            background: hsl(var(--destructive) / 0.1);
            color: hsl(var(--destructive));
            border: none;
            cursor: pointer;
          }

          .cancel-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .recorded-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
          }

          .recorded-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: hsl(var(--primary));
          }

          .recorded-duration {
            font-size: 0.9rem;
            font-weight: 500;
            color: hsl(var(--foreground));
          }

          .send-recording-button {
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
          }

          .send-recording-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    );
  }

  // Show recording state
  if (isRecording) {
    return (
      <div className="voice-recording">
        <button
          className="cancel-button"
          onClick={cancelRecording}
          aria-label={t('chat.slideToCancel')}
        >
          <IonIcon icon={close} />
        </button>

        <div className="recording-info">
          <div className="recording-indicator" />
          <span className="recording-duration">{formatDuration(duration)}</span>
        </div>

        <button
          className="stop-button"
          onClick={stopRecording}
          aria-label={t('chat.releaseToSend')}
        >
          <IonIcon icon={send} />
        </button>

        <style>{`
          .voice-recording {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem;
            background: hsl(var(--destructive) / 0.1);
            border-radius: 1.5rem;
            animation: pulse 1s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }

          .cancel-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            border-radius: 50%;
            background: hsl(var(--muted) / 0.3);
            color: hsl(var(--foreground));
            border: none;
            cursor: pointer;
          }

          .recording-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
          }

          .recording-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: hsl(var(--destructive));
            animation: blink 1s infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }

          .recording-duration {
            font-size: 0.9rem;
            font-weight: 500;
            color: hsl(var(--destructive));
          }

          .stop-button {
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
          }
        `}</style>
      </div>
    );
  }

  // Show mic button
  return (
    <button
      className="mic-button"
      onClick={startRecording}
      disabled={disabled || isPreparing}
      aria-label={t('chat.holdToRecord')}
    >
      {isPreparing ? (
        <IonSpinner name="crescent" />
      ) : (
        <IonIcon icon={mic} />
      )}

      <style>{`
        .mic-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          min-width: 2.25rem;
          border-radius: 50%;
          background: transparent;
          color: #9CA3AF;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 1.35rem;
          flex-shrink: 0;
        }

        .mic-button:hover:not(:disabled) {
          color: hsl(var(--foreground));
        }

        .mic-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </button>
  );
};

export default VoiceRecorder;
