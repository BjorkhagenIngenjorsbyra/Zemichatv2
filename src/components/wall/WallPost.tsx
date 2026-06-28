import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonAvatar,
  IonIcon,
  IonButton,
  IonModal,
  IonAlert,
  useIonToast,
} from '@ionic/react';
import {
  trashOutline,
  chatbubbleOutline,
  chevronDown,
  chevronUp,
  chevronForwardOutline,
  trashBinOutline,
} from 'ionicons/icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { UserRole } from '../../types/database';
import { QUICK_REACTIONS } from '../../services/reaction';
import {
  toggleWallReaction,
  type WallPostWithAuthor,
  type WallGroupedReaction,
} from '../../services/wall';
import { useSignedMediaUrl } from '../../hooks/useSignedMediaUrl';
import WallComments from './WallComments';
import { formatShortDate } from '../../utils/datetime';
import './WallPost.css';

interface WallPostCardProps {
  post: WallPostWithAuthor;
  reactions: WallGroupedReaction[];
  onDelete: (postId: string) => void;
  onReactionsChanged: () => void;
}

const WallPostCard: React.FC<WallPostCardProps> = ({
  post,
  reactions,
  onDelete,
  onReactionsChanged,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [present] = useIonToast();
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [isDeletedExpanded, setIsDeletedExpanded] = useState(false);

  const isOwner = profile?.role === UserRole.OWNER;
  const isAuthor = post.author_id === profile?.id;
  const isDeleted = !!post.deleted_at;
  const canDelete = !isDeleted && (isAuthor || isOwner);

  // chat-media is private — resolve storage path to signed URL (audit fix #18).
  // Inline post image gets a 1200w/q80 CDN variant. The fullscreen modal
  // and inline view both reuse this signed URL — keep transform consistent
  // so the cache hits (audit fix #36-17).
  const resolvedImageUrl = useSignedMediaUrl(post.media_url, {
    width: 1200,
    quality: 80,
  });

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return t('common.justNow');
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return formatShortDate(dateStr);
  };

  const handleReaction = async (emoji: string) => {
    const { error } = await toggleWallReaction(post.id, emoji);
    if (error) {
      console.error('Failed to toggle wall reaction:', error);
      present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
      return;
    }
    onReactionsChanged();
  };

  const handleCommentCountChange = useCallback((count: number) => {
    setCommentCount(count);
  }, []);

  // Non-owner should not see deleted posts (filtered in parent), but just in case:
  if (isDeleted && !isOwner) return null;

  // Collapsed deleted post view
  if (isDeleted && !isDeletedExpanded) {
    return (
      <div
        className="wall-post-card wall-post-deleted-collapsed"
        onClick={() => setIsDeletedExpanded(true)}
      >
        <IonIcon icon={trashBinOutline} className="deleted-collapsed-icon" />
        <span className="deleted-collapsed-text">{t('wall.postDeleted')}</span>
        <span className="deleted-collapsed-hint">{t('wall.deletedPostTapToShow')}</span>
        <IonIcon icon={chevronForwardOutline} className="deleted-collapsed-chevron" />
      </div>
    );
  }

  return (
    <div className={`wall-post-card ${isDeleted ? 'wall-post-deleted' : ''}`}>
      {/* Header */}
      <div className="post-header">
        <IonAvatar className="post-avatar">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="avatar-placeholder">
              {(post.author?.display_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </IonAvatar>
        <div className="post-author-info">
          <span className="post-author-name">{post.author?.display_name || '?'}</span>
          <span className="post-time">{formatTime(post.created_at)}</span>
        </div>
        {isDeleted && (
          <IonButton fill="clear" size="small" className="post-collapse-btn" onClick={() => setIsDeletedExpanded(false)}>
            <IonIcon icon={chevronUp} />
          </IonButton>
        )}
        {canDelete && (
          <IonButton fill="clear" size="small" className="post-delete-btn" onClick={() => setShowDeleteAlert(true)}>
            <IonIcon icon={trashOutline} />
          </IonButton>
        )}
      </div>

      {/* Content */}
      {isDeleted && isOwner && (
        <div className="deleted-banner">{t('wall.postDeleted')}</div>
      )}

      {post.content && (
        <p className={`post-content ${isDeleted ? 'deleted-strikethrough' : ''}`}>
          {post.content}
        </p>
      )}

      {/* Image */}
      {post.media_url && resolvedImageUrl && (
        <div className="post-image-container" onClick={() => setShowFullImage(true)}>
          <img
            src={resolvedImageUrl}
            alt=""
            className="post-image"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {/* Reactions row */}
      {!isDeleted && (
        <div className="reactions-section">
          {/* Existing reactions */}
          {reactions.length > 0 && (
            <div className="reaction-chips">
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  className={`reaction-chip ${r.hasReacted ? 'reacted' : ''}`}
                  onClick={() => handleReaction(r.emoji)}
                >
                  <span className="reaction-emoji">{r.emoji}</span>
                  <span className="reaction-count">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick reaction buttons */}
          <div className="quick-reactions">
            {QUICK_REACTIONS.slice(0, 5).map((emoji) => {
              const existing = reactions.find((r) => r.emoji === emoji);
              if (existing) return null; // Already shown above
              return (
                <button
                  key={emoji}
                  className="quick-reaction-btn"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Comment toggle */}
      {!isDeleted && (
        <button
          className="comments-toggle"
          onClick={() => setShowComments(!showComments)}
        >
          <IonIcon icon={chatbubbleOutline} />
          <span>
            {showComments ? t('wall.hideComments') : t('wall.showComments')}
            {commentCount > 0 && ` (${commentCount})`}
          </span>
          <IonIcon icon={showComments ? chevronUp : chevronDown} className="toggle-chevron" />
        </button>
      )}

      {/* Comments section */}
      {showComments && !isDeleted && (
        <WallComments postId={post.id} onCommentCountChange={handleCommentCountChange} />
      )}

      {/* Fullscreen image modal */}
      <IonModal isOpen={showFullImage} onDidDismiss={() => setShowFullImage(false)}>
        <div className="wall-fullscreen-image-wrapper" onClick={() => setShowFullImage(false)}>
          <img
            src={resolvedImageUrl || ''}
            alt=""
            className="wall-fullscreen-image"
            decoding="async"
          />
        </div>
      </IonModal>

      {/* Delete confirmation */}
      <IonAlert
        isOpen={showDeleteAlert}
        onDidDismiss={() => setShowDeleteAlert(false)}
        header={t('wall.deletePost')}
        message={t('wall.deletePostConfirm')}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('common.delete'),
            role: 'destructive',
            handler: () => onDelete(post.id),
          },
        ]}
      />
    </div>
  );
};

export default WallPostCard;
