import React from 'react';
import { useTranslation } from 'react-i18next';
import { getDisplayName, getInitial, getAvatarColor } from '../../utils/userDisplay';
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
import { getOptimizedAvatarUrl } from '../../utils/imageUrl';
import './FriendCard.css';

interface FriendCardProps {
  user: User;
  friendshipId: string;
  nickname?: string;
  showRealName?: boolean;
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
  showRealName,
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
            <img
              src={getOptimizedAvatarUrl(user.avatar_url, 48)}
              alt={user.display_name || ''}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="avatar-placeholder" style={{ background: getAvatarColor(user) }}>
              {nickname?.charAt(0)?.toUpperCase() || getInitial(user)}
            </div>
          )}
        </IonAvatar>
        <IonLabel>
          <h2 className="friend-name">
            {nickname || getDisplayName(user)}
            <IonIcon
              icon={isUserOnline(user.last_seen_at) ? ellipse : ellipseOutline}
              className={`status-dot ${isUserOnline(user.last_seen_at) ? 'active' : 'inactive'}`}
            />
          </h2>
          {nickname && showRealName && user.display_name ? (
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
    </IonItemSliding>
  );
};

export default FriendCard;
