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
import { getMyChats, addMemberToChat, type ChatWithDetails } from '../../services/chat';
import { useAuthContext } from '../../contexts/AuthContext';

interface AddToChatPickerProps {
  isOpen: boolean;
  userId: string | null;
  userName: string | null;
  onClose: () => void;
  onAdded: (chatId: string) => void;
}

const AddToChatPicker: React.FC<AddToChatPickerProps> = ({
  isOpen,
  userId,
  userName,
  onClose,
  onAdded,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const searchbarRef = useRef<HTMLIonSearchbarElement>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true);
      getMyChats()
        .then(({ chats: fetchedChats }) => {
          // Filter: only group chats (or chats that can become groups)
          // where the target user is NOT already a member
          const available = fetchedChats.filter((c) => {
            if (c.isArchived) return false;
            const isMember = c.members.some((m) => m.user_id === userId);
            return !isMember;
          });
          setChats(available);
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
      setIsAdding(null);
    }
  }, [isOpen, userId]);

  const getChatDisplayName = (chat: ChatWithDetails): string => {
    if (chat.name) return chat.name;

    if (!chat.is_group && chat.members.length > 0) {
      const otherMember = chat.members.find((m) => m.user_id !== profile?.id);
      return otherMember?.user?.display_name || t('dashboard.unnamed');
    }

    const memberNames = chat.members
      .filter((m) => m.user_id !== profile?.id)
      .map((m) => m.user?.display_name || t('dashboard.unnamed'))
      .slice(0, 3);

    return memberNames.join(', ') || t('chat.newChat');
  };

  const getChatAvatar = (chat: ChatWithDetails): string | null => {
    if (chat.avatar_url) return chat.avatar_url;

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

  const getMemberPreview = (chat: ChatWithDetails): string => {
    const names = chat.members
      .filter((m) => m.user_id !== profile?.id)
      .map((m) => m.user?.display_name || t('dashboard.unnamed'))
      .slice(0, 3);
    const suffix = chat.members.length > 4 ? '...' : '';
    return names.join(', ') + suffix;
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const name = getChatDisplayName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase().trim());
  });

  const handleSelectChat = async (chatId: string) => {
    if (!userId || isAdding) return;
    setIsAdding(chatId);

    const { error } = await addMemberToChat(chatId, userId);

    if (error) {
      console.error('Failed to add member to chat:', error);
      setIsAdding(null);
      return;
    }

    onAdded(chatId);
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('friends.addToExistingChat')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>{t('common.cancel')}</IonButton>
          </IonButtons>
        </IonToolbar>
        {userName && (
          <IonToolbar>
            <p className="add-to-chat-subtitle">
              {t('friends.addUserToChat', { name: userName })}
            </p>
          </IonToolbar>
        )}
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
          <div className="atc-loading">
            <IonSpinner name="crescent" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="atc-empty">
            <p>{searchQuery.trim() ? t('search.noResults') : t('friends.noChatsAvailable')}</p>
          </div>
        ) : (
          <IonList className="atc-list">
            {filteredChats.map((chat) => {
              const avatarUrl = getChatAvatar(chat);
              const displayName = getChatDisplayName(chat);
              const initial = getAvatarInitial(chat);
              const adding = isAdding === chat.id;

              return (
                <IonItem
                  key={chat.id}
                  button
                  detail={false}
                  onClick={() => handleSelectChat(chat.id)}
                  className="atc-item"
                  disabled={!!isAdding}
                >
                  <IonAvatar slot="start" className="atc-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      <div className="atc-avatar-placeholder">
                        {initial}
                      </div>
                    )}
                  </IonAvatar>
                  <IonLabel>
                    <h2 className="atc-name">{displayName}</h2>
                    <p className="atc-members">{getMemberPreview(chat)}</p>
                  </IonLabel>
                  {adding && <IonSpinner name="crescent" slot="end" />}
                </IonItem>
              );
            })}
          </IonList>
        )}

        <style>{`
          .add-to-chat-subtitle {
            text-align: center;
            font-size: 0.85rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            padding: 0.25rem 1rem;
          }

          .atc-loading,
          .atc-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: hsl(var(--muted-foreground));
            gap: 0.5rem;
          }

          .atc-list {
            background: transparent;
          }

          .atc-item {
            --background: transparent;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
            --border-color: hsl(var(--border));
          }

          .atc-item:active {
            --background: hsl(var(--muted) / 0.3);
          }

          .atc-avatar {
            width: 44px;
            height: 44px;
          }

          .atc-avatar-placeholder {
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

          .atc-name {
            font-weight: 600;
            font-size: 1rem;
            color: hsl(var(--foreground));
            margin: 0;
          }

          .atc-members {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0.125rem 0 0 0;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default AddToChatPicker;
