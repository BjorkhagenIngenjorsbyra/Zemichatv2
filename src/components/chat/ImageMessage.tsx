import { useState } from 'react';
import { IonSpinner, IonModal } from '@ionic/react';

interface ImageMessageProps {
  mediaUrl: string | null;
  mediaMetadata?: Record<string, unknown> | null;
  caption?: string | null;
}

const ImageMessage: React.FC<ImageMessageProps> = ({
  mediaUrl,
  mediaMetadata,
  caption,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const metadata = mediaMetadata as {
    width?: number;
    height?: number;
    fileName?: string;
  } | null;

  const aspectRatio = metadata?.width && metadata?.height
    ? metadata.width / metadata.height
    : undefined;

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!mediaUrl) {
    return (
      <div className="image-error">
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <>
      <div className="image-message" onClick={() => setIsFullscreen(true)}>
        {isLoading && (
          <div
            className="image-loading"
            style={{
              aspectRatio: aspectRatio || 1,
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {hasError ? (
          <div className="image-error">
            <span>Failed to load image</span>
          </div>
        ) : (
          <img
            src={mediaUrl}
            alt={metadata?.fileName || 'Image'}
            className={`message-image ${isLoading ? 'hidden' : ''}`}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {caption && <p className="image-caption">{caption}</p>}
      </div>

      <IonModal
        isOpen={isFullscreen}
        onDidDismiss={() => setIsFullscreen(false)}
        className="fullscreen-image-modal"
      >
        <div
          className="fullscreen-container"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={mediaUrl}
            alt={metadata?.fileName || 'Image'}
            className="fullscreen-image"
          />
        </div>
      </IonModal>

      <style>{`
        .image-message {
          cursor: pointer;
          min-width: 150px;
        }

        .image-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100px;
          max-height: 300px;
          background: hsl(var(--muted) / 0.3);
          border-radius: 0.5rem;
        }

        .message-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: 0.5rem;
          display: block;
        }

        .message-image.hidden {
          display: none;
        }

        .image-caption {
          margin: 0.5rem 0 0 0;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .image-error {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100px;
          background: hsl(var(--muted) / 0.3);
          border-radius: 0.5rem;
          color: hsl(var(--muted-foreground));
          font-size: 0.875rem;
        }

        .fullscreen-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          padding: 1rem;
        }

        .fullscreen-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .fullscreen-image-modal {
          --background: transparent;
        }
      `}</style>
    </>
  );
};

export default ImageMessage;
