import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
} from '@ionic/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationViewerProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
}

const LocationViewer: React.FC<LocationViewerProps> = ({ isOpen, onClose, lat, lng }) => {
  const { t } = useTranslation();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapRef.current) {
        const defaultIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });

        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 15,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        L.marker([lat, lng], { icon: defaultIcon }).addTo(map);

        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 100);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, lat, lng]);

  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [isOpen]);

  const handleOpenInMaps = () => {
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
    window.open(url, '_blank');
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle>{t('location.shareLocation')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleOpenInMaps}>
              {t('location.openInMaps')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      </IonContent>
    </IonModal>
  );
};

export default LocationViewer;
