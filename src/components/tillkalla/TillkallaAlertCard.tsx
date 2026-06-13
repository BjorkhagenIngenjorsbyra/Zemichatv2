import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonAvatar,
  IonSpinner,
} from '@ionic/react';
import {
  alertCircle,
  locationOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import {
  type TillkallaAlertWithTexter,
  parseAlertLocation,
  getGoogleMapsUrl,
} from '../../services/tillkalla';
import { formatDateTime } from '../../utils/datetime';
import './TillkallaAlertCard.css';

interface TillkallaAlertCardProps {
  alert: TillkallaAlertWithTexter;
  onAcknowledge: (alertId: string) => void;
  isAcknowledging?: boolean;
}

/**
 * Card displaying an Tillkalla Vuxen alert for Owners.
 * Pulsing animation when unacknowledged.
 */
export const TillkallaAlertCard: React.FC<TillkallaAlertCardProps> = ({
  alert,
  onAcknowledge,
  isAcknowledging = false,
}) => {
  const { t } = useTranslation();
  const location = parseAlertLocation(alert);
  const isAcknowledged = !!alert.acknowledged_at;

  const handleViewLocation = () => {
    if (location) {
      // noopener,noreferrer prevents reverse-tabnabbing on web.
      window.open(getGoogleMapsUrl(location), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <IonCard className={`tillkalla-alert-card ${!isAcknowledged ? 'urgent' : ''}`}>
      <IonCardContent>
        <div className="alert-header">
          <div className="alert-icon-container">
            <IonIcon icon={alertCircle} className="alert-icon" />
          </div>

          <IonAvatar className="texter-avatar">
            {alert.texter.avatar_url ? (
              <img src={alert.texter.avatar_url} alt={alert.texter.display_name || ''} loading="lazy" decoding="async" />
            ) : (
              <div className="avatar-placeholder">
                {alert.texter.display_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </IonAvatar>

          <div className="alert-info">
            <h3 className="alert-title">
              {t('tillkalla.alertReceived', { name: alert.texter.display_name })}
            </h3>
            <p className="alert-time">{formatDateTime(alert.created_at)}</p>
          </div>
        </div>

        <div className="alert-actions">
          {location && (
            <IonButton
              fill="outline"
              color="primary"
              size="small"
              onClick={handleViewLocation}
            >
              <IonIcon icon={locationOutline} slot="start" />
              {t('tillkalla.viewLocation')}
            </IonButton>
          )}

          {!isAcknowledged && (
            <IonButton
              fill="solid"
              color="success"
              size="small"
              onClick={() => onAcknowledge(alert.id)}
              disabled={isAcknowledging}
            >
              {isAcknowledging ? (
                <IonSpinner name="crescent" />
              ) : (
                <>
                  <IonIcon icon={checkmarkCircleOutline} slot="start" />
                  {t('tillkalla.acknowledge')}
                </>
              )}
            </IonButton>
          )}

          {isAcknowledged && (
            <span className="acknowledged-badge">
              <IonIcon icon={checkmarkCircleOutline} />
              {t('tillkalla.acknowledged')}
            </span>
          )}
        </div>
      </IonCardContent>
    </IonCard>
  );
};

export default TillkallaAlertCard;
