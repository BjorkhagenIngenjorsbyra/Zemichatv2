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

  // Use OpenStreetMap static map tile as thumbnail
  const tileUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=300x200&markers=${lat},${lng},red-pushpin`;

  return (
    <>
      <div className="location-msg" onClick={() => setShowViewer(true)}>
        <img
          src={tileUrl}
          alt={t('location.shareLocation')}
          className="location-thumb"
          loading="lazy"
        />
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
