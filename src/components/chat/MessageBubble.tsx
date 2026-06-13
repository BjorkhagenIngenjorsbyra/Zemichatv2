import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSwipeable } from 'react-swipeable';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { getDisplayName } from '../../utils/userDisplay';
import { getMessageEdits, type MessageWithSender } from '../../services/message';
import { type GroupedReaction } from '../../services/reaction';
import { useSignedMediaUrl } from '../../hooks/useSignedMediaUrl';
import ImageMessage from './ImageMessage';
import VoiceMessage from './VoiceMessage';
import QuotedMessage from './QuotedMessage';
import MessageReactions from './MessageReactions';
import LinkPreview, { extractUrl } from './LinkPreview';
import PollMessage from './PollMessage';
import LocationMessage from './LocationMessage';
import { formatTimeShort } from '../../utils/datetime';
import { IonAlert } from '@ionic/react';
import { type MessageEdit } from '../../types/database';
import './MessageBubble.css';

export type ReadStatus = 'sent' | 'delivered' | 'read';

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
  reactions?: GroupedReaction[];
  showSenderName?: boolean;
  readStatus?: ReadStatus;
  isJustSent?: boolean;
  /** All image URLs in the chat for gallery navigation */
  galleryUrls?: string[];
  onReply?: (message: MessageWithSender) => void;
  onReact?: (message: MessageWithSender, rect: DOMRect) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onContextMenu?: (message: MessageWithSender, rect: DOMRect) => void;
  onJumpToMessage?: (messageId: string) => void;
  userId?: string;
  /** Current user's role â€” Owner sees original content of deleted-for-all messages */
  userRole?: string;
  /** Highlight bubble briefly (e.g. when scrolled to via reply tap) */
  isHighlighted?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  reactions = [],
  showSenderName = false,
  readStatus,
  isJustSent = false,
  galleryUrls,
  onReply,
  // onReact and userId are unused inside the bubble itself â€” they're
  // forwarded to the context menu by the parent. Keep in the interface
  // so the contract is documented.
  onReact: _onReact,
  onToggleReaction,
  onContextMenu,
  onJumpToMessage,
  userId: _userId,
  userRole,
  isHighlighted = false,
}) => {
  const { t } = useTranslation();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SWIPE_THRESHOLD = 60;
  const DOUBLE_TAP_DELAY = 300;
  const LONG_PRESS_DELAY = 400;

  const formatMessageTime = (dateStr: string): string => formatTimeShort(dateStr);

  const handleLongPress = useCallback(() => {
    if (bubbleRef.current) {
      hapticMedium();
      const rect = bubbleRef.current.getBoundingClientRect();
      // Show unified context menu with reactions + actions
      onContextMenu?.(message, rect);
    }
  }, [onContextMenu, message]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap â€” toggle heart reaction
      hapticLight();
      onToggleReaction?.(message.id, 'â¤ï¸');
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 600);
      lastTapRef.current = 0; // Reset to prevent triple-tap
    } else {
      lastTapRef.current = now;
    }
  }, [message.id, onToggleReaction]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      handleLongPress();
    }, LONG_PRESS_DELAY);
  }, [cancelLongPress, handleLongPress]);

  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (e.deltaX > 0) {
        setSwipeOffset(Math.min(e.deltaX, SWIPE_THRESHOLD + 20));
      }
    },
    onSwipedRight: (e) => {
      if (e.deltaX >= SWIPE_THRESHOLD && onReply) {
        onReply(message);
      }
      setSwipeOffset(0);
    },
    onSwiped: () => {
      setSwipeOffset(0);
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
  });

  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="mention-highlight">{part}</span>;
      }
      return part;
    });
  };

  // Resolve media path to signed URL once per render (audit fix #18).
  // Only matters for video/document/gif â€” image and voice resolve inside
  // their own components.
  const resolvedMediaUrl = useSignedMediaUrl(message.media_url);

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <ImageMessage
            mediaUrl={message.media_url}
            mediaMetadata={message.media_metadata}
            caption={message.content}
            galleryUrls={galleryUrls}
          />
        );
      case 'voice':
        return (
          <VoiceMessage
            mediaUrl={message.media_url}
            mediaMetadata={message.media_metadata}
          />
        );
      case 'video':
        return (
          <div className="video-message">
            <video
              src={resolvedMediaUrl || undefined}
              controls
              className="message-video"
              playsInline
            />
            {message.content && <p className="message-caption">{message.content}</p>}
          </div>
        );
      case 'document':
        return (
          <div className="document-message">
            <a
              href={resolvedMediaUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="document-link"
            >
              <span className="document-icon">ðŸ“„</span>
              <span className="document-name">
                {(message.media_metadata as { fileName?: string })?.fileName || t('message.document')}
              </span>
            </a>
          </div>
        );
      case 'location': {
        const locMeta = message.media_metadata as { lat?: number; lng?: number } | null;
        if (locMeta?.lat && locMeta?.lng) {
          return <LocationMessage lat={locMeta.lat} lng={locMeta.lng} />;
        }
        return (
          <div className="location-message">
            <span className="location-icon">ðŸ“</span>
            <span>{t('message.location')}</span>
          </div>
        );
      }
      case 'poll':
        return <PollMessage messageId={message.id} isOwn={isOwn} />;
      case 'gif': {
        const gifMeta = message.media_metadata as { width?: number; height?: number } | null;
        // GIFs from Tenor/Giphy are absolute URLs and pass through unchanged
        // via resolveMediaUrl(). Storage paths get signed.
        return (
          <div className="gif-message">
            <img
              src={resolvedMediaUrl || ''}
              alt="GIF"
              className="message-gif"
              loading="lazy"
              decoding="async"
              style={gifMeta?.width && gifMeta?.height ? {
                aspectRatio: `${gifMeta.width} / ${gifMeta.height}`,
              } : undefined}
            />
            {message.content && <p className="message-caption">{message.content}</p>}
          </div>
        );
      }
      case 'sticker':
        return <span className="sticker-message">{message.content}</span>;
      case 'text':
      default: {
        const url = message.content ? extractUrl(message.content) : null;
        return (
          <>
            {message.content && (
              <p className="message-content" data-testid="message-content">
                {renderTextWithMentions(message.content)}
              </p>
            )}
            {url && <LinkPreview url={url} isOwn={isOwn} />}
          </>
        );
      }
    }
  };

  const [showEditHistory, setShowEditHistory] = useState(false);
  const [editHistory, setEditHistory] = useState<MessageEdit[] | null>(null);

  // Owner-only: reveal what a message originally said before it was edited.
  // The history is captured server-side by a trigger and gated by RLS, so an
  // edit can't be used to hide content from the overseeing Owner (PRD 8.4).
  const openEditHistory = async () => {
    const { edits } = await getMessageEdits(message.id);
    setEditHistory(edits);
    setShowEditHistory(true);
  };

  const renderReadStatus = () => {
    if (!isOwn || !readStatus) return null;

    switch (readStatus) {
      case 'sent':
        return <span className="read-status sent">âœ“</span>;
      case 'delivered':
        return <span className="read-status delivered">âœ“âœ“</span>;
      case 'read':
        return <span className="read-status read">âœ“âœ“</span>;
      default:
        return null;
    }
  };

  if (message.deleted_at && message.deleted_for_all) {
    const isOwnerViewing = userRole === 'owner';

    if (isOwnerViewing) {
      // Owner sees original content with a "deleted" indicator (transparency model)
      // Fall through to normal rendering below, but we add an indicator
    } else {
      // Everyone else sees placeholder
      return (
        <div className={`message-bubble ${isOwn ? 'own' : 'other'} deleted-bubble`}>
          <p className="deleted-message-text">{t('contextMenu.messageDeleted')}</p>
          <div className="message-footer">
            <span className="message-time">{formatMessageTime(message.created_at)}</span>
          </div>
        </div>
      );
    }
  }

  return (
    <div
      {...swipeHandlers}
      className="swipe-container"
      style={{ transform: `translateX(${swipeOffset}px)` }}
    >
      {/* Reply indicator */}
      {swipeOffset > 0 && (
        <div
          className="reply-indicator"
          style={{ opacity: Math.min(swipeOffset / SWIPE_THRESHOLD, 1) }}
        >
          <span className="reply-icon">â†©ï¸</span>
        </div>
      )}

      <div
        ref={bubbleRef}
        className={`message-bubble ${isOwn ? 'own' : 'other'} ${isJustSent ? 'message-just-sent' : ''} ${message.type === 'sticker' ? 'sticker-only' : ''} ${isHighlighted ? 'message-highlighted' : ''}`}
        data-testid={`message-bubble-${message.id}`}
        data-message-id={message.id}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={cancelLongPress}
        onTouchEnd={cancelLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
      >
        {/* Owner sees deleted-for-all messages with a warning banner */}
        {message.deleted_at && message.deleted_for_all && userRole === 'owner' && (
          <div className="owner-deleted-banner">
            <span>ðŸ—‘ï¸</span> {t('contextMenu.deletedVisibleToOwner')}
          </div>
        )}

        {showSenderName && !isOwn && (
          <span className="sender-name">{getDisplayName(message.sender)}</span>
        )}

        {message.forwarded_from_id && (
          <span className="forwarded-tag">{t('contextMenu.forwarded')}</span>
        )}

        {message.reply_to && (
          <QuotedMessage
            message={message.reply_to}
            isOwn={isOwn}
            onClick={() => onJumpToMessage?.(message.reply_to_id as string)}
          />
        )}

        {renderContent()}

        {/* Heart animation overlay */}
        {showHeartAnim && <span className="heart-anim">â¤ï¸</span>}

        <div className="message-footer">
          <span className="message-time">
            {formatMessageTime(message.created_at)}
            {message.is_edited && (
              userRole === 'owner' ? (
                <button
                  type="button"
                  className="edited-tag"
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={openEditHistory}
                  aria-label={t('message.viewEditHistory', 'Visa redigeringshistorik')}
                > ({t('message.edited')})</button>
              ) : (
                <span className="edited-tag"> ({t('message.edited')})</span>
              )
            )}
          </span>
          {renderReadStatus()}
        </div>

        {showEditHistory && (
          <IonAlert
            isOpen={showEditHistory}
            onDidDismiss={() => setShowEditHistory(false)}
            header={t('message.editHistory', 'Redigeringshistorik')}
            message={
              editHistory && editHistory.length > 0
                ? editHistory
                    .map((e) => `â€¢ ${new Date(e.edited_at).toLocaleString('sv-SE')}\n${e.old_content}`)
                    .join('\n\n')
                : t('message.noEditHistory', 'Ingen tidigare version sparad.')
            }
            buttons={[t('common.close', 'StÃ¤ng')]}
          />
        )}

        {reactions.length > 0 && (
          <MessageReactions
            reactions={reactions}
            onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
          />
        )}
      </div>
    </div>
  );
};

export default memo(MessageBubble);
