import { useState, useEffect, useCallback, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonBadge,
  IonFab,
  IonFabButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonPopover,
  RefresherEventDetail,
} from '@ionic/react';
import {
  add,
  pin,
  archive,
  volumeMute,
  volumeHigh,
  arrowUndo,
  chevronDown,
  chevronUp,
  searchOutline,
} from 'ionicons/icons';
import { hapticMedium } from '../utils/haptics';
import { getChatMessages, type MessageWithSender } from '../services/message';
import { useAuthContext } from '../contexts/AuthContext';
import {
  getMyChats,
  pinChat,
  unpinChat,
  archiveChat,
  unarchiveChat,
  muteChat,
  unmuteChat,
  type ChatWithDetails,
} from '../services/chat';
import { ChatSearchModal } from '../components/chat';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';

const ChatList: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  // Long-press preview state
  const [previewChat, setPreviewChat] = useState<ChatWithDetails | null>(null);
  const [previewMessages, setPreviewMessages] = useState<MessageWithSender[]>([]);
  const [previewEvent, setPreviewEvent] = useState<MouseEvent | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderClick = () => {
    contentRef.current?.scrollToTop(300);
  };

  const handleChatLongPress = useCallback(async (chat: ChatWithDetails, event: React.MouseEvent | React.TouchEvent) => {
    hapticMedium();
    const nativeEvent = 'nativeEvent' in event ? event.nativeEvent as MouseEvent : null;
    setPreviewChat(chat);
    setPreviewEvent(nativeEvent);

    // Load recent messages for preview
    const { messages: recentMsgs } = await getChatMessages(chat.id, 5);
    setPreviewMessages(recentMsgs);
  }, []);

  const handleLongPressStart = useCallback((chat: ChatWithDetails) => {
    longPressTimerRef.current = setTimeout(() => {
      // Create a synthetic event at center-screen for popover
      const syntheticEvent = new MouseEvent('click', {
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 3,
      });
      hapticMedium();
      setPreviewChat(chat);
      setPreviewEvent(syntheticEvent);
      getChatMessages(chat.id, 5).then(({ messages: recentMsgs }) => {
        setPreviewMessages(recentMsgs);
      });
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const loadChats = useCallback(async () => {
    const { chats: chatList } = await getMyChats();
    setChats(chatList);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadChats();
    event.detail.complete();
  };

  // Separate chats into pinned, active, and archived
  const pinnedChats = chats.filter((c) => c.isPinned && !c.isArchived);
  const activeChats = chats.filter((c) => !c.isPinned && !c.isArchived);
  const archivedChats = chats.filter((c) => c.isArchived);

  const getChatDisplayName = (chat: ChatWithDetails): string => {
    if (chat.name) return chat.name;

    // For 1-on-1 chats, show the other person's name
    if (!chat.is_group && chat.members.length > 0) {
      const otherMember = chat.members.find((m) => m.user_id !== profile?.id);
      return otherMember?.user?.display_name || t('dashboard.unnamed');
    }

    // For unnamed groups, list member names
    const memberNames = chat.members
      .filter((m) => m.user_id !== profile?.id)
      .map((m) => m.user?.display_name || t('dashboard.unnamed'))
      .slice(0, 3);

    return memberNames.join(', ') || t('chat.newChat');
  };

  const getChatAvatar = (chat: ChatWithDetails): string | null => {
    if (chat.avatar_url) return chat.avatar_url;

    // For 1-on-1 chats, show the other person's avatar
    if (!chat.is_group) {
      const otherMember = chat.members.find((m) => m.user_id !== profile?.id);
      return otherMember?.user?.avatar_url || null;
    }

    return null;
  };

  const getAvatarInitial = (chat: ChatWithDetails): string => {
    const name = getChatDisplayName(chat);
    return name.charAt(0).toUpperCase();
  };

  const formatLastMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return t('common.yesterday') || 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getLastMessagePreview = (chat: ChatWithDetails): string => {
    if (!chat.lastMessage) return '';

    const msg = chat.lastMessage;
    const isMine = msg.sender_id === profile?.id;
    const prefix = isMine ? `${t('common.you')}: ` : '';

    switch (msg.type) {
      case 'text':
        return prefix + (msg.content || '');
      case 'image':
        return prefix + '📷 ' + (t('message.image') || 'Image');
      case 'voice':
        return prefix + '🎤 ' + (t('message.voice') || 'Voice message');
      case 'video':
        return prefix + '🎥 ' + (t('message.video') || 'Video');
      case 'document':
        return prefix + '📄 ' + (t('message.document') || 'Document');
      case 'location':
        return prefix + '📍 ' + (t('message.location') || 'Location');
      default:
        return prefix + (msg.content || '');
    }
  };

  const openChat = (chatId: string) => {
    history.push(`/chat/${chatId}`);
  };

  const openNewChat = () => {
    history.push('/new-chat');
  };

  const handlePin = async (chat: ChatWithDetails) => {
    if (chat.isPinned) {
      await unpinChat(chat.id);
    } else {
      await pinChat(chat.id);
    }
    loadChats();
  };

  const handleArchive = async (chat: ChatWithDetails) => {
    if (chat.isArchived) {
      await unarchiveChat(chat.id);
    } else {
      await archiveChat(chat.id);
    }
    loadChats();
  };

  const handleMute = async (chat: ChatWithDetails) => {
    if (chat.isMuted) {
      await unmuteChat(chat.id);
    } else {
      await muteChat(chat.id);
    }
    loadChats();
  };

  const renderChatItem = (chat: ChatWithDetails, index: number) => {
    const avatar = getChatAvatar(chat);
    const displayName = getChatDisplayName(chat);
    const initial = getAvatarInitial(chat);
    const lastMessagePreview = getLastMessagePreview(chat);

    return (
      <IonItemSliding
        key={chat.id}
        className="animate-fade-slide-in"
        style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
      >
        <IonItem
          button
          detail={false}
          className="chat-item"
          onClick={() => openChat(chat.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            handleChatLongPress(chat, e);
          }}
          onTouchStart={() => handleLongPressStart(chat)}
          onTouchEnd={handleLongPressEnd}
          onTouchMove={handleLongPressEnd}
        >
          <IonAvatar slot="start" className="chat-avatar">
            {avatar ? (
              <img src={avatar} alt={displayName} />
            ) : (
              <div className="avatar-placeholder">{initial}</div>
            )}
          </IonAvatar>

          <IonLabel>
            <div className="chat-header">
              <div className="chat-name-row">
                {chat.isPinned && (
                  <IonIcon icon={pin} className="pin-icon" />
                )}
                {chat.isMuted && (
                  <IonIcon icon={volumeMute} className="mute-icon" />
                )}
                <h2 className="chat-name">{displayName}</h2>
              </div>
              {chat.lastMessage && (
                <span className="chat-time">
                  {formatLastMessageTime(chat.lastMessage.created_at)}
                </span>
              )}
            </div>
            <div className="chat-preview">
              <p className="last-message">{lastMessagePreview}</p>
              {chat.unreadCount > 0 && (
                <IonBadge color="primary" className="unread-badge">
                  {chat.unreadCount}
                </IonBadge>
              )}
            </div>
          </IonLabel>
        </IonItem>

        <IonItemOptions side="end">
          <IonItemOption
            color={chat.isPinned ? 'medium' : 'primary'}
            onClick={() => handlePin(chat)}
          >
            <IonIcon slot="icon-only" icon={chat.isPinned ? arrowUndo : pin} />
          </IonItemOption>
          <IonItemOption
            color={chat.isMuted ? 'success' : 'medium'}
            onClick={() => handleMute(chat)}
          >
            <IonIcon
              slot="icon-only"
              icon={chat.isMuted ? volumeHigh : volumeMute}
            />
          </IonItemOption>
          <IonItemOption
            color={chat.isArchived ? 'success' : 'warning'}
            onClick={() => handleArchive(chat)}
          >
            <IonIcon
              slot="icon-only"
              icon={chat.isArchived ? arrowUndo : archive}
            />
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle onClick={handleHeaderClick} style={{ cursor: 'pointer' }}>
            {t('dashboard.chats')}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowSearch(true)}>
              <IonIcon icon={searchOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingText={t('refresh.pulling')}
            refreshingSpinner="crescent"
            refreshingText={t('refresh.refreshing')}
          />
        </IonRefresher>

        {isLoading ? (
          <SkeletonLoader variant="chat-list" />
        ) : chats.length === 0 ? (
          <div className="empty-state">
            <EmptyStateIllustration type="no-chats" />
            <h2>{t('chat.noChats')}</h2>
            <p>{t('chat.startChatting')}</p>
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedChats.length > 0 && (
              <div className="chat-section">
                <div className="section-header">
                  <IonIcon icon={pin} />
                  <span>{t('chat.pinnedChats')}</span>
                </div>
                <IonList className="chat-list">
                  {pinnedChats.map(renderChatItem)}
                </IonList>
              </div>
            )}

            {/* Active Chats */}
            {activeChats.length > 0 && (
              <IonList className="chat-list">
                {activeChats.map(renderChatItem)}
              </IonList>
            )}

            {/* Archived Section (Collapsible) */}
            {archivedChats.length > 0 && (
              <div className="chat-section archived-section">
                <button
                  className="section-header clickable"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  <IonIcon icon={archive} />
                  <span>
                    {t('chat.archivedChats')} ({archivedChats.length})
                  </span>
                  <IonIcon
                    icon={showArchived ? chevronUp : chevronDown}
                    className="chevron"
                  />
                </button>
                {showArchived && (
                  <IonList className="chat-list">
                    {archivedChats.map(renderChatItem)}
                  </IonList>
                )}
              </div>
            )}
          </>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={openNewChat} className="new-chat-fab">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <style>{`
          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 3rem;
            height: calc(100% - 100px);
          }

          .empty-icon {
            font-size: 4rem;
            color: hsl(var(--muted));
            margin-bottom: 1rem;
          }

          .empty-state h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            color: hsl(var(--foreground));
          }

          .empty-state p {
            margin: 0;
            color: hsl(var(--muted-foreground));
          }

          .chat-section {
            margin-bottom: 1rem;
          }

          .section-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0;
            font-size: 0.75rem;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .section-header.clickable {
            cursor: pointer;
            background: none;
            border: none;
            width: 100%;
            justify-content: flex-start;
          }

          .section-header.clickable:hover {
            color: hsl(var(--foreground));
          }

          .section-header .chevron {
            margin-left: auto;
          }

          .archived-section {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid hsl(var(--border));
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
            --inner-padding-end: 0;
            margin-bottom: 0.5rem;
            border-radius: 1rem;
            overflow: hidden;
          }

          .chat-item::part(native) {
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
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
            align-items: baseline;
            margin-bottom: 0.25rem;
          }

          .chat-name-row {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            flex: 1;
            min-width: 0;
          }

          .pin-icon,
          .mute-icon {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            flex-shrink: 0;
          }

          .chat-name {
            font-weight: 600;
            font-size: 1rem;
            color: hsl(var(--foreground));
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .chat-time {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            margin-left: 0.5rem;
            flex-shrink: 0;
          }

          .chat-preview {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .last-message {
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .unread-badge {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --padding-start: 0.5rem;
            --padding-end: 0.5rem;
            font-size: 0.7rem;
            min-width: 1.25rem;
            height: 1.25rem;
            border-radius: 9999px;
            margin-left: 0.5rem;
          }

          .new-chat-fab {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --box-shadow: 0 4px 16px hsl(var(--primary) / 0.4);
          }

          ion-item-option {
            --padding-start: 1rem;
            --padding-end: 1rem;
          }
        `}</style>
      </IonContent>

      <ChatSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
      />

      {/* Long-press chat preview popover */}
      <IonPopover
        isOpen={!!previewChat}
        event={previewEvent ?? undefined}
        onDidDismiss={() => {
          setPreviewChat(null);
          setPreviewMessages([]);
          setPreviewEvent(null);
        }}
        className="chat-preview-popover"
      >
        {previewChat && (
          <div className="chat-preview-content">
            <div className="preview-header-row">
              <div className="preview-avatar">
                {getChatAvatar(previewChat) ? (
                  <img src={getChatAvatar(previewChat)!} alt="" />
                ) : (
                  <div className="avatar-placeholder-small">
                    {getAvatarInitial(previewChat)}
                  </div>
                )}
              </div>
              <strong className="preview-name">{getChatDisplayName(previewChat)}</strong>
            </div>
            <div className="preview-messages-list">
              {previewMessages.length === 0 ? (
                <p className="preview-empty">{t('chat.noChats')}</p>
              ) : (
                previewMessages.map((msg) => {
                  const isMine = msg.sender_id === profile?.id;
                  const senderName = isMine ? t('common.you') : (msg.sender?.display_name || '');
                  return (
                    <div key={msg.id} className="preview-msg">
                      <span className="preview-msg-sender">{senderName}:</span>
                      <span className="preview-msg-text">
                        {msg.type === 'text'
                          ? (msg.content || '').slice(0, 60)
                          : msg.type === 'image' ? '📷'
                          : msg.type === 'voice' ? '🎤'
                          : msg.type === 'document' ? '📄'
                          : (msg.content || '').slice(0, 60)
                        }
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <button
              className="preview-open-button"
              onClick={() => {
                const chatId = previewChat.id;
                setPreviewChat(null);
                setPreviewMessages([]);
                setPreviewEvent(null);
                openChat(chatId);
              }}
            >
              {t('common.open') || 'Open'}
            </button>
          </div>
        )}
      </IonPopover>

      <style>{`
        .chat-preview-popover {
          --width: 280px;
          --max-height: 350px;
        }

        .chat-preview-content {
          padding: 0.75rem;
        }

        .preview-header-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid hsl(var(--border));
        }

        .preview-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
        }

        .preview-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder-small {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
          border-radius: 50%;
        }

        .preview-name {
          font-size: 0.95rem;
          color: hsl(var(--foreground));
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-messages-list {
          max-height: 180px;
          overflow-y: auto;
          margin-bottom: 0.5rem;
        }

        .preview-msg {
          padding: 0.25rem 0;
          font-size: 0.8rem;
          line-height: 1.3;
          color: hsl(var(--foreground));
        }

        .preview-msg-sender {
          font-weight: 600;
          margin-right: 0.25rem;
          color: hsl(var(--primary));
          font-size: 0.75rem;
        }

        .preview-msg-text {
          color: hsl(var(--muted-foreground));
        }

        .preview-empty {
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
          text-align: center;
          padding: 1rem 0;
          margin: 0;
        }

        .preview-open-button {
          width: 100%;
          padding: 0.5rem;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border: none;
          border-radius: 0.5rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </IonPage>
  );
};

export default ChatList;
