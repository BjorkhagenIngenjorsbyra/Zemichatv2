import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonItem,
  IonLabel,
  IonAvatar,
  IonButton,
  IonIcon,
  IonBadge,
  IonText,
} from '@ionic/react';
import { checkmark, close, timeOutline } from 'ionicons/icons';
import { type User, UserRole } from '../../types/database';

interface FriendRequestCardProps {
  requester: User;
  addressee: User;
  friendshipId: string;
  direction: 'incoming' | 'outgoing';
  onAccept?: (friendshipId: string) => void;
  onReject?: (friendshipId: string) => void;
  showOwnerApprovalNote?: boolean;
}

/**
 * Card displaying a pending friend request.
 */
export const FriendRequestCard: React.FC<FriendRequestCardProps> = ({
  requester,
  addressee,
  friendshipId,
  direction,
  onAccept,
  onReject,
  showOwnerApprovalNote = false,
}) => {
  const { t } = useTranslation();

  // For incoming requests, show the requester. For outgoing, show the addressee.
  const displayUser = direction === 'incoming' ? requester : addressee;

  // Check if addressee is a Texter (needs owner approval)
  const needsOwnerApproval = addressee.role === UserRole.TEXTER;

  return (
    <IonItem className="request-card" data-testid={`request-card-${friendshipId}`}>
      <IonAvatar slot="start" className="request-avatar">
        {displayUser.avatar_url ? (
          <img src={displayUser.avatar_url} alt={displayUser.display_name || ''} />
        ) : (
          <div className="avatar-placeholder">
            {displayUser.display_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </IonAvatar>

      <IonLabel>
        <h2 className="request-name">
          {displayUser.display_name || t('dashboard.unnamed')}
        </h2>
        <p className="request-zemi">{displayUser.zemi_number}</p>

        {direction === 'outgoing' && (
          <div className="request-status">
            <IonIcon icon={timeOutline} />
            <span>
              {needsOwnerApproval && showOwnerApprovalNote
                ? t('friends.waitingOwnerApproval')
                : t('friends.pending')}
            </span>
          </div>
        )}
      </IonLabel>

      {direction === 'incoming' && (
        <div slot="end" className="request-actions">
          {onReject && (
            <IonButton
              fill="outline"
              color="medium"
              size="small"
              onClick={() => onReject(friendshipId)}
              className="reject-button"
            >
              <IonIcon icon={close} slot="icon-only" />
            </IonButton>
          )}
          {onAccept && (
            <IonButton
              fill="solid"
              color="primary"
              size="small"
              onClick={() => onAccept(friendshipId)}
              className="accept-button"
            >
              <IonIcon icon={checkmark} slot="icon-only" />
            </IonButton>
          )}
        </div>
      )}

      {direction === 'outgoing' && (
        <IonBadge slot="end" color="warning" className="pending-badge">
          {t('friends.pending')}
        </IonBadge>
      )}

      <style>{`
        .request-card {
          --background: hsl(var(--card));
          --border-color: hsl(var(--border));
          --padding-start: 1rem;
          --padding-end: 1rem;
          --inner-padding-end: 0;
        }

        .request-card::part(native) {
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
        }

        .request-avatar {
          width: 48px;
          height: 48px;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
          border-radius: 50%;
        }

        .request-name {
          font-weight: 600;
          font-size: 1rem;
          color: hsl(var(--foreground));
          margin: 0 0 0.25rem 0;
        }

        .request-zemi {
          font-family: monospace;
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
          margin: 0;
        }

        .request-status {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-top: 0.25rem;
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .request-status ion-icon {
          font-size: 0.875rem;
        }

        .request-actions {
          display: flex;
          gap: 0.5rem;
        }

        .reject-button,
        .accept-button {
          --border-radius: 50%;
          width: 36px;
          height: 36px;
        }

        .pending-badge {
          font-size: 0.7rem;
        }
      `}</style>
    </IonItem>
  );
};

export default FriendRequestCard;
