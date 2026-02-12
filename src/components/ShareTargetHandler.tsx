import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
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
  IonToast,
} from '@ionic/react';
import { useAuthContext } from '../contexts/AuthContext';
import { getMyChats, type ChatWithDetails } from '../services/chat';
import { uploadImage } from '../services/storage';
import { sendMessage } from '../services/message';
import { MessageType } from '../types/database';
import {
  initializeShareTarget,
  setShareHandler,
  sharedItemToFile,
  clearShareIntent,
  savePendingShare,
  loadPendingShare,
  type ShareData,
} from '../services/shareTarget';

const ShareTargetHandler: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { isAuthenticated, hasProfile, profile } = useAuthContext();

  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');

  const searchbarRef = useRef<HTMLIonSearchbarElement>(null);
  const initializedRef = useRef(false);

  // ---- Handle incoming share data ----
  const handleShareData = useCallback(
    (data: ShareData) => {
      if (!isAuthenticated || !hasProfile) {
        savePendingShare(data);
        history.push('/login');
        return;
      }
      setShareData(data);
      setIsPickerOpen(true);
      clearShareIntent();
    },
    [isAuthenticated, hasProfile, history]
  );

  // ---- Initialize native listener ----
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initializeShareTarget();
    setShareHandler((data) => handleShareData(data));
  }, [handleShareData]);

  // ---- After login, check for pending share data ----
  useEffect(() => {
    if (isAuthenticated && hasProfile) {
      const pending = loadPendingShare();
      if (pending) {
        setShareData(pending);
        setIsPickerOpen(true);
        clearShareIntent();
      }
    }
  }, [isAuthenticated, hasProfile]);

  // ---- Load chats when picker opens ----
  useEffect(() => {
    if (!isPickerOpen) {
      setSearchQuery('');
      setChats([]);
      return;
    }

    setIsLoading(true);
    getMyChats()
      .then(({ chats: fetched }) => {
        setChats(fetched.filter((c) => !c.isArchived));
      })
      .finally(() => setIsLoading(false));

    setTimeout(() => searchbarRef.current?.setFocus(), 300);
  }, [isPickerOpen]);

  // ---- Helpers (reused from ForwardPicker pattern) ----
  const getChatDisplayName = (chat: ChatWithDetails): string => {
    if (chat.name) return chat.name;
    if (!chat.is_group && chat.members.length > 0) {
      const other = chat.members.find((m) => m.user_id !== profile?.id);
      return other?.user?.display_name || t('dashboard.unnamed');
    }
    return (
      chat.members
        .filter((m) => m.user_id !== profile?.id)
        .map((m) => m.user?.display_name || t('dashboard.unnamed'))
        .slice(0, 3)
        .join(', ') || t('chat.newChat')
    );
  };

  const getChatAvatar = (chat: ChatWithDetails): string | null => {
    if (chat.avatar_url) return chat.avatar_url;
    if (!chat.is_group) {
      const other = chat.members.find((m) => m.user_id !== profile?.id);
      return other?.user?.avatar_url || null;
    }
    return null;
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    return getChatDisplayName(chat)
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim());
  });

  // ---- Send shared content to selected chat ----
  const handleSelectChat = async (chatId: string) => {
    if (!shareData || isSending) return;
    setIsSending(true);

    try {
      if (shareData.type === 'text') {
        const { error } = await sendMessage({
          chatId,
          content: shareData.text,
          type: MessageType.TEXT,
        });
        if (error) throw error;
      } else {
        // Upload and send each image
        for (const item of shareData.items) {
          const file = sharedItemToFile(item);
          const uploadResult = await uploadImage(file, chatId);
          if (uploadResult.error) throw uploadResult.error;

          const { error } = await sendMessage({
            chatId,
            content: shareData.text || undefined,
            type: MessageType.IMAGE,
            mediaUrl: uploadResult.url!,
            mediaMetadata: uploadResult.metadata as unknown as Record<string, unknown>,
          });
          if (error) throw error;
        }
      }

      setToastColor('success');
      setToastMessage(t('share.sent'));
      closePicker();
      history.push(`/chat/${chatId}`);
    } catch {
      setToastColor('danger');
      setToastMessage(t('share.sendFailed'));
    } finally {
      setIsSending(false);
    }
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setShareData(null);
  };

  // ---- Preview section at top of modal ----
  const renderPreview = () => {
    if (!shareData) return null;

    if (shareData.type === 'text') {
      return (
        <div className="share-preview">
          <p className="share-preview-text">{shareData.text}</p>
        </div>
      );
    }

    return (
      <div className="share-preview">
        <div className="share-preview-images">
          {shareData.items.slice(0, 4).map((item, i) => (
            <img
              key={i}
              src={`data:${item.mimeType};base64,${item.base64Data}`}
              alt=""
              className="share-preview-thumb"
            />
          ))}
          {shareData.items.length > 4 && (
            <div className="share-preview-more">
              +{shareData.items.length - 4}
            </div>
          )}
        </div>
        {shareData.items.length > 1 && (
          <p className="share-preview-count">
            {shareData.items.length} {t('share.images')}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <IonModal isOpen={isPickerOpen} onDidDismiss={closePicker}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('share.sendTo')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closePicker} disabled={isSending}>
                {t('common.cancel')}
              </IonButton>
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
          {renderPreview()}

          {isSending ? (
            <div className="share-picker-loading">
              <IonSpinner name="crescent" />
              <p>{t('share.sending')}</p>
            </div>
          ) : isLoading ? (
            <div className="share-picker-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="share-picker-empty">
              <p>{searchQuery.trim() ? t('search.noResults') : t('chat.noChats')}</p>
            </div>
          ) : (
            <IonList className="share-picker-list">
              {filteredChats.map((chat) => {
                const avatarUrl = getChatAvatar(chat);
                const displayName = getChatDisplayName(chat);
                const initial = displayName.charAt(0).toUpperCase();

                return (
                  <IonItem
                    key={chat.id}
                    button
                    detail={false}
                    onClick={() => handleSelectChat(chat.id)}
                    disabled={isSending}
                    className="share-picker-item"
                  >
                    <IonAvatar slot="start" className="share-picker-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" />
                      ) : (
                        <div className="share-avatar-placeholder">{initial}</div>
                      )}
                    </IonAvatar>
                    <IonLabel>
                      <h2 className="share-picker-name">{displayName}</h2>
                      {chat.is_group && (
                        <p className="share-picker-members">
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
            .share-preview {
              padding: 0.75rem 1rem;
              border-bottom: 1px solid hsl(var(--border));
            }

            .share-preview-text {
              color: hsl(var(--foreground));
              font-size: 0.9rem;
              margin: 0;
              max-height: 4rem;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .share-preview-images {
              display: flex;
              gap: 0.5rem;
              overflow-x: auto;
            }

            .share-preview-thumb {
              width: 64px;
              height: 64px;
              object-fit: cover;
              border-radius: 8px;
              flex-shrink: 0;
            }

            .share-preview-more {
              width: 64px;
              height: 64px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 8px;
              background: hsl(var(--muted));
              color: hsl(var(--muted-foreground));
              font-weight: 600;
              flex-shrink: 0;
            }

            .share-preview-count {
              font-size: 0.8rem;
              color: hsl(var(--muted-foreground));
              margin: 0.5rem 0 0 0;
            }

            .share-picker-loading,
            .share-picker-empty {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 200px;
              color: hsl(var(--muted-foreground));
              gap: 0.5rem;
            }

            .share-picker-list {
              background: transparent;
            }

            .share-picker-item {
              --background: transparent;
              --padding-start: 1rem;
              --padding-end: 1rem;
              --inner-padding-end: 0;
              --border-color: hsl(var(--border));
            }

            .share-picker-item:active {
              --background: hsl(var(--muted) / 0.3);
            }

            .share-picker-avatar {
              width: 44px;
              height: 44px;
            }

            .share-avatar-placeholder {
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

            .share-picker-name {
              font-weight: 600;
              font-size: 1rem;
              color: hsl(var(--foreground));
              margin: 0;
            }

            .share-picker-members {
              font-size: 0.8rem;
              color: hsl(var(--muted-foreground));
              margin: 0.125rem 0 0 0;
            }
          `}</style>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage}
        duration={2500}
        color={toastColor}
        onDidDismiss={() => setToastMessage('')}
      />
    </>
  );
};

export default ShareTargetHandler;
