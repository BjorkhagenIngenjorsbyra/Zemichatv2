import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon, IonButton, IonSpinner } from '@ionic/react';
import { image, document as documentIcon, close, send, camera } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface MediaPickerProps {
  onImageSelect: (file: File, caption?: string) => Promise<void>;
  onDocumentSelect: (file: File) => Promise<void>;
  disabled?: boolean;
}

const MediaPicker: React.FC<MediaPickerProps> = ({
  onImageSelect,
  onDocumentSelect,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Pinch-to-zoom state for preview
  const [previewScale, setPreviewScale] = useState(1);
  const [previewTranslate, setPreviewTranslate] = useState({ x: 0, y: 0 });
  const lastDistRef = useRef(0);
  const isPinchingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleDocumentClick = () => {
    documentInputRef.current?.click();
  };

  const handleCameraClick = async () => {
    setIsOpen(false);

    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          allowEditing: false,
        });

        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const ext = photo.format || 'jpeg';
          const file = new File([blob], `camera_${Date.now()}.${ext}`, {
            type: `image/${ext}`,
          });

          setPreviewFile(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      } else {
        // Web fallback: open file picker with camera preference
        const input = window.document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            setPreviewFile(file);
            setPreviewUrl(URL.createObjectURL(file));
          }
        };
        input.click();
      }
    } catch (err) {
      // User cancelled or permission denied
      console.log('Camera cancelled:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsOpen(false);
    }
    e.target.value = '';
  };

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsSending(true);
      try {
        await onDocumentSelect(file);
      } finally {
        setIsSending(false);
        setIsOpen(false);
      }
    }
    e.target.value = '';
  };

  const handleSendImage = async () => {
    if (!previewFile) return;

    setIsSending(true);
    try {
      await onImageSelect(previewFile, caption.trim() || undefined);
      clearPreview();
    } finally {
      setIsSending(false);
    }
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setCaption('');
    resetPreviewZoom();
  };

  const resetPreviewZoom = () => {
    setPreviewScale(1);
    setPreviewTranslate({ x: 0, y: 0 });
  };

  // --- Touch handlers for preview pinch-zoom ---
  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && previewScale > 1) {
      isPanningRef.current = true;
      lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (lastDistRef.current > 0) {
        const newScale = Math.max(1, Math.min(4, previewScale * (dist / lastDistRef.current)));
        setPreviewScale(newScale);
        if (newScale <= 1) setPreviewTranslate({ x: 0, y: 0 });
      }
      lastDistRef.current = dist;
    } else if (e.touches.length === 1 && isPanningRef.current && previewScale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - lastPanRef.current.x;
      const dy = e.touches[0].clientY - lastPanRef.current.y;
      setPreviewTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handlePreviewTouchEnd = () => {
    isPinchingRef.current = false;
    isPanningRef.current = false;
    lastDistRef.current = 0;

    if (previewScale < 1.1) {
      resetPreviewZoom();
    }
  };

  // Double-tap to zoom on preview
  const lastTapRef = useRef(0);
  const handlePreviewDoubleTap = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      if (previewScale > 1) {
        resetPreviewZoom();
      } else {
        setPreviewScale(2.5);
      }
    }
    lastTapRef.current = now;
  };

  // Image preview modal
  if (previewUrl) {
    return (
      <div className="image-preview-modal">
        <div className="preview-header">
          <IonButton fill="clear" onClick={clearPreview} disabled={isSending}>
            <IonIcon icon={close} slot="icon-only" />
          </IonButton>
        </div>

        <div
          className="preview-body"
          onTouchStart={(e) => {
            handlePreviewDoubleTap(e);
            handlePreviewTouchStart(e);
          }}
          onTouchMove={handlePreviewTouchMove}
          onTouchEnd={handlePreviewTouchEnd}
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="preview-image"
            style={{
              transform: `translate(${previewTranslate.x}px, ${previewTranslate.y}px) scale(${previewScale})`,
              transition: isPinchingRef.current || isPanningRef.current ? 'none' : 'transform 0.2s ease-out',
            }}
            draggable={false}
          />
        </div>

        <div className="preview-footer">
          <input
            type="text"
            className="caption-input"
            placeholder={t('chat.addCaption')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isSending}
          />
          <IonButton
            className="send-button"
            onClick={handleSendImage}
            disabled={isSending}
          >
            {isSending ? (
              <IonSpinner name="crescent" />
            ) : (
              <IonIcon icon={send} slot="icon-only" />
            )}
          </IonButton>
        </div>

        <style>{`
          .image-preview-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: hsl(var(--background));
            display: flex;
            flex-direction: column;
            z-index: 1000;
          }

          .preview-header {
            display: flex;
            justify-content: flex-start;
            padding: 0.5rem;
            border-bottom: 1px solid hsl(var(--border));
          }

          .preview-body {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1rem;
            overflow: hidden;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
          }

          .preview-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 0.5rem;
            will-change: transform;
            pointer-events: none;
          }

          .preview-footer {
            display: flex;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border-top: 1px solid hsl(var(--border));
            background: hsl(var(--card));
          }

          .caption-input {
            flex: 1;
            background: hsl(var(--background));
            border: 1px solid hsl(var(--border));
            border-radius: 1.25rem;
            padding: 0.75rem 1rem;
            color: hsl(var(--foreground));
            font-size: 1rem;
            outline: none;
          }

          .caption-input::placeholder {
            color: hsl(var(--muted-foreground));
          }

          .caption-input:focus {
            border-color: hsl(var(--primary));
          }

          .preview-footer .send-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 50%;
            width: 2.75rem;
            height: 2.75rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="media-picker">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        style={{ display: 'none' }}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleDocumentChange}
        style={{ display: 'none' }}
      />

      {isOpen && (
        <div className="picker-menu">
          <button
            className="picker-option"
            onClick={handleCameraClick}
            disabled={disabled || isSending}
          >
            <IonIcon icon={camera} />
            <span>{t('chat.camera')}</span>
          </button>
          <button
            className="picker-option"
            onClick={handleImageClick}
            disabled={disabled || isSending}
          >
            <IonIcon icon={image} />
            <span>{t('message.image')}</span>
          </button>
          <button
            className="picker-option"
            onClick={handleDocumentClick}
            disabled={disabled || isSending}
          >
            <IonIcon icon={documentIcon} />
            <span>{t('message.document')}</span>
          </button>
        </div>
      )}

      <button
        className="attach-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isSending}
        aria-label="Attach media"
      >
        {isSending ? (
          <IonSpinner name="crescent" />
        ) : (
          <span className="attach-icon">+</span>
        )}
      </button>

      <style>{`
        .media-picker {
          position: relative;
        }

        .attach-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: hsl(var(--muted) / 0.3);
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          transition: all 0.15s;
        }

        .attach-button:hover:not(:disabled) {
          background: hsl(var(--muted) / 0.5);
        }

        .attach-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .attach-icon {
          font-size: 1.5rem;
          font-weight: 300;
          line-height: 1;
        }

        .picker-menu {
          position: absolute;
          bottom: 100%;
          left: 0;
          margin-bottom: 0.5rem;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          animation: slideUp 0.15s ease-out;
          z-index: 10;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .picker-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          font-size: 0.9rem;
          transition: background 0.15s;
        }

        .picker-option:hover:not(:disabled) {
          background: hsl(var(--muted) / 0.3);
        }

        .picker-option:not(:last-child) {
          border-bottom: 1px solid hsl(var(--border));
        }

        .picker-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .picker-option ion-icon {
          font-size: 1.25rem;
          color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};

export default MediaPicker;
