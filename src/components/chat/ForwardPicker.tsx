import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonButtons,
  IonButton,
  IonSpinner,
} from '@ionic/react';
import { getMyChats, type ChatWithDetails } from '../../services/chat';
import { useAuthContext } from '../../contexts/AuthContext';

interface ForwardPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

const ForwardPicker: React.FC<ForwardPickerProps> = ({
  isOpen,
  onClose,
  onSelectChat,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const searchbarRef = useRef<HTMLIonSearchbarElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getMyChats()
        .then(({ chats: fetchedChats }) => {
          setChats(fetchedChats.filter((c) => !c.isArchived));
        })
        .finally(() => {
          setIsLoading(false);
        });

      setTimeout(() => {
        searchbarRef.current?.setFocus();
      }, 300);
    } else {
      setSearchQuery('');
      setChats([]);
    }
  }, [isOpen]);

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

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const name = getChatDisplayName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase().trim());
  });

  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('contextMenu.forwardTo')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>{t('common.cancel')}</IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            ref={searchbarRef}
            value={searchQuery}
            onIonInput={(e) => setSearchQuery(e.detail.value || '')}
            placeholder={t('common.search')}
            debounce={0}
            showCancelButton="never"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {isLoading ? (
          <div className="forward-picker-loading">
            <IonSpinner name="crescent" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="forward-picker-empty">
            <p>{searchQuery.trim() ? t('search.noResults') : t('chat.noChats')}</p>
          </div>
        ) : (
          <IonList className="forward-picker-list">
            {filteredChats.map((chat) => {
              const avatarUrl = getChatAvatar(chat);
              const displayName = getChatDisplayName(chat);
              const initial = getAvatarInitial(chat);

              return (
                <IonItem
                  key={chat.id}
                  button
                  detail={false}
                  onClick={() => handleSelectChat(chat.id)}
                  className="forward-picker-item"
                >
                  <IonAvatar slot="start" className="forward-picker-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      <div className="forward-avatar-placeholder">
                        {initial}
                      </div>
                    )}
                  </IonAvatar>
                  <IonLabel>
                    <h2 className="forward-picker-name">{displayName}</h2>
                    {chat.is_group && (
                      <p className="forward-picker-members">
                        {chat.members.length} {t('chat.members')}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
              );
            })}
          </IonList>
        )}

        <style>{`
          .forward-picker-loading,
          .forward-picker-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: hsl(var(--muted-foreground));
            gap: 0.5rem;
          }

          .forward-picker-list {
            background: transparent;
          }

          .forward-picker-item {
            --background: transparent;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
            --border-color: hsl(var(--border));
          }

          .forward-picker-item:active {
            --background: hsl(var(--muted) / 0.3);
          }

          .forward-picker-avatar {
            width: 44px;
            height: 44px;
          }

          .forward-avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 1.1rem;
            border-radius: 50%;
          }

          .forward-picker-name {
            font-weight: 600;
            font-size: 1rem;
            color: hsl(var(--foreground));
            margin: 0;
          }

          .forward-picker-members {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0.125rem 0 0 0;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default ForwardPicker;
