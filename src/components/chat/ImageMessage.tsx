import { useState, useRef, useCallback } from 'react';
import { IonSpinner, IonModal, IonIcon } from '@ionic/react';
import { chevronBack, chevronForward, close } from 'ionicons/icons';

interface ImageMessageProps {
  mediaUrl: string | null;
  mediaMetadata?: Record<string, unknown> | null;
  caption?: string | null;
  /** All image URLs in the chat for gallery navigation */
  galleryUrls?: string[];
}

const ImageMessage: React.FC<ImageMessageProps> = ({
  mediaUrl,
  mediaMetadata,
  caption,
  galleryUrls,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Gallery state
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Pinch-to-zoom state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastDistRef = useRef(0);
  const lastCenterRef = useRef({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  // Swipe navigation state
  const swipeStartRef = useRef({ x: 0, y: 0, time: 0 });

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

  const openFullscreen = () => {
    // Find current image in gallery
    if (galleryUrls && mediaUrl) {
      const idx = galleryUrls.indexOf(mediaUrl);
      setGalleryIndex(idx >= 0 ? idx : 0);
    }
    resetZoom();
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    resetZoom();
  };

  const resetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const currentUrl = galleryUrls && galleryUrls.length > 0
    ? galleryUrls[galleryIndex]
    : mediaUrl;

  const hasGallery = galleryUrls && galleryUrls.length > 1;

  const goNext = useCallback(() => {
    if (!galleryUrls) return;
    resetZoom();
    setGalleryIndex((i) => Math.min(i + 1, galleryUrls.length - 1));
  }, [galleryUrls]);

  const goPrev = useCallback(() => {
    if (!galleryUrls) return;
    resetZoom();
    setGalleryIndex((i) => Math.max(i - 1, 0));
  }, [galleryUrls]);

  // --- Touch handlers for pinch-zoom + pan + swipe ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      isPinchingRef.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistRef.current = Math.sqrt(dx * dx + dy * dy);
      lastCenterRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      // Pan or swipe start
      swipeStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
      if (scale > 1) {
        isPanningRef.current = true;
        lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (lastDistRef.current > 0) {
        const newScale = Math.max(1, Math.min(5, scale * (dist / lastDistRef.current)));
        setScale(newScale);

        if (newScale <= 1) {
          setTranslate({ x: 0, y: 0 });
        }
      }

      lastDistRef.current = dist;
    } else if (e.touches.length === 1 && isPanningRef.current && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - lastPanRef.current.x;
      const dy = e.touches[0].clientY - lastPanRef.current.y;
      setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      lastDistRef.current = 0;

      // Snap back if scale is close to 1
      if (scale < 1.1) {
        resetZoom();
      }
      return;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    // Detect swipe for gallery navigation (only at scale 1)
    if (scale <= 1 && hasGallery && e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const deltaX = endX - swipeStartRef.current.x;
      const elapsed = Date.now() - swipeStartRef.current.time;

      if (Math.abs(deltaX) > 60 && elapsed < 400) {
        if (deltaX < 0) {
          goNext();
        } else {
          goPrev();
        }
        return;
      }
    }

    // Single tap to close (if not zoomed)
    if (scale <= 1) {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const deltaX = Math.abs(endX - swipeStartRef.current.x);
      const deltaY = Math.abs(endY - swipeStartRef.current.y);

      if (deltaX < 10 && deltaY < 10) {
        closeFullscreen();
      }
    }
  }, [scale, hasGallery, goNext, goPrev]);

  // Double-tap to zoom
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2.5);
        // Center zoom on tap position
        const touch = e.changedTouches[0];
        if (touch) {
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          setTranslate({
            x: (centerX - touch.clientX) * 1.5,
            y: (centerY - touch.clientY) * 1.5,
          });
        }
      }
    }
    lastTapRef.current = now;
  }, [scale]);

  if (!mediaUrl) {
    return (
      <div className="image-error">
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <>
      <div className="image-message" onClick={openFullscreen}>
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
        onDidDismiss={closeFullscreen}
        className="fullscreen-image-modal"
      >
        <div
          className="fullscreen-container"
          onTouchStart={(e) => {
            handleDoubleTap(e);
            handleTouchStart(e);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button */}
          <button className="fullscreen-close" onClick={closeFullscreen}>
            <IonIcon icon={close} />
          </button>

          <img
            src={currentUrl || ''}
            alt={metadata?.fileName || 'Image'}
            className="fullscreen-image"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isPinchingRef.current || isPanningRef.current ? 'none' : 'transform 0.2s ease-out',
            }}
            draggable={false}
          />

          {/* Gallery navigation arrows */}
          {hasGallery && (
            <>
              {galleryIndex > 0 && (
                <button
                  className="gallery-nav gallery-prev"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                >
                  <IonIcon icon={chevronBack} />
                </button>
              )}
              {galleryIndex < (galleryUrls?.length ?? 0) - 1 && (
                <button
                  className="gallery-nav gallery-next"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                >
                  <IonIcon icon={chevronForward} />
                </button>
              )}
              <div className="gallery-counter">
                {galleryIndex + 1} / {galleryUrls?.length}
              </div>
            </>
          )}
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
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          overflow: hidden;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }

        .fullscreen-close {
          position: absolute;
          top: env(safe-area-inset-top, 0.75rem);
          right: 0.75rem;
          z-index: 10;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          border: none;
          color: #fff;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          margin-top: 0.5rem;
        }

        .fullscreen-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          will-change: transform;
          pointer-events: none;
        }

        .fullscreen-image-modal {
          --background: transparent;
        }

        .gallery-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          border: none;
          color: #fff;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .gallery-prev {
          left: 0.75rem;
        }

        .gallery-next {
          right: 0.75rem;
        }

        .gallery-counter {
          position: absolute;
          bottom: env(safe-area-inset-bottom, 1rem);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </>
  );
};

export default ImageMessage;
