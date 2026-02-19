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
import { type User, FRIEND_CATEGORIES } from '../../types/database';
import { isUserOnline } from '../../services/presence';

interface FriendCardProps {
  user: User;
  friendshipId: string;
  nickname?: string;
  categories?: string[];
  onUnfriend: (friendshipId: string) => void;
  onClick?: () => void;
}

/**
 * Card displaying a friend with swipe-to-unfriend.
 */
export const FriendCard: React.FC<FriendCardProps> = ({
  user,
  friendshipId,
  nickname,
  categories,
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
              {(nickname || user.display_name)?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </IonAvatar>
        <IonLabel>
          <h2 className="friend-name">
            {nickname || user.display_name || t('dashboard.unnamed')}
            <IonIcon
              icon={isUserOnline(user.last_seen_at) ? ellipse : ellipseOutline}
              className={`status-dot ${isUserOnline(user.last_seen_at) ? 'active' : 'inactive'}`}
            />
          </h2>
          {nickname && user.display_name ? (
            <p className="friend-real-name">{user.display_name}</p>
          ) : null}
          <p className="friend-zemi">
            {user.zemi_number}
            {categories && categories.length > 0 && (
              <span className="friend-cat-pills">
                {categories
                  .filter((c) => (FRIEND_CATEGORIES as readonly string[]).includes(c))
                  .map((cat) => (
                    <span key={cat} className="friend-cat-pill">
                      {t(`friendSettings.${cat}`)}
                    </span>
                  ))}
              </span>
            )}
          </p>
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

        .friend-real-name {
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
          margin: 0 0 0.15rem 0;
        }

        .friend-zemi {
          font-family: monospace;
          font-size: 0.85rem;
          color: hsl(var(--foreground) / 0.7);
          margin: 0;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .friend-cat-pills {
          display: inline-flex;
          gap: 0.25rem;
          margin-left: 0.25rem;
        }

        .friend-cat-pill {
          font-family: inherit;
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: hsl(var(--primary) / 0.15);
          color: hsl(var(--primary));
          font-weight: 500;
          white-space: nowrap;
        }
      `}</style>
    </IonItemSliding>
  );
};

export default FriendCard;
