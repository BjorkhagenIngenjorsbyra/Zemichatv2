import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonButton,
  IonIcon,
  IonAvatar,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { closeCircleOutline, returnDownForwardOutline, trashOutline } from 'ionicons/icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { UserRole } from '../../types/database';
import {
  getPostComments,
  addComment,
  deleteComment,
  type WallCommentWithAuthor,
} from '../../services/wall';

interface WallCommentsProps {
  postId: string;
  onCommentCountChange?: (count: number) => void;
}

const WallComments: React.FC<WallCommentsProps> = ({ postId, onCommentCountChange }) => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [presentToast] = useIonToast();
  const [comments, setComments] = useState<WallCommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<WallCommentWithAuthor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = profile?.role === UserRole.OWNER;

  const loadComments = useCallback(async () => {
    const { comments: data } = await getPostComments(postId);
    setComments(data);
    setIsLoading(false);
    onCommentCountChange?.(data.filter((c) => !c.deleted_at).length);
  }, [postId, onCommentCountChange]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const { error } = await addComment(postId, newComment.trim(), replyTo?.id);
    if (!error) {
      setNewComment('');
      setReplyTo(null);
      await loadComments();
    } else {
      console.error('Failed to add comment:', error.message);
      presentToast({
        message: t('wall.commentError', 'Could not post comment'),
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    await loadComments();
  };

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

  // Group: top-level + replies
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesMap = new Map<string, WallCommentWithAuthor[]>();
  for (const c of comments) {
    if (c.parent_comment_id) {
      const arr = repliesMap.get(c.parent_comment_id) || [];
      arr.push(c);
      repliesMap.set(c.parent_comment_id, arr);
    }
  }

  const renderComment = (comment: WallCommentWithAuthor, isReply = false) => {
    const isDeleted = !!comment.deleted_at;
    const canDelete = !isDeleted && (comment.author_id === profile?.id || isOwner);
    const isTopLevel = !comment.parent_comment_id;

    return (
      <div key={comment.id} className={`comment-item ${isReply ? 'comment-reply' : ''}`}>
        <IonAvatar className="comment-avatar">
          {comment.author?.avatar_url ? (
            <img src={comment.author.avatar_url} alt="" />
          ) : (
            <div className="avatar-placeholder-sm">
              {(comment.author?.display_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </IonAvatar>
        <div className="comment-body">
          <div className="comment-header">
            <span className="comment-author">{comment.author?.display_name || '?'}</span>
            <span className="comment-time">{formatTime(comment.created_at)}</span>
          </div>
          {isDeleted ? (
            <p className="comment-deleted">
              {isOwner ? (
                <span className="deleted-strikethrough">{comment.content}</span>
              ) : (
                <em>{t('wall.commentDeleted')}</em>
              )}
            </p>
          ) : (
            <p className="comment-content">{comment.content}</p>
          )}
          <div className="comment-actions">
            {isTopLevel && !isDeleted && (
              <button className="comment-action-btn" onClick={() => setReplyTo(comment)}>
                <IonIcon icon={returnDownForwardOutline} />
                {t('wall.reply')}
              </button>
            )}
            {canDelete && (
              <button className="comment-action-btn delete-btn" onClick={() => handleDelete(comment.id)}>
                <IonIcon icon={trashOutline} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="comments-loading">
        <IonSpinner name="dots" />
      </div>
    );
  }

  return (
    <div className="wall-comments">
      {topLevel.length === 0 && (
        <p className="no-comments">{t('wall.noComments')}</p>
      )}

      {topLevel.map((comment) => (
        <div key={comment.id}>
          {renderComment(comment)}
          {(repliesMap.get(comment.id) || []).map((reply) => renderComment(reply, true))}
        </div>
      ))}

      {/* Comment input */}
      <div className="comment-input-row">
        {replyTo && (
          <div className="reply-indicator">
            <span>{t('wall.replyingTo', { name: replyTo.author?.display_name || '?' })}</span>
            <button onClick={() => setReplyTo(null)}>
              <IonIcon icon={closeCircleOutline} />
            </button>
          </div>
        )}
        <div className="comment-input-wrapper">
          <input
            type="text"
            className="comment-input"
            placeholder={t('wall.writeComment')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <IonButton
            fill="clear"
            size="small"
            disabled={!newComment.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? <IonSpinner name="dots" /> : t('wall.comment')}
          </IonButton>
        </div>
      </div>

      <style>{`
        .wall-comments {
          padding: 0.5rem 0;
        }

        .comments-loading {
          display: flex;
          justify-content: center;
          padding: 1rem;
        }

        .no-comments {
          text-align: center;
          color: hsl(var(--muted-foreground));
          font-size: 0.85rem;
          padding: 0.5rem 0;
          margin: 0;
        }

        .comment-item {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem 0;
        }

        .comment-reply {
          margin-left: 2.5rem;
        }

        .comment-avatar {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
        }

        .avatar-placeholder-sm {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: 50%;
        }

        .comment-body {
          flex: 1;
          min-width: 0;
        }

        .comment-header {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .comment-author {
          font-weight: 600;
          font-size: 0.8rem;
          color: hsl(var(--foreground));
        }

        .comment-time {
          font-size: 0.7rem;
          color: hsl(var(--muted-foreground));
        }

        .comment-content {
          margin: 0.15rem 0 0;
          font-size: 0.85rem;
          color: hsl(var(--foreground));
          word-break: break-word;
        }

        .comment-deleted {
          margin: 0.15rem 0 0;
          font-size: 0.85rem;
          color: hsl(var(--muted-foreground));
        }

        .deleted-strikethrough {
          text-decoration: line-through;
          opacity: 0.6;
        }

        .comment-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.15rem;
        }

        .comment-action-btn {
          background: none;
          border: none;
          color: hsl(var(--muted-foreground));
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          cursor: pointer;
          padding: 0;
        }

        .comment-action-btn:hover {
          color: hsl(var(--foreground));
        }

        .comment-action-btn.delete-btn:hover {
          color: hsl(var(--destructive));
        }

        .comment-input-row {
          margin-top: 0.5rem;
          border-top: 1px solid hsl(var(--border));
          padding-top: 0.5rem;
        }

        .reply-indicator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.25rem 0.5rem;
          background: hsl(var(--muted) / 0.2);
          border-radius: 0.5rem;
          margin-bottom: 0.25rem;
          font-size: 0.75rem;
          color: hsl(var(--primary));
        }

        .reply-indicator button {
          background: none;
          border: none;
          cursor: pointer;
          color: hsl(var(--muted-foreground));
          display: flex;
          align-items: center;
          padding: 0;
        }

        .comment-input-wrapper {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .comment-input {
          flex: 1;
          border: 1px solid hsl(var(--border));
          border-radius: 1.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          outline: none;
        }

        .comment-input:focus {
          border-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};

export default WallComments;
