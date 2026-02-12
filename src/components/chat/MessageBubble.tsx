import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSwipeable } from 'react-swipeable';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { type MessageWithSender } from '../../services/message';
import { type GroupedReaction } from '../../services/reaction';
import ImageMessage from './ImageMessage';
import VoiceMessage from './VoiceMessage';
import QuotedMessage from './QuotedMessage';
import MessageReactions from './MessageReactions';
import LinkPreview, { extractUrl } from './LinkPreview';
import PollMessage from './PollMessage';

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
  userId?: string;
  /** Current user's role — Owner sees original content of deleted-for-all messages */
  userRole?: string;
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
  onReact,
  onToggleReaction,
  onContextMenu,
  userId,
  userRole,
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

  const formatMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLongPress = useCallback(() => {
    if (bubbleRef.current) {
      hapticMedium();
      const rect = bubbleRef.current.getBoundingClientRect();
      // Show both reaction bar and context menu (WhatsApp-style)
      onReact?.(message, rect);
      onContextMenu?.(message, rect);
    }
  }, [onContextMenu, onReact, message]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap — toggle heart reaction
      hapticLight();
      onToggleReaction?.(message.id, '❤️');
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
              src={message.media_url || undefined}
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
              href={message.media_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="document-link"
            >
              <span className="document-icon">📄</span>
              <span className="document-name">
                {(message.media_metadata as { fileName?: string })?.fileName || t('message.document')}
              </span>
            </a>
          </div>
        );
      case 'location':
        return (
          <div className="location-message">
            <span className="location-icon">📍</span>
            <span>{t('message.location')}</span>
          </div>
        );
      case 'poll':
        return <PollMessage messageId={message.id} isOwn={isOwn} />;
      case 'gif':
        return (
          <div className="gif-message">
            <img src={message.media_url || ''} alt="GIF" className="message-gif" loading="lazy" />
            {message.content && <p className="message-caption">{message.content}</p>}
          </div>
        );
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

  const renderReadStatus = () => {
    if (!isOwn || !readStatus) return null;

    switch (readStatus) {
      case 'sent':
        return <span className="read-status sent">✓</span>;
      case 'delivered':
        return <span className="read-status delivered">✓✓</span>;
      case 'read':
        return <span className="read-status read">✓✓</span>;
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
          <span className="reply-icon">↩️</span>
        </div>
      )}

      <div
        ref={bubbleRef}
        className={`message-bubble ${isOwn ? 'own' : 'other'} ${isJustSent ? 'message-just-sent' : ''} ${message.type === 'sticker' ? 'sticker-only' : ''}`}
        data-testid={`message-bubble-${message.id}`}
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
            <span>🗑️</span> {t('contextMenu.deletedVisibleToOwner')}
          </div>
        )}

        {showSenderName && !isOwn && (
          <span className="sender-name">{message.sender?.display_name}</span>
        )}

        {message.forwarded_from_id && (
          <span className="forwarded-tag">{t('contextMenu.forwarded')}</span>
        )}

        {message.reply_to && (
          <QuotedMessage
            message={message.reply_to}
            isOwn={isOwn}
            onClick={() => {}}
          />
        )}

        {renderContent()}

        {/* Heart animation overlay */}
        {showHeartAnim && <span className="heart-anim">❤️</span>}

        <div className="message-footer">
          <span className="message-time">
            {formatMessageTime(message.created_at)}
            {message.is_edited && (
              <span className="edited-tag"> ({t('message.edited')})</span>
            )}
          </span>
          {renderReadStatus()}
        </div>

        {reactions.length > 0 && (
          <MessageReactions
            reactions={reactions}
            onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
          />
        )}
      </div>

      <style>{`
        .swipe-container {
          position: relative;
          transition: transform 0.1s ease-out;
          display: flex;
          align-items: center;
          max-width: 85%;
        }

        .reply-indicator {
          position: absolute;
          left: -40px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: hsl(var(--primary) / 0.2);
          border-radius: 50%;
          transition: opacity 0.1s ease;
        }

        .reply-icon {
          font-size: 1rem;
        }

        .message-bubble {
          padding: 0.5rem 0.75rem;
          border-radius: 1.25rem;
          position: relative;
        }

        .message-bubble.own {
          background: #7c3aed;
          color: #fff;
          border-bottom-right-radius: 0.25rem;
        }

        .message-bubble.other {
          background: #2d2a4a;
          color: hsl(var(--foreground));
          border-bottom-left-radius: 0.25rem;
        }

        .sender-name {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: hsl(var(--accent));
          margin-bottom: 0.15rem;
        }

        .message-content {
          margin: 0;
          word-wrap: break-word;
          white-space: pre-wrap;
          line-height: 1.4;
        }

        /* Links inside messages */
        .message-content a,
        .message-bubble.own .message-content a {
          color: #c4b5fd;
          text-decoration: underline;
        }

        .message-bubble.other .message-content a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }

        .message-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.25rem;
          margin-top: 0.15rem;
        }

        .message-time {
          font-size: 0.6rem;
          opacity: 0.6;
        }

        /* Edge-to-edge media in bubbles */
        .message-bubble:has(.image-message),
        .message-bubble:has(.gif-message),
        .message-bubble:has(.video-message) {
          padding: 0;
          overflow: hidden;
        }

        .message-bubble:has(.image-message) .sender-name,
        .message-bubble:has(.gif-message) .sender-name,
        .message-bubble:has(.video-message) .sender-name {
          padding: 0.5rem 0.75rem 0.15rem;
        }

        .message-bubble:has(.image-message) .message-footer,
        .message-bubble:has(.gif-message) .message-footer,
        .message-bubble:has(.video-message) .message-footer {
          padding: 0.15rem 0.75rem 0.4rem;
        }

        .edited-tag {
          font-style: italic;
        }

        .read-status {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: -1px;
        }

        .read-status.sent {
          opacity: 0.5;
        }

        .read-status.delivered {
          opacity: 0.7;
        }

        .read-status.read {
          color: hsl(200 100% 60%);
          opacity: 1;
        }

        .video-message video {
          width: 100%;
          max-height: 300px;
          display: block;
        }

        .message-caption {
          margin: 0.25rem 0 0 0;
          padding: 0 0.75rem;
          font-size: 0.9rem;
        }

        .document-message {
          display: flex;
          align-items: center;
        }

        .document-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: inherit;
          text-decoration: none;
        }

        .document-link:hover {
          text-decoration: underline;
        }

        .document-icon {
          font-size: 1.5rem;
        }

        .document-name {
          font-size: 0.9rem;
          word-break: break-all;
        }

        .location-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .location-icon {
          font-size: 1.25rem;
        }

        .deleted-bubble {
          opacity: 0.6;
        }

        .deleted-message-text {
          margin: 0;
          font-style: italic;
          font-size: 0.85rem;
        }

        .owner-deleted-banner {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          font-weight: 600;
          color: hsl(0 70% 50%);
          background: hsl(0 70% 50% / 0.1);
          border-radius: 0.35rem;
          padding: 0.25rem 0.5rem;
          margin-bottom: 0.35rem;
        }

        .forwarded-tag {
          display: block;
          font-size: 0.7rem;
          font-style: italic;
          opacity: 0.7;
          margin-bottom: 0.25rem;
        }

        .message-gif {
          width: 100%;
          max-height: 250px;
          object-fit: cover;
          display: block;
        }

        .gif-message {
          min-width: 150px;
        }

        .gif-message .message-caption {
          padding: 0.25rem 0.75rem;
        }

        .sticker-message {
          font-size: 4rem;
          line-height: 1.2;
          display: block;
          text-align: center;
        }

        .message-bubble.sticker-only {
          background: transparent !important;
          border: none !important;
          padding: 0;
        }

        .message-bubble.own .mention-highlight {
          font-weight: 600;
          color: #c4b5fd;
        }

        .message-bubble.other .mention-highlight {
          font-weight: 600;
          color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};

export default MessageBubble;
