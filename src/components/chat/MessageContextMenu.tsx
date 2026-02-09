import { useEffect } from 'react';
import { IonActionSheet } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { type MessageWithSender, canEditMessage, canDeleteForAll } from '../../services/message';
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
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      hapticLight();
    }
  }, [isOpen]);

  if (!message) {
    return null;
  }

  const buttons: Array<{
    text: string;
    role?: string;
    handler: () => void;
  }> = [];

  // Reply is always available
  buttons.push({
    text: t('contextMenu.reply'),
    handler: onReply,
  });

  // Copy is only available for text messages
  if (message.type === 'text') {
    buttons.push({
      text: t('contextMenu.copy'),
      handler: onCopy,
    });
  }

  // Edit is available for own messages within 15 min
  if (canEditMessage(message, userId)) {
    buttons.push({
      text: t('contextMenu.edit'),
      handler: onEdit,
    });
  }

  // Forward is always available
  buttons.push({
    text: t('contextMenu.forward'),
    handler: onForward,
  });

  // Delete for all is available for own messages within 1 hour
  if (canDeleteForAll(message, userId)) {
    buttons.push({
      text: t('contextMenu.deleteForAll'),
      role: 'destructive',
      handler: onDeleteForAll,
    });
  }

  // Cancel button
  buttons.push({
    text: t('common.cancel'),
    role: 'cancel',
    handler: onClose,
  });

  return (
    <IonActionSheet
      isOpen={isOpen}
      onDidDismiss={onClose}
      buttons={buttons}
    />
  );
};

export default MessageContextMenu;
