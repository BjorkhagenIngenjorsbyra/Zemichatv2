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
  type SosAlertWithTexter,
  parseAlertLocation,
  getGoogleMapsUrl,
} from '../../services/sos';

interface SOSAlertCardProps {
  alert: SosAlertWithTexter;
  onAcknowledge: (alertId: string) => void;
  isAcknowledging?: boolean;
}

/**
 * Card displaying an SOS alert for Owners.
 * Pulsing animation when unacknowledged.
 */
export const SOSAlertCard: React.FC<SOSAlertCardProps> = ({
  alert,
  onAcknowledge,
  isAcknowledging = false,
}) => {
  const { t } = useTranslation();
  const location = parseAlertLocation(alert);
  const isAcknowledged = !!alert.acknowledged_at;

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewLocation = () => {
    if (location) {
      window.open(getGoogleMapsUrl(location), '_blank');
    }
  };

  return (
    <IonCard className={`sos-alert-card ${!isAcknowledged ? 'urgent' : ''}`}>
      <IonCardContent>
        <div className="alert-header">
          <div className="alert-icon-container">
            <IonIcon icon={alertCircle} className="alert-icon" />
          </div>

          <IonAvatar className="texter-avatar">
            {alert.texter.avatar_url ? (
              <img src={alert.texter.avatar_url} alt={alert.texter.display_name || ''} />
            ) : (
              <div className="avatar-placeholder">
                {alert.texter.display_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </IonAvatar>

          <div className="alert-info">
            <h3 className="alert-title">
              {t('sos.alertReceived', { name: alert.texter.display_name })}
            </h3>
            <p className="alert-time">{formatTime(alert.created_at)}</p>
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
              {t('sos.viewLocation')}
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
                  {t('sos.acknowledge')}
                </>
              )}
            </IonButton>
          )}

          {isAcknowledged && (
            <span className="acknowledged-badge">
              <IonIcon icon={checkmarkCircleOutline} />
              Acknowledged
            </span>
          )}
        </div>
      </IonCardContent>

      <style>{`
        .sos-alert-card {
          margin: 0 0 1rem 0;
          border-radius: 1rem;
          overflow: hidden;
        }

        .sos-alert-card.urgent {
          border: 2px solid hsl(var(--destructive));
          animation: urgentPulse 2s ease-in-out infinite;
        }

        @keyframes urgentPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 hsl(var(--destructive) / 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px hsl(var(--destructive) / 0);
          }
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .alert-icon-container {
          flex-shrink: 0;
        }

        .alert-icon {
          font-size: 2rem;
          color: hsl(var(--destructive));
        }

        .sos-alert-card.urgent .alert-icon {
          animation: iconPulse 1s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .texter-avatar {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 50%;
        }

        .alert-info {
          flex: 1;
          min-width: 0;
        }

        .alert-title {
          font-size: 1rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin: 0 0 0.25rem 0;
        }

        .alert-time {
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
          margin: 0;
        }

        .alert-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .acknowledged-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: hsl(var(--secondary));
          font-size: 0.875rem;
          font-weight: 500;
        }
      `}</style>
    </IonCard>
  );
};

export default SOSAlertCard;
