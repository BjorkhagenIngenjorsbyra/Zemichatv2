import { useTranslation } from 'react-i18next';
import { type Message, type User } from '../../types/database';
import './QuotedMessage.css';

interface QuotedMessageProps {
  message: Message & { sender?: User };
  isOwn: boolean;
  onClick?: () => void;
}

const QuotedMessage: React.FC<QuotedMessageProps> = ({
  message,
  isOwn,
  onClick,
}) => {
  const { t } = useTranslation();

  const getPreview = (): string => {
    if (message.content) {
      // CSS handles 3-line clamp + ellipsis (overflow-wrap + line-clamp).
      // Don't pre-truncate here — that broke wrapping for long words.
      return message.content;
    }

    switch (message.type) {
      case 'image':
        return `📷 ${t('message.image')}`;
      case 'voice':
        return `🎤 ${t('message.voice')}`;
      case 'video':
        return `🎥 ${t('message.video')}`;
      case 'document':
        return `📄 ${t('message.document')}`;
      case 'location':
        return `📍 ${t('message.location')}`;
      default:
        return '';
    }
  };

  // Issue #4: when the cited message is an image, render a tiny thumbnail
  // next to the text — like WhatsApp's reply preview.
  const showThumbnail =
    (message.type === 'image' || message.type === 'video') && !!message.media_url;

  return (
    <div
      className={`quoted-message ${isOwn ? 'own' : 'other'}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="quote-line" />
      <div className="quote-content">
        <span className="quote-sender">
          {message.sender?.display_name || t('dashboard.unnamed')}
        </span>
        <span className="quote-text">{getPreview()}</span>
      </div>
      {showThumbnail && (
        <img
          className="quote-thumb"
          src={message.media_url ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
};

export default QuotedMessage;
