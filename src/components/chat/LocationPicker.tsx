import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSpinner,
} from '@ionic/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentPosition } from '../../services/location';

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (lat: number, lng: number) => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ isOpen, onClose, onShare }) => {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingPos, setIsLoadingPos] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Small delay so the modal DOM is ready
    const timer = setTimeout(async () => {
      if (!mapContainerRef.current) return;

      // Default center (Stockholm)
      let lat = 59.33;
      let lng = 18.07;

      setIsLoadingPos(true);
      const { location } = await getCurrentPosition();
      if (location) {
        lat = location.lat;
        lng = location.lng;
      }
      setSelectedPos({ lat, lng });
      setIsLoadingPos(false);

      // Create map if not yet
      if (!mapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        // Fix leaflet default icon path issue
        const defaultIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });

        const marker = L.marker([lat, lng], {
          draggable: true,
          icon: defaultIcon,
        }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setSelectedPos({ lat: pos.lat, lng: pos.lng });
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          setSelectedPos({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        mapRef.current = map;
        markerRef.current = marker;

        // Force recalculate size
        setTimeout(() => map.invalidateSize(), 100);
      } else {
        mapRef.current.setView([lat, lng], 15);
        markerRef.current?.setLatLng([lat, lng]);
        mapRef.current.invalidateSize();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, [isOpen]);

  const handleUseCurrentLocation = async () => {
    setIsLoadingPos(true);
    const { location } = await getCurrentPosition();
    if (location && mapRef.current && markerRef.current) {
      mapRef.current.setView([location.lat, location.lng], 15);
      markerRef.current.setLatLng([location.lat, location.lng]);
      setSelectedPos({ lat: location.lat, lng: location.lng });
    }
    setIsLoadingPos(false);
  };

  const handleShare = () => {
    if (selectedPos) {
      onShare(selectedPos.lat, selectedPos.lng);
      onClose();
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>{t('common.cancel')}</IonButton>
          </IonButtons>
          <IonTitle>{t('location.pickLocation')}</IonTitle>
          <IonButtons slot="end">
            <IonButton
              strong
              onClick={handleShare}
              disabled={!selectedPos}
            >
              {t('location.share')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="location-picker-container">
          <div ref={mapContainerRef} className="location-map" />

          <div className="location-actions">
            <button className="current-location-btn" onClick={handleUseCurrentLocation}>
              {isLoadingPos ? (
                <IonSpinner name="crescent" />
              ) : (
                t('location.useCurrentLocation')
              )}
            </button>
          </div>
        </div>

        <style>{`
          .location-picker-container {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .location-map {
            flex: 1;
            min-height: 300px;
          }

          .location-actions {
            padding: 1rem;
            padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
            background: hsl(var(--card));
            border-top: 1px solid hsl(var(--border));
          }

          .current-location-btn {
            width: 100%;
            padding: 0.75rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border: none;
            border-radius: 0.75rem;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }

          .current-location-btn ion-spinner {
            width: 1.25rem;
            height: 1.25rem;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default LocationPicker;
