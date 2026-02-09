import { useState, useRef, useCallback } from 'react';
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
}) => {
  const { t } = useTranslation();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const SWIPE_THRESHOLD = 60;
  const DOUBLE_TAP_DELAY = 300;

  const formatMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLongPress = useCallback(() => {
    if (onReact && bubbleRef.current) {
      hapticMedium();
      const rect = bubbleRef.current.getBoundingClientRect();
      onReact(message, rect);
    }
  }, [onReact, message]);

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
      case 'text':
      default: {
        const url = message.content ? extractUrl(message.content) : null;
        return (
          <>
            {message.content && <p className="message-content">{message.content}</p>}
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
        className={`message-bubble ${isOwn ? 'own' : 'other'} ${isJustSent ? 'message-just-sent' : ''}`}
        onClick={handleTap}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
      >
        {showSenderName && !isOwn && (
          <span className="sender-name">{message.sender?.display_name}</span>
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
          max-width: 75%;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          position: relative;
        }

        .message-bubble.own {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-bottom-right-radius: 0.25rem;
        }

        .message-bubble.other {
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-bottom-left-radius: 0.25rem;
        }

        .sender-name {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: hsl(var(--primary));
          margin-bottom: 0.25rem;
        }

        .message-content {
          margin: 0;
          word-wrap: break-word;
          white-space: pre-wrap;
          line-height: 1.4;
        }

        .message-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.25rem;
          margin-top: 0.25rem;
        }

        .message-time {
          font-size: 0.65rem;
          opacity: 0.7;
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
          max-width: 100%;
          max-height: 300px;
          border-radius: 0.5rem;
        }

        .message-caption {
          margin: 0.5rem 0 0 0;
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
      `}</style>
    </div>
  );
};

export default MessageBubble;
