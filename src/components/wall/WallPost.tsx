import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonAvatar,
  IonIcon,
  IonButton,
  IonModal,
  IonAlert,
} from '@ionic/react';
import {
  trashOutline,
  chatbubbleOutline,
  chevronDown,
  chevronUp,
} from 'ionicons/icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { UserRole } from '../../types/database';
import { QUICK_REACTIONS } from '../../services/reaction';
import {
  toggleWallReaction,
  type WallPostWithAuthor,
  type WallGroupedReaction,
} from '../../services/wall';
import WallComments from './WallComments';

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
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const isOwner = profile?.role === UserRole.OWNER;
  const isAuthor = post.author_id === profile?.id;
  const isDeleted = !!post.deleted_at;
  const canDelete = !isDeleted && (isAuthor || isOwner);

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'nu';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleReaction = async (emoji: string) => {
    await toggleWallReaction(post.id, emoji);
    onReactionsChanged();
  };

  const handleCommentCountChange = useCallback((count: number) => {
    setCommentCount(count);
  }, []);

  // Non-owner should not see deleted posts (filtered in parent), but just in case:
  if (isDeleted && !isOwner) return null;

  return (
    <div className={`wall-post-card ${isDeleted ? 'wall-post-deleted' : ''}`}>
      {/* Header */}
      <div className="post-header">
        <IonAvatar className="post-avatar">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" />
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
      {post.media_url && (
        <div className="post-image-container" onClick={() => setShowFullImage(true)}>
          <img src={post.media_url} alt="" className="post-image" />
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
        <div className="fullscreen-image-wrapper" onClick={() => setShowFullImage(false)}>
          <img src={post.media_url || ''} alt="" className="fullscreen-image" />
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

      <style>{`
        .wall-post-card {
          background: hsl(var(--card));
          border-radius: 1rem;
          padding: 1rem;
          margin-bottom: 0.75rem;
        }

        .wall-post-deleted {
          opacity: 0.7;
          border: 1px dashed hsl(var(--muted));
        }

        .post-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .post-avatar {
          width: 36px;
          height: 36px;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 50%;
        }

        .post-author-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .post-author-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: hsl(var(--foreground));
        }

        .post-time {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .post-delete-btn {
          --color: hsl(var(--muted-foreground));
        }

        .deleted-banner {
          background: hsl(var(--destructive) / 0.1);
          color: hsl(var(--destructive));
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .post-content {
          margin: 0 0 0.5rem;
          font-size: 0.95rem;
          color: hsl(var(--foreground));
          white-space: pre-wrap;
          word-break: break-word;
        }

        .deleted-strikethrough {
          text-decoration: line-through;
          opacity: 0.6;
        }

        .post-image-container {
          margin: 0.5rem -1rem;
          cursor: pointer;
        }

        .post-image {
          width: 100%;
          max-height: 400px;
          object-fit: cover;
        }

        .reactions-section {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.25rem;
          margin-top: 0.5rem;
        }

        .reaction-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .reaction-chip {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem 0.5rem;
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          cursor: pointer;
          font-size: 0.8rem;
        }

        .reaction-chip.reacted {
          border-color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.1);
        }

        .reaction-emoji {
          font-size: 0.9rem;
        }

        .reaction-count {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .quick-reactions {
          display: flex;
          gap: 0.15rem;
          margin-left: 0.25rem;
        }

        .quick-reaction-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.85rem;
          padding: 0.15rem;
          opacity: 0.5;
          transition: opacity 0.15s;
        }

        .quick-reaction-btn:hover {
          opacity: 1;
        }

        .comments-toggle {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-top: 0.5rem;
          padding: 0.35rem 0;
          background: none;
          border: none;
          cursor: pointer;
          color: hsl(var(--muted-foreground));
          font-size: 0.8rem;
          width: 100%;
        }

        .comments-toggle:hover {
          color: hsl(var(--foreground));
        }

        .toggle-chevron {
          margin-left: auto;
          font-size: 0.75rem;
        }

        .fullscreen-image-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: black;
          cursor: pointer;
        }

        .fullscreen-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      `}</style>
    </div>
  );
};

export default WallPostCard;
