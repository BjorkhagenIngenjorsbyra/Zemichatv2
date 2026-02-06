import { useTranslation } from 'react-i18next';
import { type Message, type User } from '../../types/database';

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
      return message.content.length > 100
        ? message.content.slice(0, 100) + '...'
        : message.content;
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

      <style>{`
        .quoted-message {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem;
          margin-bottom: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .quoted-message.own {
          background: hsl(var(--primary-foreground) / 0.1);
        }

        .quoted-message.other {
          background: hsl(var(--muted) / 0.3);
        }

        .quoted-message:hover {
          opacity: 0.8;
        }

        .quote-line {
          width: 3px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .quoted-message.own .quote-line {
          background: hsl(var(--primary-foreground));
        }

        .quoted-message.other .quote-line {
          background: hsl(var(--primary));
        }

        .quote-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }

        .quote-sender {
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.125rem;
        }

        .quoted-message.own .quote-sender {
          color: hsl(var(--primary-foreground));
        }

        .quoted-message.other .quote-sender {
          color: hsl(var(--primary));
        }

        .quote-text {
          font-size: 0.8rem;
          opacity: 0.8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};

export default QuotedMessage;
