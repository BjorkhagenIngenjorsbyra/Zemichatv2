import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonItem,
  IonLabel,
  IonAvatar,
  IonButton,
  IonIcon,
  IonBadge,
} from '@ionic/react';
import { checkmark, close, timeOutline } from 'ionicons/icons';
import { type User, UserRole } from '../../types/database';
import { getInitial, getAvatarColor } from '../../utils/userDisplay';
import { getOptimizedAvatarUrl } from '../../utils/imageUrl';
import './FriendRequestCard.css';

interface FriendRequestCardProps {
  requester: User;
  addressee: User;
  friendshipId: string;
  direction: 'incoming' | 'outgoing';
  onAccept?: (friendshipId: string) => void | Promise<void>;
  onReject?: (friendshipId: string) => void | Promise<void>;
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
  // Guard against double-taps firing accept/reject twice (duplicate service calls).
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    if (isProcessing || !onAccept) return;
    setIsProcessing(true);
    try {
      await onAccept(friendshipId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing || !onReject) return;
    setIsProcessing(true);
    try {
      await onReject(friendshipId);
    } finally {
      setIsProcessing(false);
    }
  };

  // For incoming requests, show the requester. For outgoing, show the addressee.
  const displayUser = direction === 'incoming' ? requester : addressee;

  // Check if addressee is a Texter (needs owner approval)
  const needsOwnerApproval = addressee.role === UserRole.TEXTER;

  return (
    <IonItem className="request-card" data-testid={`request-card-${friendshipId}`}>
      <IonAvatar slot="start" className="request-avatar">
        {displayUser.avatar_url ? (
          <img src={getOptimizedAvatarUrl(displayUser.avatar_url, 48)} alt={displayUser.display_name || ''} loading="lazy" decoding="async" />
        ) : (
          <div className="avatar-placeholder" style={{ background: getAvatarColor(displayUser) }}>
            {getInitial(displayUser)}
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
              disabled={isProcessing}
              onClick={handleReject}
              className="reject-button"
              aria-label={t('a11y.rejectFriendRequest')}
            >
              <IonIcon icon={close} slot="icon-only" />
            </IonButton>
          )}
          {onAccept && (
            <IonButton
              fill="solid"
              color="primary"
              size="small"
              disabled={isProcessing}
              onClick={handleAccept}
              className="accept-button"
              aria-label={t('a11y.acceptFriendRequest')}
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
    </IonItem>
  );
};

export default FriendRequestCard;
