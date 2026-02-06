import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonIcon,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import {
  eyeOutline,
  trashOutline,
  imageOutline,
  micOutline,
  videocamOutline,
  documentOutline,
  locationOutline,
} from 'ionicons/icons';
import { getOversightMessages } from '../services/oversight';
import { getChat, type ChatWithDetails } from '../services/chat';
import { MessageType, type Message, type User } from '../types/database';

const OwnerChatView: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { chatId } = useParams<{ chatId: string }>();
  const [chat, setChat] = useState<ChatWithDetails | null>(null);
  const [messages, setMessages] = useState<(Message & { sender?: User })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLIonContentElement>(null);

  const loadData = useCallback(async () => {
    if (!chatId) return;

    // Get chat details
    const { chat: chatData } = await getChat(chatId);
    if (!chatData) {
      history.replace('/oversight');
      return;
    }
    setChat(chatData);

    // Get messages (including deleted ones for transparency)
    const { messages: chatMessages, error } = await getOversightMessages(chatId);
    if (error) {
      console.error('Failed to load messages:', error);
    }
    setMessages(chatMessages);
    setIsLoading(false);

    // Scroll to bottom
    setTimeout(() => {
      contentRef.current?.scrollToBottom(300);
    }, 100);
  }, [chatId, history]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadData();
    event.detail.complete();
  };

  const getChatDisplayName = (): string => {
    if (!chat) return '';
    if (chat.name) return chat.name;

    // For 1-on-1 chats, show both participants
    const names = chat.members.map((m) => m.user?.display_name || m.user?.zemi_number || '?');
    return names.join(' & ');
  };

  const formatTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDivider = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('common.today') || 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('common.yesterday') || 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  const shouldShowDateDivider = (
    message: Message & { sender?: User },
    index: number
  ): boolean => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    const prevDate = new Date(prevMessage.created_at).toDateString();
    const currDate = new Date(message.created_at).toDateString();
    return prevDate !== currDate;
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case MessageType.IMAGE:
        return imageOutline;
      case MessageType.VOICE:
        return micOutline;
      case MessageType.VIDEO:
        return videocamOutline;
      case MessageType.DOCUMENT:
        return documentOutline;
      case MessageType.LOCATION:
        return locationOutline;
      default:
        return null;
    }
  };

  const renderMessageContent = (message: Message & { sender?: User }) => {
    const isDeleted = !!message.deleted_at;
    const typeIcon = getMessageTypeIcon(message.type);

    if (isDeleted) {
      return (
        <div className="message-deleted">
          <IonIcon icon={trashOutline} />
          <span>{t('oversight.deletedMessage')}</span>
          <span className="deleted-time">
            {new Date(message.deleted_at!).toLocaleString()}
          </span>
        </div>
      );
    }

    switch (message.type) {
      case MessageType.IMAGE:
        return (
          <div className="message-media">
            {message.media_url && (
              <img src={message.media_url} alt="Image" className="message-image" />
            )}
            {message.content && <p className="message-caption">{message.content}</p>}
          </div>
        );

      case MessageType.VOICE:
        return (
          <div className="message-voice">
            <IonIcon icon={micOutline} />
            <span>{t('message.voice')}</span>
            {message.media_metadata && (
              <span className="voice-duration">
                {Math.round((message.media_metadata as { duration?: number }).duration || 0)}s
              </span>
            )}
          </div>
        );

      case MessageType.VIDEO:
        return (
          <div className="message-video">
            <IonIcon icon={videocamOutline} />
            <span>{t('message.video')}</span>
          </div>
        );

      case MessageType.DOCUMENT:
        return (
          <div className="message-document">
            <IonIcon icon={documentOutline} />
            <span>
              {(message.media_metadata as { name?: string })?.name || t('message.document')}
            </span>
          </div>
        );

      case MessageType.LOCATION:
        return (
          <div className="message-location">
            <IonIcon icon={locationOutline} />
            <span>{t('message.location')}</span>
          </div>
        );

      default:
        return (
          <div className="message-text">
            {typeIcon && <IonIcon icon={typeIcon} className="type-icon" />}
            <p>{message.content}</p>
          </div>
        );
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/oversight" />
          </IonButtons>
          <IonTitle>{getChatDisplayName()}</IonTitle>
        </IonToolbar>
        <IonToolbar className="oversight-banner">
          <div className="oversight-indicator">
            <IonIcon icon={eyeOutline} />
            <span>{t('oversight.viewingAsOwner')}</span>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {isLoading ? (
          <div className="loading-state">
            <IonSpinner name="crescent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p>{t('oversight.noMessages')}</p>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((message, index) => {
              const showDivider = shouldShowDateDivider(message, index);
              const senderName =
                message.sender?.display_name || message.sender?.zemi_number || '?';

              return (
                <div key={message.id}>
                  {showDivider && (
                    <div className="date-divider">
                      <span>{formatDateDivider(message.created_at)}</span>
                    </div>
                  )}

                  <div className={`message-wrapper ${message.deleted_at ? 'deleted' : ''}`}>
                    <div className="message-bubble">
                      <div className="message-header">
                        <span className="sender-name">{senderName}</span>
                        <span className="message-time">{formatTime(message.created_at)}</span>
                      </div>

                      {renderMessageContent(message)}

                      {message.is_edited && !message.deleted_at && (
                        <div className="edited-indicator">
                          <span>{t('message.edited')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style>{`
          .oversight-banner {
            --background: hsl(var(--primary) / 0.1);
          }

          .oversight-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.5rem;
            color: hsl(var(--primary));
            font-size: 0.875rem;
            font-weight: 500;
          }

          .oversight-indicator ion-icon {
            font-size: 1rem;
          }

          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
          }

          .empty-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            color: hsl(var(--muted-foreground));
          }

          .messages-container {
            display: flex;
            flex-direction: column;
            padding: 1rem;
            min-height: 100%;
          }

          .date-divider {
            display: flex;
            justify-content: center;
            margin: 1rem 0;
          }

          .date-divider span {
            background: hsl(var(--muted) / 0.3);
            color: hsl(var(--muted-foreground));
            font-size: 0.75rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
          }

          .message-wrapper {
            margin-bottom: 0.75rem;
          }

          .message-wrapper.deleted {
            opacity: 0.7;
          }

          .message-bubble {
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 0.75rem 1rem;
            max-width: 100%;
          }

          .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }

          .sender-name {
            font-weight: 600;
            font-size: 0.875rem;
            color: hsl(var(--primary));
          }

          .message-time {
            font-size: 0.7rem;
            color: hsl(var(--muted-foreground));
          }

          .message-text p {
            margin: 0;
            color: hsl(var(--foreground));
            white-space: pre-wrap;
            word-break: break-word;
          }

          .message-deleted {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: hsl(var(--destructive));
            font-style: italic;
          }

          .message-deleted ion-icon {
            font-size: 1rem;
          }

          .deleted-time {
            font-size: 0.7rem;
            color: hsl(var(--muted-foreground));
            margin-left: auto;
          }

          .message-media {
            margin: 0;
          }

          .message-image {
            max-width: 100%;
            border-radius: 0.5rem;
            margin-bottom: 0.5rem;
          }

          .message-caption {
            margin: 0;
            color: hsl(var(--foreground));
          }

          .message-voice,
          .message-video,
          .message-document,
          .message-location {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: hsl(var(--foreground));
          }

          .message-voice ion-icon,
          .message-video ion-icon,
          .message-document ion-icon,
          .message-location ion-icon {
            color: hsl(var(--primary));
            font-size: 1.25rem;
          }

          .voice-duration {
            color: hsl(var(--muted-foreground));
            font-size: 0.75rem;
          }

          .edited-indicator {
            margin-top: 0.25rem;
            font-size: 0.7rem;
            color: hsl(var(--muted-foreground));
            font-style: italic;
          }

          .type-icon {
            margin-right: 0.25rem;
            color: hsl(var(--muted-foreground));
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default OwnerChatView;
