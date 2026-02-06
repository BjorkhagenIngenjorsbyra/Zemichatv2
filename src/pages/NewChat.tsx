import { useState, useEffect, useCallback } from 'react';
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
  IonSpinner,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonSearchbar,
  IonButton,
} from '@ionic/react';
import { personOutline, personAddOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getMyFriends, type FriendWithUser } from '../services/friend';
import { createChat } from '../services/chat';
import type { User } from '../types/database';

const NewChat: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const [contacts, setContacts] = useState<User[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadContacts = useCallback(async () => {
    // Get accepted friends only
    const { friends } = await getMyFriends();

    // Extract user from each friendship
    const friendUsers = friends.map((f: FriendWithUser) => f.user);
    setContacts(friendUsers);
    setFilteredContacts(friendUsers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const search = searchText.toLowerCase();
    const filtered = contacts.filter((c) => {
      const name = c.display_name?.toLowerCase() || '';
      const zemi = c.zemi_number?.toLowerCase() || '';
      return name.includes(search) || zemi.includes(search);
    });
    setFilteredContacts(filtered);
  }, [searchText, contacts]);

  const handleSelectContact = async (contact: User) => {
    if (isCreating) return;

    setIsCreating(true);

    const { chat, error } = await createChat({
      memberIds: [contact.id],
      isGroup: false,
    });

    if (error) {
      console.error('Failed to create chat:', error);
      setIsCreating(false);
      return;
    }

    if (chat) {
      history.replace(`/chat/${chat.id}`);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/chats" />
          </IonButtons>
          <IonTitle>{t('chat.newChat')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || '')}
            placeholder={t('common.search') || 'Search...'}
            className="search-bar"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        {isLoading ? (
          <div className="loading-state">
            <IonSpinner name="crescent" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={personOutline} className="empty-icon" />
            <h2>{t('chat.noFriends')}</h2>
            <p>{t('chat.addFriendsFirst')}</p>
            <IonButton routerLink="/add-friend" className="add-friend-button">
              <IonIcon icon={personAddOutline} slot="start" />
              {t('friends.addFriend')}
            </IonButton>
          </div>
        ) : (
          <>
            <p className="section-label">{t('chat.selectFriend')}</p>
            <IonList className="contact-list">
              {filteredContacts.map((contact) => (
                <IonItem
                  key={contact.id}
                  button
                  detail={false}
                  className="contact-item"
                  onClick={() => handleSelectContact(contact)}
                  disabled={isCreating}
                >
                  <IonAvatar slot="start" className="contact-avatar">
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt={contact.display_name || ''} />
                    ) : (
                      <div className="avatar-placeholder">
                        {contact.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </IonAvatar>
                  <IonLabel>
                    <h2 className="contact-name">
                      {contact.display_name || t('dashboard.unnamed')}
                    </h2>
                    <p className="contact-zemi">{contact.zemi_number}</p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </>
        )}

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
            margin: 0 0 1rem 0;
            color: hsl(var(--muted-foreground));
          }

          .add-friend-button {
            --border-radius: 9999px;
            font-weight: 600;
          }

          .section-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 1rem 0.5rem;
          }

          .search-bar {
            --background: hsl(var(--card));
            --border-radius: 1rem;
            --box-shadow: none;
          }

          .contact-list {
            background: transparent;
            padding: 0;
          }

          .contact-item {
            --background: hsl(var(--card));
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
            margin-bottom: 0.5rem;
            border-radius: 1rem;
            overflow: hidden;
          }

          .contact-item::part(native) {
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
          }

          .contact-avatar {
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

          .contact-name {
            font-weight: 600;
            font-size: 1rem;
            color: hsl(var(--foreground));
            margin: 0 0 0.25rem 0;
          }

          .contact-zemi {
            font-family: monospace;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default NewChat;
