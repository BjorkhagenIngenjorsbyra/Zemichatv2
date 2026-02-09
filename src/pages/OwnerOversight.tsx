import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonBadge,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import {
  personOutline,
  timeOutline,
  imageOutline,
  micOutline,
  documentOutline,
} from 'ionicons/icons';
import { getTexterChats, type TexterChatOverview } from '../services/oversight';
import { MessageType } from '../types/database';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';

const OwnerOversight: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [chats, setChats] = useState<TexterChatOverview[]>([]);
  const [filteredChats, setFilteredChats] = useState<TexterChatOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<'all' | string>('all');
  const [texterNames, setTexterNames] = useState<Map<string, string>>(new Map());

  // Get texter filter from URL params
  const urlParams = new URLSearchParams(location.search);
  const texterIdFromUrl = urlParams.get('texter');

  const loadChats = useCallback(async () => {
    const { chats: chatData, error } = await getTexterChats();

    if (error) {
      console.error('Failed to load Texter chats:', error);
    }

    setChats(chatData);

    // Build texter names map for filter
    const names = new Map<string, string>();
    for (const chat of chatData) {
      if (!names.has(chat.texter.id)) {
        names.set(chat.texter.id, chat.texter.display_name || chat.texter.zemi_number);
      }
    }
    setTexterNames(names);

    // Set initial filter from URL if present
    if (texterIdFromUrl && names.has(texterIdFromUrl)) {
      setFilter(texterIdFromUrl);
    }

    setIsLoading(false);
  }, [texterIdFromUrl]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    let result = chats;

    // Filter by texter
    if (filter !== 'all') {
      result = result.filter((c) => c.texter.id === filter);
    }

    // Filter by search
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (c) =>
          c.texter.display_name?.toLowerCase().includes(search) ||
          c.texter.zemi_number.toLowerCase().includes(search) ||
          c.otherMembers.some(
            (m) =>
              m.display_name?.toLowerCase().includes(search) ||
              m.zemi_number.toLowerCase().includes(search)
          ) ||
          c.chat.name?.toLowerCase().includes(search)
      );
    }

    setFilteredChats(result);
  }, [chats, filter, searchText]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadChats();
    event.detail.complete();
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return t('common.yesterday');
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessagePreview = (chat: TexterChatOverview): string => {
    if (!chat.lastMessage) {
      return t('oversight.noMessages');
    }

    const msg = chat.lastMessage;
    const senderName =
      msg.sender_id === chat.texter.id
        ? chat.texter.display_name || chat.texter.zemi_number
        : chat.otherMembers.find((m) => m.id === msg.sender_id)?.display_name || '?';

    let content = '';
    switch (msg.type) {
      case MessageType.IMAGE:
        content = t('message.image');
        break;
      case MessageType.VOICE:
        content = t('message.voice');
        break;
      case MessageType.VIDEO:
        content = t('message.video');
        break;
      case MessageType.DOCUMENT:
        content = t('message.document');
        break;
      case MessageType.LOCATION:
        content = t('message.location');
        break;
      default:
        content = msg.content || '';
    }

    if (msg.deleted_at) {
      content = t('oversight.deletedMessage');
    }

    return `${senderName}: ${content}`;
  };

  const getMessageTypeIcon = (chat: TexterChatOverview) => {
    if (!chat.lastMessage) return null;

    switch (chat.lastMessage.type) {
      case MessageType.IMAGE:
        return imageOutline;
      case MessageType.VOICE:
        return micOutline;
      case MessageType.DOCUMENT:
        return documentOutline;
      default:
        return null;
    }
  };

  const getChatDisplayName = (chat: TexterChatOverview): string => {
    if (chat.chat.name) return chat.chat.name;

    // Show the other member's name
    if (chat.otherMembers.length === 1) {
      return chat.otherMembers[0].display_name || chat.otherMembers[0].zemi_number;
    }

    // Group chat
    return chat.otherMembers.map((m) => m.display_name || m.zemi_number).join(', ');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('oversight.title')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            placeholder={t('common.search')}
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || '')}
            debounce={300}
          />
        </IonToolbar>
        {texterNames.size > 1 && (
          <IonToolbar>
            <IonSegment value={filter} onIonChange={(e) => setFilter(e.detail.value as string)}>
              <IonSegmentButton value="all">
                <IonLabel>{t('oversight.allTexters')}</IonLabel>
              </IonSegmentButton>
              {Array.from(texterNames.entries()).map(([id, name]) => (
                <IonSegmentButton key={id} value={id}>
                  <IonLabel>{name}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingText={t('refresh.pulling')}
            refreshingSpinner="crescent"
            refreshingText={t('refresh.refreshing')}
          />
        </IonRefresher>

        {isLoading ? (
          <SkeletonLoader variant="oversight-list" />
        ) : filteredChats.length === 0 ? (
          <div className="empty-state">
            <EmptyStateIllustration type="no-chats" />
            <h3>{t('oversight.noChats')}</h3>
            <p>{t('oversight.noChatsDescription')}</p>
          </div>
        ) : (
          <IonList className="chat-list">
            {filteredChats.map((chat) => {
              const typeIcon = getMessageTypeIcon(chat);
              const isDeleted = chat.lastMessage?.deleted_at;

              return (
                <IonItem
                  key={`${chat.chat.id}-${chat.texter.id}`}
                  button
                  detail
                  routerLink={`/oversight/chat/${chat.chat.id}`}
                  className="chat-item"
                >
                  <IonAvatar slot="start" className="chat-avatar">
                    {chat.otherMembers[0]?.avatar_url ? (
                      <img
                        src={chat.otherMembers[0].avatar_url}
                        alt={getChatDisplayName(chat)}
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {getChatDisplayName(chat).charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </IonAvatar>

                  <IonLabel>
                    <div className="chat-header">
                      <h2 className="chat-name">{getChatDisplayName(chat)}</h2>
                      {chat.lastMessage && (
                        <span className="chat-time">
                          <IonIcon icon={timeOutline} />
                          {formatTime(chat.lastMessage.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="chat-preview">
                      {typeIcon && <IonIcon icon={typeIcon} className="type-icon" />}
                      <p className={isDeleted ? 'deleted' : ''}>{getMessagePreview(chat)}</p>
                    </div>

                    <div className="chat-meta">
                      <IonBadge color="medium" className="texter-badge">
                        <IonIcon icon={personOutline} />
                        {chat.texter.display_name || chat.texter.zemi_number}
                      </IonBadge>
                      <span className="message-count">
                        {t('oversight.messageCount', { count: chat.messageCount })}
                      </span>
                    </div>
                  </IonLabel>
                </IonItem>
              );
            })}
          </IonList>
        )}

        <style>{`
          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 3rem 1rem;
            height: 100%;
          }

          .empty-icon {
            font-size: 4rem;
            color: hsl(var(--muted));
            margin-bottom: 1rem;
          }

          .empty-state h3 {
            margin: 0 0 0.5rem 0;
            color: hsl(var(--foreground));
          }

          .empty-state p {
            margin: 0;
            color: hsl(var(--muted-foreground));
          }

          .chat-list {
            background: transparent;
            padding: 0;
          }

          .chat-item {
            --background: hsl(var(--card));
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
            margin-bottom: 0.5rem;
          }

          .chat-avatar {
            width: 48px;
            height: 48px;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .chat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.25rem;
          }

          .chat-name {
            font-weight: 600;
            font-size: 1rem;
            color: hsl(var(--foreground));
            margin: 0;
          }

          .chat-time {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
          }

          .chat-time ion-icon {
            font-size: 0.875rem;
          }

          .chat-preview {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            margin-bottom: 0.5rem;
          }

          .chat-preview p {
            margin: 0;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .chat-preview p.deleted {
            font-style: italic;
            color: hsl(var(--destructive) / 0.7);
          }

          .type-icon {
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            flex-shrink: 0;
          }

          .chat-meta {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .texter-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.7rem;
            padding: 0.2rem 0.5rem;
            --background: hsl(var(--muted) / 0.3);
            --color: hsl(var(--muted-foreground));
          }

          .texter-badge ion-icon {
            font-size: 0.75rem;
          }

          .message-count {
            font-size: 0.7rem;
            color: hsl(var(--muted-foreground));
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default OwnerOversight;
