import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
} from '@ionic/react';
import { ellipse, ellipseOutline, personRemoveOutline } from 'ionicons/icons';
import { type User } from '../../types/database';

interface FriendCardProps {
  user: User;
  friendshipId: string;
  onUnfriend: (friendshipId: string) => void;
  onClick?: () => void;
}

/**
 * Card displaying a friend with swipe-to-unfriend.
 */
export const FriendCard: React.FC<FriendCardProps> = ({
  user,
  friendshipId,
  onUnfriend,
  onClick,
}) => {
  const { t } = useTranslation();

  return (
    <IonItemSliding>
      <IonItem
        button={!!onClick}
        detail={false}
        className="friend-card"
        data-testid={`friend-card-${user.id}`}
        onClick={onClick}
      >
        <IonAvatar slot="start" className="friend-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.display_name || ''} />
          ) : (
            <div className="avatar-placeholder">
              {user.display_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </IonAvatar>
        <IonLabel>
          <h2 className="friend-name">
            {user.display_name || t('dashboard.unnamed')}
            <IonIcon
              icon={user.is_active ? ellipse : ellipseOutline}
              className={`status-dot ${user.is_active ? 'active' : 'inactive'}`}
            />
          </h2>
          <p className="friend-zemi">{user.zemi_number}</p>
        </IonLabel>
      </IonItem>

      <IonItemOptions side="end">
        <IonItemOption
          color="danger"
          onClick={() => onUnfriend(friendshipId)}
        >
          <IonIcon slot="icon-only" icon={personRemoveOutline} />
        </IonItemOption>
      </IonItemOptions>

      <style>{`
        .friend-card {
          --background: hsl(var(--card));
          --border-color: hsl(var(--border));
          --padding-start: 1rem;
          --padding-end: 1rem;
          --inner-padding-end: 0;
        }

        .friend-card::part(native) {
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
        }

        .friend-avatar {
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

        .friend-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          color: hsl(var(--foreground));
          margin: 0 0 0.25rem 0;
        }

        .status-dot {
          font-size: 0.5rem;
        }

        .status-dot.active {
          color: hsl(var(--secondary));
        }

        .status-dot.inactive {
          color: hsl(var(--muted));
        }

        .friend-zemi {
          font-family: monospace;
          font-size: 0.85rem;
          color: hsl(var(--foreground) / 0.7);
          margin: 0;
        }
      `}</style>
    </IonItemSliding>
  );
};

export default FriendCard;
