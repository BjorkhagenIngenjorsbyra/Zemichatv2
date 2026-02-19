import { useState, useEffect, useCallback } from 'react';
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
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonAlert,
  IonInput,
} from '@ionic/react';
import { personAddOutline, logOutOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getChat, type ChatWithDetails } from '../services/chat';
import { getSharedMedia, updateChatName, leaveChat } from '../services/chatInfo';
import { usePresence } from '../hooks/usePresence';
import { type User } from '../types/database';

const ChatInfo: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { chatId } = useParams<{ chatId: string }>();
  const { profile } = useAuthContext();

  const [chat, setChat] = useState<ChatWithDetails | null>(null);
  const [sharedMedia, setSharedMedia] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);

  // For 1-on-1 chats, get the other member
  const otherMember = (!chat?.is_group && chat?.members)
    ? chat.members.find((m) => m.user_id !== profile?.id)
    : undefined;
  const otherUser: User | undefined = otherMember?.user;

  const { lastSeenText, isOnline } = usePresence(otherUser?.id);

  const loadData = useCallback(async () => {
    if (!chatId) return;

    const [chatResult, mediaResult] = await Promise.all([
      getChat(chatId),
      getSharedMedia(chatId),
    ]);

    if (!chatResult.chat) {
      history.replace('/chats');
      return;
    }

    setChat(chatResult.chat);
    setSharedMedia(mediaResult.urls);
    setNewName(chatResult.chat.name || '');
    setIsLoading(false);
  }, [chatId, history]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveName = async () => {
    if (!chatId || !newName.trim()) return;
    await updateChatName(chatId, newName.trim());
    setChat((prev) => prev ? { ...prev, name: newName.trim() } : prev);
    setEditingName(false);
  };

  const handleLeave = async () => {
    if (!chatId) return;
    await leaveChat(chatId);
    history.replace('/chats');
  };

  const getChatDisplayName = (): string => {
    if (!chat) return '';
    if (chat.name) return chat.name;
    if (!chat.is_group && otherUser) {
      return otherUser.display_name || t('dashboard.unnamed');
    }
    return t('chat.newChat');
  };

  if (isLoading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={`/chat/${chatId}`} />
            </IonButtons>
            <IonTitle>{t('chatInfo.title')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent />
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/chat/${chatId}`} />
          </IonButtons>
          <IonTitle>{t('chatInfo.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="chat-info-container">
          {/* Avatar + Name section */}
          <div className="info-header">
            <div className="info-avatar">
              {chat?.is_group ? (
                <div className="avatar-placeholder large">
                  {getChatDisplayName().charAt(0)?.toUpperCase() || '?'}
                </div>
              ) : otherUser?.avatar_url ? (
                <img src={otherUser.avatar_url} alt={otherUser.display_name || ''} />
              ) : (
                <div className="avatar-placeholder large">
                  {(otherUser?.display_name || '?').charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>

            {chat?.is_group && editingName ? (
              <div className="edit-name-row">
                <IonInput
                  value={newName}
                  onIonInput={(e) => setNewName(e.detail.value || '')}
                  placeholder={t('chatInfo.editGroupName')}
                  className="edit-name-input"
                />
                <button className="save-name-btn" onClick={handleSaveName}>
                  {t('common.save')}
                </button>
              </div>
            ) : (
              <h2
                className="info-name"
                onClick={chat?.is_group && chat.created_by === profile?.id ? () => setEditingName(true) : undefined}
                style={chat?.is_group && chat.created_by === profile?.id ? { cursor: 'pointer' } : undefined}
              >
                {getChatDisplayName()}
              </h2>
            )}

            {/* 1-on-1: show last seen */}
            {!chat?.is_group && lastSeenText && (
              <p className={`info-subtitle ${isOnline ? 'online' : ''}`}>
                {lastSeenText}
              </p>
            )}

            {/* 1-on-1: show contact info */}
            {!chat?.is_group && otherUser && (
              <p className="info-zemi">{otherUser.zemi_number}</p>
            )}
          </div>

          {/* Members section (group chats) */}
          {chat?.is_group && (
            <div className="info-section">
              <h3 className="section-title">
                {t('chatInfo.members')} ({chat.members.filter((m) => !m.left_at).length})
              </h3>
              <IonList className="members-list">
                {chat.members
                  .filter((m) => !m.left_at)
                  .map((member) => (
                    <IonItem key={member.user_id} className="member-item">
                      <IonAvatar slot="start" className="member-avatar">
                        {member.user?.avatar_url ? (
                          <img src={member.user.avatar_url} alt={member.user.display_name || ''} />
                        ) : (
                          <div className="avatar-placeholder small">
                            {(member.user?.display_name || '?').charAt(0)?.toUpperCase()}
                          </div>
                        )}
                      </IonAvatar>
                      <IonLabel>
                        <h3>{member.user?.display_name || t('dashboard.unnamed')}</h3>
                        <p>{member.user?.zemi_number}</p>
                      </IonLabel>
                    </IonItem>
                  ))}

                {/* Add member button */}
                <IonItem
                  button
                  className="member-item"
                  onClick={() => history.push(`/new-chat?addTo=${chatId}`)}
                >
                  <IonAvatar slot="start" className="member-avatar">
                    <div className="avatar-placeholder small add-icon">
                      <IonIcon icon={personAddOutline} />
                    </div>
                  </IonAvatar>
                  <IonLabel>
                    <h3>{t('chatInfo.addMember')}</h3>
                  </IonLabel>
                </IonItem>
              </IonList>
            </div>
          )}

          {/* Shared media */}
          <div className="info-section">
            <h3 className="section-title">{t('chatInfo.sharedMedia')}</h3>
            {sharedMedia.length === 0 ? (
              <p className="empty-text">{t('chatInfo.noSharedMedia')}</p>
            ) : (
              <div className="media-grid">
                {sharedMedia.map((url, index) => (
                  <div key={index} className="media-thumb">
                    <img src={url} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leave group button */}
          {chat?.is_group && (
            <div className="info-section">
              <button className="leave-button" onClick={() => setShowLeaveAlert(true)}>
                <IonIcon icon={logOutOutline} />
                {t('chatInfo.leaveGroup')}
              </button>
            </div>
          )}
        </div>

        <IonAlert
          isOpen={showLeaveAlert}
          onDidDismiss={() => setShowLeaveAlert(false)}
          header={t('chatInfo.leaveGroup')}
          message={t('chatInfo.leaveGroupConfirm')}
          buttons={[
            { text: t('common.cancel'), role: 'cancel' },
            {
              text: t('chatInfo.leaveGroup'),
              role: 'destructive',
              handler: handleLeave,
            },
          ]}
        />

        <style>{`
          .chat-info-container {
            padding: 1rem;
          }

          .info-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1.5rem 0;
            border-bottom: 1px solid hsl(var(--border));
            margin-bottom: 1rem;
          }

          .info-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            overflow: hidden;
            margin-bottom: 0.75rem;
          }

          .info-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            border-radius: 50%;
          }

          .avatar-placeholder.large {
            font-size: 2rem;
          }

          .avatar-placeholder.small {
            font-size: 1rem;
          }

          .avatar-placeholder.add-icon {
            background: hsl(var(--muted));
            color: hsl(var(--foreground));
          }

          .info-name {
            font-size: 1.25rem;
            font-weight: 700;
            color: hsl(var(--foreground));
            margin: 0 0 0.25rem 0;
            text-align: center;
          }

          .info-subtitle {
            font-size: 0.85rem;
            color: hsl(var(--muted-foreground));
            margin: 0 0 0.25rem 0;
          }

          .info-subtitle.online {
            color: hsl(var(--secondary));
          }

          .info-zemi {
            font-family: monospace;
            font-size: 0.85rem;
            color: hsl(var(--foreground) / 0.7);
            margin: 0;
          }

          .edit-name-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            width: 100%;
            max-width: 300px;
          }

          .edit-name-input {
            --background: hsl(var(--card));
            --border-radius: 0.5rem;
            --padding-start: 0.75rem;
          }

          .save-name-btn {
            padding: 0.5rem 1rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
          }

          .info-section {
            margin-bottom: 1.5rem;
          }

          .section-title {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: hsl(var(--foreground) / 0.6);
            margin: 0 0 0.75rem 0;
          }

          .members-list {
            background: transparent;
            padding: 0;
          }

          .member-item {
            --background: hsl(var(--card));
            --border-color: hsl(var(--border));
          }

          .member-avatar {
            width: 40px;
            height: 40px;
          }

          .media-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
            border-radius: 0.5rem;
            overflow: hidden;
          }

          .media-thumb {
            aspect-ratio: 1;
            overflow: hidden;
          }

          .media-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .empty-text {
            font-size: 0.85rem;
            color: hsl(var(--muted-foreground));
            text-align: center;
            padding: 1rem 0;
          }

          .leave-button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.75rem 1rem;
            background: transparent;
            border: 1px solid hsl(var(--destructive));
            border-radius: 0.75rem;
            color: hsl(var(--destructive));
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            justify-content: center;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default ChatInfo;
