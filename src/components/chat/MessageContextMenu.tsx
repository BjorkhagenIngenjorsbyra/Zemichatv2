import { useEffect, useRef } from 'react';
import { IonIcon } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  arrowUndoOutline,
  copyOutline,
  createOutline,
  arrowRedoOutline,
  trashOutline,
} from 'ionicons/icons';
import { type MessageWithSender, canEditMessage, canDeleteForAll } from '../../services/message';
import { QUICK_REACTIONS } from '../../services/reaction';
import { hapticLight } from '../../utils/haptics';

interface MessageContextMenuProps {
  isOpen: boolean;
  message: MessageWithSender | null;
  isOwn: boolean;
  userId: string;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDeleteForAll: () => void;
  onReaction: (emoji: string) => void;
  onOpenFullPicker: () => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  message,
  isOwn,
  userId,
  onClose,
  onReply,
  onEdit,
  onCopy,
  onForward,
  onDeleteForAll,
  onReaction,
  onOpenFullPicker,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      hapticLight();
    }
  }, [isOpen]);

  if (!isOpen || !message) {
    return null;
  }

  const handleReaction = (emoji: string) => {
    hapticLight();
    onReaction(emoji);
    onClose();
  };

  const handlePlusClick = () => {
    hapticLight();
    onOpenFullPicker();
    onClose();
  };

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  interface ActionItem {
    label: string;
    icon: string;
    action: () => void;
    destructive?: boolean;
  }

  const actions: ActionItem[] = [];

  actions.push({
    label: t('contextMenu.reply'),
    icon: arrowUndoOutline,
    action: onReply,
  });

  if (message.type === 'text') {
    actions.push({
      label: t('contextMenu.copy'),
      icon: copyOutline,
      action: onCopy,
    });
  }

  if (canEditMessage(message, userId)) {
    actions.push({
      label: t('contextMenu.edit'),
      icon: createOutline,
      action: onEdit,
    });
  }

  actions.push({
    label: t('contextMenu.forward'),
    icon: arrowRedoOutline,
    action: onForward,
  });

  if (canDeleteForAll(message, userId)) {
    actions.push({
      label: t('contextMenu.deleteForAll'),
      icon: trashOutline,
      action: onDeleteForAll,
      destructive: true,
    });
  }

  return (
    <div className="ctx-backdrop" onClick={onClose}>
      <div
        ref={menuRef}
        className="ctx-menu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reaction row */}
        <div className="ctx-reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              className="ctx-reaction-btn"
              onClick={() => handleReaction(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            className="ctx-reaction-btn ctx-reaction-plus"
            onClick={handlePlusClick}
            aria-label="More reactions"
          >
            +
          </button>
        </div>

        {/* Divider */}
        <div className="ctx-divider" />

        {/* Action buttons */}
        <div className="ctx-actions">
          {actions.map((item) => (
            <button
              key={item.label}
              className={`ctx-action-btn ${item.destructive ? 'destructive' : ''}`}
              onClick={() => handleAction(item.action)}
            >
              <IonIcon icon={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .ctx-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: ctxFadeIn 0.15s ease-out;
        }

        @keyframes ctxFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ctx-menu {
          width: 100%;
          max-width: 400px;
          background: hsl(var(--card));
          border-radius: 1.25rem 1.25rem 0 0;
          padding: 0.75rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
          animation: ctxSlideUp 0.2s ease-out;
        }

        @keyframes ctxSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        /* Reaction row */
        .ctx-reactions {
          display: flex;
          justify-content: center;
          gap: 0.25rem;
          padding: 0.25rem 0;
        }

        .ctx-reaction-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 50%;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1.5rem;
          transition: all 0.15s;
          padding: 0;
        }

        .ctx-reaction-btn:hover {
          background: hsl(var(--muted) / 0.4);
        }

        .ctx-reaction-btn:active {
          transform: scale(0.9);
          background: hsl(var(--muted) / 0.6);
        }

        .ctx-reaction-plus {
          font-size: 1.3rem;
          font-weight: 700;
          color: hsl(var(--foreground) / 0.7);
          background: hsl(var(--muted) / 0.25);
        }

        .ctx-reaction-plus:hover {
          background: hsl(var(--muted) / 0.5);
          color: hsl(var(--foreground));
        }

        /* Divider */
        .ctx-divider {
          height: 1px;
          background: hsl(var(--border));
          margin: 0.5rem 0;
        }

        /* Action buttons */
        .ctx-actions {
          display: flex;
          flex-direction: column;
        }

        .ctx-action-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          font-size: 0.95rem;
          font-family: inherit;
          border-radius: 0.75rem;
          transition: background 0.15s;
          text-align: left;
        }

        .ctx-action-btn:hover {
          background: hsl(var(--muted) / 0.3);
        }

        .ctx-action-btn:active {
          background: hsl(var(--muted) / 0.5);
        }

        .ctx-action-btn ion-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .ctx-action-btn.destructive {
          color: hsl(var(--destructive));
        }
      `}</style>
    </div>
  );
};

export default MessageContextMenu;
