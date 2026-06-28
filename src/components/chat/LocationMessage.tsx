import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LocationViewer from './LocationViewer';

interface LocationMessageProps {
  lat: number;
  lng: number;
}

const LocationMessage: React.FC<LocationMessageProps> = ({ lat, lng }) => {
  const { t } = useTranslation();
  const [showViewer, setShowViewer] = useState(false);
  // Child-safety / privacy (Fable r3 #38): we deliberately do NOT request a
  // static-map thumbnail from any third party. Doing so would transmit the
  // child's exact coordinates to an external service on every render of the
  // message, for everyone who can see it. Instead we render a local pin card;
  // the actual map is drawn locally (Leaflet) inside LocationViewer, and only
  // when the user taps to open it.

  return (
    <>
      <div
        className="location-msg"
        role="button"
        tabIndex={0}
        aria-label={t('location.shareLocation')}
        onClick={() => setShowViewer(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowViewer(true);
          }
        }}
      >
        <div className="location-thumb location-thumb-fallback">
          <span className="location-fallback-pin">📍</span>
        </div>
        <div className="location-overlay">
          <span className="location-pin-icon">📍</span>
          <span>{t('location.shareLocation')}</span>
        </div>
      </div>

      <LocationViewer
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        lat={lat}
        lng={lng}
      />

      <style>{`
        .location-msg {
          position: relative;
          width: 240px;
          border-radius: 0.75rem;
          overflow: hidden;
          cursor: pointer;
        }

        .location-thumb {
          width: 100%;
          height: 150px;
          object-fit: cover;
          display: block;
        }

        .location-thumb-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: hsl(var(--muted) / 0.4);
        }

        .location-fallback-pin {
          font-size: 2.5rem;
        }

        .location-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.4rem 0.6rem;
          background: hsl(0 0% 0% / 0.5);
          color: white;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .location-pin-icon {
          font-size: 0.9rem;
        }
      `}</style>
    </>
  );
};

export default LocationMessage;
